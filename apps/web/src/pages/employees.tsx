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
import { Search, UserPlus, ChevronDown, ChevronRight } from "lucide-react";
import { AddEmployeeWizard } from "@/components/add-employee-wizard";
import { getEmployees, getDepartments } from "@/lib/api/hr-core";

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
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: result, isLoading } = useQuery({
    queryKey: ["employees", { search: searchTerm, departmentId: deptFilter === "all" ? undefined : deptFilter }],
    queryFn: () =>
      getEmployees({
        search: searchTerm || undefined,
        departmentId: deptFilter !== "all" ? deptFilter : undefined,
        limit: 200,
      }),
    placeholderData: (prev) => prev,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: getDepartments,
  });

  const employees = result?.data ?? [];

  const groupedEmployees = useMemo(() => {
    const groups = new Map<string, { label: string; employees: typeof employees }>();
    for (const emp of employees) {
      const key = emp.department?.id ?? "";
      const label = emp.department?.name ?? "Unassigned";
      if (!groups.has(key)) groups.set(key, { label, employees: [] });
      groups.get(key)!.employees.push(emp);
    }
    return Array.from(groups.entries()).sort(([, a], [, b]) =>
      a.label.localeCompare(b.label),
    );
  }, [employees]);

  const totalShown = employees.length;

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
        <Button
          onClick={() => setWizardOpen(true)}
          className="gap-2"
          data-testid="button-add-employee"
        >
          <UserPlus className="w-4 h-4" />
          Add Employee
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
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

        <div className="flex items-center gap-2" data-testid="dept-filter-container">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">
            Department
          </Label>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-[200px]" data-testid="select-dept-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {departments
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : groupedEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
                    <TableCell colSpan={5} className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                          {group.label}
                        </span>
                        <Badge variant="secondary" className="ml-1 text-xs">
                          {group.employees.length}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>,
                  ...(!isCollapsed
                    ? group.employees.map((emp) => (
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
                          <TableCell>{emp.department?.name ?? "—"}</TableCell>
                          <TableCell>{getStatusBadge(emp.employmentStatus)}</TableCell>
                          <TableCell className="text-right">
                            <Link href={`/employees/${emp.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                data-testid={`button-view-employee-${emp.id}`}
                              >
                                View
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
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

      <AddEmployeeWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        allEmployees={employees.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))}
        onEmployeeAdded={() => {
          queryClient.invalidateQueries({ queryKey: ["employees"] });
        }}
      />
    </div>
  );
}
