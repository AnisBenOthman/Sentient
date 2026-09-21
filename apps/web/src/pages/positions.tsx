import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { POSITION_DOMAINS, getPositionDomain, sortPositionsByLevelThenTitle } from "@/lib/position-domains";

/**
 * WHY value-only: every one of these is an enum whose wording is translated.
 * The value keys both the colour maps below and the `positions` locale entry,
 * so a label can never drift from the option it belongs to.
 */
const POSITION_LEVELS = ["JUNIOR", "MEDIUM", "CONFIRMED", "SENIOR_1", "SENIOR_2", "EXPERT"] as const;

const PROFICIENCY_LEVELS: readonly ProficiencyLevel[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];

const REQUIREMENT_LEVELS: readonly SkillRequirementLevel[] = ["MANDATORY", "EXPECTED", "NICE_TO_HAVE"];

const SKILL_DOMAINS: readonly SkillDomain[] = ["TECHNICAL", "LEADERSHIP", "SOFT_SKILLS", "DOMAIN_EXPERTISE"];

type DomainFilter = SkillDomain | "ALL";
type RequirementFilter = SkillRequirementLevel | "ALL";

const REQUIREMENT_COLORS: Record<SkillRequirementLevel, string> = {
  MANDATORY: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  EXPECTED: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
  NICE_TO_HAVE: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
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
const REQUIREMENT_RANK: Record<SkillRequirementLevel, number> = {
  MANDATORY: 0,
  EXPECTED: 1,
  NICE_TO_HAVE: 2,
};

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
  const groupedVisiblePositionSkills = useMemo(
    () =>
      SKILL_DOMAINS.map((domain) => ({
        value: domain,
        skills: visiblePositionSkills
          .filter((ps) => ps.skill.domain === domain)
          .sort((a, b) => {
            const requirementDelta = REQUIREMENT_RANK[a.requirementLevel] - REQUIREMENT_RANK[b.requirementLevel];
            if (requirementDelta !== 0) return requirementDelta;
            return a.skill.name.localeCompare(b.skill.name);
          }),
      })).filter((group) => group.skills.length > 0),
    [visiblePositionSkills],
  );

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

  const { t } = useTranslation(["positions", "common"]);
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
          <span className="text-sm font-medium text-muted-foreground">{t("skills.heading")}</span>
          {positionSkills.length > 0 && (
            <Badge variant="secondary" className="text-xs">{positionSkills.length}</Badge>
          )}
        </div>
        {isAdmin && (
          <Button size="sm" className="gap-1.5 h-7 text-xs bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-sm hover:shadow-md transition-all duration-200" onClick={() => setAddOpen(true)}>
            <Plus className="w-3 h-3" />
            {t("skills.add")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground py-2">{t("common:loading")}</p>
      ) : positionSkills.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 italic">{t("skills.empty")}</p>
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
                {t("skills.allDomains")}
              </Button>
              {SKILL_DOMAINS.map((domain) => (
                <Button
                  key={domain}
                  type="button"
                  size="sm"
                  variant={domainFilter === domain ? "default" : "outline"}
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => setDomainFilter(domain)}
                >
                  {t(`skillDomains.${domain}` as "skillDomains.TECHNICAL")}
                  <span className="text-[10px] opacity-70">{domainCounts[domain]}</span>
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
                {t("skills.allRequirements")}
              </Button>
              {REQUIREMENT_LEVELS.map((level) => (
                <Button
                  key={level}
                  type="button"
                  size="sm"
                  variant={requirementFilter === level ? "default" : "outline"}
                  className={cn("h-7 gap-1.5 border text-xs", requirementFilter !== level && REQUIREMENT_COLORS[level])}
                  onClick={() => setRequirementFilter(level)}
                >
                  {t(`requirement.${level}` as "requirement.MANDATORY")}
                  <span className="text-[10px] opacity-70">{requirementCounts[level]}</span>
                </Button>
              ))}
            </div>
          </div>

          {visiblePositionSkills.length === 0 ? (
            <p className="rounded-md border border-dashed py-5 text-center text-xs text-muted-foreground">
              {t("skills.noFilterMatch")}
            </p>
          ) : (
            <div className="space-y-3">
              {groupedVisiblePositionSkills.map((group) => (
                <section key={group.value} className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", DOMAIN_COLORS[group.value])}>
                        {t(`skillDomains.${group.value}` as "skillDomains.TECHNICAL")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t("skills.skillCount", { count: group.skills.length })}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {group.skills.map((ps) => (
                      <div
                        key={ps.id}
                        className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
                      >
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-medium">{ps.skill.name}</span>
                          <span className="text-xs text-muted-foreground">{ps.skill.category ?? t("skills.uncategorized")}</span>
                        </div>
                        <span className={cn("w-fit rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide", REQUIREMENT_COLORS[ps.requirementLevel])}>
                          {t(`requirement.${ps.requirementLevel}` as "requirement.MANDATORY", {
                            defaultValue: ps.requirementLevel,
                          })}
                        </span>
                        <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {t(`proficiency.${ps.minimumProficiency}` as "proficiency.BEGINNER", {
                            defaultValue: ps.minimumProficiency,
                          })}
                        </span>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => setDeleteTarget(ps)}
                            aria-label={t("skills.removeAria", { name: ps.skill.name })}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add skill dialog */}
      <Dialog open={addOpen} onOpenChange={(v) => { if (!v) { setAddOpen(false); setSkillSearch(""); setCatalogDomain("ALL"); } }}>
        <DialogContent className="sm:max-w-lg" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{t("skills.addTitle", { title: position.title })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("skills.skillLabel")}</Label>
              <Select
                value={catalogDomain}
                onValueChange={(v) => {
                  setCatalogDomain(v as DomainFilter);
                  setAddForm((f) => ({ ...f, skillId: "" }));
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t("skills.filterByDomain")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("skills.allDomains")}</SelectItem>
                  {SKILL_DOMAINS.map((domain) => (
                    <SelectItem key={domain} value={domain}>
                      {t(`skillDomains.${domain}` as "skillDomains.TECHNICAL")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={t("skills.searchPlaceholder")}
                  className="pl-8 text-sm"
                  value={skillSearch}
                  onChange={(e) => { setSkillSearch(e.target.value); setAddForm((f) => ({ ...f, skillId: "" })); }}
                />
              </div>
              {availableSkills.length === 0 ? (
                <p className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
                  {t("skills.noneAvailable")}
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
                            {t(`skillDomains.${skill.domain}` as "skillDomains.TECHNICAL", {
                              defaultValue: skill.domain,
                            })}
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
              <Label>{t("skills.minProficiency")}</Label>
              <Select
                value={addForm.minimumProficiency}
                onValueChange={(v) => setAddForm((f) => ({ ...f, minimumProficiency: v as ProficiencyLevel }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROFICIENCY_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {t(`proficiency.${level}` as "proficiency.BEGINNER")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("skills.requirementLevel")}</Label>
              <Select
                value={addForm.requirementLevel}
                onValueChange={(v) => setAddForm((f) => ({ ...f, requirementLevel: v as SkillRequirementLevel }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUIREMENT_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {t(`requirement.${level}` as "requirement.MANDATORY")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setSkillSearch(""); setCatalogDomain("ALL"); }}>{t("common:cancel")}</Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!addForm.skillId || addMutation.isPending}
            >
              {addMutation.isPending ? t("skills.adding") : t("skills.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("skills.removeTitle", { name: deleteTarget?.skill.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("skills.removeDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.skillId); }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t("skills.removePending") : t("skills.removeConfirm")}
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
  const { t } = useTranslation(["positions", "common"]);
  const [form, setForm] = useState<PosForm>(initial);
  const [error, setError] = useState("");

  function handleSave() {
    if (!form.title.trim()) { setError(t("dialog.errorTitleRequired")); return; }
    onSave({ ...form, title: form.title.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{initial.title ? t("dialog.editTitle") : t("dialog.createTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pos-title">{t("dialog.titleLabel")}</Label>
            <Input
              id="pos-title"
              value={form.title}
              onChange={(e) => { setForm((p) => ({ ...p, title: e.target.value })); setError(""); }}
              placeholder={t("dialog.titlePlaceholder")}
              data-testid="input-pos-title"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pos-level">{t("dialog.levelLabel")}</Label>
            <Select
              value={form.level}
              onValueChange={(v) => setForm((p) => ({ ...p, level: v }))}
            >
              <SelectTrigger id="pos-level" data-testid="select-pos-level">
                <SelectValue placeholder={t("dialog.levelPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {POSITION_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {t(`levels.${level}` as "levels.JUNIOR")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{t("dialog.keyPositionTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("dialog.keyPositionHint")}</p>
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
                <p className="text-sm font-medium">{t("dialog.successorTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("dialog.successorHint")}</p>
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
          <Button variant="outline" onClick={onClose}>{t("common:cancel")}</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="button-save-pos">
            {saving ? t("common:saving") : t("common:save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function Positions() {
  const { t } = useTranslation(["positions", "common"]);
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
  const groupedPositions = useMemo(
    () =>
      POSITION_DOMAINS.map((domain) => ({
        ...domain,
        positions: filtered
          .filter((position) => getPositionDomain(position) === domain.value)
          .sort(sortPositionsByLevelThenTitle),
      })).filter((group) => group.positions.length > 0),
    [filtered],
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
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </div>
        {isAdmin && (
          <Button onClick={openAdd} className="gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-sm hover:shadow-md transition-all duration-200" data-testid="button-add-position">
            <Plus className="w-4 h-4" />
            {t("addPosition")}
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("searchPlaceholder")}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-positions"
        />
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        {[
          { id: "total", label: t("stats.total"), value: positions.length },
          { id: "key", label: t("stats.keyPositions"), value: positions.filter((p) => p.isKeyPosition).length },
          { id: "noSuccessor", label: t("stats.noSuccessor"), value: positions.filter((p) => p.isKeyPosition && !p.hasSuccessor).length },
        ].map(({ id, label, value }) => (
          <div
            key={id}
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
            <p className="text-sm text-muted-foreground py-8 text-center">{t("common:loading")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.title")}</TableHead>
                  <TableHead>{t("table.level")}</TableHead>
                  <TableHead>{t("table.flags")}</TableHead>
                  {isAdmin && <TableHead className="text-right">{t("table.actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedPositions.flatMap((group) => group.positions.map((pos, index) => ({ group, pos, index }))).map(({ group, pos, index }) => (
                  <React.Fragment key={pos.id}>
                    {index === 0 && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={isAdmin ? 4 : 3} className="bg-gray-50 px-4 py-3 dark:bg-gray-900/40">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {t(`domains.${group.value}.label` as "domains.ENGINEERING.label")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t(`domains.${group.value}.description` as "domains.ENGINEERING.description")}
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {t("table.positionCount", { count: group.positions.length })}
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
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
                            {t(`levels.${pos.level}` as "levels.JUNIOR", { defaultValue: pos.level })}
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
                              {pos.keyPositionRisk
                                ? t("table.keyBadgeWithRisk", {
                                    risk: t(`risk.${pos.keyPositionRisk}` as "risk.LOW", {
                                      defaultValue: pos.keyPositionRisk,
                                    }),
                                  })
                                : t("table.keyBadge")}
                            </Badge>
                          )}
                          {pos.isKeyPosition && !pos.hasSuccessor && (
                            <Badge
                              variant="outline"
                              className="text-xs gap-1 bg-red-50 text-red-600 border-red-200"
                            >
                              <ShieldAlert className="w-3 h-3" />
                              {t("table.noSuccessorBadge")}
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
                              aria-label={t("table.editAria", { title: pos.title })}
                              data-testid={`button-edit-pos-${pos.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => setDeleteTarget(pos)}
                              aria-label={t("table.deactivateAria", { title: pos.title })}
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
                      {search ? t("table.noMatch") : t("table.empty")}
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
            <AlertDialogTitle>
              {t("deactivate.title", { title: deleteTarget?.title ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("deactivate.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-pos"
            >
              {deleteMutation.isPending ? t("deactivate.pending") : t("deactivate.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
