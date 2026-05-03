import React, { ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  generatePaymentQr,
  getOwnerActiveSessions,
  getOwnerStations,
  markCashCollected,
  ownerStopSession,
} from '../api';
import LiveSession from '../components/LiveSession';
import OwnerStartModal from '../components/OwnerStartModal';

type Connector = {
  id: string;
  connectorNumber?: number;
  status: string;
};

type Charger = {
  id: string;
  chargerId: string;
  status: string;
  connectors?: Connector[];
};

type Station = {
  id: string;
  name: string;
  chargers: Charger[];
};

type ActiveSession = {
  sessionId: string;
  chargerId: string;
  connectorNumber: number;
};

export default function OwnerDashboard(): JSX.Element {
  const [stations, setStations] = useState<Station[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startModalState, setStartModalState] = useState<{ chargerId: string; connectorNumber: number } | null>(null);
  const [qrBySession, setQrBySession] = useState<Record<string, string>>({});

  const [cashPinModalSession, setCashPinModalSession] = useState<string | null>(null);
  const [ownerPin, setOwnerPin] = useState('');
  const [cashActionError, setCashActionError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const [stationData, activeData] = await Promise.all([getOwnerStations(), getOwnerActiveSessions()]);
      setStations(Array.isArray(stationData) ? stationData : []);
      setActiveSessions(Array.isArray(activeData) ? activeData : []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load owner dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const chargerCount = useMemo(
    () => stations.reduce((total: number, station: Station) => total + (station.chargers?.length ?? 0), 0),
    [stations]
  );

  const openStartModal = (chargerId: string, connectorNumber: number) => {
    setStartModalState({ chargerId, connectorNumber });
  };

  const closeStartModal = () => setStartModalState(null);

  const onStarted = (sessionId: string) => {
    closeStartModal();
    setActiveSessions((previous: ActiveSession[]) => {
      if (previous.some((session: ActiveSession) => session.sessionId === sessionId)) {
        return previous;
      }
      return [...previous, { sessionId, chargerId: startModalState?.chargerId ?? 'UNKNOWN', connectorNumber: startModalState?.connectorNumber ?? 1 }];
    });
  };

  const stopSession = async (sessionId: string) => {
    try {
      await ownerStopSession(sessionId);
      setActiveSessions((previous: ActiveSession[]) => previous.filter((session: ActiveSession) => session.sessionId !== sessionId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to stop session');
    }
  };

  const generateQr = async (sessionId: string) => {
    try {
      const response = await generatePaymentQr(sessionId);
      const qrText = response?.qrText ?? response?.qrCode ?? JSON.stringify(response);
      setQrBySession((previous: Record<string, string>) => ({ ...previous, [sessionId]: String(qrText) }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to generate QR');
    }
  };

  const openCashModal = (sessionId: string) => {
    setCashPinModalSession(sessionId);
    setOwnerPin('');
    setCashActionError(null);
  };

  const closeCashModal = () => {
    setCashPinModalSession(null);
    setOwnerPin('');
    setCashActionError(null);
  };

  const confirmCashCollected = async () => {
    if (!cashPinModalSession) {
      return;
    }
    if (!ownerPin.trim()) {
      setCashActionError('Owner PIN is required');
      return;
    }

    try {
      await markCashCollected(cashPinModalSession, ownerPin.trim());
      closeCashModal();
    } catch (requestError) {
      setCashActionError(requestError instanceof Error ? requestError.message : 'Failed to mark cash collected');
    }
  };

  return (
    <main style={{ maxWidth: 1200, margin: '24px auto', padding: '0 16px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: 8 }}>Owner Dashboard</h1>
      <p style={{ marginTop: 0, color: '#6b7280' }}>
        Stations: <strong>{stations.length}</strong> | Chargers: <strong>{chargerCount}</strong> | Active Sessions:{' '}
        <strong>{activeSessions.length}</strong>
      </p>

      {loading && <p>Loading dashboard...</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {!loading && (
        <>
          <section style={{ marginTop: 18 }}>
            <h2 style={{ marginBottom: 10 }}>Stations & Chargers</h2>
            <div style={{ display: 'grid', gap: 14 }}>
              {stations.map((station: Station) => (
                <article key={station.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
                  <h3 style={{ margin: '0 0 10px' }}>{station.name}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                    {(station.chargers ?? []).map((charger: Charger) => {
                      const availableConnector = (charger.connectors ?? []).find(
                        (connector: Connector) => connector.status?.toUpperCase() === 'AVAILABLE'
                      );
                      const connectorNumber = availableConnector?.connectorNumber ?? 1;
                      const canStart = charger.status?.toUpperCase() === 'AVAILABLE';

                      return (
                        <div key={charger.id} style={{ border: '1px solid #f3f4f6', borderRadius: 10, padding: 12 }}>
                          <p style={{ margin: '4px 0' }}><strong>{charger.chargerId}</strong></p>
                          <p style={{ margin: '4px 0' }}>Status: {charger.status}</p>

                          <button
                            type="button"
                            onClick={() => openStartModal(charger.chargerId, connectorNumber)}
                            disabled={!canStart}
                            style={{
                              padding: '7px 10px',
                              border: 'none',
                              borderRadius: 8,
                              background: canStart ? '#111827' : '#9ca3af',
                              color: '#fff',
                            }}
                          >
                            Start
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section style={{ marginTop: 24 }}>
            <h2 style={{ marginBottom: 10 }}>Active Sessions</h2>
            <div style={{ display: 'grid', gap: 16 }}>
              {activeSessions.map((session: ActiveSession) => (
                <article key={session.sessionId} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                  <p style={{ margin: '4px 0' }}>
                    <strong>Session:</strong> {session.sessionId}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <strong>Charger:</strong> {session.chargerId} | <strong>Connector:</strong> {session.connectorNumber}
                  </p>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '10px 0' }}>
                    <button type="button" onClick={() => stopSession(session.sessionId)} style={{ padding: '8px 12px' }}>
                      Stop active session
                    </button>
                    <button type="button" onClick={() => generateQr(session.sessionId)} style={{ padding: '8px 12px' }}>
                      Generate QR for payment
                    </button>
                    <button type="button" onClick={() => openCashModal(session.sessionId)} style={{ padding: '8px 12px' }}>
                      Mark cash collected
                    </button>
                  </div>

                  {qrBySession[session.sessionId] && (
                    <p style={{ margin: '6px 0', color: '#065f46' }}>
                      <strong>QR:</strong> {qrBySession[session.sessionId]}
                    </p>
                  )}

                  <LiveSession sessionId={session.sessionId} />
                </article>
              ))}

              {!activeSessions.length && <p>No active sessions.</p>}
            </div>
          </section>
        </>
      )}

      {startModalState && (
        <OwnerStartModal
          chargerId={startModalState.chargerId}
          connectorNumber={startModalState.connectorNumber}
          onClose={closeStartModal}
          onStarted={onStarted}
        />
      )}

      {cashPinModalSession && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 12, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Confirm Cash Collection</h3>
            <p style={{ color: '#4b5563' }}>Enter owner PIN to confirm cash collection.</p>

            <input
              type="password"
              value={ownerPin}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setOwnerPin(event.target.value)}
              placeholder="Owner PIN"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8 }}
            />

            {cashActionError && <p style={{ color: '#dc2626' }}>{cashActionError}</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button type="button" onClick={closeCashModal}>Cancel</button>
              <button type="button" onClick={confirmCashCollected}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
