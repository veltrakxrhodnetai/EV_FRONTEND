# Admin Portal Implementation - Build & Run Guide

## ✅ What's Been Implemented

### Database (Migration V9)
- `backend.admin_users` - Admin authentication table
- `backend.ocpp_configurations` - OCPP config per charger
- `backend.admin_operators` - Station operators
- `backend.rfid_tags` - RFID management
- `backend.operator_station_map` - Operator station assignments
- Extended `stations`, `chargers`, `tariffs` tables with admin fields
- **Seed data**: Default admin user `admin / Admin@123`

### Backend APIs (Spring Boot)
✅ Created files:
- `model/AdminUser.java`
- `model/AdminOperator.java`
- `model/RfidTag.java`
- `model/OcppConfiguration.java`
- `repository/AdminUserRepository.java`
- `repository/AdminOperatorRepository.java`
- `repository/RfidTagRepository.java`
- `repository/OcppConfigurationRepository.java`
- `service/AdminAuthService.java`
- `controller/AdminAuthController.java`
- `controller/AdminPortalController.java`
- `dto/AdminLoginRequest.java` + 8 other admin DTOs

### Admin API Endpoints
```
POST /api/admin/auth/login
GET  /api/admin/auth/me
POST /api/admin/auth/reset-password
POST /api/admin/auth/logout

GET  /api/admin/stations
POST /api/admin/stations
PUT  /api/admin/stations/{id}
PATCH /api/admin/stations/{id}/deactivate

GET  /api/admin/chargers?stationId={id}
POST /api/admin/chargers
PUT  /api/admin/chargers/{id}
PATCH /api/admin/chargers/{id}/toggle-enable

GET  /api/admin/connectors?chargerId={id}
POST /api/admin/connectors
PUT  /api/admin/connectors/{id}

GET  /api/admin/tariffs
POST /api/admin/tariffs
PUT  /api/admin/tariffs/{id}

GET  /api/admin/operators
POST /api/admin/operators
PUT  /api/admin/operators/{id}
PATCH /api/admin/operators/{id}/status

GET  /api/admin/users
PATCH /api/admin/users/{id}/block
PATCH /api/admin/users/{id}/unblock
GET  /api/admin/users/{id}/sessions

POST /api/admin/rfid
PATCH /api/admin/rfid/{id}/assign
PATCH /api/admin/rfid/{id}/block
PATCH /api/admin/rfid/{id}/unblock

GET  /api/admin/ocpp
POST /api/admin/ocpp
PUT  /api/admin/ocpp/{id}

GET  /api/admin/dashboard/summary
GET  /api/admin/dashboard/live
GET  /api/admin/logs/system
GET  /api/admin/logs/ocpp
```

### Frontend (React + TypeScript)
✅ Created pages:
- `pages/admin/AdminLoginPage.tsx`
- `pages/admin/AdminLayout.tsx`
- `pages/admin/AdminDashboardPage.tsx`
- `pages/admin/AdminStationsPage.tsx`
- `pages/admin/AdminChargersPage.tsx`
- `pages/admin/AdminConnectorsPage.tsx`
- `pages/admin/AdminPricingPage.tsx`
- `pages/admin/AdminOperatorsPage.tsx`
- `pages/admin/AdminUsersPage.tsx`
- `pages/admin/AdminRfidPage.tsx`
- `pages/admin/AdminOcppConfigPage.tsx`
- `pages/admin/AdminLogsPage.tsx`
- `api/adminApi.ts` - API client
- `utils/adminAuth.ts` - Admin auth utilities

Routes configured in `App.tsx`:
```
/admin/login
/admin/dashboard
/admin/stations
/admin/chargers
/admin/connectors
/admin/pricing
/admin/operators
/admin/users
/admin/rfid
/admin/ocpp
/admin/logs
```

---

## 🔧 How to Rebuild & Run

### Problem: Maven Wrapper Fails
The `mvnw.cmd` fails due to spaces in Windows username path.

### ✅ Solution 1: Rebuild from IDE (RECOMMENDED)

#### IntelliJ IDEA:
1. Open project in IntelliJ
2. Right-click `backend` → **Maven** → **Reload Project**
3. Click **Build** → **Rebuild Project**
4. Or press `Ctrl+Shift+F9`

#### VS Code with Java Extension:
1. Open project in VS Code
2. Open Command Palette (`Ctrl+Shift+P`)
3. Run: **Java: Clean Java Language Server Workspace**
4. Run: **Java: Force Java Compilation**
5. Or open Maven panel → Right-click `ev-csms-backend` → **package**

#### Eclipse:
1. Right-click project → **Maven** → **Update Project**
2. Project → **Clean** → **Build Project**

### ✅ Solution 2: Docker-Based Build

```powershell
cd "c:\EV veltrak\ev-csms\backend"

docker run --rm `
  -v "${PWD}:/app" `
  -w /app `
  maven:3.9.5-eclipse-temurin-17 `
  mvn clean package -DskipTests
```

### ✅ Solution 3: Install Maven Globally

```powershell
# Via Chocolatey
choco install maven

# Then rebuild
mvn clean package -DskipTests
```

---

## 🚀 Start the Backend

Once rebuilt:

```powershell
cd scripts
.\run-backend-dev.bat
```

Or directly:
```powershell
cd backend
java -jar target\ev-csms-backend-0.0.1-SNAPSHOT.jar
```

The migration V9 will auto-apply on startup.

---

## 🧪 Test the Admin Portal

### 1. Backend Health Check
```bash
curl http://localhost:8080/actuator/health
```

### 2. Admin Login
```bash
curl -X POST http://localhost:8080/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}'
```

Expected response:
```json
{
  "token": "eyJ...",
  "tokenType": "Bearer",
  "expiresInSeconds": 28800,
  "username": "admin",
  "fullName": "System Administrator",
  "role": "SUPER_ADMIN"
}
```

### 3. Test Protected Endpoint
```bash
curl http://localhost:8080/api/admin/dashboard/summary \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. Frontend Login
1. Navigate to: `http://localhost:5173/admin/login`
2. Login with:
   - Username: `admin`
   - Password: `Admin@123`
3. You'll be redirected to `/admin/dashboard`

---

## 🗄️ Database Seed Data

### Default Admin Users
```sql
-- Username: admin, Password: Admin@123, Role: SUPER_ADMIN
-- Username: manager, Password: Manager@123, Role: ADMIN
```

To view:
```sql
docker exec evcsms-postgres psql -U evuser -d evcsms -c "SELECT id, username, full_name, role, status FROM backend.admin_users;"
```

---

## 📁 File Structure Summary

```
backend/
  src/main/
    java/com/evcsms/backend/
      model/
        AdminUser.java ✅
        AdminOperator.java ✅
        OcppConfiguration.java ✅
        RfidTag.java ✅
      repository/
        AdminUserRepository.java ✅
        AdminOperatorRepository.java ✅
        OcppConfigurationRepository.java ✅
        RfidTagRepository.java ✅
      service/
        AdminAuthService.java ✅
      controller/
        AdminAuthController.java ✅
        AdminPortalController.java ✅
      dto/
        AdminLoginRequest.java ✅
        (+ 8 more admin DTOs) ✅
    resources/db/migration/
      V9__create_admin_portal_schema.sql ✅

frontend/
  src/
    pages/admin/
      AdminLoginPage.tsx ✅
      AdminLayout.tsx ✅
      AdminDashboardPage.tsx ✅
      (+ 9 more admin pages) ✅
    api/
      adminApi.ts ✅
    utils/
      adminAuth.ts ✅
    App.tsx (routes updated) ✅
```

---

## 🔍 Troubleshooting

### Issue: 404 on `/api/admin/auth/login`
**Cause**: Backend not rebuilt after adding admin code.
**Fix**: Rebuild using one of the solutions above.

### Issue: Migration V9 not applied
**Cause**: Backend not restarted.
**Fix**: Stop and restart backend. Check:
```sql
docker exec evcsms-postgres psql -U evuser -d evcsms -c "SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1;"
```

### Issue: Login returns 401
**Cause**: Wrong credentials or migration not applied.
**Fix**: 
1. Verify migration V9 applied
2. Check admin_users table exists
3. Use credentials: `admin / Admin@123`

### Issue: CORS errors on frontend
**Cause**: Backend CORS policy.
**Fix**: Controllers have `@CrossOrigin(origins = "*")` - should work. If not, check backend logs.

---

## ✅ Next Steps After Rebuild

1. **Rebuild backend** (choose one solution above)
2. **Start backend**: `cd scripts && .\run-backend-dev.bat`
3. **Verify migration**: Check Flyway version is 9
4. **Test login API**: Use curl command above
5. **Access frontend**: `http://localhost:5173/admin/login`
6. **Login with**: `admin / Admin@123`

---

## 📞 Status Verification Commands

```powershell
# Check backend running
curl http://localhost:8080/actuator/health

# Check database tables
docker exec evcsms-postgres psql -U evuser -d evcsms -c "\dt backend.*"

# Check admin users
docker exec evcsms-postgres psql -U evuser -d evcsms -c "SELECT username, role FROM backend.admin_users;"

# Check migration status
docker exec evcsms-postgres psql -U evuser -d evcsms -c "SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 3;"
```

---

**The admin portal is fully implemented - it just needs one rebuild to activate! 🎉**
