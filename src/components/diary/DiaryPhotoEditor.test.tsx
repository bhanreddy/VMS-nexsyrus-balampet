/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Image } from 'react-native';
import DiaryPhotoEditor from './DiaryPhotoEditor';
import DocumentSurface from './document/DocumentSurface';
import { persistDiaryScan } from './document/diaryPhotoFiles';
import { manipulateAsync } from 'expo-image-manipulator';
const { create, act } = require('react-test-renderer');
jest.mock('./document/DocumentSurface', () => ({ __esModule: true, default: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('./document/diaryPhotoFiles', () => ({ persistDiaryScan: jest.fn(async () => 'file://documents/scan.jpg') }));
jest.mock('expo-image-manipulator', () => ({ SaveFormat: { JPEG: 'jpeg' }, manipulateAsync: jest.fn(async () => ({ base64: 'cGhvdG8=' })) }));
let tree: any;
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Image, 'getSize').mockImplementation((_uri, success) => { success?.(4000, 6000); return undefined as any; });
});
afterEach(() => { act(() => tree?.unmount()); jest.restoreAllMocks(); });

it('normalizes large camera images and returns a durable edited file through the bridge', async () => {
  const onSave = jest.fn();
  await act(async () => { tree = create(<DiaryPhotoEditor uri="file://camera.jpg" onSave={onSave} onCancel={jest.fn()} />); });
  expect(manipulateAsync).toHaveBeenCalledWith('file://camera.jpg', [{ resize: { height: 3200 } }], expect.objectContaining({ base64: true }));
  await act(async () => tree.root.findByType(DocumentSurface).props.onMessage(JSON.stringify({ type: 'save', dataUri: 'data:image/jpeg;base64,cGhvdG8=' })));
  expect(persistDiaryScan).toHaveBeenCalledWith('data:image/jpeg;base64,cGhvdG8=');
  expect(onSave).toHaveBeenCalledWith('file://documents/scan.jpg');
});

it('cancels without saving when the editor sends Escape', async () => {
  const onSave = jest.fn(), onCancel = jest.fn();
  await act(async () => { tree = create(<DiaryPhotoEditor uri="file://camera.jpg" onSave={onSave} onCancel={onCancel} />); });
  await act(async () => tree.root.findByType(DocumentSurface).props.onMessage(JSON.stringify({ type: 'cancel' })));
  expect(onCancel).toHaveBeenCalled();
  expect(onSave).not.toHaveBeenCalled();
  expect(persistDiaryScan).not.toHaveBeenCalled();
});
