import { supabase } from './supabaseConfig';

export const EnrollmentService = {
  /**
   * Ensures that the student has an active enrollment record for the current academic year.
   * If not, it automatically creates one using default rules (first available class/section).
   */
  ensureEnrollment: async (userId: string): Promise<{status: string;message?: string;enrollment_id?: string;}> => {
    try {
      const { data, error } = await supabase.rpc('ensure_student_enrollment', {
        p_user_id: userId
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (err: any) {

      throw err;
    }
  }
};