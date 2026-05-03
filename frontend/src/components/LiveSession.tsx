import React, { useEffect, useMemo, useState } from 'react';
import useWebSocket from '../hooks/useWebSocket';
import { API_BASE_URL } from '../config/endpoints';

type LiveSessionProps = {
  sessionId: string;
};

type StopSessionResponse = {
  sessionId: string;
  units: number;
  energyCost: number;
  gst: number;
  total: number;
  status: string;
};

type LiveMessage = {
  energyKwh?: number;
  powerKw?: number;
  runningAmount?: number;
};

const DEFAULT_RATE_PER_KWH = 12.5;

function buildWebSocketUrl(sessionId: string): string {
  const wsBase = API_BASE_URL.replace(/^http/i, 'ws').replace(/\/+$/, '');
  return `${wsBase}/ws/sessions/${sessionId}`;
}

export default function LiveSession({ sessionId }: LiveSessionProps): JSX.Element {
  const [liveKwh, setLiveKwh] = useState(0);
  const [livePowerKw, setLivePowerKw] = useState(0);
  const [runningAmount, setRunningAmount] = useState(0);
  const wsUrl = useMemo(() => buildWebSocketUrl(sessionId), [sessionId]);
  const { lastMessage, connectionStatus } = useWebSocket(wsUrl);

  const [stopLoading, setStopLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalBill, setFinalBill] = useState<StopSessionResponse | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('Missing session id');
    } else {
      setError(null);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!lastMessage) {
      return;
    }

    try {
      const parsed = JSON.parse(lastMessage.data) as LiveMessage;
      if (typeof parsed.energyKwh === 'number') {
        setLiveKwh(parsed.energyKwh);
      }
      if (typeof parsed.powerKw === 'number') {
        setLivePowerKw(parsed.powerKw);
      }
      if (typeof parsed.runningAmount === 'number') {
        setRunningAmount(parsed.runningAmount);
      } else if (typeof parsed.energyKwh === 'number') {
        setRunningAmount(parsed.energyKwh * DEFAULT_RATE_PER_KWH);
      }
    } catch {
      // Ignore non-JSON or unexpected payloads in this minimal live view.
    }
  }, [lastMessage]);

  const connectionLabel = useMemo(() => {
    if (connectionStatus === 'OPEN') return 'Connected';
    if (connectionStatus === 'CLOSED') return 'Disconnected';
    if (connectionStatus === 'RECONNECTING') return 'Reconnecting...';
    return 'Connecting...';
  }, [connectionStatus]);

  const onStop = async () => {
    setStopLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to stop session (${response.status})`);
      }

      const data = (await response.json()) as StopSessionResponse;
      setFinalBill(data);
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : 'Unable to stop session');
    } finally {
      setStopLoading(false);
    }
  };

  return (
    <section
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 16,
        background: '#ffffff',
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 10 }}>Live Session</h3>
      <p style={{ margin: '4px 0', color: '#4b5563' }}>
        <strong>Session:</strong> {sessionId}
      </p>
      <p style={{ margin: '4px 0', color: connectionStatus === 'OPEN' ? '#166534' : '#9a3412' }}>
        <strong>Status:</strong> {connectionLabel}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(100px, 1fr))', gap: 10, marginTop: 12 }}>
        <div style={{ padding: 10, borderRadius: 8, background: '#f9fafb' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>kWh</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{liveKwh.toFixed(3)}</div>
        </div>

        <div style={{ padding: 10, borderRadius: 8, background: '#f9fafb' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Power (kW)</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{livePowerKw.toFixed(2)}</div>
        </div>

        <div style={{ padding: 10, borderRadius: 8, background: '#f9fafb' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Running Amount</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>₹{runningAmount.toFixed(2)}</div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onStop}
          disabled={stopLoading || !!finalBill}
          style={{
            border: 'none',
            borderRadius: 8,
            padding: '8px 14px',
            background: '#dc2626',
            color: '#fff',
            fontWeight: 600,
            cursor: stopLoading || !!finalBill ? 'not-allowed' : 'pointer',
          }}
        >
          {stopLoading ? 'Stopping...' : 'Stop'}
        </button>
      </div>

      {error && <p style={{ color: '#dc2626', marginTop: 10 }}>{error}</p>}

      {finalBill && (
        <article style={{ marginTop: 16, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
          <h4 style={{ margin: '0 0 8px' }}>Final Bill</h4>
          <p style={{ margin: '4px 0' }}><strong>Status:</strong> {finalBill.status}</p>
          <p style={{ margin: '4px 0' }}><strong>Units:</strong> {finalBill.units}</p>
          <p style={{ margin: '4px 0' }}><strong>Energy Cost:</strong> ₹{finalBill.energyCost}</p>
          <p style={{ margin: '4px 0' }}><strong>GST:</strong> ₹{finalBill.gst}</p>
          <p style={{ margin: '4px 0' }}><strong>Total:</strong> ₹{finalBill.total}</p>
        </article>
      )}
    </section>
  );
}
