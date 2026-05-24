import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TopLevelObjectiveSummary } from '@/lib/api/hr-core';

interface AlignmentTreeNodeProps {
  node: TopLevelObjectiveSummary;
  onSelect?: (id: string) => void;
}

function AlignmentTreeNode({ node, onSelect }: AlignmentTreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const pct = Math.round(node.averageScore * 100);

  return (
    <div className="space-y-1">
      <div
        className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted cursor-pointer text-sm"
        onClick={() => onSelect?.(node.id)}
      >
        {node.childCount > 0 ? (
          <button
            className="text-muted-foreground"
            onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3" />
        )}
        <span className="flex-1 truncate">{node.title}</span>
        <Badge variant="outline" className="text-xs shrink-0">{pct}%</Badge>
        {node.childCount > 0 && (
          <span className="text-xs text-muted-foreground shrink-0">{node.childCount} children</span>
        )}
      </div>
    </div>
  );
}

interface AlignmentTreeProps {
  objectives: TopLevelObjectiveSummary[];
  onSelect?: (id: string) => void;
}

export function AlignmentTree({ objectives, onSelect }: AlignmentTreeProps) {
  if (!objectives.length) {
    return <p className="text-sm text-muted-foreground">No company-level objectives.</p>;
  }

  return (
    <div className="space-y-1">
      {objectives.map((obj) => (
        <AlignmentTreeNode key={obj.id} node={obj} onSelect={onSelect} />
      ))}
    </div>
  );
}
