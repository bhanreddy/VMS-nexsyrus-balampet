import { useState, useCallback } from 'react';
import { PayrollService } from '../services/payrollService';
import { PayrollEntry } from '../types/payroll';

export function usePayroll() {
    const [loading, setLoading] = useState(false);
    const [payrollData, setPayrollData] = useState<PayrollEntry[]>([]);
    const [summary, setSummary] = useState({ total_paid: 0, total_pending: 0 });

    // Default to current month
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const fetchPayroll = useCallback(async (month: number = selectedMonth, year: number = selectedYear) => {
        setLoading(true);
        const data = await PayrollService.getPayrollForMonth(month, year);
        setPayrollData(data);

        // Calculate summary
        const paid = data.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.net_salary || 0), 0);
        const pending = data.filter(p => p.status === 'pending').reduce((sum, p) => sum + (p.net_salary || 0), 0);
        setSummary({ total_paid: paid, total_pending: pending });

        setLoading(false);
    }, [selectedMonth, selectedYear]);

    const markAsPaid = async (id: string) => {
        const success = await PayrollService.markAsPaid(id);
        if (success) {
            // Optimistic update
            setPayrollData(prev => prev.map(item =>
                item.id === id
                    ? { ...item, status: 'paid', payment_date: new Date().toISOString().split('T')[0] }
                    : item
            ));
        }
        return success;
    };

    return {
        payrollData,
        loading,
        summary,
        selectedMonth,
        selectedYear,
        setSelectedMonth,
        setSelectedYear,
        fetchPayroll,
        markAsPaid
    };
}
