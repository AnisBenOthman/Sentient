/**
 * WHY one module: the Linked Channels card and the guided tour both tell the
 * user which bot to message and exactly what to send it. Holding the handles
 * and the two command shapes in one place stops the tour copy from drifting
 * away from the dialog the user actually follows.
 */

export const TELEGRAM_BOT_HANDLE = '@Sentient2bot';
export const SLACK_APP_NAME = 'Sentient';

// WHY the slash differs: Telegram routes "/link" to the bot as a command;
// Slack intercepts any leading slash as a slash command and, since none is
// registered, shows an error and never delivers it. See SlackService.
export function telegramLinkCommand(code: string): string {
  return `/link ${code}`;
}

export function slackLinkCommand(code: string): string {
  return `link ${code}`;
}
