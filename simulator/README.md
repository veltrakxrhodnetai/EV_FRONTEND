# OCPP Charger Simulator

A React-based OCPP protocol simulator for testing the EV charging platform end-to-end.

## Features

- **WebSocket Connection**: Connects to backend OCPP server via WebSocket
- **Multiple Chargers**: Simulate 3 OCPP-compliant EV chargers simultaneously
- **Real-time Meter Values**: Sends energy consumption and power data every 3 seconds
- **OCPP Message Handling**:
  - RemoteStartTransaction: Backend triggers charging start
  - RemoteStopTransaction: Backend stops charging when limit reached
  - MeterValues: Simulator sends consumption data continuously
  - StatusNotification: Charger status updates
- **Energy Simulation**: Realistic power variation (15-25kW) with accumulated energy
- **Configurable Backend**: Dynamically set backend URL for development/testing

## Installation & Setup

### 1. Install Dependencies
```bash
cd simulator
npm install
```

### 2. Configure Backend URL
- Click "Settings" button to set backend WebSocket URL
- Default: `http://localhost:8080`
- Simulator will connect to `ws://localhost:8080/ws/ocpp`

### 3. Run Simulator
```bash
npm run dev
```
Opens at http://localhost:5174

## Testing the Complete Flow

### Prerequisites
1. **Backend running**: `java -jar backend/target/ev-csms-backend-0.0.1-SNAPSHOT.jar`
2. **Frontend running**: `cd frontend && npm run dev`
3. **Simulator running**: `cd simulator && npm run dev`

### Test Flow

1. **Open Frontend** (http://localhost:5173)
   - Login with mobile + OTP
   - Browse stations and chargers

2. **Initiate Charging**
   - Select charger: "VT-CHN-AN-001-FC1A"
   - Enter vehicle number, choose limit (₹500)
   - Click "Start Charging"
   - Pre-auth amount shown

3. **Verify Connector in Frontend**
   - Page shows: "Plug connector into vehicle"
   - Click "✓ Connector is Plugged In" button

4. **Simultaneously in Simulator**
   - Click "Connect" on corresponding charger
   - Backend sends RemoteStartTransaction
   - Charger status changes to "Charging"
   - Click "Start Charging" to begin meter simulation

5. **Monitor Live Charging**
   - Frontend shows live energy/amount updates every 3 seconds
   - Energy accumulates: 15-25 kW × time
   - Simulated power varies ±10% for realism

6. **Auto-Stop When Limit Reached**
   - Backend detects when ₹500 limit reached
   - Sends RemoteStopTransaction
   - Simulator stops meter values
   - Frontend auto-redirects to invoice

7. **View Invoice**
   - Shows actual amount charged (e.g., ₹498.50)
   - Shows refund amount (₹21.50 pre-auth balance)
   - GST breakdown included

## OCPP Message Format

### Message Structure
```
[messageType, messageId, action, payload]

messageType:
  1 = CALL (request)
  2 = CALL_RESULT (response)
  3 = CALL_ERROR (error)
```

### Key Messages

**RemoteStartTransaction (Backend → Charger)**
```json
[1, "123", "RemoteStartTransaction", {
  "transactionId": 1,
  "sessionId": 123,
  "connectorId": 1
}]
```

**RemoteStopTransaction (Backend → Charger)**
```json
[1, "124", "RemoteStopTransaction", {
  "transactionId": 1,
  "sessionId": 123
}]
```

**MeterValues (Charger → Backend)**
```json
[1, "125", "MeterValues", {
  "connectorId": 1,
  "transactionId": 123,
  "meterValue": [{
    "timestamp": "2026-03-05T15:30:00Z",
    "sampledValue": [
      {"value": "15000", "measurand": "Energy.Active.Import.Register", "unit": "Wh"},
      {"value": "22000", "measurand": "Power.Active.Import", "unit": "W"}
    ]
  }]
}]
```

**StatusNotification (Charger → Backend)**
```json
[1, "126", "StatusNotification", {
  "connectorId": 1,
  "status": "Charging",
  "errorCode": "NoError",
  "timestamp": "2026-03-05T15:30:00Z"
}]
```

## Architecture

```
src/
├── App.tsx                 # Main UI with charger grid
├── components/
│   └── ChargerSimulator.tsx # Individual charger control
├── ocpp/
│   └── OcppProtocol.ts    # OCPP protocol handler
├── index.tsx              # React entry point
└── index.css              # Global styles
```

## Charger Specifications

| Charger ID | Name | Max Power | Type |
|-----------|------|-----------|------|
| VT-CHN-AN-001-FC1A | Fast Charger 1A | 22 kW | DC Fast |
| VT-CHN-AN-002-FC2A | Fast Charger 2A | 22 kW | DC Fast |
| VT-CHN-AN-003-FC3A | Fast Charger 3A | 22 kW | DC Fast |

## Troubleshooting

### Connection Failed
- Verify backend is running and WebSocket is active
- Check firewall allows WebSocket connections
- Ensure CORS is enabled on backend

### Meter Values Not Updating
- Check that connector status is "Charging"
- Verify sessionId is set (should come from RemoteStartTransaction)
- Check browser console for errors

### Commands Not Received
- Verify charger is connected (status shows as connected)
- Check backend logs for sent messages
- Ensure WebSocket connection is stable

## Development

### Build for Production
```bash
npm run build
```

### Notes
- Each charger maintains independent state
- WebSocket reconnection not implemented (manual reconnect needed)
- Meter values reset on disconnect
- Power variation simulates realistic charging curve

## Testing Scenarios

### Scenario 1: Amount-Based Charging
1. Start ₹500 charge
2. Monitor until backend auto-stops at limit
3. Verify no overage

### Scenario 2: Energy-Based Charging
1. Start 10 kWh charge
2. Verify auto-stop at 10 kWh
3. Check refund = pre-auth - actual

### Scenario 3: Time-Based Charging
1. Start 30-minute charge
2. Verify auto-stop after 30 minutes
3. Check meter values every 3 seconds

### Scenario 4: Manual Stop
1. Start charging
2. Click "Stop Charging" in simulator or frontend
3. Verify session completes and invoice shown

## Future Enhancements

- [ ] Auto-reconnect on disconnect
- [ ] Multiple chargers per location
- [ ] Customizable power curves
- [ ] Error simulation (overcurrent, overheat)
- [ ] Transaction persistence
- [ ] WebSocket reconnection strategy
- [ ] Load testing (multiple simultaneous charges)
