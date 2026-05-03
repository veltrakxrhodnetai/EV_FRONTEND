import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getLiveSession, stopSession } from '../../api/sessions';
import type { LiveSession } from '../../types';

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export default function OwnerLiveSessionPage(): JSX.Element {
  const navigate = useNavigate();
  const { id } = useParams();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }
    const load = async () => {
      const data = await getLiveSession(id);
      if (data.status === 'COMPLETED') {
        navigate(`/owner/session/${id}/bill`, { replace: true });
        return;
      }
      setSession(data);
    };
    void load();
    const timer = window.setInterval(() => void load(), 1000);
    return () => window.clearInterval(timer);
  }, [id, navigate]);

  const onStop = async () => {
    if (!id || stopping) {
      return;
    }

    setStopping(true);
    try {
      await stopSession(id);
      navigate(`/owner/session/${id}/bill`);
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] p-6 text-white">
      <div className="mx-auto w-full max-w-lg rounded-2xl bg-[#141429] p-6">
        <h1 className="text-2xl font-bold">Owner Live Session</h1>
        <p className="mt-1 text-sm text-gray-300">{session?.vehicleNumber}</p>
        <p className="mt-6 text-5xl font-extrabold text-[#6D41E0]">{Number(session?.energyConsumedKwh || 0).toFixed(2)} kWh</p>
        <p className="mt-2 text-4xl font-bold text-[#6D41E0]">₹ {Number(session?.runningAmountRs || 0).toFixed(2)}</p>
        <p className="mt-3 text-sm text-gray-300">Elapsed: {formatElapsed(session?.elapsedSeconds ?? 0)}</p>
        <button
          onClick={onStop}
          disabled={stopping}
          className="mt-6 w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {stopping ? 'Stopping...' : 'Stop Charging'}
        </button>
      </div>
    </div>
  );
}
