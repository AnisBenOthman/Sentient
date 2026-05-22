import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Megaphone,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  Plus,
  Building2,
  Users,
  Globe,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  pinAnnouncement,
  extractApiError,
  ANNOUNCEMENT_ERROR_MESSAGES,
  type AnnouncementResponse,
  type CreateAnnouncementDto,
  type UpdateAnnouncementDto,
} from "@/lib/api/social";

type AudienceValue = "COMPANY" | "DEPARTMENT" | "TEAM";

function audienceLabel(audience: AudienceValue): string {
  if (audience === "COMPANY") return "Company-wide";
  if (audience === "DEPARTMENT") return "Department";
  return "Team";
}

function AudienceIcon({ audience }: { audience: AudienceValue }) {
  if (audience === "COMPANY") return <Globe className="h-3.5 w-3.5" />;
  if (audience === "DEPARTMENT") return <Building2 className="h-3.5 w-3.5" />;
  return <Users className="h-3.5 w-3.5" />;
}

function fmtDate(iso: string): string {
  return format(new Date(iso), "dd MMM yyyy, HH:mm");
}

function mapError(err: unknown): string {
  const code = extractApiError(err);
  return ANNOUNCEMENT_ERROR_MESSAGES[code] ?? "Failed to complete the action. Please try again.";
}

interface PublishFormState {
  title: string;
  body: string;
  audience: AudienceValue;
  targetDepartmentId: string;
  targetTeamId: string;
  expiresAt: string;
}

const EMPTY_FORM: PublishFormState = {
  title: "",
  body: "",
  audience: "COMPANY",
  targetDepartmentId: "",
  targetTeamId: "",
  expiresAt: "",
};

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isManager = user?.roles.includes("MANAGER") ?? false;
  const isHrAdmin = user?.roles.includes("HR_ADMIN") ?? false;
  const canPublish = isManager || isHrAdmin;

  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Dialog / sheet states
  const [publishOpen, setPublishOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AnnouncementResponse | null>(null);
  const [detailTarget, setDetailTarget] = useState<AnnouncementResponse | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [pinTarget, setPinTarget] = useState<AnnouncementResponse | null>(null);
  const [pinUntil, setPinUntil] = useState("");

  // Publish form
  const [form, setForm] = useState<PublishFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  // Edit form (subset)
  const [editForm, setEditForm] = useState<UpdateAnnouncementDto>({});
  const [editError, setEditError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["announcements", { page, pageSize }],
    queryFn: () => listAnnouncements({ page, pageSize }),
  });

  const createMutation = useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setPublishOpen(false);
      setForm(EMPTY_FORM);
      setFormError("");
    },
    onError: (err: unknown) => setFormError(mapError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateAnnouncementDto }) =>
      updateAnnouncement(id, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setEditTarget(null);
      setEditForm({});
      setEditError("");
    },
    onError: (err: unknown) => setEditError(mapError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAnnouncement,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setDeleteTargetId(null);
    },
    onError: (err: unknown) => {
      setDeleteTargetId(null);
      alert(mapError(err));
    },
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, pinnedUntil }: { id: string; pinnedUntil: string | null }) =>
      pinAnnouncement(id, { pinnedUntil }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setPinTarget(null);
      setPinUntil("");
    },
    onError: (err: unknown) => alert(mapError(err)),
  });

  function buildCreateDto(): CreateAnnouncementDto {
    const dto: CreateAnnouncementDto = {
      title: form.title.trim(),
      body: form.body.trim(),
      audience: form.audience,
    };
    if (form.audience === "DEPARTMENT" && form.targetDepartmentId.trim())
      dto.targetDepartmentId = form.targetDepartmentId.trim();
    if (form.audience === "TEAM" && form.targetTeamId.trim())
      dto.targetTeamId = form.targetTeamId.trim();
    if (form.expiresAt) dto.expiresAt = new Date(form.expiresAt).toISOString();
    return dto;
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  function isAuthor(ann: AnnouncementResponse): boolean {
    return !!user?.employeeId && ann.authorId === user.employeeId;
  }

  function canEdit(ann: AnnouncementResponse): boolean {
    return isAuthor(ann) || isHrAdmin;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Announcements</h1>
        </div>
        {canPublish && (
          <Button onClick={() => setPublishOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New announcement
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Megaphone className="h-10 w-10 opacity-30" />
          <p>No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((ann) => (
            <Card
              key={ann.id}
              className={`cursor-pointer transition-shadow hover:shadow-md ${
                ann.isPinned ? "border-primary/50 ring-1 ring-primary/20" : ""
              }`}
              onClick={() => setDetailTarget(ann)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{ann.title}</CardTitle>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {ann.isPinned && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Pin className="h-3 w-3" />
                        Pinned
                      </Badge>
                    )}
                    <Badge variant="outline" className="gap-1 text-xs">
                      <AudienceIcon audience={ann.audience} />
                      {audienceLabel(ann.audience)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <p className="line-clamp-2 text-sm text-muted-foreground">{ann.body}</p>
              </CardContent>
              <CardFooter
                className="flex items-center justify-between gap-2 pt-0 text-xs text-muted-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <span>
                  {ann.author
                    ? `${ann.author.firstName} ${ann.author.lastName}`
                    : ann.authorId}
                  {" · "}
                  {fmtDate(ann.publishedAt)}
                  {ann.expiresAt && ` · Expires ${fmtDate(ann.expiresAt)}`}
                </span>
                <div className="flex items-center gap-1">
                  {isHrAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      title={ann.isPinned ? "Unpin" : "Pin"}
                      onClick={() => {
                        if (ann.isPinned) {
                          pinMutation.mutate({ id: ann.id, pinnedUntil: null });
                        } else {
                          setPinTarget(ann);
                          setPinUntil("");
                        }
                      }}
                    >
                      {ann.isPinned ? (
                        <PinOff className="h-3.5 w-3.5" />
                      ) : (
                        <Pin className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                  {canEdit(ann) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      title="Edit"
                      onClick={() => {
                        setEditTarget(ann);
                        setEditForm({ title: ann.title, body: ann.body });
                        setEditError("");
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canEdit(ann) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      title="Delete"
                      onClick={() => setDeleteTargetId(ann.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Publish dialog */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pub-title">Title</Label>
              <Input
                id="pub-title"
                placeholder="Announcement title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pub-body">Body</Label>
              <Textarea
                id="pub-body"
                placeholder="Announcement details…"
                rows={4}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Audience</Label>
              <RadioGroup
                value={form.audience}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, audience: v as AudienceValue }))
                }
                className="flex gap-4"
              >
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="COMPANY" id="aud-company" />
                  <Label htmlFor="aud-company">Company-wide</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="DEPARTMENT" id="aud-dept" />
                  <Label htmlFor="aud-dept">Department</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="TEAM" id="aud-team" />
                  <Label htmlFor="aud-team">Team</Label>
                </div>
              </RadioGroup>
            </div>
            {isHrAdmin && form.audience === "DEPARTMENT" && (
              <div className="space-y-1.5">
                <Label htmlFor="pub-dept">Department ID</Label>
                <Input
                  id="pub-dept"
                  placeholder="Leave blank to use your own department"
                  value={form.targetDepartmentId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, targetDepartmentId: e.target.value }))
                  }
                />
              </div>
            )}
            {isHrAdmin && form.audience === "TEAM" && (
              <div className="space-y-1.5">
                <Label htmlFor="pub-team">Team ID</Label>
                <Input
                  id="pub-team"
                  placeholder="Leave blank to use your own team"
                  value={form.targetTeamId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, targetTeamId: e.target.value }))
                  }
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="pub-expires">Expires at (optional)</Label>
              <Input
                id="pub-expires"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate(buildCreateDto())}
            >
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) { setEditTarget(null); setEditError(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editForm.title ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-body">Body</Label>
              <Textarea
                id="edit-body"
                rows={4}
                value={editForm.body ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))}
              />
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={updateMutation.isPending}
              onClick={() => {
                if (editTarget) updateMutation.mutate({ id: editTarget.id, dto: editForm });
              }}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pin dialog */}
      <Dialog open={!!pinTarget} onOpenChange={(o) => { if (!o) { setPinTarget(null); setPinUntil(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pin announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="pin-until">Pin until</Label>
            <Input
              id="pin-until"
              type="datetime-local"
              value={pinUntil}
              onChange={(e) => setPinUntil(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={pinMutation.isPending || !pinUntil}
              onClick={() => {
                if (pinTarget && pinUntil)
                  pinMutation.mutate({
                    id: pinTarget.id,
                    pinnedUntil: new Date(pinUntil).toISOString(),
                  });
              }}
            >
              Pin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(o) => { if (!o) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The announcement will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTargetId) deleteMutation.mutate(deleteTargetId);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail sheet */}
      <Sheet open={!!detailTarget} onOpenChange={(o) => { if (!o) setDetailTarget(null); }}>
        <SheetContent className="w-full max-w-xl overflow-y-auto sm:max-w-xl">
          {detailTarget && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>{detailTarget.title}</SheetTitle>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {detailTarget.isPinned && (
                    <Badge variant="secondary" className="gap-1">
                      <Pin className="h-3 w-3" />
                      Pinned
                    </Badge>
                  )}
                  <Badge variant="outline" className="gap-1">
                    <AudienceIcon audience={detailTarget.audience} />
                    {audienceLabel(detailTarget.audience)}
                  </Badge>
                  {detailTarget.expiresAt && (
                    <span className="text-xs text-muted-foreground">
                      Expires {fmtDate(detailTarget.expiresAt)}
                    </span>
                  )}
                </div>
              </SheetHeader>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{detailTarget.body}</p>
              <div className="mt-6 border-t pt-4 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium">Published by: </span>
                  {detailTarget.author
                    ? `${detailTarget.author.firstName} ${detailTarget.author.lastName}`
                    : detailTarget.authorId}
                </p>
                <p className="mt-0.5">
                  <span className="font-medium">Published: </span>
                  {fmtDate(detailTarget.publishedAt)}
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
