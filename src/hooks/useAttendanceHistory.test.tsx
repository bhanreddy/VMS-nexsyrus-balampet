/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { ClassService } from '../services/classService';
import { api } from '../services/apiClient';
import { useAttendanceHistory } from './useAttendanceHistory';
const { act, create } = require('react-test-renderer');
jest.mock('../services/classService', () => ({ ClassService: { getAcademicYears: jest.fn() } }));
jest.mock('../services/apiClient', () => ({ api: { get: jest.fn() } }));
let history: ReturnType<typeof useAttendanceHistory>;
let tree: any;
function Harness({ student = 'child-1', enabled = true }: { student?: string; enabled?: boolean }) {
  history = useAttendanceHistory(student, 'parent-1', enabled);
  return null;
}
const record = (date: string) => ({ attendance_date: date, status: 'present' });
const page = (number: number, dates: string[], totalPages = 2) => ({ records: dates.map(record), meta: { page: number, total: 3, total_pages: totalPages } });
async function render() { await act(async () => { tree = create(<Harness />); }); }
beforeEach(() => { jest.clearAllMocks(); jest.mocked(ClassService.getAcademicYears).mockResolvedValue([{ id: 'year-1', code: '2026–27', start_date: '2026-06-01', end_date: '2027-05-31', is_current: true }] as any); });
afterEach(() => { act(() => tree?.unmount()); });

it('requests current academic-year history in bounded pages and appends older months without duplicates', async () => {
  jest.mocked(api.get).mockResolvedValueOnce(page(1, ['2026-11-01', '2026-10-31'])).mockResolvedValueOnce(page(2, ['2026-10-31', '2026-09-30']));
  await render();
  expect(api.get).toHaveBeenCalledWith('/students/child-1/attendance', { page: 1, limit: 20, from_date: '2026-06-01', to_date: '2027-05-31' }, { silent: true });
  await act(async () => { history.loadMore(); history.loadMore(); });
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(api.get).toHaveBeenLastCalledWith('/students/child-1/attendance', { page: 2, limit: 20, from_date: '2026-06-01', to_date: '2027-05-31' }, { silent: true });
  expect(history.records.map(item => item.attendance_date)).toEqual(['2026-11-01', '2026-10-31', '2026-09-30']);
  expect(history.hasMore).toBe(false);
  await act(async () => { history.loadMore(); });
  expect(api.get).toHaveBeenCalledTimes(2);
});

it('retains loaded cards after a failed page and retries the same page explicitly', async () => {
  jest.mocked(api.get).mockResolvedValueOnce(page(1, ['2026-11-01'])).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(page(2, ['2026-10-31']));
  await render();
  await act(async () => { history.loadMore(); });
  expect(history.error).toBe(true);
  expect(history.records).toHaveLength(1);
  await act(async () => { history.loadMore(); });
  expect(api.get).toHaveBeenCalledTimes(2);
  await act(async () => { history.retry(); });
  expect(api.get).toHaveBeenLastCalledWith('/students/child-1/attendance', { page: 2, limit: 20, from_date: '2026-06-01', to_date: '2027-05-31' }, { silent: true });
  expect(history.records).toHaveLength(2);
  expect(history.error).toBe(false);
});

it('refreshes from page one and ignores an older in-flight page response', async () => {
  let resolveOlder!: (value: any) => void;
  jest.mocked(api.get).mockResolvedValueOnce(page(1, ['2026-10-31'])).mockImplementationOnce(() => new Promise(resolve => { resolveOlder = resolve; })).mockResolvedValueOnce(page(1, ['2026-11-01']));
  await render();
  await act(async () => { history.loadMore(); });
  await act(async () => { await history.refresh(); });
  await act(async () => { resolveOlder(page(2, ['2026-09-30'])); });
  expect(history.records.map(item => item.attendance_date)).toEqual(['2026-11-01']);
  expect(history.hasMore).toBe(true);
});

it('ignores responses from a previous student after the account changes', async () => {
  let resolveOld!: (value: any) => void;
  jest.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce(page(1, ['2026-08-01'], 1));
  await render();
  await act(async () => { tree.update(<Harness student="child-2" />); });
  await act(async () => { resolveOld(page(1, ['2026-11-01'])); });
  expect(history.records.map(item => item.attendance_date)).toEqual(['2026-08-01']);
});

it('does not request history until a student and eligible account are available', async () => {
  await act(async () => { tree = create(<Harness enabled={false} />); });
  expect(api.get).not.toHaveBeenCalled();
  expect(history.records).toEqual([]);
});

it('keeps attendance visible when an older API omits pagination metadata', async () => {
  jest.mocked(api.get).mockResolvedValueOnce({ records: [record('2026-10-31')] });
  await render();
  expect(history.records).toHaveLength(1);
  expect(history.error).toBe(false);
  expect(history.hasMore).toBe(false);
  expect(history.academicYear).toBe('2026–27');
});

it('does not silently substitute a different academic year when none is current', async () => {
  jest.mocked(ClassService.getAcademicYears).mockResolvedValue([]);
  await render();
  expect(api.get).not.toHaveBeenCalled();
  expect(history.error).toBe(true);
});
