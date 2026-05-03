# OCPP Simulator - Database Integration Guide

## Overview

The OCPP Simulator is now fully integrated with the backend database, providing real-time synchronization and live charger simulation that acts like a real EV charging station.

## Architecture

```
┌─────────────────────┐       WebSocket        ┌──────────────────┐       Database        ┌──────────────┐
│  Simulator React    │◄──────────────────────►│  Backend API     │◄───────────────────►│  PostgreSQL  │
│  Port 5174          │    /ws/ocpp (OCPP 1.6) │  Port 8080       │     JDBC/JPA         │  Port 5432   │
└─────────────────────┘                         └──────────────────┘                       └──────────────┘
         │                                               │
         │                                               │
         │            REST API Calls                     │
         └───────────────────────────────────────────────┘
           GET /api/admin/chargers
           GET /api/chargers/{id}/connectors
           GET /actuator/health
```

## Database Integration Features

### 1. **Charger Information Sync**

When the simulator starts, it:
- Fetches charger details from database using OCPP identity
- Displays real charger metadata: Vendor, Model, Serial Number, Max Power
- Shows whether charger exists in database

**API Endpoint Used:**
```typescript
GET /api/admin/chargers
// Returns all chargers, simulator filters by ocppIdentity
```

**Database Table:**
```sql
backend.chargers
- id (BIGINT)
- ocpp_identity (VARCHAR) UNIQUE
- name (VARCHAR)
- vendor_name (VARCHAR)
- model (VARCHAR)
- serial_number (VARCHAR)
- max_power_kw (NUMERIC)
- status (VARCHAR)
- communication_status (VARCHAR) -- ONLINE/OFFLINE
- last_heartbeat (TIMESTAMP)
```

### 2. **Backend Health Monitoring**

The simulator continuously monitors:
- Backend connectivity (every 10 seconds)
- Database availability
- WebSocket connection status

**Visual Indicators:**
- 🟢 Green pulse: Backend online & database connected
- 🔴 Red: Backend offline or unreachable
- 📡 Live indicator: Real-time updates active

### 3. **Real-time State Persistence**

The OCPP protocol automatically syncs:

#### On Connection (BootNotification):
```typescript
// Simulator sends OCPP BootNotification
[2, messageId, "BootNotification", {
  chargePointModel: "EV-Sim-v1",
  chargePointVendor: "EV CSMS Simulator",
  chargePointSerialNumber: "VT-CHN-AN-001-FC1A",
  firmwareVersion: "1.0.0"
}]
```

Backend updates:
```sql
UPDATE backend.chargers 
SET communication_status = 'ONLINE',
    last_heartbeat = NOW()
WHERE ocpp_identity = 'VT-CHN-AN-001-FC1A';
```

#### During Charging (MeterValues):
```typescript
// Simulator sends every 3 seconds
[2, messageId, "MeterValues", {
  connectorId: 1,
  transactionId: 12345,
  meterValue: [{
    timestamp: "2026-03-05T14:23:45Z",
    sampledValue: [
      { value: "18330", measurand: "Energy.Active.Import.Register", unit: "Wh" },
      { value: "21500", measurand: "Power.Active.Import", unit: "W" },
      { value: "25", measurand: "Temperature", unit: "Celsius" }
    ]
  }]
}]
```

Backend stores:
```sql
INSERT INTO backend.meter_values (
  session_id, timestamp, energy_wh, power_w, temperature
) VALUES (
  45, '2026-03-05 14:23:45', 18330, 21500, 25
);

UPDATE backend.charging_sessions 
SET meter_value = 18330,
    updated_at = NOW()
WHERE id = 45;
```

#### On Disconnect:
```sql
UPDATE backend.chargers 
SET communication_status = 'OFFLINE'
WHERE ocpp_identity = 'VT-CHN-AN-001-FC1A';
```

### 4. **Session Management**

The simulator handles complete session lifecycle:

**Start Session:**
1. Frontend calls: `POST /api/sessions/start`
2. Backend creates record in `backend.charging_sessions`
3. Backend sends: `RemoteStartTransaction` via WebSocket
4. Simulator receives command, transitions to "Charging"
5. Simulator updates state, sends `StatusNotification`

**During Session:**
1. Simulator sends `MeterValues` every 3 seconds
2. Backend stores each meter reading
3. Backend calculates: energyKwh, totalAmount, elapsed time
4. Frontend polls: `GET /api/sessions/{id}/live` every 3 seconds

**Stop Session:**
1. Backend detects limit reached (amount/energy/time)
2. Backend sends: `RemoteStopTransaction` via WebSocket
3. Simulator receives command, transitions to "Finishing" → "Available"
4. Backend finalizes session, captures payment, issues refund
5. Frontend auto-redirects to invoice page

## UI Features - "Lively" Experience

### Real-time Visual Feedback

1. **Connection Status**
   - Gradient borders (green when connected)
   - Pulsing indicators
   - Animated glow effects
   - Live timestamp with "📡 Live" badge

2. **Charging Animation**
   - Shimmer effect during charging
   - Power bar with gradient fill
   - Color-coded status badges
   - Accumulating energy counter

3. **System Status Panel**
   - Backend connectivity: Green/Red with pulse
   - Database status: Real-time ping
   - Last check timestamp
   - Auto-update every 10 seconds

4. **Meter Display**
   - Energy (kWh): Blue gradient, 3 decimal precision
   - Power (kW): Green gradient with progress bar
   - Session ID: Orange with transaction reference
   - Temperature: Always displayed when connected

5. **Button Animations**
   - Hover effects (translateY + shadow)
   - Gradient backgrounds
   - Disabled state when backend offline
   - Color transitions on state change

### Database Information Display

Each charger card shows:
```
🔌 Fast Charger 1A (Anna Nagar)     [🔌 LIVE] [Available]
ID: VT-CHN-AN-001-FC1A
🏷️ Generic • Model-X
📋 S/N: ABC123456 • Max: 22kW

[Backend Online] [Database Connected]
⏰ Last Update: 14:23:45 | 📡 Live
```

## Configuration

### Backend URL Setup

1. Click "⚙️ Configuration Settings"
2. Enter backend URL (default: `http://localhost:8080`)
3. Click "✓ Apply"
4. System automatically:
   - Tests connectivity
   - Updates WebSocket endpoint
   - Refreshes charger info from database

### Pre-configured Chargers

The simulator comes with 3 chargers matching database:
- `VT-CHN-AN-001-FC1A` - Fast Charger 1A (Anna Nagar)
- `VT-CHN-AN-002-FC2A` - Fast Charger 2A (Anna Nagar)  
- `VT-CHN-AN-003-FC3A` - Fast Charger 3A (Anna Nagar)

**Database Requirement:**
These chargers must exist in `backend.chargers` table with matching `ocpp_identity`.

## Testing Database Integration

### 1. Verify Chargers in Database

```sql
SELECT ocpp_identity, name, vendor_name, model, 
       communication_status, last_heartbeat
FROM backend.chargers
WHERE ocpp_identity LIKE 'VT-CHN-AN-%';
```

Expected: 3 chargers, all with `communication_status = 'OFFLINE'` initially

### 2. Start Simulator

```bash
cd simulator
npm install  # Install axios and other dependencies
npm run dev  # Start on port 5174
```

Open: http://localhost:5174

### 3. Connect Charger

1. Click "🔌 Connect to Backend" on any charger
2. Observe backend logs:
   ```
   OCPP connection established for chargerId=VT-CHN-AN-001-FC1A
   Received BootNotification from VT-CHN-AN-001-FC1A
   ```

3. Check database:
   ```sql
   SELECT communication_status, last_heartbeat 
   FROM backend.chargers 
   WHERE ocpp_identity = 'VT-CHN-AN-001-FC1A';
   ```
   Expected: `communication_status = 'ONLINE'`, recent `last_heartbeat`

### 4. View Charger Info from Database

In simulator UI, you should see:
- Real vendor name from database
- Real model from database
- Real serial number from database
- Max power from database

### 5. Start Charging Session

From frontend (port 5173):
1. Login as customer
2. Browse stations → Select charger `VT-CHN-AN-001-FC1A`
3. Enter vehicle number, choose ₹500 limit
4. Click "Start Charging" → Verify connector

Simulator will:
- Receive `RemoteStartTransaction`
- Transition to "Charging" state
- Send `MeterValues` every 3 seconds

Check database:
```sql
SELECT id, status, meter_start, meter_value, total_amount
FROM backend.charging_sessions
ORDER BY id DESC LIMIT 1;

SELECT timestamp, energy_wh, power_w
FROM backend.meter_values
WHERE session_id = (SELECT MAX(id) FROM backend.charging_sessions)
ORDER BY timestamp DESC LIMIT 10;
```

### 6. Monitor Live Updates

You'll see in simulator:
- Energy accumulating (0.018 kWh every 3 seconds)
- Power varying (±2 kW around 22 kW)
- Last update timestamp refreshing
- "📡 Live" indicator

Database updates every 3 seconds with new meter values.

### 7. Auto-Stop

When limit reached, backend sends `RemoteStopTransaction`:
- Simulator transitions: Charging → Finishing → Available
- Database updated: `status = 'COMPLETED'`
- Frontend shows invoice with refund

## API Reference

### Simulator → Backend REST Calls

```typescript
// 1. Get charger info (on load)
GET /api/admin/chargers
Response: ChargerInfo[]

// 2. Health check (every 10s)
GET /actuator/health
Response: { status: "UP" }

// 3. Get connectors (optional)
GET /api/chargers/{chargerId}/connectors
Response: ConnectorInfo[]
```

### Simulator ↔ Backend WebSocket (OCPP)

```typescript
// Simulator → Backend
[2, messageId, "BootNotification", { chargePointVendor, ... }]
[2, messageId, "Heartbeat", {}]
[2, messageId, "MeterValues", { connectorId, meterValue, ... }]
[2, messageId, "StatusNotification", { connectorId, status, ... }]

// Backend → Simulator
[2, messageId, "RemoteStartTransaction", { connectorId, idTag }]
[2, messageId, "RemoteStopTransaction", { transactionId }]

// CALLRESULT responses
[3, messageId, { status: "Accepted" }]
```

## Troubleshooting

### Simulator shows "Backend Offline"

**Check:**
1. Backend is running: `http://localhost:8080/actuator/health`
2. CORS enabled for `http://localhost:5174`
3. No firewall blocking port 8080

### Charger info not displaying

**Check:**
1. Charger exists in database with matching `ocpp_identity`
2. Database has data in `vendor_name`, `model`, `serial_number` columns
3. Browser console for API errors

### WebSocket not connecting

**Check:**
1. WebSocket endpoint accessible: `ws://localhost:8080/ws/ocpp`
2. Backend logs show connection attempts
3. Browser DevTools → Network → WS tab

### Meter values not updating database

**Check:**
1. Active session exists in `backend.charging_sessions`
2. Backend logs show "Received MeterValues"
3. Transaction ID matches between simulator and database

## Performance Notes

- **API Polling**: Backend status checked every 10 seconds
- **Meter Updates**: Sent every 3 seconds during charging
- **Database Writes**: ~20 inserts per minute per charging session
- **UI Updates**: React state updates on every meter reading
- **WebSocket**: Bidirectional, persistent connection per charger

## Security Considerations

> ⚠️ **Development Only**: Current implementation has no authentication for simulator connections.

For production:
1. Add API authentication (Bearer token)
2. Validate OCPP identity before BootNotification
3. Rate limiting on meter values
4. Encrypt WebSocket (wss://)
5. IP whitelisting for simulator access

## Summary

The simulator now provides:
✅ Real database integration via REST API and WebSocket
✅ Live charger information from database
✅ Real-time state synchronization
✅ Visual feedback with animations
✅ Complete OCPP 1.6 protocol compliance
✅ Session lifecycle management with database persistence
✅ Backend health monitoring
✅ Meter value storage and retrieval
✅ Lively, animated UI experience

The simulator acts like a **real EV charger station**, communicating with the backend and storing all data in PostgreSQL, providing an authentic testing environment for the charging platform.
