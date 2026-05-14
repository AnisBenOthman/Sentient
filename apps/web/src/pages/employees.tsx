import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, UserPlus, ChevronDown, ChevronRight, X } from "lucide-react";
import { AddEmployeeWizard } from "@/components/add-employee-wizard";
import { useAuth } from "@/components/providers/auth-provider";
import { getEmployees, getBusinessUnits, getDepartments, getTeams } from "@/lib/api/hr-core";
import { canViewEmployeeDetails, getRoleTier } from "@/lib/auth";

const ALL_VALUE = "all";

const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_LEAVE", label: "On Leave" },
  { value: "PROBATION", label: "Probation" },
  { value: "TERMINATED", label: "Terminated" },
  { value: "RESIGNED", label: "Resigned" },
] as const;

function getStatusBadge(status: string) {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return (
        <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-200">
          Active
        </Badge>
      );
    case "ON_LEAVE":
      return (
        <Badge className="bg-orange-500/10 text-orange-700 hover:bg-orange-500/20 border-orange-200">
          On Leave
        </Badge>
      );
    case "PROBATION":
      return (
        <Badge className="bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20 border-yellow-200">
          Probation
        </Badge>
      );
    case "TERMINATED":
      return (
        <Badge className="bg-red-500/10 text-red-700 hover:bg-red-500/20 border-red-200">
          Terminated
        </Badge>
      );
    case "RESIGNED":
      return (
        <Badge className="bg-gray-500/10 text-gray-600 hover:bg-gray-500/20 border-gray-200">
          Resigned
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export default function Employees() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [businessUnitFilter, setBusinessUnitFilter] = useState(ALL_VALUE);
  const [deptFilter, setDeptFilter] = useState(ALL_VALUE);
  const [teamFilter, setTeamFilter] = useState(ALL_VALUE);
  const [statusFilter, setStatusFilter] = useState(ALL_VALUE);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);

  const employeeQueryParams = useMemo(() => {
    const scopeParams = teamFilter !== ALL_VALUE
      ? { teamId: teamFilter }
      : deptFilter !== ALL_VALUE
        ? { departmentId: deptFilter }
        : businessUnitFilter !== ALL_VALUE
          ? { businessUnitId: businessUnitFilter }
          : {};

    return {
      search: searchTerm || undefined,
      employmentStatus: statusFilter !== ALL_VALUE ? statusFilter : undefined,
      limit: 200,
      ...scopeParams,
    };
  }, [businessUnitFilter, deptFilter, searchTerm, statusFilter, teamFilter]);

  const { data: result, isLoading } = useQuery({
    queryKey: ["employees", employeeQueryParams],
    queryFn: () => getEmployees(employeeQueryParams),
    placeholderData: (prev) => prev,
  });

  const { data: businessUnits = [] } = useQuery({
    queryKey: ["business-units"],
    queryFn: getBusinessUnits,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: getDepartments,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: getTeams,
  });

  const employees = result?.data ?? [];
  const canManageEmployees = user ? getRoleTier(user) === "hr_admin" : false;
  const showDetailsColumn = user ? getRoleTier(user) !== "employee" : false;

  const departmentById = useMemo(
    () => new Map(departments.map((department) => [department.id, department])),
    [departments],
  );

  const businessUnitById = useMemo(
    () => new Map(businessUnits.map((businessUnit) => [businessUnit.id, businessUnit])),
    [businessUnits],
  );

  const filteredDepartments = useMemo(
    () =>
      businessUnitFilter === ALL_VALUE
        ? []
        : departments
            .filter((department) => department.businessUnitId === businessUnitFilter)
            .sort((a, b) => a.name.localeCompare(b.name)),
    [businessUnitFilter, departments],
  );

  const filteredTeams = useMemo(
    () =>
      deptFilter === ALL_VALUE
        ? []
        : teams
            .filter((team) => team.departmentId === deptFilter)
            .sort((a, b) => a.name.localeCompare(b.name)),
    [deptFilter, teams],
  );

  const activeBusinessUnit = businessUnits.find((businessUnit) => businessUnit.id === businessUnitFilter);
  const activeDepartment = departments.find((department) => department.id === deptFilter);
  const activeTeam = teams.find((team) => team.id === teamFilter);
  const activeStatusLabel = EMPLOYMENT_STATUS_OPTIONS.find((status) => status.value === statusFilter)?.label;
  const hasActiveFilters =
    businessUnitFilter !== ALL_VALUE ||
    deptFilter !== ALL_VALUE ||
    teamFilter !== ALL_VALUE ||
    statusFilter !== ALL_VALUE ||
    searchTerm.length > 0;
  const viewingSummary = [
    activeBusinessUnit?.name,
    activeDepartment?.name,
    activeTeam?.name,
    activeStatusLabel,
  ].filter(Boolean).join(" / ");

  function getBusinessUnitNameForDepartment(departmentId: string | undefined): string | null {
    if (!departmentId) return null;
    const department = departmentById.get(departmentId);
    return (
      department?.businessUnit?.name ??
      (department?.businessUnitId ? businessUnitById.get(department.businessUnitId)?.name : undefined) ??
      activeBusinessUnit?.name ??
      null
    );
  }

  const groupedEmployees = useMemo(() => {
    const groups = new Map<string, { label: string; businessUnitName: string | null; employees: typeof employees }>();
    for (const emp of employees) {
      const key = emp.department?.id ?? "";
      const label = emp.department?.name ?? "Unassigned department";
      const businessUnitName = getBusinessUnitNameForDepartment(emp.department?.id);
      if (!groups.has(key)) groups.set(key, { label, businessUnitName, employees: [] });
      groups.get(key)!.employees.push(emp);
    }
    return Array.from(groups.entries()).sort(([, a], [, b]) =>
      `${a.businessUnitName ?? ""} ${a.label}`.localeCompare(`${b.businessUnitName ?? ""} ${b.label}`),
    );
  }, [activeBusinessUnit?.name, businessUnitById, departmentById, employees]);

  const totalShown = employees.length;

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clearFilters() {
    setSearchTerm("");
    setBusinessUnitFilter(ALL_VALUE);
    setDeptFilter(ALL_VALUE);
    setTeamFilter(ALL_VALUE);
    setStatusFilter(ALL_VALUE);
  }

  function handleBusinessUnitChange(businessUnitId: string) {
    setBusinessUnitFilter(businessUnitId);
    setDeptFilter(ALL_VALUE);
    setTeamFilter(ALL_VALUE);
  }

  function handleDepartmentChange(departmentId: string) {
    setDeptFilter(departmentId);
    setTeamFilter(ALL_VALUE);
  }

  function canOpenEmployeeDetails(emp: (typeof employees)[number]): boolean {
    return user ? canViewEmployeeDetails(user, emp, { departments, teams }) : false;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100"
            data-testid="heading-directory"
          >
            Employees
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage and view all team members
          </p>
        </div>
        {canManageEmployees && (
          <Button
            onClick={() => setWizardOpen(true)}
            className="gap-2"
            data-testid="button-add-employee"
          >
            <UserPlus className="w-4 h-4" />
            Add Employee
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-employees"
          />
        </div>

          <div className="grid gap-1.5" data-testid="bu-filter-container">
            <Label className="text-xs text-muted-foreground">Business Unit</Label>
            <Select value={businessUnitFilter} onValueChange={handleBusinessUnitChange}>
              <SelectTrigger className="w-[190px]" data-testid="select-bu-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All business units</SelectItem>
                {businessUnits
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((businessUnit) => (
                    <SelectItem key={businessUnit.id} value={businessUnit.id}>
                      {businessUnit.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

        <div className="grid gap-1.5" data-testid="dept-filter-container">
          <Label className="text-xs text-muted-foreground">
            Department
          </Label>
          <Select
            value={businessUnitFilter === ALL_VALUE ? undefined : deptFilter}
            onValueChange={handleDepartmentChange}
            disabled={businessUnitFilter === ALL_VALUE || filteredDepartments.length === 0}
          >
            <SelectTrigger className="w-[190px]" data-testid="select-dept-filter">
              <SelectValue placeholder={businessUnitFilter === ALL_VALUE ? "Select BU first" : "All departments"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All departments</SelectItem>
              {filteredDepartments
                .map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

          <div className="grid gap-1.5" data-testid="team-filter-container">
            <Label className="text-xs text-muted-foreground">Team</Label>
            <Select
              value={deptFilter === ALL_VALUE ? undefined : teamFilter}
              onValueChange={setTeamFilter}
              disabled={deptFilter === ALL_VALUE || filteredTeams.length === 0}
            >
              <SelectTrigger className="w-[190px]" data-testid="select-team-filter">
                <SelectValue placeholder={deptFilter === ALL_VALUE ? "Select department first" : "All teams"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All teams</SelectItem>
                {filteredTeams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5" data-testid="status-filter-container">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[170px]" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                {EMPLOYMENT_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={clearFilters}
              data-testid="button-clear-employee-filters"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        <p className="mt-2 text-xs text-muted-foreground" data-testid="employee-filter-summary">
          Viewing: <span className="font-medium text-foreground">{viewingSummary || "All employees"}</span>
        </p>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Business Unit</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              {showDetailsColumn && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={showDetailsColumn ? 6 : 5} className="text-center py-8 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : groupedEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showDetailsColumn ? 6 : 5} className="text-center py-8 text-muted-foreground">
                  No employees found matching your search.
                </TableCell>
              </TableRow>
            ) : (
              groupedEmployees.flatMap(([key, group]) => {
                const isCollapsed = collapsedGroups.has(key);
                return [
                  <TableRow
                    key={`group-${key}`}
                    className="bg-muted/40 hover:bg-muted/60 cursor-pointer select-none"
                    onClick={() => toggleGroup(key)}
                    data-testid={`group-header-${key || "unassigned"}`}
                  >
                    <TableCell colSpan={showDetailsColumn ? 6 : 5} className="py-2 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                          {group.label}
                        </span>
                        {group.businessUnitName && (
                          <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {group.businessUnitName}
                          </span>
                        )}
                        <Badge variant="secondary" className="ml-1 text-xs">
                          {group.employees.length}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>,
                  ...(!isCollapsed
                    ? group.employees.map((emp) => {
                        const businessUnitName = getBusinessUnitNameForDepartment(emp.department?.id) ?? "Unassigned";
                        const canOpenDetails = canOpenEmployeeDetails(emp);
                        return (
                        <TableRow key={emp.id} data-testid={`row-employee-${emp.id}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {getInitials(emp.firstName, emp.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">
                                  {emp.firstName} {emp.lastName}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {emp.email}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{emp.position?.title ?? "—"}</TableCell>
                          <TableCell>
                            <span className="text-sm font-medium">{businessUnitName}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{emp.department?.name ?? "—"}</span>
                              {businessUnitName !== "Unassigned" && (
                                <span className="text-xs text-muted-foreground">
                                  {businessUnitName}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(emp.employmentStatus)}</TableCell>
                          {showDetailsColumn && (
                            <TableCell className="text-right">
                              {canOpenDetails && (
                                <Link href={`/employees/${emp.id}`}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    data-testid={`button-view-employee-${emp.id}`}
                                  >
                                    View
                                  </Button>
                                </Link>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                        );
                      })
                    : []),
                ];
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalShown > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {totalShown} employee{totalShown !== 1 ? "s" : ""} across{" "}
          {groupedEmployees.length} department{groupedEmployees.length !== 1 ? "s" : ""}
        </p>
      )}

      {canManageEmployees && (
        <AddEmployeeWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          allEmployees={employees.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))}
          onEmployeeAdded={() => {
            queryClient.invalidateQueries({ queryKey: ["employees"] });
          }}
        />
      )}
    </div>
  );
}
