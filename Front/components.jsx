// components.jsx — Shared UI primitives
const { useState, useEffect, useRef, useCallback, createContext, useContext } = React;

// ─── App Context ──────────────────────────────────────────────────────────
const AppCtx = createContext(null);
window.useApp = () => useContext(AppCtx);
window.AppCtx = AppCtx;

// ─── Toast Context ────────────────────────────────────────────────────────
const ToastCtx = createContext(null);
window.useToast = () => useContext(ToastCtx);

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={add}>
      {children}
      <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, display:'flex', flexDirection:'column', gap:8 }}>
        {toasts.map(t => (
          <div key={t.id} className="animate-slide-right flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border"
            style={{
              background: '#0f172a',
              border: `1px solid ${t.type==='success'?'rgba(16,185,129,0.3)':t.type==='error'?'rgba(239,68,68,0.3)':'rgba(99,102,241,0.3)'}`,
              color: t.type==='success'?'#34d399':t.type==='error'?'#f87171':'#a5b4fc',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              minWidth: 260,
            }}>
            {t.type==='success' && <SvgCheck size={16} />}
            {t.type==='error' && <SvgAlert size={16} />}
            {t.type==='info' && <SvgInfo size={16} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
window.ToastProvider = ToastProvider;

// ─── Inline SVG Icons ─────────────────────────────────────────────────────
const s = (d, vb='0 0 24 24') => ({ size=20, className='', style={} }) => (
  <svg width={size} height={size} viewBox={vb} fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
    className={className} style={style}>{d}</svg>
);
const SvgDash    = s(<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></>);
const SvgUsers   = s(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>);
const SvgCal     = s(<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>);
const SvgNet     = s(<><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v4M12 11 6.5 17M12 11l5.5 6"/></>);
const SvgOut     = s(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>);
const SvgPlus    = s(<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>);
const SvgSearch  = s(<><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>);
const SvgEye     = s(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>);
const SvgChevL   = s(<><polyline points="15 18 9 12 15 6"/></>);
const SvgChevR   = s(<><polyline points="9 18 15 12 9 6"/></>);
const SvgChevD   = s(<><polyline points="6 9 12 15 18 9"/></>);
const SvgX       = s(<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>);
const SvgCheck   = s(<><polyline points="20 6 9 17 4 12"/></>);
const SvgAlert   = s(<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>);
const SvgInfo    = s(<><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>);
const SvgTrend   = s(<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>);
const SvgClock   = s(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>);
const SvgBuild   = s(<><path d="M3 21h18M9 21V7l9-4v18M9 12h.01M9 8h.01M9 16h.01"/></>);
const SvgBrief   = s(<><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></>);
const SvgShield  = s(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>);
const SvgZap     = s(<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>);
const SvgAward   = s(<><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></>);
const SvgFilter  = s(<><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>);
const SvgRefresh = s(<><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></>);
const SvgUser    = s(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>);
const SvgEdit    = s(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>);
const SvgDots    = s(<><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>);
const SvgCmd     = s(<><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></>);

window.Icons = { SvgDash,SvgUsers,SvgCal,SvgNet,SvgOut,SvgPlus,SvgSearch,SvgEye,SvgChevL,SvgChevR,SvgChevD,SvgX,SvgCheck,SvgAlert,SvgInfo,SvgTrend,SvgClock,SvgBuild,SvgBrief,SvgShield,SvgZap,SvgAward,SvgFilter,SvgRefresh,SvgUser,SvgEdit,SvgDots,SvgCmd };

// ─── Employee Avatar ───────────────────────────────────────────────────────
function EmployeeAvatar({ firstName='', lastName='', size='md' }) {
  const ini = getInitials(firstName, lastName);
  const col = hashColor(`${firstName}${lastName}`);
  const sz = { xs:'w-6 h-6 text-[10px]', sm:'w-8 h-8 text-xs', md:'w-9 h-9 text-sm', lg:'w-14 h-14 text-xl', xl:'w-20 h-20 text-3xl' }[size] || 'w-9 h-9 text-sm';
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}
      style={{ background:`${col}22`, border:`1.5px solid ${col}44`, color:col }}>
      {ini}
    </div>
  );
}
window.EmployeeAvatar = EmployeeAvatar;

// ─── Status Badge ──────────────────────────────────────────────────────────
function StatusBadge({ status, type='employment' }) {
  const maps = {
    employment: {
      ACTIVE:     'rgba(16,185,129,0.12) #34d399 rgba(16,185,129,0.25)',
      ON_LEAVE:   'rgba(245,158,11,0.12) #fbbf24 rgba(245,158,11,0.25)',
      PROBATION:  'rgba(59,130,246,0.12) #60a5fa rgba(59,130,246,0.25)',
      TERMINATED: 'rgba(100,116,139,0.12) #94a3b8 rgba(100,116,139,0.25)',
      RESIGNED:   'rgba(100,116,139,0.12) #94a3b8 rgba(100,116,139,0.25)',
    },
    leave: {
      PENDING:   'rgba(245,158,11,0.12) #fbbf24 rgba(245,158,11,0.25)',
      APPROVED:  'rgba(16,185,129,0.12) #34d399 rgba(16,185,129,0.25)',
      REJECTED:  'rgba(239,68,68,0.12) #f87171 rgba(239,68,68,0.25)',
      CANCELLED: 'rgba(100,116,139,0.12) #94a3b8 rgba(100,116,139,0.25)',
    },
    contract: {
      FULL_TIME:  'rgba(99,102,241,0.12) #a5b4fc rgba(99,102,241,0.25)',
      PART_TIME:  'rgba(168,85,247,0.12) #c4b5fd rgba(168,85,247,0.25)',
      INTERN:     'rgba(249,115,22,0.12) #fdba74 rgba(249,115,22,0.25)',
      CONTRACTOR: 'rgba(20,184,166,0.12) #5eead4 rgba(20,184,166,0.25)',
      FIXED_TERM: 'rgba(236,72,153,0.12) #f9a8d4 rgba(236,72,153,0.25)',
    },
  };
  const tokens = (maps[type]?.[status] || 'rgba(100,116,139,0.12) #94a3b8 rgba(100,116,139,0.25)').split(' ');
  const [bg, color, border] = tokens;
  const label = (status||'').replace(/_/g,' ');
  return (
    <span style={{ background:bg, color, border:`1px solid ${border}`, borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:500, whiteSpace:'nowrap' }}>
      {label}
    </span>
  );
}
window.StatusBadge = StatusBadge;

// ─── Modal ─────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, size='md' }) {
  useEffect(() => {
    const h = e => { if(e.key==='Escape') onClose(); };
    if(open) document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);
  if(!open) return null;
  const maxW = { sm:'440px', md:'540px', lg:'720px', xl:'900px' }[size] || '540px';
  return (
    <div style={{ position:'fixed',inset:0,zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div style={{ position:'absolute',inset:0,background:'rgba(2,6,23,0.75)',backdropFilter:'blur(8px)' }} onClick={onClose} />
      <div className="animate-scale-in" style={{ position:'relative',background:'#0f172a',border:'1px solid rgba(148,163,184,0.12)',borderRadius:20,boxShadow:'0 32px 80px rgba(0,0,0,0.7)',width:'100%',maxWidth:maxW,maxHeight:'90vh',overflow:'hidden',display:'flex',flexDirection:'column' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid rgba(148,163,184,0.08)' }}>
          <h2 style={{ fontSize:15,fontWeight:600,color:'#f1f5f9',margin:0 }}>{title}</h2>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'#64748b',padding:6,borderRadius:8,display:'flex',alignItems:'center' }} className="hover:bg-slate-800">
            <SvgX size={16} />
          </button>
        </div>
        <div style={{ padding:'20px 24px',overflowY:'auto' }}>{children}</div>
      </div>
    </div>
  );
}
window.Modal = Modal;

// ─── Skeleton ──────────────────────────────────────────────────────────────
function Sk({ w='100%', h=16, r=8 }) {
  return <div className="skeleton" style={{ width:w,height:h,borderRadius:r }} />;
}
window.Sk = Sk;

// ─── Data Table ────────────────────────────────────────────────────────────
function DataTable({ columns, data, pageSize=5, loading=false, emptyText='No records found' }) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [data.length]);
  const totalPages = Math.ceil(data.length / pageSize);
  const slice = data.slice(page * pageSize, (page+1) * pageSize);

  if(loading) return (
    <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
      {Array.from({length:pageSize}).map((_,i) => <Sk key={i} h={44} r={10} />)}
    </div>
  );

  return (
    <div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid rgba(148,163,184,0.1)' }}>
              {columns.map(c => (
                <th key={c.key} style={{ textAlign:'left',padding:'10px 14px',fontSize:11,fontWeight:500,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.05em',whiteSpace:'nowrap' }}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length===0 ? (
              <tr><td colSpan={columns.length} style={{ textAlign:'center',padding:'48px 0',color:'#475569',fontSize:14 }}>{emptyText}</td></tr>
            ) : slice.map((row, i) => (
              <tr key={row.id||i} style={{ borderBottom:'1px solid rgba(148,163,184,0.05)' }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(148,163,184,0.04)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                {columns.map(c => (
                  <td key={c.key} style={{ padding:'11px 14px',color:'#cbd5e1',verticalAlign:'middle' }}>
                    {c.render ? c.render(row) : (row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:16,paddingTop:16,borderTop:'1px solid rgba(148,163,184,0.08)' }}>
          <span style={{ fontSize:12,color:'#475569' }}>
            {page*pageSize+1}–{Math.min((page+1)*pageSize, data.length)} of {data.length}
          </span>
          <div style={{ display:'flex',gap:4,alignItems:'center' }}>
            <PgBtn onClick={() => setPage(p => Math.max(0,p-1))} disabled={page===0}><SvgChevL size={14}/></PgBtn>
            {Array.from({length:totalPages}).map((_,i) => (
              <PgBtn key={i} onClick={() => setPage(i)} active={i===page}>{i+1}</PgBtn>
            ))}
            <PgBtn onClick={() => setPage(p => Math.min(totalPages-1,p+1))} disabled={page===totalPages-1}><SvgChevR size={14}/></PgBtn>
          </div>
        </div>
      )}
    </div>
  );
}
function PgBtn({ onClick, disabled, active, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      minWidth:28,height:28,borderRadius:7,border:'none',cursor:disabled?'not-allowed':'pointer',
      background: active?'#6366f1':'transparent',
      color: active?'white':disabled?'#334155':'#64748b',
      fontSize:12,fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',opacity:disabled?0.35:1,
    }}
    onMouseEnter={e=>{ if(!active&&!disabled) e.currentTarget.style.background='rgba(148,163,184,0.08)'; }}
    onMouseLeave={e=>{ if(!active) e.currentTarget.style.background='transparent'; }}>
      {children}
    </button>
  );
}
window.DataTable = DataTable;

// ─── Form Primitives ───────────────────────────────────────────────────────
function FLabel({ children, required }) {
  return <label style={{ fontSize:12,fontWeight:500,color:'#94a3b8',display:'block',marginBottom:6 }}>{children}{required&&<span style={{color:'#f87171',marginLeft:2}}>*</span>}</label>;
}
function FInput({ label, error, required, ...props }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <FLabel required={required}>{label}</FLabel>}
      <input {...props} style={{
        width:'100%',background:'rgba(30,41,59,0.6)',border:`1px solid ${error?'rgba(239,68,68,0.5)':'rgba(148,163,184,0.12)'}`,
        borderRadius:10,padding:'9px 12px',fontSize:13,color:'#f1f5f9',outline:'none',boxSizing:'border-box',
        fontFamily:'Inter,sans-serif',
      }}
      onFocus={e=>{ e.target.style.borderColor='rgba(99,102,241,0.5)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)'; }}
      onBlur={e=>{ e.target.style.borderColor=error?'rgba(239,68,68,0.5)':'rgba(148,163,184,0.12)'; e.target.style.boxShadow='none'; }}
      />
      {error && <p style={{ fontSize:11,color:'#f87171',marginTop:4 }}>{error}</p>}
    </div>
  );
}
function FSelect({ label, error, required, options=[], ...props }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <FLabel required={required}>{label}</FLabel>}
      <select {...props} style={{
        width:'100%',background:'#1e293b',border:`1px solid ${error?'rgba(239,68,68,0.5)':'rgba(148,163,184,0.12)'}`,
        borderRadius:10,padding:'9px 12px',fontSize:13,color:'#f1f5f9',outline:'none',boxSizing:'border-box',
        fontFamily:'Inter,sans-serif',cursor:'pointer',
      }}
      onFocus={e=>{ e.target.style.borderColor='rgba(99,102,241,0.5)'; }}
      onBlur={e=>{ e.target.style.borderColor='rgba(148,163,184,0.12)'; }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p style={{ fontSize:11,color:'#f87171',marginTop:4 }}>{error}</p>}
    </div>
  );
}
function FTextarea({ label, error, required, ...props }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <FLabel required={required}>{label}</FLabel>}
      <textarea {...props} style={{
        width:'100%',background:'rgba(30,41,59,0.6)',border:`1px solid ${error?'rgba(239,68,68,0.5)':'rgba(148,163,184,0.12)'}`,
        borderRadius:10,padding:'9px 12px',fontSize:13,color:'#f1f5f9',outline:'none',boxSizing:'border-box',
        fontFamily:'Inter,sans-serif',resize:'vertical',minHeight:80,
      }}
      onFocus={e=>{ e.target.style.borderColor='rgba(99,102,241,0.5)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)'; }}
      onBlur={e=>{ e.target.style.borderColor='rgba(148,163,184,0.12)'; e.target.style.boxShadow='none'; }}
      />
      {error && <p style={{ fontSize:11,color:'#f87171',marginTop:4 }}>{error}</p>}
    </div>
  );
}
window.FInput = FInput;
window.FSelect = FSelect;
window.FTextarea = FTextarea;

// ─── Button ────────────────────────────────────────────────────────────────
function Btn({ variant='primary', size='md', children, style:extraStyle={}, ...props }) {
  const base = { display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,fontFamily:'Inter,sans-serif',fontWeight:500,borderRadius:10,border:'none',cursor:'pointer',transition:'all 0.15s',outline:'none' };
  const sizes = { sm:{ padding:'6px 12px',fontSize:12 }, md:{ padding:'9px 16px',fontSize:13 }, lg:{ padding:'12px 22px',fontSize:14 } }[size]||{};
  const variants = {
    primary:  { background:'#6366f1',color:'white',boxShadow:'0 1px 3px rgba(99,102,241,0.3)' },
    secondary:{ background:'rgba(30,41,59,0.8)',color:'#cbd5e1',border:'1px solid rgba(148,163,184,0.12)' },
    ghost:    { background:'transparent',color:'#94a3b8',border:'1px solid transparent' },
    danger:   { background:'rgba(239,68,68,0.1)',color:'#f87171',border:'1px solid rgba(239,68,68,0.25)' },
    success:  { background:'rgba(16,185,129,0.1)',color:'#34d399',border:'1px solid rgba(16,185,129,0.25)' },
    outline:  { background:'transparent',color:'#a5b4fc',border:'1px solid rgba(99,102,241,0.35)' },
  }[variant]||{};
  return (
    <button {...props} style={{ ...base,...sizes,...variants,...extraStyle,...(props.disabled?{opacity:0.4,cursor:'not-allowed'}:{}) }}
      onMouseEnter={e=>{ if(!props.disabled) e.currentTarget.style.filter='brightness(1.12)'; }}
      onMouseLeave={e=>{ e.currentTarget.style.filter='none'; }}>
      {children}
    </button>
  );
}
window.Btn = Btn;

// ─── Page container ────────────────────────────────────────────────────────
function Page({ children }) {
  return <div className="animate-fade-in" style={{ padding:'28px 32px',maxWidth:1280 }}>{children}</div>;
}
function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:28 }}>
      <div>
        <h1 style={{ fontSize:22,fontWeight:600,color:'#f1f5f9',margin:0,letterSpacing:'-0.01em' }}>{title}</h1>
        {subtitle && <p style={{ fontSize:13,color:'#64748b',marginTop:4 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display:'flex',gap:8,alignItems:'center' }}>{actions}</div>}
    </div>
  );
}
window.Page = Page;
window.PageHeader = PageHeader;

// ─── Card ──────────────────────────────────────────────────────────────────
function Card({ children, style={}, className='' }) {
  return (
    <div className={`card-glow ${className}`} style={{
      background:'rgba(15,23,42,0.8)',border:'1px solid rgba(148,163,184,0.08)',
      borderRadius:16,transition:'box-shadow 0.2s',...style
    }}>
      {children}
    </div>
  );
}
window.Card = Card;

Object.assign(window, { SvgDash,SvgUsers,SvgCal,SvgNet,SvgOut,SvgPlus,SvgSearch,SvgEye,SvgChevL,SvgChevR,SvgChevD,SvgX,SvgCheck,SvgAlert,SvgInfo,SvgTrend,SvgClock,SvgBuild,SvgBrief,SvgShield,SvgZap,SvgAward,SvgFilter,SvgRefresh,SvgUser,SvgEdit,SvgDots,SvgCmd });
