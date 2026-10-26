/**
 * Learner HAMZA - Navigation Sidebar
 * 12 dedicated terminal sections with dark styling and quick test runner
 */

import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  PlusCircle,
  Calendar,
  BarChart3,
  FileText,
  ShieldAlert,
  FlaskConical,
  Image,
  Sliders,
  Database,
  Settings,
  CheckCircle2,
  X
} from 'lucide-react';

export type NavPageId =
  | 'dashboard'
  | 'journal'
  | 'add_trade'
  | 'calendar'
  | 'analytics'
  | 'reports'
  | 'risk'
  | 'strategy'
  | 'screenshots'
  | 'master_control'
  | 'backup'
  | 'settings';

interface SidebarProps {
  activePage: NavPageId;
  onSelectPage: (page: NavPageId) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onSelectPage,
  isOpenMobile,
  onCloseMobile
}) => {
  const navItems: Array<{ id: NavPageId; label: string; icon: React.ElementType; badge?: string }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'journal', label: 'Trade Journal', icon: BookOpen },
    { id: 'add_trade', label: 'Add / Edit Trade', icon: PlusCircle },
    { id: 'calendar', label: 'Calendar & Tracker', icon: Calendar },
    { id: 'analytics', label: 'Performance Analytics', icon: BarChart3 },
    { id: 'reports', label: 'Reports Center', icon: FileText },
    { id: 'risk', label: 'Risk Management', icon: ShieldAlert },
    { id: 'strategy', label: 'Strategy Lab', icon: FlaskConical },
    { id: 'screenshots', label: 'Screenshot Vault', icon: Image },
    { id: 'master_control', label: 'Master Control', icon: Sliders, badge: 'Core' },
    { id: 'backup', label: 'Backup & Restore', icon: Database },
    { id: 'settings', label: 'Settings & Audit Log', icon: Settings }
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-[#0C1422] transition-transform duration-200 md:static md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 via-indigo-600 to-amber-500 font-extrabold text-white text-base shadow-lg shadow-blue-500/20">
              LH
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-wide text-slate-100 uppercase">
                Learner HAMZA
              </div>
              <div className="text-[10px] font-medium text-blue-400 font-sans tracking-wide">
                Powerful Journal Developed by Mr.Hamza
              </div>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="md:hidden rounded-lg p-1 text-slate-400 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 text-xs font-medium">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectPage(item.id);
                  onCloseMobile();
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 transition text-left ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-300">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom System Footer */}
        <div className="border-t border-slate-800 p-3 text-center">
          <div className="text-[11px] font-semibold text-slate-400">
            Learner HAMZA Terminal
          </div>
          <div className="text-[10px] text-slate-600 mt-0.5">
            100% Offline • Local-First
          </div>
        </div>
      </aside>
    </>
  );
};
