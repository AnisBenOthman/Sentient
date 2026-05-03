import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Pencil, Trash2, Check, X, Plus, Building2, Layers, Users } from "lucide-react";
import {
  useOrgStructure,
  addBusinessUnit,
  renameBusinessUnit,
  deleteBusinessUnit,
  getBusinessUnitChildCounts,
  addDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentChildCounts,
  addTeam,
  updateTeam,
  deleteTeam,
  type BusinessUnit,
  type Department,
  type Team,
} from "@/lib/org-structure-store";

type ConfirmTarget =
  | { kind: "bu"; id: string; name: string; depts: number; teams: number }
  | { kind: "dept"; id: string; name: string; teams: number }
  | { kind: "team"; id: string; name: string };

export default function OrgStructureCard() {
  const { businessUnits, departments, teams } = useOrgStructure();

  // ---- Add forms state ----
  const [newBuName, setNewBuName] = useState("");
  const [newBuError, setNewBuError] = useState<string | null>(null);

  const [showAddDept, setShowAddDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptBuId, setNewDeptBuId] = useState("");
  const [newDeptError, setNewDeptError] = useState<string | null>(null);

  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDeptId, setNewTeamDeptId] = useState("");
  const [newTeamError, setNewTeamError] = useState<string | null>(null);

  // ---- Rename / inline edit state ----
  const [editingBuId, setEditingBuId] = useState<string | null>(null);
  const [editingBuName, setEditingBuName] = useState("");
  const [editingBuError, setEditingBuError] = useState<string | null>(null);

  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editingDeptName, setEditingDeptName] = useState("");
  const [editingDeptBuId, setEditingDeptBuId] = useState("");
  const [editingDeptError, setEditingDeptError] = useState<string | null>(null);

  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState("");
  const [editingTeamDeptId, setEditingTeamDeptId] = useState("");
  const [editingTeamError, setEditingTeamError] = useState<string | null>(null);

  // ---- Confirm delete dialog ----
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);

  const buById = useMemo(
    () => new Map(businessUnits.map((bu) => [bu.id, bu])),
    [businessUnits]
  );
  const deptById = useMemo(
    () => new Map(departments.map((d) => [d.id, d])),
    [departments]
  );

  // ---------- BU handlers ----------
  function handleAddBu() {
    const err = addBusinessUnit(newBuName);
    if (err) {
      setNewBuError(err);
      return;
    }
    setNewBuName("");
    setNewBuError(null);
  }

  function startEditBu(bu: BusinessUnit) {
    setEditingBuId(bu.id);
    setEditingBuName(bu.name);
    setEditingBuError(null);
  }

  function saveEditBu() {
    if (!editingBuId) return;
    const err = renameBusinessUnit(editingBuId, editingBuName);
    if (err) {
      setEditingBuError(err);
      return;
    }
    setEditingBuId(null);
    setEditingBuName("");
    setEditingBuError(null);
  }

  function requestDeleteBu(bu: BusinessUnit) {
    const counts = getBusinessUnitChildCounts(bu.id);
    if (counts.departments === 0 && counts.teams === 0) {
      deleteBusinessUnit(bu.id);
      return;
    }
    setConfirmTarget({
      kind: "bu",
      id: bu.id,
      name: bu.name,
      depts: counts.departments,
      teams: counts.teams,
    });
  }

  // ---------- Department handlers ----------
  function handleAddDept() {
    const err = addDepartment(newDeptName, newDeptBuId);
    if (err) {
      setNewDeptError(err);
      return;
    }
    setNewDeptName("");
    setNewDeptBuId("");
    setNewDeptError(null);
    setShowAddDept(false);
  }

  function startEditDept(d: Department) {
    setEditingDeptId(d.id);
    setEditingDeptName(d.name);
    setEditingDeptBuId(d.buId);
    setEditingDeptError(null);
  }

  function saveEditDept() {
    if (!editingDeptId) return;
    const err = updateDepartment(editingDeptId, {
      name: editingDeptName,
      buId: editingDeptBuId,
    });
    if (err) {
      setEditingDeptError(err);
      return;
    }
    setEditingDeptId(null);
    setEditingDeptError(null);
  }

  function requestDeleteDept(d: Department) {
    const counts = getDepartmentChildCounts(d.id);
    if (counts.teams === 0) {
      deleteDepartment(d.id);
      return;
    }
    setConfirmTarget({
      kind: "dept",
      id: d.id,
      name: d.name,
      teams: counts.teams,
    });
  }

  // ---------- Team handlers ----------
  function handleAddTeam() {
    const err = addTeam(newTeamName, newTeamDeptId);
    if (err) {
      setNewTeamError(err);
      return;
    }
    setNewTeamName("");
    setNewTeamDeptId("");
    setNewTeamError(null);
    setShowAddTeam(false);
  }

  function startEditTeam(t: Team) {
    setEditingTeamId(t.id);
    setEditingTeamName(t.name);
    setEditingTeamDeptId(t.departmentId);
    setEditingTeamError(null);
  }

  function saveEditTeam() {
    if (!editingTeamId) return;
    const err = updateTeam(editingTeamId, {
      name: editingTeamName,
      departmentId: editingTeamDeptId,
    });
    if (err) {
      setEditingTeamError(err);
      return;
    }
    setEditingTeamId(null);
    setEditingTeamError(null);
  }

  function requestDeleteTeam(t: Team) {
    setConfirmTarget({ kind: "team", id: t.id, name: t.name });
  }

  function confirmDelete() {
    if (!confirmTarget) return;
    if (confirmTarget.kind === "bu") deleteBusinessUnit(confirmTarget.id);
    else if (confirmTarget.kind === "dept") deleteDepartment(confirmTarget.id);
    else if (confirmTarget.kind === "team") deleteTeam(confirmTarget.id);
    setConfirmTarget(null);
  }

  return (
    <Card data-testid="card-org-structure">
      <CardHeader>
        <CardTitle>Organization Structure</CardTitle>
        <CardDescription>
          Manage your Business Units (locations / subsidiaries, e.g. Paris HQ or
          Tunis subsidiary), Departments, and Teams. Each Department belongs to
          one Business Unit — so the same function (e.g. Engineering) in two
          locations is two separate Departments. Teams belong to a Department.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* ---------------- Business Units ---------------- */}
        <section className="space-y-3" data-testid="section-business-units">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-500" />
              <h3 className="text-base font-semibold">Business Units</h3>
              <span className="text-xs text-muted-foreground">
                ({businessUnits.length})
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {businessUnits.map((bu) => {
              const isEditing = editingBuId === bu.id;
              return (
                <div
                  key={bu.id}
                  className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
                  data-testid={`row-bu-${bu.id}`}
                >
                  {isEditing ? (
                    <>
                      <Input
                        value={editingBuName}
                        onChange={(e) => {
                          setEditingBuName(e.target.value);
                          setEditingBuError(null);
                        }}
                        className="h-8"
                        autoFocus
                        data-testid={`input-edit-bu-${bu.id}`}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={saveEditBu}
                        data-testid={`button-save-bu-${bu.id}`}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingBuId(null);
                          setEditingBuError(null);
                        }}
                        data-testid={`button-cancel-bu-${bu.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium">{bu.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditBu(bu)}
                        data-testid={`button-edit-bu-${bu.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => requestDeleteBu(bu)}
                        data-testid={`button-delete-bu-${bu.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
            {editingBuId && editingBuError && (
              <p className="text-xs text-red-500" data-testid="error-edit-bu">
                {editingBuError}
              </p>
            )}
            {businessUnits.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No business units yet. Add one below.
              </p>
            )}
          </div>

          <div className="flex items-start gap-2 pt-1">
            <div className="flex-1 space-y-1">
              <Input
                placeholder="New business unit name"
                value={newBuName}
                onChange={(e) => {
                  setNewBuName(e.target.value);
                  setNewBuError(null);
                }}
                className="h-9"
                data-testid="input-new-bu"
              />
              {newBuError && (
                <p className="text-xs text-red-500" data-testid="error-new-bu">
                  {newBuError}
                </p>
              )}
            </div>
            <Button
              onClick={handleAddBu}
              size="sm"
              className="gap-1"
              data-testid="button-add-bu"
            >
              <Plus className="h-4 w-4" />
              Add Business Unit
            </Button>
          </div>
        </section>

        <Separator />

        {/* ---------------- Departments ---------------- */}
        <section className="space-y-3" data-testid="section-departments">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-amber-500" />
              <h3 className="text-base font-semibold">Departments</h3>
              <span className="text-xs text-muted-foreground">
                ({departments.length})
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => {
                setShowAddDept((v) => !v);
                setNewDeptError(null);
              }}
              data-testid="button-toggle-add-dept"
            >
              <Plus className="h-4 w-4" />
              Add Department
            </Button>
          </div>

          {showAddDept && (
            <div
              className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-start rounded-md border border-dashed p-3"
              data-testid="form-add-dept"
            >
              <div className="space-y-1">
                <Label className="text-xs">Department name</Label>
                <Input
                  placeholder="e.g. Customer Success"
                  value={newDeptName}
                  onChange={(e) => {
                    setNewDeptName(e.target.value);
                    setNewDeptError(null);
                  }}
                  className="h-9"
                  data-testid="input-new-dept-name"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Business Unit *</Label>
                <Select
                  value={newDeptBuId}
                  onValueChange={(v) => {
                    setNewDeptBuId(v);
                    setNewDeptError(null);
                  }}
                >
                  <SelectTrigger className="h-9" data-testid="select-new-dept-bu">
                    <SelectValue placeholder="Select Business Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessUnits.map((bu) => (
                      <SelectItem key={bu.id} value={bu.id}>
                        {bu.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 sm:pt-5">
                <Button size="sm" onClick={handleAddDept} data-testid="button-submit-dept">
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowAddDept(false);
                    setNewDeptError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
              {newDeptError && (
                <p
                  className="text-xs text-red-500 sm:col-span-3"
                  data-testid="error-new-dept"
                >
                  {newDeptError}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            {departments.map((d) => {
              const isEditing = editingDeptId === d.id;
              const bu = buById.get(d.buId);
              return (
                <div
                  key={d.id}
                  className="rounded-md border bg-card px-3 py-2"
                  data-testid={`row-dept-${d.id}`}
                >
                  {isEditing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <Input
                        value={editingDeptName}
                        onChange={(e) => {
                          setEditingDeptName(e.target.value);
                          setEditingDeptError(null);
                        }}
                        className="h-8"
                        data-testid={`input-edit-dept-${d.id}`}
                      />
                      <Select
                        value={editingDeptBuId}
                        onValueChange={(v) => {
                          setEditingDeptBuId(v);
                          setEditingDeptError(null);
                        }}
                      >
                        <SelectTrigger
                          className="h-8"
                          data-testid={`select-edit-dept-bu-${d.id}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {businessUnits.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={saveEditDept}
                          data-testid={`button-save-dept-${d.id}`}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingDeptId(null);
                            setEditingDeptError(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {editingDeptError && (
                        <p
                          className="text-xs text-red-500 sm:col-span-3"
                          data-testid={`error-edit-dept-${d.id}`}
                        >
                          {editingDeptError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{d.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {bu ? bu.name : "Unassigned BU"}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditDept(d)}
                        data-testid={`button-edit-dept-${d.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => requestDeleteDept(d)}
                        data-testid={`button-delete-dept-${d.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {departments.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No departments yet. Add one above.
              </p>
            )}
          </div>
        </section>

        <Separator />

        {/* ---------------- Teams ---------------- */}
        <section className="space-y-3" data-testid="section-teams">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-500" />
              <h3 className="text-base font-semibold">Teams</h3>
              <span className="text-xs text-muted-foreground">
                ({teams.length})
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => {
                setShowAddTeam((v) => !v);
                setNewTeamError(null);
              }}
              disabled={departments.length === 0}
              data-testid="button-toggle-add-team"
            >
              <Plus className="h-4 w-4" />
              Add Team
            </Button>
          </div>

          {showAddTeam && (
            <div
              className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-start rounded-md border border-dashed p-3"
              data-testid="form-add-team"
            >
              <div className="space-y-1">
                <Label className="text-xs">Team name</Label>
                <Input
                  placeholder="e.g. Platform Engineering"
                  value={newTeamName}
                  onChange={(e) => {
                    setNewTeamName(e.target.value);
                    setNewTeamError(null);
                  }}
                  className="h-9"
                  data-testid="input-new-team-name"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Department *</Label>
                <Select
                  value={newTeamDeptId}
                  onValueChange={(v) => {
                    setNewTeamDeptId(v);
                    setNewTeamError(null);
                  }}
                >
                  <SelectTrigger className="h-9" data-testid="select-new-team-dept">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => {
                      const bu = buById.get(d.buId);
                      return (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                          {bu ? ` — ${bu.name}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {newTeamDeptId && (
                  <p className="text-xs text-muted-foreground">
                    Business Unit:{" "}
                    {buById.get(deptById.get(newTeamDeptId)?.buId ?? "")?.name ??
                      "—"}
                  </p>
                )}
              </div>
              <div className="flex gap-2 sm:pt-5">
                <Button size="sm" onClick={handleAddTeam} data-testid="button-submit-team">
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowAddTeam(false);
                    setNewTeamError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
              {newTeamError && (
                <p
                  className="text-xs text-red-500 sm:col-span-3"
                  data-testid="error-new-team"
                >
                  {newTeamError}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            {teams.map((t) => {
              const isEditing = editingTeamId === t.id;
              const dept = deptById.get(t.departmentId);
              const bu = dept ? buById.get(dept.buId) : null;
              return (
                <div
                  key={t.id}
                  className="rounded-md border bg-card px-3 py-2"
                  data-testid={`row-team-${t.id}`}
                >
                  {isEditing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <Input
                        value={editingTeamName}
                        onChange={(e) => {
                          setEditingTeamName(e.target.value);
                          setEditingTeamError(null);
                        }}
                        className="h-8"
                        data-testid={`input-edit-team-${t.id}`}
                      />
                      <Select
                        value={editingTeamDeptId}
                        onValueChange={(v) => {
                          setEditingTeamDeptId(v);
                          setEditingTeamError(null);
                        }}
                      >
                        <SelectTrigger
                          className="h-8"
                          data-testid={`select-edit-team-dept-${t.id}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => {
                            const b = buById.get(d.buId);
                            return (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                                {b ? ` — ${b.name}` : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={saveEditTeam}
                          data-testid={`button-save-team-${t.id}`}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingTeamId(null);
                            setEditingTeamError(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {editingTeamError && (
                        <p
                          className="text-xs text-red-500 sm:col-span-3"
                          data-testid={`error-edit-team-${t.id}`}
                        >
                          {editingTeamError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {dept ? dept.name : "Unassigned department"}
                          {bu ? ` · ${bu.name}` : ""}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditTeam(t)}
                        data-testid={`button-edit-team-${t.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => requestDeleteTeam(t)}
                        data-testid={`button-delete-team-${t.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {teams.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No teams yet. Add one above.
              </p>
            )}
          </div>
        </section>
      </CardContent>

      {/* ---- Cascade-delete confirm dialog ---- */}
      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent data-testid="dialog-confirm-delete-org">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete{" "}
              {confirmTarget?.kind === "bu"
                ? "Business Unit"
                : confirmTarget?.kind === "dept"
                ? "Department"
                : "Team"}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.kind === "bu" && (
                <>
                  Deleting <strong>{confirmTarget.name}</strong> will also
                  permanently remove its{" "}
                  {confirmTarget.depts} department
                  {confirmTarget.depts === 1 ? "" : "s"}
                  {confirmTarget.teams > 0
                    ? ` and ${confirmTarget.teams} team${
                        confirmTarget.teams === 1 ? "" : "s"
                      }`
                    : ""}
                  . This cannot be undone.
                </>
              )}
              {confirmTarget?.kind === "dept" && (
                <>
                  Deleting <strong>{confirmTarget.name}</strong> will also
                  permanently remove its {confirmTarget.teams} team
                  {confirmTarget.teams === 1 ? "" : "s"}. This cannot be undone.
                </>
              )}
              {confirmTarget?.kind === "team" && (
                <>
                  Are you sure you want to delete{" "}
                  <strong>{confirmTarget.name}</strong>?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-org">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              data-testid="button-confirm-delete-org"
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
