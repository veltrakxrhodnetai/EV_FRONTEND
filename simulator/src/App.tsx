import { useState, useEffect } from 'react';
import ChargerSimulator from './components/ChargerSimulator';
import CurrentSessionsPanel from './components/CurrentSessionsPanel';
import {
  backendAPI,
  StationInfo,
  ChargerInfo,
  ConnectorInfo,
  LiveMonitorStats,
  ActiveSessionMonitorItem,
} from './api/backend';

function App() {
  const DEFAULT_OCPP_TOKEN = '123456';
  const [backendUrl, setBackendUrl] = useState(() => localStorage.getItem('sim_backendUrl') || import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080');
  const [ocppToken, setOcppToken] = useState(() => localStorage.getItem('sim_ocppToken') || import.meta.env.VITE_OCPP_TOKEN || DEFAULT_OCPP_TOKEN);
  const [fullWsUrl, setFullWsUrl] = useState(() => localStorage.getItem('sim_fullWsUrl') || import.meta.env.VITE_FULL_WS_URL || '');
  const [showSettings, setShowSettings] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    backendConnected: false,
    databaseConnected: false,
    lastCheck: new Date()
  });

  // Station and Charger State
  const [stations, setStations] = useState<StationInfo[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [selectedStation, setSelectedStation] = useState<StationInfo | null>(null);
  const [chargers, setChargers] = useState<ChargerInfo[]>([]);
  const [loadingChargers, setLoadingChargers] = useState(false);
  const [selectedCharger, setSelectedCharger] = useState<ChargerInfo | null>(null);
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [loadingConnectors, setLoadingConnectors] = useState(false);

  // Simulator State
  const [simulatorActive, setSimulatorActive] = useState(false);
  const [liveMonitor, setLiveMonitor] = useState<LiveMonitorStats | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionMonitorItem[]>([]);
  const pendingPaymentSessions = activeSessions.filter((session) => session.status === 'PENDING_PAYMENT').length;

  useEffect(() => {
    let mounted = true;
    const loadMonitor = async () => {
      if (!systemStatus.backendConnected) {
        if (mounted) {
          setLiveMonitor(null);
          setActiveSessions([]);
        }
        return;
      }

      const [stats, sessionsResponse] = await Promise.all([
        backendAPI.getLiveMonitorStats(),
        backendAPI.getActiveSessionsMonitor(),
      ]);

      if (mounted && stats) {
        setLiveMonitor(stats);
      }

      if (mounted) {
        if (sessionsResponse?.sessions) {
          setActiveSessions(sessionsResponse.sessions);
        }
      }
    };

    loadMonitor();
    const interval = setInterval(loadMonitor, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [backendUrl, systemStatus.backendConnected]);

  useEffect(() => {
    checkSystemStatus();
    const interval = setInterval(checkSystemStatus, 10000);
    return () => clearInterval(interval);
  }, [backendUrl]);

  useEffect(() => {
    if (!localStorage.getItem('sim_ocppToken')) {
      localStorage.setItem('sim_ocppToken', DEFAULT_OCPP_TOKEN);
    }
  }, []);

  // Load stations when settings change
  useEffect(() => {
    if (systemStatus.backendConnected) {
      loadStations();
    }
  }, [systemStatus.backendConnected]);

  const checkSystemStatus = async () => {
    backendAPI.setBaseUrl(backendUrl);
    const status = await backendAPI.getBackendStatus();
    setSystemStatus({
      backendConnected: status.connected,
      databaseConnected: status.connected,
      lastCheck: new Date()
    });
  };

  const loadStations = async () => {
    setLoadingStations(true);
    const data = await backendAPI.getAllStations();
    setStations(data);
    setLoadingStations(false);
    console.log('📍 Loaded stations from database:', data);
  };

  const handleSelectStation = async (station: StationInfo) => {
    setSelectedStation(station);
    setSelectedCharger(null);
    setConnectors([]);
    setLoadingChargers(true);

    const data = await backendAPI.getChargersByStation(station.id);
    setChargers(data);
    setLoadingChargers(false);
    console.log(`📊 Loaded ${data.length} chargers for station ${station.name}`);
  };

  const handleSelectCharger = async (charger: ChargerInfo) => {
    setSelectedCharger(charger);
    setLoadingConnectors(true);

    const data = await backendAPI.getConnectors(charger.id);
    setConnectors(data);
    setLoadingConnectors(false);
    console.log(`🔌 Loaded ${data.length} connectors for charger ${charger.ocppIdentity}`);
  };

  const handleStartSimulator = (charger: ChargerInfo) => {
    setSelectedCharger(charger);
    setSimulatorActive(true);
  };

  const handleCancelSimulator = () => {
    setSimulatorActive(false);
    setSelectedCharger(null);
  };

  const handleOpenSessionSimulator = async (session: ActiveSessionMonitorItem) => {
    if (!session.chargerOcppIdentity) {
      return;
    }

    const charger = await backendAPI.getChargerByOcppIdentity(session.chargerOcppIdentity);
    if (!charger) {
      alert(`Unable to locate charger ${session.chargerOcppIdentity}`);
      return;
    }

    let station = stations.find((s) => s.id === charger.stationId) || null;
    if (!station) {
      const stationList = await backendAPI.getAllStations();
      setStations(stationList);
      station = stationList.find((s) => s.id === charger.stationId) || null;
    }

    if (!station) {
      alert(`Unable to locate station for charger ${charger.ocppIdentity}`);
      return;
    }

    setSelectedStation(station);
    setSelectedCharger(charger);

    setLoadingConnectors(true);
    const connectorData = await backendAPI.getConnectors(charger.id);
    setConnectors(connectorData);
    setLoadingConnectors(false);

    setSimulatorActive(true);
  };

  const handleTerminateSession = async (session: ActiveSessionMonitorItem) => {
    const confirmed = window.confirm(`Terminate Session #${session.sessionId} on charger ${session.chargerOcppIdentity}?`);
    if (!confirmed) {
      return;
    }

    const result = await backendAPI.terminateSession(session.sessionId);
    if (!result) {
      alert(`Failed to terminate session #${session.sessionId}`);
      return;
    }

    const [stats, sessionsResponse] = await Promise.all([
      backendAPI.getLiveMonitorStats(),
      backendAPI.getActiveSessionsMonitor(),
    ]);

    if (stats) {
      setLiveMonitor(stats);
    }
    setActiveSessions(sessionsResponse?.sessions ?? []);

    alert(result.message || `Session #${session.sessionId} termination requested`);
  };

  const handleResetSimulator = async () => {
    const confirmed = window.confirm(
      '⚠️ RESET SIMULATOR?\n\n' +
      'This will:\n' +
      '• Set all chargers to Available\n' +
      '• Set all connectors to Available\n' +
      '• Complete all active sessions\n\n' +
      'This action cannot be undone. Continue?'
    );
    
    if (!confirmed) {
      return;
    }

    const result = await backendAPI.resetSimulator();
    if (!result) {
      alert('❌ Failed to reset simulator. Please check backend connection.');
      return;
    }

    // Refresh data after reset
    await Promise.all([
      loadStations(),
      checkSystemStatus(),
    ]);

    const [stats, sessionsResponse] = await Promise.all([
      backendAPI.getLiveMonitorStats(),
      backendAPI.getActiveSessionsMonitor(),
    ]);

    if (stats) {
      setLiveMonitor(stats);
    }
    setActiveSessions(sessionsResponse?.sessions ?? []);

    alert(
      `✅ ${result.message}\n\n` +
      `• Chargers reset: ${result.chargersReset}\n` +
      `• Connectors reset: ${result.connectorsReset}\n` +
      `• Sessions completed: ${result.sessionsCompleted}`
    );
  };

  if (simulatorActive && selectedCharger && selectedStation) {
    const allEvents = liveMonitor?.recentConnectorEvents ?? [];
    const selectedChargerEvents = allEvents.filter((event) => event.chargerId === selectedCharger.ocppIdentity);

    return (
      <div style={{
        padding: '32px',
        maxWidth: '1400px',
        margin: '0 auto',
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        minHeight: '100vh'
      }}>
        {/* Simulator Header */}
        <div style={{
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px',
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          borderRadius: '16px',
          border: '2px solid #475569'
        }}>
          <div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 'bold',
              margin: 0,
              color: '#60a5fa'
            }}>
              ⚡ {selectedStation.name} - {selectedCharger.name}
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#94a3b8',
              margin: '8px 0 0'
            }}>
              OCPP Identity: {selectedCharger.ocppIdentity} | Vendor: {selectedCharger.vendorName}
            </p>
          </div>
          <button
            onClick={handleCancelSimulator}
            style={{
              padding: '12px 28px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
              transition: 'all 0.3s ease'
            }}
          >
            ✕ Back to Selector
          </button>
        </div>

        {/* Simulator Component */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)',
          gap: '16px',
          alignItems: 'start',
          marginBottom: '16px'
        }}>
          <div>
            <ChargerSimulator
              chargerId={selectedCharger.ocppIdentity}
              chargerName={selectedCharger.name}
              backendUrl={backendUrl}
              ocppToken={ocppToken}
              fullWsUrl={fullWsUrl}
              chargerInfo={selectedCharger}
              connectors={connectors}
            />
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            border: '1px solid #475569',
            borderRadius: '12px',
            padding: '16px',
            color: '#e2e8f0'
          }}>
            <h3 style={{ margin: '0 0 12px', color: '#60a5fa', fontSize: '16px' }}>
              Live Monitor Snapshot
            </h3>
            <div style={{ display: 'grid', gap: '8px', fontSize: '13px' }}>
              <div>Connected Chargers: <strong>{liveMonitor?.connectedChargers ?? 0}</strong></div>
              <div>Pending Verification: <strong>{liveMonitor?.pendingVerificationSessions ?? 0}</strong></div>
              <div>Pending Payment: <strong>{pendingPaymentSessions}</strong></div>
              <div>Active Charging: <strong>{liveMonitor?.activeChargingSessions ?? 0}</strong></div>
            </div>
          </div>
        </div>

        <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            border: '1px solid #475569',
            borderRadius: '12px',
            padding: '16px',
            color: '#e2e8f0'
          }}>
            <h3 style={{ margin: '0 0 12px', color: '#60a5fa', fontSize: '16px' }}>
              🧾 Connector Event Logs ({selectedCharger.ocppIdentity})
            </h3>
            <div style={{
              maxHeight: '280px',
              overflowY: 'auto',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '8px'
            }}>
              {selectedChargerEvents.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '13px', padding: '8px' }}>
                  No connector events yet for this charger.
                </div>
              ) : (
                selectedChargerEvents.slice(0, 40).map((event, index) => (
                  <div
                    key={`${event.timestamp}-${index}`}
                    style={{
                      borderBottom: '1px solid #1e293b',
                      padding: '8px 6px',
                      fontSize: '12px',
                      fontFamily: 'monospace'
                    }}
                  >
                    <div style={{ color: '#94a3b8' }}>{event.timestamp}</div>
                    <div style={{ color: '#e2e8f0' }}>
                      [{event.eventType}] connector={event.connectorId ?? '-'} status={event.status}
                    </div>
                    <div style={{ color: '#60a5fa' }}>{event.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>

        <div style={{ marginTop: '16px' }}>
          <CurrentSessionsPanel
            sessions={activeSessions}
            logs={liveMonitor?.recentConnectorEvents ?? []}
            onTerminateSession={handleTerminateSession}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '32px',
      maxWidth: '1400px',
      margin: '0 auto',
      background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '32px',
        textAlign: 'center',
        color: 'white',
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        padding: '32px',
        borderRadius: '20px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        border: '1px solid #475569'
      }}>
        <h1 style={{
          fontSize: '42px',
          fontWeight: 'bold',
          margin: 0,
          background: 'linear-gradient(135deg, #60a5fa 0%, #34d399 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          ⚡ EV Charger Network Simulator
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#cbd5e1',
          margin: '12px 0 0'
        }}>
          Real-time OCPP 1.6 Protocol Simulation with Live Database Integration
        </p>

        {/* System Status Bar */}
        <div style={{
          marginTop: '24px',
          display: 'flex',
          justifyContent: 'center',
          gap: '20px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            padding: '10px 20px',
            background: systemStatus.backendConnected
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(239, 68, 68, 0.15)',
            border: systemStatus.backendConnected
              ? '2px solid #10b981'
              : '2px solid #ef4444',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: systemStatus.backendConnected ? '#10b981' : '#ef4444',
              boxShadow: systemStatus.backendConnected
                ? '0 0 10px #10b981'
                : '0 0 10px #ef4444'
            }} />
            <span style={{
              fontSize: '14px',
              fontWeight: '600',
              color: systemStatus.backendConnected ? '#10b981' : '#ef4444'
            }}>
              Backend {systemStatus.backendConnected ? 'Online' : 'Offline'}
            </span>
          </div>

          <div style={{
            padding: '10px 20px',
            background: systemStatus.databaseConnected
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(239, 68, 68, 0.15)',
            border: systemStatus.databaseConnected
              ? '2px solid #10b981'
              : '2px solid #ef4444',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: systemStatus.databaseConnected ? '#10b981' : '#ef4444',
              boxShadow: systemStatus.databaseConnected
                ? '0 0 10px #10b981'
                : '0 0 10px #ef4444'
            }} />
            <span style={{
              fontSize: '14px',
              fontWeight: '600',
              color: systemStatus.databaseConnected ? '#10b981' : '#ef4444'
            }}>
              Database {systemStatus.databaseConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div style={{
            padding: '10px 20px',
            background: 'rgba(96, 165, 250, 0.15)',
            border: '2px solid #60a5fa',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#94a3b8'
          }}>
            🕐 Last Check: {systemStatus.lastCheck.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          border: '2px solid #475569',
          borderRadius: '16px',
          padding: '28px',
          marginBottom: '28px',
          color: '#e2e8f0',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 20px', color: '#60a5fa' }}>
            ⚙️ Configuration Settings
          </h2>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '13px', 
              color: '#94a3b8', 
              marginBottom: '8px',
              fontWeight: '600'
            }}>
              Backend URL
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                placeholder="http://localhost:8080"
                style={{
                  flex: 1,
                  padding: '14px 16px',
                  border: '2px solid #475569',
                  borderRadius: '10px',
                  background: '#0f172a',
                  color: '#e2e8f0',
                  fontSize: '15px',
                  fontFamily: 'monospace'
                }}
              />
              <button
                onClick={() => {
                  localStorage.setItem('sim_backendUrl', backendUrl);
                  localStorage.setItem('sim_ocppToken', ocppToken);
                  setShowSettings(false);
                  checkSystemStatus();
                }}
                style={{
                  padding: '14px 32px',
                  background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(14, 165, 233, 0.4)',
                  transition: 'all 0.3s ease'
                }}
              >
                ✓ Apply
              </button>
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              color: '#94a3b8',
              marginBottom: '8px',
              fontWeight: '600'
            }}>
              OCPP Token (required when backend security mode is TOKEN)
            </label>
            <input
              type="password"
              value={ocppToken}
              onChange={(e) => setOcppToken(e.target.value)}
              placeholder="Enter OCPP token from Admin OCPP Configuration"
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid #475569',
                borderRadius: '10px',
                background: '#0f172a',
                color: '#e2e8f0',
                fontSize: '15px',
                fontFamily: 'monospace'
              }}
            />
          </div>
          <div style={{
            background: 'rgba(15, 23, 42, 0.5)',
            padding: '14px',
            borderRadius: '8px',
            border: '1px solid #334155'
          }}>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
              💡 <strong>Info:</strong> The simulator will connect to WebSocket endpoint at 
              <code style={{ 
                color: '#60a5fa', 
                padding: '2px 6px', 
                background: '#0f172a',
                borderRadius: '4px',
                marginLeft: '6px',
                fontFamily: 'monospace'
              }}>
                ws://{backendUrl.replace(/^https?:\/\//, '')}/ws/ocpp/1.6/{'{stationId}'}/{'{chargerIdentity}'}?token={'{token}'}
              </code>
            </p>
          </div>
        </div>
      )}

      {!showSettings && (
        <div style={{ 
          marginBottom: '28px', 
          display: 'flex', 
          gap: '12px',
          flexWrap: 'wrap' 
        }}>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              padding: '12px 28px',
              background: 'linear-gradient(135deg, #475569 0%, #64748b 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '15px',
              boxShadow: '0 4px 14px rgba(71, 85, 105, 0.4)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(71, 85, 105, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(71, 85, 105, 0.4)';
            }}
          >
            ⚙️ Configuration Settings
          </button>

          <button
            onClick={handleResetSimulator}
            disabled={!systemStatus.backendConnected}
            style={{
              padding: '12px 28px',
              background: systemStatus.backendConnected 
                ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                : 'linear-gradient(135deg, #4b5563 0%, #6b7280 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '700',
              cursor: systemStatus.backendConnected ? 'pointer' : 'not-allowed',
              fontSize: '15px',
              boxShadow: systemStatus.backendConnected 
                ? '0 4px 14px rgba(220, 38, 38, 0.4)'
                : '0 4px 14px rgba(75, 85, 99, 0.4)',
              transition: 'all 0.3s ease',
              opacity: systemStatus.backendConnected ? 1 : 0.5
            }}
            onMouseEnter={(e) => {
              if (systemStatus.backendConnected) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(220, 38, 38, 0.6)';
              }
            }}
            onMouseLeave={(e) => {
              if (systemStatus.backendConnected) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(220, 38, 38, 0.4)';
              }
            }}
          >
            🔄 Reset All
          </button>
        </div>
      )}

      {/* Backend Connection Error State */}
      {!systemStatus.backendConnected && (
        <div style={{
          marginBottom: '32px',
          padding: '24px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '2px solid #ef4444',
          borderRadius: '12px',
          color: '#fca5a5'
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 'bold' }}>
            ⚠️ Backend Connection Failed
          </h3>
          <p style={{ margin: '0 0 8px' }}>
            Unable to connect to backend at <code style={{ background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px' }}>{backendUrl}</code>
          </p>
          <p style={{ margin: 0, fontSize: '14px', color: '#fecaca' }}>
            Please ensure the backend is running on port 8080 and refresh the page.
          </p>
        </div>
      )}

      {/* Stations Section */}
      {systemStatus.backendConnected && (
        <>
          <div style={{ marginBottom: '32px' }}>
            <CurrentSessionsPanel
              sessions={activeSessions}
              logs={liveMonitor?.recentConnectorEvents ?? []}
              onOpenSession={handleOpenSessionSimulator}
              onTerminateSession={handleTerminateSession}
            />
          </div>

          <div style={{ marginBottom: '48px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '2px solid #475569'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '28px',
                fontWeight: 'bold',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                📍 Charging Stations
                <span style={{
                  background: 'rgba(96, 165, 250, 0.2)',
                  border: '1px solid #60a5fa',
                  borderRadius: '20px',
                  padding: '4px 12px',
                  fontSize: '14px',
                  color: '#60a5fa',
                  fontWeight: '600'
                }}>
                  {stations.length}
                </span>
              </h2>
              <button
                onClick={loadStations}
                disabled={loadingStations}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(96, 165, 250, 0.2)',
                  border: '1px solid #60a5fa',
                  color: '#60a5fa',
                  borderRadius: '8px',
                  cursor: loadingStations ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  opacity: loadingStations ? 0.6 : 1,
                  transition: 'all 0.3s'
                }}
                onMouseOver={(e) => {
                  if (!loadingStations) {
                    e.currentTarget.style.background = 'rgba(96, 165, 250, 0.3)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!loadingStations) {
                    e.currentTarget.style.background = 'rgba(96, 165, 250, 0.2)';
                  }
                }}
              >
                {loadingStations ? '⟳ Loading...' : '🔄 Refresh'}
              </button>
            </div>

            {loadingStations ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <p style={{ fontSize: '16px' }}>⟳ Loading stations from database...</p>
              </div>
            ) : stations.length === 0 ? (
              <div style={{
                padding: '40px',
                background: 'rgba(148, 163, 184, 0.05)',
                borderRadius: '12px',
                textAlign: 'center',
                border: '2px dashed #475569',
                color: '#94a3b8'
              }}>
                <p style={{ margin: 0, fontSize: '16px' }}>
                  No charging stations available. Please check your database connection.
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '20px'
              }}>
                {stations.map((station) => (
                  <div
                    key={station.id}
                    onClick={() => handleSelectStation(station)}
                    style={{
                      padding: '24px',
                      background: selectedStation?.id === station.id
                        ? 'linear-gradient(135deg, #34d399 0%, #10b981 100%)'
                        : 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
                      border: selectedStation?.id === station.id
                        ? '2px solid #10b981'
                        : '2px solid #475569',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      boxShadow: selectedStation?.id === station.id
                        ? '0 8px 32px rgba(16, 185, 129, 0.3)'
                        : 'none'
                    }}
                    onMouseOver={(e) => {
                      if (selectedStation?.id !== station.id) {
                        e.currentTarget.style.borderColor = '#64748b';
                        e.currentTarget.style.background = 'linear-gradient(135deg, #475569 0%, #334155 100%)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (selectedStation?.id !== station.id) {
                        e.currentTarget.style.borderColor = '#475569';
                        e.currentTarget.style.background = 'linear-gradient(135deg, #334155 0%, #1e293b 100%)';
                      }
                    }}
                  >
                    <h3 style={{
                      margin: '0 0 12px',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: selectedStation?.id === station.id ? '#0f172a' : '#e2e8f0'
                    }}>
                      {station.name}
                    </h3>
                    <div style={{
                      display: 'grid',
                      gap: '8px',
                      fontSize: '13px',
                      color: selectedStation?.id === station.id ? '#0f172a' : '#cbd5e1'
                    }}>
                      <p style={{ margin: 0 }}>📌 {station.location}</p>
                      <p style={{ margin: 0 }}>🏘️ {station.city}, {station.state}</p>
                      <p style={{ margin: 0 }}>🌍 {station.country}</p>
                      <p style={{
                        margin: '8px 0 0',
                        padding: '8px',
                        background: selectedStation?.id === station.id ? 'rgba(15, 23, 42, 0.3)' : 'rgba(96, 165, 250, 0.15)',
                        borderRadius: '6px',
                        fontWeight: '600'
                      }}>
                        ⚡ {station.totalChargers || 0} Chargers
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chargers Section */}
          {selectedStation && (
            <div style={{ marginBottom: '48px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '24px',
                paddingBottom: '16px',
                borderBottom: '2px solid #475569'
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '28px',
                  fontWeight: 'bold',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  ⚡ Chargers
                  <span style={{
                    background: 'rgba(96, 165, 250, 0.2)',
                    border: '1px solid #60a5fa',
                    borderRadius: '20px',
                    padding: '4px 12px',
                    fontSize: '14px',
                    color: '#60a5fa',
                    fontWeight: '600'
                  }}>
                    {chargers.length}
                  </span>
                </h2>
                <span style={{
                  fontSize: '14px',
                  color: '#94a3b8',
                  fontStyle: 'italic'
                }}>
                  Selected: {selectedStation.name}
                </span>
              </div>

              {loadingChargers ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  <p style={{ fontSize: '16px' }}>⟳ Loading chargers...</p>
                </div>
              ) : chargers.length === 0 ? (
                <div style={{
                  padding: '40px',
                  background: 'rgba(148, 163, 184, 0.05)',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: '2px dashed #475569',
                  color: '#94a3b8'
                }}>
                  <p style={{ margin: 0, fontSize: '16px' }}>
                    No chargers available for this station.
                  </p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '20px'
                }}>
                  {chargers.map((charger) => (
                    <div
                      key={charger.id}
                      onClick={() => handleSelectCharger(charger)}
                      style={{
                        padding: '24px',
                        background: selectedCharger?.id === charger.id
                          ? 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)'
                          : 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
                        border: selectedCharger?.id === charger.id
                          ? '2px solid #60a5fa'
                          : '2px solid #475569',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        boxShadow: selectedCharger?.id === charger.id
                          ? '0 8px 32px rgba(96, 165, 250, 0.3)'
                          : 'none'
                      }}
                      onMouseOver={(e) => {
                        if (selectedCharger?.id !== charger.id) {
                          e.currentTarget.style.borderColor = '#64748b';
                          e.currentTarget.style.background = 'linear-gradient(135deg, #475569 0%, #334155 100%)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (selectedCharger?.id !== charger.id) {
                          e.currentTarget.style.borderColor = '#475569';
                          e.currentTarget.style.background = 'linear-gradient(135deg, #334155 0%, #1e293b 100%)';
                        }
                      }}
                    >
                      <h3 style={{
                        margin: '0 0 16px',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: selectedCharger?.id === charger.id ? '#0f172a' : '#e2e8f0',
                        wordBreak: 'break-all'
                      }}>
                        {charger.ocppIdentity}
                      </h3>

                      <div style={{
                        display: 'grid',
                        gap: '10px',
                        fontSize: '13px',
                        color: selectedCharger?.id === charger.id ? '#0f172a' : '#cbd5e1'
                      }}>
                        <div>
                          <p style={{ margin: '0 0 4px', fontWeight: '600', opacity: 0.8 }}>Vendor</p>
                          <p style={{ margin: 0 }}>{charger.vendorName || 'Unknown'}</p>
                        </div>
                        <div>
                          <p style={{ margin: '0 0 4px', fontWeight: '600', opacity: 0.8 }}>Model</p>
                          <p style={{ margin: 0 }}>{charger.model || 'Unknown'}</p>
                        </div>
                        <div>
                          <p style={{ margin: '0 0 4px', fontWeight: '600', opacity: 0.8 }}>Serial #</p>
                          <p style={{ margin: 0, fontSize: '12px', fontFamily: 'monospace' }}>{charger.serialNumber || 'N/A'}</p>
                        </div>
                        <div style={{
                          marginTop: '8px',
                          padding: '8px',
                          background: selectedCharger?.id === charger.id ? 'rgba(15, 23, 42, 0.3)' : 'rgba(96, 165, 250, 0.15)',
                          borderRadius: '6px',
                          fontWeight: '600'
                        }}>
                          ⚡ Max Power: {charger.maxPowerKw?.toFixed(1) || '0'}kW
                        </div>
                        <div style={{
                          padding: '6px 10px',
                          background: charger.enabled
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                          border: charger.enabled
                            ? '1px solid #10b981'
                            : '1px solid #ef4444',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: charger.enabled ? '#10b981' : '#ef4444',
                          fontWeight: '600',
                          textAlign: 'center'
                        }}>
                          {charger.enabled ? '✓ Enabled' : '✗ Disabled'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Connectors Section */}
          {selectedCharger && (
            <div style={{ marginBottom: '48px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '24px',
                paddingBottom: '16px',
                borderBottom: '2px solid #475569'
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '28px',
                  fontWeight: 'bold',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  🔌 Connectors
                  <span style={{
                    background: 'rgba(96, 165, 250, 0.2)',
                    border: '1px solid #60a5fa',
                    borderRadius: '20px',
                    padding: '4px 12px',
                    fontSize: '14px',
                    color: '#60a5fa',
                    fontWeight: '600'
                  }}>
                    {connectors.length}
                  </span>
                </h2>
                <span style={{
                  fontSize: '14px',
                  color: '#94a3b8',
                  fontStyle: 'italic'
                }}>
                  Selected Charger: {selectedCharger.ocppIdentity}
                </span>
              </div>

              {loadingConnectors ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  <p style={{ fontSize: '16px' }}>⟳ Loading connectors...</p>
                </div>
              ) : connectors.length === 0 ? (
                <div style={{
                  padding: '40px',
                  background: 'rgba(148, 163, 184, 0.05)',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: '2px dashed #475569',
                  color: '#94a3b8'
                }}>
                  <p style={{ margin: 0, fontSize: '16px' }}>
                    No connectors configured for this charger.
                  </p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                  gap: '16px'
                }}>
                  {connectors.map((connector) => (
                    <div
                      key={connector.id}
                      style={{
                        padding: '20px',
                        background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
                        border: '2px solid #475569',
                        borderRadius: '12px',
                        transition: 'all 0.3s'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = '#64748b';
                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(148, 163, 184, 0.2)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = '#475569';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <h3 style={{
                        margin: '0 0 12px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: '#e2e8f0'
                      }}>
                        Connector {connector.connectorNo}
                      </h3>

                      <div style={{
                        display: 'grid',
                        gap: '8px',
                        fontSize: '13px',
                        color: '#cbd5e1'
                      }}>
                        <div>
                          <p style={{ margin: '0 0 4px', fontWeight: '600', opacity: 0.8, fontSize: '12px' }}>Type</p>
                          <p style={{
                            margin: 0,
                            background: 'rgba(96, 165, 250, 0.15)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontWeight: '600',
                            color: '#60a5fa'
                          }}>
                            {connector.type || 'Unknown'}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin: '0 0 4px', fontWeight: '600', opacity: 0.8, fontSize: '12px' }}>Max Power</p>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>
                            {connector.maxPowerKw?.toFixed(1) || '0'} kW
                          </p>
                        </div>
                        <div style={{
                          padding: '8px 10px',
                          background: connector.status === 'Available'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(148, 163, 184, 0.15)',
                          border: connector.status === 'Available'
                            ? '1px solid #10b981'
                            : '1px solid #64748b',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: connector.status === 'Available' ? '#10b981' : '#94a3b8',
                          fontWeight: '600',
                          textAlign: 'center'
                        }}>
                          {connector.status || 'Unknown'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Launch Simulator Button */}
              {connectors.length > 0 && (
                <div style={{
                  marginTop: '32px',
                  textAlign: 'center'
                }}>
                  <button
                    onClick={() => handleStartSimulator(selectedCharger)}
                    style={{
                      padding: '16px 48px',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: 'white',
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      boxShadow: '0 8px 32px rgba(139, 92, 246, 0.4)',
                      transition: 'all 0.3s',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.boxShadow = '0 12px 48px rgba(139, 92, 246, 0.6)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.boxShadow = '0 8px 32px rgba(139, 92, 246, 0.4)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    ▶️ Launch OCPP Simulator
                  </button>
                  <p style={{
                    marginTop: '12px',
                    fontSize: '13px',
                    color: '#94a3b8'
                  }}>
                    {selectedCharger.ocppIdentity} at {selectedStation?.name}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Documentation Sections */}
      <div style={{
        marginTop: '48px',
        padding: '24px',
        background: '#1e293b',
        borderRadius: '12px',
        border: '1px solid #334155',
        color: '#cbd5e1',
        fontSize: '14px'
      }}>
        <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>How to Use:</h3>
        <ol style={{ lineHeight: '1.8', marginBottom: 0 }}>
          <li><strong>Connect:</strong> Click "Connect" to establish WebSocket connection to backend</li>
          <li><strong>Receive Commands:</strong> Backend sends RemoteStartTransaction when customer confirms charger is plugged in</li>
          <li><strong>Send Meter Values:</strong> During charging, simulator sends energy consumption every 3 seconds</li>
          <li><strong>Auto-Stop:</strong> Backend sends RemoteStopTransaction when charging limit is reached</li>
          <li><strong>Status Updates:</strong> Simulator sends ConnectorStatus updates to backend</li>
        </ol>
      </div>

      <div style={{
        marginTop: '16px',
        padding: '24px',
        background: '#0f172a',
        borderRadius: '12px',
        border: '1px solid #334155',
        color: '#cbd5e1',
        fontSize: '13px',
        fontFamily: 'monospace'
      }}>
        <h3 style={{ color: '#e2e8f0', marginTop: 0, marginBottom: '12px' }}>OCPP Protocol Flow:</h3>
        <div style={{ lineHeight: '1.8' }}>
          <div>→ Simulator Connects (WebSocket) to ws://backend:8080/ws/ocpp/1.6/stationId/chargePointIdentity</div>
          <div>← Backend sends: RemoteStartTransaction</div>
          <div>→ Simulator applies: Status = Charging, starts meter values</div>
          <div>→ Simulator sends: MeterValues {`{energyWh, powerW}`} every 3 seconds</div>
          <div>← Backend checks: if limit reached, sends RemoteStopTransaction</div>
          <div>→ Simulator applies: Status = Available, stops meter values</div>
          <div>← Backend: Finalizes session, calculates invoice, processes refund</div>
        </div>
      </div>
    </div>
  );
}

export default App;
