import { useState, useEffect, useRef } from 'react';
import { OcppProtocol, ChargerState } from '../ocpp/OcppProtocol';
import { backendAPI, ChargerInfo, ConnectorInfo } from '../api/backend';
import './ChargerSimulator.css';

interface ChargerSimulatorProps {
  chargerId: string | number;
  chargerName: string;
  backendUrl: string;
  ocppToken?: string;
  chargerInfo?: ChargerInfo;
  connectors?: ConnectorInfo[];
}

const SIMULATION_TICK_MS = 1000;
// Real charger (ACO110W33H) is 3-phase AC ~17-18 kW (3× ~230V × ~25A)
const SIMULATED_POWER_MIN_KW = 15;
const SIMULATED_POWER_MAX_KW = 18;
const SIMULATED_POWER_DEFAULT_KW = 17.29;

export default function ChargerSimulator({ 
  chargerId, 
  chargerName, 
  backendUrl, 
  ocppToken,
  chargerInfo: providedChargerInfo,
  connectors: providedConnectors 
}: ChargerSimulatorProps) {
  const getPaymentBadgeColor = (paymentStatus?: string) => {
    switch ((paymentStatus || '').toUpperCase()) {
      case 'PAID':
      case 'CAPTURED':
        return '#10b981';
      case 'PREAUTH_SUCCESS':
        return '#3b82f6';
      case 'AWAITING_PAYMENT':
      case 'PAYMENT_PENDING':
        return '#f59e0b';
      case 'PREAUTH_FAILED':
      case 'SETTLEMENT_FAILED':
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  const [connected, setConnected] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [chargerInfo, setChargerInfo] = useState<ChargerInfo | null>(providedChargerInfo || null);
  const [connectors, setConnectors] = useState<ConnectorInfo[]>(providedConnectors || []);
  const [selectedConnector, setSelectedConnector] = useState<ConnectorInfo | null>(
    providedConnectors && providedConnectors.length > 0 ? providedConnectors[0] : null
  );
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [chargerState, setChargerState] = useState<ChargerState>({
    identity: String(chargerId),
    status: 'Available',
    activeConnectorId: 1,
    connectorStatus: { 1: 'Available' },
    transactionId: null,
    sessionId: null,
    meterStart: 0,
    meterValue: 0,
    power: 0,
    temperature: 48.6,
    soc: 30,
    authorized: false,
    bootupSent: false,
    vehicleConnected: false,
    evPaused: false,
    evsePaused: false,
    faulted: false,
    unavailable: false,
    pendingRemoteStart: false
  });

  const [meterValueKwh, setMeterValueKwh] = useState(0);
  const [powerKw, setPowerKw] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [backendConnectorStatus, setBackendConnectorStatus] = useState<string | null>(null);
  const [connectorSimulation, setConnectorSimulation] = useState({
    vehicleConnected: false,
    evPaused: false,
    evsePaused: false,
    faulted: false,
    unavailable: false,
    pendingRemoteStart: false,
  });
  const [sessionLogs, setSessionLogs] = useState<Array<{timestamp: Date; message: string; type: 'info' | 'success' | 'warning'}>>([]);
  const [activeSessionUserInfo, setActiveSessionUserInfo] = useState<{
    vehicleNumber?: string;
    phoneNumber?: string;
    startedBy?: string;
    paymentMode?: string;
    paymentStatus?: string;
    limitType?: string;
    limitValue?: number;
    startedAt?: string;
  } | null>(null);
  
  const ocppRef = useRef<OcppProtocol | null>(null);
  const autoConnectAttemptedRef = useRef(false);
  const meterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const powerVariationRef = useRef(SIMULATED_POWER_DEFAULT_KW);
  const backendCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectorRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousStatusRef = useRef<ChargerState['status']>('Offline');
  const previousSessionIdRef = useRef<number | null>(null);

  // Load charger info from database on mount if not provided
  useEffect(() => {
    backendAPI.setBaseUrl(backendUrl);
    
    if (!providedChargerInfo) {
      loadChargerInfo();
    }
    if (!providedConnectors) {
      loadConnectors();
    }
    
    // Check backend connectivity every 10 seconds
    backendCheckIntervalRef.current = setInterval(checkBackendStatus, 10000);
    checkBackendStatus();
    
    return () => {
      if (backendCheckIntervalRef.current) {
        clearInterval(backendCheckIntervalRef.current);
      }
    };
  }, [chargerId, backendUrl]);

  const checkBackendStatus = async () => {
    const status = await backendAPI.getBackendStatus();
    setBackendConnected(status.connected);
  };

  const loadChargerInfo = async () => {
    const info = await backendAPI.getChargerByOcppIdentity(String(chargerId));
    if (info) {
      setChargerInfo(info);
      console.log('📦 Loaded charger from database:', info);
    }
  };

  const loadConnectors = async () => {
    if (!chargerInfo) return;
    const connectorList = await backendAPI.getConnectors(chargerInfo.id);
    if (connectorList && connectorList.length > 0) {
      setConnectors(connectorList);
      setSelectedConnector(connectorList[0]);
      setBackendConnectorStatus(connectorList[0].status || null);
      console.log('🔌 Loaded connectors for charger:', connectorList);
    }
  };

  const refreshConnectorStatuses = async () => {
    if (!chargerInfo) return;

    const connectorList = await backendAPI.getConnectors(chargerInfo.id);
    if (!connectorList || connectorList.length === 0) {
      return;
    }

    setConnectors(connectorList);

    const shouldFollowActiveConnector = Boolean(chargerState.sessionId || chargerState.pendingRemoteStart || isCharging);
    const currentConnectorNo = shouldFollowActiveConnector
      ? (chargerState.activeConnectorId || selectedConnector?.connectorNo || 1)
      : (selectedConnector?.connectorNo || chargerState.activeConnectorId || 1);

    const matchedConnector = connectorList.find((connector) => connector.connectorNo === currentConnectorNo)
      || connectorList[0];

    if (matchedConnector) {
      setBackendConnectorStatus(matchedConnector.status || null);
      setSelectedConnector((prev) => {
        if (shouldFollowActiveConnector) {
          return matchedConnector;
        }
        if (!prev || prev.connectorNo === matchedConnector.connectorNo) {
          return matchedConnector;
        }
        return prev;
      });
    }
  };

  const addSessionLog = (message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const newLog = { timestamp: new Date(), message, type };
    setSessionLogs(prev => [newLog, ...prev].slice(0, 50)); // Keep last 50 logs
  };

  const syncConnectorSimulationState = (
    protocol: OcppProtocol | null = ocppRef.current,
    connectorNo?: number
  ) => {
    // Use latest state from protocol object to avoid stale React closure issues
    const latestState = protocol ? protocol.getChargerState() : chargerState;
    const latestIsCharging = Boolean(
      latestState.status === 'Charging' ||
      latestState.status === 'SuspendedEV' ||
      latestState.status === 'SuspendedEVSE' ||
      latestState.transactionId
    );
    const shouldFollowActiveConnector = Boolean(latestState.sessionId || latestState.pendingRemoteStart || latestIsCharging);
    const resolvedConnectorNo = connectorNo ?? (shouldFollowActiveConnector
      ? (latestState.activeConnectorId || selectedConnector?.connectorNo || 1)
      : (selectedConnector?.connectorNo || latestState.activeConnectorId || 1));

    if (!protocol) {
      setConnectorSimulation({
        vehicleConnected: false,
        evPaused: false,
        evsePaused: false,
        faulted: false,
        unavailable: false,
        pendingRemoteStart: false,
      });
      return;
    }

    setConnectorSimulation(protocol.getConnectorSimulationState(resolvedConnectorNo));
  };

  const syncActiveSession = async (protocol: OcppProtocol) => {
    const activeSession = await backendAPI.getActiveSessionByOcppIdentity(String(chargerId));
    if (!activeSession?.active || !activeSession.sessionId) {
      addSessionLog('No active session found on backend', 'info');
      return;
    }

    const connectorId = Number(activeSession.connectorNo) > 0 ? Number(activeSession.connectorNo) : 1;
    const latestMeterWh = Number(activeSession.latestMeterWh || 0);
    const meterStartWh = Number(activeSession.meterStart || 0);

    setSessionId(activeSession.sessionId);
    setLastUpdate(new Date());
    setActiveSessionUserInfo({
      vehicleNumber: activeSession.vehicleNumber,
      phoneNumber: activeSession.phoneNumber,
      startedBy: activeSession.startedBy,
      paymentMode: activeSession.paymentMode,
      paymentStatus: activeSession.paymentStatus,
      limitType: activeSession.limitType,
      limitValue: activeSession.limitValue,
      startedAt: activeSession.startedAt
    });

    if (!activeSession.transactionId) {
      addSessionLog(`⏳ Pending Session #${activeSession.sessionId} | Status: ${activeSession.status} | Connector ${connectorId}`, 'warning');
      return;
    }

    protocol.recoverActiveSession({
      sessionId: activeSession.sessionId,
      connectorId,
      transactionId: activeSession.transactionId,
      meterStart: meterStartWh,
      latestMeterWh,
    });

    if (connectors.length > 0) {
      const matchedConnector = connectors.find((c) => c.connectorNo === connectorId);
      if (matchedConnector) {
        setSelectedConnector(matchedConnector);
      }
    }

    setMeterValueKwh(latestMeterWh / 1000);
    setIsCharging(true);
    const energyKwh = ((latestMeterWh - meterStartWh) / 1000).toFixed(3);
    addSessionLog(`🔄 Restored Session #${activeSession.sessionId} | Connector ${connectorId} | TX ${activeSession.transactionId}`, 'success');
    addSessionLog(`📊 Resumed at ${energyKwh} kWh | Status: ${activeSession.status}`, 'info');
    if (activeSession.vehicleNumber) {
      addSessionLog(`🚗 Vehicle: ${activeSession.vehicleNumber} | User: ${activeSession.phoneNumber || 'N/A'}`, 'info');
    }
    console.log(`🔄 Restored active session ${activeSession.sessionId} on connector ${connectorId}`);
  };

  // Load connectors when chargerInfo is loaded
  useEffect(() => {
    if (chargerInfo && connectors.length === 0) {
      loadConnectors();
    }
  }, [chargerInfo]);

  useEffect(() => {
    return () => {
      if (ocppRef.current) {
        ocppRef.current.disconnect();
      }
      if (meterIntervalRef.current) {
        clearInterval(meterIntervalRef.current);
      }
      if (connectorRefreshIntervalRef.current) {
        clearInterval(connectorRefreshIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!connected || !chargerInfo) {
      if (connectorRefreshIntervalRef.current) {
        clearInterval(connectorRefreshIntervalRef.current);
        connectorRefreshIntervalRef.current = null;
      }
      return;
    }

    void refreshConnectorStatuses();
    connectorRefreshIntervalRef.current = setInterval(() => {
      void refreshConnectorStatuses();
    }, 3000);

    return () => {
      if (connectorRefreshIntervalRef.current) {
        clearInterval(connectorRefreshIntervalRef.current);
        connectorRefreshIntervalRef.current = null;
      }
    };
  }, [connected, chargerInfo?.id, selectedConnector?.connectorNo, chargerState.activeConnectorId]);

  useEffect(() => {
    autoConnectAttemptedRef.current = false;
  }, [chargerId]);

  const connectToBackend = async (silent = false) => {
    if (connected || ocppRef.current) {
      return;
    }

    if (!backendConnected) {
      if (!silent) {
        alert('⚠️ Backend is not reachable. Please check if backend is running on ' + backendUrl);
      }
      return;
    }
    
    try {
      const stationSegment = chargerInfo?.stationId ? String(chargerInfo.stationId) : 'station';
      const ocppVersion = chargerInfo?.ocppVersion || '1.6';

      const protocol = new OcppProtocol(backendUrl, String(chargerId), (state) => {
        const previousStatus = previousStatusRef.current;
        const previousSessionId = previousSessionIdRef.current;

        setChargerState(state);
        setLastUpdate(new Date());
        setSessionId(state.sessionId ?? null);

        if (state.status === 'Offline') {
          setConnected(false);
          setIsCharging(false);
          setSessionId(null);
          setActiveSessionUserInfo(null);
          setPowerKw(0);
          addSessionLog('⚠️ OCPP socket closed by backend. Check token, charger identity, and backend URL.', 'warning');
          previousStatusRef.current = 'Offline';
          previousSessionIdRef.current = null;
          return;
        }

        if (state.status === 'Preparing' && previousStatus !== 'Preparing') {
          addSessionLog(`🔌 Connector ${state.activeConnectorId} is plugged and waiting for transaction start`, 'info');
        }

        if (state.status === 'Charging' && previousStatus !== 'Charging') {
          setIsCharging(true);
          syncConnectorSimulationState(protocol);
          addSessionLog(
            previousSessionId === state.sessionId
              ? `⚡ Charging resumed | Session #${state.sessionId} | TX ${state.transactionId}`
              : `⚡ Charging started | Session #${state.sessionId} | TX ${state.transactionId}`,
            'success'
          );
        } else if ((state.status === 'SuspendedEV' || state.status === 'SuspendedEVSE') && previousStatus !== state.status) {
          setIsCharging(false);
          addSessionLog(
            state.status === 'SuspendedEV'
              ? `⏸️ Charging paused by vehicle / unplug event on connector ${state.activeConnectorId}`
              : `⏸️ Charging paused by charger on connector ${state.activeConnectorId}`,
            'warning'
          );
        } else if (state.status === 'Faulted' && previousStatus !== 'Faulted') {
          setIsCharging(false);
          addSessionLog(`🧯 Faulted on connector ${state.activeConnectorId} | backend should receive Faulted then stop flow`, 'warning');
        } else if ((state.status === 'Available' || state.status === 'Finishing') && previousStatus !== state.status && previousStatus !== 'Offline') {
          if (previousSessionId) {
            addSessionLog(`🛑 Session flow moved to ${state.status} on connector ${state.activeConnectorId}`, 'warning');
          }
          if (state.status === 'Available') {
            setIsCharging(false);
            if (!state.sessionId) {
              setActiveSessionUserInfo(null);
            }
          }
        }

        previousStatusRef.current = state.status;
        previousSessionIdRef.current = state.sessionId ?? null;
      }, stationSegment, ocppVersion, ocppToken);

      await protocol.connect();
      ocppRef.current = protocol;
      setConnected(true);
      setLastUpdate(new Date());
      autoConnectAttemptedRef.current = true;
      addSessionLog('✅ Connected to backend OCPP server', 'success');
      await syncActiveSession(protocol);
      syncConnectorSimulationState(protocol);
      console.log('✅ Charger connected and synced with backend database');
    } catch (err) {
      console.error('Failed to connect:', err);
      if (!silent) {
        alert('Failed to connect to backend: ' + (err as Error).message);
      }
    }
  };

  const handleConnect = async () => {
    await connectToBackend(false);
  };

  useEffect(() => {
    if (!backendConnected || connected || autoConnectAttemptedRef.current) {
      return;
    }
    autoConnectAttemptedRef.current = true;
    connectToBackend(true);
  }, [backendConnected, connected, chargerId]);

  useEffect(() => {
    syncConnectorSimulationState();
  }, [connected, selectedConnector?.connectorNo, chargerState.activeConnectorId, lastUpdate]);

  const handleDisconnect = () => {
    if (ocppRef.current) {
      ocppRef.current.disconnect();
      ocppRef.current = null;
    }
    addSessionLog('🔌 Disconnected from backend', 'warning');
    setConnected(false);
    setIsCharging(false);
    setMeterValueKwh(0);
    setPowerKw(0);
    setBackendConnectorStatus(null);
    setConnectorSimulation({
      vehicleConnected: false,
      evPaused: false,
      evsePaused: false,
      faulted: false,
      unavailable: false,
      pendingRemoteStart: false,
    });
    previousStatusRef.current = 'Offline';
    previousSessionIdRef.current = null;
    setLastUpdate(new Date());
    console.log('🔌 Charger disconnected from backend');
  };

  const startMeterSimulation = () => {
    if (!ocppRef.current || !isCharging) return;

    if (meterIntervalRef.current) {
      clearInterval(meterIntervalRef.current);
    }

    // Use absolute odometer value (meterStart from charger state), same as real charger
    const stateNow = ocppRef.current.getChargerState();
    const absoluteBase = stateNow.meterStart > 0 ? stateNow.meterStart : Math.max(0, Math.round(meterValueKwh * 1000));
    let accumulatedWh = absoluteBase;
    powerVariationRef.current = Math.max(
      SIMULATED_POWER_MIN_KW,
      Math.min(SIMULATED_POWER_MAX_KW, powerVariationRef.current || SIMULATED_POWER_DEFAULT_KW),
    );
    
    meterIntervalRef.current = setInterval(() => {
      // Simulate power variation
      powerVariationRef.current += (Math.random() - 0.5) * 6;
      powerVariationRef.current = Math.max(
        SIMULATED_POWER_MIN_KW,
        Math.min(SIMULATED_POWER_MAX_KW, powerVariationRef.current),
      );

      const watts = powerVariationRef.current * 1000;
      
      // Accumulate energy: watts / 3600 * interval(seconds) = Wh
      accumulatedWh += (watts / 3600) * (SIMULATION_TICK_MS / 1000);
      const kwh = accumulatedWh / 1000;

      setMeterValueKwh(kwh);
      setPowerKw(parseFloat(powerVariationRef.current.toFixed(2)));
      setLastUpdate(new Date());

      // Send meter values to backend
      if (ocppRef.current) {
        const connectorId = chargerState.activeConnectorId || selectedConnector?.connectorNo || 1;
        ocppRef.current.sendMeterValues(connectorId, Math.round(accumulatedWh), Math.round(watts));
        if (Math.round(accumulatedWh) % 5000 < 10) { // Log every ~5kWh
          addSessionLog(`📊 Meter update: ${kwh.toFixed(3)} kWh @ ${powerVariationRef.current.toFixed(1)} kW`, 'info');
        }
      }
    }, SIMULATION_TICK_MS);
  };

  const stopMeterSimulation = () => {
    if (meterIntervalRef.current) {
      clearInterval(meterIntervalRef.current);
      meterIntervalRef.current = null;
    }
  };

  const selectedConnectorId = selectedConnector?.connectorNo || 1;
  const sessionInProgress = Boolean(sessionId || chargerState.sessionId || chargerState.pendingRemoteStart);
  const activeOrSelectedConnectorId = sessionInProgress
    ? (chargerState.activeConnectorId || selectedConnectorId)
    : selectedConnectorId;
  const activeOrSelectedConnectorStatus =
    chargerState.connectorStatus[activeOrSelectedConnectorId] || chargerState.status || 'Available';

  const handleVehicleConnectionState = (status: 'Preparing' | 'Available') => {
    if (!ocppRef.current) {
      return;
    }

    const updated = ocppRef.current.setVehicleConnected(selectedConnectorId, status === 'Preparing');
    if (!updated) {
      addSessionLog('Unable to change connector status while backend is disconnected', 'warning');
      return;
    }

    setLastUpdate(new Date());
    addSessionLog(
      status === 'Preparing'
        ? `🔌 Connector ${selectedConnectorId} marked connected to vehicle (Preparing)`
        : sessionInProgress
        ? `🔌 Connector ${selectedConnectorId} unplugged during session, EVDisconnected flow triggered`
        : `🔌 Connector ${selectedConnectorId} marked disconnected from vehicle (Available)`,
      status === 'Preparing' ? 'success' : 'warning'
    );
    syncConnectorSimulationState();

    window.setTimeout(() => {
      void refreshConnectorStatuses();
    }, 500);
  };

  const handleScenarioAction = (action: 'pause-ev' | 'pause-evse' | 'resume' | 'fault' | 'clear-fault') => {
    if (!ocppRef.current) {
      addSessionLog('Scenario action ignored because charger is disconnected', 'warning');
      return;
    }

    let updated = false;
    let message = '';

    switch (action) {
      case 'pause-ev':
        updated = ocppRef.current.pauseByEv(selectedConnectorId);
        message = `⏸️ Simulated EV-side pause on connector ${selectedConnectorId}`;
        break;
      case 'pause-evse':
        updated = ocppRef.current.pauseByEvse(selectedConnectorId);
        message = `⏸️ Simulated charger-side pause on connector ${selectedConnectorId}`;
        break;
      case 'resume':
        updated = ocppRef.current.resumeCharging(selectedConnectorId);
        message = `▶️ Simulated resume on connector ${selectedConnectorId}`;
        break;
      case 'fault':
        updated = ocppRef.current.triggerFault(selectedConnectorId);
        message = `🧯 Simulated connector fault on connector ${selectedConnectorId}`;
        break;
      case 'clear-fault':
        updated = ocppRef.current.clearFault(selectedConnectorId);
        message = `🩹 Cleared simulated fault on connector ${selectedConnectorId}`;
        break;
    }

    if (!updated) {
      addSessionLog(`Scenario action ${action} is not valid for connector ${selectedConnectorId} right now`, 'warning');
      return;
    }

    setLastUpdate(new Date());
    addSessionLog(message, action === 'resume' || action === 'clear-fault' ? 'success' : 'warning');
    syncConnectorSimulationState();
    window.setTimeout(() => {
      void refreshConnectorStatuses();
    }, 500);
  };

  useEffect(() => {
    if (isCharging && connected) {
      startMeterSimulation();
    } else {
      stopMeterSimulation();
    }

    return () => {
      if (meterIntervalRef.current) {
        clearInterval(meterIntervalRef.current);
      }
    };
  }, [isCharging, connected, sessionId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available':
        return '#10b981';
      case 'Charging':
        return '#3b82f6';
      case 'Finishing':
        return '#f59e0b';
      case 'Unavailable':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const timeSinceUpdate = () => {
    const seconds = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
    if (seconds < 5) return '📡 Live';
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '20px',
      border: connected ? '2px solid #10b981' : '2px solid #334155',
      boxShadow: connected 
        ? '0 8px 32px rgba(16, 185, 129, 0.2)' 
        : '0 4px 16px rgba(0, 0, 0, 0.3)',
      color: '#e2e8f0',
      transition: 'all 0.3s ease',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated background effect when charging */}
      {isCharging && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(45deg, transparent 30%, rgba(59, 130, 246, 0.1) 50%, transparent 70%)',
          animation: 'shimmer 3s infinite',
          pointerEvents: 'none'
        }} />
      )}
      
      {/* Header with connection indicators */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        marginBottom: '16px',
        position: 'relative',
        zIndex: 1
      }}>
        <div>
          <h2 style={{ 
            fontSize: '20px', 
            fontWeight: 'bold', 
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {chargerName}
            {connected && (
              <span style={{
                fontSize: '12px',
                padding: '4px 8px',
                background: '#10b981',
                borderRadius: '6px',
                animation: 'pulse 2s infinite'
              }}>
                🔌 LIVE
              </span>
            )}
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
            ID: {chargerId}
          </p>
          {chargerInfo && (
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
              <div>🏷️ {chargerInfo.vendorName || 'Generic'} • {chargerInfo.model || 'Model-X'}</div>
              <div>📋 S/N: {chargerInfo.serialNumber || 'N/A'} • Max: {chargerInfo.maxPowerKw}kW</div>
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          {/* Backend connectivity status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            padding: '4px 10px',
            borderRadius: '6px',
            background: backendConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: backendConnected ? '1px solid #10b981' : '1px solid #ef4444'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: backendConnected ? '#10b981' : '#ef4444',
              animation: backendConnected ? 'pulse 2s infinite' : 'none'
            }} />
            <span style={{ color: backendConnected ? '#10b981' : '#ef4444' }}>
              {backendConnected ? 'Backend Online' : 'Backend Offline'}
            </span>
          </div>
          
          {/* Charger status badge */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            padding: '12px 18px',
            borderRadius: '10px',
            background: getStatusColor(chargerState.status) + '22',
            border: `2px solid ${getStatusColor(chargerState.status)}`
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: getStatusColor(chargerState.status),
              boxShadow: `0 0 12px ${getStatusColor(chargerState.status)}`,
              animation: isCharging ? 'pulse 1.5s infinite' : 'none'
            }} />
            <span style={{ 
              fontSize: '15px', 
              fontWeight: '700',
              color: getStatusColor(chargerState.status)
            }}>
              {chargerState.status.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Last update timestamp */}
      <div style={{
        fontSize: '11px',
        color: '#64748b',
        marginBottom: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        position: 'relative',
        zIndex: 1
      }}>
        <span>⏰ Last Update: {formatTimestamp(lastUpdate)}</span>
        <span style={{ 
          color: connected ? '#10b981' : '#64748b',
          fontWeight: connected ? 'bold' : 'normal'
        }}>
          {connected ? timeSinceUpdate() : '⚫ Offline'}
        </span>
      </div>

      {/* Meter values grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '14px',
        marginBottom: '18px',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ 
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
          padding: '16px', 
          borderRadius: '12px',
          border: '1px solid #334155',
          transition: 'all 0.3s ease',
          transform: isCharging ? 'scale(1.02)' : 'scale(1)'
        }}>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, fontWeight: '600' }}>⚡ ENERGY</p>
          <p style={{ 
            fontSize: meterValueKwh > 0 ? '24px' : '20px', 
            fontWeight: 'bold', 
            color: '#60a5fa', 
            margin: '10px 0 0',
            transition: 'all 0.3s ease'
          }}>
            {meterValueKwh.toFixed(3)} kWh
          </p>
          {isCharging && (
            <div style={{
              fontSize: '10px',
              color: '#10b981',
              marginTop: '4px',
              fontWeight: '600'
            }}>
              ↑ Accumulating...
            </div>
          )}
        </div>
        
        <div style={{ 
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
          padding: '16px', 
          borderRadius: '12px',
          border: '1px solid #334155',
          transition: 'all 0.3s ease',
          transform: isCharging ? 'scale(1.02)' : 'scale(1)'
        }}>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, fontWeight: '600' }}>🔋 POWER</p>
          <p style={{ 
            fontSize: powerKw > 0 ? '24px' : '20px', 
            fontWeight: 'bold', 
            color: '#34d399', 
            margin: '10px 0 0',
            transition: 'all 0.3s ease'
          }}>
            {powerKw.toFixed(1)} kW
          </p>
          {powerKw > 0 && (
            <div style={{
              width: '100%',
              height: '4px',
              background: '#1e293b',
              borderRadius: '2px',
              marginTop: '8px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(powerKw / 25) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #10b981, #34d399)',
                borderRadius: '2px',
                transition: 'width 0.5s ease'
              }} />
            </div>
          )}
        </div>
        
        <div style={{ 
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
          padding: '16px', 
          borderRadius: '12px',
          border: '1px solid #334155'
        }}>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, fontWeight: '600' }}>🔢 SESSION</p>
          <p style={{ 
            fontSize: sessionId ? '24px' : '20px', 
            fontWeight: 'bold', 
            color: '#f59e0b', 
            margin: '10px 0 0',
            transition: 'all 0.3s ease'
          }}>
            {sessionId || '---'}
          </p>
          {sessionId && (
            <div style={{
              fontSize: '10px',
              color: '#64748b',
              marginTop: '4px'
            }}>
              🎯 Transaction: {chargerState.transactionId || 'N/A'}
            </div>
          )}
        </div>
      </div>

      {/* Current Session Panel */}
      {sessionInProgress && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 78, 59, 0.2) 100%)',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '16px',
          border: '2px solid #10b981',
          position: 'relative',
          zIndex: 1,
          boxShadow: '0 4px 16px rgba(16, 185, 129, 0.2)'
        }}>
          <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <h3 style={{ 
              fontSize: '15px', 
              fontWeight: 'bold', 
              color: '#10b981',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              ⚡ ACTIVE SESSION
              <span style={{
                fontSize: '11px',
                padding: '3px 8px',
                background: chargerState.status === 'Charging' ? '#10b981' : '#f59e0b',
                color: 'white',
                borderRadius: '6px',
                animation: chargerState.status === 'Charging' ? 'pulse 2s infinite' : 'none'
              }}>
                {chargerState.status.toUpperCase()}
              </span>
            </h3>
          </div>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            fontSize: '13px'
          }}>
            <div>
              <span style={{ color: '#94a3b8' }}>🔢 Session ID:</span>
              <span style={{ color: '#e2e8f0', fontWeight: '700', marginLeft: '6px' }}>
                #{sessionId || chargerState.sessionId || '---'}
              </span>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>🎯 Transaction:</span>
              <span style={{ color: '#e2e8f0', fontWeight: '700', marginLeft: '6px' }}>
                {chargerState.transactionId || 'N/A'}
              </span>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>🔌 Connector:</span>
              <span style={{ color: '#10b981', fontWeight: '700', marginLeft: '6px' }}>
                #{chargerState.activeConnectorId || 1}
              </span>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>📊 Energy:</span>
              <span style={{ color: '#60a5fa', fontWeight: '700', marginLeft: '6px' }}>
                {meterValueKwh.toFixed(3)} kWh
              </span>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>📶 Vehicle Link:</span>
              <span style={{ color: connectorSimulation.vehicleConnected ? '#10b981' : '#ef4444', fontWeight: '700', marginLeft: '6px' }}>
                {connectorSimulation.vehicleConnected ? 'Plugged' : 'Unplugged'}
              </span>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>🧪 Scenario:</span>
              <span style={{ color: '#cbd5e1', fontWeight: '700', marginLeft: '6px' }}>
                {connectorSimulation.faulted
                  ? 'Faulted'
                  : connectorSimulation.evsePaused
                  ? 'SuspendedEVSE'
                  : connectorSimulation.evPaused
                  ? 'SuspendedEV'
                  : chargerState.pendingRemoteStart
                  ? 'Pending Start'
                  : 'Normal'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Customer/User Information Section */}
      {activeSessionUserInfo && sessionId && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(49, 46, 129, 0.2) 100%)',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '16px',
          border: '2px solid #6366f1',
          position: 'relative',
          zIndex: 1,
          boxShadow: '0 4px 16px rgba(99, 102, 241, 0.2)'
        }}>
          <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px'
          }}>
            <h3 style={{ 
              fontSize: '15px', 
              fontWeight: 'bold', 
              color: '#818cf8',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              👤 CUSTOMER INFORMATION
            </h3>
            <span style={{
              fontSize: '10px',
              padding: '3px 8px',
              background: getPaymentBadgeColor(activeSessionUserInfo.paymentStatus),
              color: 'white',
              borderRadius: '6px',
              fontWeight: '700'
            }}>
              {activeSessionUserInfo.paymentStatus || 'PENDING'}
            </span>
          </div>
          {!isCharging && (
            <div style={{
              marginBottom: '12px',
              fontSize: '12px',
              color: '#cbd5e1',
              background: 'rgba(15, 23, 42, 0.45)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              borderRadius: '8px',
              padding: '8px 10px'
            }}>
              Session exists on backend but has not started charging yet. Current OCPP/payment flow is waiting on status <strong>{chargerState.status}</strong> or backend transaction confirmation.
            </div>
          )}
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            fontSize: '13px'
          }}>
            <div>
              <span style={{ color: '#94a3b8' }}>🚗 Vehicle:</span>
              <span style={{ color: '#e2e8f0', fontWeight: '700', marginLeft: '6px' }}>
                {activeSessionUserInfo.vehicleNumber || 'N/A'}
              </span>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>📱 Phone:</span>
              <span style={{ color: '#e2e8f0', fontWeight: '700', marginLeft: '6px' }}>
                {activeSessionUserInfo.phoneNumber || 'N/A'}
              </span>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>👨‍💼 Started By:</span>
              <span style={{ color: '#10b981', fontWeight: '700', marginLeft: '6px' }}>
                {activeSessionUserInfo.startedBy || 'N/A'}
              </span>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>💳 Payment:</span>
              <span style={{ color: '#fbbf24', fontWeight: '700', marginLeft: '6px' }}>
                {activeSessionUserInfo.paymentMode || 'N/A'}
              </span>
            </div>
            {activeSessionUserInfo.limitType && (
              <>
                <div>
                  <span style={{ color: '#94a3b8' }}>🎚️ Limit Type:</span>
                  <span style={{ color: '#e2e8f0', fontWeight: '700', marginLeft: '6px' }}>
                    {activeSessionUserInfo.limitType}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>📏 Limit Value:</span>
                  <span style={{ color: '#e2e8f0', fontWeight: '700', marginLeft: '6px' }}>
                    {activeSessionUserInfo.limitValue}
                    {activeSessionUserInfo.limitType === 'AMOUNT' && ' ₹'}
                    {activeSessionUserInfo.limitType === 'ENERGY' && ' kWh'}
                    {activeSessionUserInfo.limitType === 'TIME' && ' min'}
                  </span>
                </div>
              </>
            )}
            {activeSessionUserInfo.startedAt && (
              <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                <span style={{ color: '#94a3b8' }}>🕐 Started:</span>
                <span style={{ color: '#64748b', fontWeight: '600', marginLeft: '6px', fontSize: '12px' }}>
                  {new Date(activeSessionUserInfo.startedAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Session Activity Logs */}
      {sessionLogs.length > 0 && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.7)',
          padding: '14px',
          borderRadius: '10px',
          marginBottom: '16px',
          border: '1px solid #334155',
          position: 'relative',
          zIndex: 1,
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          <div style={{ 
            fontSize: '12px', 
            fontWeight: 'bold',
            color: '#94a3b8',
            marginBottom: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>📋 SESSION ACTIVITY LOGS</span>
            <button
              onClick={() => setSessionLogs([])}
              style={{
                background: 'transparent',
                border: '1px solid #475569',
                color: '#94a3b8',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
            {sessionLogs.map((log, index) => (
              <div 
                key={index}
                style={{
                  padding: '6px 8px',
                  marginBottom: '4px',
                  background: log.type === 'success' 
                    ? 'rgba(16, 185, 129, 0.1)' 
                    : log.type === 'warning'
                    ? 'rgba(245, 158, 11, 0.1)'
                    : 'rgba(100, 116, 139, 0.1)',
                  borderLeft: `3px solid ${
                    log.type === 'success' 
                      ? '#10b981' 
                      : log.type === 'warning'
                      ? '#f59e0b'
                      : '#64748b'
                  }`,
                  borderRadius: '4px',
                  display: 'flex',
                  gap: '8px',
                  fontFamily: 'monospace'
                }}
              >
                <span style={{ color: '#64748b', minWidth: '65px' }}>
                  {log.timestamp.toLocaleTimeString('en-US', { 
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </span>
                <span style={{ 
                  color: log.type === 'success' 
                    ? '#10b981' 
                    : log.type === 'warning'
                    ? '#f59e0b'
                    : '#cbd5e1',
                  flex: 1
                }}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Temperature indicator */}
      {connected && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.5)',
          padding: '10px 14px',
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: '1px solid #334155',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>
            🌡️ Temperature: <span style={{ color: '#e2e8f0', fontWeight: '600' }}>
              {chargerState.temperature}°C
            </span>
          </div>
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>
            🔌 Connector: <span style={{ 
              color: activeOrSelectedConnectorStatus === 'Charging' ? '#10b981' : activeOrSelectedConnectorStatus === 'Preparing' ? '#f59e0b' : '#64748b',
              fontWeight: '600'
            }}>
              #{activeOrSelectedConnectorId} {activeOrSelectedConnectorStatus}
            </span>
          </div>
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>
            🗄️ Backend sees: <span style={{
              color: backendConnectorStatus === 'Charging' ? '#10b981' : backendConnectorStatus === 'Preparing' ? '#f59e0b' : '#cbd5e1',
              fontWeight: '600'
            }}>
              {backendConnectorStatus || 'Unknown'}
            </span>
          </div>
        </div>
      )}

      {/* Connector Selector */}
      {connectors.length > 1 && !isCharging && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.5)',
          padding: '14px',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '1px solid #334155',
          position: 'relative',
          zIndex: 1
        }}>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 10px', fontWeight: '600' }}>
            🔌 Select Connector
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {connectors.map((connector) => (
              <button
                key={connector.id}
                onClick={() => setSelectedConnector(connector)}
                style={{
                  padding: '8px 16px',
                  background: selectedConnector?.id === connector.id
                    ? 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)'
                    : 'rgba(148, 163, 184, 0.1)',
                  border: selectedConnector?.id === connector.id
                    ? '2px solid #60a5fa'
                    : '1px solid #475569',
                  color: selectedConnector?.id === connector.id ? 'white' : '#cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  transition: 'all 0.3s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseOver={(e) => {
                  if (selectedConnector?.id !== connector.id) {
                    e.currentTarget.style.borderColor = '#64748b';
                    e.currentTarget.style.background = 'rgba(148, 163, 184, 0.2)';
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedConnector?.id !== connector.id) {
                    e.currentTarget.style.borderColor = '#475569';
                    e.currentTarget.style.background = 'rgba(148, 163, 184, 0.1)';
                  }
                }}
              >
                Connector {connector.connectorNo} ({connector.type})
              </button>
            ))}
          </div>
        </div>
      )}

      {connected && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.5)',
          padding: '14px',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '1px solid #334155',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <div>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 6px', fontWeight: '600' }}>
                🚗 Real-World Scenario Lab
              </p>
              <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                Plug, unplug, suspend, resume, and fault connector {selectedConnectorId} to verify backend handling for real charger edge cases.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleVehicleConnectionState('Preparing')}
                disabled={activeOrSelectedConnectorStatus === 'Preparing'}
                style={{
                  padding: '10px 14px',
                  background: activeOrSelectedConnectorStatus === 'Preparing'
                    ? 'rgba(245, 158, 11, 0.25)'
                    : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: activeOrSelectedConnectorStatus === 'Preparing' ? 'not-allowed' : 'pointer',
                  opacity: activeOrSelectedConnectorStatus === 'Preparing' ? 0.7 : 1
                }}
              >
                🔌 Vehicle Connected
              </button>
              <button
                onClick={() => handleVehicleConnectionState('Available')}
                disabled={activeOrSelectedConnectorStatus === 'Available'}
                style={{
                  padding: '10px 14px',
                  background: activeOrSelectedConnectorStatus === 'Available'
                    ? 'rgba(100, 116, 139, 0.25)'
                    : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: activeOrSelectedConnectorStatus === 'Available' ? 'not-allowed' : 'pointer',
                  opacity: activeOrSelectedConnectorStatus === 'Available' ? 0.7 : 1
                }}
              >
                Unplug Vehicle
              </button>
              <button
                onClick={() => handleScenarioAction('pause-ev')}
                disabled={!sessionInProgress || chargerState.status !== 'Charging'}
                style={{
                  padding: '10px 14px',
                  background: !sessionInProgress || chargerState.status !== 'Charging'
                    ? 'rgba(100, 116, 139, 0.25)'
                    : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: !sessionInProgress || chargerState.status !== 'Charging' ? 'not-allowed' : 'pointer',
                  opacity: !sessionInProgress || chargerState.status !== 'Charging' ? 0.7 : 1
                }}
              >
                ⏸️ Pause by EV
              </button>
              <button
                onClick={() => handleScenarioAction('pause-evse')}
                disabled={!sessionInProgress || chargerState.status !== 'Charging'}
                style={{
                  padding: '10px 14px',
                  background: !sessionInProgress || chargerState.status !== 'Charging'
                    ? 'rgba(100, 116, 139, 0.25)'
                    : 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: !sessionInProgress || chargerState.status !== 'Charging' ? 'not-allowed' : 'pointer',
                  opacity: !sessionInProgress || chargerState.status !== 'Charging' ? 0.7 : 1
                }}
              >
                ⏸️ Pause by Charger
              </button>
              <button
                onClick={() => handleScenarioAction('resume')}
                disabled={!sessionInProgress || !['SuspendedEV', 'SuspendedEVSE'].includes(chargerState.status)}
                style={{
                  padding: '10px 14px',
                  background: !sessionInProgress || !['SuspendedEV', 'SuspendedEVSE'].includes(chargerState.status)
                    ? 'rgba(100, 116, 139, 0.25)'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: !sessionInProgress || !['SuspendedEV', 'SuspendedEVSE'].includes(chargerState.status) ? 'not-allowed' : 'pointer',
                  opacity: !sessionInProgress || !['SuspendedEV', 'SuspendedEVSE'].includes(chargerState.status) ? 0.7 : 1
                }}
              >
                ▶️ Resume Charging
              </button>
              <button
                onClick={() => handleScenarioAction('fault')}
                disabled={connectorSimulation.faulted}
                style={{
                  padding: '10px 14px',
                  background: connectorSimulation.faulted
                    ? 'rgba(100, 116, 139, 0.25)'
                    : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: connectorSimulation.faulted ? 'not-allowed' : 'pointer',
                  opacity: connectorSimulation.faulted ? 0.7 : 1
                }}
              >
                🧯 Trigger Fault
              </button>
              <button
                onClick={() => handleScenarioAction('clear-fault')}
                disabled={!connectorSimulation.faulted}
                style={{
                  padding: '10px 14px',
                  background: !connectorSimulation.faulted
                    ? 'rgba(100, 116, 139, 0.25)'
                    : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: !connectorSimulation.faulted ? 'not-allowed' : 'pointer',
                  opacity: !connectorSimulation.faulted ? 0.7 : 1
                }}
              >
                🩹 Clear Fault
              </button>
            </div>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '10px',
            marginTop: '12px',
            fontSize: '12px'
          }}>
            <div style={{ color: '#cbd5e1' }}>
              Vehicle: <strong style={{ color: connectorSimulation.vehicleConnected ? '#10b981' : '#ef4444' }}>{connectorSimulation.vehicleConnected ? 'Plugged' : 'Unplugged'}</strong>
            </div>
            <div style={{ color: '#cbd5e1' }}>
              Pending Start: <strong style={{ color: connectorSimulation.pendingRemoteStart ? '#f59e0b' : '#64748b' }}>{connectorSimulation.pendingRemoteStart ? 'Yes' : 'No'}</strong>
            </div>
            <div style={{ color: '#cbd5e1' }}>
              EV Pause: <strong style={{ color: connectorSimulation.evPaused ? '#f59e0b' : '#64748b' }}>{connectorSimulation.evPaused ? 'Active' : 'No'}</strong>
            </div>
            <div style={{ color: '#cbd5e1' }}>
              EVSE Pause: <strong style={{ color: connectorSimulation.evsePaused ? '#a855f7' : '#64748b' }}>{connectorSimulation.evsePaused ? 'Active' : 'No'}</strong>
            </div>
            <div style={{ color: '#cbd5e1' }}>
              Fault: <strong style={{ color: connectorSimulation.faulted ? '#ef4444' : '#64748b' }}>{connectorSimulation.faulted ? 'Active' : 'No'}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '12px', position: 'relative', zIndex: 1 }}>
        {!connected ? (
          <button
            onClick={handleConnect}
            disabled={!backendConnected}
            style={{
              flex: 1,
              padding: '14px 28px',
              background: backendConnected 
                ? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' 
                : '#475569',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '700',
              cursor: backendConnected ? 'pointer' : 'not-allowed',
              fontSize: '15px',
              boxShadow: backendConnected ? '0 4px 14px rgba(14, 165, 233, 0.4)' : 'none',
              transition: 'all 0.3s ease',
              opacity: backendConnected ? 1 : 0.6
            }}
            onMouseEnter={(e) => {
              if (backendConnected) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(14, 165, 233, 0.6)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = backendConnected 
                ? '0 4px 14px rgba(14, 165, 233, 0.4)' 
                : 'none';
            }}
          >
            🔌 Connect to Backend
          </button>
        ) : (
          <>
            <button
              onClick={handleDisconnect}
              style={{
                padding: '14px 28px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '15px',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(239, 68, 68, 0.4)';
              }}
            >
              🔌 Disconnect
            </button>
            <div
              style={{
                flex: 1,
                padding: '14px 18px',
                background: 'rgba(96, 165, 250, 0.15)',
                border: '1px solid #60a5fa',
                borderRadius: '10px',
                color: '#cbd5e1',
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
              }}
            >
              🤖 Auto Mode: Verify connector in app to start charging via OCPP
            </div>
          </>
        )}
      </div>
    </div>
  );
}
