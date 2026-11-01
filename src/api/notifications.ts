import { apiFetch } from './client';
import type { ApiNotification } from './types';

export async function listMyNotifications({ limit = 100, offset = 0 } = {}) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return (await apiFetch<ApiNotification[]>(`/notifications/me?${query}`)).data;
}

export async function markNotificationRead(notificationId: string) {
  return (await apiFetch<ApiNotification>(`/notifications/${notificationId}/read`, {
    method: 'POST',
  })).data;
}
