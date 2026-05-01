'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { hasRole } from '@/lib/auth';
import {
  getEmployees, createEmployee, getDepartments, getTeams, getPositions,
} from '@/lib/api/hr-core';
import type { EmployeeProfile, CreateEmployeeDto } from '@/lib/api/hr-core';
import { Search, ChevronLeft, ChevronRight, UserPlus, X } from 'lucide-react';

// ── Shared UI ─────────────────────────────────────────────────────────────

function Avatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  const colors = ['#6366f1','#8b5cf6','#ec4899','#06b6d4','#10b981','#f59e0b'];
  const str = firstName + lastName;
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  const bg = colors[Math.abs(h) % colors.length]!;
  return (
    <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>
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
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, color: s.color, background: s.bg, whiteSpace: 'nowrap' }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function Skeleton() {
  return (
    <div style={{ height: 60, borderRadius: 10, marginBottom: 4, background: 'rgba(30,41,59,0.4)', animation: 'shimmer 1.5s infinite', backgroundSize: '200% 100%' }} />
  );
}

const STATUSES = ['ALL', 'ACTIVE', 'ON_LEAVE', 'PROBATION', 'TERMINATED'];
const CONTRACT_TYPES = ['FULL_TIME', 'PART_TIME', 'INTERN', 'CONTRACTOR', 'FIXED_TERM'];

// ── Add Employee Modal ─────────────────────────────────────────────────────

const FIELD: React.CSSProperties = {
  width: '100%', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.15)',
  borderRadius: 8, padding: '9px 12px', color: '#f1f5f9', fontSize: 13,
  outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
};

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
};

function AddEmployeeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: departments = [] } = useSWR('departments', getDepartments);
  const { data: teams       = [] } = useSWR('teams',       getTeams);
  const { data: positions   = [] } = useSWR('positions',   getPositions);

  const [form, setForm] = useState<CreateEmployeeDto>({
    firstName: '', lastName: '', email: '', hireDate: '', contractType: 'FULL_TIME',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const set = (k: keyof CreateEmployeeDto, v: string) =>
    setForm(f => ({ ...f, [k]: v || undefined }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: CreateEmployeeDto = { ...form };
      if (!payload.phone)       delete payload.phone;
      if (!payload.dateOfBirth) delete payload.dateOfBirth;
      if (!payload.grossSalary) delete payload.grossSalary;
      if (!payload.netSalary)   delete payload.netSalary;
      if (!payload.departmentId)delete payload.departmentId;
      if (!payload.teamId)      delete payload.teamId;
      if (!payload.positionId)  delete payload.positionId;
      await createEmployee(payload);
      onCreated();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to create employee'));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Add Employee</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4 }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Row: first + last */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={LABEL}>First name *</label>
              <input required style={FIELD} value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div>
              <label style={LABEL}>Last name *</label>
              <input required style={FIELD} value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={LABEL}>Email *</label>
            <input required type="email" style={FIELD} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>

          {/* Row: hire date + contract */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={LABEL}>Hire date *</label>
              <input required type="date" style={FIELD} value={form.hireDate} onChange={e => setForm(f => ({ ...f, hireDate: e.target.value }))} />
            </div>
            <div>
              <label style={LABEL}>Contract type *</label>
              <select required style={FIELD} value={form.contractType} onChange={e => setForm(f => ({ ...f, contractType: e.target.value }))}>
                {CONTRACT_TYPES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>

          {/* Row: phone + dob */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={LABEL}>Phone</label>
              <input style={FIELD} placeholder="+213555…" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label style={LABEL}>Date of birth</label>
              <input type="date" style={FIELD} value={form.dateOfBirth ?? ''} onChange={e => set('dateOfBirth', e.target.value)} />
            </div>
          </div>

          {/* Row: gross + net salary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={LABEL}>Gross salary</label>
              <input type="number" step="0.01" style={FIELD} placeholder="75000.00" value={form.grossSalary ?? ''} onChange={e => set('grossSalary', e.target.value)} />
            </div>
            <div>
              <label style={LABEL}>Net salary</label>
              <input type="number" step="0.01" style={FIELD} placeholder="62000.00" value={form.netSalary ?? ''} onChange={e => set('netSalary', e.target.value)} />
            </div>
          </div>

          {/* Department */}
          <div style={{ marginBottom: 14 }}>
            <label style={LABEL}>Department</label>
            <select style={FIELD} value={form.departmentId ?? ''} onChange={e => set('departmentId', e.target.value)}>
              <option value="">— None —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Row: team + position */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div>
              <label style={LABEL}>Team</label>
              <select style={FIELD} value={form.teamId ?? ''} onChange={e => set('teamId', e.target.value)}>
                <option value="">— None —</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Position</label>
              <select style={FIELD} value={form.positionId ?? ''} onChange={e => set('positionId', e.target.value)}>
                <option value="">— None —</option>
                {positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', fontSize: 12 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.15)', background: 'transparent', color: '#64748b', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: saving ? '#4f46e5' : 'linear-gradient(135deg,#6366f1,#7c3aed)', color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'Inter, sans-serif' }}>
              {saving ? 'Creating…' : 'Create Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const isHR  = hasRole(roles, ['HR_ADMIN']);

  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('ALL');
  const [page,      setPage]      = useState(1);
  const [showModal, setShowModal] = useState(false);
  const PAGE_SIZE = 10;

  const { data, isLoading } = useSWR(
    ['employees', search, status, page],
    () => getEmployees({
      search:  search  || undefined,
      status:  status !== 'ALL' ? status : undefined,
      page,
      limit: PAGE_SIZE,
    }),
    { keepPreviousData: true },
  );

  const employees  = data?.data   ?? [];
  const total      = data?.total  ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleStatus = (v: string) => { setStatus(v); setPage(1); };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Employees</h1>
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>{total} total</p>
        </div>
        {isHR && (
          <button onClick={() => setShowModal(true)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
            color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
          }}>
            <UserPlus size={15} /> Add Employee
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by name or email…"
            style={{
              width: '100%', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.1)',
              borderRadius: 10, padding: '10px 12px 10px 34px', color: '#f1f5f9', fontSize: 13,
              outline: 'none', fontFamily: 'Inter, sans-serif',
            }}
          />
        </div>

        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 12, padding: 4 }}>
          {STATUSES.map(s => (
            <button key={s} onClick={() => handleStatus(s)} style={{
              padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: status === s ? 600 : 400,
              background: status === s ? '#6366f1' : 'transparent',
              color: status === s ? 'white' : '#64748b', transition: 'all 0.15s',
            }}>
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr', gap: 16, padding: '12px 20px', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
          {['Employee', 'Position', 'Department', 'Contract', 'Status'].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
          ))}
        </div>

        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ padding: '12px 20px' }}><Skeleton /></div>
            ))
          : employees.length === 0
            ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#334155' }}>
                No employees found.
              </div>
            )
            : employees.map((emp: EmployeeProfile) => (
              <Link
                key={emp.id} href={`/employees/${emp.id}`}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr', gap: 16, padding: '14px 20px', alignItems: 'center', borderBottom: '1px solid rgba(148,163,184,0.04)', textDecoration: 'none', transition: 'background 0.12s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.05)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {/* Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar firstName={emp.firstName} lastName={emp.lastName} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>{emp.firstName} {emp.lastName}</div>
                    <div style={{ fontSize: 11, color: '#475569' }}>{emp.employeeCode}</div>
                  </div>
                </div>
                {/* Position */}
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{emp.position?.title ?? '—'}</span>
                {/* Department */}
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{emp.department?.name ?? '—'}</span>
                {/* Contract */}
                <span style={{ fontSize: 12, color: '#64748b' }}>{emp.contractType.replace(/_/g, ' ')}</span>
                {/* Status */}
                <StatusBadge status={emp.employmentStatus} />
              </Link>
            ))
        }
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <span style={{ fontSize: 12, color: '#475569' }}>
            Page {page} of {totalPages} · {total} employees
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.1)', background: 'rgba(15,23,42,0.6)', color: page === 1 ? '#334155' : '#94a3b8', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.1)', background: 'rgba(15,23,42,0.6)', color: page === totalPages ? '#334155' : '#94a3b8', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>

      {showModal && (
        <AddEmployeeModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            void mutate(['employees', search, status, page]);
          }}
        />
      )}
    </div>
  );
}
