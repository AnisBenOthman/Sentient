import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  BarChart2,
  Briefcase,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  GitFork,
  Home,
  LayoutDashboard,
  Sparkles,
  Target,
  UserRound,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import type { JwtPayload } from '@sentient/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { completeOnboarding } from '@/lib/api/hr-core';
import { getRoleTier, type RoleTier } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface TourTab {
  readonly id: string;
  readonly title: string;
  readonly icon: React.ElementType;
  readonly description: string;
  readonly tiers: readonly RoleTier[];
}

const ALL_TOUR_TABS: readonly TourTab[] = [
  {
    id: 'home',
    title: 'Home',
    icon: Home,
    tiers: ['hr_admin', 'dept_manager', 'team_lead', 'employee'],
    description:
      'Your personal dashboard — a snapshot of pending actions, recent activity, and quick links to the most relevant sections for your role. Everything you need to start your day is one click away.',
  },
  {
    id: 'profile',
    title: 'My Profile',
    icon: UserRound,
    tiers: ['hr_admin', 'dept_manager', 'team_lead', 'employee'],
    description:
      'View and update your personal information, contact details, and professional summary. Your profile is the single source of truth that other modules — skills, OKRs, performance — link back to.',
  },
  {
    id: 'leaves',
    title: 'Leaves',
    icon: CalendarDays,
    tiers: ['hr_admin', 'dept_manager', 'team_lead', 'employee'],
    description:
      'Submit, track, and cancel your own leave requests. See your remaining balances for each leave type and the history of past requests. The AI Leave Agent can help you pick the best dates and estimate approval likelihood.',
  },
  {
    id: 'org-chart',
    title: 'Org Chart',
    icon: GitFork,
    tiers: ['hr_admin', 'dept_manager', 'team_lead', 'employee'],
    description:
      'Explore the company structure — departments, teams, and reporting lines — in an interactive tree. Understand who reports to whom and navigate to any employee profile directly from the chart.',
  },
  {
    id: 'performance',
    title: 'Performance Reviews',
    icon: ClipboardCheck,
    tiers: ['hr_admin', 'dept_manager', 'team_lead', 'employee'],
    description:
      'Complete self-assessments and view your manager\'s feedback across active review cycles. Track your ratings over time and see follow-up actions like salary adjustments tied to your reviews.',
  },
  {
    id: 'my-okrs',
    title: 'My OKRs',
    icon: Target,
    tiers: ['hr_admin', 'dept_manager', 'team_lead', 'employee'],
    description:
      'Manage your personal Objectives and Key Results. Create objectives, define measurable key results, and submit weekly check-ins. Stay aligned with your team\'s goals and see your progress at a glance.',
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    tiers: ['hr_admin', 'dept_manager', 'team_lead'],
    description:
      'A Power BI–style analytics hub with real-time KPIs: headcount trends, payroll summaries, leave patterns, skills gaps, and engagement scores. Filter by time period (monthly / quarterly / yearly) and toggle chart types per panel.',
  },
  {
    id: 'okr-dashboard',
    title: 'OKR Dashboard',
    icon: BarChart2,
    tiers: ['hr_admin', 'dept_manager', 'team_lead'],
    description:
      'A cross-team view of objective progress. See which key results are on track, at risk, or completed across your scope. Drill into individual contributors\' check-ins and score history.',
  },
  {
    id: 'leave-mgmt',
    title: 'Leave Management',
    icon: CalendarClock,
    tiers: ['hr_admin'],
    description:
      'Review and approve or reject pending leave requests from your team. Configure leave types, set accrual rules, manage carry-over policies, and view the full team calendar to spot scheduling conflicts.',
  },
  {
    id: 'employees',
    title: 'Employees',
    icon: Users,
    tiers: ['hr_admin'],
    description:
      'The central employee registry — create new employees, update their details, manage role assignments, track salary history, and view skills profiles. Every employee lifecycle action starts here.',
  },
  {
    id: 'positions',
    title: 'Positions',
    icon: Briefcase,
    tiers: ['hr_admin'],
    description:
      'Define and maintain the job position catalog. Each position carries required skills and a salary band, powering skills-gap analysis and the AI Career Agent\'s recommendations.',
  },
  {
    id: 'simulation',
    title: 'Simulation',
    icon: Sparkles,
    tiers: ['hr_admin', 'dept_manager', 'team_lead'],
    description:
      'Model workforce changes before committing. Propose promotions, transfers, or restructuring scenarios; the Analytics AI Agent analyses impact on cost, skills coverage, and team balance — then HR Admin can apply approved changes.',
  },
] as const;

interface OnboardingTourProps {
  user: JwtPayload;
  onComplete: () => void;
}

export function OnboardingTour({ user, onComplete }: OnboardingTourProps): React.ReactElement {
  const roleTier = getRoleTier(user);
  const tabs = ALL_TOUR_TABS.filter((t) => t.tiers.includes(roleTier));

  const firstId = tabs[0]?.id ?? '';
  const [activeTab, setActiveTab] = useState<string>(firstId);
  const [visited, setVisited] = useState<ReadonlySet<string>>(new Set(firstId ? [firstId] : []));
  const [completing, setCompleting] = useState(false);

  function handleTabChange(id: string): void {
    setActiveTab(id);
    setVisited((prev) => new Set([...prev, id]));
  }

  async function handleComplete(): Promise<void> {
    setCompleting(true);
    try {
      await completeOnboarding();
      onComplete();
    } catch {
      setCompleting(false);
    }
  }

  const progress = tabs.length > 0 ? Math.round((visited.size / tabs.length) * 100) : 100;
  const allVisited = visited.size >= tabs.length;

  return (
    <DialogPrimitive.Root open>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2',
            'rounded-xl border bg-background shadow-2xl',
            'flex flex-col max-h-[90vh]',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
          )}
        >
          {/* Header */}
          <div className="flex flex-col gap-1 border-b px-6 pt-6 pb-4">
            <DialogPrimitive.Title className="text-xl font-semibold tracking-tight">
              Welcome to Sentient HRIS
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              Explore each section below to discover what the platform can do for you.
            </DialogPrimitive.Description>

            <div className="mt-3 flex items-center gap-3">
              <Progress value={progress} className="h-2 flex-1" />
              <Badge variant={allVisited ? 'default' : 'secondary'} className="shrink-0 text-xs">
                {visited.size}/{tabs.length} explored
              </Badge>
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="mb-4 flex h-auto w-full flex-wrap gap-1 rounded-lg bg-muted p-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const seen = visited.has(tab.id);
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {tab.title}
                      {seen && (
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsContent key={tab.id} value={tab.id} className="mt-0">
                    <div className="flex flex-col items-center gap-4 py-6 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                        <Icon className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold">{tab.title}</h3>
                      <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                        {tab.description}
                      </p>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t px-6 py-4">
            <p className="text-xs text-muted-foreground">
              {allVisited
                ? 'All sections explored — ready to get started!'
                : `${tabs.length - visited.size} section${tabs.length - visited.size === 1 ? '' : 's'} left to explore`}
            </p>
            <Button
              onClick={handleComplete}
              disabled={!allVisited || completing}
              size="sm"
              className="min-w-28"
            >
              {completing ? 'Starting…' : 'Get Started'}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
