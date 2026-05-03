# EV CSMS - Local Development Setup Guide

## 🚀 Quick Start

### Prerequisites
- **Docker Desktop** (for PostgreSQL database)
- **Java 17+** (for Spring Boot backend)
- **Node.js 18+** (for React frontend)
- **Git** (optional, to clone the repo)

### Option 1: Start Everything in One Go (Easiest)

#### Windows
```bash
# From project root directory:
cd scripts
start-dev.bat              # Starts: PostgreSQL, compiles backend, runs backend
# In a separate terminal:
start-frontend.bat         # Starts: React dev server
```

#### macOS/Linux
```bash
# From project root directory:
cd scripts
./start-dev.sh             # Starts: PostgreSQL, compiles backend, runs backend
# In a separate terminal:
./start-frontend.sh        # Starts: React dev server
```

**That's it!** Your full stack will be running:
- ✅ PostgreSQL on localhost:5432
- ✅ Backend API on http://localhost:8080
- ✅ Frontend on http://localhost:5173

---

### Option 2: Start Services Manually

If the above doesn't work, try starting each component separately:

#### 1. Start Database
```bash
cd infra
docker-compose up -d postgres
# Wait for "postgres is ready" message (~10 seconds)
```

#### 2. Start Backend (in new terminal)
```bash
cd backend
mvn clean package          # Compile (first time only)
mvn spring-boot:run        # Run backend
# OR directly run JAR if already compiled:
java -jar target/ev-csms-backend-0.0.1-SNAPSHOT.jar
```

#### 3. Start Frontend (in another new terminal)
```bash
cd frontend
npm install                # Install dependencies (first time only)
npm run dev                # Start dev server
```

---

## 🔗 Application URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:5173 | React app - customer & operator UI |
| **Backend API** | http://localhost:8080 | Spring Boot REST API |
| **Database Admin** | http://localhost:8081 | Adminer (DB UI, optional) |
| **Health Check** | http://localhost:8080/actuator/health | Backend status |

---

## 🧪 Default Test Credentials

### Customer Login
- **Phone**: Any valid 10-digit number
- **OTP**: `123456` (dev mode accepts this)

### Admin Portal
- **Username**: `admin` or `superadmin`
- **Password**: `admin123` or use the hashed password in database

### Operator Login
- **Mobile**: `9876543210` (Operator 1 - Anna Nagar)
- **PIN**: `123456`

Other operators:
- **Mobile**: `9876543211` (Operator 2 - OMR)
- **Mobile**: `9876543212` (Technician - Anna Nagar)
- **Mobile**: `9876543213` (Supervisor - All Stations)

---

## ⚙️ Configuration

### Database Connection
Edit these files to change DB credentials:
- `infra/docker-compose.yml` - Database password/user
- `backend/src/main/resources/application.yml` - Connection string
- `backend/src/main/resources/application-dev.properties` - Development overrides

**Current defaults** (don't change unless you update docker-compose.yml):
```
Username: evuser
Password: evpass
Database: evcsms
Host: localhost:5432
```

### Backend Port
To change backend port from 8080:
```bash
# Method 1: Environment variable
set SERVER_PORT=9000
mvn spring-boot:run

# Method 2: Edit application.yml
server:
  port: 9000
```

### Frontend Port
To change frontend port from 5173:
```bash
# Edit vite.config.ts:
export default defineConfig({
  server: {
    port: 3000
  }
})
```

---

## 🐛 Troubleshooting

### ❌ "Docker is not running"
**Solution**: Start Docker Desktop application

### ❌ "Port 5432 already in use"
Database already running. Either:
- Stop it: `docker-compose down`
- Or use a different port in docker-compose.yml and application.yml

### ❌ "Port 8080 already in use"
Another app on this port. Stop it or change backend port (see above)

### ❌ "Connection refused to database"
Database not ready yet. Wait 10 seconds and try again.

### ❌ "Failed to execute goal org.apache.maven.plugins"
Maven compilation failed. Check errors above the message:
```bash
# Solution: Clean and rebuild
cd backend
mvn clean
mvn compile
```

### ❌ "Module not found" (frontend)
Dependencies not installed:
```bash
cd frontend
npm install
npm run dev
```

### ❌ "Cannot find java"
Java not installed or not in PATH:
```bash
# Check if Java is installed:
java -version

# If not found, install JDK 17+
# macOS: brew install openjdk@17
# Windows: Download from https://adoptium.net/
```

---

## 📱 Testing the Application

### 1. Test Frontend
1. Open http://localhost:5173
2. Click "Start Charging"
3. Enter phone number and select "Register"
4. Enter OTP: `123456`

### 2. Test Operator Portal
1. Open http://localhost:5173/operator/login
2. Enter:
   - Mobile: `9876543210`
   - PIN: `123456`
3. Should see Anna Nagar station chargers

### 3. Test OCPP Simulator
1. Open `ocpp-simulator.html` in browser
2. Select charger: `VT-CHN-AN-001-FC1A`
3. Click "Connect"
4. Click "Full Session Gun 1" to simulate charging

### 4. Test Backend API
```bash
# Health check
curl http://localhost:8080/actuator/health

# Get all stations
curl http://localhost:8080/api/stations

# Authenticate operator
curl -X POST http://localhost:8080/api/operator/auth \
  -H "Content-Type: application/json" \
  -d '{
    "mobileNumber": "9876543210",
    "pin": "123456"
  }'
```

---

## 🔧 Development Workflow

### Making Backend Changes
```bash
cd backend
# Make code changes...
mvn clean compile          # Check compilation
mvn spring-boot:run        # Test locally
# Backend auto-starts when you save if using IDE with hot reload
```

### Making Frontend Changes
```bash
cd frontend
# Make code changes...
npm run dev                # Changes reload automatically
```

### Running Tests
```bash
# Backend tests
cd backend && mvn test

# Frontend tests
cd frontend && npm test
```

### Building for Production
```bash
# Backend
cd backend && mvn clean package

# Frontend
cd frontend && npm run build
# Output: dist/ folder with optimized static files
```

---

## 🗄️ Database Management

### Adminer (Web UI)
If you want a web UI for the database:
```bash
cd infra
docker-compose --profile tools up -d adminer
# Access at http://localhost:8081
# Login: Server=postgres, Username=evuser, Password=evpass, Database=evcsms
```

### Direct Database Access
```bash
# Connect with psql
psql -h localhost -U evuser -d evcsms

# Or with Docker
docker exec -it evcsms-postgres psql -U evuser -d evcsms

# View tables
\dt

# Exit
\q
```

### Resetting Database
```bash
cd infra
docker-compose down -v        # Stop and remove volumes
docker-compose up -d postgres # Start fresh
# Migrations will run automatically
```

---

## 📊 File Structure

```
ev-csms/
├── frontend/               # React/TypeScript UI
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   ├── api/           # API client
│   │   └── types/         # TypeScript types
│   ├── package.json
│   └── vite.config.ts
├── backend/               # Spring Boot API
│   ├── src/
│   │   ├── main/java/     # Java source code
│   │   └── resources/     # Config files & migrations
│   ├── pom.xml
│   └── mvnw
├── infra/                 # Docker & infrastructure
│   ├── docker-compose.yml
│   └── README.md
├── scripts/               # Startup scripts
│   ├── start-dev.bat      # Start all (Windows)
│   ├── start-dev.sh       # Start all (Mac/Linux)
│   ├── start-frontend.bat # Frontend only (Windows)
│   └── ocpp-simulator.html # OCPP charger simulator
└── README.md
```

---

## 🚀 Next Steps

After setup is complete:

1. **Explore the API**: Visit http://localhost:8080 and check available endpoints
2. **Test Operator Features**: Login as operator and start a charging session
3. **Test OCPP Protocol**: Run the simulator and start a full session
4. **Check Database**: Use Adminer or psql to view data
5. **Read Code**: Check `README.md` files in each folder for component-specific docs

---

## 💡 Tips

- **Auto-reload Backend**: Use IDE like IntelliJ with Spring Boot configuration
- **Hot Module Reload Frontend**: Front-end has HMR enabled, changes appear instantly
- **View Logs**: Backend logs printed to console, Frontend logs in browser dev console
- **Database Migrations**: Check `backend/src/main/resources/db/migration/` for schema updates
- **API Testing**: Use Postman or VS Code REST Client extension

---

## ⚠️ Common Issues

| Issue | Quick Fix |
|-------|-----------|
| Backend won't start | Check if port 8080 is free: `lsof -i :8080` (Mac/Linux) |
| Frontend blank page | Check browser console for API errors, ensure backend is running |
| Database connection fails | Wait 10 seconds for Docker to fully start, check `docker ps` |
| Authentication fails | Use test credentials above, check database is populated |
| OCPP Simulator won't connect | Ensure backend is running, check charger identity matches |

---

**Questions?** Check the main [README.md](../README.md) or inspect code in respective folders.
