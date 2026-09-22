import { useTranslation } from "react-i18next";
import { MessageSquareText } from "lucide-react";
import type { ConversationSummary } from "@/lib/api/ai";
import { cn } from "@/lib/utils";
import { AiConversationActions } from "./ai-conversation-actions";

export function AiConversationList({
  conversations,
  activeId,
  disabled,
  onSelect,
  onArchive,
  onRestore,
  onDelete,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  disabled?: boolean;
  onSelect: (conversation: ConversationSummary) => void;
  onArchive: (conversation: ConversationSummary) => void;
  onRestore: (conversation: ConversationSummary) => void;
  onDelete: (conversation: ConversationSummary) => void;
}) {
  const { t } = useTranslation("ai");
  if (conversations.length === 0) {
    return (
      <div className="grid gap-2 rounded-md border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <MessageSquareText className="h-5 w-5" />
        {t("conversationList.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((conversation) => {
        const active = conversation.id === activeId;
        const archived = conversation.status === "ARCHIVED";
        return (
          <div
            key={conversation.id}
            className={cn(
              "rounded-md border p-2 transition-colors",
              active
                ? "border-blue-300 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30"
                : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900",
            )}
          >
            <button
              type="button"
              className="block w-full text-left"
              disabled={disabled}
              onClick={() => onSelect(conversation)}
            >
              <p className="line-clamp-1 text-sm font-medium text-gray-800 dark:text-gray-100">{conversation.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                {conversation.lastMessagePreview ?? t("conversationList.noPreview")}
              </p>
            </button>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase text-gray-400">
                {t(`conversationList.status_${conversation.status}` as "conversationList.status_ACTIVE", {
                  defaultValue: conversation.status,
                })}
              </span>
              <AiConversationActions
                archived={archived}
                disabled={disabled}
                onArchive={() => onArchive(conversation)}
                onRestore={() => onRestore(conversation)}
                onDelete={() => onDelete(conversation)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
