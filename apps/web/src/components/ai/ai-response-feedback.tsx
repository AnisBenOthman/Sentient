import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AiResponseFeedback({
  disabled,
  onRate,
}: {
  disabled?: boolean;
  onRate: (rating: "POSITIVE" | "NEGATIVE") => void;
}) {
  return (
    <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
      <span>Rate</span>
      <Button size="sm" variant="ghost" className="h-7 px-2" disabled={disabled} onClick={() => onRate("POSITIVE")} title="Helpful">
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2" disabled={disabled} onClick={() => onRate("NEGATIVE")} title="Not helpful">
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
