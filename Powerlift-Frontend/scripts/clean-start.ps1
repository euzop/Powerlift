# PowerShell script to clean start Expo development
Write-Host "Cleaning Expo processes and cache..." -ForegroundColor Green

# Kill any existing Expo/Metro processes
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*expo*" -or $_.CommandLine -like "*metro*" } | Stop-Process -Force
Get-Process -Name "expo" -ErrorAction SilentlyContinue | Stop-Process -Force

# Clear npm and Expo cache
Write-Host "Clearing caches..." -ForegroundColor Yellow
npm cache clean --force
npx expo install --fix

# Clear React Native cache
if (Test-Path "$env:LOCALAPPDATA\Temp\metro-*") {
    Remove-Item "$env:LOCALAPPDATA\Temp\metro-*" -Recurse -Force
}

# Clear node_modules and reinstall if needed
if ($args[0] -eq "--reset") {
    Write-Host "Resetting node_modules..." -ForegroundColor Red
    Remove-Item "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item "package-lock.json" -Force -ErrorAction SilentlyContinue
    npm install
}

Write-Host "Starting Expo with cleared cache..." -ForegroundColor Green
npx expo start --clear --port 8082
