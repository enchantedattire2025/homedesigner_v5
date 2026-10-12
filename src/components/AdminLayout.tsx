import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UserCheck,
  Briefcase,
  Home as HomeIcon,
  FolderKanban,
  FileText,
  CreditCard,
  Sparkles,
  Megaphone,
  BarChart3,
  Settings,
  Plug,
  ScrollText,
  Menu,
  X,
  LogOut,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Main',
    items: [
      { label: 'Overview', icon: LayoutDashboard, path: '/admin' },
      { label: 'Users & Verification', icon: UserCheck, path: '/admin/users' },
      { label: 'Designers', icon: Briefcase, path: '/admin/designers' },
      { label: 'Homeowners', icon: HomeIcon, path: '/admin/homeowners' },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { label: 'Projects', icon: FolderKanban, path: '/admin/projects' },
      { label: 'Quotations', icon: FileText, path: '/admin/quotations' },
      { label: 'Subscriptions & Billing', icon: CreditCard, path: '/admin/subscriptions' },
      { label: 'AI Quotation', icon: Sparkles, path: '/admin/ai-monitoring' },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { label: 'Content & Marketing', icon: Megaphone, path: '/admin/content' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Analytics & Reports', icon: BarChart3, path: '/admin/analytics' },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Platform Settings', icon: Settings, path: '/admin/settings' },
      { label: 'Integrations', icon: Plug, path: '/admin/integrations' },
      { label: 'Audit Logs', icon: ScrollText, path: '/admin/audit-logs' },
    ],
  },
];

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const sidebar = (
    <div className="h-full flex flex-col bg-secondary-900 text-gray-300">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-secondary-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-sky-500 rounded-lg flex items-center justify-center shrink-0">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">Admin Console</p>
            <p className="text-gray-400 text-xs">TheHomeDesigners</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.path);
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? 'bg-sky-500/15 text-sky-300'
                        : 'text-gray-400 hover:bg-secondary-800 hover:text-gray-200'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-sky-400' : ''}`} />
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {active && <ChevronRight className="w-3.5 h-3.5 text-sky-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-secondary-700/50">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 fixed inset-y-0 left-0 z-30">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-64 z-50 lg:hidden">
            {sidebar}
          </aside>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-semibold text-gray-800 text-sm">Admin Console</span>
          <button
            onClick={handleSignOut}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <LogOut className="w-5 h-5 text-gray-700" />
          </button>
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
