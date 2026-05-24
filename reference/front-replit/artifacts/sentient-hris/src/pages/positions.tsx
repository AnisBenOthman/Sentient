import { useState, useMemo, useEffect } from "react";
import { Search, Briefcase, Plus, Trash2, X, Check, ChevronRight, ChevronDown, Edit2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { currentUser } from "@/lib/mock-data";
import {
  getPositions,
  getPositionSkills,
  bulkReplacePositionSkills,
  getSkills,
  createPosition,
  updatePosition,
  deletePosition,
  type PositionWithCount,
  type PositionInput,
} from "@/lib/positions-api";
import type {
  Position,
  PositionSkill,
  PositionLevel,
  Skill,
  SkillCategory,
  RequirementLevel,
} from "@/lib/mock-data";

// ── helpers ───────────────────────────────────────────────────────────────────

const IS_HR_ADMIN = ["HR Admin", "HR_ADMIN"].includes(currentUser.role);

const DEPT_ORDER = ["Executive", "Engineering", "Marketing", "HR", "Finance", "Product"];

const DEPT_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  Executive:   { dot: "#64748b", bg: "#f8fafc", text: "#475569" },
  Engineering: { dot: "#2563eb", bg: "#eff6ff", text: "#1d4ed8" },
  Marketing:   { dot: "#db2777", bg: "#fdf2f8", text: "#be185d" },
  HR:          { dot: "#d97706", bg: "#fffbeb", text: "#b45309" },
  Finance:     { dot: "#16a34a", bg: "#f0fdf4", text: "#15803d" },
  Product:     { dot: "#7c3aed", bg: "#f5f3ff", text: "#6d28d9" },
};

const LEVEL_LABELS: Record<string, string> = {
  JUNIOR: "Junior", MEDIUM: "Medium", CONFIRMED: "Confirmed",
  SENIOR_1: "Senior I", SENIOR_2: "Senior II", EXPERT: "Expert",
};

const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  JUNIOR:   { bg: "#f3f4f6", text: "#6b7280" },
  MEDIUM:   { bg: "#fff7ed", text: "#ea580c" },
  CONFIRMED:{ bg: "#eff6ff", text: "#2563eb" },
  SENIOR_1: { bg: "#f5f3ff", text: "#7c3aed" },
  SENIOR_2: { bg: "#fdf4ff", text: "#9333ea" },
  EXPERT:   { bg: "#f0fdf4", text: "#16a34a" },
};

const PROFICIENCY_LABELS = ["", "Beginner", "Developing", "Proficient", "Advanced", "Expert"];
const PROFICIENCY_COLORS = ["", "#6b7280", "#ea580c", "#2563eb", "#7c3aed", "#16a34a"];
const PROFICIENCY_BG     = ["", "#f3f4f6", "#fff7ed", "#eff6ff", "#f5f3ff", "#f0fdf4"];

const REQ_LEVEL_CONFIG: Record<RequirementLevel, { label: string; bg: string; text: string; border: string }> = {
  MANDATORY:    { label: "Mandatory",    bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
  EXPECTED:     { label: "Expected",     bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  NICE_TO_HAVE: { label: "Nice to Have", bg: "#f8fafc", text: "#64748b", border: "#e2e8f0" },
};

const CATEGORIES: SkillCategory[] = ["TECHNICAL", "LEADERSHIP", "BEHAVIORAL", "DOMAIN", "OTHER"];
const CATEGORY_LABELS: Record<SkillCategory, string> = {
  TECHNICAL: "Technical", LEADERSHIP: "Leadership",
  BEHAVIORAL: "Behavioral", DOMAIN: "Domain", OTHER: "Other",
};

function ProficiencyBar({ level, max = 4 }: { level: number; max?: number }) {
  const filled = Math.min(level, max);
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className="h-2 flex-1 rounded-sm"
          style={{
            background: i < filled ? PROFICIENCY_COLORS[level] : "#e5e7eb",
          }}
        />
      ))}
    </div>
  );
}

// ── Add Skill Modal ───────────────────────────────────────────────────────────

interface AddSkillModalProps {
  allSkills: Skill[];
  alreadyAdded: string[]; // skillIds
  onAdd: (skill: Skill, proficiency: number, requirementLevel: RequirementLevel) => void;
  onClose: () => void;
}

function AddSkillModal({ allSkills, alreadyAdded, onAdd, onClose }: AddSkillModalProps) {
  const [activeCategory, setActiveCategory] = useState<SkillCategory | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [staged, setStaged] = useState<Skill | null>(null);
  const [proficiency, setProficiency] = useState(3);
  const [requirementLevel, setRequirementLevel] = useState<RequirementLevel>("EXPECTED");

  const filtered = allSkills.filter((s) => {
    const matchesCat = activeCategory === "ALL" || s.category === activeCategory;
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Add Skill</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category filter tabs */}
        <div className="px-5 pt-4 pb-2 flex gap-1.5 flex-wrap">
          {(["ALL", ...CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
              style={activeCategory === cat
                ? { background: "#3b82f6", color: "#fff" }
                : { background: "#f1f5f9", color: "#64748b" }
              }
            >
              {cat === "ALL" ? "All" : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Search skills…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* Skill list */}
        <div className="flex-1 overflow-y-auto px-5 space-y-1 min-h-0 pb-3">
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No skills match</p>
          )}
          {filtered.map((skill) => {
            const added = alreadyAdded.includes(skill.id);
            const isStaged = staged?.id === skill.id;
            return (
              <button
                key={skill.id}
                onClick={() => !added && setStaged(isStaged ? null : skill)}
                disabled={added}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  added
                    ? "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800/30"
                    : isStaged
                    ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }`}
              >
                <span className="font-medium text-gray-700 dark:text-gray-300">{skill.name}</span>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "#f1f5f9", color: "#64748b" }}
                  >
                    {CATEGORY_LABELS[skill.category]}
                  </span>
                  {added && <Check className="w-3.5 h-3.5 text-green-500" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Staged skill configurator */}
        {staged && (
          <div className="border-t border-gray-200 dark:border-gray-800 px-5 py-4 space-y-4 bg-gray-50 dark:bg-gray-900/50">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Configure: <span className="text-blue-600 dark:text-blue-400">{staged.name}</span>
            </p>

            {/* Proficiency */}
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-medium">Required Proficiency</p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setProficiency(lvl)}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold border-2 transition-all"
                    style={proficiency === lvl
                      ? { background: PROFICIENCY_BG[lvl], color: PROFICIENCY_COLORS[lvl], borderColor: PROFICIENCY_COLORS[lvl] }
                      : { background: "transparent", color: "#9ca3af", borderColor: "#e5e7eb" }
                    }
                  >
                    {PROFICIENCY_LABELS[lvl]}
                  </button>
                ))}
              </div>
              <ProficiencyBar level={proficiency} />
            </div>

            {/* Requirement Level */}
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-medium">Requirement Level</p>
              <div className="flex gap-2">
                {(["MANDATORY", "EXPECTED", "NICE_TO_HAVE"] as const).map((rl) => {
                  const cfg = REQ_LEVEL_CONFIG[rl];
                  return (
                    <button
                      key={rl}
                      onClick={() => setRequirementLevel(rl)}
                      className="flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold border-2 transition-all"
                      style={requirementLevel === rl
                        ? { background: cfg.bg, color: cfg.text, borderColor: cfg.border }
                        : { background: "transparent", color: "#9ca3af", borderColor: "#e5e7eb" }
                      }
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              onClick={() => onAdd(staged, proficiency, requirementLevel)}
              className="w-full"
              size="sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add to Profile
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Position Form Modal (Create + Edit) ───────────────────────────────────────

interface PositionFormModalProps {
  mode: "create" | "edit";
  initial?: { title: string; level: PositionLevel; isKeyPosition: boolean };
  saving: boolean;
  error: string | null;
  onSave: (input: PositionInput) => void;
  onClose: () => void;
}

const LEVEL_OPTIONS: PositionLevel[] = ["JUNIOR", "MEDIUM", "CONFIRMED", "SENIOR_1", "SENIOR_2", "EXPERT"];

function PositionFormModal({ mode, initial, saving, error, onSave, onClose }: PositionFormModalProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [level, setLevel] = useState<PositionLevel>(initial?.level ?? "MEDIUM");
  const [isKeyPosition, setIsKeyPosition] = useState<boolean>(initial?.isKeyPosition ?? false);

  const canSave = title.trim().length > 0 && !saving;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {mode === "create" ? "New Position" : "Edit Position"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            data-testid="button-close-position-form"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Title</label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              data-testid="input-position-title"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Level</label>
            <div className="grid grid-cols-3 gap-1.5">
              {LEVEL_OPTIONS.map((lvl) => {
                const cfg = LEVEL_COLORS[lvl];
                const active = level === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevel(lvl)}
                    className="py-1.5 rounded-lg text-[11px] font-semibold border-2 transition-all"
                    style={active
                      ? { background: cfg.bg, color: cfg.text, borderColor: cfg.text }
                      : { background: "transparent", color: "#9ca3af", borderColor: "#e5e7eb" }
                    }
                    data-testid={`button-level-${lvl}`}
                  >
                    {LEVEL_LABELS[lvl]}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isKeyPosition}
              onChange={(e) => setIsKeyPosition(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
              data-testid="checkbox-key-position"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Mark as Key Position</span>
          </label>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!canSave}
            onClick={() => onSave({ title: title.trim(), level, isKeyPosition })}
            data-testid="button-save-position"
          >
            {saving ? "Saving…" : mode === "create" ? "Create Position" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteConfirmModal({
  title,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Delete this position?</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">{title}</span> will be removed and unlinked from any
            employees currently mapped to it. This cannot be undone.
          </p>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={busy}
            className="bg-red-600 hover:bg-red-700 text-white"
            data-testid="button-confirm-delete-position"
          >
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Positions Page ─────────────────────────────────────────────────────────────

export default function PositionsPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [workingSkills, setWorkingSkills] = useState<PositionSkill[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // ── async data state ────────────────────────────────────────────────────────
  const [positions, setPositions] = useState<PositionWithCount[]>([]);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [positionSkills, setPositionSkills] = useState<PositionSkill[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [saving, setSaving] = useState(false);

  // Position CRUD modal state
  const [positionForm, setPositionForm] = useState<{ mode: "create" | "edit" } | null>(null);
  const [positionFormSaving, setPositionFormSaving] = useState(false);
  const [positionFormError, setPositionFormError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Load positions + skills catalogue once
  useEffect(() => {
    setLoadingList(true);
    Promise.all([getPositions(), getSkills()])
      .then(([pos, skills]) => {
        setPositions(pos);
        setAllSkills(skills);
      })
      .catch(console.error)
      .finally(() => setLoadingList(false));
  }, []);

  // Load position skills whenever the selected position changes
  useEffect(() => {
    if (!selectedId) { setPositionSkills([]); return; }
    setLoadingSkills(true);
    getPositionSkills(selectedId)
      .then(setPositionSkills)
      .catch(console.error)
      .finally(() => setLoadingSkills(false));
  }, [selectedId]);

  const filtered = useMemo(
    () => positions.filter((p) => p.title.toLowerCase().includes(search.toLowerCase())),
    [positions, search]
  );

  // Grouped structure: dept → team → positions[]
  const groupedFiltered = useMemo(() => {
    const map: Record<string, Record<string, PositionWithCount[]>> = {};
    filtered.forEach((p) => {
      const dept = p.department ?? "Other";
      const team = p.team ?? "General";
      if (!map[dept]) map[dept] = {};
      if (!map[dept][team]) map[dept][team] = [];
      map[dept][team].push(p);
    });
    // Order departments by DEPT_ORDER, then alphabetically for unknowns
    const sortedDepts = Object.keys(map).sort((a, b) => {
      const ai = DEPT_ORDER.indexOf(a);
      const bi = DEPT_ORDER.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
    return sortedDepts.map((dept) => ({
      dept,
      teams: Object.entries(map[dept]).sort((a, b) => a[0].localeCompare(b[0])),
      total: Object.values(map[dept]).flat().length,
    }));
  }, [filtered]);

  const [collapsedDepts, setCollapsedDepts] = useState<Set<string>>(new Set());

  function toggleDept(dept: string) {
    setCollapsedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  }

  const selectedPosition = selectedId ? positions.find((p) => p.id === selectedId) ?? null : null;

  // Group view-mode skills by category
  const groupedSkills = useMemo(() => {
    const groups: Partial<Record<SkillCategory, PositionSkill[]>> = {};
    positionSkills.forEach((ps) => {
      const cat = ps.skill.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat]!.push(ps);
    });
    return groups;
  }, [positionSkills]);

  function handleSelectPosition(pos: PositionWithCount) {
    setSelectedId(pos.id);
    setEditMode(false);
    setShowAddModal(false);
  }

  function handleEnterEdit() {
    setWorkingSkills(positionSkills.map((ps) => ({ ...ps })));
    setEditMode(true);
  }

  async function handleSave() {
    if (!selectedId) return;
    setSaving(true);
    try {
      const saved = await bulkReplacePositionSkills(
        selectedId,
        workingSkills.map((ws) => ({
          skillId: ws.skillId,
          proficiency: ws.proficiency,
          requirementLevel: ws.requirementLevel,
        }))
      );
      setPositionSkills(saved);
      // Update skillCount in positions list
      setPositions((prev) =>
        prev.map((p) => p.id === selectedId ? { ...p, skillCount: saved.length } : p)
      );
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
      setEditMode(false);
      setShowAddModal(false);
    }
  }

  function handleCancel() {
    setEditMode(false);
    setShowAddModal(false);
  }

  function handleRemoveWorking(skillId: string) {
    setWorkingSkills((prev) => prev.filter((ws) => ws.skillId !== skillId));
  }

  async function handleSavePositionForm(input: PositionInput) {
    setPositionFormSaving(true);
    setPositionFormError(null);
    try {
      if (positionForm?.mode === "create") {
        const created = await createPosition(input);
        setPositions((prev) => [...prev, created]);
        setSelectedId(created.id);
      } else if (positionForm?.mode === "edit" && selectedId) {
        const updated = await updatePosition(selectedId, input);
        setPositions((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      }
      setPositionForm(null);
    } catch (err) {
      setPositionFormError((err as Error).message);
    } finally {
      setPositionFormSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!selectedId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePosition(selectedId);
      setPositions((prev) => prev.filter((p) => p.id !== selectedId));
      setSelectedId(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      setDeleteError((err as Error).message ?? "Failed to delete position");
    } finally {
      setDeleting(false);
    }
  }

  function handleAddSkill(skill: Skill, proficiency: number, requirementLevel: RequirementLevel) {
    if (!selectedId) return;
    const newItem: PositionSkill = {
      id: `${selectedId}-${skill.id}-new`,
      positionId: selectedId,
      skillId: skill.id,
      skill,
      proficiency,
      requirementLevel,
    };
    setWorkingSkills((prev) => [...prev, newItem]);
    setShowAddModal(false);
  }

  const levelCfg = (pos: Pick<PositionWithCount, "level">) => LEVEL_COLORS[pos.level] ?? LEVEL_COLORS.JUNIOR;

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-0 -m-8 overflow-hidden">
      {/* ── LEFT PANEL: Position List ─────────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Briefcase className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">Positions</h1>
            {IS_HR_ADMIN && (
              <button
                onClick={() => {
                  setPositionFormError(null);
                  setPositionForm({ mode: "create" });
                }}
                className="ml-auto p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                title="New Position"
                data-testid="button-new-position"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Search positions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
              data-testid="input-search-positions"
            />
          </div>
        </div>

        {/* Grouped list */}
        <div className="flex-1 overflow-y-auto py-1">
          {loadingList && (
            <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
          )}
          {!loadingList && filtered.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">No positions found</div>
          )}
          {!loadingList && groupedFiltered.map(({ dept, teams, total }) => {
            const collapsed = collapsedDepts.has(dept);
            const deptColor = DEPT_COLORS[dept] ?? DEPT_COLORS.Executive;
            return (
              <div key={dept}>
                {/* Department header */}
                <button
                  onClick={() => toggleDept(dept)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors group"
                >
                  {collapsed
                    ? <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    : <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  }
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: deptColor.dot }}
                  />
                  <span className="text-xs font-bold uppercase tracking-wide flex-1 truncate" style={{ color: deptColor.text }}>
                    {dept}
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: deptColor.bg, color: deptColor.text }}>
                    {total}
                  </span>
                </button>

                {/* Teams + positions */}
                {!collapsed && teams.map(([team, teamPositions]) => (
                  <div key={team}>
                    {/* Team sub-header — only if dept has >1 team */}
                    {teams.length > 1 && (
                      <div className="flex items-center gap-2 px-5 py-1.5">
                        <div className="w-3 border-t border-gray-200 dark:border-gray-700" />
                        <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap truncate">
                          {team}
                        </span>
                      </div>
                    )}

                    {/* Position rows */}
                    {teamPositions.map((pos) => {
                      const cfg = levelCfg(pos);
                      const sc = pos.skillCount;
                      const isSelected = pos.id === selectedId;
                      return (
                        <button
                          key={pos.id}
                          onClick={() => handleSelectPosition(pos)}
                          className={`w-full px-4 py-2.5 text-left flex items-start gap-3 transition-colors group ${
                            isSelected
                              ? "bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500"
                              : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          }`}
                          data-testid={`position-card-${pos.id}`}
                        >
                          <div className="flex-1 min-w-0 pl-2">
                            <p className={`text-sm font-medium truncate ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-gray-800 dark:text-gray-200"}`}>
                              {pos.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: cfg.bg, color: cfg.text }}
                              >
                                {LEVEL_LABELS[pos.level]}
                              </span>
                              <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
                                {sc} skill{sc !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 transition-colors ${isSelected ? "text-blue-500" : "text-gray-300 group-hover:text-gray-400"}`} />
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT PANEL: Skill Profile ────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
        {!selectedPosition ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Briefcase className="w-7 h-7 text-gray-300 dark:text-gray-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Select a position
            </h2>
            <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">
              Choose a position from the list to view or edit its skill profile.
            </p>
          </div>
        ) : (
          <div className="p-6 max-w-3xl">
            {/* Position header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {selectedPosition.title}
                  </h2>
                  {IS_HR_ADMIN && !editMode && (
                    <>
                      <button
                        onClick={() => {
                          setPositionFormError(null);
                          setPositionForm({ mode: "edit" });
                        }}
                        className="p-1 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        title="Edit position"
                        data-testid="button-edit-position"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete position"
                        data-testid="button-delete-position"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-semibold px-3 py-1 rounded-full"
                    style={{ background: levelCfg(selectedPosition).bg, color: levelCfg(selectedPosition).text }}
                  >
                    {LEVEL_LABELS[selectedPosition.level]}
                  </span>
                  {selectedPosition.isKeyPosition && (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                      Key Position
                    </span>
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {positionSkills.length} required skill{positionSkills.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              {IS_HR_ADMIN && !editMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEnterEdit}
                  className="gap-1.5"
                  data-testid="button-edit-profile"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Profile
                </Button>
              )}
              {editMode && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving} className="gap-1.5">
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    {saving ? "Saving…" : "Save Profile"}
                  </Button>
                </div>
              )}
            </div>

            {/* EDIT MODE */}
            {editMode ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Skills in Profile ({workingSkills.length})
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddModal(true)}
                    className="gap-1.5 text-xs h-7"
                    data-testid="button-add-skill"
                  >
                    <Plus className="w-3 h-3" />
                    Add Skill
                  </Button>
                </div>

                {workingSkills.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-8 text-center">
                    <p className="text-sm text-gray-400">No skills added yet. Click "Add Skill" to begin.</p>
                  </div>
                )}

                <div className="space-y-2">
                  {workingSkills.map((ws) => {
                    const cfg = REQ_LEVEL_CONFIG[ws.requirementLevel];
                    return (
                      <div
                        key={ws.skillId}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{ws.skill.name}</span>
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                              style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
                            >
                              {cfg.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ProficiencyBar level={ws.proficiency} />
                            <span
                              className="text-[10px] font-semibold whitespace-nowrap"
                              style={{ color: PROFICIENCY_COLORS[ws.proficiency] }}
                            >
                              {PROFICIENCY_LABELS[ws.proficiency]}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveWorking(ws.skillId)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                          title="Remove skill"
                          data-testid={`button-remove-skill-${ws.skillId}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              // VIEW MODE
              <div className="space-y-6">
                {positionSkills.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-10 text-center">
                    <p className="text-sm text-gray-400">No skills defined for this position.</p>
                    {IS_HR_ADMIN && (
                      <Button variant="outline" size="sm" onClick={handleEnterEdit} className="mt-3 gap-1.5">
                        <Edit2 className="w-3 h-3" /> Edit Profile
                      </Button>
                    )}
                  </div>
                )}

                {CATEGORIES.map((cat) => {
                  const catSkills = groupedSkills[cat];
                  if (!catSkills || catSkills.length === 0) return null;
                  return (
                    <div key={cat}>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-3">
                        {CATEGORY_LABELS[cat]}
                      </p>
                      <div className="space-y-2">
                        {catSkills.map((ps) => {
                          const cfg = REQ_LEVEL_CONFIG[ps.requirementLevel];
                          return (
                            <div
                              key={ps.skillId}
                              className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{ps.skill.name}</span>
                                  <span
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                                    style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
                                  >
                                    {cfg.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <ProficiencyBar level={ps.proficiency} />
                                  <span
                                    className="text-[10px] font-semibold whitespace-nowrap"
                                    style={{ color: PROFICIENCY_COLORS[ps.proficiency] }}
                                  >
                                    {PROFICIENCY_LABELS[ps.proficiency]}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Skill Modal */}
      {showAddModal && (
        <AddSkillModal
          allSkills={allSkills}
          alreadyAdded={workingSkills.map((ws) => ws.skillId)}
          onAdd={handleAddSkill}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Position Create / Edit Modal */}
      {positionForm && (
        <PositionFormModal
          mode={positionForm.mode}
          initial={
            positionForm.mode === "edit" && selectedPosition
              ? {
                  title: selectedPosition.title,
                  level: selectedPosition.level,
                  isKeyPosition: selectedPosition.isKeyPosition,
                }
              : undefined
          }
          saving={positionFormSaving}
          error={positionFormError}
          onSave={handleSavePositionForm}
          onClose={() => {
            setPositionForm(null);
            setPositionFormError(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedPosition && (
        <DeleteConfirmModal
          title={selectedPosition.title}
          busy={deleting}
          error={deleteError}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setShowDeleteConfirm(false);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}
