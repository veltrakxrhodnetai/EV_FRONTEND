import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearAdminSession, getAdminSession } from '../../utils/adminAuth';

type NavItem = {
  to: string;
  label: string;
};

const navItems: NavItem[] = [
  { to: '/admin-lite/dashboard', label: 'Dashboard' },
  { to: '/admin-lite/stations', label: 'Stations' },
  { to: '/admin-lite/chargers', label: 'Chargers' },
  { to: '/admin-lite/tariffs', label: 'Tariffs' },
  { to: '/admin-lite/owners', label: 'Owners' },
  { to: '/admin-lite/users', label: 'Users' },
  { to: '/admin-lite/ocpp', label: 'OCPP' },
];

export default function AdminLiteLayout(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const session = getAdminSession();

  const logout = () => {
    clearAdminSession();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-60 bg-slate-900 text-white p-4 flex flex-col gap-4">
        <div>
          <h1 className="text-lg font-bold">Admin Portal</h1>
          <p className="text-xs text-slate-300">Read-only operations</p>
        </div>

        <div className="text-xs text-slate-300 border border-slate-700 rounded-lg p-3">
          <p className="font-semibold text-slate-100">{session?.fullName || 'Admin'}</p>
          <p className="uppercase tracking-wide mt-1">{session?.role || 'ADMIN'}</p>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  'block px-3 py-2 rounded-lg text-sm transition-colors',
                  active ? 'bg-emerald-500 text-white' : 'text-slate-200 hover:bg-slate-800',
                ].join(' ')}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={logout}
          className="w-full px-3 py-2 rounded-lg text-sm bg-slate-800 hover:bg-slate-700"
        >
          Logout
        </button>
      </aside>

      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
