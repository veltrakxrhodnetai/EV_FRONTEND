# Manual Compilation Guide

## Problem: Maven Wrapper Fails with Spaces in Username

If you see: `'C:\Users\Anto' is not recognized as an internal or external command`

This means your Windows username has a space in it, and the Maven Wrapper can't handle it properly.

## Solution 1: Use Global Maven (Recommended)

1. **Check if Maven is installed:**
   ```cmd
 mvn clean package -DskipTests
   ```

2. **If Maven is found, compile with:**
   ```cmd
   cd "C:\EV veltrak\ev-csms\backend"
   mvn clean package -DskipTests
   ```

3. **If successful, you'll see:**
   ```
   [INFO] BUILD SUCCESS
   [INFO] Total time: 30-60 seconds
   ```

4. **Then start the backend:**
   ```cmd
   cd "C:\EV veltrak\ev-csms\scripts"
   start-backend-simple.bat
   ```

## Solution 2: Install Maven Globally

If `mvn -version` fails, install Maven:

1. Download from: https://maven.apache.org/download.cgi
2. Extract to `C:\Maven` (no spaces in path!)
3. Add to PATH:
   - Search Windows for "Environment Variables"
   - Edit System PATH
   - Add: `C:\Maven\bin`
4. Restart Command Prompt
5. Run: `mvn -version` to verify

Then use Solution 1 above.

## Solution 3: Fix Maven Wrapper (Advanced)

Edit `backend\mvnw.cmd` to properly quote paths with spaces. This is complex and not recommended.

## After Successful Compilation

You'll have: `backend\target\ev-csms-backend-0.0.1-SNAPSHOT.jar`

Then run: 
```cmd
cd "C:\EV veltrak\ev-csms\scripts"
start-backend-simple.bat
```

Or start everything:
```cmd
cd "C:\EV veltrak\ev-csms\scripts"
start-dev.bat
```

## Quick Test if Maven Works

```cmd
cd "C:\EV veltrak\ev-csms\backend"
mvn --version
```

If this works, Maven is properly installed and you can use Solution 1.
