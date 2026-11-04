/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Text } from 'react-native';
import LibraryWorkspace from './LibraryWorkspace';
import { LibraryService } from '../../services/libraryService';
const { act, create } = require('react-test-renderer');
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (callback: any) => require('react').useEffect(callback, [callback]),
}));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('./LibraryHomeHero', () => ({ __esModule: true, default: () => null }));
jest.mock('../../components/StaffToolsDrawer', () => ({ __esModule: true, default: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ theme: require('../../theme/types').defaultLightTheme, isDark: false }) }));
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'librarian' } }) }));
jest.mock('../../components/AppTextInput', () => ({ __esModule: true, default: 'Input' }));
jest.mock('../../../components/keyboard/KeyboardAwareScreen', () => ({ __esModule: true, default: ({ children }: any) => children }));
jest.mock('../../utils/crossPlatformAlert', () => ({ alertCompat: jest.fn() }));
jest.mock('../../services/libraryService', () => ({ LibraryService: {
  books: jest.fn(), loans: jest.fn(), copies: jest.fn(), issue: jest.fn(), renew: jest.fn(), returnBook: jest.fn(),
  borrowers: jest.fn(), settings: jest.fn(), reports: jest.fn(), saveSettings: jest.fn(), addCopy: jest.fn(),
} }));
const book = { id: 'book-1', title: 'Stories', author: 'Writer', copies: 1, available: 1 };
const loan = { id: 'loan-1', title: 'Stories', accession_no: 'LIB001', borrower_name: 'Reader', due_date: '2026-11-02', issued_at: '2026-10-20', returned_at: null, renewal_count: 0, current_fine: 5 };
let tree: any;
const text = () => tree.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ');
const button = (label: string) => tree.root.findAll((node: any) => node.props.label === label && typeof node.props.onPress === 'function')[0];
const press = async (label: string) => { await act(async () => { await button(label).props.onPress(); }); };
async function render(page: any) {
  await act(async () => { tree = create(<LibraryWorkspace page={page} />); });
  await act(async () => { jest.advanceTimersByTime(250); });
}
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  (LibraryService.books as jest.Mock).mockResolvedValue({ rows: [book], total: 1 });
  (LibraryService.copies as jest.Mock).mockResolvedValue([{ id: 'copy-1', accession_no: 'LIB001', shelf: 'A', status: 'available' }]);
  (LibraryService.loans as jest.Mock).mockResolvedValue({ rows: [loan], total: 1, today: '2026-11-04' });
  (LibraryService.borrowers as jest.Mock).mockResolvedValue([{ id: 'person-1', display_name: 'Reader', code: 'S001', kind: 'Student' }]);
  (LibraryService.settings as jest.Mock).mockResolvedValue({ loan_days: 14, max_loans: 3, max_renewals: 2, fine_per_day: 0 });
  (LibraryService.reports as jest.Mock).mockResolvedValue({ inventory: [], active_loans: 0, overdue: 0, returned: 0, borrowers: 0, activity: [] });
});
afterEach(() => { act(() => tree?.unmount()); jest.useRealTimers(); });
it('issues an individual accessioned copy to the selected borrower', async () => {
  await render('catalog');
  await press('Copies & lending');
  await press('Issue copy');
  const input = tree.root.findAllByType('Input').find((n: any) => n.props.accessibilityLabel.startsWith('Find borrower'));
  await act(async () => { input.props.onChangeText('Reader'); });
  await act(async () => { jest.advanceTimersByTime(350); });
  const select = tree.root.findAll((n: any) => typeof n.props.onPress === 'function' && n.props.children?.[0]?.props?.children === 'Reader')[0];
  await act(async () => { select.props.onPress(); });
  await press('Confirm issue');
  expect(LibraryService.issue).toHaveBeenCalledWith('copy-1', 'person-1');
});
it('shows overdue status, blocks renewal and returns the selected condition', async () => {
  await render('loans');
  expect(text()).toContain('OVERDUE');
  expect(button('Renew').props.disabled).toBe(true);
  await press('Return'); await press('Damaged'); await press('Confirm return');
  expect(LibraryService.returnBook).toHaveBeenCalledWith('loan-1', 'damaged');
});
it('clearly shows failed loads and retries them', async () => {
  (LibraryService.books as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
  await render('catalog'); expect(text()).toContain('Offline');
  await press('Retry'); expect(text()).toContain('Stories');
});
it('offers both QR managers and school-wide complaints from the overview', async () => {
  await render('dashboard');
  expect(text()).toContain('Student Login QR'); expect(text()).toContain('Role Login QR');
  const link = tree.root.findAll((n: any) => n.props.accessibilityLabel === 'Complaints & remarks. Report concerns across the school' && typeof n.props.onPress === 'function')[0];
  await act(async () => { link.props.onPress(); });
  expect(mockNavigate).toHaveBeenCalledWith('complaints');
});
it('does not silently save a blank lending policy as zero', async () => {
  await render('settings');
  const input = tree.root.findAllByType('Input').find((n: any) => n.props.accessibilityLabel === 'Loan period (days)');
  await act(async () => { input.props.onChangeText(''); });
  await press('Save policy'); expect(LibraryService.saveSettings).not.toHaveBeenCalled();
});
