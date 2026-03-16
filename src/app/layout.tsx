import type { Metadata } from 'next';
import { LayoutDashboard, Lightbulb, Settings, Radar } from 'lucide-react';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'IdeaRadar - AI驱动的产品创意发现平台',
  description: '从互联网多渠道发现并分析产品创意',
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
          {/* Sidebar */}
          <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <Link href="/" className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <Radar className="w-6 h-6 text-blue-600" />
                IdeaRadar
              </Link>
            </div>

            <nav className="flex-1 p-4">
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/"
                    className="flex items-center gap-3 px-4 py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <LayoutDashboard className="w-5 h-5" />
                    仪表盘
                  </Link>
                </li>
                <li>
                  <Link
                    href="/ideas"
                    className="flex items-center gap-3 px-4 py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Lightbulb className="w-5 h-5" />
                    创意库
                  </Link>
                </li>
                <li>
                  <Link
                    href="/settings"
                    className="flex items-center gap-3 px-4 py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Settings className="w-5 h-5" />
                    设置
                  </Link>
                </li>
              </ul>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
