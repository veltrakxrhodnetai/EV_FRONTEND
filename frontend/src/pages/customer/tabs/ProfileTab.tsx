import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCustomerDisplayText,
  getCustomerPhone,
  logoutCustomer,
} from '../../../utils/authSession';
import {
  getCustomerSessionHistory,
  type CustomerSessionHistory,
} from '../../../api/sessions';

function getPhoneFromTokenFallback(): string | null {
  const tokenWithType = localStorage.getItem('authToken');
  if (!tokenWithType) {
    return null;
  }

  const token = tokenWithType.startsWith('Bearer ') ? tokenWithType.slice(7) : tokenWithType;
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payloadText = atob(padded);
    const payload = JSON.parse(payloadText) as {
      phoneNumber?: string;
      sub?: string;
      mobile?: string;
    };

    const candidate = (payload.phoneNumber || payload.mobile || payload.sub || '').trim();
    return candidate || null;
  } catch {
    return null;
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return '';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  ACTIVE: 'bg-blue-100 text-blue-700',
  STOPPED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  FAILED: 'bg-red-100 text-red-600',
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-700',
  PENDING_START: 'bg-yellow-100 text-yellow-700',
};

function StatusBadge({ status }: { status: string }): JSX.Element {
  return (
    <span
      className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
        STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500'
      }`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function ProfileTab(): JSX.Element {
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('authToken');
  const [displayText, setDisplayText] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [sessions, setSessions] = useState<CustomerSessionHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      setLoadingHistory(false);
      setSessions([]);
      setHistoryError(false);
      setDisplayText('Guest User');
      setPhone(null);
      return;
    }

    const text = getCustomerDisplayText();
    setDisplayText(text);
    const existingPhone = getCustomerPhone();
    const p = existingPhone || getPhoneFromTokenFallback();
    if (!existingPhone && p) {
      localStorage.setItem('customerPhoneNumber', p);
    }
    setPhone(p);

    if (p) {
      setLoadingHistory(true);
      setHistoryError(false);
      getCustomerSessionHistory(p)
        .then(setSessions)
        .catch(() => {
          setSessions([]);
          setHistoryError(true);
        })
        .finally(() => setLoadingHistory(false));
    } else {
      setLoadingHistory(false);
    }
  }, [isLoggedIn]);

  const handleLogout = () => {
    logoutCustomer();
    navigate('/login');
  };

  const nameOnly = displayText.split('(')[0].trim() || 'User';
  const initials = nameOnly
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#0f0c1a' }}>
        <div
          className="shrink-0 px-6 pt-8 pb-6 text-white"
          style={{
            background: 'linear-gradient(135deg, #1a1040 0%, #0f0c1a 100%)',
            borderBottom: '1px solid rgba(111,66,224,0.25)',
          }}
        >
          <div className="flex items-center gap-4 mb-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold"
              style={{ background: 'rgba(111,66,224,0.2)', border: '2px solid rgba(111,66,224,0.4)' }}
            >
              GU
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-xl leading-tight text-white">Guest User</p>
              <p className="text-sm mt-0.5" style={{ color: 'rgba(167,139,250,0.75)' }}>Login to access profile and history</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-6 space-y-4">
          <div
            className="rounded-2xl p-5"
            style={{ background: '#1a1530', border: '1px solid rgba(111,66,224,0.25)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
          >
            <p className="text-sm font-semibold text-white">Unlock full customer experience</p>
            <p className="mt-2 text-sm" style={{ color: 'rgba(148,163,184,0.8)' }}>
              Login to view your charging history, bills, live sessions and faster station start.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="mt-4 w-full rounded-xl py-3 text-sm font-bold transition-all"
              style={{
                background: 'linear-gradient(135deg, #6f42e0, #a855f7)',
                color: 'white',
                boxShadow: '0 4px 16px rgba(111,66,224,0.4)',
              }}
            >
              Login / Sign Up
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#0f0c1a' }}>
      {/* Profile Header */}
      <div
        className="shrink-0 px-6 pt-8 pb-6 text-white"
        style={{
          background: 'linear-gradient(135deg, #1a1040 0%, #0f0c1a 100%)',
          borderBottom: '1px solid rgba(111,66,224,0.25)',
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold tracking-wide" style={{ color: 'rgba(167,139,250,0.9)' }}>Profile</p>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
            style={{ background: 'rgba(111,66,224,0.2)', border: '1px solid rgba(111,66,224,0.4)', color: '#a78bfa' }}
          >
            Sign Out
          </button>
        </div>

        <div className="flex items-center gap-4 mb-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold"
            style={{
              background: 'linear-gradient(135deg, rgba(111,66,224,0.4), rgba(168,85,247,0.3))',
              border: '2px solid rgba(111,66,224,0.5)',
            }}
          >
            {initials || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-xl leading-tight text-white">{nameOnly}</p>
            {phone && <p className="text-sm mt-0.5" style={{ color: 'rgba(167,139,250,0.75)' }}>{phone}</p>}
          </div>
        </div>
      </div>

      {/* Charging History */}
      <div className="px-4 pt-5 pb-2">
        <h2 className="text-sm font-bold flex items-center gap-1.5 mb-3" style={{ color: '#f1f5f9' }}>
          <span style={{ color: '#a78bfa' }}>⚡</span> Charging History
        </h2>

        {loadingHistory && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl p-4" style={{ background: '#1a1530', border: '1px solid rgba(111,66,224,0.15)' }}>
                <div className="flex justify-between mb-2">
                  <div className="h-4 w-2/5 rounded" style={{ background: 'rgba(111,66,224,0.15)' }} />
                  <div className="h-4 w-1/5 rounded" style={{ background: 'rgba(111,66,224,0.1)' }} />
                </div>
                <div className="h-3 w-1/3 rounded" style={{ background: 'rgba(111,66,224,0.1)' }} />
              </div>
            ))}
          </div>
        )}

        {!loadingHistory && historyError && (
          <div
            className="rounded-2xl p-4 text-center text-sm"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
          >
            Could not load history. Please try again later.
          </div>
        )}

        {!loadingHistory && !historyError && sessions.length === 0 && (
          <div className="flex flex-col items-center py-12" style={{ color: 'rgba(148,163,184,0.4)' }}>
            <span className="text-5xl mb-3 opacity-20">⚡</span>
            <p className="text-sm font-medium" style={{ color: 'rgba(241,245,249,0.4)' }}>No charging sessions yet</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(148,163,184,0.35)' }}>Your history will appear here after your first charge</p>
          </div>
        )}

        {!loadingHistory &&
          !historyError &&
          sessions.map((s) => {
            const duration = formatDuration(s.startedAt, s.endedAt);
            const isCompleted = s.status === 'COMPLETED' || s.status === 'STOPPED';

            return (
              <div
                key={s.sessionId}
                className="rounded-2xl p-4 mb-3 cursor-pointer transition-all"
                style={{
                  background: '#1a1530',
                  border: '1px solid rgba(111,66,224,0.2)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                }}
                onClick={() =>
                  isCompleted
                    ? navigate(`/customer/session/${s.sessionId}/invoice`)
                    : navigate(`/customer/session/${s.sessionId}/live`)
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: '#f1f5f9' }}>{s.stationName}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.6)' }}>{formatDate(s.startedAt)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge status={s.status} />
                    {s.totalAmount > 0 && (
                      <p className="text-sm font-extrabold" style={{ color: '#f1f5f9' }}>₹{s.totalAmount.toFixed(2)}</p>
                    )}
                  </div>
                </div>

                <div
                  className="mt-2 pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                  style={{ borderTop: '1px solid rgba(111,66,224,0.12)', color: 'rgba(148,163,184,0.6)' }}
                >
                  {s.energyConsumedKwh > 0 && (
                    <span>⚡ {s.energyConsumedKwh.toFixed(2)} kWh</span>
                  )}
                  {duration && <span>⏱ {duration}</span>}
                  {s.vehicleNumber && <span>🚗 {s.vehicleNumber}</span>}
                  {s.paymentMode && <span className="uppercase">{s.paymentMode}</span>}
                  <span className="ml-auto" style={{ color: 'rgba(167,139,250,0.4)' }}>›</span>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
