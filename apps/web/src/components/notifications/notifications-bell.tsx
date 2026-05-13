import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsDrawer } from "./notifications-drawer";
import { useNotifications } from "./notifications-provider";

export function NotificationsBell() {
  const { unreadCount, setOpen } = useNotifications();
  const label = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative h-8 w-8"
        aria-label="Open notifications"
        title="Notifications"
        onClick={() => setOpen(true)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-blue-600 px-1 text-[10px] font-semibold leading-4 text-white">
            {label}
          </span>
        )}
      </Button>
      <NotificationsDrawer />
    </>
  );
}
