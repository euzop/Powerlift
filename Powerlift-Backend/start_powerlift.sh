#!/bin/bash
# PowerLift Frontend & Backend Startup Script
# This script starts both the backend with auto-retraining and the frontend

echo "🚀 PowerLift System Startup"
echo "=========================="

# Check if we're in the right directory
if [ ! -f "run_api.py" ]; then
    echo "❌ Please run this script from the Powerlift-Backend directory"
    exit 1
fi

# Function to check if a port is available
check_port() {
    if netstat -tuln | grep ":$1 " > /dev/null; then
        return 1
    else
        return 0
    fi
}

# Start backend with auto-retraining
echo "🔧 Starting PowerLift Backend..."
echo "   - Auto MCSVM retraining enabled"
echo "   - Checking for user feedback updates"
echo "   - API will be available on http://localhost:5000"

# Check if port 5000 is available
if ! check_port 5000; then
    echo "⚠️  Port 5000 is already in use. Backend may already be running."
    echo "   Please stop the existing backend or use a different port."
    read -p "Continue anyway? (y/N): " confirm
    if [[ $confirm != [yY] ]]; then
        exit 1
    fi
fi

# Start backend in background
python run_api.py &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 5

# Check if backend started successfully
if ps -p $BACKEND_PID > /dev/null; then
    echo "✅ Backend started successfully (PID: $BACKEND_PID)"
else
    echo "❌ Backend failed to start"
    exit 1
fi

# Check if frontend directory exists
FRONTEND_DIR="../Powerlift-Frontend"
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "❌ Frontend directory not found: $FRONTEND_DIR"
    echo "   Please ensure the frontend is in the correct location"
    kill $BACKEND_PID
    exit 1
fi

# Start frontend
echo ""
echo "📱 Starting PowerLift Frontend..."
echo "   - React Native Expo development server"
echo "   - Will be available on Expo DevTools"

cd "$FRONTEND_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Start Expo development server
echo "🚀 Starting Expo development server..."
npx expo start &
FRONTEND_PID=$!

# Display status
echo ""
echo "🎉 PowerLift System Started Successfully!"
echo "========================================"
echo "📊 Backend:"
echo "   - API Server: http://localhost:5000"
echo "   - MCSVM Auto-retraining: Enabled"
echo "   - Process ID: $BACKEND_PID"
echo ""
echo "📱 Frontend:"
echo "   - Expo DevTools: Check terminal output above"
echo "   - Process ID: $FRONTEND_PID"
echo ""
echo "🔧 Features Active:"
echo "   ✅ Pose detection and analysis"
echo "   ✅ Form scoring and feedback"
echo "   ✅ User feedback collection"
echo "   ✅ Automatic model retraining"
echo "   ✅ Real-time video processing"
echo ""
echo "💡 Usage:"
echo "   1. Scan QR code in Expo DevTools with Expo Go app"
echo "   2. Record exercise videos in the mobile app"
echo "   3. Provide feedback to improve AI accuracy"
echo "   4. Models will auto-update based on feedback"
echo ""
echo "🛑 To stop both services, press Ctrl+C"

# Wait for user interrupt
trap 'echo ""; echo "🛑 Shutting down PowerLift System..."; kill $BACKEND_PID $FRONTEND_PID; echo "✅ System stopped"; exit 0' INT

# Keep script running
wait
