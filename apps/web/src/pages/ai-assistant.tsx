import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AiMessage } from "@/components/ai/ai-message";
import { ActionConfirmationCard, ActionOutcomeNotice } from "@/components/ai/action-confirmation-card";
import { AiConversationList } from "@/components/ai/ai-conversation-list";
import { AiDraftToolbar } from "@/components/ai/ai-draft-toolbar";
import { RoutingTraceSummary } from "@/components/ai/routing-trace-summary";
import { TypingIndicator } from "@/components/ai/typing-indicator";
import {
  archiveConversation,
  decideOnProposal,
  deleteConversation,
  getConversation,
  isStreamingTurnResponse,
  listConversations,
  restoreConversation,
  saveResponseFeedback,
  sendConversationMessage,
  startConversation,
  type ActionOutcome,
  type ConversationSummary,
  type AiMessageResponse,
  type ConversationTurnApiResponse,
  type ConversationTurnResponse,
  type RoutingTrace,
} from "@/lib/api/ai";
import { openConversationStream } from "@/lib/api/ai-stream";
import { getGatewayErrorMessage } from "@/lib/api/gateway-error";

const EXAMPLE_PROMPTS = [
  "What is my leave balance and when was my last leave?",
  "Summarize leave coverage, OKR risk, and dashboard trends for my team.",
  "Can you help me reword this message professionally?",
  "What do you think about my colleague? I did not appreciate his behavior.",
];

export default function AiAssistantPage() {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessageResponse[]>([]);
  const [routing, setRouting] = useState<RoutingTrace | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  /** Outcome per outcome-message id, and per proposal token (to re-enable Confirm on FAILED). */
  const [outcomes, setOutcomes] = useState<Record<string, ActionOutcome>>({});
  const [outcomeByToken, setOutcomeByToken] = useState<Record<string, ActionOutcome["status"]>>({});
  /** The one assistant message currently allowed to play its typing animation. */
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  /** The one assistant message currently receiving real token deltas from an open SSE stream. */
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  const conversationsQuery = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: () => listConversations({ page: 1, pageSize: 20 }),
  });

  const turnMutation = useMutation({
    mutationFn: (message: string) =>
      conversationId
        ? sendConversationMessage(conversationId, { message })
        : startConversation({ message }),
    onSuccess: (turn: ConversationTurnApiResponse) => {
      setConversationId(turn.conversation.id);
      setError("");

      if (isStreamingTurnResponse(turn)) {
        const placeholderId = `pending-${turn.streaming.turnId}`;
        setMessages((current) => [
          ...current,
          ...(turn.userMessage ? [turn.userMessage] : []),
          {
            id: placeholderId,
            role: "ASSISTANT",
            content: "",
            agentType: turn.streaming.agentType,
            status: "RUNNING",
            sourceContext: [],
            createdAt: new Date().toISOString(),
          },
        ]);
        setRouting(turn.routing);
        setStreamingMessageId(placeholderId);
        void openConversationStream({
          streamPath: turn.streaming.streamPath,
          onToken: (delta) =>
            setMessages((current) =>
              current.map((message) => (message.id === placeholderId ? { ...message, content: message.content + delta } : message)),
            ),
          onDone: (event) => {
            setMessages((current) => current.map((message) => (message.id === placeholderId ? event.assistantMessage : message)));
            setRouting(event.routing);
            setStreamingMessageId(null);
            void queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
          },
          onError: (message) => {
            // WHY a refetch rather than surfacing `message` directly: the backend's
            // error path always leaves either a FAILED or a completed message
            // persisted (never a half-written row), so reconciling with the server
            // is more honest than trusting whatever the client last saw.
            setStreamingMessageId(null);
            getConversation(turn.conversation.id)
              .then((detail) => setMessages(detail.messages))
              .catch(() => setError(message));
          },
        });
        return;
      }

      setMessages((current) => [...current, ...(turn.userMessage ? [turn.userMessage] : []), turn.assistantMessage]);
      setRouting(turn.routing);
      setTypingMessageId(turn.assistantMessage.id);
      void queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
    onError: (err: unknown) => {
      setError(getGatewayErrorMessage(err, "The AI assistant could not complete this request."));
    },
  });

  /**
   * WHY the proposal message is rewritten with confirmationPayload stripped on
   * success: the card must disappear the moment a decision lands, whatever the
   * outcome, and this state array is not re-fetched from the server. On FAILED
   * the payload is kept so the user can retry (FR-044) — the server's re-validation
   * decides whether the token is still usable.
   */
  const decideMutation = useMutation({
    mutationFn: ({ token, confirmed }: { token: string; confirmed: boolean }) =>
      decideOnProposal(conversationId ?? "", token, confirmed),
    onSuccess: (turn: ConversationTurnResponse, { token }) => {
      const outcome = turn.actionOutcome;
      setMessages((current) => [
        ...current.map((message) =>
          message.confirmationPayload?.confirmationToken === token && outcome?.status !== "FAILED"
            ? { ...message, confirmationPayload: null }
            : message,
        ),
        turn.assistantMessage,
      ]);
      if (outcome) {
        setOutcomes((current) => ({ ...current, [turn.assistantMessage.id]: outcome }));
        setOutcomeByToken((current) => ({ ...current, [token]: outcome.status }));
      }
      setRouting(turn.routing);
      setTypingMessageId(turn.assistantMessage.id);
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
    onError: (err: unknown, { token }) => {
      // A transport failure is not a booking failure: the POST may have gone through.
      setOutcomeByToken((current) => ({ ...current, [token]: "FAILED" }));
      setError(getGatewayErrorMessage(err, "The decision could not be sent. Check the Leaves page before retrying — it may already have gone through."));
    },
  });

  const loadConversationMutation = useMutation({
    mutationFn: getConversation,
    onSuccess: (detail) => {
      setConversationId(detail.conversation.id);
      setMessages(detail.messages);
      setRouting(null);
      setOutcomes({});
      setTypingMessageId(null);
      setStreamingMessageId(null);
      setError("");
    },
    onError: (err: unknown) => {
      setError(getGatewayErrorMessage(err, "Could not open this conversation."));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: archiveConversation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
    onError: (err: unknown) => setError(getGatewayErrorMessage(err, "Could not archive this conversation.")),
  });

  const restoreMutation = useMutation({
    mutationFn: (conversation: ConversationSummary) => restoreConversation(conversation.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
    onError: (err: unknown) => setError(getGatewayErrorMessage(err, "Could not restore this conversation.")),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteConversation,
    onSuccess: () => {
      if (conversationId) {
        setConversationId(null);
        setMessages([]);
        setRouting(null);
      }
      void queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
    onError: (err: unknown) => setError(getGatewayErrorMessage(err, "Could not delete this conversation.")),
  });

  const feedbackMutation = useMutation({
    mutationFn: ({ messageId, rating }: { messageId: string; rating: "POSITIVE" | "NEGATIVE" }) =>
      saveResponseFeedback(messageId, { rating }),
    onError: (err: unknown) => setError(getGatewayErrorMessage(err, "Could not save feedback.")),
  });

  const canSend = draft.trim().length > 0 && !turnMutation.isPending;
  const empty = messages.length === 0;
  const title = useMemo(() => (conversationId ? "AI Assistant" : "Start a Sentient AI conversation"), [conversationId]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const message = draft.trim();
    if (!message) return;
    setDraft("");
    turnMutation.mutate(message);
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[620px] flex-col overflow-hidden p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-600 text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-gray-950 dark:text-gray-50">{title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Supervisor-routed help for Sentient HR workflows, policy, analytics, OKRs, and workplace wording.
            </p>
          </div>
        </div>
        <RoutingTraceSummary routing={routing} />
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto rounded-md border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Conversations</h2>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => {
                setConversationId(null);
                setMessages([]);
                setRouting(null);
                setTypingMessageId(null);
                setStreamingMessageId(null);
              }}
            >
              New
            </Button>
          </div>
          <AiConversationList
            conversations={conversationsQuery.data?.items ?? []}
            activeId={conversationId}
            disabled={loadConversationMutation.isPending || archiveMutation.isPending || deleteMutation.isPending}
            onSelect={(conversation) => loadConversationMutation.mutate(conversation.id)}
            onArchive={(conversation) => archiveMutation.mutate(conversation.id)}
            onRestore={(conversation) => restoreMutation.mutate(conversation)}
            onDelete={(conversation) => deleteMutation.mutate(conversation.id)}
          />
        </aside>

        <div className="min-h-0 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
          {empty ? (
            <div className="grid min-h-full content-center gap-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-white text-blue-600 shadow-sm dark:bg-gray-900">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-2 sm:grid-cols-2">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setDraft(prompt)}
                    className="rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-blue-800 dark:hover:bg-blue-950/30"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id}>
                  <AiMessage
                    message={message}
                    feedbackDisabled={feedbackMutation.isPending}
                    animate={message.id === typingMessageId}
                    streaming={message.id === streamingMessageId}
                    onRate={(ratedMessage, rating) => feedbackMutation.mutate({ messageId: ratedMessage.id, rating })}
                  />
                  {message.role === "ASSISTANT" && /^draft/i.test(message.content) && (
                    <AiDraftToolbar content={message.content} />
                  )}
                  {message.role === "ASSISTANT" && message.confirmationPayload && (
                    <div className="pl-11">
                      <ActionConfirmationCard
                        payload={message.confirmationPayload}
                        pending={decideMutation.isPending}
                        lastOutcomeStatus={outcomeByToken[message.confirmationPayload.confirmationToken] ?? null}
                        onDecide={(confirmed) =>
                          decideMutation.mutate({ token: message.confirmationPayload!.confirmationToken, confirmed })
                        }
                      />
                    </div>
                  )}
                  {outcomes[message.id] && (
                    <div className="pl-11">
                      <ActionOutcomeNotice outcome={outcomes[message.id]!} />
                    </div>
                  )}
                </div>
              ))}
              {turnMutation.isPending && (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex items-center rounded-md border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <TypingIndicator className="text-gray-400 dark:text-gray-500" />
                  </div>
                </div>
              )}
              {decideMutation.isPending && (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                    <TypingIndicator className="text-gray-400 dark:text-gray-500" />
                    Submitting to HR Core and verifying...
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <form onSubmit={submit} className="mt-4 flex items-end gap-3">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about leave, OKRs, career growth, onboarding, policy, analytics, or phrase wording..."
          className="min-h-20 resize-none bg-white dark:bg-gray-900"
        />
        <Button type="submit" disabled={!canSend} className="h-10 shrink-0">
          <Send className="mr-2 h-4 w-4" />
          Send
        </Button>
      </form>
    </div>
  );
}
