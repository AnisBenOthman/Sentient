import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AiDraftToolbar({ content }: { content: string }) {
  const { t } = useTranslation("ai");
  const [copied, setCopied] = useState(false);

  async function copyDraft(): Promise<void> {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mt-2 flex justify-end">
      <Button size="sm" variant="outline" className="h-8" onClick={() => void copyDraft()}>
        {copied ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
        {copied ? t("draft.copied") : t("draft.copy")}
      </Button>
    </div>
  );
}
