import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Pencil, Trash2, X, Check, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTour } from "@/hooks/use-tour";
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

/**
 * WHY: `label` is kept as the English string because it is persisted to HR Core
 * via upsertThresholdIndicator — it is stored data, not display text. The UI
 * renders `thresholds.metrics.<key>` instead, so switching language never
 * rewrites what was already saved server-side.
 */
interface MetricDefinition {
  key: MetricKey;
  label: string;
  unit: string;
}

type MetricKey =
  | "EMPLOYEES_EXITS"
  | "EMPLOYEES_ATTRITION_RATE"
  | "EMPLOYEES_PROBATION"
  | "LEAVE_PENDING_APPROVALS"
  | "PROMOTIONS_PENDING_REQUESTS";

const METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: "EMPLOYEES_EXITS",             label: "Terminal employees",      unit: "count" },
  { key: "EMPLOYEES_ATTRITION_RATE",    label: "Attrition rate",          unit: "%"     },
  { key: "EMPLOYEES_PROBATION",         label: "Employees on probation",  unit: "count" },
  { key: "LEAVE_PENDING_APPROVALS",     label: "Pending leave approvals", unit: "count" },
  { key: "PROMOTIONS_PENDING_REQUESTS", label: "Pending promotions",      unit: "count" },
];

function parseThresholdInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Threshold values must be zero or greater.");
  }
  return parsed;
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
  const { t } = useTranslation("settings");
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
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {t(`thresholds.metrics.${def.key}`)}
        </p>
        <p className="text-xs text-muted-foreground">
          {def.unit === "%" ? t("thresholds.unitPercentage") : t("thresholds.unitCount")}
        </p>
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-amber-600 font-medium w-14 shrink-0">
              {t("thresholds.warning")} ≥
            </span>
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
            <span className="text-[11px] text-red-600 font-medium w-14 shrink-0">
              {t("thresholds.critical")} ≥
            </span>
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
              <span className="text-xs text-muted-foreground italic">
                {t("thresholds.noThresholds")}
              </span>
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
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isHrAdmin = (user?.roles ?? []).some((r) => ["HR_ADMIN", "GLOBAL_HR_ADMIN"].includes(r));
  const { restart: restartTour } = useTour();

  const { data: thresholds = [] } = useQuery({
    queryKey: ["threshold-indicators"],
    queryFn: getThresholdIndicators,
    enabled: isHrAdmin,
    staleTime: 60_000,
  });

  const thresholdByKey = Object.fromEntries(thresholds.map((t) => [t.metricKey, t]));

  const saveMutation = useMutation({
    mutationFn: ({ key, warning, critical, id }: { key: string; warning: string; critical: string; id?: string }) => {
      const w = parseThresholdInput(warning);
      const c = parseThresholdInput(critical);
      if (w === null && c === null && !id) {
        throw new Error("Enter at least one threshold.");
      }
      if (w !== null && c !== null && c < w) {
        throw new Error("Critical threshold must be greater than or equal to warning.");
      }
      if (id) {
        return updateThresholdIndicator(id, { warningThreshold: w, criticalThreshold: c });
      }
      const def = METRIC_DEFINITIONS.find((d) => d.key === key)!;
      return upsertThresholdIndicator({ metricKey: key, label: def.label, warningThreshold: w ?? undefined, criticalThreshold: c ?? undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threshold-indicators"] });
      toast({ title: t("toasts.thresholdSaved") });
    },
    onError: (error) => toast({
      title: t("toasts.thresholdSaveFailed"),
      description: error instanceof Error ? error.message : undefined,
      variant: "destructive",
    }),
  });

  const removeMutation = useMutation({
    mutationFn: deleteThresholdIndicator,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threshold-indicators"] });
      toast({ title: t("toasts.thresholdRemoved") });
    },
    onError: () => toast({ title: t("toasts.thresholdRemoveFailed"), variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-settings">
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("company.title")}</CardTitle>
            <CardDescription>{t("company.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">{t("company.nameLabel")}</Label>
                <Input id="company-name" defaultValue="Sentient Corp" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax-id">{t("company.taxIdLabel")}</Label>
                <Input id="tax-id" defaultValue="12-3456789" type="password" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">{t("company.addressLabel")}</Label>
              <Input id="address" defaultValue="100 Innovation Drive, San Francisco, CA 94105" />
            </div>
            <Button>{t("company.save")}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("policies.title")}</CardTitle>
            <CardDescription>{t("policies.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">{t("policies.autoApproveTitle")}</Label>
                <p className="text-sm text-muted-foreground">{t("policies.autoApproveHint")}</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">{t("policies.publicDirectoryTitle")}</Label>
                <p className="text-sm text-muted-foreground">{t("policies.publicDirectoryHint")}</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">{t("policies.performanceReviewsTitle")}</Label>
                <p className="text-sm text-muted-foreground">{t("policies.performanceReviewsHint")}</p>
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
                <CardTitle>{t("sections.thresholds")}</CardTitle>
              </div>
              <CardDescription>{t("thresholds.description")}</CardDescription>
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

        <Card>
          <CardHeader>
            <CardTitle>{t("sections.tour")}</CardTitle>
            <CardDescription>{t("tour.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={restartTour} className="gap-2">
              <PlayCircle className="w-4 h-4" />
              {t("tour.restartButton")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
