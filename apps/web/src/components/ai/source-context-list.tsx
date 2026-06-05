import { FileText } from "lucide-react";
import type { SourceContext } from "@/lib/api/ai";

export function SourceContextList({ sources }: { sources: SourceContext[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {sources.map((source, index) => (
        <span
          key={`${source.sourceType}-${source.referenceId ?? index}`}
          className="inline-flex max-w-full items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
        >
          <FileText className="h-3 w-3 shrink-0" />
          <span className="truncate">{source.title}</span>
        </span>
      ))}
    </div>
  );
}
