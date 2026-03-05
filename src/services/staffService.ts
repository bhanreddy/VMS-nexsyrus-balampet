import { api } from './apiClient';

export interface Staff {
    id: string;
    person_id: string;
    staff_code: string;
    designation_id?: number;
    joining_date: string;
    status_id: number;
    salary?: number;
    // Joined fields
    first_name?: string;
    last_name?: string;
    display_name?: string;
    photo_url?: string;
    designation_name?: string;
    status_name?: string;
    phone?: string;
    email?: string;
}

export interface CreateStaffRequest {
    // Simplified flattened request for frontend convenience
    first_name: string;
    middle_name?: string;
    last_name: string;
    dob?: string;
    gender_id: number;
    email?: string;
    phone?: string;

    staff_code: string;
    designation_id?: number;
    joining_date: string;
    salary?: number;
    status_id?: number;

    password?: string;
    role_code?: string;
}

// Legacy structure if needed, but easier to use flattened
export interface CreateStaffRequestLegacy {
    person: {
        first_name: string;
        middle_name?: string;
        last_name: string;
        dob?: string;
        gender_id: number;
        photo_url?: string;
    };
    staff: {
        staff_code: string;
        designation_id?: number;
        joining_date: string;
        salary?: number;
    };
    contacts?: Array<{
        contact_type: 'email' | 'phone' | 'address';
        contact_value: string;
        is_primary?: boolean;
    }>;
}

export const StaffService = {
    getAll: async (params?: { status_id?: number }): Promise<Staff[]> => {
        return api.get<Staff[]>('/staff', params);
    },

    getById: async (id: string): Promise<Staff> => {
        return api.get<Staff>(`/staff/${id}`);
    },

    create: async (data: CreateStaffRequest): Promise<Staff> => {
        return api.post<Staff>('/staff', data);
    },

    update: async (id: string, data: Partial<Staff>): Promise<Staff> => {
        return api.put<Staff>(`/staff/${id}`, data);
    },

    delete: async (id: string): Promise<void> => {
        return api.delete<void>(`/staff/${id}`);
    },

    getClassTeacher: async (): Promise<Staff | null> => {
        // TODO: Implement when class-teacher mapping is available
        return null;
    },

    getTimetable: async (id: string, day?: string): Promise<any[]> => {
        return api.get<any[]>(`/staff/${id}/timetable`, { day });
    },

    getPayslips: async (id: string): Promise<any[]> => {
        return api.get<any[]>(`/staff/${id}/payslips`);
    },
};
