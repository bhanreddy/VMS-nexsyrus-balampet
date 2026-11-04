/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Text } from 'react-native';
import StaffComplaints from '../../app/staff/complaints';
import { LibraryService } from '../services/libraryService';
import { TeacherService, ComplaintService } from '../services/commonServices';
const { act, create } = require('react-test-renderer');
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon', MaterialIcons: 'Icon' }));
jest.mock('../features/app-tour', () => ({ TourTarget: ({ children }: any) => children, TourScrollView: require('react-native').ScrollView }));
jest.mock('../components/AppTextInput', () => ({ __esModule: true, default: 'Input' }));
jest.mock('../../components/keyboard/KeyboardAwareScreen', () => ({ __esModule: true, default: ({ children }: any) => children }));
jest.mock('../components/StaffHeader', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/ViewAsBanner', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/LogoLoader', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/StudentPhoto', () => ({ __esModule: true, default: () => null }));
jest.mock('../hooks/useEffectiveStaffId', () => ({ useEffectiveStaffId: () => ({ isViewingAsAdmin: false }) }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('../services/commonServices', () => ({ ComplaintService: { getAll: jest.fn(), create: jest.fn(), createBulk: jest.fn() }, TeacherService: { getMyClasses: jest.fn() } }));
jest.mock('../services/libraryService', () => ({ LibraryService: { classes: jest.fn(), students: jest.fn() } }));
jest.mock('../services/studentService', () => ({ StudentService: { getAll: jest.fn() } }));
jest.mock('../services/attendanceService', () => ({ AttendanceService: { getMyClass: jest.fn().mockResolvedValue(null) } }));
jest.mock('../utils/crossPlatformAlert', () => ({ alertCompat: jest.fn() }));
jest.mock('../utils/openPlayStore', () => ({ promptAppReviewAfterSuccess: jest.fn() }));
let tree: any;
async function press(label: string) {
  let node = tree.root.findAllByType(Text).find((n: any) => n.props.children === label);
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  if (!node) throw new Error(`Missing button ${label}`);
  await act(async () => { node.props.onPress(); });
}
beforeEach(() => {
  jest.clearAllMocks();
  (ComplaintService.getAll as jest.Mock).mockResolvedValue([]);
  (LibraryService.classes as jest.Mock).mockResolvedValue([{ class_section_id: 'cs1', class_id: 'c1', section_id: 's1', label: 'Class 9-A' }]);
  (LibraryService.students as jest.Mock).mockResolvedValue([{ id: 'student-1', display_name: 'Reader', admission_no: 'S001' }]);
  (TeacherService.getMyClasses as jest.Mock).mockResolvedValue([]);
});
afterEach(() => { act(() => tree?.unmount()); });
it('loads school-wide classes and students without requiring a teaching assignment', async () => {
  await act(async () => { tree = create(<StaffComplaints schoolWide embedded />); });
  await press('New Report'); await press('Class pick');
  expect(LibraryService.classes).toHaveBeenCalled();
  expect(LibraryService.students).toHaveBeenCalledWith({ class_id: 'c1', section_id: 's1' });
  expect(TeacherService.getMyClasses).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(Text).map((n: any) => n.props.children).flat().join(' ')).toContain('Reader');
});
it('keeps staff class selection on their teaching assignments', async () => {
  await act(async () => { tree = create(<StaffComplaints />); });
  await press('New Report'); await press('Class pick');
  expect(TeacherService.getMyClasses).toHaveBeenCalled();
  expect(LibraryService.classes).not.toHaveBeenCalled();
});
