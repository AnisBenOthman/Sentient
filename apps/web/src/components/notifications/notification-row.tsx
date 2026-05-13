import {
  Award,
  Bell,
  CalendarDays,
  CheckCircle2,
  Circle,
  Info,
  Trash2,
} from "lucide-react";
import { useLocation } from "wouter";
import type { NotificationCategory } from "@sentient/shared";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { getRoleTier, type RoleTier } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  dismissNotification,
  markAsRead,
  type NotificationResponse,
} from "@/lib/api/hr-core";
import { invalidateNotifications } from "@/lib/notifications/notifications-store";
import { useQueryClient } from "@tanstack/react-query";

function categoryIcon(category: NotificationCategory) {
  if (category === "LEAVE") return CalendarDays;
  if (category === "PROMOTION") return Award;
  if (category === "SYSTEM") return Info;
  return Bell;
}

function relativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60_000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function deepLink(notification: NotificationResponse, roleTier: RoleTier): string {
  const id = notification.referenceId;
  if (!id) return "/home";
  if (notification.referenceType === "leave_request") {
    if (roleTier === "employee") return `/leaves?requestId=${id}`;
    if (roleTier === "hr_admin") return `/leave-management?requestId=${id}`;
    return `/dashboard?tab=leave&requestId=${id}`;
  }
  if (notification.referenceType === "promotion_request") {
    return `/dashboard?tab=promotions&requestId=${id}`;
  }
  return "/home";
}

export function NotificationRow({ notification }: { notification: NotificationResponse }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const Icon = categoryIcon(notification.category);
  const unread = notification.status === "UNREAD";
  const roleTier = user ? getRoleTier(user) : "employee";

  async function openNotification(): Promise<void> {
    if (unread) await markAsRead(notification.id);
    await invalidateNotifications(queryClient);
    navigate(deepLink(notification, roleTier));
  }

  async function dismiss(): Promise<void> {
    await dismissNotification(notification.id);
    await invalidateNotifications(queryClient);
  }

  return (
    <div
      className={cn(
        "group flex gap-3 rounded-md border p-3 transition-colors",
        unread
          ? "border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/30"
          : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950",
      )}
    >
      <button
        type="button"
        onClick={() => void openNotification()}
        className="flex min-w-0 flex-1 gap-3 text-left"
      >
        <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300">
          <Icon className="h-4 w-4" />
          {unread && <Circle className="absolute -right-1 -top-1 h-2.5 w-2.5 fill-blue-600 text-blue-600" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              {notification.title}
            </span>
            <span className="shrink-0 text-[11px] text-gray-400">
              {relativeTime(notification.createdAt)}
            </span>
          </span>
          <span className="mt-1 line-clamp-3 text-xs leading-5 text-gray-500 dark:text-gray-400">
            {notification.body}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {unread && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Mark as read"
            onClick={() => void openNotification()}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-400"
          title="Dismiss"
          onClick={() => void dismiss()}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
