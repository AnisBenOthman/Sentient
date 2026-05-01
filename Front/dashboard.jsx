// dashboard.jsx — Dashboard Page
const { useState, useEffect } = React;

function StatCard({ icon: Icon, label, value, sub, color='#6366f1', delay=0 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div className="card-glow stat-glow" style={{
      background:'rgba(15,23,42,0.8)', border:'1px solid rgba(148,163,184,0.08)',
      borderRadius:16, padding:'22px 24px', display:'flex', flexDirection:'column', gap:16, transition:'all 0.2s',
      opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)', transition:'all 0.4s ease',
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div style={{ width:40, height:40, borderRadius:12, background:`${color}18`, border:`1px solid ${color}30`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={18} style={{ color }} />
        </div>
        {sub && <span style={{ fontSize:11, color:'#475569', background:'rgba(30,41,59,0.6)', padding:'3px 8px', borderRadius:6, border:'1px solid rgba(148,163,184,0.08)' }}>{sub}</span>}
      </div>
      <div>
        <div className="animate-count" style={{ fontSize:28, fontWeight:700, color:'#f1f5f9', letterSpacing:'-0.02em', lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:13, color:'#64748b', marginTop:6 }}>{label}</div>
      </div>
    </div>
  );
}

function LeaveDot({ color }) {
  return <span style={{ width:8, height:8, borderRadius:'50%', background:color||'#6366f1', display:'inline-block', flexShrink:0 }} />;
}

function RecentLeavesTable({ requests }) {
  const cols = [
    {
      key:'employee', header:'Employee',
      render: r => (
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <EmployeeAvatar firstName={r.employeeName.split(' ')[0]} lastName={r.employeeName.split(' ')[1]} size="sm" />
          <span style={{ fontSize:13, color:'#e2e8f0', fontWeight:500 }}>{r.employeeName}</span>
        </div>
      ),
    },
    {
      key:'type', header:'Type',
      render: r => (
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <LeaveDot color={r.leaveTypeColor} />
          <span style={{ fontSize:13 }}>{r.leaveTypeName}</span>
        </div>
      ),
    },
    {
      key:'period', header:'Period',
      render: r => <span style={{ fontSize:12, color:'#64748b', whiteSpace:'nowrap' }}>{formatDate(r.startDate)} → {formatDate(r.endDate)}</span>,
    },
    { key:'days', header:'Days', render: r => <span style={{ fontWeight:600, color:'#94a3b8' }}>{r.businessDays}d</span> },
    { key:'status', header:'Status', render: r => <StatusBadge status={r.status} type="leave" /> },
  ];

  return <DataTable columns={cols} data={requests} pageSize={5} />;
}

function QuickActionBtn({ icon: Icon, label, color='#6366f1', onClick }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:12, padding:'13px 16px', borderRadius:12,
      border:'1px solid rgba(148,163,184,0.08)', background:'rgba(15,23,42,0.6)', cursor:'pointer',
      width:'100%', fontFamily:'Inter,sans-serif', transition:'all 0.15s', textAlign:'left',
    }}
    onMouseEnter={e=>{ e.currentTarget.style.background=`${color}0f`; e.currentTarget.style.borderColor=`${color}30`; }}
    onMouseLeave={e=>{ e.currentTarget.style.background='rgba(15,23,42,0.6)'; e.currentTarget.style.borderColor='rgba(148,163,184,0.08)'; }}>
      <div style={{ width:34, height:34, borderRadius:10, background:`${color}18`, border:`1px solid ${color}28`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <Icon size={16} style={{ color }} />
      </div>
      <span style={{ fontSize:13, fontWeight:500, color:'#cbd5e1' }}>{label}</span>
      <SvgChevR size={14} style={{ color:'#334155', marginLeft:'auto' }} />
    </button>
  );
}

function DashboardPage({ onNavigate, onOpenAddEmployee, onOpenRequestLeave }) {
  const { user } = useApp();
  const isHR = hasRole(user, ['HR_ADMIN','EXECUTIVE']);
  const isMgr = hasRole(user, ['MANAGER']);
  const isEmp = !isHR && !isMgr;

  const activeEmployees = (window.employeesMutable||[]).filter(e => e.employmentStatus === 'ACTIVE');
  const pendingLeaves = (window.leaveRequestsMutable||[]).filter(r => r.status === 'PENDING');
  const myBalance = (window.MOCK_LEAVE_BALANCES?.[user?.employeeId] || [])[0];
  const myEmp = (window.employeesMutable||[]).find(e => e.id === user?.employeeId);

  // Scoped leave requests
  let shownRequests = [...(window.leaveRequestsMutable||[])].sort((a,b) => new Date(b.submittedAt)-new Date(a.submittedAt));
  if(isEmp) shownRequests = shownRequests.filter(r => r.employeeId === user?.employeeId);
  if(isMgr) {
    const teamIds = (window.employeesMutable||[]).filter(e => e.teamId === user?.teamId).map(e=>e.id);
    shownRequests = shownRequests.filter(r => teamIds.includes(r.employeeId));
  }
  shownRequests = shownRequests.slice(0,5);

  // Stats
  let stats = [];
  if(isHR) {
    stats = [
      { icon:SvgUsers, label:'Active Employees', value:activeEmployees.length, color:'#6366f1', sub:'This month' },
      { icon:SvgClock, label:'Pending Approvals', value:pendingLeaves.length, color:'#f59e0b', sub:'Needs action' },
      { icon:SvgBuild, label:'Departments', value:MOCK_DEPARTMENTS.length, color:'#06b6d4', sub:'Org units' },
      { icon:SvgBrief, label:'Open Positions', value:1, color:'#10b981', sub:'Hiring' },
    ];
  } else if(isMgr) {
    const teamMembers = (window.employeesMutable||[]).filter(e => e.teamId === user?.teamId);
    const teamPending = pendingLeaves.filter(r => teamMembers.some(e=>e.id===r.employeeId));
    stats = [
      { icon:SvgUsers, label:'Team Members', value:teamMembers.length, color:'#6366f1' },
      { icon:SvgClock, label:'Team Pending Leaves', value:teamPending.length, color:'#f59e0b', sub:'Needs action' },
      { icon:SvgNet, label:'My Team', value:myEmp?.teamName||'—', color:'#8b5cf6' },
      { icon:SvgBrief, label:'Team Capacity', value:`${teamMembers.filter(e=>e.employmentStatus==='ACTIVE').length}/${teamMembers.length}`, color:'#10b981' },
    ];
  } else {
    stats = [
      { icon:SvgCal, label:'Leave Balance', value:`${myBalance?.remainingDays||0} days`, color:'#6366f1', sub:'Remaining' },
      { icon:SvgClock, label:'Pending Requests', value:(window.leaveRequestsMutable||[]).filter(r=>r.employeeId===user?.employeeId&&r.status==='PENDING').length, color:'#f59e0b' },
      { icon:SvgBrief, label:'Position', value:myEmp?.positionTitle||'—', color:'#8b5cf6' },
      { icon:SvgUser, label:'Joined', value:formatDate(myEmp?.hireDate), color:'#10b981' },
    ];
  }

  // Quick actions
  let actions = [];
  if(isHR) actions = [
    { icon:SvgPlus, label:'Add Employee', color:'#6366f1', cb:() => onOpenAddEmployee() },
    { icon:SvgCal, label:'Manage Leave Types', color:'#f59e0b', cb:() => onNavigate('leaves') },
    { icon:SvgNet, label:'View Org Chart', color:'#8b5cf6', cb:() => onNavigate('org-chart') },
    { icon:SvgShield, label:'Manage Holidays', color:'#06b6d4', cb:() => {} },
  ];
  else if(isMgr) actions = [
    { icon:SvgCheck, label:'Approve Leaves', color:'#10b981', cb:() => onNavigate('leaves') },
    { icon:SvgCal, label:'Team Calendar', color:'#6366f1', cb:() => onNavigate('leaves') },
    { icon:SvgNet, label:'View Org Chart', color:'#8b5cf6', cb:() => onNavigate('org-chart') },
  ];
  else actions = [
    { icon:SvgPlus, label:'Request Leave', color:'#6366f1', cb:() => onOpenRequestLeave() },
    { icon:SvgCal, label:'View My Balance', color:'#f59e0b', cb:() => onNavigate('leaves') },
    { icon:SvgAward, label:'Update Skills', color:'#8b5cf6', cb:() => onNavigate('employees') },
  ];

  return (
    <Page>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back${myEmp?' '+myEmp.firstName:''} — here's what's happening`}
      />

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        {stats.map((s,i) => <StatCard key={i} {...s} delay={i*80} />)}
      </div>

      {/* Main grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }}>
        {/* Left: Recent Leaves */}
        <Card style={{ padding:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div>
              <h3 style={{ fontSize:15, fontWeight:600, color:'#f1f5f9', margin:0 }}>Recent Leave Requests</h3>
              <p style={{ fontSize:12, color:'#475569', marginTop:3 }}>Latest activity across your scope</p>
            </div>
            <Btn variant="ghost" size="sm" onClick={() => onNavigate('leaves')}>
              View all <SvgChevR size={13} />
            </Btn>
          </div>
          <RecentLeavesTable requests={shownRequests} />
        </Card>

        {/* Right: Quick Actions */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Card style={{ padding:24 }}>
            <h3 style={{ fontSize:15, fontWeight:600, color:'#f1f5f9', margin:'0 0 16px' }}>Quick Actions</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {actions.map((a,i) => (
                <QuickActionBtn key={i} icon={a.icon} label={a.label} color={a.color} onClick={a.cb} />
              ))}
            </div>
          </Card>

          {/* Mini org snapshot */}
          <Card style={{ padding:24 }}>
            <h3 style={{ fontSize:13, fontWeight:600, color:'#94a3b8', margin:'0 0 14px', textTransform:'uppercase', letterSpacing:'0.06em' }}>Org Snapshot</h3>
            {MOCK_DEPARTMENTS.map(d => (
              <div key={d.id} style={{ marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:12, fontWeight:600, color:'#e2e8f0' }}>{d.name}</span>
                  <span style={{ fontSize:11, color:'#475569', background:'rgba(30,41,59,0.6)', padding:'2px 8px', borderRadius:5 }}>{d.code}</span>
                </div>
                {d.teams.map(t => (
                  <div key={t.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 10px', borderLeft:'2px solid rgba(99,102,241,0.25)', marginLeft:8, marginBottom:3 }}>
                    <span style={{ fontSize:12, color:'#64748b', flex:1 }}>{t.name}</span>
                    <span style={{ fontSize:11, color:'#6366f1', fontWeight:500 }}>{t.employeeCount}</span>
                  </div>
                ))}
              </div>
            ))}
          </Card>
        </div>
      </div>
    </Page>
  );
}

window.DashboardPage = DashboardPage;
