import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AiMessage } from "@/components/ai/ai-message";
import { AiConversationList } from "@/components/ai/ai-conversation-list";
import { AiDraftToolbar } from "@/components/ai/ai-draft-toolbar";
import { RoutingTraceSummary } from "@/components/ai/routing-trace-summary";
import {
  archiveConversation,
  deleteConversation,
  getConversation,
  listConversations,
  restoreConversation,
  saveResponseFeedback,
  sendConversationMessage,
  startConversation,
  type ConversationSummary,
  type AiMessageResponse,
  type ConversationTurnResponse,
  type RoutingTrace,
} from "@/lib/api/ai";
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

  const conversationsQuery = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: () => listConversations({ page: 1, pageSize: 20 }),
  });

  const turnMutation = useMutation({
    mutationFn: (message: string) =>
      conversationId
        ? sendConversationMessage(conversationId, { message })
        : startConversation({ message }),
    onSuccess: (turn: ConversationTurnResponse) => {
      setConversationId(turn.conversation.id);
      setMessages((current) => [...current, turn.userMessage, turn.assistantMessage]);
      setRouting(turn.routing);
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
    onError: (err: unknown) => {
      setError(getGatewayErrorMessage(err, "The AI assistant could not complete this request."));
    },
  });

  const loadConversationMutation = useMutation({
    mutationFn: getConversation,
    onSuccess: (detail) => {
      setConversationId(detail.conversation.id);
      setMessages(detail.messages);
      setRouting(null);
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
            <Button size="sm" variant="outline" className="h-8" onClick={() => { setConversationId(null); setMessages([]); setRouting(null); }}>
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
                    onRate={(ratedMessage, rating) => feedbackMutation.mutate({ messageId: ratedMessage.id, rating })}
                  />
                  {message.role === "ASSISTANT" && /^draft/i.test(message.content) && (
                    <AiDraftToolbar content={message.content} />
                  )}
                </div>
              ))}
              {turnMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Bot className="h-4 w-4 animate-pulse" />
                  Routing through supervisor...
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
