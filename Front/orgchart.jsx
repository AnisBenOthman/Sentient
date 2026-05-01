// orgchart.jsx — Org Chart Page
const { useState } = React;

function TeamSlideOver({ team, onClose, onNavigateEmployee }) {
  const members = (window.employeesMutable||[]).filter(e => e.teamId === team.id && e.employmentStatus !== 'TERMINATED');
  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, display:'flex', justifyContent:'flex-end' }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(2,6,23,0.6)', backdropFilter:'blur(4px)' }} onClick={onClose} />
      <div className="animate-slide-right" style={{
        position:'relative', width:360, height:'100vh', background:'#0f172a',
        borderLeft:'1px solid rgba(148,163,184,0.1)', boxShadow:'-20px 0 60px rgba(0,0,0,0.5)',
        display:'flex', flexDirection:'column', zIndex:1,
      }}>
        {/* Header */}
        <div style={{ padding:'24px 24px 20px', borderBottom:'1px solid rgba(148,163,184,0.08)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:'#6366f1' }} />
              <span style={{ fontSize:11, fontWeight:600, color:'#6366f1', textTransform:'uppercase', letterSpacing:'0.06em' }}>{team.code}</span>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#475569', padding:6, borderRadius:8, display:'flex' }}>
              <SvgX size={16} />
            </button>
          </div>
          <h2 style={{ fontSize:18, fontWeight:700, color:'#f1f5f9', margin:'0 0 4px' }}>{team.name}</h2>
          {team.projectFocus && <p style={{ fontSize:13, color:'#475569', margin:0 }}>{team.projectFocus}</p>}
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <span style={{ fontSize:12, color:'#64748b', background:'rgba(30,41,59,0.6)', padding:'3px 10px', borderRadius:6, border:'1px solid rgba(148,163,184,0.08)' }}>
              {members.length} member{members.length!==1?'s':''}
            </span>
            {team.leadVacant ? (
              <span style={{ fontSize:12, color:'#f87171', background:'rgba(239,68,68,0.1)', padding:'3px 10px', borderRadius:6, border:'1px solid rgba(239,68,68,0.2)' }}>Lead Vacant</span>
            ) : (
              <span style={{ fontSize:12, color:'#34d399', background:'rgba(16,185,129,0.1)', padding:'3px 10px', borderRadius:6, border:'1px solid rgba(16,185,129,0.2)' }}>Lead: {team.leadName}</span>
            )}
          </div>
        </div>

        {/* Members */}
        <div style={{ flex:1, overflowY:'auto', padding:16 }}>
          <p style={{ fontSize:11, fontWeight:600, color:'#334155', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 12px 4px' }}>Team Members</p>
          {members.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 0', color:'#334155' }}>No active members</div>
          )}
          {members.map(emp => (
            <div key={emp.id} style={{
              display:'flex', alignItems:'center', gap:12, padding:'12px 14px', marginBottom:6,
              background:'rgba(30,41,59,0.3)', border:'1px solid rgba(148,163,184,0.06)', borderRadius:12,
            }}>
              <EmployeeAvatar firstName={emp.firstName} lastName={emp.lastName} size="sm" />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, color:'#e2e8f0' }}>{emp.firstName} {emp.lastName}</div>
                <div style={{ fontSize:11, color:'#475569' }}>{emp.positionTitle||'—'}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {emp.id === team.leadId && (
                  <span style={{ fontSize:10, color:'#6366f1', background:'rgba(99,102,241,0.1)', padding:'2px 7px', borderRadius:5, fontWeight:600 }}>LEAD</span>
                )}
                <button onClick={() => onNavigateEmployee(emp.id)} style={{
                  background:'none', border:'1px solid rgba(148,163,184,0.15)', borderRadius:8,
                  color:'#64748b', fontSize:12, padding:'4px 10px', cursor:'pointer', fontFamily:'Inter,sans-serif',
                  display:'flex', alignItems:'center', gap:4,
                }}
                onMouseEnter={e=>{ e.currentTarget.style.background='rgba(99,102,241,0.1)'; e.currentTarget.style.color='#a5b4fc'; }}
                onMouseLeave={e=>{ e.currentTarget.style.background='none'; e.currentTarget.style.color='#64748b'; }}>
                  <SvgEye size={12} /> View
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeptCard({ dept }) {
  return (
    <div style={{
      background:'rgba(15,23,42,0.9)', border:'1px solid rgba(148,163,184,0.1)',
      borderLeft:'3px solid #6366f1', borderRadius:14, padding:'16px 20px', minWidth:200,
      boxShadow:'0 4px 24px rgba(0,0,0,0.3)',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <span style={{ fontSize:15, fontWeight:700, color:'#f1f5f9' }}>{dept.name}</span>
        <span style={{ fontSize:10, fontWeight:700, background:'rgba(99,102,241,0.15)', color:'#a5b4fc', padding:'3px 8px', borderRadius:5, letterSpacing:'0.05em' }}>{dept.code}</span>
      </div>
      {dept.headName ? (
        <div style={{ fontSize:12, color:'#64748b' }}>Head: <span style={{ color:'#94a3b8' }}>{dept.headName}</span></div>
      ) : (
        <span style={{ fontSize:12, color:'#f87171', background:'rgba(239,68,68,0.1)', padding:'2px 8px', borderRadius:5 }}>Vacant</span>
      )}
      <div style={{ fontSize:11, color:'#475569', marginTop:6 }}>{dept.teams.length} team{dept.teams.length!==1?'s':''}</div>
    </div>
  );
}

function TeamCard({ team, onClick }) {
  const memberCount = (window.employeesMutable||[]).filter(e => e.teamId === team.id && e.employmentStatus !== 'TERMINATED').length;
  return (
    <div onClick={onClick} style={{
      background:'rgba(15,23,42,0.7)', border:'1px solid rgba(148,163,184,0.08)',
      borderLeft:'2px solid rgba(100,116,139,0.4)', borderRadius:12, padding:'13px 16px',
      cursor:'pointer', transition:'all 0.15s', minWidth:180,
    }}
    onMouseEnter={e=>{ e.currentTarget.style.background='rgba(99,102,241,0.08)'; e.currentTarget.style.borderLeftColor='#6366f1'; e.currentTarget.style.boxShadow='0 4px 20px rgba(99,102,241,0.15)'; }}
    onMouseLeave={e=>{ e.currentTarget.style.background='rgba(15,23,42,0.7)'; e.currentTarget.style.borderLeftColor='rgba(100,116,139,0.4)'; e.currentTarget.style.boxShadow='none'; }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
        <span style={{ fontSize:13, fontWeight:600, color:'#e2e8f0' }}>{team.name}</span>
        <span style={{ fontSize:10, fontWeight:700, background:'rgba(30,41,59,0.8)', color:'#475569', padding:'2px 6px', borderRadius:4 }}>{team.code}</span>
      </div>
      {team.leadVacant ? (
        <div style={{ fontSize:11, color:'#f87171', marginBottom:4 }}>Lead: <em>Vacant</em></div>
      ) : (
        <div style={{ fontSize:11, color:'#64748b', marginBottom:4 }}>Lead: {team.leadName}</div>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8 }}>
        <div style={{ display:'flex', gap:-4 }}>
          {(window.employeesMutable||[]).filter(e=>e.teamId===team.id&&e.employmentStatus!=='TERMINATED').slice(0,4).map(emp => (
            <div key={emp.id} style={{ marginLeft:-4 }}>
              <EmployeeAvatar firstName={emp.firstName} lastName={emp.lastName} size="xs" />
            </div>
          ))}
        </div>
        <span style={{ fontSize:11, color:'#6366f1', fontWeight:600 }}>{memberCount} member{memberCount!==1?'s':''}</span>
      </div>
    </div>
  );
}

// Connector line SVG between nodes
function Connector({ vertical=false }) {
  if(vertical) return (
    <div style={{ width:2, height:32, background:'linear-gradient(to bottom, rgba(99,102,241,0.4), rgba(100,116,139,0.2))', margin:'0 auto', borderRadius:2 }} />
  );
  return (
    <div style={{ height:2, background:'linear-gradient(to right, rgba(99,102,241,0.4), rgba(100,116,139,0.2))', borderRadius:2 }} />
  );
}

function OrgChartPage({ onNavigateEmployee }) {
  const [selectedTeam, setSelectedTeam] = useState(null);
  const lastUpdated = 'Apr 28, 2026, 09:00 AM';

  const totalEmps = (window.employeesMutable||[]).filter(e=>e.employmentStatus!=='TERMINATED').length;

  return (
    <Page>
      <PageHeader
        title="Organization Chart"
        subtitle={`Last updated ${lastUpdated} · ${totalEmps} active employees`}
      />

      <div style={{ overflowX:'auto', paddingBottom:32 }}>
        {/* Root node */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
          <div style={{
            background:'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))',
            border:'1px solid rgba(99,102,241,0.4)', borderRadius:16, padding:'18px 40px',
            textAlign:'center', boxShadow:'0 0 40px rgba(99,102,241,0.15)',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, justifyContent:'center' }}>
              <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg, #6366f1, #8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 16px rgba(99,102,241,0.4)' }}>
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="3" fill="white"/>
                  <path d="M9 2 L15.5 5.75 L15.5 12.25 L9 16 L2.5 12.25 L2.5 5.75 Z" stroke="rgba(255,255,255,0.4)" strokeWidth="1" fill="none"/>
                </svg>
              </div>
              <span style={{ fontSize:20, fontWeight:800, color:'#f1f5f9', letterSpacing:'-0.02em' }}>Sentient</span>
            </div>
            <p style={{ fontSize:12, color:'#6366f1', margin:'6px 0 0', fontWeight:500 }}>Intelligent HR Platform</p>
          </div>

          <Connector vertical />

          {/* Departments row */}
          <div style={{ display:'flex', gap:0, alignItems:'flex-start', position:'relative' }}>
            {/* Horizontal line spanning departments */}
            <div style={{ position:'absolute', top:0, left:'25%', right:'25%', height:2, background:'linear-gradient(to right, rgba(99,102,241,0.4), rgba(100,116,139,0.3), rgba(99,102,241,0.4))', zIndex:0 }} />

            {MOCK_DEPARTMENTS.map((dept, di) => (
              <div key={dept.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'0 20px', minWidth:300 }}>
                {/* Vertical drop to dept */}
                <Connector vertical />

                <DeptCard dept={dept} />

                <Connector vertical />

                {/* Teams row under dept */}
                <div style={{ display:'flex', gap:12, alignItems:'flex-start', flexWrap:'wrap', justifyContent:'center' }}>
                  {dept.teams.map((team, ti) => (
                    <div key={team.id} style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                      {dept.teams.length > 1 && (
                        <div style={{ width:2, height:16, background:'rgba(100,116,139,0.3)', margin:'0 auto' }} />
                      )}
                      <TeamCard team={team} onClick={() => setSelectedTeam(team)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team slide-over */}
      {selectedTeam && (
        <TeamSlideOver
          team={selectedTeam}
          onClose={() => setSelectedTeam(null)}
          onNavigateEmployee={(id) => { setSelectedTeam(null); onNavigateEmployee(id); }}
        />
      )}
    </Page>
  );
}

window.OrgChartPage = OrgChartPage;
