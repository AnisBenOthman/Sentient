import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { markAllAsRead } from "@/lib/api/hr-core";
import { invalidateNotifications } from "@/lib/notifications/notifications-store";
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void markAll()}
            disabled={notifications.length === 0}
          >
            Mark all as read
          </Button>
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
