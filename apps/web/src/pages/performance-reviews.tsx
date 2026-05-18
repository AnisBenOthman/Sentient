import { useMemo, useState } from "react";
import type React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ClipboardCheck, ClipboardList, Lock, Plus, RefreshCw, Save, Star, UserCheck } from "lucide-react";
import type { PerformanceReviewDto } from "@sentient/shared";
import {
  PerformanceRating,
  ReviewCycleStatus,
  ReviewStatus,
  ReviewType,
  SatisfactionLevel,
} from "@sentient/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/providers/auth-provider";
import {
  createReviewCycle,
  getEmployees,
  getPerformanceReviews,
  getReviewCycles,
  initiateReviewCycle,
  recordPerformanceReviewSalaryFollowUp,
  reassignPerformanceReviewReviewer,
  reopenPerformanceReview,
  submitManagerReview,
  submitSelfReview,
  type CreateReviewCyclePayload,
  type PerformanceReviewQuery,
} from "@/lib/api/hr-core";


const RATING_OPTIONS: PerformanceRating[] = Object.values(PerformanceRating);
const SATISFACTION_OPTIONS: SatisfactionLevel[] = Object.values(SatisfactionLevel);
const STATUS_OPTIONS: ReviewStatus[] = Object.values(ReviewStatus);

const ratingLabel: Record<string, string> = {
  [PerformanceRating.UNACCEPTABLE]: "Unacceptable",
  [PerformanceRating.NEEDS_IMPROVEMENT]: "Needs improvement",
  [PerformanceRating.MEETS_EXPECTATIONS]: "Meets expectations",
  [PerformanceRating.EXCEEDS_EXPECTATIONS]: "Exceeds expectations",
  [PerformanceRating.ABOVE_AND_BEYOND]: "Above and beyond",
};

const satisfactionLabel: Record<string, string> = {
  [SatisfactionLevel.VERY_DISSATISFIED]: "Very dissatisfied",
  [SatisfactionLevel.DISSATISFIED]: "Dissatisfied",
  [SatisfactionLevel.NEUTRAL]: "Neutral",
  [SatisfactionLevel.SATISFIED]: "Satisfied",
  [SatisfactionLevel.VERY_SATISFIED]: "Very satisfied",
};

const statusTone: Record<string, string> = {
  [ReviewStatus.PENDING]: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  [ReviewStatus.IN_PROGRESS]: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200",
  [ReviewStatus.SUBMITTED]: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200",
  [ReviewStatus.COMPLETED]: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200",
  [ReviewStatus.REOPENED]: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200",
  [ReviewStatus.CLOSED]: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  [ReviewStatus.CANCELLED]: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200",
};

interface SelfReviewForm {
  environmentSatisfaction: SatisfactionLevel;
  jobSatisfaction: SatisfactionLevel;
  relationshipSatisfaction: SatisfactionLevel;
  trainingOpportunitiesTaken: string;
  workLifeBalance: SatisfactionLevel;
  selfRating: PerformanceRating;
  employeeComments: string;
}

interface ManagerReviewForm {
  managerRating: PerformanceRating;
  managerComments: string;
}

interface HrActionForm {
  reviewId: string;
  action: "reopen" | "reassign" | "salary";
  reason: string;
  reviewerId: string;
  salaryHistoryId: string;
}

function employeeName(review: Pick<PerformanceReviewDto, "employee">): string {
  return review.employee ? `${review.employee.firstName} ${review.employee.lastName}` : "Employee";
}

function reviewerName(review: Pick<PerformanceReviewDto, "reviewer">): string {
  return review.reviewer ? `${review.reviewer.firstName} ${review.reviewer.lastName}` : "Reviewer";
}

function formatDate(value: string | null): string {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function hasRole(userRoles: string[] | undefined, roles: string[]): boolean {
  return userRoles?.some((role) => roles.includes(role)) ?? false;
}

function emptyCycle(): CreateReviewCyclePayload {
  const year = new Date().getFullYear();
  return {
    name: `${year} Annual Review`,
    reviewType: ReviewType.ANNUAL,
    periodStart: `${year}-01-01`,
    periodEnd: `${year}-12-31`,
    selfReviewOpensAt: `${year}-11-01T09:00`,
    selfReviewClosesAt: `${year}-11-30T17:00`,
    managerReviewDueAt: `${year}-12-15T17:00`,
  };
}

function emptySelfReview(): SelfReviewForm {
  return {
    environmentSatisfaction: SatisfactionLevel.SATISFIED,
    jobSatisfaction: SatisfactionLevel.SATISFIED,
    relationshipSatisfaction: SatisfactionLevel.SATISFIED,
    trainingOpportunitiesTaken: "0",
    workLifeBalance: SatisfactionLevel.SATISFIED,
    selfRating: PerformanceRating.MEETS_EXPECTATIONS,
    employeeComments: "",
  };
}

function emptyManagerReview(): ManagerReviewForm {
  return {
    managerRating: PerformanceRating.MEETS_EXPECTATIONS,
    managerComments: "",
  };
}

export default function PerformanceReviews() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cycleOpen, setCycleOpen] = useState(false);
  const [cycleForm, setCycleForm] = useState<CreateReviewCyclePayload>(emptyCycle);
  const [selfReviewTarget, setSelfReviewTarget] = useState<PerformanceReviewDto | null>(null);
  const [managerReviewTarget, setManagerReviewTarget] = useState<PerformanceReviewDto | null>(null);
  const [selfForm, setSelfForm] = useState<SelfReviewForm>(emptySelfReview);
  const [managerForm, setManagerForm] = useState<ManagerReviewForm>(emptyManagerReview);
  const [hrAction, setHrAction] = useState<HrActionForm | null>(null);
  const [filters, setFilters] = useState<PerformanceReviewQuery>({ limit: 100 });

  const isHr = hasRole(user?.roles, ["HR_ADMIN", "GLOBAL_HR_ADMIN"]);
  const isManager = hasRole(user?.roles, ["MANAGER", "HR_ADMIN", "GLOBAL_HR_ADMIN", "EXECUTIVE"]);

  const cyclesQuery = useQuery({
    queryKey: ["performance-review-cycles"],
    queryFn: getReviewCycles,
    enabled: isHr,
  });

  const reviewsQuery = useQuery({
    queryKey: ["performance-reviews", filters],
    queryFn: () => getPerformanceReviews(filters),
  });

  const employeesQuery = useQuery({
    queryKey: ["employees-for-review-actions"],
    queryFn: () => getEmployees({ limit: 500 }),
    select: (res) => res.data,
    enabled: isHr,
  });

  const myReviews = useMemo(
    () => reviewsQuery.data?.data.filter((review) => review.employeeId === user?.employeeId) ?? [],
    [reviewsQuery.data?.data, user?.employeeId],
  );
  const assignedReviews = useMemo(
    () => reviewsQuery.data?.data.filter((review) => review.reviewerId === user?.employeeId) ?? [],
    [reviewsQuery.data?.data, user?.employeeId],
  );

  const invalidateReviews = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["performance-reviews"] }),
      queryClient.invalidateQueries({ queryKey: ["performance-review-cycles"] }),
    ]);
  };

  const createCycleMutation = useMutation({
    mutationFn: createReviewCycle,
    onSuccess: async () => {
      setCycleOpen(false);
      setCycleForm(emptyCycle());
      await invalidateReviews();
      toast({ title: "Review cycle created" });
    },
  });

  const initiateCycleMutation = useMutation({
    mutationFn: (cycleId: string) => initiateReviewCycle(cycleId, {}),
    onSuccess: async (result) => {
      await invalidateReviews();
      toast({
        title: "Review cycle initiated",
        description: `${result.created} assigned, ${result.skippedExisting} already existed, ${result.missingReviewers.length} missing reviewers.`,
      });
    },
  });

  const selfReviewMutation = useMutation({
    mutationFn: async () => {
      if (!selfReviewTarget) throw new Error("No review selected");
      return submitSelfReview(selfReviewTarget.id, {
        environmentSatisfaction: selfForm.environmentSatisfaction,
        jobSatisfaction: selfForm.jobSatisfaction,
        relationshipSatisfaction: selfForm.relationshipSatisfaction,
        trainingOpportunitiesTaken: Number(selfForm.trainingOpportunitiesTaken),
        workLifeBalance: selfForm.workLifeBalance,
        selfRating: selfForm.selfRating,
        employeeComments: selfForm.employeeComments,
      });
    },
    onSuccess: async () => {
      setSelfReviewTarget(null);
      await invalidateReviews();
      toast({ title: "Self-review submitted" });
    },
  });

  const managerReviewMutation = useMutation({
    mutationFn: async () => {
      if (!managerReviewTarget) throw new Error("No review selected");
      return submitManagerReview(managerReviewTarget.id, managerForm);
    },
    onSuccess: async () => {
      setManagerReviewTarget(null);
      await invalidateReviews();
      toast({ title: "Manager review completed" });
    },
  });

  const hrActionMutation = useMutation({
    mutationFn: async () => {
      if (!hrAction) throw new Error("No HR action selected");
      if (hrAction.action === "reopen") return reopenPerformanceReview(hrAction.reviewId, hrAction.reason);
      if (hrAction.action === "reassign") {
        return reassignPerformanceReviewReviewer(hrAction.reviewId, hrAction.reviewerId, hrAction.reason);
      }
      return recordPerformanceReviewSalaryFollowUp(hrAction.reviewId, {
        reason: hrAction.reason,
        salaryHistoryId: hrAction.salaryHistoryId || undefined,
      });
    },
    onSuccess: async () => {
      setHrAction(null);
      await invalidateReviews();
      toast({ title: "Review action saved" });
    },
  });

  function openSelfReview(review: PerformanceReviewDto): void {
    setSelfForm({
      environmentSatisfaction: review.environmentSatisfaction ?? SatisfactionLevel.SATISFIED,
      jobSatisfaction: review.jobSatisfaction ?? SatisfactionLevel.SATISFIED,
      relationshipSatisfaction: review.relationshipSatisfaction ?? SatisfactionLevel.SATISFIED,
      trainingOpportunitiesTaken: String(review.trainingOpportunitiesTaken ?? 0),
      workLifeBalance: review.workLifeBalance ?? SatisfactionLevel.SATISFIED,
      selfRating: review.selfRating ?? PerformanceRating.MEETS_EXPECTATIONS,
      employeeComments: review.employeeComments ?? "",
    });
    setSelfReviewTarget(review);
  }

  function openManagerReview(review: PerformanceReviewDto): void {
    setManagerForm({
      managerRating: review.managerRating ?? PerformanceRating.MEETS_EXPECTATIONS,
      managerComments: review.managerComments ?? "",
    });
    setManagerReviewTarget(review);
  }

  function renderReviewRows(reviews: PerformanceReviewDto[], mode: "self" | "manager" | "hr") {
    if (reviews.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
            No reviews match this view.
          </TableCell>
        </TableRow>
      );
    }

    return reviews.map((review) => (
      <TableRow key={review.id}>
        <TableCell className="font-medium">{employeeName(review)}</TableCell>
        <TableCell>{reviewerName(review)}</TableCell>
        <TableCell>{review.cycle?.name ?? "Cycle"}</TableCell>
        <TableCell>{formatDate(review.dueDate)}</TableCell>
        <TableCell>
          <Badge className={statusTone[review.status]} variant="secondary">{review.status.replaceAll("_", " ")}</Badge>
        </TableCell>
        <TableCell>
          {review.ratingGap ? (
            <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" /> Gap</Badge>
          ) : review.managerRating ? (
            <Badge variant="secondary"><Star className="mr-1 h-3 w-3" /> {ratingLabel[review.managerRating]}</Badge>
          ) : (
            <span className="text-sm text-muted-foreground">Pending</span>
          )}
        </TableCell>
        <TableCell className="text-right">
          {mode === "self" && [ReviewStatus.PENDING, ReviewStatus.IN_PROGRESS, ReviewStatus.REOPENED].includes(review.status) && (
            <Button size="sm" onClick={() => openSelfReview(review)}>Self Review</Button>
          )}
          {mode === "manager" && [ReviewStatus.SUBMITTED, ReviewStatus.REOPENED].includes(review.status) && (
            <Button size="sm" onClick={() => openManagerReview(review)}>Complete</Button>
          )}
          {mode === "hr" && (
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setHrAction({ reviewId: review.id, action: "reopen", reason: "", reviewerId: "", salaryHistoryId: "" })}>Reopen</Button>
              <Button size="sm" variant="outline" onClick={() => setHrAction({ reviewId: review.id, action: "reassign", reason: "", reviewerId: review.reviewerId, salaryHistoryId: "" })}>Reassign</Button>
              <Button size="sm" variant="outline" onClick={() => setHrAction({ reviewId: review.id, action: "salary", reason: "Annual review compensation follow-up", reviewerId: "", salaryHistoryId: "" })}>Salary</Button>
            </div>
          )}
        </TableCell>
      </TableRow>
    ));
  }

  return (
    <div className="space-y-6" data-testid="page-performance-reviews">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <ClipboardCheck className="h-7 w-7 text-primary" />
            Performance Reviews
          </h1>
          <p className="mt-1 text-muted-foreground">
            Create cycles, submit reviews, and track performance outcomes.
          </p>
        </div>
        {isHr && (
          <Button onClick={() => setCycleOpen(true)} data-testid="button-new-review-cycle">
            <Plus className="mr-2 h-4 w-4" />
            New Cycle
          </Button>
        )}
      </div>

      <Tabs defaultValue={isHr ? "cycles" : "mine"} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="mine">My Reviews</TabsTrigger>
          <TabsTrigger value="assigned" disabled={!isManager}>Assigned</TabsTrigger>
          <TabsTrigger value="cycles" disabled={!isHr}>Cycles</TabsTrigger>
          <TabsTrigger value="outcomes" disabled={!isHr}>Outcomes</TabsTrigger>
        </TabsList>

        <TabsContent value="mine">
          <ReviewTable title="My Reviews" description="Reviews assigned to you as the employee.">
            {renderReviewRows(myReviews, "self")}
          </ReviewTable>
        </TabsContent>

        <TabsContent value="assigned">
          <ReviewTable title="Assigned to Me" description="Submitted or reopened reviews awaiting manager completion.">
            {renderReviewRows(assignedReviews, "manager")}
          </ReviewTable>
        </TabsContent>

        <TabsContent value="cycles">
          <Card>
            <CardHeader>
              <CardTitle>Review Cycles</CardTitle>
              <CardDescription>{cyclesQuery.data?.length ?? 0} cycle{cyclesQuery.data?.length === 1 ? "" : "s"} configured.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Window</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(cyclesQuery.data ?? []).map((cycle) => (
                    <TableRow key={cycle.id}>
                      <TableCell className="font-medium">{cycle.name}</TableCell>
                      <TableCell>{cycle.reviewType.replace("_", " ")}</TableCell>
                      <TableCell>{formatDate(cycle.periodStart)} - {formatDate(cycle.periodEnd)}</TableCell>
                      <TableCell>
                        <Badge variant={cycle.status === ReviewCycleStatus.ACTIVE ? "default" : "secondary"}>
                          {cycle.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={cycle.status === ReviewCycleStatus.CLOSED || initiateCycleMutation.isPending}
                          onClick={() => initiateCycleMutation.mutate(cycle.id)}
                        >
                          <UserCheck className="mr-2 h-4 w-4" />
                          Initiate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outcomes">
          <Card>
            <CardHeader>
              <CardTitle>Outcomes</CardTitle>
              <CardDescription>Filter incomplete, overdue, completed, and rating-gap reviews.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <Select value={filters.status ?? "ALL"} onValueChange={(value) => setFilters((current) => ({ ...current, status: value === "ALL" ? undefined : value }))}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All statuses</SelectItem>
                    {STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{status.replaceAll("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filters.ratingGap ? "true" : "false"} onValueChange={(value) => setFilters((current) => ({ ...current, ratingGap: value === "true" ? true : undefined }))}>
                  <SelectTrigger><SelectValue placeholder="Rating gap" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">All ratings</SelectItem>
                    <SelectItem value="true">Rating gaps only</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filters.overdue ? "true" : "false"} onValueChange={(value) => setFilters((current) => ({ ...current, overdue: value === "true" ? true : undefined }))}>
                  <SelectTrigger><SelectValue placeholder="Overdue" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">All due dates</SelectItem>
                    <SelectItem value="true">Overdue only</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => setFilters({ limit: 100 })}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
              <ReviewTable title="Review Outcomes" description={`${reviewsQuery.data?.total ?? 0} review records in scope.`}>
                {renderReviewRows(reviewsQuery.data?.data ?? [], "hr")}
              </ReviewTable>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={cycleOpen} onOpenChange={setCycleOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Review Cycle</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><Input value={cycleForm.name} onChange={(event) => setCycleForm((current) => ({ ...current, name: event.target.value }))} /></Field>
            <Field label="Type">
              <Select value={cycleForm.reviewType} onValueChange={(value) => setCycleForm((current) => ({ ...current, reviewType: value as ReviewType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.values(ReviewType).map((type) => <SelectItem key={type} value={type}>{type.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Period Start"><Input type="date" value={cycleForm.periodStart} onChange={(event) => setCycleForm((current) => ({ ...current, periodStart: event.target.value }))} /></Field>
            <Field label="Period End"><Input type="date" value={cycleForm.periodEnd} onChange={(event) => setCycleForm((current) => ({ ...current, periodEnd: event.target.value }))} /></Field>
            <Field label="Self Review Opens"><Input type="datetime-local" value={cycleForm.selfReviewOpensAt} onChange={(event) => setCycleForm((current) => ({ ...current, selfReviewOpensAt: event.target.value }))} /></Field>
            <Field label="Self Review Closes"><Input type="datetime-local" value={cycleForm.selfReviewClosesAt} onChange={(event) => setCycleForm((current) => ({ ...current, selfReviewClosesAt: event.target.value }))} /></Field>
            <Field label="Manager Due"><Input type="datetime-local" value={cycleForm.managerReviewDueAt} onChange={(event) => setCycleForm((current) => ({ ...current, managerReviewDueAt: event.target.value }))} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCycleOpen(false)}>Cancel</Button>
            <Button onClick={() => createCycleMutation.mutate(cycleForm)} disabled={createCycleMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={selfReviewTarget !== null} onOpenChange={(open) => !open && setSelfReviewTarget(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submit Self-Review</DialogTitle>
          </DialogHeader>
          <ReviewScaleForm form={selfForm} setForm={setSelfForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelfReviewTarget(null)}>Cancel</Button>
            <Button onClick={() => selfReviewMutation.mutate()} disabled={selfReviewMutation.isPending}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={managerReviewTarget !== null} onOpenChange={(open) => !open && setManagerReviewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Manager Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Manager Rating">
              <Select value={managerForm.managerRating} onValueChange={(value) => setManagerForm((current) => ({ ...current, managerRating: value as PerformanceRating }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RATING_OPTIONS.map((rating) => <SelectItem key={rating} value={rating}>{ratingLabel[rating]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Manager Comments">
              <Textarea rows={4} maxLength={4000} value={managerForm.managerComments} onChange={(event) => setManagerForm((current) => ({ ...current, managerComments: event.target.value }))} />
              <p className="text-xs text-muted-foreground text-right">{managerForm.managerComments.length} / 4000</p>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManagerReviewTarget(null)}>Cancel</Button>
            <Button onClick={() => managerReviewMutation.mutate()} disabled={managerReviewMutation.isPending}>
              <Lock className="mr-2 h-4 w-4" />
              Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={hrAction !== null} onOpenChange={(open) => !open && setHrAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{hrAction?.action === "reassign" ? "Reassign Reviewer" : hrAction?.action === "salary" ? "Record Salary Follow-Up" : "Reopen Review"}</DialogTitle>
          </DialogHeader>
          {hrAction && (
            <div className="space-y-4">
              {hrAction.action === "reassign" && (
                <Field label="Reviewer">
                  <Select value={hrAction.reviewerId} onValueChange={(value) => setHrAction((current) => current ? { ...current, reviewerId: value } : current)}>
                    <SelectTrigger><SelectValue placeholder="Select reviewer" /></SelectTrigger>
                    <SelectContent>{(employeesQuery.data ?? []).map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )}
              {hrAction.action === "salary" && (
                <Field label="Salary History ID">
                  <Input value={hrAction.salaryHistoryId} onChange={(event) => setHrAction((current) => current ? { ...current, salaryHistoryId: event.target.value } : current)} placeholder="Optional salary history UUID" />
                </Field>
              )}
              <Field label="Reason">
                <Textarea rows={3} value={hrAction.reason} onChange={(event) => setHrAction((current) => current ? { ...current, reason: event.target.value } : current)} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHrAction(null)}>Cancel</Button>
            <Button onClick={() => hrActionMutation.mutate()} disabled={hrActionMutation.isPending || !hrAction?.reason.trim()}>
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReviewTable({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Reviewer</TableHead>
              <TableHead>Cycle</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{children}</TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ReviewScaleForm({
  form,
  setForm,
}: {
  form: SelfReviewForm;
  setForm: React.Dispatch<React.SetStateAction<SelfReviewForm>>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SatisfactionSelect label="Work Environment Satisfaction" value={form.environmentSatisfaction} onChange={(value) => setForm((current) => ({ ...current, environmentSatisfaction: value }))} />
      <SatisfactionSelect label="Job Satisfaction" value={form.jobSatisfaction} onChange={(value) => setForm((current) => ({ ...current, jobSatisfaction: value }))} />
      <SatisfactionSelect label="Team Relationship Satisfaction" value={form.relationshipSatisfaction} onChange={(value) => setForm((current) => ({ ...current, relationshipSatisfaction: value }))} />
      <SatisfactionSelect label="Work-Life Balance" value={form.workLifeBalance} onChange={(value) => setForm((current) => ({ ...current, workLifeBalance: value }))} />
      <Field label="Training Opportunities Taken (0 – 100)">
        <Input type="number" min={0} max={100} value={form.trainingOpportunitiesTaken} onChange={(event) => setForm((current) => ({ ...current, trainingOpportunitiesTaken: event.target.value }))} />
      </Field>
      <Field label="Self Rating">
        <Select value={form.selfRating} onValueChange={(value) => setForm((current) => ({ ...current, selfRating: value as PerformanceRating }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{RATING_OPTIONS.map((rating) => <SelectItem key={rating} value={rating}>{ratingLabel[rating]}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Employee Comments">
          <Textarea rows={4} maxLength={4000} value={form.employeeComments} onChange={(event) => setForm((current) => ({ ...current, employeeComments: event.target.value }))} />
          <p className="text-xs text-muted-foreground text-right">{form.employeeComments.length} / 4000</p>
        </Field>
      </div>
    </div>
  );
}

function SatisfactionSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SatisfactionLevel;
  onChange: (value: SatisfactionLevel) => void;
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={(next) => onChange(next as SatisfactionLevel)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{SATISFACTION_OPTIONS.map((item) => <SelectItem key={item} value={item}>{satisfactionLabel[item]}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
  );
}
