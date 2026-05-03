import { useMemo, useState } from "react";
import { ClipboardCheck, Plus, Star, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { employees as initialEmployees, currentUser, employeeExtras } from "@/lib/mock-data";
import { applyOverrides } from "@/lib/employee-store";
import { useOrgStructure } from "@/lib/org-structure-store";
import {
  addPerformanceReview,
  usePerformanceReviews,
  PERFORMANCE_RATING_LABELS,
  SATISFACTION_LABELS,
  type PerformanceRating,
  type PerformanceReview,
  type SatisfactionLevel,
} from "@/lib/performance-review-store";

const SATISFACTION_VALUES: SatisfactionLevel[] = [1, 2, 3, 4, 5];
const RATING_VALUES: PerformanceRating[] = [1, 2, 3, 4, 5];

const today = () => new Date().toISOString().slice(0, 10);

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function ratingBadgeColor(rating: PerformanceRating): string {
  switch (rating) {
    case 1:
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    case 2:
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    case 3:
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    case 4:
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    case 5:
      return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300";
  }
}

type FormState = {
  employeeId: string;
  reviewerId: string;
  reviewDate: string;
  businessUnitId: string;
  departmentName: string;
  teamName: string;
  environmentSatisfaction: string;
  jobSatisfaction: string;
  relationshipSatisfaction: string;
  trainingOpportunitiesTaken: string;
  workLifeBalance: string;
  selfRating: string;
  managerRating: string;
  comments: string;
};

const emptyForm = (): FormState => ({
  employeeId: "",
  reviewerId: currentUser.id,
  reviewDate: today(),
  businessUnitId: "",
  departmentName: "",
  teamName: "",
  environmentSatisfaction: "",
  jobSatisfaction: "",
  relationshipSatisfaction: "",
  trainingOpportunitiesTaken: "0",
  workLifeBalance: "",
  selfRating: "",
  managerRating: "",
  comments: "",
});

export default function PerformanceReviews() {
  const [reviews] = usePerformanceReviews();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState("");
  const { toast } = useToast();
  const org = useOrgStructure();

  const employeeList = useMemo(
    () =>
      applyOverrides(initialEmployees).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    []
  );

  const employeeById = useMemo(() => {
    const map = new Map<string, (typeof employeeList)[0]>();
    employeeList.forEach((e) => map.set(e.id, e));
    return map;
  }, [employeeList]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
  }

  function batchUpdate(updates: Partial<FormState>) {
    setForm((f) => ({ ...f, ...updates }));
    setError("");
  }

  function handleEmployeeChange(employeeId: string) {
    const emp = employeeById.get(employeeId);
    const buId = emp?.buId ?? "";
    const dept = emp?.department ?? "";
    const team = employeeExtras[employeeId]?.team ?? "";
    batchUpdate({ employeeId, businessUnitId: buId, departmentName: dept, teamName: team });
  }

  function handleBuChange(buId: string) {
    batchUpdate({ businessUnitId: buId, departmentName: "", teamName: "" });
  }

  function handleDeptChange(deptName: string) {
    batchUpdate({ departmentName: deptName, teamName: "" });
  }

  // Departments available for the selected BU
  const deptOptionsForBu = useMemo(() => {
    if (!form.businessUnitId) return [];
    const names = org.departments
      .filter((d) => d.buId === form.businessUnitId)
      .map((d) => d.name);
    return Array.from(new Set(names)).sort();
  }, [form.businessUnitId, org.departments]);

  // Teams available for the selected BU + department
  const teamOptionsForDept = useMemo(() => {
    if (!form.businessUnitId || !form.departmentName) return [];
    const deptId = org.departments.find(
      (d) => d.buId === form.businessUnitId && d.name === form.departmentName
    )?.id;
    if (!deptId) return [];
    return org.teams
      .filter((t) => t.departmentId === deptId)
      .map((t) => t.name)
      .sort();
  }, [form.businessUnitId, form.departmentName, org.departments, org.teams]);

  function openNew() {
    setForm(emptyForm());
    setError("");
    setOpen(true);
  }

  function handleSubmit() {
    const required: (keyof FormState)[] = [
      "employeeId",
      "reviewerId",
      "reviewDate",
      "businessUnitId",
      "departmentName",
      "teamName",
      "environmentSatisfaction",
      "jobSatisfaction",
      "relationshipSatisfaction",
      "trainingOpportunitiesTaken",
      "workLifeBalance",
      "selfRating",
      "managerRating",
      "comments",
    ];
    for (const k of required) {
      if (!form[k] && form[k] !== "0") {
        setError("Please fill in all required fields.");
        return;
      }
    }

    const trainingCount = Number(form.trainingOpportunitiesTaken);
    if (!Number.isInteger(trainingCount) || trainingCount < 0) {
      setError("Training opportunities taken must be a non-negative integer.");
      return;
    }

    const employee = employeeById.get(form.employeeId);
    const reviewer = employeeById.get(form.reviewerId);
    if (!employee || !reviewer) {
      setError("Invalid employee or reviewer selection.");
      return;
    }

    const buName =
      org.businessUnits.find((bu) => bu.id === form.businessUnitId)?.name ??
      form.businessUnitId;

    const review: PerformanceReview = {
      id: genId(),
      employeeId: employee.id,
      employeeName: employee.name,
      reviewerId: reviewer.id,
      reviewerName: reviewer.name,
      reviewDate: form.reviewDate,
      businessUnitId: form.businessUnitId,
      businessUnitName: buName,
      department: form.departmentName,
      team: form.teamName,
      environmentSatisfaction: Number(
        form.environmentSatisfaction
      ) as SatisfactionLevel,
      jobSatisfaction: Number(form.jobSatisfaction) as SatisfactionLevel,
      relationshipSatisfaction: Number(
        form.relationshipSatisfaction
      ) as SatisfactionLevel,
      trainingOpportunitiesTaken: trainingCount,
      workLifeBalance: Number(form.workLifeBalance) as SatisfactionLevel,
      selfRating: Number(form.selfRating) as PerformanceRating,
      managerRating: Number(form.managerRating) as PerformanceRating,
      comments: form.comments.trim(),
      createdAt: new Date().toISOString(),
    };

    addPerformanceReview(review);
    setOpen(false);
    setForm(emptyForm());
    toast({
      title: "Performance review saved",
      description: `${review.employeeName} reviewed by ${review.reviewerName}.`,
    });
  }

  return (
    <div className="space-y-6" data-testid="page-performance-reviews">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" />
            Performance Reviews
          </h1>
          <p className="text-muted-foreground mt-1">
            Record structured performance reviews capturing satisfaction,
            training, and dual self/manager ratings.
          </p>
        </div>
        <Button onClick={openNew} data-testid="button-new-review">
          <Plus className="w-4 h-4 mr-2" />
          New Review
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Reviews</CardTitle>
          <CardDescription>
            {reviews.length} review{reviews.length === 1 ? "" : "s"} on file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardCheck className="mx-auto h-10 w-10 mb-3 opacity-40" />
              <p>No performance reviews yet.</p>
              <p className="text-sm">
                Click "New Review" to record the first one.
              </p>
            </div>
          ) : (
            <Table data-testid="table-reviews">
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Reviewer</TableHead>
                  <TableHead>Review Date</TableHead>
                  <TableHead>Manager Rating</TableHead>
                  <TableHead>Self Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((r) => (
                  <TableRow key={r.id} data-testid={`row-review-${r.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        {r.employeeName}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.department ? (
                        <span className="text-sm">{r.department}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.team ? (
                        <span className="text-sm">{r.team}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>{r.reviewerName}</TableCell>
                    <TableCell>{r.reviewDate}</TableCell>
                    <TableCell>
                      <Badge
                        className={ratingBadgeColor(r.managerRating)}
                        variant="secondary"
                      >
                        <Star className="w-3 h-3 mr-1" />
                        {PERFORMANCE_RATING_LABELS[r.managerRating]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={ratingBadgeColor(r.selfRating)}
                        variant="secondary"
                      >
                        {PERFORMANCE_RATING_LABELS[r.selfRating]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
          data-testid="dialog-new-review"
        >
          <DialogHeader>
            <DialogTitle>New Performance Review</DialogTitle>
            <DialogDescription>
              Capture satisfaction signals, training engagement, and dual
              self/manager ratings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* ── People ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="employee">
                  Employee <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.employeeId}
                  onValueChange={handleEmployeeChange}
                >
                  <SelectTrigger id="employee" data-testid="select-employee">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeList.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reviewer">
                  Reviewer <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.reviewerId}
                  onValueChange={(v) => update("reviewerId", v)}
                >
                  <SelectTrigger id="reviewer" data-testid="select-reviewer">
                    <SelectValue placeholder="Select reviewer" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeList.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Org Context ── */}
            <div className="border-t pt-4">
              <p className="text-sm font-semibold mb-3">
                Role Context{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  — auto-filled from employee; edit if reviewing a new role
                </span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bu">
                    Business Unit <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={form.businessUnitId}
                    onValueChange={handleBuChange}
                  >
                    <SelectTrigger id="bu" data-testid="select-bu">
                      <SelectValue placeholder="Select BU" />
                    </SelectTrigger>
                    <SelectContent>
                      {org.businessUnits.map((bu) => (
                        <SelectItem key={bu.id} value={bu.id}>
                          {bu.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dept">
                    Department <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={form.departmentName}
                    onValueChange={handleDeptChange}
                    disabled={deptOptionsForBu.length === 0}
                  >
                    <SelectTrigger id="dept" data-testid="select-dept">
                      <SelectValue placeholder="Select dept" />
                    </SelectTrigger>
                    <SelectContent>
                      {deptOptionsForBu.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="team">
                    Team <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={form.teamName}
                    onValueChange={(v) => update("teamName", v)}
                    disabled={teamOptionsForDept.length === 0}
                  >
                    <SelectTrigger id="team" data-testid="select-team">
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamOptionsForDept.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ── Date & Training ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="review-date">
                  Review Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="review-date"
                  type="date"
                  value={form.reviewDate}
                  onChange={(e) => update("reviewDate", e.target.value)}
                  data-testid="input-review-date"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="training">
                  Training Opportunities Taken{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="training"
                  type="number"
                  min={0}
                  step={1}
                  value={form.trainingOpportunitiesTaken}
                  onChange={(e) =>
                    update("trainingOpportunitiesTaken", e.target.value)
                  }
                  data-testid="input-training"
                />
              </div>
            </div>

            {/* ── Satisfaction ── */}
            <div className="border-t pt-4">
              <p className="text-sm font-semibold mb-3">
                Satisfaction{" "}
                <span className="text-muted-foreground font-normal">(1–5)</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SatisfactionField
                  id="environment-satisfaction"
                  label="Environment Satisfaction"
                  value={form.environmentSatisfaction}
                  onChange={(v) => update("environmentSatisfaction", v)}
                  testId="select-environment-satisfaction"
                />
                <SatisfactionField
                  id="job-satisfaction"
                  label="Job Satisfaction"
                  value={form.jobSatisfaction}
                  onChange={(v) => update("jobSatisfaction", v)}
                  testId="select-job-satisfaction"
                />
                <SatisfactionField
                  id="relationship-satisfaction"
                  label="Relationship Satisfaction"
                  value={form.relationshipSatisfaction}
                  onChange={(v) => update("relationshipSatisfaction", v)}
                  testId="select-relationship-satisfaction"
                />
                <SatisfactionField
                  id="work-life-balance"
                  label="Work Life Balance"
                  value={form.workLifeBalance}
                  onChange={(v) => update("workLifeBalance", v)}
                  testId="select-work-life-balance"
                />
              </div>
            </div>

            {/* ── Performance Ratings ── */}
            <div className="border-t pt-4">
              <p className="text-sm font-semibold mb-3">
                Performance Ratings{" "}
                <span className="text-muted-foreground font-normal">(1–5)</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <RatingField
                  id="self-rating"
                  label="Self Rating"
                  value={form.selfRating}
                  onChange={(v) => update("selfRating", v)}
                  testId="select-self-rating"
                />
                <RatingField
                  id="manager-rating"
                  label="Manager Rating"
                  value={form.managerRating}
                  onChange={(v) => update("managerRating", v)}
                  testId="select-manager-rating"
                />
              </div>
            </div>

            {/* ── Comments ── */}
            <div className="border-t pt-4 space-y-1.5">
              <Label htmlFor="comments">
                Comments <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="comments"
                value={form.comments}
                onChange={(e) => update("comments", e.target.value)}
                rows={4}
                placeholder="Highlights, areas for growth, specific examples of performance during the review period…"
                data-testid="textarea-comments"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500" data-testid="form-error">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} data-testid="button-submit-review">
              Save Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SatisfactionField({
  id,
  label,
  value,
  onChange,
  testId,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} <span className="text-red-500">*</span>
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} data-testid={testId}>
          <SelectValue placeholder="Select level" />
        </SelectTrigger>
        <SelectContent>
          {SATISFACTION_VALUES.map((v) => (
            <SelectItem key={v} value={String(v)}>
              {v} — {SATISFACTION_LABELS[v]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function RatingField({
  id,
  label,
  value,
  onChange,
  testId,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} <span className="text-red-500">*</span>
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} data-testid={testId}>
          <SelectValue placeholder="Select rating" />
        </SelectTrigger>
        <SelectContent>
          {RATING_VALUES.map((v) => (
            <SelectItem key={v} value={String(v)}>
              {v} — {PERFORMANCE_RATING_LABELS[v]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
