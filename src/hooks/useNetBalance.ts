import { useState, useCallback } from 'react';
import { api } from '../services/apiClient';

export interface NetBalanceData {
  totalFee: number;
  totalSalary: number;
  totalExpenses: number;
  netBalance: number;
}

export function useNetBalance() {
  const [data, setData] = useState<NetBalanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNetBalance = useCallback(async (startDate: string, endDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<NetBalanceData>(`/analytics/net-balance`, { startDate, endDate });
      setData(response);
    } catch (err: any) {

      setError(err.message || 'Failed to fetch net balance');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    data,
    loading,
    error,
    fetchNetBalance
  };
}