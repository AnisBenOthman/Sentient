'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, CalendarDays, GitBranch,
  Settings, LogOut, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { roleLabel, hasRole } from '@/lib/auth';

const NAV = [
  { href: '/dashboard',  label: 'Dashboard', icon: LayoutDashboard, roles: [] },
  { href: '/employees',  label: 'Employees', icon: Users,            roles: [] },
  { href: '/leaves',     label: 'Leaves',    icon: CalendarDays,     roles: [] },
  { href: '/org-chart',  label: 'Org Chart', icon: GitBranch,        roles: ['HR_ADMIN', 'EXECUTIVE'] },
];

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#6366f1','#8b5cf6','#ec4899','#06b6d4','#10b981'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const bg = colors[Math.abs(h) % colors.length]!;
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 10,
      background: bg, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: 12, fontWeight: 700,
      color: 'white', flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const roles = user?.roles ?? [];
  const displayName = user ? `User ${user.sub.slice(0, 6)}` : '—';

  const visibleNav = NAV.filter(n => n.roles.length === 0 || hasRole(roles, n.roles));

  return (
    <aside style={{
      width: 240, height: '100vh', position: 'fixed', left: 0, top: 0,
      background: '#0a0d1f',
      borderRight: '1px solid rgba(148,163,184,0.07)',
      display: 'flex', flexDirection: 'column',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            boxShadow: '0 0 20px rgba(99,102,241,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="2.8" fill="white"/>
              <path d="M9 2 L15.5 5.75 L15.5 12.25 L9 16 L2.5 12.25 L2.5 5.75 Z" stroke="rgba(255,255,255,0.4)" strokeWidth="1" fill="none"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.02em' }}>Sentient</div>
            <div style={{ fontSize: 10, color: '#4f46e5', fontWeight: 600, letterSpacing: '0.04em' }}>HRIS PLATFORM</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {visibleNav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href} href={href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: active ? '#a5b4fc' : '#64748b',
                textDecoration: 'none', fontSize: 13, fontWeight: active ? 600 : 400,
                transition: 'all 0.15s',
                border: active ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
              }}
            >
              <Icon size={16} />
              {label}
              {active && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
            </Link>
          );
        })}

        {hasRole(roles, ['HR_ADMIN', 'SYSTEM_ADMIN']) && (
          <div style={{ marginTop: 16, padding: '0 4px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Admin</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, color: '#334155', fontSize: 13 }}>
              <Settings size={16} />
              Settings
              <span style={{ marginLeft: 'auto', fontSize: 9, background: 'rgba(99,102,241,0.1)', color: '#475569', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>SOON</span>
            </div>
          </div>
        )}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(148,163,184,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10 }}>
          <Avatar name={displayName} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
            <div style={{ fontSize: 10, color: '#475569' }}>{roleLabel(roles)}</div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', padding: 4, borderRadius: 6, flexShrink: 0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#475569'; }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
