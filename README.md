# ev-csms

EV Charging Station Management System (CSMS) - Full-stack application for managing electric vehicle charging stations.

**Quick Start:** See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed setup and troubleshooting.

## 🚀 Quick Start (60 seconds)

### Windows
```batch
cd scripts
start-dev.bat              # Terminal 1: Starts database + backend
# In a new terminal:
start-frontend.bat         # Terminal 2: Starts frontend
```

### macOS/Linux
```bash
cd scripts
./start-dev.sh             # Terminal 1: Starts database + backend
# In a new terminal:
./start-frontend.sh        # Terminal 2: Starts frontend
```

**Then open:** http://localhost:5173

---

## Repository Layout

- `backend/` — Spring Boot API (Java), WebSocket/OCPP, database migrations
- `frontend/` — React + TypeScript + Vite, responsive UI for customers & operators
- `infra/` — Docker Compose for PostgreSQL database
- `scripts/` — Startup scripts for easy development
- `DEVELOPMENT.md` — Comprehensive setup & troubleshooting guide

---

## Prerequisites

- **Docker Desktop** (for database) - [Download](https://www.docker.com/products/docker-desktop)
- **Java 17+** - [Download](https://adoptium.net/)
- **Node.js 18+** - [Download](https://nodejs.org/)

## 1) Local Infrastructure (Database)

Automated by startup scripts, but you can also run manually:

```bash
cd infra
docker-compose up -d postgres
```

This starts PostgreSQL on `localhost:5432` (credentials: `evuser` / `evpass`).

Optional: Start Adminer UI for database management:
```bash
docker-compose --profile tools up -d adminer
# Access at http://localhost:8081
```

## 2) Backend (Spring Boot API)

Automated by startup scripts. To run manually:

From `backend/`:

```bash
# First time only - compile:
mvn clean package -DskipTests

# Then run:
java -jar target/ev-csms-backend-0.0.1-SNAPSHOT.jar
```

Or with Maven:
```bash
mvn spring-boot:run
```

Backend runs on: **http://localhost:8080**

Health check: http://localhost:8080/actuator/health

## 3) Frontend (React/Vite)

Automated by startup scripts. To run manually:

From `frontend/`:

```bash
npm install    # First time only
npm run dev
```

Frontend runs on: **http://localhost:5173**

## Test Credentials

### Customer
- **Phone**: Any 10-digit number
- **OTP**: `123456` (dev mode)

### Operator
- **Mobile**: `9876543210` (Operator 1 - Anna Nagar)
- **PIN**: `123456`

Other operators: `9876543211`, `9876543212`, `9876543213`

### Admin Portal
- **Username**: `admin`
- **Password**: `admin123`

## 4) API Overview

Backend exposes these main endpoints:

### Sessions (`/api/sessions`)
- `POST /start` — Start a charging session
- `POST /{id}/stop` — Stop a session
- `GET /{id}` — Get session details
- `GET /{id}/live` — Get live session metrics

### Operator Auth (`/api/operator`)
- `POST /auth` — Authenticate operator with mobile + PIN
- Returns JWT with assigned stations

### Stations & Chargers (`/api/stations`)
- `GET /` — List all stations
- `GET /{id}/chargers` — Get chargers at station
- Admin endpoints for CRUD operations

### OCPP Configuration (`/api/chargers/ocpp`)
- Configure WebSocket endpoints per charger
- Manage OCPP security and heartbeat settings

## 5) Running Tests

### Backend
```bash
cd backend
mvn test                    # Run all tests
mvn -Dtest=ChargingSessionServiceTest test  # Run single test
```

### Frontend
```bash
cd frontend
npm test                    # Interactive test runner
npm run test:run           # Run once (CI-style)
```

## 6) OCPP Charger Simulator

Test OCPP protocol with the HTML simulator:

1. Open: `ocpp-simulator.html` in a browser
2. Select charger: `VT-CHN-AN-001-FC1A` (or any from dropdown)
3. Click "Connect"
4. Click "Full Session Gun 1" to simulate charging

Expected flow:
- BootNotification → StatusNotification → StartTransaction → MeterValues → StopTransaction

## Architecture

```
┌─────────────────────────────────────────────────┐
│         React Frontend (Port 5173)              │
│  • Customer mobile app UI                       │
│  • Operator dashboard                           │
│  • Admin portal                                 │
└────────────────┬────────────────────────────────┘
                 │ HTTP/REST
┌────────────────▼────────────────────────────────┐
│      Spring Boot API (Port 8080)                │
│  • Session management                           │
│  • Operator authentication                      │
│  • OCPP WebSocket server                        │
│  • Payment processing                           │
└────────────────┬────────────────────────────────┘
                 │ JDBC
┌────────────────▼────────────────────────────────┐
│     PostgreSQL Database (Port 5432)             │
│  • Stations, chargers, connectors               │
│  • Charging sessions, transactions              │
│  • Operator accounts, assignments               │
│  • OCPP configurations                          │
└─────────────────────────────────────────────────┘
```

## Project Status

✅ **Implemented**:
- Multi-station support with station management
- Station-operator assignment with role-based access control (OPERATOR, TECHNICIAN, SUPERVISOR)
- Customer authentication (phone + OTP)
-

Operator authentication & station-based access control
- Charging sessions (start/stop/billing)
- OCPP 1.6J WebSocket protocol integration
- Charger simulator for testing

🟡 **In Progress**:
- Payment integration (pre-auth, capture, refund)
- Advanced session analytics & reporting
- SMS notifications

❌ **Future**:
- Mobile app push notifications
- Fleet management features
- Advanced billing analytics

## Detailed Documentation

- **[DEVELOPMENT.md](DEVELOPMENT.md)** — Complete setup guide with troubleshooting
- **[V1_CHECKLIST.md](V1_CHECKLIST.md)** — Feature checklist and progress
- **backend/README.md** — Backend architecture and API details
- **frontend/README.md** — Frontend component documentation

## Troubleshooting

**Quick fixes for common issues:**

1. **"Port already in use"** → Change port in `application.yml` or `vite.config.ts`
2. **"Database connection refused"** → Wait 10 seconds for Docker to start
3. **"Module not found"** → Run `npm install` in frontend directory
4. **"Java not found"** → Install Java 17+ and add to PATH

See [DEVELOPMENT.md](DEVELOPMENT.md#-troubleshooting) for more detailed troubleshooting.

## File Structure

```
├── backend/                          # Spring Boot API
│   ├── src/main/java/com/evcsms/    # Java source code
│   ├── src/main/resources/
│   │   ├── application.yml          # Spring configuration
│   │   └── db/migration/            # Flyway database migrations
│   ├── pom.xml                      # Maven dependencies
│   └── mvnw                         # Maven wrapper
│
├── frontend/                         # React application
│   ├── src/
│   │   ├── pages/                  # Full-page components
│   │   ├── components/             # Reusable UI components
│   │   ├── api/                    # REST API client
│   │   ├── types/                  # TypeScript type definitions
│   │   └── utils/                  # Helper functions
│   ├── package.json
│   ├── vite.config.ts              # Vite build config
│   └── tsconfig.json
│
├── infra/                           # Infrastructure
│   └── docker-compose.yml           # Database container definition
│
├── scripts/                         # Startup scripts
│   ├── start-dev.bat               # Windows: Full stack startup
│   ├── start-dev.sh                # Unix: Full stack startup
│   ├── start-frontend.bat          # Windows: Frontend only
│   ├── start-frontend.sh           # Unix: Frontend only
│   └── ocpp-simulator.html         # OCPP charger simulator
│
├── DEVELOPMENT.md                   # Complete dev guide (read this!)
├── README.md                        # This file
└── V1_CHECKLIST.md                  # Feature completion tracking
```

## Environment Variables

### Backend
- `SPRING_DATASOURCE_URL` — PostgreSQL connection string
- `SPRING_DATASOURCE_USERNAME` — DB username (default: `evuser`)
- `SPRING_DATASOURCE_PASSWORD` — DB password (default: `evpass`)
- `SERVER_PORT` — Backend port (default: `8080`)
- `CORS_ALLOWED_ORIGINS` — Frontend URL for CORS (default: `http://localhost:5173`)

### Frontend
- `VITE_API_BASE_URL` — Backend API URL (default: `http://localhost:8080`, auto-detected)

### Razorpay Live Setup
- Backend payment config endpoint reads `razorpay.key-id` from `SPRING_APPLICATION_JSON`, `application.yml`, or process env mapping.
- Set `RAZORPAY_KEY_ID` to your live Razorpay Key ID for the backend process.
- Set `RAZORPAY_WEBHOOK_SECRET` to the live webhook secret from the Razorpay dashboard.
- For local testing only, you can keep webhook signature mocks enabled with `APP_PAYMENT_WEBHOOK_MOCK=true`.
- For live mode, disable mocks and validate real signatures with `APP_PAYMENT_WEBHOOK_MOCK=false` and `APP_PAYMENT_WEBHOOK_SKIP_SIGNATURE=false`.
- The frontend can also read `VITE_RAZORPAY_KEY_ID`; this is a fallback only when the backend config endpoint does not return a key.

### WebSocket / OCPP Link
- The frontend builds the live session websocket URL from `VITE_API_BASE_URL`.
- Example: if `VITE_API_BASE_URL=https://api.example.com`, the live session websocket becomes `wss://api.example.com/ws/sessions/{sessionId}`.
- The admin OCPP configuration page already exposes a WebSocket URL field and quick buttons for `ws://` and `wss://`.
- For charger configuration, use the backend OCPP endpoint format shown in the admin UI, for example `wss://api.example.com/ws/ocpp/1.6/{stationId}/{chargePointIdentity}`.
- In production, prefer `wss://` and make sure the backend is behind TLS.

## Building for Production

### Backend
```bash
cd backend
mvn clean package
# Output: target/ev-csms-backend-0.0.1-SNAPSHOT.jar
```

### Frontend
```bash
cd frontend
npm run build
# Output: dist/ (ready for CDN or static hosting)
```

## Contributing

1. Follow the file structure above
2. Write tests for new features
3. Run `mvn test` (backend) and `npm test` (frontend) before committing
4. Use meaningful commit messages

## License

© 2025 Veltrak EV. All rights reserved.
