import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("notifications");
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
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("subtitle")}</SheetDescription>
        </SheetHeader>
        <NotificationsFilterChips value={activeCategory} onChange={setActiveCategory} />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{t("items", { count: notifications.length })}</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void markAll()}
              disabled={!notifications.some((n) => n.status === "UNREAD")}
            >
              {t("markAllRead")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => void clearAll()}
              disabled={notifications.length === 0}
            >
              {t("clearAll")}
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {isLoading && <div className="py-8 text-center text-sm text-gray-500">{t("loading")}</div>}
          {!isLoading && notifications.length === 0 && (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-gray-500">
              {t("empty")}
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
