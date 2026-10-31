/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { TextInput } from 'react-native';
import StaffDiary from '../../app/staff/diary';
import { DiaryService } from '../services/commonServices';
import { enqueueDiary, startDiaryQueueListener } from '../services/diaryOfflineQueue';
import { alertCompat } from '../utils/crossPlatformAlert';
import DiaryPhotoEditor from '../components/diary/DiaryPhotoEditor';
import * as ImagePicker from 'expo-image-picker';
import { SmartDiaryService } from '../services/smartDiaryService';
import { DiaryHistoryTabSwitcher } from '../components/diary/DiaryHistoryChrome';
const { create, act } = require('react-test-renderer');
jest.mock('../components/diary/DiaryPhotoEditor', () => ({ __esModule: true, default: () => null }));
jest.mock('expo-image-picker', () => ({ requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })), requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })), launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }));
let mockUser: any;
let mockPortal: any;
let mockEntries: any[];
let mockContext: any;
const mockClass = { class_section_id: 'current-class', class_name: '6', section_name: 'A', subject_name: 'Math' };
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({}) }));
jest.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../hooks/useEffectiveStaffId', () => ({ useEffectiveStaffId: () => mockPortal }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ theme: require('../theme/themes').lightTheme, isDark: false }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: () => ({ edit: 'Edit', delete: 'Delete' }) }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('react-native-keyboard-controller', () => ({ KeyboardAvoidingView: 'View', KeyboardAwareScrollView: 'View' }));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon', MaterialIcons: 'Icon' }));
jest.mock('../components/AppTextInput', () => ({ __esModule: true, default: require('react-native').TextInput }));
jest.mock('../components/AppDatePicker', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/StaffHeader', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/ViewAsBanner', () => ({ __esModule: true, default: () => null }));
jest.mock('../utils/haptics', () => ({ selectionAsync: jest.fn(), notificationAsync: jest.fn(), NotificationFeedbackType: { Success: 'success' } }));
jest.mock('../utils/crossPlatformAlert', () => ({ alertCompat: jest.fn() }));
jest.mock('react-native-toast-message', () => ({ __esModule: true, default: { show: jest.fn() } }));
jest.mock('../services/commonServices', () => ({
  DiaryService: { getAll: jest.fn(async () => mockEntries), update: jest.fn(), delete: jest.fn() },
  TeacherService: { getMyClasses: jest.fn(async () => [mockClass]) },
}));
jest.mock('../services/academicPlannerService', () => ({ AcademicPlannerService: {} }));
jest.mock('../services/smartDiaryService', () => ({ SmartDiaryService: {
  extractClassDiary: jest.fn(async () => ({ entries: [], image_url: 'https://example.com/scan.jpg' })),
  getContext: jest.fn(async () => mockContext),
  getTemplates: jest.fn(async () => ({ mine: [], school: [], favourites: [] })),
} }));
jest.mock('../services/diaryOfflineQueue', () => ({
  enqueueDiary: jest.fn(), flushDiaryQueue: jest.fn(async () => ({ flushed: 1 })),
  startDiaryQueueListener: jest.fn(() => () => {}), readPendingClassDiary: jest.fn(async () => null), writePendingClassDiary: jest.fn(),
}));
jest.mock('../services/persistentQueryCache', () => ({ persistentQueryCache: { read: jest.fn(async () => null), write: jest.fn() } }));
let tree: any;
const content = (value: any): string => typeof value === 'string' || typeof value === 'number' ? String(value) : Array.isArray(value) ? value.map(content).join('') : value?.props ? content(value.props.children) : '';
function button(label: string) { return tree.root.findAll((node: any) => node.type?.name === 'PressScale').find((node: any) => content(node.props.children).includes(label)); }
async function press(label: string) { const node = button(label); expect(node).toBeDefined(); await act(async () => { await node.props.onPress(); }); }
async function renderDiary() { await act(async () => { tree = create(<StaffDiary />); }); }
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { userId: 'admin-user', role: { code: 'admin' }, displayName: 'Admin' };
  mockPortal = { isViewingAsAdmin: true, userId: 'teacher-user', viewAsName: 'Teacher' };
  mockEntries = [];
  mockContext = { current: mockClass, recent: [] };
  (DiaryService.update as jest.Mock).mockResolvedValue({});
});
afterEach(() => { act(() => tree?.unmount()); });

it('allows admins to write and queues new entries under the viewed teacher', async () => {
  await renderDiary();
  expect(button('Type Diary').props.disabled).toBeFalsy();
  expect(startDiaryQueueListener).toHaveBeenCalledWith('teacher-user');
  await press('Type Diary');
  const input = tree.root.findAllByType(TextInput).find((node: any) => node.props.multiline);
  await act(async () => { input.props.onChangeText('Complete exercise 2'); });
  await press('Post Homework');
  expect(enqueueDiary).toHaveBeenCalledWith('teacher-user', expect.objectContaining({ content: 'Complete exercise 2', class_section_id: 'current-class' }), []);
  expect(DiaryService.update).not.toHaveBeenCalled();
});

it('updates the selected entry instead of publishing a copy to the current class', async () => {
  mockEntries = [{ id: 'entry-1', entry_date: today(), class_section_id: 'entry-class', subject_name: 'English', title: 'Reading', content: 'Read chapter 1', created_by: 'teacher-user' }];
  await renderDiary();
  await press('Edit');
  const input = tree.root.findAllByType(TextInput).find((node: any) => node.props.multiline);
  await act(async () => { input.props.onChangeText('Read chapter 2'); });
  await press('Save Changes');
  expect(DiaryService.update).toHaveBeenCalledWith('entry-1', expect.objectContaining({ title: 'Reading', content: 'Read chapter 2', input_language: 'auto' }));
  expect(enqueueDiary).not.toHaveBeenCalled();
});

it('keeps an edit open when the update fails', async () => {
  mockEntries = [{ id: 'entry-1', entry_date: today(), class_section_id: 'entry-class', title: 'Reading', content: 'Read chapter 1' }];
  (DiaryService.update as jest.Mock).mockRejectedValue(new Error('Offline'));
  await renderDiary(); await press('Edit'); await press('Save Changes');
  expect(alertCompat).toHaveBeenCalledWith('Could not update diary', 'Offline');
  expect(button('Save Changes')).toBeDefined();
  expect(enqueueDiary).not.toHaveBeenCalled();
});

it('keeps regular staff writing enabled and their own queue identity', async () => {
  mockUser = { userId: 'staff-user', role: { code: 'teacher' } };
  mockPortal = { isViewingAsAdmin: false };
  await renderDiary();
  expect(button('Type Diary').props.disabled).toBeFalsy();
  expect(startDiaryQueueListener).toHaveBeenCalledWith('staff-user');
});

it('opens a camera or gallery choice from the photo diary card', async () => {
  await renderDiary();
  await press('Photo Diary');
  expect(button('Camera')).toBeDefined();
  expect(button('Gallery')).toBeDefined();
});

it('shows class diary upload for a homeroom teacher', async () => {
  mockContext = {
    current: mockClass,
    recent: [],
    class_teacher_sections: [{ class_section_id: 'home-room', class_name: '6', section_name: 'A' }],
  };
  await renderDiary();
  expect(button('Upload class diary')).toBeDefined();
  await press('Upload class diary');
  expect(button('Take photo')).toBeDefined();
  expect(button('Choose from gallery')).toBeDefined();
});

it('saves edits opened from diary history to the original entry', async () => {
  mockEntries = [{ id: 'history-entry', entry_date: today(), class_section_id: 'entry-class', title: 'Reading', content: 'Read chapter 1' }];
  await renderDiary();
  await act(async () => { tree.root.findByType(DiaryHistoryTabSwitcher).props.onChange('history'); });
  await press('Edit'); await press('Save Changes');
  expect(DiaryService.update).toHaveBeenCalledWith('history-entry', expect.objectContaining({ content: 'Read chapter 1' }));
  expect(enqueueDiary).not.toHaveBeenCalled();
});


it('edits a camera photo before adding it and queues the saved scan for upload', async () => {
  (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ assets: [{ uri: 'file://camera.jpg' }] });
  await renderDiary(); await press('Photo Diary'); await press('Camera');
  expect(enqueueDiary).not.toHaveBeenCalled();
  expect(tree.root.findByType(DiaryPhotoEditor).props.uri).toBe('file://camera.jpg');
  await act(async () => tree.root.findByType(DiaryPhotoEditor).props.onSave('file://edited-scan.jpg'));
  expect(tree.root.findAllByType(DiaryPhotoEditor)).toHaveLength(0);
  await press('Send Photo Diary');
  expect(enqueueDiary).toHaveBeenCalledWith('teacher-user', expect.objectContaining({ attachments: [], entry_source: 'PHOTO' }), ['file://edited-scan.jpg']);
});

it('edits gallery pages in order and leaves the upload closed when cancelled', async () => {
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ assets: [{ uri: 'file://one.jpg' }, { uri: 'file://two.jpg' }] });
  await renderDiary(); await press('Photo Diary'); await press('Gallery');
  await act(async () => tree.root.findByType(DiaryPhotoEditor).props.onSave('file://one-edited.jpg'));
  expect(tree.root.findByType(DiaryPhotoEditor).props.uri).toBe('file://two.jpg');
  await act(async () => tree.root.findByType(DiaryPhotoEditor).props.onCancel());
  expect(tree.root.findAllByType(DiaryPhotoEditor)).toHaveLength(0);
  expect(button('Send Photo Diary')).toBeUndefined();
  expect(enqueueDiary).not.toHaveBeenCalled();
});

it('passes the edited class diary photo to text extraction', async () => {
  mockContext = { current: mockClass, recent: [], class_teacher_sections: [{ class_section_id: 'home-room', class_name: '6', section_name: 'A' }] };
  (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ assets: [{ uri: 'file://board.jpg' }] });
  await renderDiary(); await press('Upload class diary'); await press('Take photo');
  expect(SmartDiaryService.extractClassDiary).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType(DiaryPhotoEditor).props.onSave('file://board-edited.jpg'));
  expect(SmartDiaryService.extractClassDiary).toHaveBeenCalledWith('file://board-edited.jpg', expect.objectContaining({ class_section_id: 'home-room' }));
});
