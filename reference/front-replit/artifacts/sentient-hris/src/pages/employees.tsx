import { useState, useMemo } from "react";
import { Link } from "wouter";
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
import {
  employees as initialEmployees,
  employeeExtras,
  type Employee,
} from "@/lib/mock-data";
import { applyOverrides } from "@/lib/employee-store";
import { useDepartmentNames, useOrgStructure } from "@/lib/org-structure-store";
import { Search, UserPlus, ChevronDown, ChevronRight } from "lucide-react";
import { AddEmployeeWizard } from "@/components/add-employee-wizard";

export default function Employees() {
  const [allEmployees, setAllEmployees] = useState<Employee[]>(() => {
    // Seed employees get their schema-aligned extras merged from employeeExtras
    // so contractType, phone, etc. are present on the object from the start.
    const withExtras = (initialEmployees as Employee[]).map((emp) => {
      const extra = employeeExtras[emp.id];
      if (!extra) return emp;
      return {
        ...emp,
        contractType: extra.contractType,
        phone: extra.phone,
        dateOfBirth: extra.dateOfBirth,
        netSalary: extra.netSalary,
        maritalStatus: extra.maritalStatus,
        educationLevel: extra.educationLevel,
        educationField: extra.educationField,
        positionLevel: extra.positionLevel,
        employeeCode: extra.employeeCode,
        team: extra.team,
      };
    });
    return applyOverrides(withExtras);
  });
  const DEPT_OPTIONS = useDepartmentNames();
  const { businessUnits } = useOrgStructure();
  const [searchTerm, setSearchTerm] = useState("");
  const [buFilter, setBuFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );
  const [wizardOpen, setWizardOpen] = useState(false);

  const buNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const bu of businessUnits) {
      m[bu.id] = bu.name;
    }
    return m;
  }, [businessUnits]);

  const searchFiltered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    if (!q) return allEmployees;
    return allEmployees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(q) ||
        emp.role.toLowerCase().includes(q) ||
        emp.department.toLowerCase().includes(q)
    );
  }, [searchTerm, allEmployees]);

  const groupedEmployees = useMemo(() => {
    const afterBu =
      buFilter === "all"
        ? searchFiltered
        : searchFiltered.filter((e) => (e.buId ?? "") === buFilter);

    const base =
      deptFilter === "all"
        ? afterBu
        : afterBu.filter((e) => e.department === deptFilter);

    const groups = new Map<string, { label: string; employees: Employee[] }>();

    for (const emp of base) {
      const key = emp.buId ?? "";
      const label = key ? (buNameMap[key] ?? key) : "Unassigned";
      if (!groups.has(key)) {
        groups.set(key, { label, employees: [] });
      }
      groups.get(key)!.employees.push(emp);
    }

    const sorted = Array.from(groups.entries()).sort(([keyA, a], [keyB, b]) => {
      if (!keyA) return 1;
      if (!keyB) return -1;
      return a.label.localeCompare(b.label);
    });

    return sorted;
  }, [searchFiltered, buFilter, deptFilter, buNameMap]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-200">
            Active
          </Badge>
        );
      case "on-leave":
        return (
          <Badge className="bg-orange-500/10 text-orange-700 hover:bg-orange-500/20 border-orange-200">
            On Leave
          </Badge>
        );
      case "remote":
        return (
          <Badge className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 border-blue-200">
            Remote
          </Badge>
        );
      case "probation":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20 border-yellow-200">
            Probation
          </Badge>
        );
      case "terminated":
        return (
          <Badge className="bg-red-500/10 text-red-700 hover:bg-red-500/20 border-red-200">
            Terminated
          </Badge>
        );
      case "resigned":
        return (
          <Badge className="bg-gray-500/10 text-gray-600 hover:bg-gray-500/20 border-gray-200">
            Resigned
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleEmployeeAdded = (emp: Employee) => {
    setAllEmployees((prev) => [...prev, emp]);
  };

  const totalShown = groupedEmployees.reduce(
    (sum, [, g]) => sum + g.employees.length,
    0
  );

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
            placeholder="Search employees, roles, or departments..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-employees"
          />
        </div>

        <div
          className="flex items-center gap-2"
          data-testid="dept-filter-container"
        >
          <Label className="text-sm text-muted-foreground whitespace-nowrap">
            Department
          </Label>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger
              className="w-[200px]"
              data-testid="select-dept-filter"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {DEPT_OPTIONS.slice()
                .sort((a, b) => a.localeCompare(b))
                .map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className="flex items-center gap-2"
          data-testid="bu-filter-container"
        >
          <Label className="text-sm text-muted-foreground whitespace-nowrap">
            Business Unit
          </Label>
          <Select value={buFilter} onValueChange={setBuFilter}>
            <SelectTrigger
              className="w-[200px]"
              data-testid="select-bu-filter"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {businessUnits
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((bu) => (
                  <SelectItem key={bu.id} value={bu.id}>
                    {bu.name}
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
            {groupedEmployees.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-muted-foreground"
                >
                  No employees found matching your search.
                </TableCell>
              </TableRow>
            ) : (
              groupedEmployees.map(([key, group]) => {
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
                    ? group.employees.map((employee) => (
                        <TableRow
                          key={employee.id}
                          data-testid={`row-employee-${employee.id}`}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {getInitials(employee.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">
                                  {employee.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {employee.email}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{employee.role}</TableCell>
                          <TableCell>{employee.department}</TableCell>
                          <TableCell>
                            {getStatusBadge(employee.status)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/employees/${employee.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                data-testid={`button-view-employee-${employee.id}`}
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
          {groupedEmployees.length} business unit
          {groupedEmployees.length !== 1 ? "s" : ""}
        </p>
      )}

      <AddEmployeeWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        allEmployees={allEmployees}
        onEmployeeAdded={handleEmployeeAdded}
      />
    </div>
  );
}
