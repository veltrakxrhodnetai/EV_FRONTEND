import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clearCustomerActiveSessionId,
  getCustomerActiveSessionId,
} from '../../utils/authSession';
import { getLiveSession } from '../../api/sessions';
import StationsTab from './tabs/StationsTab';
import MapTab from './tabs/MapTab';
import ProfileTab from './tabs/ProfileTab';

type Tab = 'stations' | 'map' | 'profile';

const TABS: { id: Tab; label: string; icon: (active: boolean) => JSX.Element }[] = [
  {
    id: 'stations',
    label: 'Stations',
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className="w-6 h-6"
        strokeWidth={active ? 2.5 : 1.75}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
  },
  {
    id: 'map',
    label: 'Map',
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className="w-6 h-6"
        strokeWidth={active ? 2.5 : 1.75}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6-3m0 16l5.447-2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m0 13V7"
        />
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className="w-6 h-6"
        strokeWidth={active ? 2.5 : 1.75}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
];

export default function UserHomePage(): JSX.Element {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('stations');

  /* Resume active charging session if one exists */
  useEffect(() => {
    const sessionId = getCustomerActiveSessionId();
    if (!sessionId) return;

    const ACTIVE_STATUSES = new Set([
      'PENDING_VERIFICATION',
      'PENDING_PAYMENT',
      'PENDING_START',
      'ACTIVE',
      'STOPPING',
    ]);

    getLiveSession(sessionId)
      .then((live) => {
        if (ACTIVE_STATUSES.has(live.status)) {
          navigate(`/customer/session/${sessionId}/live`, { replace: true });
        } else {
          clearCustomerActiveSessionId();
        }
      })
      .catch(() => clearCustomerActiveSessionId());
  }, [navigate]);

  return (
    <div
      className="flex flex-col max-w-md mx-auto overflow-hidden"
      style={{ height: '100dvh', background: '#0f0c1a' }}
    >
      {/* Header */}
      <header
        className="shrink-0 px-5 py-3 z-10"
        style={{
          background: 'linear-gradient(135deg, #14102a 0%, #101a1a 100%)',
          borderBottom: '1px solid rgba(68,190,80,0.28)',
          boxShadow: '0 4px 24px rgba(68,190,80,0.16)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-start gap-1">
            <img src="/logo.png" alt="Veltrak" className="h-8 w-auto" />
            <p className="text-[10px] ml-1" style={{ color: 'rgba(110,231,121,0.85)' }}>Find & charge near you</p>
          </div>
          {activeTab === 'stations' && (
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: 'rgba(68,190,80,0.18)', color: '#6ee779', border: '1px solid rgba(68,190,80,0.38)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </div>
          )}
        </div>
      </header>

      {/* Tab Content — flex-1 fills remaining space, each tab handles its own scroll */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'stations' && <StationsTab />}
        {activeTab === 'map' && <MapTab />}
        {activeTab === 'profile' && <ProfileTab />}
      </main>

      {/* Bottom Navigation */}
      <nav
        className="shrink-0 flex z-10"
        style={{
          background: '#0f0c1a',
          borderTop: '1px solid rgba(111,66,224,0.2)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
        }}
      >
        {TABS.map(({ id, label, icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-all relative"
              style={{ color: active ? '#a78bfa' : 'rgba(148,163,184,0.5)' }}
            >
              {/* Active indicator bar */}
              {active && (
                <span
                  className="absolute top-0 left-1/4 right-1/4 h-[2px] rounded-full"
                  style={{ background: 'linear-gradient(90deg, #6f42e0, #a855f7)' }}
                />
              )}
              {icon(active)}
              <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
