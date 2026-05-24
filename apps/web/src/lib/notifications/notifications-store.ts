import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { NotificationCategory, NotificationStatus } from "@sentient/shared";
import type { NotificationListResponse, NotificationResponse } from "@/lib/api/hr-core";

const READ_STATUS = "READ" as NotificationStatus;

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (category: NotificationCategory | null): QueryKey => [
    "notifications",
    { category: category ?? "ALL" },
  ],
  unreadCount: ["notifications", "unread-count"] as const,
};

export async function invalidateNotifications(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
    queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount }),
  ]);
}

function isNotificationListResponse(value: unknown): value is NotificationListResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { items?: unknown };
  return Array.isArray(candidate.items);
}

function listCategory(queryKey: QueryKey): NotificationCategory | null | undefined {
  const [, filters] = queryKey;
  if (!filters || typeof filters !== "object") return undefined;
  const category = (filters as { category?: unknown }).category;
  if (category === "ALL") return null;
  if (typeof category === "string") return category as NotificationCategory;
  return undefined;
}

function belongsInList(
  notification: NotificationResponse,
  category: NotificationCategory | null | undefined,
): boolean {
  if (notification.status === "DISMISSED") return false;
  return category === null || category === undefined || notification.category === category;
}

function unreadDelta(
  previous: NotificationResponse | undefined,
  next: NotificationResponse,
): number {
  const wasUnread = previous?.status === "UNREAD";
  const isUnread = next.status === "UNREAD";
  if (!previous && isUnread) return 1;
  if (wasUnread && !isUnread) return -1;
  if (!wasUnread && isUnread) return 1;
  return 0;
}

function findCachedNotification(
  queryClient: QueryClient,
  id: string,
): NotificationResponse | undefined {
  const queries = queryClient.getQueryCache().findAll({ queryKey: notificationKeys.all });
  for (const query of queries) {
    const data = query.state.data;
    if (!isNotificationListResponse(data)) continue;
    const cached = data.items.find((item) => item.id === id);
    if (cached) return cached;
  }
  return undefined;
}

export function dismissAllInCache(
  queryClient: QueryClient,
  category: NotificationCategory | null,
): void {
  const queries = queryClient.getQueryCache().findAll({ queryKey: notificationKeys.all });
  for (const query of queries) {
    const listCat = listCategory(query.queryKey);
    if (listCat === undefined) continue;
    queryClient.setQueryData<NotificationListResponse>(query.queryKey, (current) => {
      if (!current) return current;
      const items = current.items.filter(
        (item) => category !== null && item.category !== category,
      );
      return {
        ...current,
        items,
        unreadCount: items.filter((i) => i.status === "UNREAD").length,
      };
    });
  }
  if (category === null) {
    queryClient.setQueryData<{ unreadCount: number }>(
      notificationKeys.unreadCount,
      () => ({ unreadCount: 0 }),
    );
  }
}

export function markAllReadInCache(
  queryClient: QueryClient,
  category: NotificationCategory | null,
): void {
  const queries = queryClient.getQueryCache().findAll({ queryKey: notificationKeys.all });
  for (const query of queries) {
    const listCat = listCategory(query.queryKey);
    if (listCat === undefined) continue;
    queryClient.setQueryData<NotificationListResponse>(query.queryKey, (current) => {
      if (!current) return current;
      const items = current.items.map((item) => {
        if (item.status !== "UNREAD") return item;
        if (category !== null && item.category !== category) return item;
        return { ...item, status: READ_STATUS, readAt: new Date().toISOString() };
      });
      return {
        ...current,
        items,
        unreadCount: items.filter((i) => i.status === "UNREAD").length,
      };
    });
  }
  if (category === null) {
    queryClient.setQueryData<{ unreadCount: number }>(
      notificationKeys.unreadCount,
      () => ({ unreadCount: 0 }),
    );
  }
}

export function mergeNotificationIntoCache(
  queryClient: QueryClient,
  notification: NotificationResponse,
): void {
  const previous = findCachedNotification(queryClient, notification.id);
  const delta = unreadDelta(previous, notification);
  const queries = queryClient.getQueryCache().findAll({ queryKey: notificationKeys.all });

  for (const query of queries) {
    const category = listCategory(query.queryKey);
    if (category === undefined) continue;

    queryClient.setQueryData<NotificationListResponse>(query.queryKey, (current) => {
      if (!current) return current;
      const filtered = current.items.filter((item) => item.id !== notification.id);
      const items = belongsInList(notification, category)
        ? [notification, ...filtered]
            .sort((a, b) => {
              const dateDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              return dateDiff || b.id.localeCompare(a.id);
            })
            .slice(0, 50)
        : filtered;

      return {
        ...current,
        items,
        unreadCount: Math.max(0, current.unreadCount + delta),
      };
    });
  }

  if (delta !== 0) {
    queryClient.setQueryData<{ unreadCount: number }>(
      notificationKeys.unreadCount,
      (current) => ({ unreadCount: Math.max(0, (current?.unreadCount ?? 0) + delta) }),
    );
  }
}
