import { apiClient } from './api';

export type NotificationType =
  | 'RENT_DUE'
  | 'RENT_OVERDUE'
  | 'PAYMENT_RECEIVED'
  | 'MOVE_IN_CONFIRMED'
  | 'MOVE_OUT_INITIATED'
  | 'COMPLAINT_ASSIGNED'
  | 'COMPLAINT_RESOLVED'
  | 'ANNOUNCEMENT'
  | 'SYSTEM';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  data: Record<string, unknown> | null;
}

export async function getNotifications(unreadOnly?: boolean): Promise<Notification[]> {
  const { data } = await apiClient.get<{ success: boolean; data: Notification[] }>(
    '/notifications',
    { params: unreadOnly ? { unreadOnly: true } : {} },
  );
  return data.data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.put(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.put('/notifications/mark-all-read');
}
