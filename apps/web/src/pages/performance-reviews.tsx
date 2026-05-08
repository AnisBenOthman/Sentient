import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { useAuth } from "@/components/providers/auth-provider";
import { getEmployees } from "@/lib/api/hr-core";

type PerformanceRating =
  | "EXCEPTIONAL"
  | "EXCEEDS_EXPECTATIONS"
  | "MEETS_EXPECTATIONS"
  | "NEEDS_IMPROVEMENT"
  | "UNSATISFACTORY";

const RATING_OPTIONS: { value: PerformanceRating; label: string }[] = [
  { value: "EXCEPTIONAL", label: "Exceptional" },
  { value: "EXCEEDS_EXPECTATIONS", label: "Exceeds Expectations" },
  { value: "MEETS_EXPECTATIONS", label: "Meets Expectations" },
  { value: "NEEDS_IMPROVEMENT", label: "Needs Improvement" },
  { value: "UNSATISFACTORY", label: "Unsatisfactory" },
];

const RATING_COLORS: Record<PerformanceRating, string> = {
  EXCEPTIONAL: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  EXCEEDS_EXPECTATIONS: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  MEETS_EXPECTATIONS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  NEEDS_IMPROVEMENT: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  UNSATISFACTORY: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

interface LocalReview {
  id: string;
  employeeId: string;
  employeeName: string;
  reviewerId: string;
  reviewerName: string;
  reviewDate: string;
  rating: PerformanceRating;
  comments: string;
  createdAt: string;
}

type FormState = {
  employeeId: string;
  reviewerId: string;
  reviewDate: string;
  rating: PerformanceRating | "";
  comments: string;
};

function emptyForm(defaultReviewerId = ""): FormState {
  return {
    employeeId: "",
    reviewerId: defaultReviewerId,
    reviewDate: new Date().toISOString().slice(0, 10),
    rating: "",
    comments: "",
  };
}

export default function PerformanceReviews() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [reviews, setReviews] = useState<LocalReview[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState("");

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees-all"],
    queryFn: () => getEmployees({ limit: 500 }),
    select: (res) => res.data,
  });

  const isManager =
    user?.roles.some((r) => ["MANAGER", "HR_ADMIN", "EXECUTIVE"].includes(r)) ??
    false;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
  }

  function openNew() {
    setForm(emptyForm(user?.employeeId ?? ""));
    setError("");
    setOpen(true);
  }

  function handleSubmit() {
    if (!form.employeeId || !form.reviewerId || !form.reviewDate || !form.rating || !form.comments.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    const employee = employees.find((e) => e.id === form.employeeId);
    const reviewer = employees.find((e) => e.id === form.reviewerId);
    if (!employee || !reviewer) {
      setError("Invalid employee or reviewer selection.");
      return;
    }

    const review: LocalReview = {
      id: crypto.randomUUID(),
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      reviewerId: reviewer.id,
      reviewerName: `${reviewer.firstName} ${reviewer.lastName}`,
      reviewDate: form.reviewDate,
      rating: form.rating as PerformanceRating,
      comments: form.comments.trim(),
      createdAt: new Date().toISOString(),
    };

    setReviews((prev) => [review, ...prev]);
    setOpen(false);
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
            Record structured performance reviews for employees.
          </p>
        </div>
        {isManager && (
          <Button onClick={openNew} data-testid="button-new-review">
            <Plus className="w-4 h-4 mr-2" />
            New Review
          </Button>
        )}
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
              {isManager && (
                <p className="text-sm">Click "New Review" to record the first one.</p>
              )}
            </div>
          ) : (
            <Table data-testid="table-reviews">
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Reviewer</TableHead>
                  <TableHead>Review Date</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Comments</TableHead>
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
                    <TableCell>{r.reviewerName}</TableCell>
                    <TableCell>{r.reviewDate}</TableCell>
                    <TableCell>
                      <Badge
                        className={RATING_COLORS[r.rating]}
                        variant="secondary"
                      >
                        <Star className="w-3 h-3 mr-1" />
                        {RATING_OPTIONS.find((o) => o.value === r.rating)?.label ?? r.rating}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {r.comments}
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
          className="sm:max-w-lg"
          data-testid="dialog-new-review"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>New Performance Review</DialogTitle>
            <DialogDescription>
              Record a structured evaluation for an employee.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="select-employee">
                  Employee <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.employeeId}
                  onValueChange={(v) => update("employeeId", v)}
                  disabled={loadingEmployees}
                >
                  <SelectTrigger id="select-employee" data-testid="select-employee">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.firstName} {e.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="select-reviewer">
                  Reviewer <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.reviewerId}
                  onValueChange={(v) => update("reviewerId", v)}
                  disabled={loadingEmployees}
                >
                  <SelectTrigger id="select-reviewer" data-testid="select-reviewer">
                    <SelectValue placeholder="Select reviewer" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.firstName} {e.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

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
                <Label htmlFor="select-rating">
                  Rating <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.rating}
                  onValueChange={(v) => update("rating", v as PerformanceRating)}
                >
                  <SelectTrigger id="select-rating" data-testid="select-rating">
                    <SelectValue placeholder="Select rating" />
                  </SelectTrigger>
                  <SelectContent>
                    {RATING_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
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
