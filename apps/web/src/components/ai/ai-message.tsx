import { Bot, UserRound } from "lucide-react";
import type { AiMessageResponse } from "@/lib/api/ai";
import { cn } from "@/lib/utils";
import { AiResponseFeedback } from "./ai-response-feedback";
import { SourceContextList } from "./source-context-list";

export function AiMessage({
  message,
  onRate,
  feedbackDisabled,
}: {
  message: AiMessageResponse;
  onRate?: (message: AiMessageResponse, rating: "POSITIVE" | "NEGATIVE") => void;
  feedbackDisabled?: boolean;
}) {
  const isAssistant = message.role === "ASSISTANT";

  return (
    <div className={cn("flex gap-3", isAssistant ? "items-start" : "items-start justify-end")}>
      {isAssistant && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[78ch] rounded-md border px-4 py-3 text-sm leading-6 shadow-sm",
          isAssistant
            ? "border-gray-200 bg-white text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
            : "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100",
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <SourceContextList sources={message.sourceContext} />
        {isAssistant && onRate && (
          <AiResponseFeedback disabled={feedbackDisabled} onRate={(rating) => onRate(message, rating)} />
        )}
      </div>
      {!isAssistant && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
          <UserRound className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
