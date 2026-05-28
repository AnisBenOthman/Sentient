import { useMemo, useState } from "react";
import type React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Building2, CalendarDays, ClipboardCheck, ClipboardList, Eye, Lock, MessageSquareText, Plus, RefreshCw, Save, Star, TrendingUp, UserCheck } from "lucide-react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";
import {
  createReviewCycle,
  getEmployees,
  getPerformanceReview,
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

const ratingTone: Record<string, string> = {
  [PerformanceRating.UNACCEPTABLE]: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200",
  [PerformanceRating.NEEDS_IMPROVEMENT]: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-200",
  [PerformanceRating.MEETS_EXPECTATIONS]: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200",
  [PerformanceRating.EXCEEDS_EXPECTATIONS]: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200",
  [PerformanceRating.ABOVE_AND_BEYOND]: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-200",
};

const satisfactionTone: Record<string, string> = {
  [SatisfactionLevel.VERY_DISSATISFIED]: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200",
  [SatisfactionLevel.DISSATISFIED]: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-200",
  [SatisfactionLevel.NEUTRAL]: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200",
  [SatisfactionLevel.SATISFIED]: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200",
  [SatisfactionLevel.VERY_SATISFIED]: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200",
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

function formatDateTime(value: string | null): string {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function enumLabel(value: string | null | undefined, labels?: Record<string, string>): string {
  if (!value) return "Not set";
  return labels?.[value] ?? value.replaceAll("_", " ");
}

function textValue(value: string | null | undefined): string {
  return value?.trim() ? value : "Not provided";
}

function reviewInitials(review: PerformanceReviewDto): string {
  const first = review.employee?.firstName?.[0] ?? "E";
  const last = review.employee?.lastName?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
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
  const [detailReviewId, setDetailReviewId] = useState<string | null>(null);
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

  const detailQuery = useQuery({
    queryKey: ["performance-review-detail", detailReviewId],
    queryFn: () => getPerformanceReview(detailReviewId ?? ""),
    enabled: detailReviewId !== null,
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
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="group h-8 gap-1.5 border-primary/25 bg-primary/5 px-2.5 text-primary shadow-none transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:ring-primary/25 dark:border-primary/30 dark:bg-primary/10 dark:hover:bg-primary/15"
              aria-label={`Open performance review details for ${employeeName(review)}`}
              onClick={() => setDetailReviewId(review.id)}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 transition-colors group-hover:bg-primary/15">
                <Eye className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-semibold">Details</span>
            </Button>
            {mode === "self" && [ReviewStatus.PENDING, ReviewStatus.IN_PROGRESS, ReviewStatus.REOPENED].includes(review.status) && (
              <Button size="sm" onClick={() => openSelfReview(review)}>Self Review</Button>
            )}
            {mode === "manager" && [ReviewStatus.SUBMITTED, ReviewStatus.REOPENED].includes(review.status) && (
              <Button size="sm" onClick={() => openManagerReview(review)}>Complete</Button>
            )}
            {mode === "hr" && (
              <>
                <Button size="sm" variant="outline" onClick={() => setHrAction({ reviewId: review.id, action: "reopen", reason: "", reviewerId: "", salaryHistoryId: "" })}>Reopen</Button>
                <Button size="sm" variant="outline" onClick={() => setHrAction({ reviewId: review.id, action: "reassign", reason: "", reviewerId: review.reviewerId, salaryHistoryId: "" })}>Reassign</Button>
                <Button size="sm" variant="outline" onClick={() => setHrAction({ reviewId: review.id, action: "salary", reason: "Annual review compensation follow-up", reviewerId: "", salaryHistoryId: "" })}>Salary</Button>
              </>
            )}
          </div>
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

      <Dialog open={detailReviewId !== null} onOpenChange={(open) => !open && setDetailReviewId(null)}>
        <DialogContent className="sm:max-w-4xl overflow-hidden p-0">
          <DialogHeader className="border-b bg-muted/30 px-6 py-5 text-left">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Eye className="h-5 w-5 text-primary" />
              Performance Review Details
            </DialogTitle>
            <DialogDescription>
              {detailQuery.data ? `${employeeName(detailQuery.data)} reviewed by ${reviewerName(detailQuery.data)}` : "Loading review details"}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[72vh]">
            {detailQuery.isLoading ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">Loading details...</p>
            ) : detailQuery.data ? (
              <ReviewDetailContent review={detailQuery.data} />
            ) : (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">Review details are unavailable.</p>
            )}
          </ScrollArea>
          <DialogFooter className="border-t bg-muted/20 px-6 py-4">
            <Button variant="outline" onClick={() => setDetailReviewId(null)}>Close</Button>
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

function ReviewDetailContent({ review }: { review: PerformanceReviewDto }) {
  return (
    <div className="space-y-5 px-6 py-6">
      <section className="overflow-hidden rounded-lg border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-sm dark:border-slate-700">
        <div className="grid gap-5 p-5 md:grid-cols-[1fr_260px]">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-lg font-semibold">
              {reviewInitials(review)}
            </div>
            <div className="min-w-0 space-y-3">
              <div>
                <p className="text-sm text-slate-300">{review.cycle?.name ?? "Review cycle"}</p>
                <h3 className="break-words text-2xl font-semibold leading-tight">{employeeName(review)}</h3>
                <p className="mt-1 text-sm text-slate-300">
                  {review.positionTitle ?? "Position not set"} with {reviewerName(review)} as reviewer
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={cn("border-0", statusTone[review.status])} variant="secondary">
                  {review.status.replaceAll("_", " ")}
                </Badge>
                {review.ratingGap && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Rating gap
                  </Badge>
                )}
                {review.overdue && <Badge className="border-red-200 bg-red-50 text-red-700" variant="outline">Overdue</Badge>}
              </div>
            </div>
          </div>

          <div className="grid gap-2 rounded-lg border border-white/10 bg-white/10 p-3">
            <HeaderFact icon={CalendarDays} label="Due" value={formatDate(review.dueDate)} />
            <HeaderFact icon={Building2} label="Org" value={[review.businessUnitName, review.departmentName, review.teamName].filter(Boolean).join(" / ") || "Not set"} />
            <HeaderFact icon={TrendingUp} label="Follow-ups" value={String(review.salaryFollowUps?.length ?? 0)} />
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <RatingPanel title="Self Rating" rating={review.selfRating} subtitle={review.submittedAt ? `Submitted ${formatDateTime(review.submittedAt)}` : "Awaiting self review"} />
        <RatingPanel title="Manager Rating" rating={review.managerRating} subtitle={review.completedAt ? `Completed ${formatDateTime(review.completedAt)}` : "Awaiting manager review"} />
      </section>

      <DetailSection title="Satisfaction Snapshot">
        <div className="grid gap-3 sm:grid-cols-2">
          <SignalItem label="Work Environment" value={review.environmentSatisfaction} />
          <SignalItem label="Job Satisfaction" value={review.jobSatisfaction} />
          <SignalItem label="Team Relationships" value={review.relationshipSatisfaction} />
          <SignalItem label="Work-Life Balance" value={review.workLifeBalance} />
          <DetailItem label="Training Taken" value={review.trainingOpportunitiesTaken === null ? "Not set" : String(review.trainingOpportunitiesTaken)} />
          <DetailItem label="Review Date" value={formatDate(review.reviewDate)} />
        </div>
      </DetailSection>

      <DetailSection title="Narrative">
        <div className="grid gap-3 md:grid-cols-2">
          <CommentPanel title="Employee Comments" value={textValue(review.employeeComments)} />
          <CommentPanel title="Manager Comments" value={textValue(review.managerComments)} />
        </div>
        {review.reopenReason?.trim() && (
          <div className="mt-3">
            <CommentPanel title="Reopen Reason" value={review.reopenReason} tone="warning" />
          </div>
        )}
      </DetailSection>

      <DetailSection title="Timeline">
        <div className="grid gap-3 sm:grid-cols-3">
          <TimelineItem label="Submitted" value={formatDateTime(review.submittedAt)} active={review.submittedAt !== null} />
          <TimelineItem label="Completed" value={formatDateTime(review.completedAt)} active={review.completedAt !== null} />
          <TimelineItem label="Reopened" value={formatDateTime(review.reopenedAt)} active={review.reopenedAt !== null} />
        </div>
      </DetailSection>
    </div>
  );
}

function DetailItem({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={multiline ? "mt-2 whitespace-pre-wrap text-sm leading-6" : "mt-1 break-words text-sm font-semibold"}>
        {value}
      </p>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-muted/20 p-4">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      {children}
    </section>
  );
}

function HeaderFact({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10">
        <Icon className="h-4 w-4 text-slate-200" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="truncate text-sm font-medium text-white">{value}</p>
      </div>
    </div>
  );
}

function RatingPanel({ title, rating, subtitle }: { title: string; rating: PerformanceRating | null; subtitle: string }) {
  return (
    <div className={cn("rounded-lg border p-4", rating ? ratingTone[rating] : "border-border bg-background")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-lg font-semibold">{enumLabel(rating, ratingLabel)}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-background/70">
          <Star className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function SignalItem({ label, value }: { label: string; value: SatisfactionLevel | null }) {
  return (
    <div className={cn("rounded-lg border p-3", value ? satisfactionTone[value] : "border-border bg-background")}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{enumLabel(value, satisfactionLabel)}</p>
    </div>
  );
}

function CommentPanel({ title, value, tone = "default" }: { title: string; value: string; tone?: "default" | "warning" }) {
  return (
    <div className={cn("rounded-lg border bg-background p-4", tone === "warning" && "border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20")}>
      <div className="mb-3 flex items-center gap-2">
        <MessageSquareText className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{value}</p>
    </div>
  );
}

function TimelineItem({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", active ? "bg-emerald-500" : "bg-muted-foreground/30")} />
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{value}</p>
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
