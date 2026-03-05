import { useState, useCallback } from 'react';
// User asked to use Supabase JS SDK. Let's use supabaseConfig.
import { supabase } from '../services/supabaseConfig';
import { Expense, CreateExpenseRequest, ExpenseStatus } from '../types/expenses';
import { Alert } from 'react-native';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async (searchQuery: string = '') => {
    setLoading(true);
    setError(null);
    try {
      // Get current user to determine school_id (if we had multi-tenant logic on client)
      // But RLS handles visibility. We just select * 

      let query = supabase.
      from('expenses').
      select('*').
      order('expense_date', { ascending: false });

      if (searchQuery) {
        // ILIKE search on title or category
        query = query.or(`title.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`);
      }

      const { data, error: supabaseError } = await query;

      if (supabaseError) throw supabaseError;

      setExpenses(data as Expense[]);
    } catch (err: any) {

      setError(err.message || 'Failed to fetch expenses');
      Alert.alert('Error', 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, []);

  const createExpense = async (expenseData: CreateExpenseRequest) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // school_id should logically come from the user's profile.
      // For now, we fetch the profile to get school_id ?? 
      // Or, if we assume single tenant for this user's context or stored in metadata.
      // Let's assume we can fetch it from the 'users' table or 'students'/'staff' linked.
      // SIMPLIFICATION: In this specific codebase, we might not have 'school_id' explicitly on 'users' yet exposed?
      // Checking schema... 'expenses' requires 'school_id'. 
      // The prompt says: "Assume school_id comes from logged-in user profile".
      // We need to fetch it.

      // 1. Get user profile
      /*
      const { data: profile } = await supabase.from('users').select('school_id').eq('id', user.id).single();
      */
      // Wait, looking at schema, 'users' table DOES NOT have school_id in the view I saw earlier?
      // 'users' has person_id. 
      // Let's check schema.sql again? Or just use a hardcoded UUID if strict, or fetch from a 'schools' table?
      // Actually, in many implementations here, school_id is implicit or linked via roles.
      // CHECK: schema.sql lines 184+ (users table). NO school_id.
      // CHECK: 'staff' table? 'students' table?
      // If I can't find school_id, I'll need to fallback to a dummy implementation or assume it's stored in metadata.
      // FIX: I will use a placeholder UUID or generic one for now if I can't find it, OR add it to the insert if I can derive it.
      // The prompt says "Assume school_id comes from logged-in user profile". 
      // We have removed school_id for single-tenancy.

      const { error } = await supabase.
      from('expenses').
      insert({
        ...expenseData,
        created_by: user.id
      });

      if (error) throw error;

      // Refresh
      await fetchExpenses();
      return true;
    } catch (err: any) {

      Alert.alert('Error', err.message || 'Failed to create expense');
      return false;
    }
  };

  const updateStatus = async (id: string, newStatus: ExpenseStatus) => {
    try {
      const { error } = await supabase.
      from('expenses').
      update({ status: newStatus }).
      eq('id', id);

      if (error) throw error;

      // Optimistic update
      setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, status: newStatus } : e));
      return true;
    } catch (err: any) {

      Alert.alert('Error', 'Failed to update status. Are you an admin?');
      return false;
    }
  };

  return {
    expenses,
    loading,
    error,
    fetchExpenses,
    createExpense,
    updateStatus
  };
}