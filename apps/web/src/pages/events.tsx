import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Plus,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createEvent,
  EVENT_REACTION_EMOJIS,
  extractApiError,
  listEvents,
  reactToEvent,
  type CreateEventDto,
  type EventAudience,
  type EventReactionEmoji,
  type SocialEventResponse,
  type SocialEventType,
} from "@/lib/api/social";
import { cn } from "@/lib/utils";

const EVENT_TYPES: SocialEventType[] = [
  "ALL_HANDS",
  "MEETING",
  "TRAINING",
  "SOCIAL",
  "ONBOARDING",
  "OFFSITE",
];

const EVENT_TYPE_LABELS: Record<SocialEventType, string> = {
  ALL_HANDS: "All hands",
  MEETING: "Meeting",
  TRAINING: "Training",
  SOCIAL: "Social",
  ONBOARDING: "Onboarding",
  OFFSITE: "Offsite",
};

const AUDIENCE_LABELS: Record<EventAudience, string> = {
  COMPANY: "Company",
  DEPARTMENT: "Department",
  TEAM: "Team",
  ROLE: "Role",
  INDIVIDUAL: "Individual",
};

interface EventFormState {
  title: string;
  description: string;
  eventType: SocialEventType;
  startAt: string;
  endAt: string;
  location: string;
  audience: EventAudience;
  capacity: string;
}

const EMPTY_EVENT_FORM: EventFormState = {
  title: "",
  description: "",
  eventType: "ALL_HANDS",
  startAt: "",
  endAt: "",
  location: "",
  audience: "COMPANY",
  capacity: "",
};

function fmtDate(iso: string): string {
  return format(new Date(iso), "dd MMM");
}

function fmtTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${format(start, "HH:mm")} - ${format(end, "HH:mm")}`;
}

function mapError(err: unknown): string {
  const code = extractApiError(err);
  if (code === "EventEndMustBeAfterStart") return "The event must end after it starts.";
  if (code === "UnknownOrganizer") return "Your employee profile could not be resolved.";
  return "The event could not be saved. Please try again.";
}

function organizerLabel(event: SocialEventResponse): string {
  if (!event.organizer) return event.organizerId;
  return `${event.organizer.firstName} ${event.organizer.lastName}`;
}

function buildCreateDto(form: EventFormState): CreateEventDto {
  const dto: CreateEventDto = {
    title: form.title.trim(),
    description: form.description.trim(),
    eventType: form.eventType,
    startAt: new Date(form.startAt).toISOString(),
    endAt: new Date(form.endAt).toISOString(),
    audience: form.audience,
  };
  if (form.location.trim()) dto.location = form.location.trim();
  if (form.capacity.trim()) dto.capacity = Number(form.capacity);
  return dto;
}

function ReactionRail({
  event,
  onReact,
  busy,
}: {
  event: SocialEventResponse;
  onReact: (emoji: EventReactionEmoji) => void;
  busy: boolean;
}) {
  const countByEmoji = new Map(event.reactionCounts.map((entry) => [entry.emoji, entry.count]));

  return (
    <div className="flex flex-wrap gap-1.5">
      {EVENT_REACTION_EMOJIS.map((emoji) => {
        const selected = event.myReaction === emoji;
        const count = countByEmoji.get(emoji) ?? 0;
        return (
          <button
            key={emoji}
            type="button"
            disabled={busy}
            onClick={() => onReact(emoji)}
            className={cn(
              "grid h-9 min-w-12 grid-cols-[1.25rem_auto] items-center gap-1 rounded-md border px-2 text-sm tabular-nums transition",
              selected
                ? "border-blue-500 bg-blue-50 text-blue-800 shadow-sm dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-200"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800",
            )}
            aria-pressed={selected}
            title={selected ? "Clear reaction" : "React"}
          >
            <span className="text-base leading-none">{emoji}</span>
            <span className="min-w-3 text-right text-xs font-semibold">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function EventsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const canPublish = !!user && (user.roles.includes("MANAGER") || user.roles.includes("HR_ADMIN"));
  const pageSize = 20;

  const [publishOpen, setPublishOpen] = useState(false);
  const [eventType, setEventType] = useState<SocialEventType | "ALL">("ALL");
  const [form, setForm] = useState<EventFormState>(EMPTY_EVENT_FORM);
  const [formError, setFormError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["social-events", { eventType, pageSize }],
    queryFn: () => listEvents({ page: 1, pageSize, eventType: eventType === "ALL" ? undefined : eventType }),
  });

  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["social-events"] });
      setPublishOpen(false);
      setForm(EMPTY_EVENT_FORM);
      setFormError("");
    },
    onError: (err: unknown) => setFormError(mapError(err)),
  });

  const reactMutation = useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: EventReactionEmoji | null }) => reactToEvent(id, emoji),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["social-events"] }),
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Company moments, team sessions, and the pulse around them.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as SocialEventType | "ALL")}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            aria-label="Filter event type"
          >
            <option value="ALL">All types</option>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {EVENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          {canPublish && (
            <Button onClick={() => setPublishOpen(true)}>
              <Plus className="h-4 w-4" />
              New event
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-36 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-900" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white text-muted-foreground dark:border-gray-800 dark:bg-gray-900">
          <Sparkles className="mb-3 h-10 w-10 opacity-40" />
          <p>No events yet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((event) => {
            const busy = reactMutation.isPending && reactMutation.variables?.id === event.id;
            return (
              <Card key={event.id} className="overflow-hidden border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <CardContent className="p-0">
                  <div className="grid gap-0 md:grid-cols-[9rem_1fr]">
                    <div className="flex flex-row items-center justify-between border-b border-gray-100 bg-gray-950 p-4 text-white md:flex-col md:items-start md:border-b-0 md:border-r dark:border-gray-800">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-blue-200">{fmtDate(event.startAt)}</p>
                        <p className="mt-1 text-lg font-semibold">{fmtTimeRange(event.startAt, event.endAt)}</p>
                      </div>
                      <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">
                        {EVENT_TYPE_LABELS[event.eventType]}
                      </Badge>
                    </div>
                    <div className="space-y-4 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-semibold leading-tight text-gray-950 dark:text-gray-50">
                              {event.title}
                            </h2>
                            <Badge variant="outline">{AUDIENCE_LABELS[event.audience]}</Badge>
                          </div>
                          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{event.description}</p>
                        </div>
                        <ReactionRail
                          event={event}
                          busy={busy}
                          onReact={(emoji) =>
                            reactMutation.mutate({
                              id: event.id,
                              emoji: event.myReaction === emoji ? null : emoji,
                            })
                          }
                        />
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          {organizerLabel(event)}
                        </span>
                        {event.location && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {event.location}
                          </span>
                        )}
                        {event.capacity !== null && (
                          <span className="inline-flex items-center gap-1.5">
                            <Ticket className="h-3.5 w-3.5" />
                            {event.capacity} seats
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" />
                          Published {format(new Date(event.createdAt), "dd MMM yyyy")}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="event-title">Title</Label>
              <Input
                id="event-title"
                value={form.title}
                onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="event-description">Description</Label>
              <Textarea
                id="event-description"
                rows={4}
                value={form.description}
                onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-type">Type</Label>
              <select
                id="event-type"
                value={form.eventType}
                onChange={(e) => setForm((current) => ({ ...current, eventType: e.target.value as SocialEventType }))}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              >
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {EVENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-audience">Audience</Label>
              <select
                id="event-audience"
                value={form.audience}
                onChange={(e) => setForm((current) => ({ ...current, audience: e.target.value as EventAudience }))}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              >
                <option value="COMPANY">Company</option>
                <option value="DEPARTMENT">Department</option>
                <option value="TEAM">Team</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-start">Start</Label>
              <Input
                id="event-start"
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm((current) => ({ ...current, startAt: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-end">End</Label>
              <Input
                id="event-end"
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm((current) => ({ ...current, endAt: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-location">Location</Label>
              <Input
                id="event-location"
                value={form.location}
                onChange={(e) => setForm((current) => ({ ...current, location: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-capacity">Capacity</Label>
              <Input
                id="event-capacity"
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm((current) => ({ ...current, capacity: e.target.value }))}
              />
            </div>
            {formError && <p className="text-sm text-destructive md:col-span-2">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                createMutation.isPending ||
                !form.title.trim() ||
                !form.description.trim() ||
                !form.startAt ||
                !form.endAt
              }
              onClick={() => createMutation.mutate(buildCreateDto(form))}
            >
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
