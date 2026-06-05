import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AiConversationActions({
  archived,
  disabled,
  onArchive,
  onRestore,
  onDelete,
}: {
  archived: boolean;
  disabled?: boolean;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {archived ? (
        <Button size="sm" variant="ghost" className="h-7 px-2" disabled={disabled} onClick={onRestore} title="Restore conversation">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button size="sm" variant="ghost" className="h-7 px-2" disabled={disabled} onClick={onArchive} title="Archive conversation">
          <Archive className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600 hover:text-red-700" disabled={disabled} onClick={onDelete} title="Delete conversation">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
