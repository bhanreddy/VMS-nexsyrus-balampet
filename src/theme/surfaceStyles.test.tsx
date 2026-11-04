/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { FlatSurfaceContext } from '../contexts/SurfaceAppearanceContext';
import { useSurfaceMaterials, useSurfaceStyleMap } from './surfaceStyles';
import { clayCard, clayInset } from './clayStyles';
const { act, create } = require('react-test-renderer');
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ theme: require('./types').defaultLightTheme, isDark: false }) }));
let tree: any;
let materials: ReturnType<typeof useSurfaceMaterials>;
let mapped: any;
const original = { card: { boxShadow: 'inset 2px 2px 4px black', elevation: 6 }, sheetSheen: { opacity: 1 } };
function Probe() {
  materials = useSurfaceMaterials();
  mapped = useSurfaceStyleMap(original);
  return null;
}
afterEach(() => { act(() => tree?.unmount()); });
it('removes raised, inset, glow, and sheen treatments throughout the flat portal', () => {
  act(() => { tree = create(<FlatSurfaceContext.Provider value><Probe /></FlatSurfaceContext.Provider>); });
  for (const style of [materials.card(false), materials.inset(false, true), materials.puck(false, '#4F46E5'), materials.row(false), mapped.card] as any[]) {
    expect(style.boxShadow).toBe('none');
    expect(style.shadowOpacity).toBe(0);
    expect(style.elevation).toBe(0);
  }
  expect(mapped.sheetSheen.opacity).toBe(0);
  expect(original.card.elevation).toBe(6);
});
it('preserves existing materials outside the librarian portal', () => {
  act(() => { tree = create(<Probe />); });
  expect(materials.card).toBe(clayCard);
  expect(materials.inset).toBe(clayInset);
  expect(mapped).toBe(original);
});
