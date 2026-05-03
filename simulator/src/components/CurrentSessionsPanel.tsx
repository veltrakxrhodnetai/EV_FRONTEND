import { ActiveSessionMonitorItem, ConnectorEventLog } from '../api/backend';
import { useState } from 'react';

interface CurrentSessionsPanelProps {
  sessions: ActiveSessionMonitorItem[];
  logs: ConnectorEventLog[];
  onOpenSession?: (session: ActiveSessionMonitorItem) => void;
  onTerminateSession?: (session: ActiveSessionMonitorItem) => Promise<void>;
}

function statusColor(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return '#10b981';
    case 'PENDING_START':
      return '#f59e0b';
    case 'PENDING_PAYMENT':
      return '#f97316';
    case 'PENDING_VERIFICATION':
      return '#eab308';
    case 'STOPPING':
      return '#ef4444';
    default:
      return '#94a3b8';
  }
}

export default function CurrentSessionsPanel({ sessions, logs, onOpenSession, onTerminateSession }: CurrentSessionsPanelProps) {
  const [terminatingSessionId, setTerminatingSessionId] = useState<number | null>(null);
  const activeSessionIds = new Set(sessions.map((session) => session.sessionId));
  const chargingLogs = logs.filter((event) => {
    if (event.sessionId != null && activeSessionIds.has(event.sessionId)) {
      return true;
    }
    const chargingEventTypes = new Set([
      'REMOTE_START_SENT',
      'START_TRANSACTION',
      'METER_VALUES',
      'REMOTE_STOP_SENT',
      'STOP_TRANSACTION',
      'STATUS_NOTIFICATION',
    ]);
    return chargingEventTypes.has(event.eventType);
  });

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          border: '1px solid #475569',
          borderRadius: '12px',
          padding: '16px',
          color: '#e2e8f0',
        }}
      >
        <h3 style={{ margin: '0 0 12px', color: '#60a5fa', fontSize: '16px' }}>
          ⚡ Current Charging Sessions ({sessions.length})
        </h3>
        <div
          style={{
            maxHeight: '320px',
            overflowY: 'auto',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px',
          }}
        >
          {sessions.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '13px', padding: '8px' }}>
              No running/pending sessions.
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.sessionId}
                style={{
                  borderBottom: '1px solid #1e293b',
                  padding: '10px 8px',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: '#e2e8f0' }}>Session #{session.sessionId}</strong>
                  <span
                    style={{
                      color: statusColor(session.status),
                      fontWeight: 700,
                    }}
                  >
                    {session.status}
                  </span>
                </div>
                <div style={{ color: '#94a3b8', marginTop: '4px' }}>
                  Charger: {session.chargerOcppIdentity} • Connector: {session.connectorNo}
                </div>
                <div style={{ color: '#cbd5e1', marginTop: '3px' }}>
                  Vehicle: {session.vehicleNumber || '-'} • User: {session.phoneNumber || '-'}
                </div>
                <div style={{ color: '#cbd5e1', marginTop: '3px' }}>
                  Energy: {Number(session.energyConsumedKwh || 0).toFixed(3)} kWh • TX: {session.transactionId ?? '-'}
                </div>
                <div style={{ color: '#cbd5e1', marginTop: '3px' }}>
                  Payment: {session.paymentMode || '-'} • {session.paymentStatus || '-'}
                </div>
                <div style={{ color: '#94a3b8', marginTop: '3px' }}>
                  Started: {session.startedAt ? new Date(session.startedAt).toLocaleString() : '-'}
                </div>
                {(onOpenSession || onTerminateSession) && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {onOpenSession && (
                        <button
                          onClick={() => onOpenSession(session)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #60a5fa',
                            background: 'rgba(96, 165, 250, 0.15)',
                            color: '#60a5fa',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          ▶ Open in Simulator
                        </button>
                      )}

                      {onTerminateSession && (
                        <button
                          onClick={async () => {
                            setTerminatingSessionId(session.sessionId);
                            await onTerminateSession(session);
                            setTerminatingSessionId(null);
                          }}
                          disabled={terminatingSessionId === session.sessionId}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #ef4444',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: terminatingSessionId === session.sessionId ? 'not-allowed' : 'pointer',
                            opacity: terminatingSessionId === session.sessionId ? 0.7 : 1
                          }}
                        >
                          {terminatingSessionId === session.sessionId ? '⏳ Terminating...' : '⛔ Terminate Session'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          border: '1px solid #475569',
          borderRadius: '12px',
          padding: '16px',
          color: '#e2e8f0',
        }}
      >
        <h3 style={{ margin: '0 0 12px', color: '#60a5fa', fontSize: '16px' }}>
          🧾 Charging Communication Logs
        </h3>
        <div
          style={{
            maxHeight: '320px',
            overflowY: 'auto',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px',
          }}
        >
          {chargingLogs.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '13px', padding: '8px' }}>
              No charging logs available.
            </div>
          ) : (
            chargingLogs.slice(0, 80).map((event, index) => (
              <div
                key={`${event.timestamp}-${event.sessionId ?? 'na'}-${index}`}
                style={{
                  borderBottom: '1px solid #1e293b',
                  padding: '8px 6px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                }}
              >
                <div style={{ color: '#94a3b8' }}>
                  {event.timestamp} • session={event.sessionId ?? '-'}
                </div>
                <div style={{ color: '#e2e8f0' }}>
                  [{event.eventType}] charger={event.chargerId} connector={event.connectorId ?? '-'} status={event.status}
                </div>
                <div style={{ color: '#60a5fa' }}>{event.message}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
