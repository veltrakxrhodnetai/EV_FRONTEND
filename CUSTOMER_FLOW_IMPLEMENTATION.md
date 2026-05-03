# Customer Charging Flow - Implementation Summary

## Overview
Complete implementation of the customer charging flow with connector verification, payment pre-authorization, real-time updates, auto-stop, auto-refund, and invoice generation.

## Backend Changes

### 1. Database Migration (V11)
**File**: `V11__add_connector_verification_and_payment_tracking.sql`
- Added columns for connector verification tracking
- Added payment pre-authorization and refund tracking
- Added invoice generation fields

### 2. Model Updates
**File**: `ChargingSession.java`
- Added `connectorVerified` (Boolean)
- Added `connectorVerifiedAt` (LocalDateTime)
- Added `preauthId` (String)
- Added `preauthAmount` (Double)
- Added `refundAmount` (Double)
- Added `refundId` (String)
- Added `invoiceNumber` (String)
- Added `invoiceUrl` (String)

### 3. Session Controller Updates
**File**: `SessionController.java`

#### New Workflow:
1. **POST /api/sessions/start** - Updated to:
   - Calculate pre-auth amount based on limit type (AMOUNT/ENERGY/TIME)
   - Create payment pre-authorization
   - Set status to `PENDING_VERIFICATION` (waiting for connector to be plugged in)
   - Store preauth details in session
   - Return `preauthAmount`, `preauthId`, and `status`

2. **POST /api/sessions/{id}/verify-connector** - New endpoint:
   - Marks connector as verified
   - Records verification timestamp
   - Initiates actual charging via OCPP RemoteStartTransaction
   - Changes status from `PENDING_VERIFICATION` to `PENDING_START`

3. **GET /api/sessions/{id}/invoice** - New endpoint:
   - Returns complete invoice with all billing details
   - Includes invoice number, amounts, refunds, GST breakdown
   - Only available for COMPLETED sessions

### 4. Charging Session Service Updates
**File**: `ChargingSessionService.java`

#### Auto-Stop Logic:
- **saveMeterValues()** method now checks if limits are reached:
  - **ENERGY limit**: Stops when consumed kWh >= limit
  - **TIME limit**: Stops when elapsed minutes >= limit
  - **AMOUNT limit**: Stops when current cost >= limit (with early stop to avoid overshoot)
- Sends OCPP RemoteStopTransaction automatically
- Sets session status to `STOPPING`

#### Auto-Refund & Billing:
- **stopTransaction()** method now:
  1. Calculates final bill (base + GST + session fee)
  2. Captures actual amount charged via PaymentService
  3. Calculates unused amount = preauthAmount - totalAmount
  4. Automatically refunds unused amount (if > ₹0.01)
  5. Generates invoice number (format: INV-YYYYMM-NNNNNN)
  6. Creates invoice URL for receipt download

### 5. Payment Service Updates
**File**: `PaymentService.java`
- Updated `RefundResult` to include `refundId` field
- Refund method now returns provider reference ID

## API Flow

### Complete Charging Session Flow:

```
1. Customer Login
   POST /api/customer/auth/check-phone
   POST /api/customer/auth/send-otp
   POST /api/customer/auth/verify-otp
   POST /api/customer/auth/login-otp

2. Browse Stations
   GET /api/stations

3. View Station Details
   GET /api/stations/{id}/chargers

4. Start Charging (with pre-auth)
   POST /api/sessions/start
   {
     "chargerId": 1,
     "connectorId": 1,
     "connectorNo": 1,
     "vehicleNumber": "KA01AB1234",
     "phoneNumber": "9876543210",
     "startedBy": "CUSTOMER",
     "limitType": "AMOUNT",
     "limitValue": 500,
     "paymentMode": "UPI"
   }
   Response: { sessionId, preauthAmount, preauthId, status: "PENDING_VERIFICATION" }

5. Verify Connector Plugged In
   POST /api/sessions/{id}/verify-connector
   Response: { sessionId, status: "PENDING_START", message: "Charging will start shortly" }

6. Monitor Live Charging
   GET /api/sessions/{id}/live
   Response: { energyConsumedKwh, runningAmountRs, elapsedMinutes, currentPowerKw, status }
   (Poll every 3-5 seconds)

7. Auto-Stop When Limit Reached
   (Automatic - triggered by ChargingSessionService when meter values indicate limit reached)

8. Get Final Bill & Invoice
   GET /api/sessions/{id}/bill
   GET /api/sessions/{id}/invoice
   Response: { invoiceNumber, totalAmount, refundAmount, baseAmount, gstAmount, ... }
```

## Frontend Implementation Required

### 1. Connector Verification Screen
**Component**: `ConnectorVerificationPage.tsx`
- Display pre-auth amount
- Instructions: "Please plug the connector into your vehicle"
- Visual indicator/animation
- "Connector is Plugged In" button
- Calls POST /api/sessions/{id}/verify-connector
- Navigates to LiveSessionPage after confirmation

### 2. Update StartChargingModal
**File**: `StartChargingModal.tsx`
- After successful startSession call, navigate to ConnectorVerificationPage
- Pass sessionId, preauthAmount to next screen

### 3. Enhanced Live Session Page
**File**: `LiveSessionPage.tsx`
- Add real-time polling (useEffect with setInterval every 3 seconds)
- Display:
  - Energy consumed (kWh)
  - Amount charged (₹)
  - Time elapsed
  - Current power (kW)
  - Limit progress bar (show % of limit reached)
- "Stop Charging" button for manual stop
- Auto-redirect to BillingSummaryPage when status becomes "COMPLETED"

### 4. Billing Summary / Invoice Page
**File**: `InvoicePage.tsx`
- Fetch invoice data: GET /api/sessions/{id}/invoice
- Display complete breakdown:
  - Invoice number
  - Session details (station, charger, connector, vehicle)
  - Time details (start, end, duration)
  - Energy consumed
  - Billing breakdown:
    - Base amount (energy × price/kWh)
    - Session fee
    - Subtotal
    - GST (18%)
    - **Total charged**
  - Payment details:
    - Pre-authorized amount
    - **Refunded amount** (highlight in green)
  - Download invoice button (future: PDF generation)
  - "Done" button to return to station list

## Status Flow

```
PENDING_VERIFICATION → (verify connector) → PENDING_START → (OCPP start) → ACTIVE
                                                                             ↓
                                                                    (limit reached)
                                                                             ↓
                                                                         STOPPING
                                                                             ↓
                                                                   (OCPP stop complete)
                                                                             ↓
                                                                        COMPLETED
```

## Testing Steps

1. **Start Backend**:
   ```bash
   cd "C:\EV veltrak\ev-csms\backend"
   C:\maven\apache-maven-3.9.12\bin\mvn.cmd clean package -DskipTests
   java -jar target\ev-csms-backend-0.0.1-SNAPSHOT.jar
   ```

2. **Start OCPP Simulator**:
   - Open `ocpp-similator.html` in browser
   - Connect to charger

3. **Start Frontend**:
   ```bash
   cd "C:\EV veltrak\ev-csms\frontend"
   npm run dev
   ```

4. **Test Complete Flow**:
   - Login with mobile + OTP
   - Select station and charger
   - Choose limit (e.g., ₹100, 5 kWh, or 10 minutes)
   - Click "Pay & Start Charging"
   - See pre-auth confirmation screen
   - Click "Connector is Plugged In"
   - Watch live charging data update
   - Wait for auto-stop when limit is reached
   - View invoice with refund amount

## Key Features Implemented

✅ Mobile OTP login
✅ Passcode support (optional)
✅ Station browsing
✅ Charger status filtering (Available/In use/Unavailable)
✅ Charging limit selection (Amount/Energy/Time)
✅ Payment pre-authorization
✅ Connector verification step
✅ Real-time charging data updates
✅ Auto-stop when limit reached
✅ Automatic refund of unused amount
✅ GST invoice generation
✅ Complete payment flow (pre-auth → capture → refund)

## Next Steps for Production

1. **Real Payment Gateway Integration**:
   - Replace mock payment service with Razorpay/Stripe
   - Implement 3D Secure authentication
   - Add webhook handlers for payment notifications

2. **PDF Invoice Generation**:
   - Integrate library like iText or Apache PDFBox
   - Generate downloadable PDF with company logo/branding
   - Include QR code for verification

3. **Push Notifications**:
   - Notify customer when charging starts
   - Alert when 80% of limit is reached
   - Notify when charging completes with refund details

4. **Analytics & Insights**:
   - Track charging patterns
   - Show savings with pre-paid wallet
   - Display carbon footprint saved

5. **Customer Wallet**:
   - Add wallet balance management
   - Enable pre-paid charging
   - Loyalty points/rewards program
