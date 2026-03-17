import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';
import { Sidebar } from '@/components/layout/sidebar';

export const metadata: Metadata = {
  title: 'IdeaRadar - AI驱动的商业机会验证引擎',
  description: '从互联网多渠道发现并验证产品创意的商业可行性',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-slate-50">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto lg:ml-64">
            {children}
          </main>
        </div>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
