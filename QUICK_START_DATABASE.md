# Quick Start Guide - Complete System with Database Integration

This guide shows how to run the entire system with database integration for live simulation.

## Prerequisites

✅ PostgreSQL 15+ running on localhost:5432
✅ Database `evcsms` created with `backend` schema
✅ All migrations applied (V1 through V12)
✅ Java 17+
✅ Maven 3.9+
✅ Node.js 18+
✅ npm 9+

## Step 1: Prepare Database

### 1.1 Verify Database

```bash
psql -U postgres -d evcsms
```

```sql
-- Check schema exists
\dn backend

-- Check migrations applied
SELECT version, description, installed_on 
FROM backend.flyway_schema_history 
ORDER BY installed_rank DESC LIMIT 5;

-- Should show V12__align_payment_records_with_backend_schema.sql

-- Check chargers exist
SELECT ocpp_identity, name, communication_status 
FROM backend.chargers;

-- Expected output:
-- VT-CHN-AN-001-FC1A | Fast Charger 1A | OFFLINE
-- VT-CHN-AN-002-FC2A | Fast Charger 2A | OFFLINE
-- VT-CHN-AN-003-FC3A | Fast Charger 3A | OFFLINE
```

### 1.2 Insert Test Chargers (if missing)

If chargers don't exist:

```sql
-- Insert station first
INSERT INTO backend.stations (name, location, city, state, country, latitude, longitude)
VALUES ('Anna Nagar Hub', 'Anna Nagar', 'Chennai', 'Tamil Nadu', 'India', 13.0869, 80.2093)
ON CONFLICT DO NOTHING;

-- Insert chargers
INSERT INTO backend.chargers (
  station_id, ocpp_identity, name, vendor_name, model, 
  serial_number, charger_type, max_power_kw, status, 
  ocpp_version, enabled, communication_status
) VALUES 
(
  (SELECT id FROM backend.stations WHERE name = 'Anna Nagar Hub'),
  'VT-CHN-AN-001-FC1A',
  'Fast Charger 1A',
  'ABB',
  'Terra AC',
  'ABC123456',
  'AC',
  22.0,
  'AVAILABLE',
  '1.6',
  true,
  'OFFLINE'
),
(
  (SELECT id FROM backend.stations WHERE name = 'Anna Nagar Hub'),
  'VT-CHN-AN-002-FC2A',
  'Fast Charger 2A',
  'Schneider',
  'EVlink Pro',
  'SCH789012',
  'AC',
  22.0,
  'AVAILABLE',
  '1.6',
  true,
  'OFFLINE'
),
(
  (SELECT id FROM backend.stations WHERE name = 'Anna Nagar Hub'),
  'VT-CHN-AN-003-FC3A',
  'Fast Charger 3A',
  'ChargePoint',
  'CPF50',
  'CPT345678',
  'AC',
  22.0,
  'AVAILABLE',
  '1.6',
  true,
  'OFFLINE'
)
ON CONFLICT (ocpp_identity) DO NOTHING;

-- Add connectors for each charger
INSERT INTO backend.connectors (charger_id, connector_no, type, max_power_kw, status)
SELECT id, 1, 'Type2', max_power_kw, 'Available'
FROM backend.chargers
WHERE ocpp_identity LIKE 'VT-CHN-AN-%'
ON CONFLICT DO NOTHING;

-- Verify
SELECT c.ocpp_identity, c.name, c.vendor_name, c.model, 
       COUNT(conn.id) as connector_count
FROM backend.chargers c
LEFT JOIN backend.connectors conn ON conn.charger_id = c.id
WHERE c.ocpp_identity LIKE 'VT-CHN-AN-%'
GROUP BY c.id, c.ocpp_identity, c.name, c.vendor_name, c.model;
```

## Step 2: Start Backend

### 2.1 Build Backend

```bash
cd backend
mvn clean install -DskipTests

# Or on Windows:
"C:\maven\apache-maven-3.9.12\bin\mvn.cmd" clean install -DskipTests
```

Expected output:
```
[INFO] BUILD SUCCESS
[INFO] Total time: 45 s
```

### 2.2 Run Backend

```bash
java -jar target/ev-csms-backend-0.0.1-SNAPSHOT.jar
```

Expected output:
```
Started Application in 8.234 seconds (JVM running for 8.789)
Tomcat started on port(s): 8080 (http)
```

### 2.3 Verify Backend

Open browser: http://localhost:8080/actuator/health

Expected: `{"status":"UP"}`

## Step 3: Start Frontend

Open **new terminal**:

```bash
cd frontend
npm run dev
```

Expected output:
```
VITE v4.4.x ready in 523 ms
➜  Local:   http://localhost:5173/
```

Open browser: http://localhost:5173

## Step 4: Start Simulator

Open **new terminal**:

```bash
cd simulator
npm install  # First time only, installs axios
npm run dev
```

Expected output:
```
VITE v5.0.x ready in 432 ms
➜  Local:   http://localhost:5174/
```

Open browser: http://localhost:5174

## Step 5: Connect Simulator to Database

### 5.1 Verify System Status

In simulator UI (http://localhost:5174), check header:
- ✅ **Backend Online** (green)
- ✅ **Database Connected** (green)
- 🕐 Last Check: [recent timestamp]

### 5.2 Connect First Charger

1. Find charger: **🔌 Fast Charger 1A (Anna Nagar)**
2. Verify charger info displayed:
   ```
   ID: VT-CHN-AN-001-FC1A
   🏷️ ABB • Terra AC
   📋 S/N: ABC123456 • Max: 22kW
   ```
3. Click **"🔌 Connect to Backend"**

**Expected:**
- Button changes to "🔌 Disconnect" + "⚡ Start Charging"
- Status badge shows: **AVAILABLE** (green pulse)
- "🔌 LIVE" badge appears
- Last Update shows: "📡 Live"

**Backend Console:**
```log
OCPP connection established for chargerId=VT-CHN-AN-001-FC1A
Received OCPP message: BootNotification
Updated charger communication status to ONLINE
```

**Database Verification:**
```sql
SELECT ocpp_identity, communication_status, last_heartbeat 
FROM backend.chargers 
WHERE ocpp_identity = 'VT-CHN-AN-001-FC1A';

-- Expected:
-- ocpp_identity        | communication_status | last_heartbeat
-- VT-CHN-AN-001-FC1A  | ONLINE              | 2026-03-05 14:30:12
```

### 5.3 Connect Other Chargers (Optional)

Repeat for Charger 2A and 3A to simulate multi-charger station.

## Step 6: Test Complete Charging Flow

### 6.1 Frontend - Start Session

1. Open frontend: http://localhost:5173
2. Login as customer:
   - Email: `customer@test.com`
   - Password: `password`
3. Navigate to **Stations** page
4. Select station: **Anna Nagar Hub**
5. Click charger: **Fast Charger 1A (VT-CHN-AN-001-FC1A)**
6. Enter vehicle number: `KA01AB1234`
7. Select limit: **Amount** → **₹500**
8. Click **"Start Charging"**

**Expected:**
- Page navigates to "Connector Verification"
- Shows pre-auth: ₹500
- Backend logs: `Created payment pre-auth for session X`

**Database Check:**
```sql
SELECT id, charger_id, status, preauth_amount, meter_start 
FROM backend.charging_sessions 
ORDER BY id DESC LIMIT 1;

-- Expected: status = 'PENDING_VERIFICATION', preauth_amount = 500.00
```

### 6.2 Verify Connector

On frontend verification page:
1. Click **"Verify Connector Connected"**

**Backend sends OCPP command:**
```log
Sending RemoteStartTransaction to VT-CHN-AN-001-FC1A
```

**Simulator receives command:**
- Status changes: Available → **Preparing** (2 seconds) → **Charging**
- Power shows: ~22 kW
- Console: `📍 Sending StatusNotification: Charging`

**Frontend navigates to Live Session:**
- URL: `/customer/session/{id}/live`
- Displays real-time meter values

### 6.3 Watch Live Charging

**Simulator (every 3 seconds):**
```
📊 Sent MeterValues: 0.018kWh @ 21.5kW
📊 Sent MeterValues: 0.037kWh @ 22.3kW
📊 Sent MeterValues: 0.055kWh @ 21.8kW
```

**Frontend updates:**
- Energy: 0.018 → 0.037 → 0.055 kWh
- Amount: ₹0.90 → ₹1.85 → ₹2.75 (assuming ₹50/kWh)
- Power: 21.5 → 22.3 → 21.8 kW
- Elapsed time: 00:03 → 00:06 → 00:09

**Database (updates every 3s):**
```sql
SELECT meter_value, total_amount, status, updated_at
FROM backend.charging_sessions
WHERE id = (SELECT MAX(id) FROM backend.charging_sessions);

-- meter_value increases: 18 → 37 → 55 Wh
-- total_amount increases: 0.90 → 1.85 → 2.75
-- status = 'ACTIVE'
-- updated_at = [latest timestamp]

SELECT COUNT(*) FROM backend.meter_values
WHERE session_id = (SELECT MAX(id) FROM backend.charging_sessions);

-- Should increase by 1 every 3 seconds
```

### 6.4 Auto-Stop When Limit Reached

When accumulated amount ≈ ₹500:

**Backend:**
```log
Auto-stopping session X: Amount limit reached (500.00 >= 500.00)
Sending RemoteStopTransaction to VT-CHN-AN-001-FC1A
```

**Simulator:**
- Status: Charging → **Finishing** → **Available**
- Power: 22 kW → 0 kW
- Console: `🛑 RemoteStopTransaction received`

**Frontend:**
- Shows: "⏹️ Charging is stopping..."
- Auto-redirects to invoice page

**Database:**
```sql
SELECT status, meter_value, total_amount, refund_amount
FROM backend.charging_sessions
WHERE id = (SELECT MAX(id) FROM backend.charging_sessions);

-- status = 'COMPLETED'
-- meter_value = [final Wh]
-- total_amount = [actual charged, e.g., 498.50]
-- refund_amount = [unused preauth, e.g., 1.50]
```

### 6.5 View Invoice

Frontend shows:
```
INVOICE - INV-2026-03-05-001
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Session ID: 45
Vehicle: KA01AB1234

Energy Consumed: 9.97 kWh
Rate: ₹50.00/kWh
Base Amount: ₹498.50
GST (5%): ₹24.93
Session Fee: ₹0.00

Total Charged: ₹523.43

Pre-Authorized: ₹500.00
Refunded: ₹0.00 (used full amount)
```

## Step 7: Monitor Database Activity

### Real-time Session Monitoring

```sql
-- Active sessions
SELECT id, charger_id, vehicle_number, status, 
       meter_value, total_amount, 
       EXTRACT(EPOCH FROM (NOW() - start_time))::INT as elapsed_seconds
FROM backend.charging_sessions
WHERE status IN ('ACTIVE', 'PENDING_START', 'STOPPING')
ORDER BY start_time DESC;

-- Recent meter values
SELECT sv.timestamp, sv.energy_wh, sv.power_w, 
       cs.total_amount, cs.status
FROM backend.meter_values sv
JOIN backend.charging_sessions cs ON cs.id = sv.session_id
WHERE cs.id = (SELECT MAX(id) FROM backend.charging_sessions)
ORDER BY sv.timestamp DESC
LIMIT 10;

-- Charger communication status
SELECT ocpp_identity, name, communication_status, last_heartbeat,
       EXTRACT(EPOCH FROM (NOW() - last_heartbeat))::INT as seconds_since_heartbeat
FROM backend.chargers
WHERE ocpp_identity LIKE 'VT-CHN-AN-%'
ORDER BY ocpp_identity;
```

## Troubleshooting

### Simulator shows "Backend Offline"

```bash
# Test backend manually
curl http://localhost:8080/actuator/health

# If fails, check backend is running:
ps aux | grep java  # Linux/Mac
tasklist | findstr java  # Windows

# Check port 8080 is not in use
netstat -an | grep 8080  # Linux/Mac
netstat -an | findstr 8080  # Windows
```

### Charger info not appearing in simulator

```sql
-- Check charger exists
SELECT * FROM backend.chargers 
WHERE ocpp_identity = 'VT-CHN-AN-001-FC1A';

-- If empty, insert as shown in Step 1.2
```

### WebSocket connection fails

Check backend logs for:
```
OCPP connection established for chargerId=...
```

If not appearing:
1. Verify WebSocket config in backend
2. Check CORS allows simulator origin
3. Test WebSocket via browser DevTools: ws://localhost:8080/ws/ocpp

### Meter values not storing

```sql
-- Check meter values table
SELECT COUNT(*) FROM backend.meter_values;

-- Check session exists
SELECT id, status FROM backend.charging_sessions 
ORDER BY id DESC LIMIT 1;

-- If session status is PENDING_VERIFICATION, complete verification first
```

## System Architecture Verification

After all steps, you should have:

| Component | Port | Status | Database Connected |
|-----------|------|--------|-------------------|
| PostgreSQL | 5432 | ✅ Running | N/A |
| Backend | 8080 | ✅ Running | ✅ Yes |
| Frontend | 5173 | ✅ Running | ✅ via Backend |
| Simulator | 5174 | ✅ Running | ✅ via Backend |

**WebSocket Connections:**
- Simulator 1 ↔ Backend: `ws://localhost:8080/ws/ocpp` (VT-CHN-AN-001-FC1A)
- Simulator 2 ↔ Backend: `ws://localhost:8080/ws/ocpp` (VT-CHN-AN-002-FC2A)
- Simulator 3 ↔ Backend: `ws://localhost:8080/ws/ocpp` (VT-CHN-AN-003-FC3A)

**Database Connections:**
- Backend → PostgreSQL: JDBC connection pool (HikariCP)
- Backend stores: Sessions, MeterValues, Payments, Invoices

## Success Indicators

✅ **Simulator UI:**
- Backend Online (green)
- Database Connected (green)
- Charger shows vendor/model from database
- Live timestamp updating
- Meter values accumulating

✅ **Backend Logs:**
- OCPP connection established
- BootNotification received
- Heartbeat received (every 60s)
- MeterValues received (every 3s during charging)
- Auto-stop triggered on limit

✅ **Database:**
- `communication_status = 'ONLINE'` for connected chargers
- `last_heartbeat` updating every 60s
- New rows in `meter_values` every 3s during charging
- Session status progresses: PENDING → ACTIVE → COMPLETED

✅ **Frontend:**
- Live session page polls every 3s
- Energy/Amount increase in real-time
- Auto-redirect to invoice on completion
- Invoice shows correct GST and refund

---

🎉 **System is fully operational with database integration!**

The simulator now acts like a real EV charging station, with all data persisted in PostgreSQL and synchronized in real-time.
