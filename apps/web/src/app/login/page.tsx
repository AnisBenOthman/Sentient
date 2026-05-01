'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { login as apiLogin } from '@/lib/api/hr-core';
import { Eye, EyeOff, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

// ── Animated mesh canvas ──────────────────────────────────────────────────
function MeshCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf: number;
    let w = 0, h = 0;

    const resize = () => {
      w = canvas.width  = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const nodes = Array.from({ length: 28 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 2 + 1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i]!.x - nodes[j]!.x;
          const dy = nodes[i]!.y - nodes[j]!.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 160) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(99,102,241,${0.18 * (1 - dist / 160)})`;
            ctx.lineWidth = 0.7;
            ctx.moveTo(nodes[i]!.x, nodes[i]!.y);
            ctx.lineTo(nodes[j]!.x, nodes[j]!.y);
            ctx.stroke();
          }
        }
      }
      nodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(139,92,246,0.7)';
        ctx.fill();
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  );
}

// ── Floating stat pill ────────────────────────────────────────────────────
function StatPill({
  icon, label, value, style,
}: {
  icon: string; label: string; value: string;
  style: React.CSSProperties;
}) {
  return (
    <div style={{
      position: 'absolute', display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(16px)',
      border: '1px solid rgba(99,102,241,0.2)', borderRadius: 40,
      padding: '10px 18px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      ...style,
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.4 }}>{value}</div>
      </div>
    </div>
  );
}

const DEMO_ACCOUNTS = [
  { label: 'HR Admin',  email: 'hradmin@sentient.dev',  color: '#6366f1', badge: 'Full access' },
  { label: 'Manager',   email: 'manager@sentient.dev',  color: '#8b5cf6', badge: 'Team view'   },
  { label: 'Employee',  email: 'employee@sentient.dev', color: '#06b6d4', badge: 'Self-service' },
];

// ── Login form — needs Suspense because it reads useSearchParams ──────────
function LoginContent() {
  const { login } = useAuth();
  const router     = useRouter();
  const params     = useSearchParams();

  const [email,   setEmail]   = useState('');
  const [pw,      setPw]      = useState('');
  const [showPw,  setShowPw]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [focused, setFocused] = useState<string | null>(null);

  const inputStyle = (name: string): React.CSSProperties => ({
    width: '100%',
    background: focused === name ? 'rgba(99,102,241,0.06)' : 'rgba(15,23,42,0.6)',
    border: `1.5px solid ${focused === name ? 'rgba(99,102,241,0.55)' : 'rgba(148,163,184,0.1)'}`,
    borderRadius: 12, padding: '12px 14px', fontSize: 14, color: '#f1f5f9',
    outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif',
    transition: 'all 0.2s',
    boxShadow: focused === name ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !pw) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    try {
      const { accessToken, refreshToken } = await apiLogin(email, pw);
      login(accessToken, refreshToken);
      const from = params.get('from') ?? '/dashboard';
      router.replace(from);
    } catch (err: unknown) {
      const status = (err as { response?: { status: number } }).response?.status;
      if (status === 401) {
        setError('Invalid email or password. Try a demo account below.');
      } else {
        setError('Server error — make sure the backend is running on port 3001.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#020617', fontFamily: 'Inter, sans-serif' }}>

      {/* LEFT PANEL */}
      <div style={{
        flex: 1, position: 'relative', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        background: 'linear-gradient(145deg, #06091a 0%, #0d1130 50%, #0a0d1f 100%)',
        padding: 48,
      }}>
        <MeshCanvas />
        <div style={{ position: 'absolute', top: '15%', left: '20%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '10%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 420 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 22,
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            boxShadow: '0 0 60px rgba(99,102,241,0.45), 0 0 120px rgba(99,102,241,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px',
          }}>
            <svg width="34" height="34" viewBox="0 0 18 18" fill="none">
              <path d="M9 2 L15.5 5.75 L15.5 12.25 L9 16 L2.5 12.25 L2.5 5.75 Z" stroke="rgba(255,255,255,0.3)" strokeWidth="1" fill="none"/>
              <circle cx="9" cy="9" r="2.8" fill="white"/>
              <line x1="9" y1="3" x2="9" y2="6.2" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="9" y1="11.8" x2="9" y2="15" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="3" y1="9" x2="6.2" y2="9" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="11.8" y1="9" x2="15" y2="9" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>

          <h1 style={{ fontSize: 42, fontWeight: 800, color: '#f8fafc', margin: '0 0 14px', letterSpacing: '-0.04em', lineHeight: 1.05 }}>
            The HR platform<br />
            <span style={{ background: 'linear-gradient(90deg, #818cf8, #a78bfa, #c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              that thinks.
            </span>
          </h1>
          <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.7, margin: 0 }}>
            Sentient gives your HR team an intelligent co-pilot — tracking people, performance, and culture in real time.
          </p>
          <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: 2, margin: '28px auto' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start', textAlign: 'left' }}>
            {[
              { icon: '◈', label: 'Smart leave management & approvals' },
              { icon: '◉', label: 'Org chart with live presence signals'  },
              { icon: '◈', label: 'Role-based access for every team size' },
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: '#6366f1', fontSize: 16 }}>{f.icon}</span>
                <span style={{ fontSize: 13, color: '#64748b' }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <StatPill icon="👥" label="Active employees" value="1,284" style={{ top: '12%', right: '8%', animation: 'float-a 5s ease-in-out infinite' }} />
        <StatPill icon="✅" label="Leaves approved"  value="98.2%" style={{ bottom: '15%', left: '6%', animation: 'float-b 6s ease-in-out infinite' }} />
        <StatPill icon="⚡" label="Avg. response"    value="4 min"  style={{ bottom: '30%', right: '5%', animation: 'float-a 7s ease-in-out infinite 1s' }} />
      </div>

      {/* RIGHT PANEL */}
      <div style={{
        width: 480, flexShrink: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(9,12,28,0.95)',
        borderLeft: '1px solid rgba(148,163,184,0.07)',
        padding: '48px 44px', position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #6366f1, #8b5cf6, transparent)' }} />

        <div style={{ width: '100%', maxWidth: 360 }} className="animate-fade-in">
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
              Workspace login
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px', letterSpacing: '-0.03em' }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>Sign in to continue to your dashboard.</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: 7 }}>Work email</label>
              <input
                type="email" placeholder="you@company.com"
                value={email} onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                style={inputStyle('email')} required
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>Password</label>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'} placeholder="••••••••"
                  value={pw} onChange={e => setPw(e.target.value)}
                  onFocus={() => setFocused('pw')} onBlur={() => setFocused(null)}
                  style={{ ...inputStyle('pw'), paddingRight: 44 }} required
                />
                <button
                  type="button" onClick={() => setShowPw(p => !p)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', padding: 4 }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, marginBottom: 12, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}>
                <AlertCircle size={14} style={{ color: '#f87171', flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit" disabled={loading}
              className="btn-primary-glow"
              style={{
                width: '100%', marginTop: 20, padding: '13px', borderRadius: 12, border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? '#3730a3' : 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
                color: 'white', fontSize: 14, fontWeight: 600, fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: loading ? 0.75 : 1, letterSpacing: '0.01em',
              }}
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Signing in…</>
                : <>Sign in <ArrowRight size={14} /></>
              }
            </button>
          </form>

          {/* Separator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(148,163,184,0.08)' }} />
            <span style={{ fontSize: 11, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Demo accounts</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(148,163,184,0.08)' }} />
          </div>

          {/* Demo buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DEMO_ACCOUNTS.map(d => (
              <button
                key={d.email}
                onClick={() => { setEmail(d.email); setPw('Sentient@2026!'); setError(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', borderRadius: 11,
                  border: `1px solid ${d.color}28`, background: `${d.color}0d`,
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${d.color}1f`; e.currentTarget.style.borderColor = `${d.color}50`; }}
                onMouseLeave={e => { e.currentTarget.style.background = `${d.color}0d`; e.currentTarget.style.borderColor = `${d.color}28`; }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 10, background: `${d.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: d.color, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {d.label.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>{d.label}</div>
                  <div style={{ fontSize: 11, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.email}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: d.color, background: `${d.color}18`, padding: '3px 8px', borderRadius: 20, flexShrink: 0 }}>{d.badge}</span>
              </button>
            ))}
            <p style={{ fontSize: 11, color: '#1e293b', marginTop: 4, textAlign: 'center' }}>
              Password: <code style={{ color: '#475569', background: 'rgba(71,85,105,0.15)', padding: '1px 5px', borderRadius: 4 }}>Sentient@2026!</code>
            </p>
          </div>
        </div>

        <p style={{ position: 'absolute', bottom: 24, fontSize: 11, color: '#1e293b' }}>
          © 2026 Sentient HR Platform · v1.0.0
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#020617' }} />}>
      <LoginContent />
    </Suspense>
  );
}
