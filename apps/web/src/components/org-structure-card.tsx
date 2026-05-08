import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  getBusinessUnits,
  getDepartments,
  getTeams,
  createBusinessUnit,
  updateBusinessUnit,
  deleteBusinessUnit,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  createTeam,
  updateTeam,
  deleteTeam,
  type BusinessUnit,
  type Department,
  type Team,
} from "@/lib/api/hr-core";

type ConfirmTarget =
  | { kind: "bu"; id: string; name: string }
  | { kind: "dept"; id: string; name: string }
  | { kind: "team"; id: string; name: string };

export default function OrgStructureCard() {
  const queryClient = useQueryClient();

  const { data: businessUnits = [] } = useQuery({
    queryKey: ["business-units"],
    queryFn: getBusinessUnits,
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: getDepartments,
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: getTeams,
  });

  // ── Add forms ────────────────────────────────────────────────────────────────
  const [newBuName, setNewBuName] = useState("");
  const [newBuError, setNewBuError] = useState<string | null>(null);

  const [showAddDept, setShowAddDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptCode, setNewDeptCode] = useState("");
  const [newDeptBuId, setNewDeptBuId] = useState("");
  const [newDeptError, setNewDeptError] = useState<string | null>(null);

  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamCode, setNewTeamCode] = useState("");
  const [newTeamDeptId, setNewTeamDeptId] = useState("");
  const [newTeamError, setNewTeamError] = useState<string | null>(null);

  // ── Inline edit ──────────────────────────────────────────────────────────────
  const [editingBuId, setEditingBuId] = useState<string | null>(null);
  const [editingBuName, setEditingBuName] = useState("");

  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editingDeptName, setEditingDeptName] = useState("");
  const [editingDeptBuId, setEditingDeptBuId] = useState("");

  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState("");
  const [editingTeamDeptId, setEditingTeamDeptId] = useState("");

  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const invBu = () => queryClient.invalidateQueries({ queryKey: ["business-units"] });
  const invDept = () => queryClient.invalidateQueries({ queryKey: ["departments"] });
  const invTeam = () => queryClient.invalidateQueries({ queryKey: ["teams"] });

  const createBuMut = useMutation({
    mutationFn: createBusinessUnit,
    onSuccess: () => { invBu(); setNewBuName(""); setNewBuError(null); },
    onError: () => setNewBuError("Failed to create business unit."),
  });
  const updateBuMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Parameters<typeof updateBusinessUnit>[1] }) =>
      updateBusinessUnit(id, dto),
    onSuccess: () => { invBu(); setEditingBuId(null); },
  });
  const deleteBuMut = useMutation({
    mutationFn: deleteBusinessUnit,
    onSuccess: () => { invBu(); invDept(); invTeam(); setConfirmTarget(null); },
  });

  const createDeptMut = useMutation({
    mutationFn: createDepartment,
    onSuccess: () => { invDept(); setNewDeptName(""); setNewDeptCode(""); setNewDeptBuId(""); setShowAddDept(false); },
    onError: () => setNewDeptError("Failed to create department."),
  });
  const updateDeptMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Parameters<typeof updateDepartment>[1] }) =>
      updateDepartment(id, dto),
    onSuccess: () => { invDept(); setEditingDeptId(null); },
  });
  const deleteDeptMut = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => { invDept(); invTeam(); setConfirmTarget(null); },
  });

  const createTeamMut = useMutation({
    mutationFn: createTeam,
    onSuccess: () => { invTeam(); setNewTeamName(""); setNewTeamCode(""); setNewTeamDeptId(""); setShowAddTeam(false); },
    onError: () => setNewTeamError("Failed to create team."),
  });
  const updateTeamMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Parameters<typeof updateTeam>[1] }) =>
      updateTeam(id, dto),
    onSuccess: () => { invTeam(); setEditingTeamId(null); },
  });
  const deleteTeamMut = useMutation({
    mutationFn: deleteTeam,
    onSuccess: () => { invTeam(); setConfirmTarget(null); },
  });

  const buById = useMemo(() => new Map(businessUnits.map((bu) => [bu.id, bu])), [businessUnits]);
  const deptById = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);

  function confirmDelete() {
    if (!confirmTarget) return;
    if (confirmTarget.kind === "bu") deleteBuMut.mutate(confirmTarget.id);
    else if (confirmTarget.kind === "dept") deleteDeptMut.mutate(confirmTarget.id);
    else deleteTeamMut.mutate(confirmTarget.id);
  }

  return (
    <Card data-testid="card-org-structure">
      <CardHeader>
        <CardTitle>Organization Structure</CardTitle>
        <CardDescription>
          Manage Business Units, Departments, and Teams. Departments belong to a
          Business Unit; Teams belong to a Department.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">

        {/* ── Business Units ── */}
        <section className="space-y-3" data-testid="section-business-units">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-indigo-500" />
            <h3 className="text-base font-semibold">Business Units</h3>
            <span className="text-xs text-muted-foreground">({businessUnits.length})</span>
          </div>

          <div className="space-y-2">
            {businessUnits.map((bu) => (
              <div
                key={bu.id}
                className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
                data-testid={`row-bu-${bu.id}`}
              >
                {editingBuId === bu.id ? (
                  <>
                    <Input
                      value={editingBuName}
                      onChange={(e) => setEditingBuName(e.target.value)}
                      className="h-8"
                      autoFocus
                      data-testid={`input-edit-bu-${bu.id}`}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateBuMut.mutate({ id: bu.id, dto: { name: editingBuName } })}
                      data-testid={`button-save-bu-${bu.id}`}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingBuId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium">{bu.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setEditingBuId(bu.id); setEditingBuName(bu.name); }}
                      data-testid={`button-edit-bu-${bu.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmTarget({ kind: "bu", id: bu.id, name: bu.name })}
                      data-testid={`button-delete-bu-${bu.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </>
                )}
              </div>
            ))}
            {businessUnits.length === 0 && (
              <p className="text-sm text-muted-foreground">No business units yet. Add one below.</p>
            )}
          </div>

          <div className="flex items-start gap-2 pt-1">
            <div className="flex-1 space-y-1">
              <Input
                placeholder="New business unit name"
                value={newBuName}
                onChange={(e) => { setNewBuName(e.target.value); setNewBuError(null); }}
                className="h-9"
                data-testid="input-new-bu"
              />
              {newBuError && <p className="text-xs text-red-500" data-testid="error-new-bu">{newBuError}</p>}
            </div>
            <Button
              onClick={() => {
                if (!newBuName.trim()) { setNewBuError("Name is required."); return; }
                createBuMut.mutate({ name: newBuName.trim(), address: "" });
              }}
              size="sm"
              className="gap-1"
              disabled={createBuMut.isPending}
              data-testid="button-add-bu"
            >
              <Plus className="h-4 w-4" />
              Add Business Unit
            </Button>
          </div>
        </section>

        <Separator />

        {/* ── Departments ── */}
        <section className="space-y-3" data-testid="section-departments">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-amber-500" />
              <h3 className="text-base font-semibold">Departments</h3>
              <span className="text-xs text-muted-foreground">({departments.length})</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => { setShowAddDept((v) => !v); setNewDeptError(null); }}
              data-testid="button-toggle-add-dept"
            >
              <Plus className="h-4 w-4" /> Add Department
            </Button>
          </div>

          {showAddDept && (
            <div
              className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start rounded-md border border-dashed p-3"
              data-testid="form-add-dept"
            >
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  placeholder="e.g. Customer Success"
                  value={newDeptName}
                  onChange={(e) => { setNewDeptName(e.target.value); setNewDeptError(null); }}
                  className="h-9"
                  data-testid="input-new-dept-name"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Code</Label>
                <Input
                  placeholder="e.g. CS"
                  value={newDeptCode}
                  onChange={(e) => { setNewDeptCode(e.target.value); setNewDeptError(null); }}
                  className="h-9"
                  data-testid="input-new-dept-code"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Business Unit *</Label>
                <Select value={newDeptBuId} onValueChange={(v) => { setNewDeptBuId(v); setNewDeptError(null); }}>
                  <SelectTrigger className="h-9" data-testid="select-new-dept-bu">
                    <SelectValue placeholder="Select BU" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessUnits.map((bu) => (
                      <SelectItem key={bu.id} value={bu.id}>{bu.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 sm:pt-5">
                <Button
                  size="sm"
                  onClick={() => {
                    if (!newDeptName.trim()) { setNewDeptError("Name is required."); return; }
                    if (!newDeptCode.trim()) { setNewDeptError("Code is required."); return; }
                    if (!newDeptBuId) { setNewDeptError("Business unit is required."); return; }
                    createDeptMut.mutate({ name: newDeptName.trim(), code: newDeptCode.trim(), businessUnitId: newDeptBuId });
                  }}
                  disabled={createDeptMut.isPending}
                  data-testid="button-submit-dept"
                >
                  Add
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddDept(false)}>Cancel</Button>
              </div>
              {newDeptError && (
                <p className="text-xs text-red-500 sm:col-span-4" data-testid="error-new-dept">{newDeptError}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            {departments.map((d) => {
              const bu = buById.get(d.businessUnitId);
              return (
                <div
                  key={d.id}
                  className="rounded-md border bg-card px-3 py-2"
                  data-testid={`row-dept-${d.id}`}
                >
                  {editingDeptId === d.id ? (
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <Input
                        value={editingDeptName}
                        onChange={(e) => setEditingDeptName(e.target.value)}
                        className="h-8"
                        data-testid={`input-edit-dept-${d.id}`}
                      />
                      <Select value={editingDeptBuId} onValueChange={setEditingDeptBuId}>
                        <SelectTrigger className="h-8" data-testid={`select-edit-dept-bu-${d.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {businessUnits.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateDeptMut.mutate({ id: d.id, dto: { name: editingDeptName, businessUnitId: editingDeptBuId } })}
                          data-testid={`button-save-dept-${d.id}`}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingDeptId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{d.name}</div>
                        <div className="text-xs text-muted-foreground">{bu ? bu.name : "Unassigned BU"}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditingDeptId(d.id); setEditingDeptName(d.name); setEditingDeptBuId(d.businessUnitId); }}
                        data-testid={`button-edit-dept-${d.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmTarget({ kind: "dept", id: d.id, name: d.name })}
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
              <p className="text-sm text-muted-foreground">No departments yet. Add one above.</p>
            )}
          </div>
        </section>

        <Separator />

        {/* ── Teams ── */}
        <section className="space-y-3" data-testid="section-teams">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-500" />
              <h3 className="text-base font-semibold">Teams</h3>
              <span className="text-xs text-muted-foreground">({teams.length})</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => { setShowAddTeam((v) => !v); setNewTeamError(null); }}
              disabled={departments.length === 0}
              data-testid="button-toggle-add-team"
            >
              <Plus className="h-4 w-4" /> Add Team
            </Button>
          </div>

          {showAddTeam && (
            <div
              className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start rounded-md border border-dashed p-3"
              data-testid="form-add-team"
            >
              <div className="space-y-1">
                <Label className="text-xs">Team name</Label>
                <Input
                  placeholder="e.g. Platform Engineering"
                  value={newTeamName}
                  onChange={(e) => { setNewTeamName(e.target.value); setNewTeamError(null); }}
                  className="h-9"
                  data-testid="input-new-team-name"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Code</Label>
                <Input
                  placeholder="e.g. PE"
                  value={newTeamCode}
                  onChange={(e) => { setNewTeamCode(e.target.value); setNewTeamError(null); }}
                  className="h-9"
                  data-testid="input-new-team-code"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Department *</Label>
                <Select value={newTeamDeptId} onValueChange={(v) => { setNewTeamDeptId(v); setNewTeamError(null); }}>
                  <SelectTrigger className="h-9" data-testid="select-new-team-dept">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => {
                      const bu = buById.get(d.businessUnitId);
                      return (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}{bu ? ` — ${bu.name}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 sm:pt-5">
                <Button
                  size="sm"
                  onClick={() => {
                    if (!newTeamName.trim()) { setNewTeamError("Name is required."); return; }
                    if (!newTeamDeptId) { setNewTeamError("Department is required."); return; }
                    createTeamMut.mutate({ name: newTeamName.trim(), code: newTeamCode.trim() || newTeamName.trim().slice(0, 3).toUpperCase(), departmentId: newTeamDeptId });
                  }}
                  disabled={createTeamMut.isPending}
                  data-testid="button-submit-team"
                >
                  Add
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddTeam(false)}>Cancel</Button>
              </div>
              {newTeamError && (
                <p className="text-xs text-red-500 sm:col-span-4" data-testid="error-new-team">{newTeamError}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            {teams.map((t) => {
              const dept = deptById.get(t.departmentId);
              const bu = dept ? buById.get(dept.businessUnitId) : null;
              return (
                <div
                  key={t.id}
                  className="rounded-md border bg-card px-3 py-2"
                  data-testid={`row-team-${t.id}`}
                >
                  {editingTeamId === t.id ? (
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <Input
                        value={editingTeamName}
                        onChange={(e) => setEditingTeamName(e.target.value)}
                        className="h-8"
                        data-testid={`input-edit-team-${t.id}`}
                      />
                      <Select value={editingTeamDeptId} onValueChange={setEditingTeamDeptId}>
                        <SelectTrigger className="h-8" data-testid={`select-edit-team-dept-${t.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => {
                            const b = buById.get(d.businessUnitId);
                            return (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}{b ? ` — ${b.name}` : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateTeamMut.mutate({ id: t.id, dto: { name: editingTeamName, departmentId: editingTeamDeptId } })}
                          data-testid={`button-save-team-${t.id}`}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingTeamId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
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
                        onClick={() => { setEditingTeamId(t.id); setEditingTeamName(t.name); setEditingTeamDeptId(t.departmentId); }}
                        data-testid={`button-edit-team-${t.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmTarget({ kind: "team", id: t.id, name: t.name })}
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
              <p className="text-sm text-muted-foreground">No teams yet. Add one above.</p>
            )}
          </div>
        </section>
      </CardContent>

      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(open) => { if (!open) setConfirmTarget(null); }}
      >
        <AlertDialogContent data-testid="dialog-confirm-delete-org">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {confirmTarget?.kind === "bu" ? "Business Unit" : confirmTarget?.kind === "dept" ? "Department" : "Team"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{confirmTarget?.name}</strong>? This
              action cannot be undone and may affect related records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-org">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              data-testid="button-confirm-delete-org"
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteBuMut.isPending || deleteDeptMut.isPending || deleteTeamMut.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
