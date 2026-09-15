import { ArrowRight, CheckCircle2, CircleDashed, ShieldAlert } from "lucide-react";
import type { RoutingTrace } from "@/lib/api/ai";

function statusIcon(status: string) {
  if (status === "SUCCESS") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  if (status === "PARTIAL" || status === "DEGRADED") return <CircleDashed className="h-3.5 w-3.5 text-amber-600" />;
  if (status === "ESCALATED" || status === "REFUSED" || status === "OUT_OF_SCOPE") {
    return <ShieldAlert className="h-3.5 w-3.5 text-blue-600" />;
  }
  return <CircleDashed className="h-3.5 w-3.5 text-gray-500" />;
}

export function RoutingTraceSummary({ routing }: { routing: RoutingTrace | null }) {
  if (!routing || routing.nodes.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      {routing.nodes.map((node, index) => (
        <div key={`${node.nodeType}-${node.agentType}-${index}`} className="flex items-center gap-2">
          {index > 0 && <ArrowRight className="h-3 w-3 text-gray-300" />}
          <span className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-800 dark:bg-gray-900">
            {statusIcon(node.status)}
            {node.agentType.replace(/_/g, " ")}
          </span>
        </div>
      ))}
    </div>
  );
}
