import { useState, type ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Send, Slack, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  generateChannelLinkCode,
  getLinkedChannels,
  unlinkChannel,
  type LinkableChannel,
  type LinkCodeResponse,
} from "@/lib/api/hr-core";
import { useToast } from "@/hooks/use-toast";
import {
  SLACK_APP_NAME,
  TELEGRAM_BOT_HANDLE,
  slackLinkCommand,
  telegramLinkCommand,
} from "@/lib/channels/link-channel-copy";

interface ChannelDefinition {
  id: LinkableChannel;
  /** Lower-cased id: the `employees:channels.*` key and the data-tour suffix. */
  slug: "telegram" | "slack";
  /** Product name — a proper noun, so never translated. */
  name: string;
  icon: LucideIcon;
  iconClassName: string;
  iconBgClassName: string;
  /** Exact text the user sends the bot — also what the copy button copies. */
  command: (code: string) => string;
  /**
   * Step shown above the command box; the command itself is rendered separately.
   *
   * WHY <Trans> rather than a plain t(): the sentence emphasises the bot handle
   * mid-phrase, and splitting it into prefix/suffix keys would hard-code English
   * word order into the locale files. The handle stays a value so it keeps
   * coming from link-channel-copy rather than being retyped per locale.
   */
  instructions: ReactNode;
}

// The two command shapes live in lib/channels/link-channel-copy — the guided
// tour quotes them too, and they must not drift apart.
const CHANNELS: ChannelDefinition[] = [
  {
    id: "TELEGRAM",
    slug: "telegram",
    name: "Telegram",
    icon: Send,
    iconClassName: "text-sky-600 dark:text-sky-400",
    iconBgClassName: "bg-sky-100 dark:bg-sky-900/30",
    command: telegramLinkCommand,
    instructions: (
      <Trans
        ns="employees"
        i18nKey="channels.telegram.instructions"
        values={{ handle: TELEGRAM_BOT_HANDLE }}
        components={{ em: <span className="font-medium text-gray-900 dark:text-gray-100" /> }}
      />
    ),
  },
  {
    id: "SLACK",
    slug: "slack",
    name: "Slack",
    icon: Slack,
    iconClassName: "text-purple-600 dark:text-purple-400",
    iconBgClassName: "bg-purple-100 dark:bg-purple-900/30",
    command: slackLinkCommand,
    instructions: (
      <Trans
        ns="employees"
        i18nKey="channels.slack.instructions"
        values={{ appName: SLACK_APP_NAME }}
        components={{ em: <span className="font-medium text-gray-900 dark:text-gray-100" /> }}
      />
    ),
  },
];

export function LinkedChannelsCard() {
  const { t, i18n } = useTranslation(["employees", "common"]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [linkCode, setLinkCode] = useState<{ channel: ChannelDefinition; code: LinkCodeResponse } | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState<ChannelDefinition | null>(null);

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["channel-identities"],
    queryFn: getLinkedChannels,
    staleTime: 30_000,
  });

  const generateMutation = useMutation({
    mutationFn: async (channel: ChannelDefinition) => ({
      channel,
      code: await generateChannelLinkCode(channel.id),
    }),
    onSuccess: (data) => setLinkCode(data),
    onError: () => toast({ title: t("channels.codeFailed"), variant: "destructive" }),
  });

  const unlinkMutation = useMutation({
    mutationFn: (channel: ChannelDefinition) => unlinkChannel(channel.id),
    onSuccess: (_data, channel) => {
      queryClient.invalidateQueries({ queryKey: ["channel-identities"] });
      toast({ title: t("channels.disconnected", { channel: channel.name }) });
      setConfirmUnlink(null);
    },
    onError: (_error, channel) =>
      toast({ title: t("channels.disconnectFailed", { channel: channel.name }), variant: "destructive" }),
  });

  async function copyLinkCommand(command: string) {
    try {
      await navigator.clipboard.writeText(command);
      toast({ title: t("channels.copied") });
    } catch {
      toast({ title: t("channels.copyFailed"), variant: "destructive" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("channels.title")}</CardTitle>
        <CardDescription>{t("channels.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {CHANNELS.map((definition) => {
          const linked = channels.find((c) => c.channel === definition.id);
          const Icon = definition.icon;
          const isGenerating = generateMutation.isPending && generateMutation.variables?.id === definition.id;
          const isUnlinking = unlinkMutation.isPending && unlinkMutation.variables?.id === definition.id;

          return (
            <div
              key={definition.id}
              data-tour={`linked-channel-${definition.slug}`}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${definition.iconBgClassName}`}
                >
                  <Icon className={`w-4 h-4 ${definition.iconClassName}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{definition.name}</p>
                  {isLoading ? (
                    <div className="h-3.5 w-28 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mt-1" />
                  ) : linked ? (
                    <p className="text-xs text-muted-foreground">
                      {t("channels.connected", {
                        date: new Date(linked.linkedAt).toLocaleDateString(i18n.language),
                      })}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("channels.notConnected")}</p>
                  )}
                </div>
              </div>

              {!isLoading &&
                (linked ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => setConfirmUnlink(definition)}
                    disabled={isUnlinking}
                  >
                    {t("channels.disconnect")}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => generateMutation.mutate(definition)} disabled={isGenerating}>
                    {isGenerating ? t("channels.generating") : t("channels.connect")}
                  </Button>
                ))}
            </div>
          );
        })}
      </CardContent>

      <Dialog open={!!linkCode} onOpenChange={(open) => !open && setLinkCode(null)}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{t("channels.dialogTitle", { channel: linkCode?.channel.name ?? "" })}</DialogTitle>
          </DialogHeader>
          {linkCode && (
            <div className="space-y-4 py-2">
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>{linkCode.channel.instructions}</li>
                <li>{t("channels.sendCommand")}</li>
              </ol>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
                <code className="flex-1 text-sm font-mono font-semibold tracking-wide text-gray-900 dark:text-gray-100">
                  {linkCode.channel.command(linkCode.code.code)}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={() => copyLinkCommand(linkCode.channel.command(linkCode.code.code))}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("channels.expiresAt", {
                  time: new Date(linkCode.code.expiresAt).toLocaleTimeString(i18n.language),
                })}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkCode(null)}>
              {t("channels.done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmUnlink} onOpenChange={(open) => !open && setConfirmUnlink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("channels.confirmDisconnect", { channel: confirmUnlink?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmUnlink ? t(`channels.${confirmUnlink.slug}.disconnectDescription`) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => confirmUnlink && unlinkMutation.mutate(confirmUnlink)}
              disabled={unlinkMutation.isPending}
            >
              {t("channels.disconnect")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
