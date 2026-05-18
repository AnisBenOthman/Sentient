import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { dismissAllNotifications, markAllAsRead } from "@/lib/api/hr-core";
import { dismissAllInCache, invalidateNotifications, markAllReadInCache } from "@/lib/notifications/notifications-store";
import { NotificationRow } from "./notification-row";
import { NotificationsFilterChips } from "./notifications-filter-chips";
import { useNotifications } from "./notifications-provider";

export function NotificationsDrawer() {
  const queryClient = useQueryClient();
  const {
    open,
    setOpen,
    activeCategory,
    setActiveCategory,
    notifications,
    isLoading,
  } = useNotifications();

  async function markAll(): Promise<void> {
    await markAllAsRead(activeCategory ?? undefined);
    markAllReadInCache(queryClient, activeCategory);
    await invalidateNotifications(queryClient);
  }

  async function clearAll(): Promise<void> {
    await dismissAllNotifications(activeCategory ?? undefined);
    dismissAllInCache(queryClient, activeCategory);
    await invalidateNotifications(queryClient);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col gap-4 p-4 sm:max-w-md">
        <SheetHeader className="pr-8">
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>Your recent HR workflow updates</SheetDescription>
        </SheetHeader>
        <NotificationsFilterChips value={activeCategory} onChange={setActiveCategory} />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{notifications.length} items</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void markAll()}
              disabled={!notifications.some((n) => n.status === "UNREAD")}
            >
              Mark all as read
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => void clearAll()}
              disabled={notifications.length === 0}
            >
              Clear all
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {isLoading && <div className="py-8 text-center text-sm text-gray-500">Loading...</div>}
          {!isLoading && notifications.length === 0 && (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-gray-500">
              No notifications
            </div>
          )}
          {notifications.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
