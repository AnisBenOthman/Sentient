// layout.jsx — Sidebar, Header, AppLayout
const { useState, useEffect, useRef, useCallback } = React;

// ─── Sentient Logo ────────────────────────────────────────────────────────
function SentientLogo({ size=32 }) {
  return (
    <div style={{
      width:size, height:size, borderRadius: size*0.28,
      background:'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      boxShadow:'0 0 20px rgba(99,102,241,0.45)',
      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
    }}>
      <svg width={size*0.56} height={size*0.56} viewBox="0 0 18 18" fill="none">
        <path d="M9 2 L15.5 5.75 L15.5 12.25 L9 16 L2.5 12.25 L2.5 5.75 Z" stroke="rgba(255,255,255,0.3)" strokeWidth="1" fill="none"/>
        <circle cx="9" cy="9" r="2.5" fill="white"/>
        <line x1="9" y1="3.5" x2="9" y2="6.5" stroke="white" strokeWidth="1" strokeLinecap="round"/>
        <line x1="9" y1="11.5" x2="9" y2="14.5" stroke="white" strokeWidth="1" strokeLinecap="round"/>
        <line x1="3.5" y1="9" x2="6.5" y2="9" stroke="white" strokeWidth="1" strokeLinecap="round"/>
        <line x1="11.5" y1="9" x2="14.5" y2="9" stroke="white" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────
function Sidebar({ currentPage, onNavigate }) {
  const { user, logout } = useApp();
  const emp = (window.employeesMutable||[]).find(e => e.id === user?.employeeId);

  const navItems = [
    { id:'dashboard', label:'Dashboard', Icon:SvgDash, roles:null },
    { id:'employees', label:'Employees', Icon:SvgUsers, roles:null },
    { id:'leaves', label:'Leave Management', Icon:SvgCal, roles:null },
    { id:'org-chart', label:'Org Chart', Icon:SvgNet, roles:['MANAGER','HR_ADMIN','EXECUTIVE'] },
  ];
  const adminItems = [
    { id:'skills-admin', label:'Skills', Icon:SvgAward },
    { id:'iam', label:'IAM & Roles', Icon:SvgShield },
    { id:'ai', label:'AI Assistants', Icon:SvgZap },
  ];
  const isAdmin = hasRole(user, ['HR_ADMIN','EXECUTIVE','SYSTEM_ADMIN']);

  return (
    <aside className="sidebar-glow" style={{
      position:'fixed', left:0, top:0, height:'100vh', width:240,
      background:'rgba(2,6,23,0.98)', borderRight:'1px solid rgba(148,163,184,0.07)',
      display:'flex', flexDirection:'column', zIndex:100,
    }}>
      {/* Logo */}
      <div style={{ padding:'20px 20px 18px', borderBottom:'1px solid rgba(148,163,184,0.07)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <SentientLogo size={34} />
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:'#f1f5f9', letterSpacing:'-0.01em' }}>Sentient</div>
            <div style={{ fontSize:10, color:'#475569', marginTop:1, letterSpacing:'0.03em' }}>INTELLIGENT HR</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'16px 12px', overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }}>
        <NavLabel>Main</NavLabel>
        {navItems
          .filter(item => !item.roles || hasRole(user, item.roles))
          .map(item => {
            const active = currentPage === item.id;
            return (
              <NavItem key={item.id} active={active} onClick={() => onNavigate(item.id)}>
                <item.Icon size={16} style={{ flexShrink:0 }} />
                {item.label}
              </NavItem>
            );
          })}

        {isAdmin && (
          <>
            <NavLabel style={{ marginTop:20 }}>Administration</NavLabel>
            {adminItems.map(item => (
              <div key={item.id} style={{
                display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10,
                fontSize:13, color:'#334155', cursor:'not-allowed',
              }}>
                <item.Icon size={16} style={{ flexShrink:0 }} />
                <span>{item.label}</span>
                <span style={{ marginLeft:'auto', fontSize:9, fontWeight:600, background:'rgba(51,65,85,0.5)', color:'#475569', padding:'2px 6px', borderRadius:4, letterSpacing:'0.04em' }}>SOON</span>
              </div>
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div style={{ padding:'12px', borderTop:'1px solid rgba(148,163,184,0.07)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, marginBottom:4 }}>
          {emp && <EmployeeAvatar firstName={emp.firstName} lastName={emp.lastName} size="sm" />}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:500, color:'#e2e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {emp ? `${emp.firstName} ${emp.lastName}` : 'User'}
            </div>
            <div style={{ fontSize:11, color:'#475569' }}>{roleLabel(user?.roles)}</div>
          </div>
        </div>
        <button onClick={logout} style={{
          width:'100%', display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
          borderRadius:10, border:'none', background:'transparent', cursor:'pointer',
          color:'#475569', fontSize:13, fontFamily:'Inter,sans-serif', transition:'all 0.15s',
        }}
        onMouseEnter={e=>{ e.currentTarget.style.background='rgba(239,68,68,0.08)'; e.currentTarget.style.color='#f87171'; }}
        onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#475569'; }}>
          <SvgOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function NavLabel({ children, style={} }) {
  return (
    <div style={{ fontSize:10, fontWeight:600, color:'#334155', textTransform:'uppercase', letterSpacing:'0.08em', padding:'4px 12px', ...style }}>
      {children}
    </div>
  );
}
function NavItem({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      width:'100%', display:'flex', alignItems:'center', gap:10,
      padding: active ? '9px 10px 9px 10px' : '9px 12px',
      borderRadius:10, border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif', fontSize:13,
      fontWeight: active ? 500 : 400, transition:'all 0.15s',
      background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
      color: active ? '#a5b4fc' : '#64748b',
      borderLeft: active ? '2px solid #6366f1' : '2px solid transparent',
    }}
    onMouseEnter={e=>{ if(!active){ e.currentTarget.style.background='rgba(148,163,184,0.06)'; e.currentTarget.style.color='#94a3b8'; } }}
    onMouseLeave={e=>{ if(!active){ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#64748b'; } }}>
      {children}
    </button>
  );
}

// ─── Top Header ───────────────────────────────────────────────────────────
function TopHeader({ onOpenCmd }) {
  const { user } = useApp();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });

  return (
    <header style={{
      position:'fixed', left:240, right:0, top:0, height:60, zIndex:90,
      background:'rgba(2,6,23,0.9)', backdropFilter:'blur(12px)',
      borderBottom:'1px solid rgba(148,163,184,0.07)',
      display:'flex', alignItems:'center', padding:'0 28px', gap:16,
    }}>
      <div style={{ flex:1, display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ fontSize:12, color:'#334155' }}>{dateStr}</div>
      </div>

      {/* Command palette hint */}
      <button onClick={onOpenCmd} style={{
        display:'flex', alignItems:'center', gap:8, padding:'6px 14px',
        background:'rgba(15,23,42,0.8)', border:'1px solid rgba(148,163,184,0.1)',
        borderRadius:10, cursor:'pointer', color:'#475569', fontSize:12, fontFamily:'Inter,sans-serif',
        transition:'all 0.15s',
      }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(99,102,241,0.35)'; e.currentTarget.style.color='#94a3b8'; }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(148,163,184,0.1)'; e.currentTarget.style.color='#475569'; }}>
        <SvgSearch size={13} />
        <span>Search...</span>
        <kbd style={{ marginLeft:4, background:'rgba(51,65,85,0.5)', border:'1px solid rgba(100,116,139,0.3)', borderRadius:5, padding:'1px 5px', fontSize:10, fontFamily:'inherit' }}>⌘K</kbd>
      </button>
    </header>
  );
}

// ─── Command Palette ──────────────────────────────────────────────────────
function CommandPalette({ open, onClose, onNavigate }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if(open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  const cmds = [
    { label:'Dashboard', page:'dashboard', icon:SvgDash },
    { label:'Employees', page:'employees', icon:SvgUsers },
    { label:'Leave Management', page:'leaves', icon:SvgCal },
    { label:'Org Chart', page:'org-chart', icon:SvgNet },
  ];
  const filtered = q ? cmds.filter(c => c.label.toLowerCase().includes(q.toLowerCase())) : cmds;

  if(!open) return null;
  return (
    <div className="cmd-backdrop" style={{ position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:100 }}>
      <div className="animate-scale-in" onClick={e=>e.stopPropagation()} style={{
        width:'100%', maxWidth:520, background:'#0f172a', border:'1px solid rgba(99,102,241,0.3)',
        borderRadius:16, boxShadow:'0 32px 80px rgba(0,0,0,0.8)', overflow:'hidden',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', borderBottom:'1px solid rgba(148,163,184,0.08)' }}>
          <SvgSearch size={16} style={{ color:'#6366f1', flexShrink:0 }} />
          <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)} placeholder="Search pages, employees..."
            onKeyDown={e=>{ if(e.key==='Escape') onClose(); }}
            style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:14, color:'#f1f5f9', fontFamily:'Inter,sans-serif' }}
          />
          <kbd style={{ background:'rgba(51,65,85,0.5)', border:'1px solid rgba(100,116,139,0.3)', borderRadius:5, padding:'2px 6px', fontSize:10, color:'#64748b', flexShrink:0 }}>ESC</kbd>
        </div>
        <div style={{ padding:8, maxHeight:320, overflowY:'auto' }}>
          {filtered.map(c => (
            <button key={c.page} onClick={() => { onNavigate(c.page); onClose(); }} style={{
              width:'100%', display:'flex', alignItems:'center', gap:12, padding:'11px 14px',
              borderRadius:10, border:'none', background:'transparent', cursor:'pointer',
              color:'#94a3b8', fontSize:13, fontFamily:'Inter,sans-serif', textAlign:'left',
            }}
            onMouseEnter={e=>{ e.currentTarget.style.background='rgba(99,102,241,0.1)'; e.currentTarget.style.color='#a5b4fc'; }}
            onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#94a3b8'; }}>
              <c.icon size={16} style={{ flexShrink:0 }} />
              {c.label}
            </button>
          ))}
          {filtered.length===0 && <div style={{ textAlign:'center', padding:'32px 0', color:'#475569', fontSize:13 }}>No results for "{q}"</div>}
        </div>
      </div>
      <div style={{ position:'fixed',inset:0,zIndex:-1 }} onClick={onClose} />
    </div>
  );
}

// ─── AppLayout ─────────────────────────────────────────────────────────────
function AppLayout({ children, currentPage, onNavigate }) {
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const h = e => {
      if((e.metaKey||e.ctrlKey) && e.key==='k') { e.preventDefault(); setCmdOpen(p=>!p); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  return (
    <div style={{ minHeight:'100vh', background:'#020617' }}>
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
      <TopHeader onOpenCmd={() => setCmdOpen(true)} />
      <main style={{ marginLeft:240, marginTop:60, minHeight:'calc(100vh - 60px)' }}>
        {children}
      </main>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onNavigate={onNavigate} />
    </div>
  );
}

window.AppLayout = AppLayout;
window.SentientLogo = SentientLogo;
