import { api } from './apiClient';

export interface InboxNotification {
  id: string;
  title: string;
  body: string;
  actionUrl: string | null;
  type: string | null;
  createdAt: string;
  readAt: string | null;
}

interface InboxResponse {
  notifications: InboxNotification[];
}

export const notificationInboxService = {
  async list(limit = 100): Promise<InboxNotification[]> {
    const response = await api.get<InboxResponse>('/notifications/inbox', { limit }, { silent: true });
    return Array.isArray(response?.notifications) ? response.notifications : [];
  },

  async markRead(notificationId: string): Promise<void> {
    if (!notificationId) return;
    await api.post(`/notifications/${encodeURIComponent(notificationId)}/read`, undefined, { silent: true });
  },
};
