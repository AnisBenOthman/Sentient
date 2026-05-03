'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import useSWR, { mutate as globalMutate } from 'swr';
import { Plus, Pencil, Trash2, Building2, FolderOpen, Users, X } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { hasRole } from '@/lib/auth';
import {
  getBusinessUnits, createBusinessUnit, updateBusinessUnit, deleteBusinessUnit,
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
  getTeams, createTeam, updateTeam, deleteTeam,
} from '@/lib/api/hr-core';
import type {
  BusinessUnit, Department, Team,
  CreateDepartmentPayload, CreateTeamPayload,
} from '@/lib/api/hr-core';

// ── Shared Styles ──────────────────────────────────────────────────────────

const FIELD: React.CSSProperties = {
  width: '100%', background: 'rgba(15,23,42,0.8)',
  border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8,
  padding: '9px 12px', color: '#f1f5f9', fontSize: 13,
  outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
};

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
};

const TH: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#334155',
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

const ADD_BTN: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 7,
  padding: '8px 16px', borderRadius: 9, border: 'none',
  background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
  color: 'white', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
};

// ── Shared Components ──────────────────────────────────────────────────────

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
      color: active ? '#34d399' : '#94a3b8',
      background: active ? 'rgba(52,211,153,0.1)' : 'rgba(148,163,184,0.1)',
      whiteSpace: 'nowrap',
    }}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{
      marginBottom: 16, padding: '10px 14px', borderRadius: 8,
      background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
      color: '#f87171', fontSize: 12,
    }}>
      {msg}
    </div>
  );
}

function FormActions({ saving, onCancel, label }: { saving: boolean; onCancel: () => void; label: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
      <button type="button" onClick={onCancel} style={{
        padding: '9px 18px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.15)',
        background: 'transparent', color: '#64748b', fontSize: 13,
        cursor: 'pointer', fontFamily: 'Inter, sans-serif',
      }}>
        Cancel
      </button>
      <button type="submit" disabled={saving} style={{
        padding: '9px 20px', borderRadius: 8, border: 'none',
        background: saving ? '#4f46e5' : 'linear-gradient(135deg,#6366f1,#7c3aed)',
        color: 'white', fontSize: 13, fontWeight: 600,
        cursor: saving ? 'not-allowed' : 'pointer',
        opacity: saving ? 0.7 : 1, fontFamily: 'Inter, sans-serif',
      }}>
        {saving ? 'Saving…' : label}
      </button>
    </div>
  );
}

function ModalShell({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return createPortal(
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#0f172a', border: '1px solid rgba(148,163,184,0.12)',
        borderRadius: 16, width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflowY: 'auto', padding: 28,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function TableShell({ columns, grid, children, empty, loading }: {
  columns: string[]; grid: string;
  children: React.ReactNode; empty: string; loading: boolean;
}) {
  return (
    <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 16, padding: '11px 20px', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
        {columns.map(h => <span key={h} style={TH}>{h}</span>)}
      </div>
      {loading
        ? <div style={{ padding: '24px 20px', color: '#334155', fontSize: 13 }}>Loading…</div>
        : React.Children.count(children) === 0
          ? <div style={{ padding: '36px 0', textAlign: 'center', color: '#334155', fontSize: 13 }}>{empty}</div>
          : children}
    </div>
  );
}

function InlineDelete({ id, confirmId, deleting, onConfirm, onRequest, onCancel }: {
  id: string; confirmId: string | null; deleting: boolean;
  onConfirm: () => void; onRequest: () => void; onCancel: () => void;
}) {
  if (confirmId === id) {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onConfirm} disabled={deleting} style={{
          padding: '4px 10px', borderRadius: 6, border: 'none',
          background: '#ef4444', color: 'white', fontSize: 11,
          fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
        }}>
          {deleting ? '…' : 'Confirm'}
        </button>
        <button onClick={onCancel} style={{
          padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.15)',
          background: 'transparent', color: '#64748b', fontSize: 11,
          cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>
          Cancel
        </button>
      </div>
    );
  }
  return (
    <button onClick={onRequest} title="Deactivate" style={{
      background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4, display: 'flex',
    }}>
      <Trash2 size={14} />
    </button>
  );
}

function apiErr(err: unknown): string {
  const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return Array.isArray(msg) ? msg.join(', ') : String(msg ?? 'An error occurred');
}

// ── Business Units ─────────────────────────────────────────────────────────

function BUModal({ item, onClose, onSaved }: { item?: BusinessUnit; onClose: () => void; onSaved: () => void }) {
  const [name,     setName]     = useState(item?.name    ?? '');
  const [address,  setAddress]  = useState(item?.address ?? '');
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [saving, setSaving]     = useState(false);
  const [error,  setError]      = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (item) {
        await updateBusinessUnit(item.id, { name, address, isActive });
      } else {
        await createBusinessUnit({ name, address });
      }
      onSaved();
    } catch (err) {
      setError(apiErr(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={item ? 'Edit Business Unit' : 'Add Business Unit'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label style={LABEL}>Name *</label>
          <input required style={FIELD} value={name} onChange={e => setName(e.target.value)} placeholder="North Africa Division" />
        </div>
        <div style={{ marginBottom: item ? 14 : 20 }}>
          <label style={LABEL}>Address *</label>
          <textarea required rows={3} style={{ ...FIELD, resize: 'vertical' }} value={address}
            onChange={e => setAddress(e.target.value)} placeholder="12 Rue Didouche Mourad, Algiers" />
        </div>
        {item && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#6366f1' }} />
              <span style={{ fontSize: 13, color: '#94a3b8' }}>Active</span>
            </label>
          </div>
        )}
        {error && <ErrorBanner msg={error} />}
        <FormActions saving={saving} onCancel={onClose} label={item ? 'Save Changes' : 'Create'} />
      </form>
    </ModalShell>
  );
}

function BusinessUnitsTab() {
  const { data: items = [], isLoading } = useSWR('business-units', getBusinessUnits);
  const [modal,     setModal]     = useState<{ type: 'add' } | { type: 'edit'; item: BusinessUnit } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  const refresh = () => void globalMutate('business-units');

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try { await deleteBusinessUnit(id); setConfirmId(null); refresh(); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#475569' }}>{items.length} business unit{items.length !== 1 ? 's' : ''}</span>
        <button style={ADD_BTN} onClick={() => setModal({ type: 'add' })}>
          <Plus size={13} /> Add Business Unit
        </button>
      </div>

      <TableShell
        columns={['Name', 'Address', 'Status', 'Actions']}
        grid="2fr 3fr 100px 110px"
        loading={isLoading}
        empty="No business units yet."
      >
        {items.map(item => (
          <div key={item.id} style={{
            display: 'grid', gridTemplateColumns: '2fr 3fr 100px 110px', gap: 16,
            padding: '13px 20px', alignItems: 'center',
            borderBottom: '1px solid rgba(148,163,184,0.04)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>{item.name}</span>
            <span style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.address}</span>
            <ActiveBadge active={item.isActive} />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => setModal({ type: 'edit', item })} title="Edit"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4, display: 'flex' }}>
                <Pencil size={14} />
              </button>
              <InlineDelete
                id={item.id} confirmId={confirmId} deleting={deleting}
                onRequest={() => setConfirmId(item.id)}
                onConfirm={() => handleDelete(item.id)}
                onCancel={() => setConfirmId(null)}
              />
            </div>
          </div>
        ))}
      </TableShell>

      {modal?.type === 'add'  && <BUModal onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} />}
      {modal?.type === 'edit' && <BUModal item={modal.item} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} />}
    </div>
  );
}

// ── Departments ────────────────────────────────────────────────────────────

function DeptModal({ item, businessUnits, onClose, onSaved }: {
  item?: Department; businessUnits: BusinessUnit[];
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name:           item?.name           ?? '',
    code:           item?.code           ?? '',
    businessUnitId: item?.businessUnitId ?? '',
    description:    item?.description    ?? '',
    isActive:       item?.isActive       ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: CreateDepartmentPayload = {
        name: form.name, code: form.code, businessUnitId: form.businessUnitId,
        ...(form.description ? { description: form.description } : {}),
      };
      if (item) {
        await updateDepartment(item.id, { ...payload, isActive: form.isActive });
      } else {
        await createDepartment(payload);
      }
      onSaved();
    } catch (err) {
      setError(apiErr(err));
    } finally {
      setSaving(false);
    }
  };

  const f = <K extends keyof typeof form>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <ModalShell title={item ? 'Edit Department' : 'Add Department'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={LABEL}>Name *</label>
            <input required style={FIELD} value={form.name} onChange={f('name')} placeholder="Engineering" />
          </div>
          <div>
            <label style={LABEL}>Code *</label>
            <input required style={FIELD} value={form.code}
              onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
              placeholder="ENG" maxLength={10} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={LABEL}>Business Unit *</label>
          <select required style={FIELD} value={form.businessUnitId} onChange={f('businessUnitId')}>
            <option value="">— Select Business Unit —</option>
            {businessUnits.filter(bu => bu.isActive).map(bu => (
              <option key={bu.id} value={bu.id}>{bu.name}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: item ? 14 : 20 }}>
          <label style={LABEL}>Description</label>
          <textarea rows={2} style={{ ...FIELD, resize: 'vertical' }} value={form.description}
            onChange={f('description')} placeholder="Optional…" />
        </div>
        {item && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isActive}
                onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: '#6366f1' }} />
              <span style={{ fontSize: 13, color: '#94a3b8' }}>Active</span>
            </label>
          </div>
        )}
        {error && <ErrorBanner msg={error} />}
        <FormActions saving={saving} onCancel={onClose} label={item ? 'Save Changes' : 'Create'} />
      </form>
    </ModalShell>
  );
}

function DepartmentsTab() {
  const { data: items = [],        isLoading } = useSWR('departments',   getDepartments);
  const { data: businessUnits = []           } = useSWR('business-units', getBusinessUnits);
  const [modal,     setModal]     = useState<{ type: 'add' } | { type: 'edit'; item: Department } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  const refresh = () => void globalMutate('departments');

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try { await deleteDepartment(id); setConfirmId(null); refresh(); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#475569' }}>{items.length} department{items.length !== 1 ? 's' : ''}</span>
        <button style={ADD_BTN} onClick={() => setModal({ type: 'add' })}>
          <Plus size={13} /> Add Department
        </button>
      </div>

      <TableShell
        columns={['Name', 'Code', 'Business Unit', 'Status', 'Actions']}
        grid="1.5fr 80px 1.5fr 100px 110px"
        loading={isLoading}
        empty="No departments yet."
      >
        {items.map(item => (
          <div key={item.id} style={{
            display: 'grid', gridTemplateColumns: '1.5fr 80px 1.5fr 100px 110px', gap: 16,
            padding: '13px 20px', alignItems: 'center',
            borderBottom: '1px solid rgba(148,163,184,0.04)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>{item.name}</span>
            <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{item.code}</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{item.businessUnit?.name ?? '—'}</span>
            <ActiveBadge active={item.isActive} />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => setModal({ type: 'edit', item })} title="Edit"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4, display: 'flex' }}>
                <Pencil size={14} />
              </button>
              <InlineDelete
                id={item.id} confirmId={confirmId} deleting={deleting}
                onRequest={() => setConfirmId(item.id)}
                onConfirm={() => handleDelete(item.id)}
                onCancel={() => setConfirmId(null)}
              />
            </div>
          </div>
        ))}
      </TableShell>

      {modal?.type === 'add'  && <DeptModal businessUnits={businessUnits} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} />}
      {modal?.type === 'edit' && <DeptModal item={modal.item} businessUnits={businessUnits} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} />}
    </div>
  );
}

// ── Teams ──────────────────────────────────────────────────────────────────

function TeamModal({ item, departments, onClose, onSaved }: {
  item?: Team; departments: Department[];
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name:         item?.name         ?? '',
    code:         item?.code         ?? '',
    departmentId: item?.departmentId ?? '',
    description:  item?.description  ?? '',
    projectFocus: item?.projectFocus ?? '',
    isActive:     item?.isActive     ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: CreateTeamPayload = {
        name: form.name, departmentId: form.departmentId,
        ...(form.code         ? { code:         form.code }         : {}),
        ...(form.description  ? { description:  form.description }  : {}),
        ...(form.projectFocus ? { projectFocus: form.projectFocus } : {}),
      };
      if (item) {
        await updateTeam(item.id, { ...payload, isActive: form.isActive });
      } else {
        await createTeam(payload);
      }
      onSaved();
    } catch (err) {
      setError(apiErr(err));
    } finally {
      setSaving(false);
    }
  };

  const f = <K extends keyof typeof form>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <ModalShell title={item ? 'Edit Team' : 'Add Team'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={LABEL}>Name *</label>
            <input required style={FIELD} value={form.name} onChange={f('name')} placeholder="Backend" />
          </div>
          <div>
            <label style={LABEL}>Code</label>
            <input style={FIELD} value={form.code}
              onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
              placeholder="ENG-BE" maxLength={20} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={LABEL}>Department *</label>
          <select required style={FIELD} value={form.departmentId} onChange={f('departmentId')}>
            <option value="">— Select Department —</option>
            {departments.filter(d => d.isActive).map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={LABEL}>Project Focus</label>
          <input style={FIELD} value={form.projectFocus} onChange={f('projectFocus')} placeholder="Payment Gateway v2…" />
        </div>
        <div style={{ marginBottom: item ? 14 : 20 }}>
          <label style={LABEL}>Description</label>
          <textarea rows={2} style={{ ...FIELD, resize: 'vertical' }} value={form.description}
            onChange={f('description')} placeholder="Optional…" />
        </div>
        {item && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isActive}
                onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: '#6366f1' }} />
              <span style={{ fontSize: 13, color: '#94a3b8' }}>Active</span>
            </label>
          </div>
        )}
        {error && <ErrorBanner msg={error} />}
        <FormActions saving={saving} onCancel={onClose} label={item ? 'Save Changes' : 'Create'} />
      </form>
    </ModalShell>
  );
}

function TeamsTab() {
  const { data: items = [],        isLoading } = useSWR('teams',       getTeams);
  const { data: departments = []             } = useSWR('departments', getDepartments);
  const [modal,     setModal]     = useState<{ type: 'add' } | { type: 'edit'; item: Team } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  const refresh = () => void globalMutate('teams');

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try { await deleteTeam(id); setConfirmId(null); refresh(); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#475569' }}>{items.length} team{items.length !== 1 ? 's' : ''}</span>
        <button style={ADD_BTN} onClick={() => setModal({ type: 'add' })}>
          <Plus size={13} /> Add Team
        </button>
      </div>

      <TableShell
        columns={['Name', 'Code', 'Department', 'Status', 'Actions']}
        grid="1.5fr 90px 1.5fr 100px 110px"
        loading={isLoading}
        empty="No teams yet."
      >
        {items.map(item => (
          <div key={item.id} style={{
            display: 'grid', gridTemplateColumns: '1.5fr 90px 1.5fr 100px 110px', gap: 16,
            padding: '13px 20px', alignItems: 'center',
            borderBottom: '1px solid rgba(148,163,184,0.04)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>{item.name}</span>
            <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{item.code ?? '—'}</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{item.department?.name ?? '—'}</span>
            <ActiveBadge active={item.isActive} />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => setModal({ type: 'edit', item })} title="Edit"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4, display: 'flex' }}>
                <Pencil size={14} />
              </button>
              <InlineDelete
                id={item.id} confirmId={confirmId} deleting={deleting}
                onRequest={() => setConfirmId(item.id)}
                onConfirm={() => handleDelete(item.id)}
                onCancel={() => setConfirmId(null)}
              />
            </div>
          </div>
        ))}
      </TableShell>

      {modal?.type === 'add'  && <TeamModal departments={departments} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} />}
      {modal?.type === 'edit' && <TeamModal item={modal.item} departments={departments} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} />}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type TabId = 'bu' | 'departments' | 'teams';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'bu',          label: 'Business Units', icon: <Building2 size={14} /> },
  { id: 'departments', label: 'Departments',    icon: <FolderOpen size={14} /> },
  { id: 'teams',       label: 'Teams',          icon: <Users size={14} /> },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const [tab, setTab] = useState<TabId>('bu');

  if (!hasRole(roles, ['HR_ADMIN'])) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80, color: '#475569', fontSize: 14 }}>
        Access restricted to HR Admins.
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          Settings
        </h1>
        <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>Manage your organisation structure</p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, background: 'rgba(15,23,42,0.6)',
        border: '1px solid rgba(148,163,184,0.08)', borderRadius: 12,
        padding: 4, width: 'fit-content', marginBottom: 24,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 18px', borderRadius: 8, border: 'none',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              fontSize: 12, fontWeight: tab === t.id ? 600 : 400,
              background: tab === t.id ? '#6366f1' : 'transparent',
              color: tab === t.id ? 'white' : '#64748b',
              transition: 'all 0.15s',
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'bu'          && <BusinessUnitsTab />}
      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'teams'       && <TeamsTab />}
    </div>
  );
}
