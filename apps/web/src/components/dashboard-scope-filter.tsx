import { Building2, Globe, Layers, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { BusinessUnit, Department, Team } from "@/lib/api/hr-core";

export type DashboardScopeSelection = {
  businessUnitId: string | null;
  departmentId: string | null;
  teamId: string | null;
};

type Props = {
  businessUnits: BusinessUnit[];
  departments: Department[];
  teams: Team[];
  value: DashboardScopeSelection;
  canUseGlobal: boolean;
  disabled?: boolean;
  onChange: (value: DashboardScopeSelection) => void;
};

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return items.slice().sort((a, b) => a.name.localeCompare(b.name));
}

export function DashboardScopeFilter({
  businessUnits,
  departments,
  teams,
  value,
  canUseGlobal,
  disabled = false,
  onChange,
}: Props) {
  const selectedBusinessUnit = businessUnits.find((businessUnit) => businessUnit.id === value.businessUnitId);
  const selectedDepartment = departments.find((department) => department.id === value.departmentId);
  const selectedTeam = teams.find((team) => team.id === value.teamId);

  const departmentOptions = value.businessUnitId
    ? departments.filter((department) => department.businessUnitId === value.businessUnitId)
    : [];
  const teamOptions = value.departmentId
    ? teams.filter((team) => team.departmentId === value.departmentId)
    : [];

  const scopeTrail = [
    selectedBusinessUnit?.name,
    selectedDepartment?.name,
    selectedTeam?.name,
  ].filter(Boolean);
  const scopeLabel = scopeTrail.length > 0 ? scopeTrail.join(" / ") : "Global";

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
      data-testid="dashboard-scope-filter"
    >
      <div className="flex flex-wrap items-center gap-2">
        {canUseGlobal && (
          <Button
            type="button"
            variant={scopeTrail.length === 0 ? "default" : "outline"}
            size="sm"
            onClick={() => onChange({ businessUnitId: null, departmentId: null, teamId: null })}
            disabled={disabled}
            data-testid="scope-global"
          >
            <Globe className="mr-1.5 h-3.5 w-3.5" />
            Global
          </Button>
        )}

        <Select
          value={value.businessUnitId ?? undefined}
          onValueChange={(businessUnitId) => onChange({ businessUnitId, departmentId: null, teamId: null })}
          disabled={disabled || businessUnits.length === 0}
        >
          <SelectTrigger className="h-9 w-full min-w-[190px] sm:w-[220px]" data-testid="scope-business-unit-trigger">
            <Building2 className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Select business unit" />
          </SelectTrigger>
          <SelectContent>
            {sortByName(businessUnits).map((businessUnit) => (
              <SelectItem
                key={businessUnit.id}
                value={businessUnit.id}
                data-testid={`scope-business-unit-option-${businessUnit.id}`}
              >
                {businessUnit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={value.departmentId ?? undefined}
          onValueChange={(departmentId) => onChange({ businessUnitId: value.businessUnitId, departmentId, teamId: null })}
          disabled={disabled || !value.businessUnitId || departmentOptions.length === 0}
        >
          <SelectTrigger className="h-9 w-full min-w-[190px] sm:w-[220px]" data-testid="scope-department-trigger">
            <Layers className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder={value.businessUnitId ? "Select department" : "Select business unit first"} />
          </SelectTrigger>
          <SelectContent>
            {sortByName(departmentOptions).map((department) => (
              <SelectItem
                key={department.id}
                value={department.id}
                data-testid={`scope-department-option-${department.id}`}
              >
                {department.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={value.teamId ?? undefined}
          onValueChange={(teamId) => onChange({ ...value, teamId })}
          disabled={disabled || !value.departmentId || teamOptions.length === 0}
        >
          <SelectTrigger className="h-9 w-full min-w-[190px] sm:w-[220px]" data-testid="scope-team-trigger">
            <Users className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder={value.departmentId ? "Select team" : "Select department first"} />
          </SelectTrigger>
          <SelectContent>
            {sortByName(teamOptions).map((team) => (
              <SelectItem
                key={team.id}
                value={team.id}
                data-testid={`scope-team-option-${team.id}`}
              >
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground" data-testid="scope-summary">
        Viewing: <span className="font-medium text-gray-700 dark:text-gray-200">{scopeLabel}</span>
      </p>
    </div>
  );
}
