import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationCategory } from "@sentient/shared";
import {
  getUnreadCount,
  listNotifications,
  type NotificationResponse,
} from "@/lib/api/hr-core";
import { useAuth } from "@/components/providers/auth-provider";
import {
  mergeNotificationIntoCache,
  notificationKeys,
} from "@/lib/notifications/notifications-store";
import { NotificationSseClient } from "@/lib/notifications/sse-client";

interface NotificationsContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  activeCategory: NotificationCategory | null;
  setActiveCategory: (category: NotificationCategory | null) => void;
  unreadCount: number;
  notifications: NotificationResponse[];
  isLoading: boolean;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const FALLBACK_POLL_INTERVAL_MS = 30_000;
const FALLBACK_RETRY_AFTER_CYCLES = 10;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory | null>(null);
  const [pollingFallback, setPollingFallback] = useState(false);
  const fallbackTimerRef = useRef<number | null>(null);
  const isLoggedIn = user !== null;

  const countQuery = useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: getUnreadCount,
    enabled: isLoggedIn,
    refetchInterval: pollingFallback ? FALLBACK_POLL_INTERVAL_MS : false,
  });

  const listQuery = useQuery({
    queryKey: notificationKeys.list(activeCategory),
    queryFn: () =>
      listNotifications({
        category: activeCategory ?? undefined,
        limit: 50,
      }),
    enabled: isLoggedIn && open,
    refetchInterval: open && pollingFallback ? FALLBACK_POLL_INTERVAL_MS : false,
  });

  useEffect(() => {
    if (!isLoggedIn || pollingFallback) return undefined;
    const client = new NotificationSseClient({
      onFallback: () => {
        if (fallbackTimerRef.current !== null) {
          window.clearTimeout(fallbackTimerRef.current);
        }
        setPollingFallback(true);
        fallbackTimerRef.current = window.setTimeout(
          () => {
            fallbackTimerRef.current = null;
            setPollingFallback(false);
          },
          FALLBACK_POLL_INTERVAL_MS * FALLBACK_RETRY_AFTER_CYCLES,
        );
      },
      onEvent: (event) => {
        mergeNotificationIntoCache(queryClient, event.notification);
      },
    });
    client.start();
    return () => client.stop();
  }, [isLoggedIn, pollingFallback, queryClient]);

  useEffect(() => {
    if (isLoggedIn) return undefined;
    setPollingFallback(false);
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    queryClient.removeQueries({ queryKey: notificationKeys.all });
    return undefined;
  }, [isLoggedIn, queryClient]);

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
      }
    };
  }, []);

  const value: NotificationsContextValue = {
    open,
    setOpen,
    activeCategory,
    setActiveCategory,
    unreadCount: countQuery.data?.unreadCount ?? listQuery.data?.unreadCount ?? 0,
    notifications: listQuery.data?.items ?? [],
    isLoading: listQuery.isLoading,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error("useNotifications must be used inside NotificationsProvider");
  return value;
}
