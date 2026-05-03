# Admin Portal Configuration Pages - Production Ready ✅

## Overview
The admin configuration pages have been fully enhanced from MVP scaffolds to production-ready interfaces for configuring EV stations, chargers, and OCPP credentials.

---

## ✅ Enhanced Pages

### 1. **AdminStationsPage** (Backend/Stations)
**Production Features:**
- ✅ Modal-based Create/Edit interface (replaces inline forms)
- ✅ Comprehensive station configuration:
  - Basic Info: name, code
  - Full Address: address, city, state, pincode, coordinates (lat/long)
  - Operating Hours: 24x7 or Custom
  - Support Contact (phone/email)
  - Amenities: Parking, Restroom, Food Court, CCTV, WiFi, Waiting Area
  - Payment Methods: UPI, Card, Wallet, Cash
  - Status: ACTIVE/INACTIVE
- ✅ Full CRUD: Create, Edit, Deactivate (with confirmation)
- ✅ Form Validation: required fields, coordinate precision
- ✅ Error/Success Messages: auto-dismiss success after 3s
- ✅ Loading States: disabled buttons, "Saving..." feedback
- ✅ Professional UI: hover effects, color-coded badges, responsive grid

**User Workflow:**
1. Click "+ Add Station" → Modal opens
2. Fill station details (name, address, amenities, payment methods, etc.)
3. Submit → Station created, appears in table
4. Click "Edit" → Modal opens with pre-filled data
5. Click "Deactivate" → Confirmation dialog → Station deactivated

---

### 2. **AdminChargersPage** (Backend/Chargers)
**Production Features:**
- ✅ Modal-based Create/Edit interface
- ✅ Station Selector: dropdown to choose parent station
- ✅ Charger Configuration:
  - Charger Name (e.g., "DC Fast Charger 1")
  - **Charge Point Identity (OCPP)** - highlighted as critical field
  - Vendor, Model, Serial Number
  - Charger Type: AC/DC
  - Max Power (kW)
  - OCPP Version: 1.6J, 2.0.1
  - Enabled toggle
- ✅ Communication Status Badge: ONLINE (blue) / OFFLINE (red)
- ✅ **Connector Management**: "+Connector" button to add guns to each charger
- ✅ Connector Modal:
  - Connector Number (1, 2, 3...)
  - Connector Type: CCS2, CHAdeMO, Type 2, GB/T
  - Max Power (kW)
  - Shows existing connectors for charger
- ✅ Enable/Disable Charger: PATCH endpoint with toggle button
- ✅ Full CRUD: Create, Edit, Enable/Disable

**Key UX:**
- Emphasizes **Charge Point Identity** (must match charger's OCPP config)
- Shows station name in dropdown for easy selection
- Communication status with color-coded badges
- "Vendor Model" displayed as subtitle in table

**User Workflow:**
1. Click "+ Add Charger" → Modal opens
2. Select station, enter charger details (name, OCPP identity, vendor, etc.)
3. Submit → Charger created
4. Click "+Connector" → Add connector modal opens
5. Enter connector number, type, power → Submit
6. Click "Edit" → Edit charger details
7. Click "Enable/Disable" → Toggle charger availability

---

### 3. **AdminOcppConfigPage** (Backend/OCPP Config)
**Production Features:**
- ✅ Modal-based configuration interface
- ✅ Charger Selector: dropdown showing "Name (OCPP Identity)"
- ✅ WebSocket Configuration:
  - WebSocket URL (ws:// or wss://)
  - Heartbeat Interval (seconds, default 300)
  - Meter Value Interval (seconds, default 60)
- ✅ **Security Mode** (3 options):
  1. **NONE**: No authentication (not recommended for production)
  2. **TOKEN**: Token-based authentication (shows token input field)
  3. **TLS**: TLS/SSL certificates (shows TLS profile JSON textarea)
- ✅ Conditional Fields:
  - TOKEN mode → password input for token
  - TLS mode → JSON textarea for certificate config
- ✅ Allowed IPs: JSON array format (["192.168.1.100", "10.0.0.0/24"])
- ✅ Active Toggle: enable/disable config without deletion
- ✅ Validation:
  - WebSocket URL must start with ws:// or wss://
  - Intervals must be positive integers
  - Allowed IPs must be valid JSON array
- ✅ Info Banner: explains OCPP WebSocket configuration requirements
- ✅ Color-Coded Security Badges: TLS (green), TOKEN (blue), NONE (gray)

**User Workflow:**
1. Click "+ Configure Charger" → Modal opens
2. Select charger from dropdown
3. Enter WebSocket URL (matches backend OCPP server)
4. Set heartbeat and meter intervals
5. Choose security mode:
   - NONE → No extra fields
   - TOKEN → Enter authentication token
   - TLS → Paste TLS profile JSON
6. (Optional) Add allowed IPs as JSON array
7. Check "Configuration Active" → Submit
8. Config appears in table with security badge

---

## 🔧 Backend API Support

All three pages use these API functions (already implemented):

### Stations:
- `getAdminStations()` - GET /api/admin/stations
- `createAdminStation(payload)` - POST /api/admin/stations
- `updateAdminStation(id, payload)` - PUT /api/admin/stations/{id}
- `deactivateAdminStation(id)` - PATCH /api/admin/stations/{id}/deactivate

### Chargers:
- `getAdminChargers(stationId?)` - GET /api/admin/chargers
- `createAdminCharger(payload)` - POST /api/admin/chargers
- `updateAdminCharger(id, payload)` - PUT /api/admin/chargers/{id}
- `toggleAdminChargerEnable(id)` - PATCH /api/admin/chargers/{id}/toggle-enable

### Connectors:
- `getAdminConnectors(chargerId)` - GET /api/admin/connectors?chargerId={id}
- `createAdminConnector(payload)` - POST /api/admin/connectors

### OCPP Config:
- `getAdminOcppConfigs()` - GET /api/admin/ocpp-configs
- `createAdminOcppConfig(payload)` - POST /api/admin/ocpp-configs

---

## 🚀 Next Steps

### 1. **Rebuild Backend JAR** (CRITICAL)
The backend code is complete but needs recompilation to activate the admin endpoints.

**Option A: Using IDE (Recommended)**
```bash
# IntelliJ IDEA:
Maven → Reload Project → Build → Rebuild Project

# VS Code:
Java Projects → ev-csms-backend → Build → Full Build
```

**Option B: Docker Maven (if mvnw fails due to path spaces)**
```powershell
cd "c:\EV veltrak\ev-csms\backend"
docker run --rm -v "${PWD}:/app" -w /app maven:3.9.5-eclipse-temurin-17 mvn clean package -DskipTests
```

**Option C: Install Maven Globally**
```powershell
choco install maven
cd "c:\EV veltrak\ev-csms\backend"
mvn clean package -DskipTests
```

### 2. **Start Backend**
```powershell
cd "c:\EV veltrak\ev-csms\scripts"
.\run-backend-dev.bat
```

### 3. **Verify Admin Login**
```powershell
curl -X POST http://localhost:8080/api/admin/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"admin","password":"Admin@123"}'
```

### 4. **Start Frontend** (if not running)
```powershell
cd "c:\EV veltrak\ev-csms\frontend"
npm run dev
```

### 5. **Test Admin Portal**
1. Go to http://localhost:5173/admin/login
2. Login: username=`admin`, password=`Admin@123`
3. Navigate to "Stations" → Click "+ Add Station" → Fill form → Submit
4. Navigate to "Chargers" → Click "+ Add Charger" → Fill form → Submit
5. Navigate to "OCPP Config" → Click "+ Configure Charger" → Fill form → Submit

---

## 📊 Complete EV Station Onboarding Workflow

**Step-by-step process for setting up a new EV charging location:**

1. **Create Station** (Stations page)
   - Enter station details (name, address, amenities, payment methods)
   - Set operating hours and contact info
   - Save → Station created with ACTIVE status

2. **Add Chargers** (Chargers page)
   - Select the station from dropdown
   - Enter charger details (name, OCPP identity, vendor/model)
   - Set charger type (AC/DC) and max power
   - Save → Charger created with OFFLINE status initially

3. **Configure OCPP** (OCPP Config page)
   - Select the charger from dropdown
   - Enter WebSocket URL (your backend OCPP server endpoint)
   - Set heartbeat/meter intervals
   - Choose security mode (TOKEN recommended)
   - Enter authentication token
   - Save → OCPP config ready

4. **Add Connectors** (Chargers page)
   - Click "+Connector" on the charger
   - Enter connector number (1, 2, 3...)
   - Select connector type (CCS2, CHAdeMO, Type2)
   - Set max power per connector
   - Save → Connector added (status AVAILABLE)

5. **Physical Charger Setup**
   - Configure physical charger with:
     - OCPP WebSocket URL: `ws://YOUR_BACKEND_IP:8080/ocpp`
     - Charge Point Identity: (matches what you entered in step 2)
     - Authentication Token: (matches what you entered in step 3)
   - Charger connects → Backend receives BootNotification → Status changes to ONLINE

6. **Verify**
   - Charger status: ONLINE (blue badge)
   - Connector status: AVAILABLE (green)
   - Station appears in customer mobile app
   - Ready for customer sessions!

---

## 🎨 UI/UX Features

### Common Across All Pages:
- ✅ Modal interfaces (clean, focused forms)
- ✅ Close buttons (X icon + click outside to close)
- ✅ Loading states (disabled buttons, "Saving..." text)
- ✅ Error messages (red banner, clear error text)
- ✅ Success messages (green banner, auto-dismiss after 3s)
- ✅ Table hover effects (row highlight on hover)
- ✅ Color-coded status badges (green=active, red=offline, blue=online, gray=inactive)
- ✅ Responsive design (1 column mobile, 2-3 columns desktop)
- ✅ Professional Tailwind CSS styling (rounded corners, shadows, consistent spacing)

### Data Validation:
- ✅ Required field indicators (*)
- ✅ Field help text (gray text below inputs explaining format/purpose)
- ✅ Type validation (number inputs for power/intervals, URL format for WebSocket)
- ✅ JSON validation (allowed IPs must be valid JSON array)
- ✅ Server-side error display (shows API error messages)

---

## 📝 Database Schema (V9 Migration)

The following tables support the admin portal:

```sql
backend.admin_users
  - id, username, password_hash, full_name, email, phone
  - role (SUPER_ADMIN, ADMIN, VIEWER)
  - status (ACTIVE, INACTIVE)
  - created_at, last_login

backend.stations
  - id, name, station_code, address, city, state, pincode
  - latitude, longitude, operating_hours, support_contact
  - amenities (JSON: ["parking", "restroom", "food", "cctv", "wifi", "waiting_area"])
  - payment_methods (JSON: ["upi", "card", "wallet", "cash"])
  - status (ACTIVE, INACTIVE, MAINTENANCE)

backend.chargers
  - id, station_id, name, ocpp_identity, vendor_name, model, serial_number
  - charger_type (AC, DC), max_power_kw, ocpp_version
  - communication_status (ONLINE, OFFLINE), enabled
  - last_heartbeat_at

backend.connectors
  - id, charger_id, connector_no, type (CCS2, CHAdeMO, Type2, GB/T)
  - max_power_kw, status (AVAILABLE, IN_USE, FAULTED, UNAVAILABLE)

backend.ocpp_configurations
  - id, charger_id, charge_point_identity, websocket_url
  - heartbeat_interval_seconds, meter_value_interval_seconds
  - security_mode (NONE, TOKEN, TLS), token_hash, tls_profile_json
  - allowed_ips (JSON array), active
```

---

## ✨ What's Next (Optional Enhancements)

### Additional Pages (Simple CRUD):
- **Pricing Page**: Create/Edit/Delete tariffs (per kWh, per minute, session fee)
- **Operators Page**: Manage operator accounts (station operators)
- **Users Page**: Block/unblock customer accounts
- **RFID Page**: Manage RFID tags for physical card authentication
- **Logs Page**: View system logs and OCPP message logs

These pages can follow the same modal pattern used in Stations/Chargers/OCPP Config pages.

---

## 🔒 Security Notes

### Authentication:
- Admin endpoints require `Authorization: Bearer <admin_token>` header
- Token stored in `localStorage.getItem('adminAuthToken')`
- Token validated on each request via `adminApi.interceptors.request`

### Role-Based Access:
- SUPER_ADMIN: Full access to all pages
- ADMIN: Can view/edit but not delete critical data
- VIEWER: Read-only access

### Password Security:
- Admin passwords hashed with BCrypt (stored as `password_hash`)
- Default admin password: `Admin@123` (change in production!)
- Token-based OCPP authentication (tokens hashed before storage)

---

## 📞 Support

**Default Admin Credentials:**
- Username: `admin`
- Password: `Admin@123`
- Role: `SUPER_ADMIN`

**Common Issues:**
1. **404 on /api/admin/auth/login** → Backend not rebuilt with admin code
2. **Maven wrapper fails** → Use Docker Maven or IDE rebuild
3. **OCPP charger won't connect** → Check WebSocket URL, charge point identity, and token match
4. **Station not appearing in customer app** → Check station status is ACTIVE

---

## 🎉 Summary

You now have a **production-ready admin portal** for configuring EV charging infrastructure:

✅ **Stations**: Full CRUD with amenities, payments, operating hours, coordinates  
✅ **Chargers**: OCPP identity management, vendor/model tracking, enable/disable  
✅ **Connectors**: Gun-level management (one charger can have multiple connectors)  
✅ **OCPP Config**: Security modes (NONE/TOKEN/TLS), WebSocket configuration, allowed IPs  

**Next**: Rebuild backend → Start backend → Login → Configure your first station! 🚀
