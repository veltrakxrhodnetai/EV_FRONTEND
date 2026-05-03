export interface OcppMessage {
  messageType: number; // 1=CALL, 2=RESULT, 3=ERROR
  messageId: string;
  action?: string;
  payload?: Record<string, any>;
  errorCode?: string;
  errorMessage?: string;
}

export interface ChargerState {
  identity: string;
  status: 'Available' | 'Preparing' | 'Charging' | 'SuspendedEV' | 'SuspendedEVSE' | 'Finishing' | 'Reserved' | 'Faulted' | 'Unavailable' | 'Offline';
  activeConnectorId: number;
  connectorStatus: Record<number, string>;
  transactionId: number | null;
  sessionId: number | null;
  meterStart: number;
  meterValue: number;
  power: number;
  temperature: number;
  soc: number;
  authorized: boolean;
  bootupSent: boolean;
  vehicleConnected: boolean;
  evPaused: boolean;
  evsePaused: boolean;
  faulted: boolean;
  unavailable: boolean;
  pendingRemoteStart: boolean;
}

// Real charger (ACO110W33H) is 3-phase AC, ~17–18 kW (3 × 230V × ~25A)
const FAST_SIMULATED_POWER_W = 17290;

interface ConnectorSimulationState {
  vehicleConnected: boolean;
  evPaused: boolean;
  evsePaused: boolean;
  faulted: boolean;
  unavailable: boolean;
}

export class OcppProtocol {
  private ws: WebSocket | null = null;
  private messageCounter = 0;
  private activeConnectorId = 1;
  private pendingRequests = new Map<string, (data: any) => void>();
  private onMessageCallback: ((msg: OcppMessage) => void) | null = null;
  private chargerState: ChargerState;
  private heartbeatIntervalHandle: ReturnType<typeof setInterval> | null = null;
  private resetReconnectHandle: ReturnType<typeof setTimeout> | null = null;
  private pendingStartHandle: ReturnType<typeof setTimeout> | null = null;
  private finishingHandle: ReturnType<typeof setTimeout> | null = null;
  private configurationValues: Record<string, string>;
  private connectorSimulation: Record<number, ConnectorSimulationState> = {};

  constructor(
    private backendUrl: string,
    private chargerIdentity: string,
    private onStatusChange: (status: ChargerState) => void,
    private stationId: string = 'station',
    private ocppVersion: string = '1.6',
    private authToken?: string
  ) {
    this.configurationValues = {
      HeartbeatInterval: '60',
      MeterValueSampleInterval: '60',
      AuthorizeRemoteTxRequests: 'true',
      WebSocketPingInterval: '30',
      ConnectionTimeOut: '60'
    };
    this.chargerState = {
      identity: chargerIdentity,
      status: 'Offline',
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
    };
    this.connectorSimulation[1] = this.createDefaultConnectorSimulation();
  }

  private createDefaultConnectorSimulation(): ConnectorSimulationState {
    return {
      vehicleConnected: false,
      evPaused: false,
      evsePaused: false,
      faulted: false,
      unavailable: false,
    };
  }

  private getConnectorSimulation(connectorId: number): ConnectorSimulationState {
    if (!this.connectorSimulation[connectorId]) {
      this.connectorSimulation[connectorId] = this.createDefaultConnectorSimulation();
    }
    if (!(connectorId in this.chargerState.connectorStatus)) {
      this.chargerState.connectorStatus[connectorId] = 'Available';
    }
    return this.connectorSimulation[connectorId];
  }

  private resolveConnectorStatus(connectorId: number): ChargerState['status'] {
    const simulation = this.getConnectorSimulation(connectorId);
    const isActiveConnector = connectorId === this.chargerState.activeConnectorId;
    const hasActiveTransaction = isActiveConnector && !!this.chargerState.transactionId;

    if (simulation.faulted) {
      return 'Faulted';
    }

    if (simulation.unavailable) {
      return 'Unavailable';
    }

    if (this.chargerState.status === 'Finishing' && isActiveConnector) {
      return 'Finishing';
    }

    if (hasActiveTransaction) {
      if (simulation.evsePaused) {
        return 'SuspendedEVSE';
      }
      if (simulation.evPaused) {
        return 'SuspendedEV';
      }
      return 'Charging';
    }

    if (simulation.vehicleConnected) {
      return 'Preparing';
    }

    return 'Available';
  }

  private syncVisibleState(connectorId: number, sendStatusNotification = false): void {
    const simulation = this.getConnectorSimulation(connectorId);
    const status = this.resolveConnectorStatus(connectorId);

    this.chargerState.activeConnectorId = connectorId;
    this.chargerState.connectorStatus[connectorId] = status;
    this.chargerState.status = status;
    this.chargerState.vehicleConnected = simulation.vehicleConnected;
    this.chargerState.evPaused = simulation.evPaused;
    this.chargerState.evsePaused = simulation.evsePaused;
    this.chargerState.faulted = simulation.faulted;
    this.chargerState.unavailable = simulation.unavailable;
    this.updateState();

    if (sendStatusNotification) {
      const errorCode = simulation.faulted ? 'OtherError' : 'NoError';
      const info = simulation.faulted ? 'Simulated fault active' : 'NULL';
      this.emitStatusNotification(connectorId, status, { errorCode, info });
    }
  }

  private clearPendingStart(): void {
    if (this.pendingStartHandle) {
      clearTimeout(this.pendingStartHandle);
      this.pendingStartHandle = null;
    }
    this.chargerState.pendingRemoteStart = false;
  }

  private finishTransaction(connectorId: number, reason: string, preserveFaultState = false): void {
    const transactionId = this.chargerState.transactionId;
    const meterStop = Math.round(this.chargerState.meterValue || this.chargerState.meterStart || 0);
    const simulation = this.getConnectorSimulation(connectorId);

    this.clearPendingStart();

    if (transactionId && transactionId > 0) {
      this.sendStopTransaction(transactionId, meterStop, reason);
    }

    this.chargerState.status = 'Finishing';
    this.chargerState.connectorStatus[connectorId] = 'Finishing';
    this.chargerState.power = 0;
    simulation.evPaused = false;
    simulation.evsePaused = false;
    this.updateState();
    this.emitStatusNotification(connectorId, 'Finishing', {});

    if (this.finishingHandle) {
      clearTimeout(this.finishingHandle);
    }

    this.finishingHandle = setTimeout(() => {
      this.finishingHandle = null;
      this.chargerState.transactionId = null;
      this.chargerState.sessionId = null;
      this.chargerState.power = 0;
      this.chargerState.meterStart = meterStop;
      this.chargerState.meterValue = meterStop;

      if (!preserveFaultState) {
        simulation.faulted = false;
      }

      this.syncVisibleState(connectorId, true);
    }, 1200);
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const baseUrl = this.backendUrl.replace(/^http/, 'ws')
        + `/ws/ocpp/${encodeURIComponent(this.ocppVersion)}/${encodeURIComponent(this.stationId)}/${encodeURIComponent(this.chargerIdentity)}`;
      const wsUrl = this.authToken && this.authToken.trim().length > 0
        ? `${baseUrl}?token=${encodeURIComponent(this.authToken.trim())}`
        : baseUrl;
      
      try {
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log('🟢 WebSocket connected to', wsUrl);
          this.chargerState.authorized = true;
          this.syncVisibleState(this.chargerState.activeConnectorId);
          
          // Send BootNotification - real charger protocol
          this.sendBootNotification();
          
          // Setup heartbeat
          this.setupHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📩 Received OCPP message:', data);
            this.handleIncomingMessage(data);
            if (this.onMessageCallback) {
              this.onMessageCallback(data);
            }
          } catch (err) {
            console.error('Error parsing OCPP message:', err);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log(`🔌 WebSocket closed (code=${event.code}, reason=${event.reason || 'none'})`);
          this.chargerState.status = 'Offline';
          this.chargerState.authorized = false;
          this.updateState();
          if (this.heartbeatIntervalHandle) {
            clearInterval(this.heartbeatIntervalHandle);
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private setupHeartbeat(): void {
    if (this.heartbeatIntervalHandle) {
      clearInterval(this.heartbeatIntervalHandle);
    }
    const intervalSeconds = Math.max(10, Number(this.configurationValues.HeartbeatInterval) || 60);
    this.heartbeatIntervalHandle = setInterval(() => {
      this.sendHeartbeat();
    }, intervalSeconds * 1000);
  }

  private sendBootNotification(): void {
    this.chargerState.bootupSent = true;
    const messageId = this.generateMessageId();
    const message = [
      2,
      messageId,
      'BootNotification',
      {
        chargePointModel: 'ACO110W33H',
        chargePointVendor: 'Veltrak',
        chargePointSerialNumber: this.chargerIdentity,
        firmwareVersion: 'V1.2.0'
      }
    ];
    this.sendRawMessage(message);
    console.log('📤 Sent BootNotification');
  }

  private sendHeartbeat(): void {
    const messageId = this.generateMessageId();
    const message = [
      2, // CALL
      messageId,
      'Heartbeat',
      {}
    ];
    this.sendRawMessage(message);
    console.log('💓 Sent Heartbeat');
  }

  disconnect(): void {
    if (this.resetReconnectHandle) {
      clearTimeout(this.resetReconnectHandle);
      this.resetReconnectHandle = null;
    }
    this.clearPendingStart();
    if (this.finishingHandle) {
      clearTimeout(this.finishingHandle);
      this.finishingHandle = null;
    }
    if (this.heartbeatIntervalHandle) {
      clearInterval(this.heartbeatIntervalHandle);
      this.heartbeatIntervalHandle = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.chargerState.status = 'Offline';
    this.chargerState.authorized = false;
    this.chargerState.transactionId = null;
    this.chargerState.sessionId = null;
    this.chargerState.bootupSent = false;
    this.chargerState.pendingRemoteStart = false;
    this.updateState();
  }

  private generateMessageId(): string {
    return `${++this.messageCounter}`;
  }

  private sendRawMessage(message: any[]): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      console.log('📤 Raw message sent:', message);
    } else {
      console.error('❌ WebSocket not ready, cannot send message');
    }
  }

  sendMessage(messageType: number, action: string, payload: Record<string, any>): string {
    const messageId = this.generateMessageId();
    const message = [messageType, messageId, action, payload];
    this.sendRawMessage(message);
    return messageId;
  }

  private updateState(): void {
    this.onStatusChange({
      ...this.chargerState,
      connectorStatus: { ...this.chargerState.connectorStatus }
    });
  }

  private handleIncomingMessage(data: any[]): void {
    const messageType = data[0];
    const messageId = data[1];
    const actionOrPayload = data[2];
    const payload = data[3];

    if (messageType === 3) {
      // CALLRESULT message
      const callback = this.pendingRequests.get(messageId);
      if (callback) {
        callback(actionOrPayload);
        this.pendingRequests.delete(messageId);
      }
      console.log(`✅ Received CALLRESULT for message ${messageId}`, actionOrPayload);
    } else if (messageType === 2) {
      // CALL message - incoming request from backend
      const action = actionOrPayload;
      this.handleIncomingRequest(messageId, action, payload);
    } else if (messageType === 4) {
      // CALLERROR message
      console.error(`❌ OCPP Error for message ${messageId}: ${actionOrPayload} - ${payload}`);
    }
  }

  private handleIncomingRequest(messageId: string, action: string, payload: Record<string, any>): void {
    console.log(`🔔 Handling OCPP CALL: ${action}`, payload);

    switch (action) {
      case 'RemoteStartTransaction':
        this.handleRemoteStartTransaction(messageId, payload);
        break;
      case 'RemoteStopTransaction':
        this.handleRemoteStopTransaction(messageId, payload);
        break;
      case 'Reset':
        this.handleReset(messageId, payload);
        break;
      case 'ChangeAvailability':
        this.handleChangeAvailability(messageId, payload);
        break;
      case 'UnlockConnector':
        this.handleUnlockConnector(messageId, payload);
        break;
      case 'GetConfiguration':
        this.handleGetConfiguration(messageId, payload);
        break;
      case 'TriggerMessage':
        this.handleTriggerMessage(messageId, payload);
        break;
      case 'ChangeConfiguration':
        this.handleChangeConfiguration(messageId, payload);
        break;
      case 'ClearCache':
        this.handleClearCache(messageId);
        break;
      case 'GetDiagnostics':
        this.handleGetDiagnostics(messageId, payload);
        break;
      default:
        // Send CALLRESULT with status
        this.sendCallResult(messageId, { status: 'Accepted' });
    }
  }

  private sendCallResult(messageId: string, payload: Record<string, any>): void {
    const message = [3, messageId, payload]; // CALLRESULT
    this.sendRawMessage(message);
  }

  private handleRemoteStartTransaction(messageId: string, payload: Record<string, any>): void {
    console.log('⚡ RemoteStartTransaction received:', payload);
    const connectorId = Number(payload.connectorId) > 0 ? Number(payload.connectorId) : 1;
    const simulation = this.getConnectorSimulation(connectorId);

    if (this.chargerState.transactionId) {
      this.sendCallResult(messageId, { status: 'Rejected' });
      return;
    }

    if (simulation.faulted || simulation.unavailable || !simulation.vehicleConnected) {
      this.sendCallResult(messageId, { status: 'Rejected' });
      return;
    }

    this.activeConnectorId = connectorId;
    const idTag = typeof payload.idTag === 'string' && payload.idTag.trim() ? payload.idTag : this.chargerIdentity;
    // Send CALLRESULT immediately
    this.sendCallResult(messageId, { status: 'Accepted' });

    simulation.evPaused = false;
    simulation.evsePaused = false;
    this.chargerState.activeConnectorId = connectorId;
    this.chargerState.transactionId = null;
    this.chargerState.sessionId = payload.sessionId || null;
    this.chargerState.pendingRemoteStart = true;
    this.syncVisibleState(connectorId, true);

    // After a brief delay, send StartTransaction and move to Charging only after backend gives transactionId
    this.clearPendingStart();
    this.pendingStartHandle = setTimeout(() => {
      this.pendingStartHandle = null;
      this.chargerState.pendingRemoteStart = false;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.updateState();
        return;
      }

      const latestSimulation = this.getConnectorSimulation(connectorId);
      if (this.chargerState.transactionId || latestSimulation.faulted || latestSimulation.unavailable || !latestSimulation.vehicleConnected) {
        this.syncVisibleState(connectorId, true);
        return;
      }

      // Use a realistic absolute odometer value like the real charger (starts high, not 0)
      const realisticMeterStart = this.chargerState.meterStart > 0
        ? this.chargerState.meterStart
        : 1020000 + Math.floor(Math.random() * 20000); // simulate charger odometer ~1020-1040 kWh
      this.chargerState.meterStart = realisticMeterStart;
      this.chargerState.meterValue = realisticMeterStart;
      this.updateState();
      this.sendStartTransaction(connectorId, idTag || 'SELF', realisticMeterStart);
    }, 2000);
  }

  private sendStartTransaction(connectorId: number, idTag: string, meterStart: number): void {
    const messageId = this.generateMessageId();
    const message = [
      2,
      messageId,
      'StartTransaction',
      {
        connectorId,
        idTag,
        meterStart,
        timestamp: new Date().toISOString()
      }
    ];

    this.pendingRequests.set(messageId, (resultPayload: any) => {
      const transactionId = Number(resultPayload?.transactionId);
      if (!Number.isFinite(transactionId) || transactionId <= 0) {
        console.error('❌ Invalid transactionId in StartTransaction response:', resultPayload);
        this.syncVisibleState(connectorId, true);
        return;
      }

      const simulation = this.getConnectorSimulation(connectorId);
      this.chargerState.transactionId = transactionId;
      this.chargerState.pendingRemoteStart = false;
      this.chargerState.power = FAST_SIMULATED_POWER_W;
      simulation.evPaused = false;
      simulation.evsePaused = false;
      // Start SoC at a realistic initial value (30–70% like a partial charge)
      if (this.chargerState.soc <= 0) {
        this.chargerState.soc = 30 + Math.random() * 30;
      }
      this.syncVisibleState(connectorId, false);
      console.log(`⚡ Charger now CHARGING with transactionId=${transactionId}`);
      this.sendStatusNotification(connectorId, 'Charging');
    });

    this.sendRawMessage(message);
    console.log('📤 Sent StartTransaction:', { connectorId, idTag, meterStart });
  }

  private handleRemoteStopTransaction(messageId: string, payload: Record<string, any>): void {
    console.log('🛑 RemoteStopTransaction received:', payload);
    const connectorId = this.activeConnectorId;
    // Send CALLRESULT immediately
    this.sendCallResult(messageId, { status: 'Accepted' });

    if (!this.chargerState.transactionId) {
      console.warn('⚠️ RemoteStop received but no active transactionId, syncing current connector state only');
      this.syncVisibleState(connectorId, true);
      return;
    }

    this.finishTransaction(connectorId, 'Remote');
  }

  private sendStopTransaction(transactionId: number, meterStop: number, reason: string): void {
    const messageId = this.generateMessageId();
    const message = [
      2,
      messageId,
      'StopTransaction',
      {
        transactionId,
        meterStop,
        timestamp: new Date().toISOString(),
        reason
      }
    ];

    this.pendingRequests.set(messageId, (resultPayload: any) => {
      console.log('✅ StopTransaction acknowledged:', resultPayload);
    });

    this.sendRawMessage(message);
    console.log('📤 Sent StopTransaction:', { transactionId, meterStop, reason });
  }

  private handleReset(messageId: string, _payload: Record<string, any>): void {
    console.log('🔄 Reset received');
    this.sendCallResult(messageId, { status: 'Accepted' });

    this.chargerState.status = 'Unavailable';
    this.chargerState.transactionId = null;
    this.chargerState.sessionId = null;
    this.chargerState.meterValue = 0;
    this.chargerState.power = 0;
    this.updateState();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'Reset');
    }

    this.resetReconnectHandle = setTimeout(() => {
      this.resetReconnectHandle = null;
      void this.connect().catch((error) => {
        console.error('❌ Failed to reconnect after reset:', error);
      });
    }, 1500);
  }

  private handleChangeAvailability(messageId: string, payload: Record<string, any>): void {
    const connectorId = Number(payload?.connectorId) > 0 ? Number(payload.connectorId) : this.activeConnectorId;
    const type = String(payload?.type ?? payload?.availabilityType ?? '').trim();
    console.log('🔌 ChangeAvailability:', payload);

    if (type === 'Inoperative') {
      const simulation = this.getConnectorSimulation(connectorId);
      simulation.unavailable = true;
      this.sendCallResult(messageId, { status: 'Accepted' });
      this.syncVisibleState(connectorId, true);
      return;
    }

    if (type === 'Operative') {
      const simulation = this.getConnectorSimulation(connectorId);
      simulation.unavailable = false;
      this.sendCallResult(messageId, { status: 'Accepted' });
      this.syncVisibleState(connectorId, true);
      return;
    }

    this.sendCallResult(messageId, { status: 'Rejected', reason: 'Unsupported availability type' });
  }

  private handleUnlockConnector(messageId: string, payload: Record<string, any>): void {
    console.log('🔓 UnlockConnector:', payload);
    this.sendCallResult(messageId, { status: 'Unlocked' });
  }

  private handleGetConfiguration(messageId: string, payload: Record<string, any>): void {
    const requestedKeys = Array.isArray(payload?.key)
      ? payload.key.map((item) => String(item))
      : Object.keys(this.configurationValues);
    const knownKeys = requestedKeys.filter((key) => key in this.configurationValues);
    const unknownKeys = requestedKeys.filter((key) => !(key in this.configurationValues));

    console.log('⚙️ GetConfiguration:', payload);
    this.sendCallResult(messageId, {
      configurationKey: knownKeys.map((key) => ({
        key,
        readonly: false,
        value: this.configurationValues[key]
      })),
      unknownKey: unknownKeys
    });
  }

  private handleChangeConfiguration(messageId: string, payload: Record<string, any>): void {
    console.log('⚙️ ChangeConfiguration:', payload);
    const key = String(payload?.key ?? '').trim();
    const value = String(payload?.value ?? '').trim();

    if (!key || !(key in this.configurationValues)) {
      this.sendCallResult(messageId, { status: 'NotSupported' });
      return;
    }

    this.configurationValues[key] = value;
    this.sendCallResult(messageId, { status: 'Accepted' });

    if (key === 'HeartbeatInterval') {
      this.setupHeartbeat();
    }
  }

  private handleClearCache(messageId: string): void {
    console.log('🧹 ClearCache received');
    this.sendCallResult(messageId, { status: 'Accepted' });
  }

  private handleGetDiagnostics(messageId: string, payload: Record<string, any>): void {
    console.log('📊 GetDiagnostics:', payload);
    this.sendCallResult(messageId, { fileName: 'diagnostics.log' });
  }

  private handleTriggerMessage(messageId: string, payload: Record<string, any>): void {
    const requestedMessage = String(payload?.requestedMessage ?? '').trim();
    const requestedConnectorId = Number(payload?.connectorId);
    const connectorId = Number.isFinite(requestedConnectorId) && requestedConnectorId > 0
      ? requestedConnectorId
      : (this.chargerState.activeConnectorId || 1);

    console.log('📨 TriggerMessage received:', payload);

    if (!requestedMessage) {
      this.sendCallResult(messageId, { status: 'Rejected' });
      return;
    }

    switch (requestedMessage) {
      case 'StatusNotification':
        this.sendCallResult(messageId, { status: 'Accepted' });
        this.sendStatusNotification(connectorId, this.chargerState.connectorStatus[connectorId] || this.chargerState.status);
        break;
      case 'Heartbeat':
        this.sendCallResult(messageId, { status: 'Accepted' });
        this.sendHeartbeat();
        break;
      case 'BootNotification':
        this.sendCallResult(messageId, { status: 'Accepted' });
        this.sendBootNotification();
        break;
      case 'MeterValues':
        this.sendCallResult(messageId, { status: 'Accepted' });
        this.sendMeterValues(
          connectorId,
          Math.round(this.chargerState.meterValue || this.chargerState.meterStart || 0),
          Math.round(this.chargerState.power || 0)
        );
        break;
      default:
        this.sendCallResult(messageId, { status: 'NotImplemented', reason: 'Requested message not implemented by simulator' });
        break;
    }
  }

  sendMeterValues(connectorId: number, meterValue: number, power: number): void {
    this.chargerState.meterValue = meterValue;
    this.chargerState.power = power;

    // Simulate realistic 3-phase AC voltages (L1-N, L2-N, L3-N) with small variation
    const vBase = [229.69, 235.57, 231.50];
    const voltages = vBase.map(v => parseFloat((v + (Math.random() - 0.5) * 2).toFixed(2)));
    // Per-phase current derived from power split across 3 phases
    const totalA = power > 0 ? power / (voltages.reduce((a, b) => a + b, 0) / 3) : 0;
    const phaseCurrents = voltages.map(v => power > 0
      ? parseFloat(((power / 3) / v + (Math.random() - 0.5) * 0.5).toFixed(2))
      : parseFloat((Math.random() * 0.05).toFixed(2))
    );
    // Summary voltage = average of phases
    const summaryVoltage = parseFloat((voltages.reduce((a, b) => a + b, 0) / 3).toFixed(2));
    // Summary current (summary level) = 0 to mimic real charger quirk
    const summaryCurrent = parseFloat((totalA / 3).toFixed(2));
    // Power.Active.Import at summary = 0 like real charger (reported only per-phase)
    const summaryPower = 0;
    const powerFactor = power > 0 ? 0.12 : 0;
    const powerOffered = parseFloat((meterValue * 3.27).toFixed(2)); // tracks with meter
    // Simulate SoC and temperature progression
    this.chargerState.soc = Math.min(100, this.chargerState.soc + (power > 0 ? 0.002 : 0));
    const soc = Math.round(this.chargerState.soc);
    const temp = parseFloat((this.chargerState.temperature + (Math.random() - 0.48) * 0.05).toFixed(2));
    this.chargerState.temperature = temp;

    const timestamp = new Date().toISOString();
    const messageId = this.generateMessageId();

    const sampledValue = [
      { value: meterValue.toFixed(2),            measurand: 'Energy.Active.Import.Register', unit: 'Wh',      context: 'Sample.Periodic', format: 'SignedData' },
      { value: String(summaryVoltage),            measurand: 'Voltage',                       unit: 'V',       context: 'Sample.Periodic', format: 'SignedData' },
      { value: String(summaryCurrent),            measurand: 'Current.Import',                unit: 'A',       context: 'Sample.Periodic', format: 'SignedData' },
      { value: String(soc),                       measurand: 'SoC',                           unit: 'Percent', context: 'Sample.Periodic', format: 'SignedData' },
      { value: String(temp),                      measurand: 'Temperature',                   unit: 'Celsius', context: 'Sample.Periodic', format: 'Raw'        },
      { value: String(powerOffered),              measurand: 'Power.Offered',                 unit: 'Wh',      context: 'Sample.Periodic', format: 'SignedData' },
      { value: String(summaryPower),              measurand: 'Power.Active.Import',           unit: 'W',       context: 'Sample.Periodic', format: 'SignedData' },
      { value: String(powerFactor),               measurand: 'Power.Factor',                  unit: 'K',       context: 'Sample.Periodic', format: 'SignedData' },
      // Per-phase voltages
      { value: String(voltages[0]), measurand: 'Voltage',        unit: 'V', context: 'Sample.Periodic', format: 'SignedData', phase: 'L1-N' },
      { value: String(voltages[1]), measurand: 'Voltage',        unit: 'V', context: 'Sample.Periodic', format: 'SignedData', phase: 'L2-N' },
      { value: String(voltages[2]), measurand: 'Voltage',        unit: 'V', context: 'Sample.Periodic', format: 'SignedData', phase: 'L3-N' },
      // Per-phase currents
      { value: String(phaseCurrents[0]), measurand: 'Current.Import', unit: 'A', context: 'Sample.Periodic', format: 'SignedData', phase: 'L1-N' },
      { value: String(phaseCurrents[1]), measurand: 'Current.Import', unit: 'A', context: 'Sample.Periodic', format: 'SignedData', phase: 'L2-N' },
      { value: String(phaseCurrents[2]), measurand: 'Current.Import', unit: 'A', context: 'Sample.Periodic', format: 'SignedData', phase: 'L3-N' },
    ];

    const meterValuesPayload: Record<string, unknown> = {
      connectorId,
      meterValue: [{ timestamp, sampledValue }]
    };

    if (this.chargerState.transactionId && this.chargerState.transactionId > 0) {
      meterValuesPayload.transactionId = this.chargerState.transactionId;
    }

    const message = [2, messageId, 'MeterValues', meterValuesPayload];
    this.sendRawMessage(message);
    console.log(`📊 Sent MeterValues: ${(meterValue / 1000).toFixed(2)}kWh @ ${(power / 1000).toFixed(1)}kW, SoC=${soc}%`);
  }

  sendStatusNotification(connectorId: number, status: string): void {
    this.emitStatusNotification(connectorId, status, {});
  }

  private emitStatusNotification(connectorId: number, status: string, options: { errorCode?: string; info?: string }): void {
    const messageId = this.generateMessageId();
    const message = [
      2,
      messageId,
      'StatusNotification',
      {
        connectorId,
        vendorId: 'Veltrak',
        info: options.info ?? 'NULL',
        errorCode: options.errorCode ?? 'NoError',
        vendorErrorCode: 'NULL',
        status,
        timestamp: new Date().toISOString()
      }
    ];
    this.sendRawMessage(message);
    console.log(`📍 Sent StatusNotification: ${status}`);
  }

  recoverActiveSession(params: {
    sessionId: number;
    connectorId: number;
    transactionId: number;
    meterStart?: number;
    latestMeterWh?: number;
  }): void {
    const simulation = this.getConnectorSimulation(params.connectorId);
    this.activeConnectorId = params.connectorId;
    this.chargerState.activeConnectorId = params.connectorId;
    this.chargerState.sessionId = params.sessionId;
    this.chargerState.transactionId = params.transactionId;
    this.chargerState.meterStart = params.meterStart ?? 0;
    this.chargerState.meterValue = params.latestMeterWh ?? params.meterStart ?? 0;
    this.chargerState.power = this.chargerState.power > 0 ? this.chargerState.power : FAST_SIMULATED_POWER_W;
    this.chargerState.pendingRemoteStart = false;
    simulation.vehicleConnected = true;
    simulation.evPaused = false;
    simulation.evsePaused = false;
    simulation.faulted = false;
    simulation.unavailable = false;
    if (this.chargerState.soc <= 0) this.chargerState.soc = 40;
    this.syncVisibleState(params.connectorId, false);
    this.sendStatusNotification(params.connectorId, 'Charging');
  }

  updateMeterValue(meterValue: number, power: number): void {
    this.chargerState.meterValue = meterValue;
    this.chargerState.power = power;
    this.updateState();
  }

  getChargerState(): ChargerState {
    return { ...this.chargerState };
  }

  setConnectorStatus(connectorId: number, status: ChargerState['status']): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ Cannot send StatusNotification while charger is disconnected');
      return false;
    }

    if (status === 'Preparing') {
      return this.setVehicleConnected(connectorId, true);
    }

    if (status === 'Available') {
      return this.setVehicleConnected(connectorId, false);
    }

    if (status === 'SuspendedEV') {
      return this.pauseByEv(connectorId);
    }

    if (status === 'SuspendedEVSE') {
      return this.pauseByEvse(connectorId);
    }

    if (status === 'Charging') {
      return this.resumeCharging(connectorId);
    }

    if (status === 'Faulted') {
      return this.triggerFault(connectorId);
    }

    this.activeConnectorId = connectorId;
    this.chargerState.activeConnectorId = connectorId;
    this.chargerState.connectorStatus[connectorId] = status;

    this.chargerState.status = status;

    this.updateState();
    this.sendStatusNotification(connectorId, status);
    return true;
  }

  setVehicleConnected(connectorId: number, connected: boolean): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ Cannot update vehicle connection while charger is disconnected');
      return false;
    }

    const simulation = this.getConnectorSimulation(connectorId);
    this.activeConnectorId = connectorId;
    simulation.vehicleConnected = connected;

    if (connected) {
      simulation.faulted = false;
    }

    if (!connected) {
      simulation.evPaused = false;
      simulation.evsePaused = false;
      if (this.chargerState.pendingRemoteStart && connectorId === this.chargerState.activeConnectorId) {
        this.clearPendingStart();
      }
      if (this.chargerState.transactionId && connectorId === this.chargerState.activeConnectorId) {
        this.chargerState.status = 'SuspendedEV';
        this.chargerState.connectorStatus[connectorId] = 'SuspendedEV';
        this.chargerState.power = 0;
        this.updateState();
        this.sendStatusNotification(connectorId, 'SuspendedEV');
        window.setTimeout(() => {
          if (connectorId === this.chargerState.activeConnectorId && this.chargerState.transactionId) {
            this.finishTransaction(connectorId, 'EVDisconnected');
          }
        }, 800);
        return true;
      }
    }

    this.syncVisibleState(connectorId, true);
    return true;
  }

  pauseByEv(connectorId: number): boolean {
    if (!this.chargerState.transactionId || connectorId !== this.chargerState.activeConnectorId) {
      return false;
    }
    const simulation = this.getConnectorSimulation(connectorId);
    if (!simulation.vehicleConnected || simulation.faulted || simulation.unavailable) {
      return false;
    }
    simulation.evPaused = true;
    simulation.evsePaused = false;
    this.chargerState.power = 0;
    this.syncVisibleState(connectorId, true);
    return true;
  }

  pauseByEvse(connectorId: number): boolean {
    if (!this.chargerState.transactionId || connectorId !== this.chargerState.activeConnectorId) {
      return false;
    }
    const simulation = this.getConnectorSimulation(connectorId);
    if (!simulation.vehicleConnected || simulation.faulted || simulation.unavailable) {
      return false;
    }
    simulation.evPaused = false;
    simulation.evsePaused = true;
    this.chargerState.power = 0;
    this.syncVisibleState(connectorId, true);
    return true;
  }

  resumeCharging(connectorId: number): boolean {
    if (!this.chargerState.transactionId || connectorId !== this.chargerState.activeConnectorId) {
      return false;
    }
    const simulation = this.getConnectorSimulation(connectorId);
    if (!simulation.vehicleConnected || simulation.faulted || simulation.unavailable) {
      return false;
    }
    simulation.evPaused = false;
    simulation.evsePaused = false;
    this.chargerState.power = FAST_SIMULATED_POWER_W;
    this.syncVisibleState(connectorId, true);
    return true;
  }

  triggerFault(connectorId: number): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    const simulation = this.getConnectorSimulation(connectorId);
    simulation.faulted = true;
    simulation.evPaused = false;
    simulation.evsePaused = false;
    this.activeConnectorId = connectorId;

    if (this.chargerState.transactionId && connectorId === this.chargerState.activeConnectorId) {
      this.chargerState.power = 0;
      this.syncVisibleState(connectorId, true);
      window.setTimeout(() => {
        if (connectorId === this.chargerState.activeConnectorId && this.chargerState.transactionId) {
          this.finishTransaction(connectorId, 'Other', true);
        }
      }, 600);
      return true;
    }

    this.syncVisibleState(connectorId, true);
    return true;
  }

  clearFault(connectorId: number): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    const simulation = this.getConnectorSimulation(connectorId);
    simulation.faulted = false;
    this.syncVisibleState(connectorId, true);
    return true;
  }

  getConnectorSimulationState(connectorId: number): ConnectorSimulationState & { pendingRemoteStart: boolean } {
    const simulation = this.getConnectorSimulation(connectorId);
    return {
      ...simulation,
      pendingRemoteStart: this.chargerState.pendingRemoteStart && connectorId === this.chargerState.activeConnectorId,
    };
  }

  isCharging(): boolean {
    return this.chargerState.status === 'Charging';
  }

  isConnected(): boolean {
    return this.chargerState.status !== 'Offline';
  }

  setOnMessage(callback: (msg: OcppMessage) => void): void {
    this.onMessageCallback = callback;
  }
}
