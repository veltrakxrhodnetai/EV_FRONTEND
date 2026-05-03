#!/usr/bin/env pwsh
# Development script to run Spring Boot backend locally
# Prerequisites: 
#   - Start PostgreSQL with: cd infra; docker-compose up -d postgres
#   - Ensure Java 17+ is installed

Write-Host "Starting EV CSMS Backend in Development Mode..." -ForegroundColor Green
Write-Host ""
Write-Host "Make sure PostgreSQL is running: cd infra && docker-compose up -d postgres" -ForegroundColor Yellow
Write-Host ""

# Navigate to backend directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptDir "..\backend")

# Set development environment variables
$env:SPRING_DATASOURCE_URL = "jdbc:postgresql://localhost:5432/evcsms"
$env:SPRING_DATASOURCE_USERNAME = "evuser"
$env:SPRING_DATASOURCE_PASSWORD = "evpass"
$env:SPRING_JPA_SHOW_SQL = "true"
$env:LOG_LEVEL = "DEBUG"
$env:SQL_LOG_LEVEL = "DEBUG"
$env:CORS_ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:3000"

# OTP / MSG91 configuration
# Set these in your shell before running this script, or uncomment and fill them here.
$env:MSG91_ENABLED = "true"
$env:MSG91_AUTH_KEY = "500086Axgw0hbj69e8a5a9P1"
$env:MSG91_TEMPLATE_ID = "69e8c993b6c8931b61090803"
$env:MSG91_COUNTRY_CODE = "91"
$env:MSG91_MODE = "flow"
$env:MSG91_FLOW_OTP_VAR_NAME = "VAR1"
$env:OTP_SMS_REQUIRED = "true"
$env:OTP_ALLOW_DEV_TEST = "false"

if (-not $env:MSG91_AUTH_KEY) {
	Write-Host "WARNING: MSG91_AUTH_KEY is not set. OTP SMS requests will fail with 502." -ForegroundColor Red
}

if (-not $env:MSG91_TEMPLATE_ID) {
	Write-Host "WARNING: MSG91_TEMPLATE_ID is not set. OTP SMS requests will fail with 502." -ForegroundColor Red
}

Write-Host "Running Spring Boot from JAR..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: If you make code changes, rebuild with: cd backend && mvn clean package" -ForegroundColor Yellow
Write-Host ""

# Run the compiled JAR directly
java -jar "$PSScriptRoot\..\backend\target\ev-csms-backend-0.0.1-SNAPSHOT.jar"

# If JAR doesn't exist, run: cd backend && mvn clean package
