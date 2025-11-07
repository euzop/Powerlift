# PowerLift Frontend & Backend Startup Script (Windows PowerShell)
# This script starts both the backend with auto-retraining and the frontend

Write-Host "🚀 PowerLift System Startup" -ForegroundColor Green
Write-Host "==========================" -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "run_api.py")) {
    Write-Host "❌ Please run this script from the Powerlift-Backend directory" -ForegroundColor Red
    exit 1
}

# Function to check if a port is available
function Test-Port {
    param([int]$Port)
    try {
        $listener = [System.Net.Sockets.TcpListener]$Port
        $listener.Start()
        $listener.Stop()
        return $true
    }
    catch {
        return $false
    }
}

# Start backend with auto-retraining
Write-Host "🔧 Starting PowerLift Backend..." -ForegroundColor Cyan
Write-Host "   - Auto MCSVM retraining enabled" -ForegroundColor Gray
Write-Host "   - Checking for user feedback updates" -ForegroundColor Gray
Write-Host "   - API will be available on http://localhost:5000" -ForegroundColor Gray

# Check if port 5000 is available
if (-not (Test-Port 5000)) {
    Write-Host "⚠️  Port 5000 is already in use. Backend may already be running." -ForegroundColor Yellow
    Write-Host "   Please stop the existing backend or use a different port." -ForegroundColor Yellow
    $confirm = Read-Host "Continue anyway? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        exit 1
    }
}

# Start backend in background
Write-Host "⏳ Starting backend process..." -ForegroundColor Yellow
$backendProcess = Start-Process -FilePath "python" -ArgumentList "run_api.py" -PassThru -WindowStyle Hidden

# Wait for backend to start
Write-Host "⏳ Waiting for backend to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# Check if backend started successfully
if ($backendProcess.HasExited) {
    Write-Host "❌ Backend failed to start" -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ Backend started successfully (PID: $($backendProcess.Id))" -ForegroundColor Green
}

# Check if frontend directory exists
$frontendDir = "../Powerlift-Frontend"
if (-not (Test-Path $frontendDir)) {
    Write-Host "❌ Frontend directory not found: $frontendDir" -ForegroundColor Red
    Write-Host "   Please ensure the frontend is in the correct location" -ForegroundColor Red
    Stop-Process -Id $backendProcess.Id -Force
    exit 1
}

# Start frontend
Write-Host ""
Write-Host "📱 Starting PowerLift Frontend..." -ForegroundColor Cyan
Write-Host "   - React Native Expo development server" -ForegroundColor Gray
Write-Host "   - Will be available on Expo DevTools" -ForegroundColor Gray

Set-Location $frontendDir

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Yellow
    npm install
}

# Start Expo development server
Write-Host "🚀 Starting Expo development server..." -ForegroundColor Yellow
$frontendProcess = Start-Process -FilePath "npx" -ArgumentList "expo", "start" -PassThru

# Display status
Write-Host ""
Write-Host "🎉 PowerLift System Started Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "📊 Backend:" -ForegroundColor Cyan
Write-Host "   - API Server: http://localhost:5000" -ForegroundColor Gray
Write-Host "   - MCSVM Auto-retraining: Enabled" -ForegroundColor Gray
Write-Host "   - Process ID: $($backendProcess.Id)" -ForegroundColor Gray
Write-Host ""
Write-Host "📱 Frontend:" -ForegroundColor Cyan
Write-Host "   - Expo DevTools: Check terminal output above" -ForegroundColor Gray
Write-Host "   - Process ID: $($frontendProcess.Id)" -ForegroundColor Gray
Write-Host ""
Write-Host "🔧 Features Active:" -ForegroundColor Cyan
Write-Host "   ✅ Pose detection and analysis" -ForegroundColor Green
Write-Host "   ✅ Form scoring and feedback" -ForegroundColor Green
Write-Host "   ✅ User feedback collection" -ForegroundColor Green
Write-Host "   ✅ Automatic model retraining" -ForegroundColor Green
Write-Host "   ✅ Real-time video processing" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Usage:" -ForegroundColor Cyan
Write-Host "   1. Scan QR code in Expo DevTools with Expo Go app" -ForegroundColor Gray
Write-Host "   2. Record exercise videos in the mobile app" -ForegroundColor Gray
Write-Host "   3. Provide feedback to improve AI accuracy" -ForegroundColor Gray
Write-Host "   4. Models will auto-update based on feedback" -ForegroundColor Gray
Write-Host ""
Write-Host "🛑 To stop both services, press Ctrl+C" -ForegroundColor Red

# Cleanup function
function Stop-PowerLiftSystem {
    Write-Host ""
    Write-Host "🛑 Shutting down PowerLift System..." -ForegroundColor Yellow
    
    try {
        if (-not $backendProcess.HasExited) {
            Stop-Process -Id $backendProcess.Id -Force
            Write-Host "✅ Backend stopped" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️  Could not stop backend process" -ForegroundColor Yellow
    }
    
    try {
        if (-not $frontendProcess.HasExited) {
            Stop-Process -Id $frontendProcess.Id -Force
            Write-Host "✅ Frontend stopped" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️  Could not stop frontend process" -ForegroundColor Yellow
    }
    
    Write-Host "✅ System stopped" -ForegroundColor Green
    exit 0
}

# Set up Ctrl+C handler
try {
    # Keep script running and wait for Ctrl+C
    while ($true) {
        Start-Sleep -Seconds 1
        
        # Check if processes are still running
        if ($backendProcess.HasExited) {
            Write-Host "❌ Backend process has stopped unexpectedly" -ForegroundColor Red
            break
        }
        if ($frontendProcess.HasExited) {
            Write-Host "❌ Frontend process has stopped unexpectedly" -ForegroundColor Red
            break
        }
    }
} finally {
    Stop-PowerLiftSystem
}
