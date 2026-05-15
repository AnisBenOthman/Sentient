import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPositions,
  createPosition,
  updatePosition,
  deactivatePosition,
  getPositionSkills,
  addPositionSkill,
  deletePositionSkill,
  getSkillsCatalog,
  type Position,
  type PositionSkill,
  type ProficiencyLevel,
  type SkillDomain,
  type SkillRequirementLevel,
} from "@/lib/api/hr-core";
import { useAuth } from "@/components/providers/auth-provider";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
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
import { ChevronDown, ChevronRight, Search, Briefcase, Plus, Pencil, Trash2, ShieldAlert, Key, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const POSITION_LEVELS = [
  { value: "JUNIOR", label: "Junior" },
  { value: "MEDIUM", label: "Medium" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "SENIOR_1", label: "Senior I" },
  { value: "SENIOR_2", label: "Senior II" },
  { value: "EXPERT", label: "Expert" },
];

const PROFICIENCY_LEVELS: { value: ProficiencyLevel; label: string }[] = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
  { value: "EXPERT", label: "Expert" },
];

const REQUIREMENT_LEVELS: { value: SkillRequirementLevel; label: string }[] = [
  { value: "MANDATORY", label: "Mandatory" },
  { value: "EXPECTED", label: "Expected" },
  { value: "NICE_TO_HAVE", label: "Nice to Have" },
];

const SKILL_DOMAINS: { value: SkillDomain; label: string }[] = [
  { value: "TECHNICAL", label: "Technical" },
  { value: "LEADERSHIP", label: "Leadership" },
  { value: "SOFT_SKILLS", label: "Soft Skills" },
  { value: "DOMAIN_EXPERTISE", label: "Domain Expertise" },
];

type DomainFilter = SkillDomain | "ALL";
type RequirementFilter = SkillRequirementLevel | "ALL";

const REQUIREMENT_COLORS: Record<SkillRequirementLevel, string> = {
  MANDATORY: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  EXPECTED: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
  NICE_TO_HAVE: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
};

const DOMAIN_LABELS: Record<string, string> = {
  TECHNICAL: "Technical",
  LEADERSHIP: "Leadership",
  SOFT_SKILLS: "Soft Skills",
  DOMAIN_EXPERTISE: "Domain Expertise",
};

const DOMAIN_COLORS: Record<SkillDomain, string> = {
  TECHNICAL: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300",
  LEADERSHIP: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300",
  SOFT_SKILLS: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
  DOMAIN_EXPERTISE: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
};

const LEVEL_COLORS: Record<string, string> = {
  JUNIOR: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  MEDIUM: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  SENIOR_1: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  SENIOR_2: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  EXPERT: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const RISK_COLORS: Record<string, string> = {
  LOW: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  MEDIUM: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  HIGH: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

// ── Required Skills Panel ──────────────────────────────────────────────────────
function RequiredSkillsPanel({ position, isAdmin }: { position: Position; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PositionSkill | null>(null);
  const [skillSearch, setSkillSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<DomainFilter>("ALL");
  const [requirementFilter, setRequirementFilter] = useState<RequirementFilter>("ALL");
  const [catalogDomain, setCatalogDomain] = useState<DomainFilter>("ALL");
  const [addForm, setAddForm] = useState<{
    skillId: string;
    minimumProficiency: ProficiencyLevel;
    requirementLevel: SkillRequirementLevel;
  }>({ skillId: "", minimumProficiency: "INTERMEDIATE", requirementLevel: "MANDATORY" });

  const { data: positionSkills = [], isLoading } = useQuery({
    queryKey: ["position-skills", position.id],
    queryFn: () => getPositionSkills(position.id),
  });

  const { data: catalog } = useQuery({
    queryKey: ["skills-catalog", skillSearch, catalogDomain],
    queryFn: () => getSkillsCatalog({
      search: skillSearch || undefined,
      domain: catalogDomain === "ALL" ? undefined : catalogDomain,
    }),
    enabled: addOpen,
  });

  const catalogSkills = catalog?.data ?? [];
  const existingSkillIds = new Set(positionSkills.map((ps) => ps.skillId));
  const availableSkills = catalogSkills.filter((s) => !existingSkillIds.has(s.id));
  const visiblePositionSkills = useMemo(
    () =>
      positionSkills.filter((ps) => {
        const matchesDomain = domainFilter === "ALL" || ps.skill.domain === domainFilter;
        const matchesRequirement = requirementFilter === "ALL" || ps.requirementLevel === requirementFilter;
        return matchesDomain && matchesRequirement;
      }),
    [domainFilter, positionSkills, requirementFilter],
  );
  const domainCounts = useMemo(() => {
    const counts: Record<SkillDomain, number> = {
      TECHNICAL: 0,
      LEADERSHIP: 0,
      SOFT_SKILLS: 0,
      DOMAIN_EXPERTISE: 0,
    };
    for (const ps of positionSkills) {
      if (ps.skill.domain) counts[ps.skill.domain] += 1;
    }
    return counts;
  }, [positionSkills]);
  const requirementCounts = useMemo(() => {
    const counts: Record<SkillRequirementLevel, number> = {
      MANDATORY: 0,
      EXPECTED: 0,
      NICE_TO_HAVE: 0,
    };
    for (const ps of positionSkills) {
      counts[ps.requirementLevel] += 1;
    }
    return counts;
  }, [positionSkills]);

  const addMutation = useMutation({
    mutationFn: () =>
      addPositionSkill(position.id, {
        skillId: addForm.skillId,
        minimumProficiency: addForm.minimumProficiency,
        requirementLevel: addForm.requirementLevel,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["position-skills", position.id] });
      setAddOpen(false);
      setAddForm({ skillId: "", minimumProficiency: "INTERMEDIATE", requirementLevel: "MANDATORY" });
      setSkillSearch("");
      setCatalogDomain("ALL");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (skillId: string) => deletePositionSkill(position.id, skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["position-skills", position.id] });
      setDeleteTarget(null);
    },
  });

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 px-4 pb-4 pt-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Required Skills</span>
          {positionSkills.length > 0 && (
            <Badge variant="secondary" className="text-xs">{positionSkills.length}</Badge>
          )}
        </div>
        {isAdmin && (
          <Button size="sm" className="gap-1.5 h-7 text-xs bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-sm hover:shadow-md transition-all duration-200" onClick={() => setAddOpen(true)}>
            <Plus className="w-3 h-3" />
            Add Skill
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground py-2">Loading…</p>
      ) : positionSkills.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 italic">No required skills defined for this position.</p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={domainFilter === "ALL" ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setDomainFilter("ALL")}
              >
                All domains
              </Button>
              {SKILL_DOMAINS.map((domain) => (
                <Button
                  key={domain.value}
                  type="button"
                  size="sm"
                  variant={domainFilter === domain.value ? "default" : "outline"}
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => setDomainFilter(domain.value)}
                >
                  {domain.label}
                  <span className="text-[10px] opacity-70">{domainCounts[domain.value]}</span>
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 border-t pt-3 dark:border-gray-700">
              <Button
                type="button"
                size="sm"
                variant={requirementFilter === "ALL" ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setRequirementFilter("ALL")}
              >
                All requirements
              </Button>
              {REQUIREMENT_LEVELS.map((level) => (
                <Button
                  key={level.value}
                  type="button"
                  size="sm"
                  variant={requirementFilter === level.value ? "default" : "outline"}
                  className={cn("h-7 gap-1.5 border text-xs", requirementFilter !== level.value && REQUIREMENT_COLORS[level.value])}
                  onClick={() => setRequirementFilter(level.value)}
                >
                  {level.label}
                  <span className="text-[10px] opacity-70">{requirementCounts[level.value]}</span>
                </Button>
              ))}
            </div>
          </div>

          {visiblePositionSkills.length === 0 ? (
            <p className="rounded-md border border-dashed py-5 text-center text-xs text-muted-foreground">
              No skills match the selected filters.
            </p>
          ) : visiblePositionSkills.map((ps) => (
            <div
              key={ps.id}
              className="grid gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-center"
            >
              <div className="flex-1 min-w-0">
                <span className="block truncate text-sm font-medium">{ps.skill.name}</span>
                <span className="text-xs text-muted-foreground">{ps.skill.category ?? "Uncategorized"}</span>
              </div>
              {ps.skill.domain && (
                <span className={cn("w-fit rounded-full border px-2 py-0.5 text-[11px] font-medium", DOMAIN_COLORS[ps.skill.domain])}>
                  {DOMAIN_LABELS[ps.skill.domain] ?? ps.skill.domain}
                </span>
              )}
              <span className={cn("w-fit rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide", REQUIREMENT_COLORS[ps.requirementLevel])}>
                Requirement: {REQUIREMENT_LEVELS.find((r) => r.value === ps.requirementLevel)?.label ?? ps.requirementLevel}
              </span>
              <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Proficiency: {PROFICIENCY_LEVELS.find((p) => p.value === ps.minimumProficiency)?.label ?? ps.minimumProficiency}
              </span>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
                  onClick={() => setDeleteTarget(ps)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add skill dialog */}
      <Dialog open={addOpen} onOpenChange={(v) => { if (!v) { setAddOpen(false); setSkillSearch(""); setCatalogDomain("ALL"); } }}>
        <DialogContent className="sm:max-w-lg" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Add Required Skill — {position.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Skill</Label>
              <Select
                value={catalogDomain}
                onValueChange={(v) => {
                  setCatalogDomain(v as DomainFilter);
                  setAddForm((f) => ({ ...f, skillId: "" }));
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Filter by domain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All domains</SelectItem>
                  {SKILL_DOMAINS.map((domain) => (
                    <SelectItem key={domain.value} value={domain.value}>{domain.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search skills…"
                  className="pl-8 text-sm"
                  value={skillSearch}
                  onChange={(e) => { setSkillSearch(e.target.value); setAddForm((f) => ({ ...f, skillId: "" })); }}
                />
              </div>
              {availableSkills.length === 0 ? (
                <p className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
                  No available skills match this domain or search.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {availableSkills.map((skill) => (
                    <button
                      key={skill.id}
                      type="button"
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors",
                        addForm.skillId === skill.id && "bg-indigo-50 dark:bg-indigo-900/20 font-medium",
                      )}
                      onClick={() => setAddForm((f) => ({ ...f, skillId: skill.id }))}
                    >
                      <span className="block font-medium">{skill.name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {skill.domain && (
                          <span className={cn("rounded-full border px-1.5 py-0.5", DOMAIN_COLORS[skill.domain])}>
                            {DOMAIN_LABELS[skill.domain] ?? skill.domain}
                          </span>
                        )}
                        {skill.category && <span>{skill.category}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Minimum Proficiency</Label>
              <Select
                value={addForm.minimumProficiency}
                onValueChange={(v) => setAddForm((f) => ({ ...f, minimumProficiency: v as ProficiencyLevel }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROFICIENCY_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Requirement Level</Label>
              <Select
                value={addForm.requirementLevel}
                onValueChange={(v) => setAddForm((f) => ({ ...f, requirementLevel: v as SkillRequirementLevel }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUIREMENT_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setSkillSearch(""); setCatalogDomain("ALL"); }}>Cancel</Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!addForm.skillId || addMutation.isPending}
            >
              {addMutation.isPending ? "Adding…" : "Add Skill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{deleteTarget?.skill.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This skill requirement will be removed from the position profile. Existing employees won't be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.skillId); }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Position Form ─────────────────────────────────────────────────────────────
type PosForm = {
  title: string;
  level: string;
  isKeyPosition: boolean;
  hasSuccessor: boolean;
};

function emptyForm(): PosForm {
  return { title: "", level: "", isKeyPosition: false, hasSuccessor: false };
}

function formFromPosition(p: Position): PosForm {
  return {
    title: p.title,
    level: p.level ?? "",
    isKeyPosition: p.isKeyPosition,
    hasSuccessor: p.hasSuccessor,
  };
}

function PositionDialog({
  open,
  onClose,
  onSave,
  initial,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (f: PosForm) => void;
  initial: PosForm;
  saving?: boolean;
}) {
  const [form, setForm] = useState<PosForm>(initial);
  const [error, setError] = useState("");

  function handleSave() {
    if (!form.title.trim()) { setError("Title is required."); return; }
    onSave({ ...form, title: form.title.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{initial.title ? "Edit Position" : "Add Position"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pos-title">Title</Label>
            <Input
              id="pos-title"
              value={form.title}
              onChange={(e) => { setForm((p) => ({ ...p, title: e.target.value })); setError(""); }}
              placeholder="e.g. Software Engineer"
              data-testid="input-pos-title"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pos-level">Level</Label>
            <Select
              value={form.level}
              onValueChange={(v) => setForm((p) => ({ ...p, level: v }))}
            >
              <SelectTrigger id="pos-level" data-testid="select-pos-level">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {POSITION_LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Key position</p>
              <p className="text-xs text-muted-foreground">Critical to business continuity</p>
            </div>
            <Switch
              checked={form.isKeyPosition}
              onCheckedChange={(v) => setForm((p) => ({ ...p, isKeyPosition: v }))}
              data-testid="switch-pos-key"
            />
          </div>

          {form.isKeyPosition && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Successor identified</p>
                <p className="text-xs text-muted-foreground">A designated successor has been named</p>
              </div>
              <Switch
                checked={form.hasSuccessor}
                onCheckedChange={(v) => setForm((p) => ({ ...p, hasSuccessor: v }))}
                data-testid="switch-pos-successor"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500" data-testid="pos-form-error">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="button-save-pos">
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function Positions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Position | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Position | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isAdmin = user?.roles.includes("HR_ADMIN") ?? false;

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["positions"],
    queryFn: getPositions,
  });

  const createMutation = useMutation({
    mutationFn: createPosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Parameters<typeof updatePosition>[1] }) =>
      updatePosition(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deactivatePosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setDeleteTarget(null);
    },
  });

  const filtered = positions.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()),
  );

  const initForm = editTarget ? formFromPosition(editTarget) : emptyForm();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  function openAdd() { setEditTarget(null); setDialogOpen(true); }
  function openEdit(p: Position) { setEditTarget(p); setDialogOpen(true); }

  function handleSave(f: PosForm) {
    if (editTarget) {
      updateMutation.mutate({
        id: editTarget.id,
        dto: {
          title: f.title,
          level: f.level || undefined,
          isKeyPosition: f.isKeyPosition,
          hasSuccessor: f.hasSuccessor,
        },
      });
    } else {
      createMutation.mutate({
        title: f.title,
        level: f.level || undefined,
        isKeyPosition: f.isKeyPosition,
        hasSuccessor: f.hasSuccessor,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100"
            data-testid="heading-positions"
          >
            Positions
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage job positions and their seniority levels
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openAdd} className="gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-sm hover:shadow-md transition-all duration-200" data-testid="button-add-position">
            <Plus className="w-4 h-4" />
            Add Position
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search positions…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-positions"
        />
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Total", value: positions.length },
          { label: "Key positions", value: positions.filter((p) => p.isKeyPosition).length },
          { label: "No successor", value: positions.filter((p) => p.isKeyPosition && !p.hasSuccessor).length },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
          >
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Flags</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((pos) => (
                  <React.Fragment key={pos.id}>
                    <TableRow
                      data-testid={`row-pos-${pos.id}`}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => setExpandedId(expandedId === pos.id ? null : pos.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {expandedId === pos.id
                            ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          }
                          <Briefcase className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium text-sm">{pos.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {pos.level ? (
                          <span
                            className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded-full",
                              LEVEL_COLORS[pos.level] ?? "bg-gray-100 text-gray-600",
                            )}
                          >
                            {POSITION_LEVELS.find((l) => l.value === pos.level)?.label ?? pos.level}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {pos.isKeyPosition && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs gap-1",
                                pos.keyPositionRisk
                                  ? RISK_COLORS[pos.keyPositionRisk]
                                  : "bg-amber-100 text-amber-700 border-amber-200",
                              )}
                            >
                              <Key className="w-3 h-3" />
                              Key
                              {pos.keyPositionRisk && ` · ${pos.keyPositionRisk.charAt(0)}${pos.keyPositionRisk.slice(1).toLowerCase()} risk`}
                            </Badge>
                          )}
                          {pos.isKeyPosition && !pos.hasSuccessor && (
                            <Badge
                              variant="outline"
                              className="text-xs gap-1 bg-red-50 text-red-600 border-red-200"
                            >
                              <ShieldAlert className="w-3 h-3" />
                              No successor
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(pos)}
                              data-testid={`button-edit-pos-${pos.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => setDeleteTarget(pos)}
                              data-testid={`button-delete-pos-${pos.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                    {expandedId === pos.id && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={isAdmin ? 4 : 3} className="p-0">
                          <RequiredSkillsPanel position={pos} isAdmin={isAdmin} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 4 : 3} className="text-center text-sm text-muted-foreground py-8">
                      {search ? "No positions match your search." : "No positions configured."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PositionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        initial={initForm}
        saving={isSaving}
        key={editTarget?.id ?? "new"}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This position will be marked inactive. Employees currently assigned to this
              position will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-pos"
            >
              {deleteMutation.isPending ? "Deactivating…" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
