import { api } from './apiClient';

export interface LibraryBook { id: string; title: string; author: string; isbn: string; category: string; publisher: string; copies: number; available: number }
export interface LibraryCopy { id: string; book_id: string; accession_no: string; shelf: string; status: string }
export interface LibraryBorrower { id: string; display_name: string; code: string; kind: string }
export interface LibraryLoan {
  id: string; title: string; accession_no: string; borrower_name: string; due_date: string;
  issued_at: string; returned_at: string | null; renewal_count: number;
  current_fine: number; fine_amount: number; fine_paid: number;
}
export interface LibraryReservation { id: string; title: string; borrower_name: string; created_at: string }
export interface LibrarySettings { loan_days: number; max_loans: number; max_renewals: number; fine_per_day: number }
export interface LibraryReports {
  today: string; inventory: { status: string; count: number }[]; active_loans: number; overdue: number;
  returned: number; outstanding_fines: number; collected_fines: number; borrowers: number;
  activity: { id: string; action: string; actor_name: string; created_at: string; details: Record<string, unknown> }[];
}
export interface LibraryStudent { id: string; person_id: string; display_name: string; admission_no: string; photo_url?: string | null }
export interface LibraryClass { class_section_id: string; class_id: string; section_id: string; label: string }
export type LibraryBookInput = Pick<LibraryBook, 'title' | 'author' | 'isbn' | 'category' | 'publisher'>;
export const LibraryService = {
  books: (search = '', page = 1) => api.get<{ rows: LibraryBook[]; total: number; page: number }>('/library/books', { search, page }),
  saveBook: (data: LibraryBookInput, id?: string) => id ? api.put<LibraryBook>(`/library/books/${id}`, data) : api.post<LibraryBook>('/library/books', data),
  archiveBook: (id: string) => api.delete(`/library/books/${id}`),
  copies: (id: string) => api.get<LibraryCopy[]>(`/library/books/${id}/copies`),
  addCopy: (id: string, data: { accession_no: string; shelf: string }) => api.post<LibraryCopy>(`/library/books/${id}/copies`, data),
  updateCopy: (id: string, data: { status: string; shelf: string }) => api.put<LibraryCopy>(`/library/copies/${id}`, data),
  borrowers: (search: string) => api.get<LibraryBorrower[]>('/library/borrowers', { search }),
  loans: (status = 'active', search = '', page = 1) => api.get<{ rows: LibraryLoan[]; total: number; today: string }>('/library/loans', { status, search, page }),
  issue: (copy_id: string, borrower_person_id: string) => api.post('/library/loans', { copy_id, borrower_person_id }),
  renew: (id: string) => api.post(`/library/loans/${id}/renew`, {}),
  returnBook: (id: string, condition: string) => api.post(`/library/loans/${id}/return`, { condition }),
  payFine: (id: string, amount: number) => api.post(`/library/loans/${id}/payment`, { amount }),
  reservations: () => api.get<LibraryReservation[]>('/library/reservations'),
  reserve: (book_id: string, borrower_person_id: string) => api.post('/library/reservations', { book_id, borrower_person_id }),
  closeReservation: (id: string) => api.delete(`/library/reservations/${id}`),
  settings: () => api.get<LibrarySettings>('/library/settings'),
  saveSettings: (data: LibrarySettings) => api.put<LibrarySettings>('/library/settings', data),
  reports: () => api.get<LibraryReports>('/library/reports'),
  classes: () => api.get<LibraryClass[]>('/library/classes'),
  students: (params: { search?: string; class_id?: string; section_id?: string }) => api.get<LibraryStudent[]>('/library/students', params),
};
