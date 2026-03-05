import { supabase } from './supabaseConfig';
import { Invoice } from '../types/invoices';

export const InvoiceService = {
  /**
   * Fetch invoices (student fees) with pagination and joins.
   * Orders by creation date descending.
   */
  async getInvoices(page: number = 0, pageSize: number = 10): Promise<Invoice[]> {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase.
    from('student_fees').
    select(`
                *,
                student:students (
                    admission_no,
                    person:persons (
                        first_name,
                        last_name,
                        display_name
                    )
                ),
                fee_structure:fee_structures (
                    amount,
                    fee_type:fee_types (
                        name,
                        description,
                        code
                    )
                )
            `).
    order('created_at', { ascending: false }).
    range(from, to);

    if (error) {

      throw error;
    }

    return data as Invoice[];
  },

  /**
   * Fetch a single invoice by ID for PDF generation details.
   */
  async getInvoiceById(id: string): Promise<Invoice | null> {
    const { data, error } = await supabase.
    from('student_fees').
    select(`
                *,
                student:students (
                    admission_no,
                    person:persons (
                        first_name,
                        last_name,
                        display_name
                    )
                ),
                fee_structure:fee_structures (
                    amount,
                    fee_type:fee_types (
                        name,
                        description,
                        code
                    )
                )
            `).
    eq('id', id).
    single();

    if (error) throw error;
    return data as Invoice;
  }
};