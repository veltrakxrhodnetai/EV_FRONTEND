import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearAdminSession, getAdminSession } from '../../utils/adminAuth';

// ─── Nav items with icons ──────────────────────────────────────────────────────

type NavItem = { to: string; label: string; icon: React.ReactNode };

const navItems: NavItem[] = [
  {
    to: '/admin/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    to: '/admin/stations',
    label: 'Stations',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14" /><path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    to: '/admin/chargers',
    label: 'Chargers',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    to: '/admin/connectors',
    label: 'Connectors',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    ),
  },
  {
    to: '/admin/pricing',
    label: 'Pricing',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    to: '/admin/owners',
    label: 'Owners',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: '/admin/users',
    label: 'Users',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    to: '/admin/rfid',
    label: 'RFID',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    to: '/admin/ocpp',
    label: 'OCPP Config',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14M16.24 7.76a6 6 0 0 1 0 8.49M7.76 7.76a6 6 0 0 0 0 8.49" />
      </svg>
    ),
  },
  {
    to: '/admin/logs',
    label: 'Logs',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
];

// ─── Logo ─────────────────────────────────────────────────────────────────────

function BrandLogo() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-800">
      {/* SVG bolt logo */}
      <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-white leading-tight truncate">EV CSMS</p>
        <p className="text-[10px] text-slate-400 leading-tight">Admin Portal</p>
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AdminLayout(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getAdminSession();

  const onLogout = () => {
    clearAdminSession();
    navigate('/admin/login');
  };

  // Get the current page label for mobile breadcrumb
  const currentNav = navItems.find((n) => location.pathname === n.to);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <BrandLogo />

      {/* Session info */}
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{session?.fullName || 'Admin'}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{session?.role || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">Navigation</p>
        <ul className="space-y-0.5">
  {navItems.map((item) => {
    const active = location.pathname === item.to;
    return (
      <li key={item.to}>
        <Link
          to={item.to}
          style={{ color: 'white' }}
          className={[
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
            active ? 'bg-emerald-500 shadow-sm' : 'hover:bg-slate-800',
          ].join(' ')}
        >
          <span className="flex-shrink-0" style={{ color: 'white' }}>
            {item.icon}
          </span>
          {item.label}
          {active && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
          )}
        </Link>
      </li>
    );
  })}
</ul>
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-slate-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white hover:bg-slate-800 hover:text-rose-300 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Log Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex">

      {/* ── Always-on sidebar ── */}
      <aside className="flex flex-col w-56 flex-shrink-0 bg-slate-900 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Desktop top bar ── */}
        <header className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-6 py-3 items-center justify-between shadow-sm flex">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="text-slate-400">/</span>
            <span className="font-semibold text-white">{currentNav?.label ?? 'Dashboard'}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-white">
              {session?.fullName || 'Admin'}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-500/40">
              {session?.role || 'Admin'}
            </span>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
