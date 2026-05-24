export const EVENT_REACTION_EMOJIS = ['👍', '🎉', '💡', '👏', '❤️'] as const;

export type EventReactionEmoji = (typeof EVENT_REACTION_EMOJIS)[number];

export interface EventReactionSummary {
  emoji: EventReactionEmoji;
  count: number;
}

export function isEventReactionEmoji(value: string): value is EventReactionEmoji {
  return (EVENT_REACTION_EMOJIS as readonly string[]).includes(value);
}
