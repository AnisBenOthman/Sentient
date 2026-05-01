// leaves.jsx — Leave Management
const { useState, useEffect } = React;

// ─── Request Leave Modal ───────────────────────────────────────────────────
function RequestLeaveModal({ open, onClose, userId }) {
  const toast = useToast();
  const [form, setForm] = useState({ leaveTypeId:'lt-001', startDate:'', endDate:'', reason:'' });
  const [errors, setErrors] = useState({});
  const set = (k,v) => setForm(p => ({...p,[k]:v}));

  const balances = (window.MOCK_LEAVE_BALANCES||{})[userId] || [];
  const selectedBal = balances.find(b => b.leaveTypeId === form.leaveTypeId);
  const requestedDays = form.startDate && form.endDate ? calcBusinessDays(form.startDate, form.endDate) : 0;
  const warn = selectedBal && requestedDays > selectedBal.remainingDays;

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if(!form.startDate) errs.startDate = 'Required';
    if(!form.endDate) errs.endDate = 'Required';
    setErrors(errs);
    if(Object.keys(errs).length) return;
    const lt = window.MOCK_LEAVE_TYPES.find(t => t.id === form.leaveTypeId);
    const emp = window.employeesMutable.find(e => e.id === userId);
    window.leaveRequestsMutable.unshift({
      id: `lr-${Date.now()}`,
      employeeId: userId,
      employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'You',
      leaveTypeId: form.leaveTypeId,
      leaveTypeName: lt?.name||'Leave',
      leaveTypeColor: lt?.color||'#6366f1',
      startDate: form.startDate, endDate: form.endDate,
      startHalfDay:null, endHalfDay:null,
      businessDays: requestedDays,
      reason: form.reason||null, status:'PENDING', reviewNote:null,
      submittedAt: new Date().toISOString(),
    });
    toast('Leave request submitted successfully', 'success');
    onClose();
    setForm({ leaveTypeId:'lt-001', startDate:'', endDate:'', reason:'' });
    setErrors({});
  };

  return (
    <Modal open={open} onClose={onClose} title="Request Leave">
      <form onSubmit={submit}>
        <FSelect label="Leave Type" required value={form.leaveTypeId} onChange={e=>set('leaveTypeId',e.target.value)}
          options={window.MOCK_LEAVE_TYPES.map(lt => {
            const bal = balances.find(b=>b.leaveTypeId===lt.id);
            return { value:lt.id, label:`${lt.name}${bal ? ` (${bal.remainingDays} days remaining)` : ''}` };
          })}
        />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <FInput label="Start Date" type="date" required value={form.startDate} onChange={e=>set('startDate',e.target.value)} error={errors.startDate} />
          <FInput label="End Date" type="date" required value={form.endDate} min={form.startDate} onChange={e=>set('endDate',e.target.value)} error={errors.endDate} />
        </div>
        {requestedDays > 0 && (
          <div style={{ padding:'12px 14px', background: warn?'rgba(245,158,11,0.08)':'rgba(99,102,241,0.08)', border:`1px solid ${warn?'rgba(245,158,11,0.25)':'rgba(99,102,241,0.25)'}`, borderRadius:10, marginBottom:14 }}>
            <div style={{ fontSize:13, color: warn?'#fbbf24':'#a5b4fc', fontWeight:500 }}>
              {warn ? '⚠ ' : ''}Requesting {requestedDays} business day{requestedDays!==1?'s':''}
              {selectedBal ? ` — ${selectedBal.remainingDays} days remaining for ${selectedBal.leaveTypeName}` : ''}
            </div>
          </div>
        )}
        <FTextarea label="Reason (optional)" value={form.reason} onChange={e=>set('reason',e.target.value)} placeholder="Briefly describe your reason..." />
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:8 }}>
          <Btn variant="secondary" type="button" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" type="submit"><SvgPlus size={14} /> Submit Request</Btn>
        </div>
      </form>
    </Modal>
  );
}

// ─── Reject Modal ──────────────────────────────────────────────────────────
function RejectModal({ open, onClose, request, onConfirm }) {
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const confirm = () => {
    if(!note.trim()) { setErr('Review note is required'); return; }
    onConfirm(request.id, note);
    setNote(''); setErr('');
  };
  return (
    <Modal open={open} onClose={onClose} title="Reject Leave Request" size="sm">
      {request && (
        <div style={{ marginBottom:16, padding:'12px 14px', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:10 }}>
          <div style={{ fontSize:13, color:'#f87171', marginBottom:2 }}>{request.employeeName}</div>
          <div style={{ fontSize:12, color:'#64748b' }}>{request.leaveTypeName} · {formatDate(request.startDate)} → {formatDate(request.endDate)}</div>
        </div>
      )}
      <FTextarea label="Review Note" required value={note} onChange={e=>{ setNote(e.target.value); setErr(''); }} placeholder="Explain why this request is being rejected..." error={err} />
      <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" onClick={confirm}><SvgX size={14} /> Confirm Rejection</Btn>
      </div>
    </Modal>
  );
}

// ─── Calendar View ─────────────────────────────────────────────────────────
function LeaveCalendar() {
  const [month, setMonth] = useState(new Date(2025, 3, 1)); // April 2025

  const year = month.getFullYear(), mon = month.getMonth();
  const firstDay = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon+1, 0).getDate();
  const weeks = [];
  let day = 1 - firstDay;
  while(day <= daysInMonth) {
    const week = [];
    for(let d=0; d<7; d++) { week.push(day <= 0 || day > daysInMonth ? null : day); day++; }
    weeks.push(week);
  }

  const approvedLeaves = (window.leaveRequestsMutable||[]).filter(r => r.status==='APPROVED');

  const getLeavesBars = (dayNum) => {
    if(!dayNum) return [];
    const cellDate = new Date(year, mon, dayNum);
    return approvedLeaves.filter(r => {
      const s = new Date(r.startDate), e = new Date(r.endDate);
      return cellDate >= s && cellDate <= e;
    }).slice(0,2);
  };

  const monthName = month.toLocaleDateString('en-US', { month:'long', year:'numeric' });

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div style={{ display:'flex', gap:8 }}>
          <Btn variant="secondary" size="sm" onClick={() => setMonth(new Date(year, mon-1, 1))}><SvgChevL size={14}/></Btn>
          <Btn variant="secondary" size="sm" onClick={() => setMonth(new Date(2025, 3, 1))}>Today</Btn>
          <Btn variant="secondary" size="sm" onClick={() => setMonth(new Date(year, mon+1, 1))}><SvgChevR size={14}/></Btn>
        </div>
        <h3 style={{ fontSize:16, fontWeight:600, color:'#f1f5f9', margin:0 }}>{monthName}</h3>
        <div style={{ display:'flex', gap:12 }}>
          {window.MOCK_LEAVE_TYPES.map(lt => (
            <div key={lt.id} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ width:10, height:10, borderRadius:'50%', background:lt.color, display:'inline-block' }} />
              <span style={{ fontSize:11, color:'#64748b' }}>{lt.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{ padding:'8px 0', textAlign:'center', fontSize:11, fontWeight:600, color:'#475569', textTransform:'uppercase', letterSpacing:'0.05em' }}>{d}</div>
        ))}
        {weeks.map((week, wi) => week.map((day, di) => {
          const bars = getLeavesBars(day);
          const isToday = day && new Date().toDateString() === new Date(year,mon,day).toDateString();
          return (
            <div key={`${wi}-${di}`} style={{
              minHeight:80, padding:'6px 8px', background: day ? 'rgba(15,23,42,0.5)':'transparent',
              border:`1px solid ${day?'rgba(148,163,184,0.07)':'transparent'}`,
              borderRadius:10, opacity: day ? 1 : 0.3,
            }}>
              {day && (
                <>
                  <div style={{ fontSize:13, color: isToday?'#6366f1':'#64748b', fontWeight: isToday?700:400, marginBottom:4,
                    width: isToday?22:undefined, height: isToday?22:undefined, borderRadius: isToday?'50%':undefined,
                    background: isToday?'rgba(99,102,241,0.2)':undefined, display: isToday?'flex':'block',
                    alignItems: isToday?'center':undefined, justifyContent: isToday?'center':undefined,
                  }}>{day}</div>
                  {bars.map(r => (
                    <div key={r.id} style={{ fontSize:10, background:`${r.leaveTypeColor}22`, color:r.leaveTypeColor, border:`1px solid ${r.leaveTypeColor}44`, borderRadius:4, padding:'2px 5px', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {r.employeeName.split(' ')[0]}
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

// ─── Main Leaves Page ──────────────────────────────────────────────────────
function LeavesPage({ initialTab, openRequestModal }) {
  const { user } = useApp();
  const toast = useToast();
  const isHR = hasRole(user, ['HR_ADMIN','EXECUTIVE']);
  const isMgr = hasRole(user, ['MANAGER']);
  const canApprove = isHR || isMgr;

  const tabs = [
    { id:'my', label:'My Requests' },
    { id:'queue', label:'Approval Queue', roles:['MANAGER','HR_ADMIN','EXECUTIVE'], badge: (window.leaveRequestsMutable||[]).filter(r=>r.status==='PENDING').length },
    { id:'calendar', label:'Team Calendar', roles:['MANAGER','HR_ADMIN','EXECUTIVE'] },
    { id:'types', label:'Leave Types', roles:['HR_ADMIN'] },
  ].filter(t => !t.roles || hasRole(user, t.roles));

  const [activeTab, setActiveTab] = useState(initialTab || 'my');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [reqOpen, setReqOpen] = useState(openRequestModal || false);
  const [rejectModal, setRejectModal] = useState({ open:false, request:null });
  const [requests, setRequests] = useState([...window.leaveRequestsMutable]);
  const [typeModalOpen, setTypeModalOpen] = useState(false);

  // Refresh from mutable on tab change
  useEffect(() => { setRequests([...window.leaveRequestsMutable]); }, [activeTab]);

  const myRequests = requests.filter(r => r.employeeId === user?.employeeId);
  const pendingQueue = requests.filter(r => r.status === 'PENDING');
  const filteredMy = statusFilter === 'ALL' ? myRequests : myRequests.filter(r => r.status === statusFilter);

  const cancelRequest = (id) => {
    const idx = window.leaveRequestsMutable.findIndex(r=>r.id===id);
    if(idx !== -1) window.leaveRequestsMutable[idx].status = 'CANCELLED';
    setRequests([...window.leaveRequestsMutable]);
    toast('Request cancelled', 'info');
  };

  const approveRequest = (id) => {
    const idx = window.leaveRequestsMutable.findIndex(r=>r.id===id);
    if(idx !== -1) window.leaveRequestsMutable[idx].status = 'APPROVED';
    setRequests([...window.leaveRequestsMutable]);
    toast('Leave request approved', 'success');
  };

  const rejectRequest = (id, note) => {
    const idx = window.leaveRequestsMutable.findIndex(r=>r.id===id);
    if(idx !== -1) { window.leaveRequestsMutable[idx].status = 'REJECTED'; window.leaveRequestsMutable[idx].reviewNote = note; }
    setRequests([...window.leaveRequestsMutable]);
    setRejectModal({ open:false, request:null });
    toast('Leave request rejected', 'info');
  };

  const myRequestsCols = [
    { key:'type', header:'Leave Type', render:r=>(
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <span style={{width:8,height:8,borderRadius:'50%',background:r.leaveTypeColor,display:'inline-block'}}/>
        <span style={{fontSize:13}}>{r.leaveTypeName}</span>
      </div>)},
    { key:'start', header:'Start Date', render:r=><span style={{fontSize:12,color:'#94a3b8',whiteSpace:'nowrap'}}>{formatDate(r.startDate)}</span> },
    { key:'end', header:'End Date', render:r=><span style={{fontSize:12,color:'#94a3b8',whiteSpace:'nowrap'}}>{formatDate(r.endDate)}</span> },
    { key:'days', header:'Days', render:r=><strong style={{color:'#e2e8f0'}}>{r.businessDays}d</strong> },
    { key:'submitted', header:'Submitted', render:r=><span style={{fontSize:12,color:'#64748b'}}>{formatDate(r.submittedAt)}</span> },
    { key:'status', header:'Status', render:r=><StatusBadge status={r.status} type="leave"/> },
    { key:'note', header:'Review Note', render:r=><span style={{fontSize:12,color:'#64748b',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',display:'block',whiteSpace:'nowrap'}}>{r.reviewNote||'—'}</span> },
    { key:'actions', header:'', render:r=>
      r.status==='PENDING'?(
        <Btn variant="danger" size="sm" onClick={()=>{ if(window.confirm('Cancel this request?')) cancelRequest(r.id); }}>Cancel</Btn>
      ):null
    },
  ];

  const queueCols = [
    { key:'emp', header:'Employee', render:r=>(
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <EmployeeAvatar firstName={r.employeeName.split(' ')[0]} lastName={r.employeeName.split(' ')[1]} size="sm"/>
        <span style={{fontSize:13,color:'#e2e8f0'}}>{r.employeeName}</span>
      </div>)},
    { key:'type', header:'Leave Type', render:r=>(
      <div style={{display:'flex',alignItems:'center',gap:7}}>
        <span style={{width:8,height:8,borderRadius:'50%',background:r.leaveTypeColor,display:'inline-block'}}/>
        {r.leaveTypeName}
      </div>)},
    { key:'period', header:'Period', render:r=><span style={{fontSize:12,color:'#94a3b8',whiteSpace:'nowrap'}}>{formatDate(r.startDate)} → {formatDate(r.endDate)}</span> },
    { key:'days', header:'Days', render:r=><strong>{r.businessDays}d</strong> },
    { key:'submitted', header:'Submitted', render:r=><span style={{fontSize:12,color:'#64748b'}}>{formatDate(r.submittedAt)}</span> },
    { key:'actions', header:'Actions', render:r=>(
      <div style={{display:'flex',gap:8}}>
        <Btn variant="success" size="sm" onClick={()=>approveRequest(r.id)}><SvgCheck size={13}/>Approve</Btn>
        <Btn variant="danger" size="sm" onClick={()=>setRejectModal({open:true,request:r})}><SvgX size={13}/>Reject</Btn>
      </div>)},
  ];

  return (
    <Page>
      <PageHeader
        title="Leave Management"
        subtitle="Manage leave requests, balances, and team schedules"
        actions={
          <Btn variant="primary" onClick={() => setReqOpen(true)}>
            <SvgPlus size={14}/> Request Leave
          </Btn>
        }
      />

      {/* Tab bar */}
      <div style={{display:'flex',gap:4,marginBottom:24,background:'rgba(15,23,42,0.6)',border:'1px solid rgba(148,163,184,0.08)',borderRadius:14,padding:5,width:'fit-content'}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
            padding:'9px 20px',borderRadius:10,border:'none',cursor:'pointer',
            fontFamily:'Inter,sans-serif',fontSize:13,fontWeight:activeTab===t.id?600:400,
            background:activeTab===t.id?'#6366f1':'transparent',
            color:activeTab===t.id?'white':'#64748b',transition:'all 0.15s',
            display:'flex',alignItems:'center',gap:8,position:'relative',
          }}>
            {t.label}
            {t.badge > 0 && (
              <span style={{background:activeTab===t.id?'rgba(255,255,255,0.25)':'rgba(239,68,68,0.85)',color:'white',fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:99}}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="animate-fade-in" key={activeTab}>
        {/* My Requests */}
        {activeTab==='my' && (
          <Card style={{padding:24}}>
            <div style={{display:'flex',gap:8,marginBottom:20}}>
              {['ALL','PENDING','APPROVED','REJECTED','CANCELLED'].map(s=>(
                <button key={s} onClick={()=>setStatusFilter(s)} style={{
                  padding:'5px 14px',borderRadius:8,border:'none',cursor:'pointer',
                  fontFamily:'Inter,sans-serif',fontSize:12,fontWeight:500,
                  background:statusFilter===s?'rgba(99,102,241,0.15)':'rgba(30,41,59,0.4)',
                  color:statusFilter===s?'#a5b4fc':'#64748b',
                  border:`1px solid ${statusFilter===s?'rgba(99,102,241,0.3)':'transparent'}`,
                }}>
                  {s.replace(/_/g,' ')}
                </button>
              ))}
            </div>
            <DataTable columns={myRequestsCols} data={filteredMy} pageSize={5} emptyText="No leave requests found" />
          </Card>
        )}

        {/* Approval Queue */}
        {activeTab==='queue' && canApprove && (
          <Card style={{padding:24}}>
            <div style={{marginBottom:20}}>
              <h3 style={{fontSize:15,fontWeight:600,color:'#f1f5f9',margin:'0 0 4px'}}>Pending Approvals</h3>
              <p style={{fontSize:13,color:'#475569',margin:0}}>{pendingQueue.length} request{pendingQueue.length!==1?'s':''} awaiting your review</p>
            </div>
            <DataTable columns={queueCols} data={pendingQueue} pageSize={5} emptyText="No pending requests — all clear!" />
          </Card>
        )}

        {/* Calendar */}
        {activeTab==='calendar' && (
          <Card style={{padding:28}}>
            <LeaveCalendar />
          </Card>
        )}

        {/* Leave Types */}
        {activeTab==='types' && isHR && (
          <Card style={{padding:24}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
              <h3 style={{fontSize:15,fontWeight:600,color:'#f1f5f9',margin:0}}>Leave Types</h3>
              <Btn variant="primary" size="sm" onClick={()=>setTypeModalOpen(true)}><SvgPlus size={13}/>Create Type</Btn>
            </div>
            <DataTable pageSize={10} data={window.leaveTypesMutable} columns={[
              { key:'name', header:'Name', render:r=>(
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{width:10,height:10,borderRadius:'50%',background:r.color,display:'inline-block'}}/>
                  <span style={{fontWeight:500,color:'#e2e8f0'}}>{r.name}</span>
                </div>)},
              { key:'accrual', header:'Accrual', render:r=><span style={{fontSize:12,color:'#94a3b8'}}>{r.accrualFrequency}</span> },
              { key:'approval', header:'Requires Approval', render:r=>(
                <span style={{fontSize:12,color:r.requiresApproval?'#a5b4fc':'#64748b'}}>{r.requiresApproval?'Yes':'No'}</span>)},
              { key:'days', header:'Default Days/Year', render:r=><strong style={{color:'#e2e8f0'}}>{r.defaultDaysPerYear}</strong> },
            ]} />
          </Card>
        )}
      </div>

      <RequestLeaveModal open={reqOpen} onClose={()=>setReqOpen(false)} userId={user?.employeeId} />
      <RejectModal open={rejectModal.open} onClose={()=>setRejectModal({open:false,request:null})} request={rejectModal.request} onConfirm={rejectRequest} />
    </Page>
  );
}

window.LeavesPage = LeavesPage;
window.RequestLeaveModal = RequestLeaveModal;
