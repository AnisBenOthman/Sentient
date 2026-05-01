'use client';

import useSWR from 'swr';
import { useAuth } from '@/components/providers/auth-provider';
import { hasRole } from '@/lib/auth';
import { getEmployees, getMyLeaveRequests, getPendingLeaveQueue } from '@/lib/api/hr-core';
import type { LeaveRequest } from '@/lib/api/hr-core';
import { Users, CalendarDays, Clock, CheckCircle } from 'lucide-react';

// ── Shared UI ─────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(148,163,184,0.08)',
      borderRadius: 16, ...style,
    }}>
      {children}
    </div>
  );
}

function Skeleton({ w = '100%', h = 16 }: { w?: string | number; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 8,
      background: 'linear-gradient(90deg, rgba(30,41,59,0.6) 25%, rgba(51,65,85,0.4) 50%, rgba(30,41,59,0.6) 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
      marginBottom: 8,
    }} />
  );
}

function StatCard({
  icon: Icon, label, value, sub, color, loading,
}: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string; loading?: boolean;
}) {
  return (
    <Card style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
          {loading
            ? <Skeleton w={60} h={32} />
            : <p style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>{value}</p>
          }
          {sub && !loading && <p style={{ fontSize: 12, color: '#475569', margin: '4px 0 0' }}>{sub}</p>}
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={20} style={{ color }} />
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    PENDING:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
    APPROVED:  { color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
    REJECTED:  { color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
    CANCELLED: { color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
  };
  const s = map[status] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, color: s.color, background: s.bg, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function LeaveRow({ req }: { req: LeaveRequest }) {
  const name = req.employee
    ? `${req.employee.firstName} ${req.employee.lastName}`
    : 'You';
  const typeName = req.leaveType?.name ?? '—';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>{name}</p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#475569' }}>{typeName} · {fmt(req.startDate)} → {fmt(req.endDate)}</p>
      </div>
      <span style={{ fontSize: 12, color: '#64748b', flexShrink: 0 }}>{req.totalDays}d</span>
      <StatusBadge status={req.status} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const roles  = user?.roles ?? [];
  const isHR   = hasRole(roles, ['HR_ADMIN', 'EXECUTIVE']);
  const isMgr  = hasRole(roles, ['MANAGER']);

  const { data: empData, isLoading: empLoading } = useSWR(
    isHR ? 'employees-count' : null,
    () => getEmployees({ limit: 1 }),
  );

  const { data: myLeaves, isLoading: myLoading } = useSWR(
    'my-leaves',
    () => getMyLeaveRequests(),
  );

  const { data: pendingLeaves, isLoading: pendingLoading } = useSWR(
    isHR || isMgr ? 'pending-leaves' : null,
    () => getPendingLeaveQueue(),
  );

  const myPending  = (myLeaves ?? []).filter(r => r.status === 'PENDING').length;
  const myApproved = (myLeaves ?? []).filter(r => r.status === 'APPROVED').length;

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Dashboard</h1>
        <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>{today}</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        {isHR && (
          <StatCard icon={Users} label="Total Employees" color="#6366f1"
            value={empLoading ? '—' : (empData?.total ?? 0)}
            sub="across all departments" loading={empLoading} />
        )}
        {(isHR || isMgr) && (
          <StatCard icon={Clock} label="Pending Approvals" color="#f59e0b"
            value={pendingLoading ? '—' : (pendingLeaves?.length ?? 0)}
            sub="awaiting review" loading={pendingLoading} />
        )}
        <StatCard icon={CalendarDays} label="My Pending Leaves" color="#8b5cf6"
          value={myLoading ? '—' : myPending}
          sub="awaiting approval" loading={myLoading} />
        <StatCard icon={CheckCircle} label="My Approved Leaves" color="#10b981"
          value={myLoading ? '—' : myApproved}
          sub="this year" loading={myLoading} />
      </div>

      {/* Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: isHR || isMgr ? '1fr 1fr' : '1fr', gap: 20 }}>
        <Card style={{ padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', margin: '0 0 16px' }}>My Recent Requests</h3>
          {myLoading
            ? Array.from({ length: 3 }).map((_, i) => <div key={i}><Skeleton /><Skeleton w="60%" /></div>)
            : (myLeaves ?? []).length === 0
              ? <p style={{ fontSize: 13, color: '#334155', textAlign: 'center', padding: '20px 0' }}>No leave requests yet.</p>
              : (myLeaves ?? []).slice(0, 5).map(r => <LeaveRow key={r.id} req={r} />)
          }
        </Card>

        {(isHR || isMgr) && (
          <Card style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', margin: '0 0 16px' }}>Pending Approvals</h3>
            {pendingLoading
              ? Array.from({ length: 3 }).map((_, i) => <div key={i}><Skeleton /><Skeleton w="60%" /></div>)
              : (pendingLeaves ?? []).length === 0
                ? <p style={{ fontSize: 13, color: '#334155', textAlign: 'center', padding: '20px 0' }}>All clear — no pending requests.</p>
                : (pendingLeaves ?? []).slice(0, 5).map(r => <LeaveRow key={r.id} req={r} />)
            }
          </Card>
        )}
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>
    </div>
  );
}
