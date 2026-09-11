import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Send } from "lucide-react";
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
  type LinkCodeResponse,
} from "@/lib/api/hr-core";
import { useToast } from "@/hooks/use-toast";

export function LinkedChannelsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [linkCode, setLinkCode] = useState<LinkCodeResponse | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["channel-identities"],
    queryFn: getLinkedChannels,
    staleTime: 30_000,
  });

  const telegram = channels.find((c) => c.channel === "TELEGRAM");

  const generateMutation = useMutation({
    mutationFn: () => generateChannelLinkCode("TELEGRAM"),
    onSuccess: (data) => setLinkCode(data),
    onError: () => toast({ title: "Couldn't generate a link code", variant: "destructive" }),
  });

  const unlinkMutation = useMutation({
    mutationFn: () => unlinkChannel("TELEGRAM"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channel-identities"] });
      toast({ title: "Telegram disconnected" });
      setConfirmUnlink(false);
    },
    onError: () => toast({ title: "Couldn't disconnect Telegram", variant: "destructive" }),
  });

  async function copyLinkCommand(code: string) {
    try {
      await navigator.clipboard.writeText(`/link ${code}`);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Couldn't copy — select and copy it manually", variant: "destructive" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Linked Channels</CardTitle>
        <CardDescription>Connect chat apps so you can message Sentient from where you already talk.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
              <Send className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Telegram</p>
              {isLoading ? (
                <div className="h-3.5 w-28 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mt-1" />
              ) : telegram ? (
                <p className="text-xs text-muted-foreground">
                  Connected {new Date(telegram.linkedAt).toLocaleDateString()}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Not connected</p>
              )}
            </div>
          </div>

          {!isLoading &&
            (telegram ? (
              <Button
                variant="outline"
                size="sm"
                className="text-red-500 hover:text-red-700"
                onClick={() => setConfirmUnlink(true)}
                disabled={unlinkMutation.isPending}
              >
                Disconnect
              </Button>
            ) : (
              <Button size="sm" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                {generateMutation.isPending ? "Generating…" : "Connect"}
              </Button>
            ))}
        </div>
      </CardContent>

      <Dialog open={!!linkCode} onOpenChange={(open) => !open && setLinkCode(null)}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Connect Telegram</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>
                Open Telegram and message{" "}
                <span className="font-medium text-gray-900 dark:text-gray-100">@Sentient2bot</span>
              </li>
              <li>Send it this command:</li>
            </ol>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
              <code className="flex-1 text-sm font-mono font-semibold tracking-wide text-gray-900 dark:text-gray-100">
                /link {linkCode?.code}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 shrink-0"
                onClick={() => linkCode && copyLinkCommand(linkCode.code)}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
            {linkCode && (
              <p className="text-xs text-muted-foreground">
                Expires at {new Date(linkCode.expiresAt).toLocaleTimeString()} — come back here for a new code if it does.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkCode(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmUnlink} onOpenChange={setConfirmUnlink}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Telegram?</AlertDialogTitle>
            <AlertDialogDescription>
              Sentient will stop recognizing messages from this Telegram chat. You can reconnect anytime with a new code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => unlinkMutation.mutate()}
              disabled={unlinkMutation.isPending}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
