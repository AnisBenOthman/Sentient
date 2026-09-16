import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Brain, ExternalLink, Loader2, Send, Sparkles, X } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getConversation,
  listConversations,
  sendConversationMessage,
  startConversation,
  type AiMessageResponse,
  type ConversationTurnResponse,
} from "@/lib/api/ai";
import { getGatewayErrorMessage } from "@/lib/api/gateway-error";
import { cn } from "@/lib/utils";
import { useTypewriter } from "@/hooks/use-typewriter";
import { TypingIndicator } from "@/components/ai/typing-indicator";

interface ChatLine {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
}

function toChatLine(message: AiMessageResponse): ChatLine | null {
  if (message.role !== "USER" && message.role !== "ASSISTANT") return null;
  // The compact widget has no room for the confirmation card; point at the full page (FR-042).
  const content = message.confirmationPayload
    ? `${message.content}\n\nOpen the AI Assistant page to review and confirm this booking.`
    : message.content;
  return {
    id: message.id,
    role: message.role,
    content,
  };
}

function toChatLines(messages: AiMessageResponse[]): ChatLine[] {
  return messages.flatMap((message) => {
    const line = toChatLine(message);
    return line ? [line] : [];
  });
}

function SentientBotMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full text-white shadow-xl",
        compact ? "h-10 w-10" : "h-14 w-14",
      )}
      aria-hidden="true"
    >
      <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_150deg,#2563eb_0deg,#60a5fa_84deg,#0f172a_168deg,#2563eb_276deg,#38bdf8_360deg)]" />
      <span className="absolute inset-[2px] rounded-full bg-white dark:bg-slate-950" />
      <span className="absolute inset-[5px] rounded-full border border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-900" />
      <span
        className={cn(
          "relative grid place-items-center bg-[hsl(217,91%,60%)] shadow-lg shadow-blue-600/25",
          compact ? "h-6 w-6 rounded-lg" : "h-9 w-9 rounded-xl",
        )}
      >
        <Brain className={cn("text-white", compact ? "h-3.5 w-3.5" : "h-5 w-5")} />
      </span>
      <span
        className={cn(
          "absolute rounded-full border-2 border-white bg-emerald-400 shadow-sm shadow-emerald-400/50 dark:border-slate-950",
          compact ? "bottom-0.5 right-0.5 h-2.5 w-2.5" : "bottom-1 right-1 h-3.5 w-3.5",
        )}
      />
    </span>
  );
}

function FloatingChatBubble({ line, animate }: { line: ChatLine; animate: boolean }) {
  const assistant = line.role === "ASSISTANT";
  const displayed = useTypewriter(line.content, animate && assistant);
  return (
    <div className={cn("flex", assistant ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-6 shadow-sm",
          assistant
            ? "rounded-tl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            : "rounded-tr-md bg-blue-600 text-white",
        )}
      >
        <p className="whitespace-pre-wrap">{displayed}</p>
      </div>
    </div>
  );
}

export function FloatingAiAssistant() {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [loadedLatest, setLoadedLatest] = useState(false);
  /** The one assistant line currently allowed to play its typing animation. */
  const [typingLineId, setTypingLineId] = useState<string | null>(null);

  const conversationsQuery = useQuery({
    queryKey: ["ai-conversations", "floating"],
    queryFn: () => listConversations({ page: 1, pageSize: 5 }),
    enabled: open && !loadedLatest,
  });

  const latestConversationId = useMemo(
    () => conversationsQuery.data?.items.find((conversation) => conversation.status !== "ARCHIVED")?.id ?? null,
    [conversationsQuery.data?.items],
  );

  const {
    mutate: loadConversation,
    isPending: isLoadingConversation,
  } = useMutation({
    mutationFn: getConversation,
    onSuccess: (detail) => {
      setConversationId(detail.conversation.id);
      setLines(toChatLines(detail.messages).slice(-8));
      setLoadedLatest(true);
      setTypingLineId(null);
      setError("");
    },
    onError: (err: unknown) => {
      setLoadedLatest(true);
      setError(getGatewayErrorMessage(err, "Could not load your latest AI conversation."));
    },
  });

  const {
    mutate: sendTurn,
    isPending: isSendingTurn,
  } = useMutation({
    mutationFn: ({ message, activeConversationId }: { message: string; activeConversationId: string | null }) =>
      activeConversationId
        ? sendConversationMessage(activeConversationId, { message })
        : startConversation({ message }),
    onSuccess: (turn: ConversationTurnResponse) => {
      setConversationId(turn.conversation.id);
      setLines((current) => [...current, ...toChatLines(turn.userMessage ? [turn.userMessage, turn.assistantMessage] : [turn.assistantMessage])].slice(-10));
      setTypingLineId(turn.assistantMessage.id);
      setError("");
      setPendingPrompt(null);
      setLoadedLatest(true);
      void queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["ai-conversations", "floating"] });
    },
    onError: (err: unknown) => {
      setPendingPrompt(null);
      setError(getGatewayErrorMessage(err, "The AI assistant could not complete this request."));
    },
  });

  useEffect(() => {
    if (!open || loadedLatest || conversationsQuery.isLoading || isLoadingConversation) return;
    if (latestConversationId) {
      loadConversation(latestConversationId);
      return;
    }
    if (conversationsQuery.data) {
      setLoadedLatest(true);
    }
  }, [
    conversationsQuery.data,
    conversationsQuery.isLoading,
    isLoadingConversation,
    latestConversationId,
    loadConversation,
    loadedLatest,
    open,
  ]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, open, pendingPrompt]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isSendingTurn) return;
    setDraft("");
    setError("");
    setPendingPrompt(message);
    sendTurn({ message, activeConversationId: conversationId });
  }

  const hasMessages = lines.length > 0 || pendingPrompt;
  const busy = isSendingTurn || isLoadingConversation || conversationsQuery.isLoading;

  return (
    <div className="fixed bottom-5 right-5 z-50 sm:bottom-6 sm:right-6">
      {open && (
        <section
          className="mb-3 flex h-[min(650px,calc(100vh-7rem))] w-[calc(100vw-2.5rem)] max-w-[390px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/50"
          aria-label="Sentient AI assistant chat"
        >
          <header className="border-b border-slate-200 bg-slate-950 px-4 py-3 text-white dark:border-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <SentientBotMark compact />
                <div>
                  <p className="text-sm font-semibold leading-tight">Sentient AI</p>
                  <p className="text-xs text-slate-300">Connected to assistant messages</p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-full p-1.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                onClick={() => setOpen(false)}
                aria-label="Close AI assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-4 dark:bg-slate-950">
            {!hasMessages ? (
              <div className="grid min-h-full content-center gap-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900">
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ask from anywhere</p>
                  <p className="mx-auto mt-1 max-w-[16rem] text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Leave, OKRs, analytics, onboarding, policy, and workplace wording stay one click away.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {lines.map((line) => (
                  <FloatingChatBubble key={line.id} line={line} animate={line.id === typingLineId} />
                ))}
                {pendingPrompt && (
                  <>
                    <div className="flex justify-end">
                      <div className="max-w-[82%] rounded-2xl rounded-tr-md bg-blue-600 px-3 py-2 text-sm leading-6 text-white shadow-sm">
                        <p className="whitespace-pre-wrap">{pendingPrompt}</p>
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="flex items-center rounded-2xl rounded-tl-md border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <TypingIndicator className="text-slate-400 dark:text-slate-500" />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
            <form onSubmit={submit} className="flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask Sentient AI..."
                className="max-h-28 min-h-11 resize-none rounded-xl bg-slate-50 text-sm dark:bg-slate-900"
                disabled={isSendingTurn}
              />
              <Button
                type="submit"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-full bg-blue-600 text-white"
                disabled={!draft.trim() || isSendingTurn}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <Link
              href="/ai-assistant"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
            >
              Open full assistant
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-transparent text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        aria-label={open ? "Close Sentient AI assistant" : "Open Sentient AI assistant"}
      >
        <span className="absolute inset-1 rounded-full bg-blue-500/20 blur-lg transition-opacity group-hover:opacity-80" />
        {open ? (
          <span className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-full shadow-xl shadow-slate-950/25">
            <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_150deg,#2563eb_0deg,#60a5fa_84deg,#0f172a_168deg,#2563eb_276deg,#38bdf8_360deg)]" />
            <span className="absolute inset-[2px] rounded-full bg-white dark:bg-slate-950" />
            <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white dark:bg-[hsl(217,91%,60%)]">
              <X className="h-5 w-5" />
            </span>
          </span>
        ) : (
          <SentientBotMark />
        )}
      </button>
    </div>
  );
}
