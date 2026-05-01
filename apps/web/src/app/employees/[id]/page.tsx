'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { hasRole } from '@/lib/auth';
import { getEmployee, getSalaryHistory, getEmployeeSkills, getMyLeaveRequests } from '@/lib/api/hr-core';
import { ArrowLeft, Mail, Phone, Calendar, Building2, Users, Briefcase } from 'lucide-react';

// ── UI helpers ────────────────────────────────────────────────────────────

function Avatar({ firstName, lastName, size = 64 }: { firstName: string; lastName: string; size?: number }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  const colors = ['#6366f1','#8b5cf6','#ec4899','#06b6d4','#10b981','#f59e0b'];
  const str = firstName + lastName;
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  const bg = colors[Math.abs(h) % colors.length]!;
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: 'white', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  ACTIVE:     { color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
  ON_LEAVE:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
  PROBATION:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)'  },
  TERMINATED: { color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  RESIGNED:   { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  return (
    <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, color: s.color, background: s.bg }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={14} style={{ color: '#6366f1' }} />
      </div>
      <div>
        <p style={{ fontSize: 11, color: '#475569', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</p>
        <p style={{ fontSize: 13, color: '#e2e8f0', margin: 0 }}>{value}</p>
      </div>
    </div>
  );
}

function Card({ children, title, style }: { children: React.ReactNode; title?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, padding: 24, ...style }}>
      {title && <h3 style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', margin: '0 0 16px' }}>{title}</h3>}
      {children}
    </div>
  );
}

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

const PROFICIENCY_COLORS: Record<string, string> = {
  BEGINNER:     '#64748b',
  INTERMEDIATE: '#60a5fa',
  ADVANCED:     '#a78bfa',
  EXPERT:       '#34d399',
};

// ── Tabs ──────────────────────────────────────────────────────────────────

function OverviewTab({ emp }: { emp: ReturnType<typeof useEmployee>['data'] }) {
  if (!emp) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <Card title="Contact & Personal">
        <InfoRow icon={Mail}      label="Email"      value={emp.email} />
        <InfoRow icon={Phone}     label="Phone"      value={emp.phone} />
        <InfoRow icon={Calendar}  label="Date of Birth" value={fmt(emp.dateOfBirth)} />
        <InfoRow icon={Calendar}  label="Hire Date"  value={fmt(emp.hireDate)} />
        <InfoRow icon={Briefcase} label="Marital Status" value={emp.maritalStatus?.replace(/_/g, ' ')} />
        <InfoRow icon={Briefcase} label="Education"  value={emp.educationLevel?.replace(/_/g, ' ')} />
      </Card>
      <Card title="Organization">
        <InfoRow icon={Building2} label="Department" value={emp.department?.name} />
        <InfoRow icon={Users}     label="Team"       value={emp.team?.name} />
        <InfoRow icon={Briefcase} label="Position"   value={emp.position?.title} />
        <InfoRow icon={Users}     label="Manager"    value={emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : undefined} />
        <InfoRow icon={Briefcase} label="Contract"   value={emp.contractType.replace(/_/g, ' ')} />
      </Card>
    </div>
  );
}

function SalaryTab({ employeeId }: { employeeId: string }) {
  const { data: history = [], isLoading } = useSWR(
    `salary-history-${employeeId}`,
    () => getSalaryHistory(employeeId),
  );
  if (isLoading) return <div style={{ color: '#475569', padding: 20 }}>Loading…</div>;
  if (!history.length) return <div style={{ color: '#334155', textAlign: 'center', padding: 40 }}>No salary history.</div>;
  return (
    <Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 2fr', gap: 12, padding: '8px 0 12px', marginBottom: 8, borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
        {['Date', 'Before (Gross)', 'After (Gross)', 'Change', 'Reason'].map(h => (
          <span key={h} style={{ fontSize: 11, fontWeight: 600, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
        ))}
      </div>
      {history.map(h => {
        const delta = h.grossAfter - h.grossBefore;
        const pct   = h.grossBefore ? ((delta / h.grossBefore) * 100).toFixed(1) : null;
        return (
          <div key={h.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 2fr', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(148,163,184,0.04)', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{fmt(h.effectiveDate)}</span>
            <span style={{ fontSize: 12, color: '#64748b' }}>{fmtCurrency(h.grossBefore)}</span>
            <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>{fmtCurrency(h.grossAfter)}</span>
            <span style={{ fontSize: 12, color: delta >= 0 ? '#34d399' : '#f87171', fontWeight: 600 }}>
              {delta >= 0 ? '+' : ''}{fmtCurrency(delta)} {pct ? `(${pct}%)` : ''}
            </span>
            <span style={{ fontSize: 12, color: '#64748b' }}>{h.reason}</span>
          </div>
        );
      })}
    </Card>
  );
}

function SkillsTab({ employeeId }: { employeeId: string }) {
  const { data: skills = [], isLoading } = useSWR(
    `skills-${employeeId}`,
    () => getEmployeeSkills(employeeId),
  );
  if (isLoading) return <div style={{ color: '#475569', padding: 20 }}>Loading…</div>;
  if (!skills.length) return <div style={{ color: '#334155', textAlign: 'center', padding: 40 }}>No skills recorded.</div>;
  const byCategory = skills.reduce<Record<string, typeof skills>>((acc, s) => {
    const cat = s.skill.category ?? 'Other';
    (acc[cat] = acc[cat] ?? []).push(s);
    return acc;
  }, {});
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {Object.entries(byCategory).map(([cat, list]) => (
        <Card key={cat} title={cat}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {list.map(s => {
              const color = PROFICIENCY_COLORS[s.proficiencyLevel] ?? '#64748b';
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, background: `${color}12`, border: `1px solid ${color}30` }}>
                  <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{s.skill.name}</span>
                  <span style={{ fontSize: 10, color, fontWeight: 700 }}>{s.proficiencyLevel}</span>
                  {s.yearsOfExperience && <span style={{ fontSize: 10, color: '#475569' }}>{s.yearsOfExperience}yr</span>}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

function LeavesTab({ employeeId }: { employeeId: string }) {
  const { data: leaves = [], isLoading } = useSWR(
    `leaves-${employeeId}`,
    () => getMyLeaveRequests(),
  );
  const STATUS_STYLES_LOCAL: Record<string, { color: string; bg: string }> = {
    PENDING:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
    APPROVED:  { color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
    REJECTED:  { color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
    CANCELLED: { color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
  };
  if (isLoading) return <div style={{ color: '#475569', padding: 20 }}>Loading…</div>;
  if (!leaves.length) return <div style={{ color: '#334155', textAlign: 'center', padding: 40 }}>No leave requests.</div>;
  return (
    <Card>
      {leaves.slice(0, 20).map(r => {
        const s = STATUS_STYLES_LOCAL[r.status] ?? { color: '#94a3b8', bg: 'transparent' };
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>{r.leaveType?.name ?? '—'}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#475569' }}>{fmt(r.startDate)} → {fmt(r.endDate)} · {r.totalDays}d</p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, color: s.color, background: s.bg }}>{r.status}</span>
          </div>
        );
      })}
    </Card>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

function useEmployee(id: string) {
  return useSWR(`employee-${id}`, () => getEmployee(id));
}

// ── Page ──────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Salary', 'Skills', 'Leave History'];

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const isHR  = hasRole(roles, ['HR_ADMIN', 'EXECUTIVE']);

  const id  = params['id'] as string;
  const { data: emp, isLoading } = useEmployee(id);
  const [tab, setTab] = useState('Overview');

  const visibleTabs = TABS.filter(t => t !== 'Salary' || isHR);

  if (isLoading) {
    return (
      <div className="animate-fade-in" style={{ color: '#475569', padding: 40, textAlign: 'center' }}>
        Loading employee…
      </div>
    );
  }

  if (!emp) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <p style={{ color: '#f87171', fontSize: 14 }}>Employee not found.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Back */}
      <button
        onClick={() => router.back()}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 13, marginBottom: 20, fontFamily: 'Inter, sans-serif', padding: 0 }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#a5b4fc'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#475569'; }}
      >
        <ArrowLeft size={14} /> Back to Employees
      </button>

      {/* Profile hero */}
      <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, padding: 28, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 24 }}>
        <Avatar firstName={emp.firstName} lastName={emp.lastName} size={72} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>
              {emp.firstName} {emp.lastName}
            </h1>
            <StatusBadge status={emp.employmentStatus} />
          </div>
          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 8px' }}>
            {emp.position?.title ?? '—'} · {emp.department?.name ?? '—'}
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#475569' }}>{emp.employeeCode}</span>
            <span style={{ fontSize: 12, color: '#475569' }}>{emp.email}</span>
            {isHR && emp.grossSalary && (
              <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(emp.grossSalary)} / yr
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 14, padding: 5, width: 'fit-content' }}>
        {visibleTabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '9px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: tab === t ? 600 : 400,
            background: tab === t ? '#6366f1' : 'transparent',
            color: tab === t ? 'white' : '#64748b', transition: 'all 0.15s',
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="animate-fade-in" key={tab}>
        {tab === 'Overview'      && <OverviewTab emp={emp} />}
        {tab === 'Salary'        && <SalaryTab employeeId={emp.id} />}
        {tab === 'Skills'        && <SkillsTab employeeId={emp.id} />}
        {tab === 'Leave History' && <LeavesTab employeeId={emp.id} />}
      </div>
    </div>
  );
}
