// employees.jsx — Employee Directory + Detail
const { useState, useEffect, useRef } = React;

// ─── Add Employee Modal ────────────────────────────────────────────────────
function AddEmployeeModal({ open, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', phone:'', hireDate:'', contractType:'FULL_TIME', departmentId:'', positionTitle:'', grossSalary:'' });
  const [errors, setErrors] = useState({});

  const set = (k,v) => setForm(p => ({ ...p, [k]:v }));

  const validate = () => {
    const e = {};
    if(!form.firstName.trim()) e.firstName = 'Required';
    if(!form.lastName.trim()) e.lastName = 'Required';
    if(!form.email.trim() || !form.email.includes('@')) e.email = 'Valid email required';
    if(!form.hireDate) e.hireDate = 'Required';
    if(!form.contractType) e.contractType = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (e) => {
    e.preventDefault();
    if(!validate()) return;
    const dept = MOCK_DEPARTMENTS.find(d => d.id === form.departmentId);
    const newEmp = {
      id: `emp-${Date.now()}`,
      employeeCode: `EMP-${String(window.employeesMutable.length + 1).padStart(4,'0')}`,
      firstName: form.firstName, lastName: form.lastName,
      email: form.email, phone: form.phone || null,
      dateOfBirth: null, hireDate: form.hireDate,
      contractType: form.contractType, employmentStatus: 'ACTIVE',
      grossSalary: form.grossSalary ? Number(form.grossSalary) : null, netSalary: null,
      positionId: null, positionTitle: form.positionTitle || null,
      departmentId: form.departmentId || null, departmentName: dept?.name || null,
      teamId: null, teamName: null, managerId: null, managerName: null,
      maritalStatus: null, educationLevel: null, deletedAt: null, roles: ['EMPLOYEE'],
    };
    window.employeesMutable.push(newEmp);
    toast('Employee created successfully', 'success');
    onClose();
    setForm({ firstName:'', lastName:'', email:'', phone:'', hireDate:'', contractType:'FULL_TIME', departmentId:'', positionTitle:'', grossSalary:'' });
    setErrors({});
  };

  return (
    <Modal open={open} onClose={onClose} title="Add New Employee" size="lg">
      <form onSubmit={submit}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px' }}>
          <FInput label="First Name" required value={form.firstName} onChange={e=>set('firstName',e.target.value)} error={errors.firstName} />
          <FInput label="Last Name" required value={form.lastName} onChange={e=>set('lastName',e.target.value)} error={errors.lastName} />
          <FInput label="Work Email" type="email" required value={form.email} onChange={e=>set('email',e.target.value)} error={errors.email} />
          <FInput label="Phone" value={form.phone} onChange={e=>set('phone',e.target.value)} />
          <FInput label="Hire Date" type="date" required value={form.hireDate} onChange={e=>set('hireDate',e.target.value)} error={errors.hireDate} />
          <FSelect label="Contract Type" required value={form.contractType} onChange={e=>set('contractType',e.target.value)} options={[
            {value:'FULL_TIME',label:'Full Time'},{value:'PART_TIME',label:'Part Time'},
            {value:'INTERN',label:'Intern'},{value:'CONTRACTOR',label:'Contractor'},{value:'FIXED_TERM',label:'Fixed Term'},
          ]} />
          <FInput label="Position Title" value={form.positionTitle} onChange={e=>set('positionTitle',e.target.value)} />
          <FSelect label="Department" value={form.departmentId} onChange={e=>set('departmentId',e.target.value)} options={[
            {value:'',label:'— Select Department'},
            ...MOCK_DEPARTMENTS.map(d => ({value:d.id,label:d.name})),
          ]} />
          <FInput label="Gross Salary (USD)" type="number" value={form.grossSalary} onChange={e=>set('grossSalary',e.target.value)} placeholder="e.g. 75000" />
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:8, paddingTop:16, borderTop:'1px solid rgba(148,163,184,0.08)' }}>
          <Btn variant="secondary" type="button" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" type="submit"><SvgPlus size={14} /> Create Employee</Btn>
        </div>
      </form>
    </Modal>
  );
}

// ─── Employee Directory ────────────────────────────────────────────────────
function EmployeesPage({ onViewEmployee }) {
  const { user } = useApp();
  const isHR = hasRole(user, ['HR_ADMIN','EXECUTIVE']);
  const isMgr = hasRole(user, ['MANAGER']);
  const isEmp = !isHR && !isMgr;

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [contractFilter, setContractFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  let employees = [...(window.employeesMutable||[])];
  if(isEmp) employees = employees.filter(e => e.id === user?.employeeId);
  else if(isMgr) employees = employees.filter(e => e.teamId === user?.teamId || e.id === user?.employeeId);

  if(debouncedSearch) employees = employees.filter(e =>
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    e.email.toLowerCase().includes(debouncedSearch.toLowerCase())
  );
  if(deptFilter) employees = employees.filter(e => e.departmentId === deptFilter);
  if(statusFilter) employees = employees.filter(e => e.employmentStatus === statusFilter);
  if(contractFilter) employees = employees.filter(e => e.contractType === contractFilter);

  const activeCount = (window.employeesMutable||[]).filter(e => e.employmentStatus === 'ACTIVE').length;

  const columns = [
    {
      key:'name', header:'Employee',
      render: e => (
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <EmployeeAvatar firstName={e.firstName} lastName={e.lastName} />
          <div>
            <div style={{ fontSize:13, fontWeight:500, color:'#e2e8f0' }}>{e.firstName} {e.lastName}</div>
            <div style={{ fontSize:11, color:'#475569' }}>{e.employeeCode}</div>
          </div>
        </div>
      ),
    },
    { key:'positionTitle', header:'Position', render: e => <span style={{ fontSize:13, color:'#94a3b8' }}>{e.positionTitle||'—'}</span> },
    { key:'department', header:'Department', render: e => <span style={{ fontSize:13, color:'#94a3b8' }}>{e.departmentName||'—'}</span> },
    { key:'status', header:'Status', render: e => <StatusBadge status={e.employmentStatus} type="employment" /> },
    { key:'contract', header:'Contract', render: e => <StatusBadge status={e.contractType} type="contract" /> },
    { key:'hireDate', header:'Hire Date', render: e => <span style={{ fontSize:12, color:'#64748b', whiteSpace:'nowrap' }}>{formatDate(e.hireDate)}</span> },
    {
      key:'actions', header:'',
      render: e => (
        <Btn variant="ghost" size="sm" onClick={() => onViewEmployee(e.id)}>
          <SvgEye size={14} /> View
        </Btn>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Employees"
        subtitle={`${activeCount} active employee${activeCount!==1?'s':''} across all departments`}
        actions={isHR && (
          <Btn variant="primary" onClick={() => setAddOpen(true)}>
            <SvgPlus size={14} /> Add Employee
          </Btn>
        )}
      />

      {!isEmp && (
        <Card style={{ padding:'16px 20px', marginBottom:20 }}>
          <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ position:'relative', flex:'1 1 220px' }}>
              <SvgSearch size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#475569' }} />
              <input
                placeholder="Search employees..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width:'100%', background:'rgba(30,41,59,0.6)', border:'1px solid rgba(148,163,184,0.1)', borderRadius:10, padding:'8px 12px 8px 36px', fontSize:13, color:'#f1f5f9', outline:'none', fontFamily:'Inter,sans-serif', boxSizing:'border-box' }}
              />
            </div>
            <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)}
              style={{ background:'#1e293b', border:'1px solid rgba(148,163,184,0.1)', borderRadius:10, padding:'8px 12px', fontSize:13, color: deptFilter?'#f1f5f9':'#64748b', outline:'none', cursor:'pointer' }}>
              <option value="">All Departments</option>
              {MOCK_DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
              style={{ background:'#1e293b', border:'1px solid rgba(148,163,184,0.1)', borderRadius:10, padding:'8px 12px', fontSize:13, color: statusFilter?'#f1f5f9':'#64748b', outline:'none', cursor:'pointer' }}>
              <option value="">All Statuses</option>
              {['ACTIVE','ON_LEAVE','PROBATION','TERMINATED','RESIGNED'].map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
            <select value={contractFilter} onChange={e=>setContractFilter(e.target.value)}
              style={{ background:'#1e293b', border:'1px solid rgba(148,163,184,0.1)', borderRadius:10, padding:'8px 12px', fontSize:13, color: contractFilter?'#f1f5f9':'#64748b', outline:'none', cursor:'pointer' }}>
              <option value="">All Contracts</option>
              {['FULL_TIME','PART_TIME','INTERN','CONTRACTOR','FIXED_TERM'].map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
            {(search||deptFilter||statusFilter||contractFilter) && (
              <button onClick={()=>{ setSearch(''); setDeptFilter(''); setStatusFilter(''); setContractFilter(''); }} style={{ background:'none', border:'none', color:'#6366f1', fontSize:13, cursor:'pointer', fontFamily:'Inter,sans-serif', whiteSpace:'nowrap' }}>
                Reset
              </button>
            )}
          </div>
        </Card>
      )}

      <Card style={{ padding:24 }}>
        <DataTable columns={columns} data={employees} pageSize={5} />
      </Card>

      <AddEmployeeModal open={addOpen} onClose={() => setAddOpen(false)} />
    </Page>
  );
}

// ─── Employee Detail ───────────────────────────────────────────────────────
function EmployeeDetailPage({ employeeId, onBack, onNavigateEmployee }) {
  const { user } = useApp();
  const toast = useToast();
  const isHR = hasRole(user, ['HR_ADMIN','EXECUTIVE']);
  const [tab, setTab] = useState('overview');
  const [statusDropOpen, setStatusDropOpen] = useState(false);

  const emp = (window.employeesMutable||[]).find(e => e.id === employeeId);
  const skills = (window.MOCK_SKILLS||{})[employeeId] || [];
  const balances = (window.MOCK_LEAVE_BALANCES||{})[employeeId] || [];
  const salaryHistory = (window.MOCK_SALARY_HISTORY||{})[employeeId] || [];

  if(!emp) return (
    <Page>
      <div style={{ textAlign:'center', padding:'80px 0' }}>
        <p style={{ color:'#475569' }}>Employee not found.</p>
        <Btn variant="secondary" onClick={onBack} style={{ marginTop:16 }}>← Back</Btn>
      </div>
    </Page>
  );

  const tabs = [
    { id:'overview', label:'Overview' },
    { id:'salary', label:'Salary', hidden:!isHR },
    { id:'skills', label:'Skills' },
    { id:'leaves', label:'Leaves' },
  ].filter(t => !t.hidden);

  const updateStatus = (newStatus) => {
    const idx = window.employeesMutable.findIndex(e => e.id === emp.id);
    if(idx !== -1) window.employeesMutable[idx].employmentStatus = newStatus;
    setStatusDropOpen(false);
    toast(`Status updated to ${newStatus.replace(/_/g,' ')}`, 'success');
  };

  const proficiencyConfig = {
    BEGINNER:     { color:'#94a3b8', bg:'rgba(148,163,184,0.1)', label:'Beginner' },
    INTERMEDIATE: { color:'#60a5fa', bg:'rgba(59,130,246,0.1)',  label:'Intermediate' },
    ADVANCED:     { color:'#c4b5fd', bg:'rgba(168,85,247,0.1)',  label:'Advanced' },
    EXPERT:       { color:'#fbbf24', bg:'rgba(245,158,11,0.1)',  label:'Expert' },
  };

  return (
    <Page>
      {/* Back */}
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:'#64748b', fontSize:13, cursor:'pointer', fontFamily:'Inter,sans-serif', marginBottom:24, padding:0 }}
        onMouseEnter={e=>e.currentTarget.style.color='#94a3b8'} onMouseLeave={e=>e.currentTarget.style.color='#64748b'}>
        <SvgChevL size={16} /> Back to Employees
      </button>

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:24 }}>
        {/* Left card */}
        <Card style={{ padding:28, height:'fit-content' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:12, paddingBottom:20, borderBottom:'1px solid rgba(148,163,184,0.08)', marginBottom:20 }}>
            <EmployeeAvatar firstName={emp.firstName} lastName={emp.lastName} size="xl" />
            <div>
              <h2 style={{ fontSize:18, fontWeight:700, color:'#f1f5f9', margin:0 }}>{emp.firstName} {emp.lastName}</h2>
              <div style={{ fontSize:12, color:'#475569', marginTop:4 }}>{emp.positionTitle||'—'}</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <span style={{ fontSize:11, fontWeight:600, background:'rgba(30,41,59,0.8)', color:'#64748b', border:'1px solid rgba(148,163,184,0.1)', padding:'3px 10px', borderRadius:6 }}>{emp.employeeCode}</span>
              <StatusBadge status={emp.employmentStatus} type="employment" />
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <InfoRow label="Email" value={<a href={`mailto:${emp.email}`} style={{ color:'#a5b4fc', fontSize:13 }}>{emp.email}</a>} />
            <InfoRow label="Phone" value={emp.phone||'—'} />
            <InfoRow label="Department" value={emp.departmentName||'—'} />
            <InfoRow label="Team" value={emp.teamName||'—'} />
          </div>

          {isHR && (
            <div style={{ marginTop:20, paddingTop:20, borderTop:'1px solid rgba(148,163,184,0.08)', position:'relative' }}>
              <Btn variant="outline" size="sm" style={{ width:'100%' }} onClick={() => setStatusDropOpen(p=>!p)}>
                <SvgEdit size={14} /> Edit Status <SvgChevD size={13} style={{ marginLeft:'auto' }} />
              </Btn>
              {statusDropOpen && (
                <div className="animate-fade-in" style={{ position:'absolute', top:'calc(100% - 4px)', left:0, right:0, background:'#1e293b', border:'1px solid rgba(148,163,184,0.12)', borderRadius:12, zIndex:50, overflow:'hidden', boxShadow:'0 16px 40px rgba(0,0,0,0.4)' }}>
                  {['ACTIVE','ON_LEAVE','TERMINATED','RESIGNED'].map(s => (
                    <button key={s} onClick={() => updateStatus(s)} style={{
                      width:'100%', padding:'10px 14px', border:'none', background:'transparent',
                      color: emp.employmentStatus===s ? '#a5b4fc':'#94a3b8', fontSize:13,
                      cursor:'pointer', textAlign:'left', fontFamily:'Inter,sans-serif',
                      background: emp.employmentStatus===s ? 'rgba(99,102,241,0.1)':'transparent',
                    }}>
                      {s.replace(/_/g,' ')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Right: tabs */}
        <div>
          {/* Tab bar */}
          <div style={{ display:'flex', gap:4, marginBottom:20, background:'rgba(15,23,42,0.6)', border:'1px solid rgba(148,163,184,0.08)', borderRadius:12, padding:4 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex:1, padding:'9px 16px', borderRadius:9, border:'none', cursor:'pointer',
                fontFamily:'Inter,sans-serif', fontSize:13, fontWeight: tab===t.id?600:400,
                background: tab===t.id ? '#6366f1' : 'transparent',
                color: tab===t.id ? 'white' : '#64748b',
                transition:'all 0.15s',
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="animate-fade-in" key={tab}>
            {tab==='overview' && (
              <Card style={{ padding:28 }}>
                <h3 style={{ fontSize:14, fontWeight:600, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 20px' }}>Employment Details</h3>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                  <DetailField label="Position" value={emp.positionTitle||'—'} />
                  <DetailField label="Department" value={emp.departmentName||'—'} />
                  <DetailField label="Team" value={emp.teamName||'—'} />
                  <DetailField label="Manager" value={
                    emp.managerId ? (
                      <button onClick={() => onNavigateEmployee(emp.managerId)} style={{ background:'none', border:'none', color:'#a5b4fc', fontSize:13, cursor:'pointer', fontFamily:'Inter,sans-serif', padding:0 }}>
                        {emp.managerName}
                      </button>
                    ) : '—'
                  } />
                  <DetailField label="Hire Date" value={formatDate(emp.hireDate)} />
                  <DetailField label="Contract Type" value={<StatusBadge status={emp.contractType} type="contract" />} />
                  <DetailField label="Marital Status" value={emp.maritalStatus||'—'} />
                  <DetailField label="Education Level" value={emp.educationLevel||'—'} />
                </div>
              </Card>
            )}

            {tab==='salary' && isHR && (
              <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
                <Card style={{ padding:28 }}>
                  <h3 style={{ fontSize:14, fontWeight:600, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 20px' }}>Current Compensation</h3>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                    <div style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:14, padding:'20px 24px' }}>
                      <div style={{ fontSize:12, color:'#6366f1', fontWeight:500, marginBottom:6 }}>Gross Salary</div>
                      <div style={{ fontSize:30, fontWeight:700, color:'#f1f5f9', letterSpacing:'-0.02em' }}>{formatCurrency(emp.grossSalary)}</div>
                      <div style={{ fontSize:11, color:'#475569', marginTop:4 }}>per year</div>
                    </div>
                    <div style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:14, padding:'20px 24px' }}>
                      <div style={{ fontSize:12, color:'#10b981', fontWeight:500, marginBottom:6 }}>Net Salary</div>
                      <div style={{ fontSize:30, fontWeight:700, color:'#f1f5f9', letterSpacing:'-0.02em' }}>{formatCurrency(emp.netSalary)}</div>
                      <div style={{ fontSize:11, color:'#475569', marginTop:4 }}>per year</div>
                    </div>
                  </div>
                </Card>
                <Card style={{ padding:28 }}>
                  <h3 style={{ fontSize:14, fontWeight:600, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 20px' }}>Salary History</h3>
                  <DataTable pageSize={5} data={salaryHistory} columns={[
                    { key:'effectiveDate', header:'Effective Date', render:r => <span style={{fontSize:13}}>{formatDate(r.effectiveDate)}</span> },
                    { key:'gross', header:'Gross', render:r => <span style={{fontSize:13}}>{formatCurrency(r.grossBefore)} → <strong style={{color:'#a5b4fc'}}>{formatCurrency(r.grossAfter)}</strong></span> },
                    { key:'net', header:'Net', render:r => <span style={{fontSize:13}}>{formatCurrency(r.netBefore)} → <strong style={{color:'#34d399'}}>{formatCurrency(r.netAfter)}</strong></span> },
                    { key:'reason', header:'Reason', render:r => <span style={{fontSize:12,color:'#64748b'}}>{r.reason}</span> },
                    { key:'changedByName', header:'Changed By', render:r => <span style={{fontSize:12,color:'#64748b'}}>{r.changedByName}</span> },
                  ]} />
                </Card>
              </div>
            )}

            {tab==='skills' && (
              <Card style={{ padding:28 }}>
                <h3 style={{ fontSize:14, fontWeight:600, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 20px' }}>Skills & Expertise</h3>
                {skills.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'48px 0' }}>
                    <SvgAward size={40} style={{ color:'#1e293b', display:'block', margin:'0 auto 12px' }} />
                    <p style={{ color:'#334155', fontSize:14 }}>No skills recorded yet.</p>
                    <Btn variant="outline" size="sm" style={{ marginTop:12 }}>Add Skill</Btn>
                  </div>
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    {skills.map(sk => {
                      const pc = proficiencyConfig[sk.proficiencyLevel] || proficiencyConfig.BEGINNER;
                      return (
                        <div key={sk.id} style={{ background:'rgba(30,41,59,0.4)', border:'1px solid rgba(148,163,184,0.08)', borderRadius:12, padding:'14px 16px' }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                            <span style={{ fontSize:14, fontWeight:600, color:'#e2e8f0' }}>{sk.skillName}</span>
                            <span style={{ fontSize:11, fontWeight:500, background:pc.bg, color:pc.color, padding:'3px 9px', borderRadius:6 }}>{pc.label}</span>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            {sk.skillCategory && <span style={{ fontSize:11, color:'#475569', background:'rgba(15,23,42,0.6)', padding:'2px 8px', borderRadius:5 }}>{sk.skillCategory}</span>}
                            {sk.yearsOfExperience && <span style={{ fontSize:11, color:'#475569' }}>{sk.yearsOfExperience}y exp.</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}

            {tab==='leaves' && (
              <Card style={{ padding:28 }}>
                <h3 style={{ fontSize:14, fontWeight:600, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 20px' }}>Leave Balances — 2025</h3>
                {balances.length === 0 ? (
                  <p style={{ color:'#475569', textAlign:'center', padding:'32px 0' }}>No balance data available.</p>
                ) : balances.map(b => (
                  <div key={b.id} style={{ marginBottom:20 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ width:10, height:10, borderRadius:'50%', background:b.color, display:'inline-block' }} />
                        <span style={{ fontSize:14, fontWeight:500, color:'#e2e8f0' }}>{b.leaveTypeName}</span>
                      </div>
                      <span style={{ fontSize:12, color:'#64748b' }}>
                        <strong style={{color:'#94a3b8'}}>{b.usedDays}</strong> of {b.totalDays} used · {b.pendingDays} pending
                      </span>
                    </div>
                    {b.totalDays > 0 && (
                      <div style={{ height:8, background:'rgba(30,41,59,0.8)', borderRadius:99, overflow:'hidden' }}>
                        <div style={{ height:'100%', background:b.color, borderRadius:99, width:`${Math.min(100,(b.usedDays/b.totalDays)*100)}%`, transition:'width 0.6s ease' }} />
                      </div>
                    )}
                    <div style={{ fontSize:12, color:'#475569', marginTop:6 }}>{b.remainingDays} days remaining</div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize:11, color:'#475569', marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:13, color:'#cbd5e1' }}>{value}</div>
    </div>
  );
}
function DetailField({ label, value }) {
  return (
    <div style={{ padding:'14px 18px', background:'rgba(30,41,59,0.3)', border:'1px solid rgba(148,163,184,0.06)', borderRadius:10 }}>
      <div style={{ fontSize:11, color:'#475569', marginBottom:6, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
      <div style={{ fontSize:14, color:'#e2e8f0' }}>{value}</div>
    </div>
  );
}

window.EmployeesPage = EmployeesPage;
window.EmployeeDetailPage = EmployeeDetailPage;
