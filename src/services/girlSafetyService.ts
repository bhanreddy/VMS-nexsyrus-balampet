import { api } from './apiClient';

export interface GirlSafetyComplaint {
    id: string;
    ticket_no: string;
    category: string;
    status: 'pending' | 'in_review' | 'resolved';
    created_at: string;
    resolved_at?: string;
    is_anonymous: boolean;
    student_name?: string;
    description?: string;
    assigned_authority?: string;
}

export interface ThreadMessage {
    id: string;
    sender_role: 'student' | 'admin';
    message: string;
    message_te?: string;
    created_at: string;
}

export interface ComplaintDetails extends GirlSafetyComplaint {
    threads: ThreadMessage[];
}

export const GirlSafetyService = {
    getComplaints: async (): Promise<GirlSafetyComplaint[]> => {
        return api.get<GirlSafetyComplaint[]>('/girl-safety');
    },

    getComplaintDetails: async (id: string): Promise<ComplaintDetails> => {
        return api.get<ComplaintDetails>(`/girl-safety/${id}`);
    },

    raiseComplaint: async (data: { category: string; description: string; incident_date?: string; is_anonymous?: boolean }): Promise<GirlSafetyComplaint> => {
        return api.post<GirlSafetyComplaint>('/girl-safety', data);
    },

    addReply: async (id: string, message: string): Promise<ThreadMessage> => {
        return api.post<ThreadMessage>(`/girl-safety/${id}/thread`, { message });
    }
};
