import { useCallback, useEffect, useRef, useState } from 'react';
import { ClassService, type AcademicYear } from '../services/classService';
import { api } from '../services/apiClient';
import type { AttendanceRecord } from '../types/models';

interface HistoryPage {
  records: AttendanceRecord[];
  meta?: { total: number; page: number; total_pages: number };
}
const PAGE_SIZE = 20;

/** Current academic-year pages, isolated from the calendar's month query. */
export function useAttendanceHistory(studentId: string | undefined, userId: string | undefined, enabled: boolean) {
  const scope = enabled && studentId && userId ? `${userId}:${studentId}` : '';
  const academicYear = useRef<AcademicYear | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const nextPage = useRef(1);
  const failedPage = useRef<number | null>(null);
  const [state, setState] = useState({ scope, records: [] as AttendanceRecord[], total: 0, academicYear: '', hasMore: true, loading: !!scope, error: false });

  const fetchPage = useCallback(async (page: number, restart = false) => {
    if (!scope || (busy.current && !restart)) return;
    if (restart) { generation.current += 1; academicYear.current = null; }
    const requestGeneration = generation.current;
    busy.current = true;
    failedPage.current = null;
    setState(previous => ({ ...previous, loading: true, error: false }));
    try {
      let year = academicYear.current;
      if (!year) {
        const years = await ClassService.getAcademicYears() as (AcademicYear & { is_current?: boolean })[];
        if (requestGeneration !== generation.current) return;
        const today = new Date();
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        year = years.find(item => item.is_current) ?? years.find(item => item.start_date.slice(0, 10) <= todayKey && item.end_date.slice(0, 10) >= todayKey) ?? null;
        if (!year) throw new Error('No current academic year configured');
        academicYear.current = year;
      }
      const result = await api.get<HistoryPage>(`/students/${studentId}/attendance`, {
        page, limit: PAGE_SIZE, from_date: year.start_date.slice(0, 10), to_date: year.end_date.slice(0, 10),
      }, { silent: true });
      if (requestGeneration !== generation.current) return;
      if (!Array.isArray(result?.records)) throw new Error('Invalid attendance history response');
      const yearCode = year.code;
      // Older API versions may omit page metadata. Keep their records visible.
      const hasMore = result.meta ? result.meta.page < result.meta.total_pages : result.records.length === PAGE_SIZE;
      const total = result.meta?.total ?? 0;
      nextPage.current = page + 1;
      setState(previous => {
        const combined = page === 1 ? result.records : [...previous.records, ...result.records];
        const records = [...new Map(combined.map(record => [record.attendance_date.slice(0, 10), record])).values()]
          .sort((a, b) => b.attendance_date.localeCompare(a.attendance_date));
        return { scope, records, total, academicYear: yearCode, hasMore: hasMore && (page === 1 || records.length > previous.records.length), loading: false, error: false };
      });
    } catch {
      if (requestGeneration !== generation.current) return;
      failedPage.current = page;
      setState(previous => ({ ...previous, loading: false, error: true }));
    } finally {
      if (requestGeneration === generation.current) busy.current = false;
    }
  }, [scope, studentId]);

  useEffect(() => {
    generation.current += 1;
    busy.current = false;
    nextPage.current = 1;
    academicYear.current = null;
    failedPage.current = null;
    setState({ scope, records: [], total: 0, academicYear: '', hasMore: true, loading: !!scope, error: false });
    void fetchPage(1);
    return () => { generation.current += 1; };
  }, [scope, fetchPage]);

  const loadMore = useCallback(() => {
    if (state.scope === scope && state.hasMore && !state.error && !busy.current) void fetchPage(nextPage.current);
  }, [state.scope, state.hasMore, state.error, scope, fetchPage]);
  const retry = useCallback(() => { if (failedPage.current !== null) void fetchPage(failedPage.current); }, [fetchPage]);
  const refresh = useCallback(() => fetchPage(1, true), [fetchPage]);

  return { ...state, records: state.scope === scope ? state.records : [], loadMore, retry, refresh };
}
