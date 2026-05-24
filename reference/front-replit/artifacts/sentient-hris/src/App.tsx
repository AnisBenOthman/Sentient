import { Switch, Route, Router as WouterRouter, useParams } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Layout } from "@/components/layout";
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
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function EmployeeProfileRoute() {
  const params = useParams<{ id: string }>();
  return <EmployeeProfile key={params.id} />;
}

function AppRoutes() {
  return (
    <Switch>
      {/* Public pages — no sidebar */}
      <Route path="/" component={Welcome} />
      <Route path="/signin" component={SignIn} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/first-connection" component={FirstConnection} />

      {/* App pages — with sidebar layout */}
      <Route path="/home">
        <Layout>
          <Home />
        </Layout>
      </Route>
      <Route path="/dashboard">
        <Layout>
          <Dashboard />
        </Layout>
      </Route>
      <Route path="/employees">
        <Layout>
          <Employees />
        </Layout>
      </Route>
      <Route path="/employees/:id">
        <Layout>
          <EmployeeProfileRoute />
        </Layout>
      </Route>
      <Route path="/leaves">
        <Layout>
          <Leaves />
        </Layout>
      </Route>
      <Route path="/org-chart">
        <Layout>
          <OrgChart />
        </Layout>
      </Route>
      <Route path="/settings">
        <Layout>
          <Settings />
        </Layout>
      </Route>
      <Route path="/positions">
        <Layout>
          <Positions />
        </Layout>
      </Route>
      <Route path="/simulation">
        <Layout>
          <Simulation />
        </Layout>
      </Route>
      <Route path="/performance-reviews">
        <Layout>
          <PerformanceReviews />
        </Layout>
      </Route>
      <Route path="/leave-management">
        <Layout>
          <LeaveManagement />
        </Layout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
