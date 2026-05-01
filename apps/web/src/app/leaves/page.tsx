'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useAuth } from '@/components/providers/auth-provider';
import { hasRole } from '@/lib/auth';
import {
  getMyLeaveRequests, getPendingLeaveQueue, getLeaveTypes, getLeaveBalances,
  approveLeaveRequest, rejectLeaveRequest, cancelLeaveRequest,
  createLeaveRequest,
} from '@/lib/api/hr-core';
import type { LeaveRequest, LeaveType, LeaveBalance } from '@/lib/api/hr-core';
import { Plus, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  PENDING:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
  APPROVED:  { color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
  REJECTED:  { color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  CANCELLED: { color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
  ESCALATED: { color: '#f97316', bg: 'rgba(249,115,22,0.1)'  },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, color: s.color, background: s.bg, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
}

// ── Request Leave Modal ───────────────────────────────────────────────────

function RequestModal({ open, onClose, types, balances, onSuccess }: {
  open: boolean; onClose: () => void;
  types: LeaveType[]; balances: LeaveBalance[];
  onSuccess: () => void;
}) {
  const [form, setForm]     = useState({ leaveTypeId: types[0]?.id ?? '', startDate: '', endDate: '', reason: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  if (!open) return null;

  const bal = balances.find(b => b.leaveTypeId === form.leaveTypeId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.startDate || !form.endDate) { setError('Start and end dates are required.'); return; }
    setLoading(true); setError('');
    try {
      await createLeaveRequest({ leaveTypeId: form.leaveTypeId, startDate: form.startDate, endDate: form.endDate, reason: form.reason || undefined });
      onSuccess();
      onClose();
      setForm({ leaveTypeId: types[0]?.id ?? '', startDate: '', endDate: '', reason: '' });
    } catch {
      setError('Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.1)',
    borderRadius: 10, padding: '10px 12px', color: '#f1f5f9', fontSize: 13,
    outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.7)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: 480, background: '#0f172a', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 20, padding: 28, zIndex: 1 }} className="animate-fade-in">
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: '0 0 20px' }}>Request Leave</h2>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Leave Type</label>
            <select
              value={form.leaveTypeId}
              onChange={e => setForm(f => ({ ...f, leaveTypeId: e.target.value }))}
              style={{ ...inputStyle, appearance: 'none' }}
            >
              {types.map(t => {
                const b = balances.find(b => b.leaveTypeId === t.id);
                return <option key={t.id} value={t.id}>{t.name}{b ? ` (${b.remainingDays} days left)` : ''}</option>;
              })}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={inputStyle} required />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: 6 }}>End Date</label>
              <input type="date" value={form.endDate} min={form.startDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={inputStyle} required />
            </div>
          </div>
          {bal && (
            <div style={{ padding: '10px 14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, fontSize: 12, color: '#a5b4fc' }}>
              {bal.remainingDays} days remaining for {bal.leaveTypeName}
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Reason (optional)</label>
            <textarea
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Briefly describe your reason…"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
          {error && <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>Cancel</button>
            <button type="submit" disabled={loading} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #6366f1, #7c3aed)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Reject Modal ──────────────────────────────────────────────────────────

function RejectModal({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (note: string) => void }) {
  const [note, setNote] = useState('');
  const [err,  setErr]  = useState('');
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.7)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: 420, background: '#0f172a', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 20, padding: 28, zIndex: 1 }} className="animate-fade-in">
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f87171', margin: '0 0 16px' }}>Reject Request</h2>
        <textarea
          value={note} onChange={e => { setNote(e.target.value); setErr(''); }}
          placeholder="Explain the reason for rejection…" rows={4}
          style={{ width: '100%', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 10, padding: '10px 12px', color: '#f1f5f9', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', resize: 'vertical', boxSizing: 'border-box' }}
        />
        {err && <p style={{ fontSize: 12, color: '#f87171', margin: '6px 0 0' }}>{err}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>Cancel</button>
          <button onClick={() => { if (!note.trim()) { setErr('Review note is required.'); return; } onConfirm(note); }} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>Confirm Rejection</button>
        </div>
      </div>
    </div>
  );
}

// ── Calendar ──────────────────────────────────────────────────────────────

function LeaveCalendar({ leaves }: { leaves: LeaveRequest[] }) {
  const [month, setMonth] = useState(new Date());
  const year = month.getFullYear(), mon = month.getMonth();
  const firstDay = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const weeks: (number | null)[][] = [];
  let day = 1 - firstDay;
  while (day <= daysInMonth) {
    const week: (number | null)[] = [];
    for (let d = 0; d < 7; d++) { week.push(day <= 0 || day > daysInMonth ? null : day); day++; }
    weeks.push(week);
  }
  const approved = leaves.filter(r => r.status === 'APPROVED');
  const getBars = (n: number | null) => {
    if (!n) return [];
    const cell = new Date(year, mon, n);
    return approved.filter(r => {
      const s = new Date(r.startDate), e = new Date(r.endDate);
      return cell >= s && cell <= e;
    }).slice(0, 2);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMonth(new Date(year, mon - 1, 1))} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.1)', background: 'rgba(15,23,42,0.6)', color: '#94a3b8', cursor: 'pointer' }}><ChevronLeft size={14} /></button>
          <button onClick={() => setMonth(new Date())} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.1)', background: 'rgba(15,23,42,0.6)', color: '#94a3b8', cursor: 'pointer', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>Today</button>
          <button onClick={() => setMonth(new Date(year, mon + 1, 1))} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.1)', background: 'rgba(15,23,42,0.6)', color: '#94a3b8', cursor: 'pointer' }}><ChevronRight size={14} /></button>
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>
          {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <div style={{ width: 120 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
        ))}
        {weeks.map((week, wi) => week.map((d, di) => {
          const bars = getBars(d);
          const isToday = d ? new Date().toDateString() === new Date(year, mon, d).toDateString() : false;
          return (
            <div key={`${wi}-${di}`} style={{ minHeight: 80, padding: '6px 8px', background: d ? 'rgba(15,23,42,0.5)' : 'transparent', border: `1px solid ${d ? 'rgba(148,163,184,0.07)' : 'transparent'}`, borderRadius: 10, opacity: d ? 1 : 0.3 }}>
              {d && (
                <>
                  <div style={{ fontSize: 13, color: isToday ? '#6366f1' : '#64748b', fontWeight: isToday ? 700 : 400, marginBottom: 4, width: isToday ? 22 : undefined, height: isToday ? 22 : undefined, borderRadius: isToday ? '50%' : undefined, background: isToday ? 'rgba(99,102,241,0.2)' : undefined, display: isToday ? 'flex' : 'block', alignItems: isToday ? 'center' : undefined, justifyContent: isToday ? 'center' : undefined }}>{d}</div>
                  {bars.map(r => (
                    <div key={r.id} style={{ fontSize: 10, background: `${r.leaveType?.color ?? '#6366f1'}22`, color: r.leaveType?.color ?? '#6366f1', border: `1px solid ${r.leaveType?.color ?? '#6366f1'}44`, borderRadius: 4, padding: '2px 5px', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.employee ? r.employee.firstName : 'You'}
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        }))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function LeavesPage() {
  const { user }  = useAuth();
  const roles      = user?.roles ?? [];
  const isHR       = hasRole(roles, ['HR_ADMIN', 'EXECUTIVE']);
  const isMgr      = hasRole(roles, ['MANAGER']);
  const canApprove = isHR || isMgr;

  const [tab,        setTab]        = useState('my');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [reqOpen,    setReqOpen]    = useState(false);
  const [rejectId,   setRejectId]   = useState<string | null>(null);

  const MY_KEY     = 'my-leaves-page';
  const PEND_KEY   = 'pending-leaves-page';

  const { data: myLeaves = [],      isLoading: myLoading }    = useSWR(MY_KEY,   () => getMyLeaveRequests());
  const { data: pendingLeaves = [], isLoading: pendingLoading } = useSWR(
    canApprove ? PEND_KEY : null,
    () => getPendingLeaveQueue(),
  );
  const { data: types = [] }    = useSWR('leave-types',    getLeaveTypes);
  const { data: balances = [] } = useSWR(
    user?.employeeId ? `balances-${user.employeeId}` : null,
    () => getLeaveBalances(user!.employeeId!),
  );

  const filtered = statusFilter === 'ALL' ? myLeaves : myLeaves.filter(r => r.status === statusFilter);

  const refresh = () => {
    void mutate(MY_KEY);
    void mutate(PEND_KEY);
  };

  const handleApprove = async (id: string) => {
    await approveLeaveRequest(id); refresh();
  };

  const handleReject = async (note: string) => {
    if (!rejectId) return;
    await rejectLeaveRequest(rejectId, note);
    setRejectId(null);
    refresh();
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this leave request?')) return;
    await cancelLeaveRequest(id);
    refresh();
  };

  const TABS = [
    { id: 'my',       label: 'My Requests' },
    { id: 'queue',    label: 'Approval Queue', badge: pendingLeaves.length, guard: canApprove },
    { id: 'calendar', label: 'Team Calendar',  guard: canApprove },
    { id: 'types',    label: 'Leave Types',    guard: isHR },
  ].filter(t => !('guard' in t) || t.guard);

  const thStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Leave Management</h1>
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>Manage leave requests, balances, and schedules</p>
        </div>
        <button
          onClick={() => setReqOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #6366f1, #7c3aed)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 16px rgba(99,102,241,0.3)', fontFamily: 'Inter, sans-serif' }}
        >
          <Plus size={15} /> Request Leave
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 14, padding: 5, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '9px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
            background: tab === t.id ? '#6366f1' : 'transparent',
            color: tab === t.id ? 'white' : '#64748b', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {t.label}
            {'badge' in t && (t.badge ?? 0) > 0 && (
              <span style={{ background: tab === t.id ? 'rgba(255,255,255,0.25)' : 'rgba(239,68,68,0.85)', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99 }}>
                {t.badge ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* My Requests */}
      {tab === 'my' && (
        <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {['ALL','PENDING','APPROVED','REJECTED','CANCELLED'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{
                padding: '5px 14px', borderRadius: 8, border: `1px solid ${statusFilter === s ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
                background: statusFilter === s ? 'rgba(99,102,241,0.15)' : 'rgba(30,41,59,0.4)',
                color: statusFilter === s ? '#a5b4fc' : '#64748b',
                cursor: 'pointer', fontSize: 12, fontFamily: 'Inter, sans-serif',
              }}>
                {s}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 80px', gap: 12, padding: '8px 0 12px', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
            {['Type','Start','End','Days','Submitted','Status',''].map(h => <span key={h} style={thStyle}>{h}</span>)}
          </div>
          {myLoading
            ? <div style={{ padding: 20, color: '#475569' }}>Loading…</div>
            : filtered.length === 0
              ? <div style={{ textAlign: 'center', padding: 40, color: '#334155' }}>No requests found.</div>
              : filtered.map(r => (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 80px', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(148,163,184,0.04)', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {r.leaveType?.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.leaveType.color, display: 'inline-block', flexShrink: 0 }} />}
                    {r.leaveType?.name ?? '—'}
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{fmt(r.startDate)}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{fmt(r.endDate)}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{r.totalDays}d</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{fmt(r.submittedAt)}</span>
                  <StatusBadge status={r.status} />
                  {r.status === 'PENDING'
                    ? <button onClick={() => handleCancel(r.id)} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                    : <span />
                  }
                </div>
              ))
          }
        </div>
      )}

      {/* Approval Queue */}
      {tab === 'queue' && canApprove && (
        <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, padding: 24 }}>
          <p style={{ fontSize: 13, color: '#475569', margin: '0 0 16px' }}>{pendingLeaves.length} request{pendingLeaves.length !== 1 ? 's' : ''} awaiting review</p>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 160px', gap: 12, padding: '8px 0 12px', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
            {['Employee','Type','Period','Days','Submitted','Actions'].map(h => <span key={h} style={thStyle}>{h}</span>)}
          </div>
          {pendingLoading
            ? <div style={{ padding: 20, color: '#475569' }}>Loading…</div>
            : pendingLeaves.length === 0
              ? <div style={{ textAlign: 'center', padding: 40, color: '#334155' }}>All clear — no pending requests.</div>
              : pendingLeaves.map((r: LeaveRequest) => (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 160px', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(148,163,184,0.04)', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#e2e8f0' }}>{r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{r.leaveType?.name ?? '—'}</span>
                  <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{fmt(r.startDate)} → {fmt(r.endDate)}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{r.totalDays}d</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{fmt(r.submittedAt)}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleApprove(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.08)', color: '#34d399', cursor: 'pointer', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
                      <Check size={12} /> Approve
                    </button>
                    <button onClick={() => setRejectId(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
                      <X size={12} /> Reject
                    </button>
                  </div>
                </div>
              ))
          }
        </div>
      )}

      {/* Calendar */}
      {tab === 'calendar' && (
        <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, padding: 28 }}>
          <LeaveCalendar leaves={myLeaves} />
        </div>
      )}

      {/* Leave Types */}
      {tab === 'types' && isHR && (
        <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, padding: '8px 0 12px', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
            {['Name','Accrual','Requires Approval','Days / Year'].map(h => <span key={h} style={thStyle}>{h}</span>)}
          </div>
          {types.map(t => (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, padding: '14px 0', borderBottom: '1px solid rgba(148,163,184,0.04)', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color ?? '#6366f1', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>{t.name}</span>
              </div>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{t.accrualFrequency}</span>
              <span style={{ fontSize: 12, color: t.requiresApproval ? '#a5b4fc' : '#64748b' }}>{t.requiresApproval ? 'Yes' : 'No'}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{t.defaultDaysPerYear}</span>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <RequestModal
        open={reqOpen} onClose={() => setReqOpen(false)}
        types={types} balances={balances} onSuccess={refresh}
      />
      <RejectModal
        open={!!rejectId} onClose={() => setRejectId(null)} onConfirm={handleReject}
      />
    </div>
  );
}
