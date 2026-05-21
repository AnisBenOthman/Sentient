import { Switch, Route, useParams, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider } from "@/components/providers/auth-provider";
import { Layout } from "@/components/layout";
import { NotificationsProvider } from "@/components/notifications/notifications-provider";
import Welcome from "@/pages/welcome";
import Home from "@/pages/home";
import SignIn from "@/pages/signin";
import ForgotPassword from "@/pages/forgot-password";
import FirstConnection from "@/pages/first-connection";
import Dashboard from "@/pages/dashboard";
import Employees from "@/pages/employees";
import EmployeeProfile from "@/pages/employee-profile";
import Leaves from "@/pages/leaves";
import OrgChart from "@/pages/org-chart";
import Settings from "@/pages/settings";
import Positions from "@/pages/positions";
import LeaveManagement from "@/pages/leave-management";
import Simulation from "@/pages/simulation";
import PerformanceReviews from "@/pages/performance-reviews";
import OkrDashboard from "@/pages/okr-dashboard";
import OkrCycleManagement from "@/pages/okr-cycle-management";
import MyOkrs from "@/pages/my-okrs";
import NotFound from "@/pages/not-found";
import { authStore, getRoleTier, type RoleTier } from "@/lib/auth";
import { GuidedTourProvider } from "@/components/guided-tour";
import { GuidedTourRenderer } from "@/components/guided-tour";
import { useAuth } from "@/components/providers/auth-provider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!authStore.isLoggedIn()) return <Redirect to="/signin" />;
  return <>{children}</>;
}

function RoleGatedRoute({ allowed, children }: { allowed: RoleTier[]; children: React.ReactNode }) {
  const payload = authStore.getPayload();
  if (!payload) return <Redirect to="/signin" />;
  if (!allowed.includes(getRoleTier(payload))) return <Redirect to="/home" />;
  return <>{children}</>;
}

function EmployeeProfileRoute() {
  const params = useParams<{ id: string }>();
  return <EmployeeProfile key={params.id} />;
}

function SelfEmployeeProfileRoute() {
  const payload = authStore.getPayload();
  if (!payload) return <Redirect to="/signin" />;
  if (!payload.employeeId) return <Redirect to="/home" />;
  return <EmployeeProfile key={payload.employeeId} employeeId={payload.employeeId} />;
}

function AppRoutes() {
  return (
    <Switch>
      {/* Public pages — no sidebar */}
      <Route path="/" component={Welcome} />
      <Route path="/signin" component={SignIn} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/first-connection" component={FirstConnection} />

      {/* Authenticated pages — with sidebar layout */}
      <Route path="/home">
        <ProtectedRoute>
          <Layout>
            <Home />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute>
          <RoleGatedRoute allowed={["hr_admin", "dept_manager", "team_lead"]}>
            <Layout>
              <Dashboard />
            </Layout>
          </RoleGatedRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/employees">
        <ProtectedRoute>
          <Layout>
            <Employees />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/employees/:id">
        <ProtectedRoute>
          <RoleGatedRoute allowed={["hr_admin", "dept_manager", "team_lead"]}>
            <Layout>
              <EmployeeProfileRoute />
            </Layout>
          </RoleGatedRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute>
          <Layout>
            <SelfEmployeeProfileRoute />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/leaves">
        <ProtectedRoute>
          <Layout>
            <Leaves />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/org-chart">
        <ProtectedRoute>
          <Layout>
            <OrgChart />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <Layout>
            <Settings />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/positions">
        <ProtectedRoute>
          <RoleGatedRoute allowed={["hr_admin"]}>
            <Layout>
              <Positions />
            </Layout>
          </RoleGatedRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/simulation">
        <ProtectedRoute>
          <RoleGatedRoute allowed={["hr_admin", "dept_manager", "team_lead"]}>
            <Layout>
              <Simulation />
            </Layout>
          </RoleGatedRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/performance-reviews">
        <ProtectedRoute>
          <RoleGatedRoute allowed={["hr_admin", "dept_manager", "team_lead", "employee"]}>
            <Layout>
              <PerformanceReviews />
            </Layout>
          </RoleGatedRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/leave-management">
        <ProtectedRoute>
          <RoleGatedRoute allowed={["hr_admin"]}>
            <Layout>
              <LeaveManagement />
            </Layout>
          </RoleGatedRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/okr-dashboard">
        <ProtectedRoute>
          <Layout>
            <OkrDashboard />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/okr-cycle-management">
        <ProtectedRoute>
          <RoleGatedRoute allowed={["hr_admin", "dept_manager", "team_lead"]}>
            <Layout>
              <OkrCycleManagement />
            </Layout>
          </RoleGatedRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/my-okrs">
        <ProtectedRoute>
          <Layout>
            <MyOkrs />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function AppWithTour() {
  const { user } = useAuth();
  return (
    <GuidedTourProvider user={user}>
      <NotificationsProvider>
        <AppRoutes />
        <GuidedTourRenderer />
        <Toaster />
      </NotificationsProvider>
    </GuidedTourProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <AppWithTour />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
