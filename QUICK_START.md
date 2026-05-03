# 🚀 EV CSMS - Quick Start Guide

## Start the Full Application (All Platforms)

### Windows Users
```batch
cd scripts
start-dev.bat              # Terminal 1: Database + Backend
# Open a NEW terminal:
start-frontend.bat         # Terminal 2: Frontend
```

### macOS / Linux Users
```bash
cd scripts
./start-dev.sh             # Terminal 1: Database + Backend
# Open a NEW terminal:
./start-frontend.sh        # Terminal 2: Frontend
```

---

## ✅ What Gets Started

| Service | URL | Port |
|---------|-----|------|
| **Frontend** | http://localhost:5173 | 5173 |
| **Backend API** | http://localhost:8080 | 8080 |
| **Database** | PostgreSQL | 5432 |
| **DB Admin UI** | http://localhost:8081 | 8081 (optional) |

---

## 🧪 Test the System (5 minutes)

### 1. Customer Sign Up
1. Open http://localhost:5173
2. Click **"Start Charging"** (any vehicle type)
3. Enter phone: `1234567890`
4. Select **"New to Veltrak"**
5. Enter OTP: `123456`
6. Select a station and charger
7. Click **"Start Session"** ✨

### 2. Operator Login & Start Session
1. Open http://localhost:5173/operator/login
2. Enter:
   - Mobile: `9876543210`
   - PIN: `123456`
3. Click **"Login"**
4. See Anna Nagar station chargers
5. Click **"Start Session"** on any charger ✨

### 3. Test OCPP Charger Simulator
1. Open `ocpp-simulator.html` in browser
2. Select charger: `VT-CHN-AN-001-FC1A`
3. Click **"Connect"** (status should turn green)
4. Click **"Full Session Gun 1"** to simulate charging
5. Watch console for OCPP messages ✨

---

## 💡 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Port already in use" | Another app is using port 5432, 8080, or 5173. Close it and retry. |
| "Docker not running" | Start Docker Desktop application. |
| "Cannot connect to database" | Wait 10 seconds for Docker to start, then refresh. |
| "Module not found" | Run `cd frontend && npm install` then retry. |
| "Java not found" | Install Java 17+ and add to system PATH. |

**More help?** Read [DEVELOPMENT.md](../DEVELOPMENT.md)

---

## 📱 Default Test Credentials

### Customer
- **Phone**: Any 10-digit number (or use `1234567890`)
- **OTP**: `123456` (dev mode)

### Operator 1 (Anna Nagar)
- **Mobile**: `9876543210`
- **PIN**: `123456`
- **Access**: Anna Nagar station chargers only

### Operator 2 (OMR)
- **Mobile**: `9876543211`
- **PIN**: `123456`
- **Access**: OMR station chargers only

### Supervisor (All Stations)
- **Mobile**: `9876543213`
- **PIN**: `123456`
- **Access**: All chargers across all stations

### Admin
- **Username**: `admin`
- **Password**: `admin123`

---

## 🌐 API Endpoints

```
GET    /api/stations                      # List stations
GET    /api/stations/{id}/chargers        # Get chargers at station
POST   /api/sessions/start                # Start charging session
POST   /api/sessions/{id}/stop            # Stop charging session
GET    /api/sessions/{id}                 # Get session details
POST   /api/operator/auth                 # Authenticate operator
POST   /api/customer/auth/verify-otp      # Authenticate customer
```

---

## 📂 Important Files

| What | Where |
|------|-------|
| Frontend settings | `frontend/src/api/axios.ts` |
| Backend settings | `backend/src/main/resources/application.yml` |
| Database setup | `backend/src/main/resources/db/migration/` |
| Test credentials | Database `backend.operator_accounts` table |

---

## 🔄 Making Changes

### Change Frontend Code
- Edit files in `frontend/src/`
- Changes reload automatically on save
- No restart needed!

### Change Backend Code
1. Edit files in `backend/src/main/java/`
2. Recompile: (stop backend, then)
   ```bash
   cd backend && mvn clean compile && mvn spring-boot:run
   ```

### Add Test Data
```bash
# Connect to database
psql -h localhost -U evuser -d evcsms -p 5432

# View operators
SELECT * FROM backend.operator_accounts;

# View stations
SELECT * FROM backend.stations;
```

---

## 📚 Full Documentation

- **Complete Guide**: [DEVELOPMENT.md](../DEVELOPMENT.md)
- **Feature Checklist**: [V1_CHECKLIST.md](../V1_CHECKLIST.md)
- **Backend Docs**: `backend/README.md` (if exists)
- **Frontend Docs**: `frontend/README.md` (if exists)

---

## ⚡ Tips

✅ **Keep terminal windows visible** — You need to see database/backend errors  
✅ **Use separate terminals** — One for backend, one for frontend  
✅ **Check browser console** — Frontend errors appear in browser DevTools (F12)  
✅ **Check backend logs** — API errors appear in backend terminal  
✅ **Port conflicts?** — Kill process: `lsof -ti:8080 | xargs kill -9` (Mac/Linux)

---

**Ready to go!** Get hacking! 🚀
