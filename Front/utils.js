// ─── Utils ────────────────────────────────────────────────────────────────

window.formatDate = function(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
};

window.formatCurrency = function(amount) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(amount);
};

window.getInitials = function(firstName, lastName) {
  return `${(firstName||'')[0]||''}${(lastName||'')[0]||''}`.toUpperCase();
};

window.hashColor = function(str) {
  const colors = ['#6366f1','#8b5cf6','#ec4899','#06b6d4','#10b981','#f59e0b','#ef4444','#3b82f6','#84cc16','#f97316'];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

window.hasRole = function(user, roles) {
  if (!user) return false;
  return roles.some(r => (user.roles || []).includes(r));
};

window.roleLabel = function(roles) {
  if (!roles) return 'Employee';
  if (roles.includes('HR_ADMIN')) return 'HR Admin';
  if (roles.includes('MANAGER')) return 'Manager';
  if (roles.includes('EXECUTIVE')) return 'Executive';
  if (roles.includes('SYSTEM_ADMIN')) return 'System Admin';
  return 'Employee';
};

window.calcBusinessDays = function(start, end) {
  if (!start || !end) return 0;
  let count = 0;
  const cur = new Date(start);
  const endDate = new Date(end);
  while (cur <= endDate) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

// Simple auth storage
window.authStore = {
  _state: JSON.parse(localStorage.getItem('sentient_auth') || 'null'),
  get() { return this._state; },
  set(user) {
    this._state = user;
    localStorage.setItem('sentient_auth', JSON.stringify(user));
  },
  clear() {
    this._state = null;
    localStorage.removeItem('sentient_auth');
  },
};

// Global mutable lists (so add/cancel/approve works during session)
window.leaveRequestsMutable = [...window.MOCK_LEAVE_REQUESTS];
window.employeesMutable = [...window.MOCK_EMPLOYEES];
window.leaveTypesMutable = [...window.MOCK_LEAVE_TYPES];
