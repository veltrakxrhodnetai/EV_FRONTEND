import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getLiveSession, stopSession } from '../api/sessions';
import type { LiveSession } from '../types';
import {
  clearCustomerActiveSessionId,
  getCustomerActiveSessionId,
  setCustomerActiveSessionId,
} from '../utils/authSession';

function formatElapsed(totalSeconds: number): string {
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0)   return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/* ─── Limit Progress Bar ──────────────────────────────────────── */
function LimitProgressBar({
  session,
  liveAmount,
}: {
  session: LiveSession;
  liveAmount: number;
}) {
  const limitType  = session.limitType?.toUpperCase();
  const limitValue = session.limitValue;

  if (!limitType || !limitValue || limitValue <= 0) return null;

  let current = 0;
  let label   = '';
  let unit    = '';

  if (limitType === 'ENERGY') {
    current = Number(session.energyConsumedKwh || 0);
    label   = 'Energy';
    unit    = 'kWh';
  } else if (limitType === 'AMOUNT') {
    current = liveAmount;
    label   = 'Amount';
    unit    = '₹';
  } else if (limitType === 'TIME') {
    current = Math.floor(Number(session.elapsedSeconds || 0) / 60);
    label   = 'Time';
    unit    = 'min';
  } else {
    return null;
  }

  const pct        = Math.min(100, Math.round((current / limitValue) * 100));
  const isNearLimit = pct >= 85;
  const barColor   =
    pct >= 100    ? 'bg-red-500'   :
    isNearLimit   ? 'bg-amber-400' :
                    'bg-[#6D41E0]';

  const currentLabel =
    limitType === 'AMOUNT'
      ? `₹${current.toFixed(2)}`
      : `${current.toFixed(limitType === 'TIME' ? 0 : 2)} ${unit}`;

  const limitLabel =
    limitType === 'AMOUNT'
      ? `₹${limitValue.toFixed(2)}`
      : `${limitValue} ${unit}`;

  return (
    <div className="mt-5">
      <div className="flex justify-between text-xs mb-1" style={{ color: 'rgba(167,139,250,0.6)' }}>
        <span>{label} limit progress</span>
        <span>{currentLabel} / {limitLabel} ({pct}%)</span>
      </div>
      <div className="w-full rounded-full h-3 overflow-hidden" style={{ background: 'rgba(111,66,224,0.2)' }}>
        <div
          className={`h-3 rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct >= 85 && pct < 100 && (
        <p className="mt-1 text-xs text-amber-400">
          Approaching limit — charging will stop soon
        </p>
      )}
      {pct >= 100 && (
        <p className="mt-1 text-xs text-red-400">
          Limit reached — stopping charge
        </p>
      )}
    </div>
  );
}

/* ─── SoC Battery Indicator ──────────────────────────────────── */
function SoCIndicator({ soc }: { soc: number }) {
  const pct      = Math.min(100, Math.max(0, soc));
  const color    = pct >= 80 ? 'text-green-400' : pct >= 30 ? 'text-amber-400' : 'text-red-400';
  const barColor = pct >= 80 ? 'bg-green-500'   : pct >= 30 ? 'bg-amber-400'   : 'bg-red-500';

  return (
    <div className="mt-4 rounded-xl p-3" style={{ background: 'rgba(111,66,224,0.1)', border: '1px solid rgba(111,66,224,0.18)' }}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs" style={{ color: 'rgba(148,163,184,0.7)' }}>Battery</span>
        <span className={`text-sm font-semibold ${color}`}>{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: 'rgba(111,66,224,0.2)' }}>
        <div
          className={`h-2 rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct >= 100 && (
        <p className="mt-1 text-xs text-green-400">Battery full — stopping charge</p>
      )}
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────── */
export default function LiveSessionPage(): JSX.Element {
  const navigate   = useNavigate();
  const { id: sessionId } = useParams();

  const [session,   setSession]   = useState<LiveSession | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [stopping,  setStopping]  = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const autoStopReasonRef = useRef<string | null>(null);
  const maxEnergyRef = useRef(0);
  const maxAmountRef = useRef(0);
  const maxElapsedRef = useRef(0);
  const maxSocRef = useRef(0);

  /* ── Store / restore active session ID ─────────────────────── */
  useEffect(() => {
    if (sessionId) {
      setCustomerActiveSessionId(sessionId);
      autoStopReasonRef.current = null;
      maxEnergyRef.current = 0;
      maxAmountRef.current = 0;
      maxElapsedRef.current = 0;
      maxSocRef.current = 0;
      return;
    }
    const activeSessionId = getCustomerActiveSessionId();
    if (activeSessionId) {
      navigate(`/customer/session/${activeSessionId}/live`, { replace: true });
    }
  }, [sessionId, navigate]);

  /* ── Polling ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!sessionId) return;

    let mounted  = true;
    let timerId: number | null = null;

    const loadLive = async () => {
      try {
        const data = await getLiveSession(sessionId);
        if (!mounted) return;

        setSession(data);
        setLoadError(null);

        if (data.status === 'COMPLETED') {
          clearCustomerActiveSessionId();
          navigate(`/customer/session/${sessionId}/invoice`);
          return;
        }

        // Keep users on live page while backend transitions from paid to active charging.
        // Redirecting on PENDING_START causes a bounce back to verify even though charging starts moments later.
        if (['PENDING_VERIFICATION', 'PENDING_PAYMENT'].includes(data.status)) {
          clearCustomerActiveSessionId();
          navigate('/customer/session/verify', {
            replace: true,
            state: { sessionId: data.sessionId },
          });
          return;
        }

        if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(data.status)) {
          clearCustomerActiveSessionId();
          navigate('/stations', { replace: true });
          return;
        }
      } catch {
        if (mounted) setLoadError('Unable to fetch live session. Retrying…');
      } finally {
        if (mounted) {
          setLoading(false);
          timerId = window.setTimeout(() => void loadLive(), 1000);
        }
      }
    };

    void loadLive();

    return () => {
      mounted = false;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [sessionId, navigate]);

  /* ── Derived values ─────────────────────────────────────────── */
  const elapsed = useMemo(
    () => formatElapsed(Number(session?.elapsedSeconds || 0)),
    [session?.elapsedSeconds]
  );

  const liveAmount = useMemo(() => {
    const running   = Number(session?.runningAmountRs || 0);
    const fromParts = Number(session?.baseAmountRs || 0) + Number(session?.gstAmountRs || 0);
    return Math.max(running, fromParts, 0);
  }, [session?.runningAmountRs, session?.baseAmountRs, session?.gstAmountRs]);

  const stableEnergy = useMemo(() => {
    const current = Number(session?.energyConsumedKwh || 0);
    const prev = maxEnergyRef.current;
    maxEnergyRef.current = Math.max(maxEnergyRef.current, current);
    if (current < prev * 0.95) {
      console.warn('[ENERGY-REGRESSION]', { sessionId, current, previous: prev, stable: maxEnergyRef.current });
    }
    return maxEnergyRef.current;
  }, [session?.energyConsumedKwh]);

  const stableAmount = useMemo(() => {
    maxAmountRef.current = Math.max(maxAmountRef.current, liveAmount);
    return maxAmountRef.current;
  }, [liveAmount]);

  const stableElapsedSeconds = useMemo(() => {
    const current = Number(session?.elapsedSeconds || 0);
    maxElapsedRef.current = Math.max(maxElapsedRef.current, current);
    return maxElapsedRef.current;
  }, [session?.elapsedSeconds]);

  const isCharging = session?.status === 'ACTIVE';
  const isStopping = session?.status === 'STOPPING';
  const isLiveSession = isCharging || isStopping;
  const soc = useMemo(() => {
    if (session?.socPercent == null) {
      return maxSocRef.current > 0 ? maxSocRef.current : null;
    }
    const current = Math.max(0, Math.min(100, Number(session.socPercent)));
    const prev = maxSocRef.current;
    maxSocRef.current = Math.max(maxSocRef.current, current);
    if (current < prev * 0.95) {
      console.warn('[SOC-REGRESSION]', { sessionId, current, previous: prev, stable: maxSocRef.current });
    }
    return maxSocRef.current;
  }, [session?.socPercent]);

  const autoStopReason = useMemo(() => {
    if (!session || session.status !== 'ACTIVE') {
      return null;
    }

    const limitType = session.limitType?.toUpperCase();
    const limitValue = Number(session.limitValue || 0);

    if (soc !== null && soc >= 100) {
      return 'BATTERY_FULL';
    }

    if (!limitType || limitValue <= 0) {
      return null;
    }

    if (limitType === 'AMOUNT' && stableAmount >= limitValue) {
      return 'LIMIT_AMOUNT';
    }

    if (limitType === 'ENERGY' && stableEnergy >= limitValue) {
      return 'LIMIT_ENERGY';
    }

    if (limitType === 'TIME' && Math.floor(stableElapsedSeconds / 60) >= limitValue) {
      return 'LIMIT_TIME';
    }

    return null;
  }, [session, soc, stableAmount, stableElapsedSeconds, stableEnergy]);

  const requestStop = async (reasonText: string) => {
    if (!sessionId) return;

    setStopping(true);
    try {
      const result = await stopSession(sessionId);

      if (
        result.mode === 'OFFLINE_FALLBACK' ||
        result.mode === 'IMMEDIATE_COMPLETION'
      ) {
        clearCustomerActiveSessionId();
        navigate(`/customer/session/${sessionId}/invoice`);
        return;
      }

      setLoadError(reasonText);

      for (let i = 0; i < 8; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          const latest = await getLiveSession(sessionId);
          if (latest.status === 'COMPLETED') {
            clearCustomerActiveSessionId();
            navigate(`/customer/session/${sessionId}/invoice`);
            return;
          }
        } catch {
          // keep polling
        }
      }

      clearCustomerActiveSessionId();
      navigate(`/customer/session/${sessionId}/bill`);
    } finally {
      setStopping(false);
    }
  };

  useEffect(() => {
    if (!autoStopReason || !sessionId || stopping || isStopping) {
      return;
    }

    if (autoStopReasonRef.current === autoStopReason) {
      return;
    }

    autoStopReasonRef.current = autoStopReason;

    const reasonText = autoStopReason === 'BATTERY_FULL'
      ? 'Battery full detected. Stopping charging…'
      : 'Limit reached. Stopping charging…';

    void requestStop(reasonText);
  }, [autoStopReason, isStopping, sessionId, stopping]);

  /* ── Stop handler ───────────────────────────────────────────── */
  const handleStop = async () => {
    await requestStop('Stop requested. Finalizing session…');
  };

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="min-h-[100dvh] text-white" style={{ background: '#0f0c1a' }}>
      <div className="mx-auto w-full max-w-md px-4 py-4 pb-6">
      <div className="rounded-2xl p-4 sm:p-6" style={{ background: '#1a1530', border: '1px solid rgba(111,66,224,0.25)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>

        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold sm:text-2xl">Live Charging</h1>
          <span
            className={`inline-flex h-3 w-3 rounded-full ${
              isCharging ? 'animate-pulse bg-[#6D41E0]' : 'bg-gray-600'
            }`}
          />
        </div>

        <p className="mt-2 text-sm" style={{ color: 'rgba(167,139,250,0.8)' }}>
          {session?.vehicleNumber || 'Vehicle'}
        </p>

        {/* Error banner */}
        {loadError && (
          <div className="mt-4 rounded-xl p-3 text-sm" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
            {loadError}
          </div>
        )}

        {/* Stopping banner */}
        {isStopping && (
          <div className="mt-4 rounded-xl p-3 text-sm" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#fde68a' }}>
            ⏸ Charging is stopping…
          </div>
        )}

        {session && !loading && !isLiveSession && !loadError && (
          <div className="mt-4 rounded-xl p-3 text-sm" style={{ background: 'rgba(111,66,224,0.1)', border: '1px solid rgba(111,66,224,0.2)', color: '#c4b5fd' }}>
            Session is not charging right now (status: {session.status}).
          </div>
        )}

        {/* ── Main stats ── */}
        <div className="mt-6 text-center">
          <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(167,139,250,0.6)' }}>Energy Consumed</p>
          <p className="mt-1 text-4xl font-extrabold text-[#6D41E0] sm:text-5xl">
            {loading ? '—' : stableEnergy.toFixed(2)}
            <span className="ml-1 text-xl font-semibold sm:text-2xl">kWh</span>
          </p>

          <p className="mt-5 text-xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(167,139,250,0.6)' }}>Amount</p>
          <p className="mt-1 text-3xl font-bold text-[#6D41E0] sm:text-4xl">
            ₹ {stableAmount.toFixed(2)}
          </p>
          <p className="mt-1 text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>Including GST</p>
        </div>

        {/* ── Stats grid ── */}
        <div className="mt-7 grid grid-cols-2 gap-3 text-center text-sm">
          <StatCard label="Elapsed"  value={elapsed} />
          <StatCard
            label="Power"
            value={`${Number(session?.currentPowerKw || 0).toFixed(2)} kW`}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-center text-sm">
          <StatCard
            label="Base Amount"
            value={`₹ ${Number(session?.baseAmountRs || 0).toFixed(2)}`}
          />
          <StatCard
            label={`GST (${session?.gstPercent ?? 18}%)`}
            value={`₹ ${Number(session?.gstAmountRs || 0).toFixed(2)}`}
          />
        </div>

        {/* SoC battery indicator — only when charger reports SoC */}
        {soc !== null && soc > 0 && <SoCIndicator soc={soc} />}

        {/* Limit progress bar */}
        {session && (
          <LimitProgressBar
            session={{
              ...session,
              energyConsumedKwh: stableEnergy,
              elapsedSeconds: stableElapsedSeconds,
            }}
            liveAmount={stableAmount}
          />
        )}

        {/* ── Charging animation icon ── */}
        <div className="mt-6 flex items-center justify-center">
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-full ring-8 sm:h-28 sm:w-28 ${
              isCharging
                ? 'animate-pulse bg-[#6D41E0]/20 ring-[#6D41E0]/10'
                : 'bg-gray-700/20 ring-gray-700/20'
            }`}
          >
            <span className="text-3xl sm:text-4xl">{isCharging ? '⚡' : '⏸'}</span>
          </div>
        </div>

        {/* ── Stop button ── */}
        <div className="mt-6 rounded-xl p-3" style={{ background: '#130f23', border: '1px solid rgba(111,66,224,0.3)' }}>
          {isLiveSession ? (
            <button
              disabled={stopping || !isCharging}
              onClick={handleStop}
              className="w-full rounded-xl bg-gradient-to-r from-red-600 to-rose-500
                         py-3.5 text-base font-semibold text-white
                         disabled:opacity-60 active:scale-[0.99] transition-transform"
            >
              {stopping || isStopping ? 'Stopping…' : 'Stop Charging'}
            </button>
          ) : (
            <div className="w-full rounded-xl py-3 text-center text-sm" style={{ background: 'rgba(111,66,224,0.1)', color: '#a78bfa' }}>
              Live controls will appear once charging becomes active.
            </div>
          )}
        </div>

        <p className="mt-3 text-center text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
          Charging stops automatically when your selected limit is reached or the battery is full.
        </p>

      </div>
      </div>
    </div>
  );
}

/* ─── Reusable stat card ─────────────────────────────────────── */
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(111,66,224,0.1)', border: '1px solid rgba(111,66,224,0.18)' }}>
      <p style={{ color: 'rgba(167,139,250,0.6)', fontSize: '0.75rem' }}>{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
