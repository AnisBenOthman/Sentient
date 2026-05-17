import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Pencil, Trash2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import OrgStructureCard from "@/components/org-structure-card";
import { useAuth } from "@/components/providers/auth-provider";
import {
  deleteThresholdIndicator,
  getThresholdIndicators,
  upsertThresholdIndicator,
  updateThresholdIndicator,
  type ThresholdIndicator,
} from "@/lib/api/hr-core";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface MetricDefinition {
  key: string;
  label: string;
  unit: string;
}

const METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: "EMPLOYEES_EXITS",             label: "Terminal employees",      unit: "count" },
  { key: "EMPLOYEES_ATTRITION_RATE",    label: "Attrition rate",          unit: "%"     },
  { key: "EMPLOYEES_PROBATION",         label: "Employees on probation",  unit: "count" },
  { key: "LEAVE_PENDING_APPROVALS",     label: "Pending leave approvals", unit: "count" },
  { key: "PROMOTIONS_PENDING_REQUESTS", label: "Pending promotions",      unit: "count" },
];

interface EditState {
  metricKey: string;
  warning: string;
  critical: string;
}

function ThresholdRow({
  def,
  indicator,
  onSave,
  onRemove,
  saving,
  removing,
}: {
  def: MetricDefinition;
  indicator: ThresholdIndicator | undefined;
  onSave: (key: string, warning: string, critical: string, existingId?: string) => void;
  onRemove: (id: string) => void;
  saving: boolean;
  removing: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [warning, setWarning] = useState("");
  const [critical, setCritical] = useState("");

  function startEdit() {
    setWarning(indicator?.warningThreshold?.toString() ?? "");
    setCritical(indicator?.criticalThreshold?.toString() ?? "");
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
  }

  function save() {
    onSave(def.key, warning, critical, indicator?.id);
    setEditing(false);
  }

  const isConfigured = Boolean(indicator);
  const warningVal = indicator?.warningThreshold;
  const criticalVal = indicator?.criticalThreshold;

  return (
    <div className="flex items-center gap-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{def.label}</p>
        <p className="text-xs text-muted-foreground">{def.unit === "%" ? "percentage value" : "count"}</p>
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-amber-600 font-medium w-14 shrink-0">Warning ≥</span>
            <Input
              className="w-20 h-7 text-xs"
              type="number"
              min={0}
              placeholder="—"
              value={warning}
              onChange={(e) => setWarning(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-red-600 font-medium w-14 shrink-0">Critical ≥</span>
            <Input
              className="w-20 h-7 text-xs"
              type="number"
              min={0}
              placeholder="—"
              value={critical}
              onChange={(e) => setCritical(e.target.value)}
            />
          </div>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={save} disabled={saving}>
            <Check className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancel}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isConfigured ? (
              <>
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                )}>
                  ≥{warningVal ?? "—"} {def.unit}
                </span>
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                )}>
                  ≥{criticalVal ?? "—"} {def.unit}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground italic">Not configured</span>
            )}
          </div>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={startEdit}>
            <Pencil className="w-3 h-3" />
          </Button>
          {isConfigured && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
              onClick={() => onRemove(indicator!.id)}
              disabled={removing}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isHrAdmin = (user?.roles ?? []).some((r) => ["HR_ADMIN", "GLOBAL_HR_ADMIN"].includes(r));

  const { data: thresholds = [] } = useQuery({
    queryKey: ["threshold-indicators"],
    queryFn: getThresholdIndicators,
    enabled: isHrAdmin,
    staleTime: 60_000,
  });

  const thresholdByKey = Object.fromEntries(thresholds.map((t) => [t.metricKey, t]));

  const saveMutation = useMutation({
    mutationFn: ({ key, warning, critical, id }: { key: string; warning: string; critical: string; id?: string }) => {
      const w = warning.trim() !== "" ? Number(warning) : null;
      const c = critical.trim() !== "" ? Number(critical) : null;
      if (id) {
        return updateThresholdIndicator(id, { warningThreshold: w, criticalThreshold: c });
      }
      const def = METRIC_DEFINITIONS.find((d) => d.key === key)!;
      return upsertThresholdIndicator({ metricKey: key, label: def.label, warningThreshold: w ?? undefined, criticalThreshold: c ?? undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threshold-indicators"] });
      toast({ title: "Threshold saved" });
    },
    onError: () => toast({ title: "Failed to save threshold", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: deleteThresholdIndicator,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threshold-indicators"] });
      toast({ title: "Threshold removed" });
    },
    onError: () => toast({ title: "Failed to remove threshold", variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-settings">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage organizational configurations and preferences</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
            <CardDescription>Basic information about your organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input id="company-name" defaultValue="Sentient Corp" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax-id">Tax ID / EIN</Label>
                <Input id="tax-id" defaultValue="12-3456789" type="password" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Headquarters Address</Label>
              <Input id="address" defaultValue="100 Innovation Drive, San Francisco, CA 94105" />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>HR Policies</CardTitle>
            <CardDescription>Configure global rules and permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Auto-approve Time Off</Label>
                <p className="text-sm text-muted-foreground">Automatically approve requests under 2 days</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Public Directory</Label>
                <p className="text-sm text-muted-foreground">Allow all employees to view the org chart</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Performance Reviews</Label>
                <p className="text-sm text-muted-foreground">Enable quarterly 360 review cycles</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {isHrAdmin && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <CardTitle>Dashboard Alert Thresholds</CardTitle>
              </div>
              <CardDescription>
                Configure warning and critical thresholds for KPI cards. When a metric crosses a
                threshold the dashboard card lights up orange (warning) or red (critical).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {METRIC_DEFINITIONS.map((def, index) => (
                  <ThresholdRow
                    key={def.key}
                    def={def}
                    indicator={thresholdByKey[def.key]}
                    onSave={(key, warning, critical, id) =>
                      saveMutation.mutate({ key, warning, critical, id })
                    }
                    onRemove={(id) => removeMutation.mutate(id)}
                    saving={saveMutation.isPending}
                    removing={removeMutation.isPending}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <OrgStructureCard />
      </div>
    </div>
  );
}
