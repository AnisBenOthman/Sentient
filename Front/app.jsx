// app.jsx — Root app, routing, auth gate
const { useState, useEffect } = React;

function App() {
  const [authUser, setAuthUser] = useState(() => window.authStore.get());
  const [page, setPage] = useState('dashboard');
  const [empDetailId, setEmpDetailId] = useState(null);
  const [addEmpOpen, setAddEmpOpen] = useState(false);
  const [reqLeaveOpen, setReqLeaveOpen] = useState(false);

  // Redirect to login if not authed; redirect away from login if authed
  const isLoggedIn = !!authUser;

  const login = (user) => {
    window.authStore.set(user);
    setAuthUser(user);
    setPage('dashboard');
  };

  const logout = () => {
    window.authStore.clear();
    setAuthUser(null);
    setPage('dashboard');
  };

  const navigate = (p) => {
    setEmpDetailId(null);
    setPage(p);
  };

  const viewEmployee = (id) => {
    setEmpDetailId(id);
    setPage('employee-detail');
  };

  const appCtxValue = { user: authUser, login, logout };

  if(!isLoggedIn) {
    return (
      <AppCtx.Provider value={appCtxValue}>
        <ToastProvider>
          <LoginPage />
        </ToastProvider>
      </AppCtx.Provider>
    );
  }

  const renderPage = () => {
    switch(page) {
      case 'dashboard':
        return (
          <DashboardPage
            onNavigate={navigate}
            onOpenAddEmployee={() => setAddEmpOpen(true)}
            onOpenRequestLeave={() => setReqLeaveOpen(true)}
          />
        );
      case 'employees':
        return <EmployeesPage onViewEmployee={viewEmployee} />;
      case 'employee-detail':
        return (
          <EmployeeDetailPage
            employeeId={empDetailId}
            onBack={() => navigate('employees')}
            onNavigateEmployee={viewEmployee}
          />
        );
      case 'leaves':
        return <LeavesPage />;
      case 'org-chart':
        return (
          <OrgChartPage
            onNavigateEmployee={(id) => viewEmployee(id)}
          />
        );
      default:
        return <DashboardPage onNavigate={navigate} onOpenAddEmployee={() => setAddEmpOpen(true)} onOpenRequestLeave={() => setReqLeaveOpen(true)} />;
    }
  };

  // Determine current page label for sidebar highlight
  const sidebarPage = page === 'employee-detail' ? 'employees' : page;

  return (
    <AppCtx.Provider value={appCtxValue}>
      <ToastProvider>
        <AppLayout currentPage={sidebarPage} onNavigate={navigate}>
          {renderPage()}
        </AppLayout>

        {/* Global modals triggered from dashboard quick-actions */}
        {addEmpOpen && (
          <AddEmployeeModal open={addEmpOpen} onClose={() => setAddEmpOpen(false)} />
        )}
        {reqLeaveOpen && (
          <RequestLeaveModal open={reqLeaveOpen} onClose={() => setReqLeaveOpen(false)} userId={authUser?.employeeId} />
        )}
      </ToastProvider>
    </AppCtx.Provider>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
