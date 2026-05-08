import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  getEmployee,
  getEmployeeSkills,
  getSalaryHistory,
  getEmployeeLeaveRequests,
} from "@/lib/api/hr-core";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  ArrowLeft,
  Mail,
  Briefcase,
  Calendar,
  Building,
  DollarSign,
  UserCheck,
  Phone,
  Heart,
  GraduationCap,
  Award,
  Hash,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
} from "lucide-react";

const CONTRACT_LABELS: Record<string, string> = {
  FULL_TIME: "Full Time",
  PART_TIME: "Part Time",
  INTERN: "Intern",
  CONTRACTOR: "Contractor",
  FIXED_TERM: "Fixed Term",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  ON_LEAVE: "destructive",
  PROBATION: "secondary",
  TERMINATED: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On Leave",
  PROBATION: "Probation",
  TERMINATED: "Terminated",
  RESIGNED: "Resigned",
};

const PROFICIENCY_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  DEVELOPING: "Developing",
  PROFICIENT: "Proficient",
  ADVANCED: "Advanced",
  EXPERT: "Expert",
};

const PROFICIENCY_COLORS: Record<string, string> = {
  BEGINNER: "bg-gray-100 text-gray-600",
  DEVELOPING: "bg-orange-100 text-orange-700",
  PROFICIENT: "bg-blue-100 text-blue-700",
  ADVANCED: "bg-violet-100 text-violet-700",
  EXPERT: "bg-green-100 text-green-700",
};

const LEAVE_STATUS_META: Record<string, { label: string; Icon: React.ElementType; cls: string }> = {
  PENDING: { label: "Pending", Icon: Clock, cls: "text-orange-500" },
  APPROVED: { label: "Approved", Icon: CheckCircle2, cls: "text-green-500" },
  REJECTED: { label: "Rejected", Icon: XCircle, cls: "text-red-500" },
  CANCELLED: { label: "Cancelled", Icon: MinusCircle, cls: "text-gray-400" },
  ESCALATED: { label: "Escalated", Icon: Clock, cls: "text-purple-500" },
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

function InfoRow({
  icon: Icon,
  label,
  value,
  testId,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </p>
      <p className="font-medium" data-testid={testId}>
        {value ?? "—"}
      </p>
    </div>
  );
}

export default function EmployeeProfile() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";

  const { data: emp, isLoading: loadingEmp } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => getEmployee(id),
    enabled: !!id,
  });

  const { data: skills = [] } = useQuery({
    queryKey: ["employee-skills", id],
    queryFn: () => getEmployeeSkills(id),
    enabled: !!id,
  });

  const { data: salaryHistory = [] } = useQuery({
    queryKey: ["salary-history", id],
    queryFn: () => getSalaryHistory(id),
    enabled: !!id,
  });

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ["employee-leaves", id],
    queryFn: () => getEmployeeLeaveRequests(id),
    enabled: !!id,
  });

  if (loadingEmp) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!emp) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <h2 className="text-2xl font-bold mb-2">Employee Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The requested employee could not be found.
        </p>
        <Link href="/employees">
          <Button>Back to Directory</Button>
        </Link>
      </div>
    );
  }

  const fullName = `${emp.firstName} ${emp.lastName}`;
  const statusLabel = STATUS_LABELS[emp.employmentStatus] ?? emp.employmentStatus;
  const statusVariant = STATUS_VARIANT[emp.employmentStatus] ?? "outline";

  const salaryChartData = salaryHistory.map((s) => ({
    date: s.effectiveDate.slice(0, 7),
    gross: s.grossAfter,
    net: s.netAfter,
  }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <Link href="/employees">
          <Button
            variant="ghost"
            className="mb-4 gap-2 pl-0 hover:bg-transparent"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Directory
          </Button>
        </Link>
      </div>

      {/* Profile header */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="flex items-center gap-6">
          <Avatar className="h-24 w-24 border-4 border-background shadow-sm">
            <AvatarFallback className="text-3xl bg-primary/10 text-primary">
              {getInitials(emp.firstName, emp.lastName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1
              className="text-3xl font-bold tracking-tight"
              data-testid="heading-employee-name"
            >
              {fullName}
            </h1>
            <p className="text-xl text-muted-foreground mt-1">
              {emp.position?.title ?? "—"}
            </p>
            <div className="flex items-center gap-3 mt-3">
              <Badge variant={statusVariant}>{statusLabel}</Badge>
              <div className="flex items-center text-sm text-muted-foreground gap-1">
                <Building className="h-4 w-4" />
                {emp.department?.name ?? "—"}
              </div>
              {emp.team && (
                <div className="flex items-center text-sm text-muted-foreground gap-1">
                  <Users className="h-4 w-4" />
                  {emp.team.name}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="details" className="pt-2">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="leave-history" data-testid="tab-leave-history">
            Leave History
            {leaveRequests.length > 0 && (
              <span className="ml-2 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5">
                {leaveRequests.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="skills" data-testid="tab-skills">
            Skills
            {skills.length > 0 && (
              <span className="ml-2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs px-2 py-0.5">
                {skills.length}
              </span>
            )}
          </TabsTrigger>
          {salaryHistory.length > 0 && (
            <TabsTrigger value="salary" data-testid="tab-salary">
              Salary History
            </TabsTrigger>
          )}
        </TabsList>

        {/* Details tab */}
        <TabsContent value="details" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-indigo-500" />
                    <CardTitle>Professional Details</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-y-6 gap-x-8">
                  {emp.employeeCode && (
                    <InfoRow icon={Hash} label="Employee Code" value={<span className="font-mono">{emp.employeeCode}</span>} />
                  )}
                  <InfoRow icon={UserCheck} label="Full Name" value={fullName} testId="text-name" />
                  <InfoRow icon={Briefcase} label="Job Title" value={emp.position?.title} testId="text-role" />
                  <InfoRow icon={Award} label="Contract Type" value={CONTRACT_LABELS[emp.contractType] ?? emp.contractType} />
                  <InfoRow icon={Building} label="Department" value={emp.department?.name} />
                  <InfoRow icon={Users} label="Team" value={emp.team?.name} />
                  {emp.manager && (
                    <InfoRow
                      icon={UserCheck}
                      label="Manager"
                      value={`${emp.manager.firstName} ${emp.manager.lastName}`}
                    />
                  )}
                  <InfoRow
                    icon={Calendar}
                    label="Hire Date"
                    value={new Date(emp.hireDate).toLocaleDateString("en-US", {
                      year: "numeric", month: "long", day: "numeric",
                    })}
                  />
                </CardContent>
              </Card>

              {/* Contact info */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-500" />
                    <CardTitle>Contact Information</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-y-6 gap-x-8">
                  <InfoRow icon={Mail} label="Email" value={emp.email} />
                  {emp.phone && <InfoRow icon={Phone} label="Phone" value={emp.phone} />}
                  {emp.dateOfBirth && (
                    <InfoRow
                      icon={Calendar}
                      label="Date of Birth"
                      value={new Date(emp.dateOfBirth).toLocaleDateString("en-US", {
                        year: "numeric", month: "long", day: "numeric",
                      })}
                    />
                  )}
                  {emp.maritalStatus && <InfoRow icon={Heart} label="Marital Status" value={emp.maritalStatus} />}
                  {emp.educationLevel && <InfoRow icon={GraduationCap} label="Education Level" value={emp.educationLevel} />}
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {(emp.grossSalary || emp.netSalary) && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-500" />
                      <CardTitle>Compensation</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {emp.grossSalary != null && (
                      <InfoRow
                        icon={DollarSign}
                        label="Gross Salary"
                        value={emp.grossSalary.toLocaleString("en-US", { style: "currency", currency: "DZD" })}
                      />
                    )}
                    {emp.netSalary != null && (
                      <InfoRow
                        icon={DollarSign}
                        label="Net Salary"
                        value={emp.netSalary.toLocaleString("en-US", { style: "currency", currency: "DZD" })}
                      />
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Leave requests</span>
                    <span className="font-semibold">{leaveRequests.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Skills</span>
                    <span className="font-semibold">{skills.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Salary changes</span>
                    <span className="font-semibold">{salaryHistory.length}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Leave History tab */}
        <TabsContent value="leave-history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Leave History</CardTitle>
            </CardHeader>
            <CardContent>
              {leaveRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No leave requests found.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRequests.map((req) => {
                      const meta = LEAVE_STATUS_META[req.status] ?? LEAVE_STATUS_META["PENDING"];
                      const StatusIcon = meta.Icon;
                      return (
                        <TableRow key={req.id} data-testid={`row-leave-${req.id}`}>
                          <TableCell>
                            <Badge variant="outline">
                              {req.leaveType?.name ?? req.leaveTypeId}
                            </Badge>
                          </TableCell>
                          <TableCell>{req.startDate}</TableCell>
                          <TableCell>{req.endDate}</TableCell>
                          <TableCell>{req.totalDays}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <StatusIcon className={`h-3.5 w-3.5 ${meta.cls}`} />
                              <span className="text-sm">{meta.label}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Skills tab */}
        <TabsContent value="skills" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Skills & Proficiency</CardTitle>
            </CardHeader>
            <CardContent>
              {skills.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No skills recorded yet.
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {skills.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card gap-3"
                      data-testid={`skill-card-${s.skillId}`}
                    >
                      <div>
                        <p className="text-sm font-medium">{s.skill.name}</p>
                        {s.skill.category && (
                          <p className="text-xs text-muted-foreground">{s.skill.category}</p>
                        )}
                        {s.yearsOfExperience != null && (
                          <p className="text-xs text-muted-foreground">
                            {s.yearsOfExperience} yr{s.yearsOfExperience !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                          PROFICIENCY_COLORS[s.proficiencyLevel] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {PROFICIENCY_LABELS[s.proficiencyLevel] ?? s.proficiencyLevel}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Salary History tab */}
        {salaryHistory.length > 0 && (
          <TabsContent value="salary" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <CardTitle>Salary History</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64 mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salaryChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="gross" stroke="#6366f1" name="Gross" dot />
                      <Line type="monotone" dataKey="net" stroke="#10b981" name="Net" dot />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Effective Date</TableHead>
                      <TableHead>Gross Before</TableHead>
                      <TableHead>Gross After</TableHead>
                      <TableHead>Net Before</TableHead>
                      <TableHead>Net After</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salaryHistory.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.effectiveDate}</TableCell>
                        <TableCell>{s.grossBefore.toLocaleString()}</TableCell>
                        <TableCell className="font-semibold">{s.grossAfter.toLocaleString()}</TableCell>
                        <TableCell>{s.netBefore.toLocaleString()}</TableCell>
                        <TableCell className="font-semibold">{s.netAfter.toLocaleString()}</TableCell>
                        <TableCell>{s.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
