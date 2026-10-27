import { Outlet, NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { startVoiceSync } from '../lib/voiceQueue';
import { NotificationBell } from './NotificationBell';
import { LogOut } from 'lucide-react';
import { LayoutDashboard, Users, Clock, TrendingUp, Megaphone, Settings, Map, Brain, Mic, Eye, Activity, Building2, Menu } from 'lucide-react';

export function AppLayout() {
  const { activeOrg, isAdmin, signOut } = useAuth();
  useEffect(() => startVoiceSync(), []);
  const [moreOpen, setMoreOpen] = useState(false);
  const allItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/", icon: Map, label: "Prospecting" },
    { to: "/pipeline", icon: Users, label: "Pipeline" },
    { to: "/projects", icon: Building2, label: "Projects" },
    { to: "/memory", icon: Brain, label: "Memory" },
    { to: "/voice", icon: Mic, label: "Voice notes" },
    { to: "/watchers", icon: Eye, label: "Watchers" },
    { to: "/due-today", icon: Clock, label: "Due Today" },
    { to: "/predicted-demand", icon: Activity, label: "Predictions" },
    { to: "/forecast", icon: TrendingUp, label: "Reorder timing" },
    { to: "/campaigns", icon: Megaphone, label: "Campaigns" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];
  const MOBILE = ['/', '/pipeline', '/voice', '/memory', '/due-today'];
  const navItems = allItems.filter((i) => i.to !== '/settings' || isAdmin);

  return (
    <div className="flex h-dvh bg-[#0c0e12] text-slate-200 font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#12151a] border-r border-slate-800 shrink-0">
        <div className="h-14 border-b border-slate-800 flex items-center px-4 shrink-0">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-100 truncate">{activeOrg?.org.name ?? 'Finding with Nemo'}</h1>
          <NotificationBell className="ml-auto" />
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={signOut} className="m-3 flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800"><LogOut className="w-5 h-5" />Sign out</button>
      </aside>

      <NotificationBell className="md:hidden fixed top-2 right-2 z-50 bg-[#12151a]/90 rounded-lg" />
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-dvh overflow-hidden relative pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] bg-[#12151a] border-t border-slate-800 flex items-center justify-around z-50">
        {navItems.filter((i) => MOBILE.includes(i.to)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full text-[10px] ${
                isActive ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <item.icon className="w-5 h-5 mb-1" />
            <span className="truncate w-full text-center px-1">{item.label}</span>
          </NavLink>
        ))}
        <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center justify-center w-full h-full text-[10px] text-slate-400" aria-label="More screens">
          <Menu className="w-5 h-5 mb-1" /><span>More</span>
        </button>
      </nav>
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-black/60" onClick={() => setMoreOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-[#12151a] border-t border-slate-700 rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-3 gap-2">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} onClick={() => setMoreOpen(false)}
                  className={({ isActive }) => `flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs ${isActive ? 'bg-blue-600/15 text-blue-300' : 'bg-slate-800/60 text-slate-300'}`}>
                  <item.icon className="w-5 h-5" /><span className="text-center leading-tight">{item.label}</span>
                </NavLink>
              ))}
            </div>
            <button onClick={signOut} className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 text-sm text-slate-300"><LogOut className="w-4 h-4" />Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}
