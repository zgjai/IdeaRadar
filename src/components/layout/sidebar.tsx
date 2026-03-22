'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Lightbulb, Settings, Radar, Search, Globe, Menu, X, TrendingUp } from 'lucide-react';

const navItems = [
  { href: '/', label: '仪表盘', icon: LayoutDashboard },
  { href: '/ideas', label: '创意库', icon: Lightbulb },
  { href: '/research', label: '网站调研', icon: Globe },
  { href: '/trends', label: '趋势挖掘', icon: TrendingUp },
  { href: '/keywords', label: '关键词', icon: Search },
  { href: '/settings', label: '设置', icon: Settings },
];

function NavLink({ href, label, icon: Icon, active, onClick }: {
  href: string; label: string; icon: typeof LayoutDashboard; active: boolean; onClick?: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 outline-none ${
          active
            ? 'bg-blue-50 text-blue-700 font-medium border-l-4 border-blue-600 pl-3'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        <Icon className="w-5 h-5" />
        {label}
      </Link>
    </li>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-slate-200">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Radar className="w-6 h-6 text-blue-600" />
          IdeaRadar
        </Link>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={isActive(item.href)}
              onClick={() => setMobileOpen(false)}
            />
          ))}
        </ul>
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col fixed inset-y-0 left-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-slate-200 focus-visible:ring-2 focus-visible:ring-blue-500 outline-none"
        onClick={() => setMobileOpen(true)}
        aria-label="打开导航菜单"
      >
        <Menu className="w-6 h-6 text-slate-700" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <Link href="/" className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <Radar className="w-6 h-6 text-blue-600" />
                IdeaRadar
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 outline-none"
                aria-label="关闭导航菜单"
              >
                <X className="w-5 h-5 text-slate-700" />
              </button>
            </div>
            <nav className="flex-1 p-4">
              <ul className="space-y-2">
                {navItems.map((item) => (
                  <NavLink
                    key={item.href}
                    {...item}
                    active={isActive(item.href)}
                    onClick={() => setMobileOpen(false)}
                  />
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
