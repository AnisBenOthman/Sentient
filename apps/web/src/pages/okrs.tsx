import { useSearch } from 'wouter';
import { useTranslation } from "react-i18next";

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/components/providers/auth-provider';

import MyOkrs from './my-okrs';
import OkrDashboard from './okr-dashboard';
import OkrCycleManagement from './okr-cycle-management';

export default function OkrsPage() {
  const { t } = useTranslation("okr");
  const { user } = useAuth();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const defaultTab = params.get('tab') ?? 'my-okrs';

  const isManager = user?.roles.includes('MANAGER') ?? false;
  const isHrAdmin = user?.roles.includes('HR_ADMIN') ?? false;
  const canManage = isManager || isHrAdmin;

  return (
    <div className="space-y-4">
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="my-okrs">{t("pageTabs.myOkrs")}</TabsTrigger>
          <TabsTrigger value="dashboard">{t("pageTabs.dashboard")}</TabsTrigger>
          {canManage && (
            <TabsTrigger value="management">{t("pageTabs.management")}</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="my-okrs" className="mt-6">
          <MyOkrs />
        </TabsContent>

        <TabsContent value="dashboard" className="mt-6">
          <OkrDashboard />
        </TabsContent>

        {canManage && (
          <TabsContent value="management" className="mt-6">
            <OkrCycleManagement />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
