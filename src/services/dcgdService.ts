import { supabase } from './supabaseConfig';
import { DisciplineRecord } from '../types/models';

export const DCGDService = {
    /**
     * Get discipline records for a student
     */
    getRecords: async (studentId: string): Promise<DisciplineRecord[]> => {
        const { data, error } = await supabase
            .from('discipline_records')
            .select('*')
            .eq('student_id', studentId)
            .order('incident_date', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    /**
     * Get summary of student profile (Class, Roll etc.)
     * Reuses the Common Student Service or fetches directly if specialized needed.
     */
    getProfileSummary: async (studentId: string) => {
        const { data, error } = await supabase
            .from('student_enrollments')
            .select(`
                *,
                class_sections (
                    classes (name),
                    sections (name)
                ),
                academic_years (code)
            `)
            .eq('student_id', studentId)
            .eq('status', 'active')
            .single();

        if (error) return null; // Handle UI accordingly
        return data;
    }
};
