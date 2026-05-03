import { useState } from "react";
import { Check, ChevronsUpDown, Globe, Building2, Layers, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { ScopeLevel } from "@/lib/use-dashboard-scope";

const LEVELS: {
  value: ScopeLevel;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: "global", label: "Global", icon: Globe },
  { value: "bu", label: "Business Unit", icon: Building2 },
  { value: "dept", label: "Department", icon: Layers },
  { value: "team", label: "Team", icon: Users },
];

type Props = {
  level: ScopeLevel;
  unitId: string | null;
  unitOptions: { value: string; label: string }[];
  onChange: (level: ScopeLevel, unitId?: string | null) => void;
};

export function DashboardScopeFilter({
  level,
  unitId,
  unitOptions,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = unitOptions.find((o) => o.value === unitId);

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-2"
      data-testid="dashboard-scope-filter"
    >
      {/* Granularity pill bar */}
      <div className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {LEVELS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
              level === value
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            )}
            data-testid={`scope-level-${value}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Searchable unit dropdown — only when a non-global level is active */}
      {level !== "global" && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              role="combobox"
              aria-expanded={open}
              className="inline-flex items-center justify-between gap-2 min-w-[180px] max-w-[260px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover-elevate active-elevate-2"
              data-testid="scope-unit-trigger"
            >
              <span className="truncate">
                {selected?.label ?? "Select…"}
              </span>
              <ChevronsUpDown className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px] p-0" align="start">
            <Command>
              <CommandInput
                placeholder={
                  level === "bu"
                    ? "Search business units…"
                    : level === "dept"
                      ? "Search departments…"
                      : "Search teams…"
                }
                className="h-9"
              />
              <CommandList>
                <CommandEmpty>No matches found.</CommandEmpty>
                <CommandGroup>
                  {unitOptions.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      onSelect={() => {
                        onChange(level, opt.value);
                        setOpen(false);
                      }}
                      data-testid={`scope-unit-option-${opt.value}`}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          unitId === opt.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{opt.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
