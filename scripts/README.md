# Scripts Directory - Quick Reference

## 🚀 Recommended Startup (Windows)

### Option 1: All-in-One (Easiest)
```batch
start-dev.bat
```
Starts: Database + compiles backend (if needed) + runs backend

### Option 2: Two-Step (If Option 1 fails)
```batch
# Step 1: Compile backend (run once)
compile-backend.bat

# Step 2: Start everything
start-backend-simple.bat
```

### Option 3: Manual Control
```batch
# Terminal 1: Start database only
cd ..\infra
docker-compose up -d postgres

# Terminal 2: Compile (if needed)
cd ..\backend
mvnw.cmd clean package -DskipTests

# Terminal 3: Run backend
cd ..\backend
java -jar target\ev-csms-backend-0.0.1-SNAPSHOT.jar
```

---

## 🎨 Frontend (Run in separate terminal)

```batch
start-frontend.bat
```

Or manually:
```batch
cd ..\frontend
npm install          # First time only
npm run dev
```

---

## 📝 Script Descriptions

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `start-dev.bat` | Full stack startup (DB + backend) | **First choice** - easiest option |
| `compile-backend.bat` | Compile backend only | When you make code changes |
| `start-backend-simple.bat` | Start DB + backend (no compile) | If start-dev.bat fails |
| `start-frontend.bat` | Start React dev server | Always (in separate terminal) |
| `run-backend-dev.bat` | Old script (deprecated) | Don't use - use start-dev.bat instead |

---

## 🐛 Troubleshooting

### "... was unexpected at this time"
**Cause**: Batch script syntax issue  
**Fix**: Use Option 2 above (compile-backend.bat then start-backend-simple.bat)

### "mvn: command not found"
**Cause**: Maven not in PATH  
**Fix**: Use `mvnw.cmd` instead (Maven Wrapper, included in project)

### "Port 8080 already in use"
**Fix**: Stop the existing process or kill it:
```batch
netstat -ano | findstr :8080
taskkill /F /PID <pid_number>
```

### "Cannot connect to database"
**Fix**: 
1. Check Docker is running: `docker ps`
2. Start database: `cd ..\infra && docker-compose up -d postgres`
3. Wait 10 seconds and retry

### "JAR not found"
**Fix**: Run `compile-backend.bat` first

---

## ⚡ Quick Commands

```batch
# See what's running
docker ps

# Stop database
cd ..\infra && docker-compose down

# Restart database
cd ..\infra && docker-compose restart postgres

# View database logs
cd ..\infra && docker-compose logs -f postgres

# Clean rebuild backend
cd ..\backend && mvnw.cmd clean && mvnw.cmd package -DskipTests
```

---

## 🔗 URLs After Startup

- Frontend: http://localhost:5173
- Backend API: http://localhost:8080
- Database: localhost:5432
- DB Admin UI: http://localhost:8081 (if started with --profile tools)

---

**Need more help?** See [../DEVELOPMENT.md](../DEVELOPMENT.md) for detailed troubleshooting.
