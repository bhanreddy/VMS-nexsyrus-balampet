/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import DailySubstitutionsScreen from '../../app/admin/substitutions';
import { SubstitutionService, SubstitutionBoard, SubstituteCandidate } from '../services/substitutionService';
import { alertCompat } from '../utils/crossPlatformAlert';
const { create, act } = require('react-test-renderer');

jest.mock('../features/app-tour', () => ({ TourTarget: ({ children }: any) => children, TourScrollView: require('react-native').ScrollView }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('../contexts/AdminWebChromeContext', () => ({ useAdminWebChrome: () => ({ shellActive: true }) }));
jest.mock('../components/AdminHeader', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/LogoLoader', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/AppTextInput', () => ({ __esModule: true, default: require('react-native').TextInput }));
jest.mock('../components/AppDatePicker', () => ({ __esModule: true, default: () => null, toYMD: () => '2026-10-31', parseYMD: () => new Date('2026-10-31T12:00:00') }));
jest.mock('../components/admin/substitutions/ManualPlanningBoard', () => ({ __esModule: true, default: () => null }));
jest.mock('../services/schoolService', () => ({ SchoolService: {} }));
jest.mock('../utils/substitutionReportPdf', () => ({ downloadSubstitutionReportPdf: jest.fn() }));
jest.mock('../utils/substitutionReportCsv', () => ({ downloadSubstitutionReportCsv: jest.fn() }));
jest.mock('../utils/crossPlatformAlert', () => ({ alertCompat: jest.fn() }));
jest.mock('../services/substitutionService', () => ({ SubstitutionService: { getBoard: jest.fn(), getCandidates: jest.fn(), assign: jest.fn() } }));

const baseSlot = { class_section_id: 'class-1', period_number: 1, start_time: '09:10', end_time: '09:55', class_name: '10', section_name: 'A', subject_id: 'hindi', subject_name: 'Hindi', regular_teacher_id: 'regular', regular_teacher_name: 'Regular Teacher' };
const board: SubstitutionBoard = {
  date: '2026-10-31', academic_year_id: 'year', timetable_day: 'Saturday', timetable_mode: 'uniform',
  periods: [{ id: 'p1', name: 'Period 1', sort_order: 1, start_time: '09:10', end_time: '09:55' }],
  // Confirmed deliberately arrives first; pending cards should surface ahead of it.
  slots: [
    { ...baseSlot, slot_id: 'covered', class_name: '8', substitution_id: 'assignment', substitute_teacher_name: 'Assigned Teacher' },
    { ...baseSlot, slot_id: 'suggestion', substitution_id: 'suggestion-id', is_auto_suggested: true, reason: 'Leave auto-recommendation' },
    { ...baseSlot, slot_id: 'uncovered', class_name: '5' },
  ],
  teachers: [], summary: { total_slots: 3, covered_slots: 1, uncovered_slots: 2 },
};
const candidate: SubstituteCandidate = { id: 'available', teacher_name: 'Available Teacher', subject_name: 'Hindi', subject_match: true, class_familiarity: true, is_class_teacher: false, daily_load: 2, adjacent_load: 0, recent_substitution_count: 0, score: 95, recommendation: 'Best match', reasons: ['Subject match'] };
let tree: any;
function control(label: string) {
  return tree.root.findAll((n: any) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label)[0];
}
function visibleText() {
  return tree.root.findAllByType(Text).map((n: any) => n.props.children).flat(Infinity).filter((v: any) => typeof v === 'string' || typeof v === 'number').join(' ').replace(/\s+/g, ' ');
}
async function renderScreen() { await act(async () => { tree = create(<DailySubstitutionsScreen />); }); }
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(SubstitutionService.getBoard).mockResolvedValue(board);
  jest.mocked(SubstitutionService.getCandidates).mockResolvedValue({ date: board.date, target: {} as any, candidates: [candidate] });
  jest.mocked(SubstitutionService.assign).mockResolvedValue({ message: 'Assigned', substitution: {} });
});
afterEach(() => { act(() => tree?.unmount()); });

it('keeps auto suggestions pending and filters classes by actual confirmation', async () => {
  await renderScreen();
  const text = visibleText();
  expect(text.indexOf('Review & assign substitute')).toBeLessThan(text.indexOf('COVER CONFIRMED'));
  expect(text.indexOf('Find & assign substitute')).toBeLessThan(text.indexOf('COVER CONFIRMED'));
  expect(control('Review and assign substitute')).toBeDefined();
  await act(async () => { control('Needs cover, 2').props.onPress(); });
  expect(control('Needs cover, 2').props.accessibilityState.selected).toBe(true);
  expect(visibleText()).not.toContain('COVER CONFIRMED');
  expect(visibleText()).toContain('2 of 3 classes shown');
  await act(async () => { control('Confirmed, 1').props.onPress(); });
  expect(control('Review and assign substitute')).toBeUndefined();
  expect(visibleText()).toContain('Assigned Teacher');
  expect(visibleText()).toContain('1 of 3 classes shown');
});

it('reviews the next pending class before saving and confirms it without a blocking success popup', async () => {
  await renderScreen();
  await act(async () => { control('Assign next class, 10-A, Period 1').props.onPress(); });
  expect(SubstitutionService.getCandidates).toHaveBeenCalledWith(board.date, 'suggestion');
  expect(SubstitutionService.assign).not.toHaveBeenCalled();
  expect(visibleText()).toContain('SELECTED SUBSTITUTE');
  expect(visibleText()).toContain('Available Teacher');
  const updated = { ...board, slots: board.slots.map(s => s.slot_id === 'suggestion' ? { ...s, is_auto_suggested: false, substitute_teacher_name: candidate.teacher_name } : s) };
  jest.mocked(SubstitutionService.getBoard).mockResolvedValue(updated);
  await act(async () => { control('Confirm assignment of Available Teacher to 10-A').props.onPress(); });
  expect(SubstitutionService.assign).toHaveBeenCalledWith(expect.objectContaining({ slot_id: 'suggestion', substitute_teacher_id: candidate.id, reason: '', supersede_substitution_id: undefined }));
  expect(visibleText()).toContain('Substitute assigned');
  expect(visibleText()).toContain('Available Teacher is assigned to 10-A');
  expect(control('Needs cover, 1')).toBeDefined();
  expect(alertCompat).not.toHaveBeenCalled();
  await act(async () => { control('Dismiss assignment confirmation').props.onPress(); });
  expect(visibleText()).not.toContain('Substitute assigned');
});

it('explains an empty status filter and can restore all classes', async () => {
  jest.mocked(SubstitutionService.getBoard).mockResolvedValue({ ...board, slots: [board.slots[0]] });
  await renderScreen();
  await act(async () => { control('Needs cover, 0').props.onPress(); });
  expect(visibleText()).toContain('All cover is confirmed');
  const showAll = tree.root.findAllByType(TouchableOpacity).find((n: any) => n.findAllByType(Text).some((t: any) => t.props.children === 'Show all classes'));
  await act(async () => { showAll.props.onPress(); });
  expect(visibleText()).toContain('COVER CONFIRMED');
});
