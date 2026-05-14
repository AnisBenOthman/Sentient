import type { NotificationResponse } from "@/lib/api/hr-core";
import { authStore } from "@/lib/auth";

export type NotificationSseEvent =
  | { type: "notification.created"; notification: NotificationResponse }
  | { type: "notification.updated"; notification: NotificationResponse };

interface NotificationSseClientOptions {
  onEvent: (event: NotificationSseEvent) => void;
  onFallback: () => void;
}

export class NotificationSseClient {
  private source: EventSource | null = null;
  private failures = 0;

  constructor(private readonly options: NotificationSseClientOptions) {}

  start(): void {
    const token = authStore.getAccess();
    if (!token) return;
    this.stop();
    const baseUrl = import.meta.env.VITE_HR_CORE_URL ?? "http://localhost:3001";
    this.source = new EventSource(
      `${baseUrl}/notifications/stream?accessToken=${encodeURIComponent(token)}`,
    );
    this.source.onopen = () => {
      this.failures = 0;
    };
    this.source.addEventListener("notification.created", (event) => {
      this.failures = 0;
      const notification = parseNotification(event.data);
      if (!notification) return;
      this.options.onEvent({
        type: "notification.created",
        notification,
      });
    });
    this.source.addEventListener("notification.updated", (event) => {
      this.failures = 0;
      const notification = parseNotification(event.data);
      if (!notification) return;
      this.options.onEvent({
        type: "notification.updated",
        notification,
      });
    });
    this.source.onerror = () => {
      this.failures += 1;
      if (this.failures >= 3) {
        this.stop();
        this.options.onFallback();
      }
    };
  }

  stop(): void {
    this.source?.close();
    this.source = null;
  }
}

function parseNotification(data: string): NotificationResponse | null {
  try {
    return JSON.parse(data) as NotificationResponse;
  } catch {
    return null;
  }
}
