import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/providers/auth-provider';

export const metadata: Metadata = {
  title: 'Sentient HRIS',
  description: 'AI-powered HR Information System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#020617] text-slate-200 antialiased" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
