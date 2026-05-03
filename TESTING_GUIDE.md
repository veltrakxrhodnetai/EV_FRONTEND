$env:MSG91_ENABLED="true"
$env:MSG91_AUTH_KEY="your_real_msg91_auth_key"
$env:MSG91_TEMPLATE_ID="69e8c993b6c8931b61090803"
$env:MSG91_COUNTRY_CODE="91"
$env:OTP_SMS_REQUIRED="true"
$env:OTP_ALLOW_DEV_TEST="false"
cd "C:\EV veltrak\ev-csms\backend"
java -jar target/ev-csms-backend-0.0.1-SNAPSHOT.jar$env:MSG91_ENABLED="true"
$env:MSG91_AUTH_KEY="your_real_msg91_auth_key"
$env:MSG91_TEMPLATE_ID="69e8c993b6c8931b61090803"
$env:MSG91_COUNTRY_CODE="91"
$env:OTP_SMS_REQUIRED="true"
$env:OTP_ALLOW_DEV_TEST="false"
cd "C:\EV veltrak\ev-csms\backend"
java -jar target/ev-csms-backend-0.0.1-SNAPSHOT.jar$env:MSG91_ENABLED="true"
$env:MSG91_AUTH_KEY="your_real_msg91_auth_key"
$env:MSG91_TEMPLATE_ID="69e8c993b6c8931b61090803"
$env:MSG91_COUNTRY_CODE="91"
$env:OTP_SMS_REQUIRED="true"
$env:OTP_ALLOW_DEV_TEST="false"
cd "C:\EV veltrak\ev-csms\backend"
java -jar target/ev-csms-backend-0.0.1-SNAPSHOT.jar# End-to-End Testing Guide

## Complete Flow: Payment Pre-Auth → Charger Verification → Live Charging → Auto-Stop → Invoice & Refund

### Setup (One Time)

#### 1. Database
```bash
# Ensure PostgreSQL is running on localhost:5432
psql -U postgres -d evcsms
# Database should have backend schema with all migrations applied (V1-V12)
```

#### 2. Backend (Port 8080)
```bash
# From workspace root
cd backend
mvn clean install -DskipTests
java -jar target/ev-csms-backend-0.0.1-SNAPSHOT.jar
# Should output: Started Application in X seconds on port 8080
```

#### 3. Frontend (Port 5173)
```bash
# From new terminal
cd frontend
npm install  # (if needed)
npm run dev
# Should output: VITE v4.4.x ready in X ms
# Access at: http://localhost:5173
```

#### 4. Simulator (Port 5174)
```bash
# From new terminal
cd simulator
npm install  # (if needed)
npm run dev
# Should output: VITE v4.4.x ready in X ms
# Access at: http://localhost:5174
```

---

## Testing Flow

### Step 1: Customer Login (Frontend)
1. Open http://localhost:5173
2. For customer flow:
   - Email: `customer@test.com`
   - Password: `password` (or any password, if no validation)

### Step 2: Browse & Select Charger
1. Click "Browse Stations" or navigate to Stations page
2. Select a station (e.g., "EV Charging Hub 1")
3. Click charger: `VT-CHN-AN-001-FC1A` (matches simulator)

### Step 3: Enter Vehicle & Payment Limit
1. Enter Vehicle Number: `KA01AB1234` (any valid input)
2. Choose Limit Type: `Amount`
3. Enter Amount: `₹500`
4. Click "Start Charging" button

**Expected Result:**
- ✅ POST `/api/sessions/start` returns 201 (was 402 before fix)
- ✅ Response includes: `sessionId`, `preauthAmount`, `preauthId`, `status: "PENDING_VERIFICATION"`

### Step 4: Connector Verification
1. Page displays: "{Station} → {Charger} is ready"
2. Message: "Ensure the charge cable is properly connected to your vehicle"
3. Verify pre-auth details displayed:
   - Amount: ₹500
   - Pre-Auth ID: preauth-xxxx
4. Click "Verify Connector Connected" button

**Expected Backend Action:**
- Backend sends OCPP `RemoteStartTransaction` to charger
- Charger transitions: Available → Preparing → Charging
- Backend creates charging session with PENDING_START status

### Step 5: Simulator (Parallel Testing)
1. Open http://localhost:5174 in separate browser/tab
2. Settings section:
   - Backend URL: `http://localhost:8080` (confirm)
3. For charger `VT-CHN-AN-001-FC1A`:
   - Click **Connect** button
   
**Expected Simulator Output:**
```
🟢 WebSocket connected to ws://localhost:8080/ws/ocpp
📤 Sent BootNotification
💓 Sent Heartbeat
📍 Sent StatusNotification: Available
```

4. Verify connection shows: **✅ Connected | Available**
5. Charger will auto-transition to **Preparing** (backend sent RemoteStartTransaction)
6. After 2 seconds: **Charging** status with power indication

### Step 6: Live Charging Session
1. Frontend automatically navigates to: `/customer/session/{id}/live`
2. Page displays live metrics with **3-second polling**:
   - **Energy (kWh)**: Should increase every 3 seconds
     - Starting from 0, accumulating ~0.018 kWh per 3 seconds (22kW charging)
   - **Amount (₹)**: Calculated as `energy * rate_per_kwh`
     - Should increase proportionally with energy
   - **Power (kW)**: Should vary around 22 kW (±random variation)
   - **Elapsed Time**: Incrementing timer

3. On **Simulator**, verify:
   ```
   📊 Sent MeterValues: 0.02kWh @ 21.5kW
   📊 Sent MeterValues: 0.04kWh @ 22.3kW
   📊 Sent MeterValues: 0.06kWh @ 21.8kW
   ```
   (Every 3 seconds, energy accumulates)

### Step 7: Auto-Stop (Amount Limit Reached)
1. Observe meter values increasing
2. When accumulated amount ≈ ₹500 (full pre-auth), backend triggers auto-stop:
   - Backend sends OCPP `RemoteStopTransaction` to charger

**On Simulator:**
```
🛑 RemoteStopTransaction received
📍 Sent StatusNotification: Finishing
✅ Charger now AVAILABLE
```

**On Frontend:**
- Session status changes: ACTIVE → STOPPING → COMPLETED
- Charger displayed as: **⏹️ Charging is stopping...**

### Step 8: Auto-Redirect to Invoice
1. When status becomes COMPLETED, frontend auto-redirects to:
   - `/customer/session/{id}/invoice`

2. Invoice page displays:
   - **Invoice Details:**
     - Invoice Number: INV-YYYY-MM-DD-001
     - Session ID: {sessionId}
     - Vehicle Number: KA01AB1234
   
   - **Energy & Amount:**
     - Energy Consumed: {consumed} kWh (e.g., 0.27 kWh)
     - Base Amount: ₹{base_amount}
     - GST (5%): ₹{gst}
     - Session Fee: ₹0
     - **Total Charged: ₹{total}** (highlighted)
   
   - **Payment Reconciliation:**
     - Pre-Authorized: ₹500.00
     - **Refunded: ₹{remaining}** (green, e.g., ₹21.50)

3. Click **Print** to generate tax invoice (PDF in browser)

---

## Key Validations

### Backend Verification
```bash
# In PostgreSQL:
SELECT id, charger_id, status, preauth_amount, meter_value, preauth_id 
FROM backend.charging_sessions 
ORDER BY id DESC LIMIT 1;

# Expected: status='COMPLETED', meter_value={accumulated}, preauth_id=preauth-xxxx

SELECT session_id, amount, capture_amount, refund_amount 
FROM backend.payment_records 
ORDER BY created_at DESC LIMIT 1;

# Expected: capture_amount ≈ 498, refund_amount ≈ 2 (or exact amount charged)
```

### OCPP Protocol Compliance
✅ Charger sends BootNotification on connect
✅ Charger sends Heartbeat every 60 seconds
✅ Charger responds to RemoteStartTransaction with Accepting + StatusNotification
✅ Charger responds to RemoteStopTransaction with Accepting + StatusNotification
✅ Charger sends MeterValues every 3 seconds with accumulated Wh and Power
✅ Message format: `[messageType, messageId, action, payload]`
  - messageType: 2=CALL, 3=CALLRESULT, 4=CALLERROR
✅ Transaction ID matches ChargePointIdentity

---

## Troubleshooting

### Simulator Fails to Connect
```
❌ Failed to connect: WebSocket connection failed
```
- Check backend is running: `http://localhost:8080` returns 200
- Check OCPP endpoint: ws://localhost:8080/ws/ocpp (via browser DevTools)
- Verify charger ID matches database: SELECT * FROM backend.chargers;

### Meter Values Not Updating
```
❌ Charger connected but frontend shows Energy: 0.00 kWh
```
- Verify simulator shows: "📊 Sent MeterValues" every 3 seconds
- Check frontend console for API errors: `GET /api/sessions/{id}/live`
- Verify charging session status is: ACTIVE (not PENDING_START)

### Session Not Auto-Stopping
```
⚠️ Energy keeps increasing, amount > ₹500 but session still ACTIVE
```
- Check backend logs for: `Auto-stopping session due to amount limit`
- Verify payment was captured: SELECT * FROM backend.payment_records;

### Frontend Doesn't Redirect to Invoice
```
⚠️ Stays on live charging page even though status=COMPLETED
```
- Check frontend console for navigation errors
- Manually navigate to: `/customer/session/{id}/invoice`
- Verify invoice data loads: `GET /api/sessions/{id}/invoice` returns 200

---

## Performance Notes

- **Meter Value Accuracy:** ±10% variation (realistic charger behavior)
- **Energy Accumulation:** (Power in kW × 1000 / 3600) × Interval(3s) = Wh
  - 22kW × 1000 / 3600 × 3 = 18.33 Wh per 3-second poll = 0.0183 kWh
  - ~22 kWh per hour at full power
  - ~500 kWh → 23 hours (test with ₹500 limit at ₹1/kWh)

- **Latency:** Frontend polls every 3 seconds (matches simulator interval)
- **Database:** V12 migration ensures payment_records uses backend schema + BIGINT session_id

---

## Production Verification Checklist

- [ ] Backend compiles: `mvn clean install`
- [ ] Database migrations applied: Latest version should be V12
- [ ] Frontend builds without errors: `npm run build` (0 warnings)
- [ ] Simulator builds without errors: `npm run build`
- [ ] Charger IDs in database match simulator config
- [ ] WebSocket endpoint `/ws/ocpp` responds to upgrade requests
- [ ] Payment service uses correct sessionId type (BIGINT, not UUID)
- [ ] All 3 chargers (001, 002, 003) pre-configured in database
- [ ] Invoice PDF generation works (print functionality)
- [ ] Refund calculation correct (preauth - charged = refund)
- [ ] Meter values accumulate (no reset during session)
- [ ] Auto-stop triggers when amount limit reached
- [ ] Auto-redirect to invoice on COMPLETED status works

