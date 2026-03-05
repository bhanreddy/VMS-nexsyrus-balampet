import { useState, useEffect, useCallback } from 'react';
import { AnalyticsService, FinancialAnalytics, AttendanceAnalytics, Insight } from '../services/analyticsService';
import { startOfMonth, startOfYear, subQuarters, format } from 'date-fns';

export type TimeRange = 'month' | 'quarter' | 'year';

export function useAnalytics() {
  const [range, setRange] = useState<TimeRange>('month');
  const [loading, setLoading] = useState(true);
  const [financials, setFinancials] = useState<FinancialAnalytics | null>(null);
  const [attendance, setAttendance] = useState<AttendanceAnalytics | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);

  // Date State
  const [fromDate, setFromDate] = useState<Date>(startOfMonth(new Date()));
  const [toDate, setToDate] = useState<Date>(new Date());

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const fDate = format(fromDate, 'yyyy-MM-dd');
      const tDate = format(toDate, 'yyyy-MM-dd');

      const [finData, attData, insData] = await Promise.all([
      AnalyticsService.getFinancials(fDate, tDate, range === 'year' ? 'month' : 'week'),
      AnalyticsService.getAttendance(fDate, tDate),
      AnalyticsService.getInsights()]
      );

      setFinancials(finData);
      setAttendance(attData);
      setInsights(insData);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, range]);

  // Handle Preset Changes
  useEffect(() => {
    const today = new Date();
    let start = new Date();

    switch (range) {
      case 'month':
        start = startOfMonth(today);
        break;
      case 'quarter':
        start = subQuarters(today, 1);
        break;
      case 'year':
        start = startOfYear(today);
        break;
    }
    setFromDate(start);
    setToDate(today);
  }, [range]);

  // Fetch on date change
  useEffect(() => {
    refreshData();
  }, [fromDate, toDate]); // Range change triggers date change, which triggers this

  return {
    financials,
    attendance,
    insights,
    loading,
    range,
    setRange,
    fromDate,
    toDate,
    refreshData
  };
}