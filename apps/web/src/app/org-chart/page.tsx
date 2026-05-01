'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { getOrgChart, getTeamMembers } from '@/lib/api/hr-core';
import type { OrgDepartment, OrgTeam, EmployeeProfile } from '@/lib/api/hr-core';
import { X, Eye } from 'lucide-react';

// ── Avatar ────────────────────────────────────────────────────────────────

function Avatar({ firstName, lastName, size = 32 }: { firstName: string; lastName: string; size?: number }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  const colors = ['#6366f1','#8b5cf6','#ec4899','#06b6d4','#10b981','#f59e0b'];
  const str = firstName + lastName;
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  const bg = colors[Math.abs(h) % colors.length]!;
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, color: 'white', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// ── Team SlideOver ────────────────────────────────────────────────────────

function TeamSlideOver({ team, onClose, onViewEmployee }: {
  team: OrgTeam; onClose: () => void; onViewEmployee: (id: string) => void;
}) {
  const { data: members = [], isLoading } = useSWR(
    `team-members-${team.id}`,
    () => getTeamMembers(team.id),
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="animate-slide-right" style={{ position: 'relative', width: 360, height: '100vh', background: '#0f172a', borderLeft: '1px solid rgba(148,163,184,0.1)', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', zIndex: 1 }}>
        {/* Header */}
        <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6366f1' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{team.code}</span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 6, borderRadius: 8, display: 'flex' }}>
              <X size={16} />
            </button>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>{team.name}</h2>
          {team.projectFocus && <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>{team.projectFocus}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <span style={{ fontSize: 12, color: '#64748b', background: 'rgba(30,41,59,0.6)', padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.08)' }}>
              {team.employeeCount} member{team.employeeCount !== 1 ? 's' : ''}
            </span>
            {team.leadVacant
              ? <span style={{ fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>Lead Vacant</span>
              : <span style={{ fontSize: 12, color: '#34d399', background: 'rgba(16,185,129,0.1)', padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(16,185,129,0.2)' }}>Active Lead</span>
            }
          </div>
        </div>

        {/* Members */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px 4px' }}>Team Members</p>
          {isLoading && <div style={{ color: '#475569', fontSize: 13, padding: 20, textAlign: 'center' }}>Loading…</div>}
          {!isLoading && members.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#334155' }}>No active members</div>
          )}
          {members.map(emp => (
            <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', marginBottom: 6, background: 'rgba(30,41,59,0.3)', border: '1px solid rgba(148,163,184,0.06)', borderRadius: 12 }}>
              <Avatar firstName={emp.firstName} lastName={emp.lastName} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>{emp.firstName} {emp.lastName}</div>
                <div style={{ fontSize: 11, color: '#475569' }}>{emp.position?.title ?? '—'}</div>
              </div>
              <button
                onClick={() => { onClose(); onViewEmployee(emp.id); }}
                style={{ background: 'none', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, color: '#64748b', fontSize: 12, padding: '4px 10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.1)'; (e.currentTarget as HTMLElement).style.color = '#a5b4fc'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#64748b'; }}
              >
                <Eye size={12} /> View
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Department Card ───────────────────────────────────────────────────────

function DeptCard({ dept }: { dept: OrgDepartment }) {
  return (
    <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(148,163,184,0.1)', borderLeft: '3px solid #6366f1', borderRadius: 14, padding: '16px 20px', minWidth: 200, boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{dept.name}</span>
        <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '3px 8px', borderRadius: 5, letterSpacing: '0.05em' }}>{dept.code}</span>
      </div>
      <div style={{ fontSize: 12, color: '#64748b' }}>
        {dept.headId ? 'Head assigned' : <span style={{ color: '#f87171' }}>Head vacant</span>}
      </div>
      <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>{dept.teams.length} team{dept.teams.length !== 1 ? 's' : ''}</div>
    </div>
  );
}

// ── Team Card ─────────────────────────────────────────────────────────────

function TeamCard({ team, onClick }: { team: OrgTeam; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(148,163,184,0.08)', borderLeft: '2px solid rgba(100,116,139,0.4)', borderRadius: 12, padding: '13px 16px', cursor: 'pointer', transition: 'all 0.15s', minWidth: 180 }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(99,102,241,0.08)'; el.style.borderLeftColor = '#6366f1'; el.style.boxShadow = '0 4px 20px rgba(99,102,241,0.15)'; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(15,23,42,0.7)'; el.style.borderLeftColor = 'rgba(100,116,139,0.4)'; el.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{team.name}</span>
        <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(30,41,59,0.8)', color: '#475569', padding: '2px 6px', borderRadius: 4 }}>{team.code}</span>
      </div>
      <div style={{ fontSize: 11, color: team.leadVacant ? '#f87171' : '#64748b', marginBottom: 8 }}>
        Lead: {team.leadVacant ? <em>Vacant</em> : 'Assigned'}
      </div>
      <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>{team.employeeCount} member{team.employeeCount !== 1 ? 's' : ''}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function OrgChartPage() {
  const router = useRouter();
  const { data: depts = [], isLoading } = useSWR('org-chart', getOrgChart);
  const [selectedTeam, setSelectedTeam] = useState<OrgTeam | null>(null);

  const totalActive = depts.reduce((sum, d) => sum + d.teams.reduce((s, t) => s + t.employeeCount, 0), 0);

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Organization Chart</h1>
        <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>{totalActive} active employees across {depts.length} departments</p>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>Loading org chart…</div>
      )}

      {!isLoading && (
        <div style={{ overflowX: 'auto', paddingBottom: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 'max-content' }}>
            {/* Root node */}
            <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 16, padding: '18px 40px', textAlign: 'center', boxShadow: '0 0 40px rgba(99,102,241,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(99,102,241,0.4)' }}>
                  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                    <circle cx="9" cy="9" r="3" fill="white"/>
                    <path d="M9 2 L15.5 5.75 L15.5 12.25 L9 16 L2.5 12.25 L2.5 5.75 Z" stroke="rgba(255,255,255,0.4)" strokeWidth="1" fill="none"/>
                  </svg>
                </div>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>Sentient</span>
              </div>
              <p style={{ fontSize: 12, color: '#6366f1', margin: '6px 0 0', fontWeight: 500 }}>Intelligent HR Platform</p>
            </div>

            {/* Connector down */}
            <div style={{ width: 2, height: 32, background: 'linear-gradient(to bottom, rgba(99,102,241,0.4), rgba(100,116,139,0.2))', margin: '0 auto', borderRadius: 2 }} />

            {/* Departments */}
            <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start', position: 'relative' }}>
              {/* Horizontal connector */}
              {depts.length > 1 && (
                <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 2, background: 'linear-gradient(to right, rgba(99,102,241,0.4), rgba(100,116,139,0.3), rgba(99,102,241,0.4))', zIndex: 0 }} />
              )}

              {depts.map(dept => (
                <div key={dept.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px', minWidth: 300 }}>
                  {/* Connector */}
                  <div style={{ width: 2, height: 32, background: 'linear-gradient(to bottom, rgba(99,102,241,0.4), rgba(100,116,139,0.2))', margin: '0 auto', borderRadius: 2 }} />

                  <DeptCard dept={dept} />

                  <div style={{ width: 2, height: 32, background: 'linear-gradient(to bottom, rgba(99,102,241,0.4), rgba(100,116,139,0.2))', margin: '0 auto', borderRadius: 2 }} />

                  {/* Teams */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {dept.teams.map(team => (
                      <div key={team.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {dept.teams.length > 1 && (
                          <div style={{ width: 2, height: 16, background: 'rgba(100,116,139,0.3)' }} />
                        )}
                        <TeamCard team={team} onClick={() => setSelectedTeam(team)} />
                      </div>
                    ))}
                    {dept.teams.length === 0 && (
                      <div style={{ fontSize: 12, color: '#334155', padding: '12px 20px' }}>No teams yet</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedTeam && (
        <TeamSlideOver
          team={selectedTeam}
          onClose={() => setSelectedTeam(null)}
          onViewEmployee={id => router.push(`/employees/${id}`)}
        />
      )}
    </div>
  );
}
