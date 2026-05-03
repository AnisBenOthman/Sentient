import { Sidebar } from '@/components/layout/sidebar';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 240, padding: '28px 32px', minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
