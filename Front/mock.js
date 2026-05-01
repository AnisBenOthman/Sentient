// ─── Mock Data ────────────────────────────────────────────────────────────

window.MOCK_LEAVE_TYPES = [
  { id:'lt-001', name:'Annual Leave', businessUnitId:'bu-001', defaultDaysPerYear:14, requiresApproval:true, accrualFrequency:'ANNUAL', color:'#6366f1' },
  { id:'lt-002', name:'Sick Leave', businessUnitId:'bu-001', defaultDaysPerYear:10, requiresApproval:false, accrualFrequency:'MONTHLY', color:'#f59e0b' },
  { id:'lt-003', name:'Unpaid Leave', businessUnitId:'bu-001', defaultDaysPerYear:0, requiresApproval:true, accrualFrequency:'NONE', color:'#94a3b8' },
];

window.MOCK_DEPARTMENTS = [
  {
    id:'dept-001', name:'Engineering', code:'ENG', headId:'emp-001', headName:'Alice Martin',
    teams:[
      { id:'team-001', name:'Backend Alpha', code:'BA', leadId:'emp-003', leadName:'Carol White', leadVacant:false, projectFocus:'Core API & Infrastructure', employeeCount:3 },
      { id:'team-002', name:'Frontend Beta', code:'FB', leadId:null, leadName:null, leadVacant:true, projectFocus:'Web & Mobile Applications', employeeCount:2 },
    ],
  },
  {
    id:'dept-002', name:'Product', code:'PROD', headId:'emp-002', headName:'Bob Johnson',
    teams:[
      { id:'team-003', name:'Design', code:'DS', leadId:'emp-004', leadName:'Dan Brown', leadVacant:false, projectFocus:'UX Research & Design Systems', employeeCount:2 },
    ],
  },
];

window.MOCK_EMPLOYEES = [
  { id:'emp-001', employeeCode:'EMP-0001', firstName:'Alice', lastName:'Martin', email:'alice.martin@sentient.dev', phone:'+1 (555) 001-0001', dateOfBirth:'1990-03-15', hireDate:'2023-01-15', contractType:'FULL_TIME', employmentStatus:'ACTIVE', grossSalary:95000, netSalary:71250, positionId:'pos-001', positionTitle:'HR Director', departmentId:'dept-001', departmentName:'Engineering', teamId:'team-001', teamName:'Backend Alpha', managerId:null, managerName:null, maritalStatus:'Married', educationLevel:"Master's Degree", deletedAt:null, roles:['HR_ADMIN'] },
  { id:'emp-002', employeeCode:'EMP-0002', firstName:'Bob', lastName:'Johnson', email:'bob.johnson@sentient.dev', phone:'+1 (555) 002-0002', dateOfBirth:'1985-07-22', hireDate:'2023-03-01', contractType:'FULL_TIME', employmentStatus:'ACTIVE', grossSalary:88000, netSalary:66000, positionId:'pos-002', positionTitle:'Product Manager', departmentId:'dept-002', departmentName:'Product', teamId:'team-003', teamName:'Design', managerId:'emp-001', managerName:'Alice Martin', maritalStatus:'Single', educationLevel:"Bachelor's Degree", deletedAt:null, roles:['MANAGER'] },
  { id:'emp-003', employeeCode:'EMP-0003', firstName:'Carol', lastName:'White', email:'carol.white@sentient.dev', phone:'+1 (555) 003-0003', dateOfBirth:'1993-11-08', hireDate:'2023-06-15', contractType:'FULL_TIME', employmentStatus:'ACTIVE', grossSalary:72000, netSalary:54000, positionId:'pos-003', positionTitle:'Backend Developer', departmentId:'dept-001', departmentName:'Engineering', teamId:'team-001', teamName:'Backend Alpha', managerId:'emp-001', managerName:'Alice Martin', maritalStatus:'Single', educationLevel:"Bachelor's Degree", deletedAt:null, roles:['EMPLOYEE'] },
  { id:'emp-004', employeeCode:'EMP-0004', firstName:'Dan', lastName:'Brown', email:'dan.brown@sentient.dev', phone:'+1 (555) 004-0004', dateOfBirth:'1991-04-19', hireDate:'2023-09-01', contractType:'FULL_TIME', employmentStatus:'ACTIVE', grossSalary:68000, netSalary:51000, positionId:'pos-004', positionTitle:'UX Designer', departmentId:'dept-002', departmentName:'Product', teamId:'team-003', teamName:'Design', managerId:'emp-002', managerName:'Bob Johnson', maritalStatus:'Married', educationLevel:"Bachelor's Degree", deletedAt:null, roles:['EMPLOYEE'] },
  { id:'emp-005', employeeCode:'EMP-0005', firstName:'Eve', lastName:'Davis', email:'eve.davis@sentient.dev', phone:'+1 (555) 005-0005', dateOfBirth:'1994-08-30', hireDate:'2023-11-01', contractType:'FULL_TIME', employmentStatus:'ON_LEAVE', grossSalary:70000, netSalary:52500, positionId:'pos-003', positionTitle:'Backend Developer', departmentId:'dept-001', departmentName:'Engineering', teamId:'team-001', teamName:'Backend Alpha', managerId:'emp-001', managerName:'Alice Martin', maritalStatus:'Single', educationLevel:"Bachelor's Degree", deletedAt:null, roles:['EMPLOYEE'] },
  { id:'emp-006', employeeCode:'EMP-0006', firstName:'Frank', lastName:'Lee', email:'frank.lee@sentient.dev', phone:'+1 (555) 006-0006', dateOfBirth:'2001-02-14', hireDate:'2024-07-01', contractType:'INTERN', employmentStatus:'ACTIVE', grossSalary:null, netSalary:null, positionId:'pos-005', positionTitle:'Frontend Intern', departmentId:'dept-001', departmentName:'Engineering', teamId:'team-002', teamName:'Frontend Beta', managerId:'emp-001', managerName:'Alice Martin', maritalStatus:'Single', educationLevel:"In Progress (Bachelor's)", deletedAt:null, roles:['EMPLOYEE'] },
  { id:'emp-007', employeeCode:'EMP-0007', firstName:'Grace', lastName:'Kim', email:'grace.kim@sentient.dev', phone:'+1 (555) 007-0007', dateOfBirth:'1992-12-03', hireDate:'2024-02-15', contractType:'CONTRACTOR', employmentStatus:'PROBATION', grossSalary:55000, netSalary:41250, positionId:'pos-004', positionTitle:'Product Designer', departmentId:'dept-002', departmentName:'Product', teamId:'team-003', teamName:'Design', managerId:'emp-002', managerName:'Bob Johnson', maritalStatus:null, educationLevel:"Master's Degree", deletedAt:null, roles:['EMPLOYEE'] },
  { id:'emp-008', employeeCode:'EMP-0008', firstName:'Henry', lastName:'Wilson', email:'henry.wilson@sentient.dev', phone:'+1 (555) 008-0008', dateOfBirth:'1988-05-25', hireDate:'2022-10-01', contractType:'FIXED_TERM', employmentStatus:'TERMINATED', grossSalary:null, netSalary:null, positionId:'pos-005', positionTitle:'Frontend Developer', departmentId:'dept-001', departmentName:'Engineering', teamId:'team-002', teamName:'Frontend Beta', managerId:'emp-001', managerName:'Alice Martin', maritalStatus:'Married', educationLevel:"Bachelor's Degree", deletedAt:'2025-01-15', roles:['EMPLOYEE'] },
];

window.MOCK_LEAVE_REQUESTS = [
  { id:'lr-001', employeeId:'emp-001', employeeName:'Alice Martin', leaveTypeId:'lt-001', leaveTypeName:'Annual Leave', leaveTypeColor:'#6366f1', startDate:'2025-04-14', endDate:'2025-04-18', startHalfDay:null, endHalfDay:null, businessDays:5, reason:'Family vacation', status:'APPROVED', reviewNote:null, submittedAt:'2025-04-01T09:00:00Z' },
  { id:'lr-002', employeeId:'emp-003', employeeName:'Carol White', leaveTypeId:'lt-001', leaveTypeName:'Annual Leave', leaveTypeColor:'#6366f1', startDate:'2025-05-05', endDate:'2025-05-09', startHalfDay:null, endHalfDay:null, businessDays:5, reason:'Personal time off', status:'PENDING', reviewNote:null, submittedAt:'2025-04-20T10:30:00Z' },
  { id:'lr-003', employeeId:'emp-004', employeeName:'Dan Brown', leaveTypeId:'lt-002', leaveTypeName:'Sick Leave', leaveTypeColor:'#f59e0b', startDate:'2025-04-22', endDate:'2025-04-23', startHalfDay:null, endHalfDay:null, businessDays:2, reason:'Not feeling well', status:'APPROVED', reviewNote:'Get well soon!', submittedAt:'2025-04-22T08:00:00Z' },
  { id:'lr-004', employeeId:'emp-005', employeeName:'Eve Davis', leaveTypeId:'lt-001', leaveTypeName:'Annual Leave', leaveTypeColor:'#6366f1', startDate:'2025-04-28', endDate:'2025-05-16', startHalfDay:null, endHalfDay:null, businessDays:14, reason:'Extended leave', status:'APPROVED', reviewNote:null, submittedAt:'2025-04-10T14:00:00Z' },
  { id:'lr-005', employeeId:'emp-002', employeeName:'Bob Johnson', leaveTypeId:'lt-001', leaveTypeName:'Annual Leave', leaveTypeColor:'#6366f1', startDate:'2025-06-02', endDate:'2025-06-06', startHalfDay:null, endHalfDay:null, businessDays:5, reason:'Conference trip', status:'PENDING', reviewNote:null, submittedAt:'2025-04-25T11:00:00Z' },
  { id:'lr-006', employeeId:'emp-007', employeeName:'Grace Kim', leaveTypeId:'lt-002', leaveTypeName:'Sick Leave', leaveTypeColor:'#f59e0b', startDate:'2025-04-24', endDate:'2025-04-24', startHalfDay:null, endHalfDay:null, businessDays:1, reason:'Doctor appointment', status:'APPROVED', reviewNote:null, submittedAt:'2025-04-23T17:00:00Z' },
  { id:'lr-007', employeeId:'emp-003', employeeName:'Carol White', leaveTypeId:'lt-003', leaveTypeName:'Unpaid Leave', leaveTypeColor:'#94a3b8', startDate:'2025-03-10', endDate:'2025-03-12', startHalfDay:null, endHalfDay:null, businessDays:3, reason:'Personal matters', status:'REJECTED', reviewNote:'Insufficient notice period', submittedAt:'2025-03-08T09:00:00Z' },
  { id:'lr-008', employeeId:'emp-004', employeeName:'Dan Brown', leaveTypeId:'lt-001', leaveTypeName:'Annual Leave', leaveTypeColor:'#6366f1', startDate:'2025-07-14', endDate:'2025-07-18', startHalfDay:null, endHalfDay:null, businessDays:5, reason:'Summer vacation', status:'PENDING', reviewNote:null, submittedAt:'2025-04-26T10:00:00Z' },
  { id:'lr-009', employeeId:'emp-006', employeeName:'Frank Lee', leaveTypeId:'lt-002', leaveTypeName:'Sick Leave', leaveTypeColor:'#f59e0b', startDate:'2025-04-15', endDate:'2025-04-15', startHalfDay:null, endHalfDay:null, businessDays:1, reason:null, status:'CANCELLED', reviewNote:null, submittedAt:'2025-04-14T18:00:00Z' },
  { id:'lr-010', employeeId:'emp-001', employeeName:'Alice Martin', leaveTypeId:'lt-001', leaveTypeName:'Annual Leave', leaveTypeColor:'#6366f1', startDate:'2025-09-01', endDate:'2025-09-05', startHalfDay:null, endHalfDay:null, businessDays:5, reason:'Annual holiday', status:'PENDING', reviewNote:null, submittedAt:'2025-04-27T09:00:00Z' },
];

window.MOCK_LEAVE_BALANCES = {
  'emp-001': [
    { id:'lb-001', leaveTypeId:'lt-001', leaveTypeName:'Annual Leave', year:2025, totalDays:14, usedDays:5, pendingDays:2, remainingDays:7, color:'#6366f1' },
    { id:'lb-002', leaveTypeId:'lt-002', leaveTypeName:'Sick Leave', year:2025, totalDays:10, usedDays:2, pendingDays:0, remainingDays:8, color:'#f59e0b' },
    { id:'lb-003', leaveTypeId:'lt-003', leaveTypeName:'Unpaid Leave', year:2025, totalDays:0, usedDays:0, pendingDays:0, remainingDays:0, color:'#94a3b8' },
  ],
  'emp-002': [
    { id:'lb-004', leaveTypeId:'lt-001', leaveTypeName:'Annual Leave', year:2025, totalDays:14, usedDays:0, pendingDays:5, remainingDays:9, color:'#6366f1' },
    { id:'lb-005', leaveTypeId:'lt-002', leaveTypeName:'Sick Leave', year:2025, totalDays:10, usedDays:0, pendingDays:0, remainingDays:10, color:'#f59e0b' },
  ],
  'emp-003': [
    { id:'lb-006', leaveTypeId:'lt-001', leaveTypeName:'Annual Leave', year:2025, totalDays:14, usedDays:0, pendingDays:5, remainingDays:9, color:'#6366f1' },
    { id:'lb-007', leaveTypeId:'lt-002', leaveTypeName:'Sick Leave', year:2025, totalDays:10, usedDays:0, pendingDays:0, remainingDays:10, color:'#f59e0b' },
  ],
};

window.MOCK_SALARY_HISTORY = {
  'emp-001': [
    { id:'sh-001', effectiveDate:'2025-01-01', grossBefore:88000, grossAfter:95000, netBefore:66000, netAfter:71250, reason:'Annual merit increase', changedByName:'System Admin' },
    { id:'sh-002', effectiveDate:'2024-01-01', grossBefore:82000, grossAfter:88000, netBefore:61500, netAfter:66000, reason:'Promotion to HR Director', changedByName:'System Admin' },
    { id:'sh-003', effectiveDate:'2023-01-15', grossBefore:0, grossAfter:82000, netBefore:0, netAfter:61500, reason:'Initial hire', changedByName:'System Admin' },
  ],
};

window.MOCK_SKILLS = {
  'emp-001': [
    { id:'sk-001', skillId:'skill-001', skillName:'HR Management', skillCategory:'Management', proficiencyLevel:'EXPERT', yearsOfExperience:8 },
    { id:'sk-002', skillId:'skill-002', skillName:'Labor Law', skillCategory:'Legal', proficiencyLevel:'ADVANCED', yearsOfExperience:5 },
    { id:'sk-003', skillId:'skill-003', skillName:'Talent Acquisition', skillCategory:'Recruitment', proficiencyLevel:'EXPERT', yearsOfExperience:7 },
    { id:'sk-004', skillId:'skill-004', skillName:'Workday HCM', skillCategory:'Tools', proficiencyLevel:'INTERMEDIATE', yearsOfExperience:3 },
  ],
  'emp-002': [
    { id:'sk-005', skillId:'skill-005', skillName:'Product Strategy', skillCategory:'Management', proficiencyLevel:'ADVANCED', yearsOfExperience:6 },
    { id:'sk-006', skillId:'skill-006', skillName:'Roadmapping', skillCategory:'Planning', proficiencyLevel:'EXPERT', yearsOfExperience:5 },
  ],
  'emp-003': [
    { id:'sk-007', skillId:'skill-007', skillName:'Node.js', skillCategory:'Backend', proficiencyLevel:'ADVANCED', yearsOfExperience:4 },
    { id:'sk-008', skillId:'skill-008', skillName:'TypeScript', skillCategory:'Languages', proficiencyLevel:'ADVANCED', yearsOfExperience:3 },
    { id:'sk-009', skillId:'skill-009', skillName:'PostgreSQL', skillCategory:'Database', proficiencyLevel:'INTERMEDIATE', yearsOfExperience:2 },
  ],
};

window.MOCK_AUTH_USERS = {
  'admin@sentient.dev':    { roles:['HR_ADMIN'], employeeId:'emp-001', sub:'user-001', departmentId:'dept-001', teamId:'team-001' },
  'manager@sentient.dev':  { roles:['MANAGER'],  employeeId:'emp-002', sub:'user-002', departmentId:'dept-002', teamId:'team-003' },
  'employee@sentient.dev': { roles:['EMPLOYEE'], employeeId:'emp-003', sub:'user-003', departmentId:'dept-001', teamId:'team-001' },
};
