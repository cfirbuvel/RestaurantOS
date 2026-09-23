# RestaurantOS — Master 1-Click Multi-Surface Test Launcher
# Boots all surfaces simultaneously: Next.js Web/API, Manager Mobile, Driver Mobile, and KDS

param(
    [ValidateSet("emulator", "web", "qr")]
    [string]$MobileTarget = "web",
    
    [switch]$WithSimulator
)

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   🚀 RestaurantOS — Full Omnichannel System Bootstrapper" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "Target: Next.js Web (port 3000) + Manager Android + Driver Android" -ForegroundColor Gray
Write-Host "Mobile Mode: $MobileTarget" -ForegroundColor Yellow
Write-Host ""

$root = $PSScriptRoot + "\.."

# 1. Start Next.js Web & API Server
Write-Host "▶ Starting Next.js Web Management & API on http://localhost:3000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; npm run dev"

Start-Sleep -Seconds 3

# 2. Start Restaurant Manager Mobile App
Write-Host "▶ Starting Manager Android App (apps/manager-android) ..." -ForegroundColor Green
if ($MobileTarget -eq "emulator") {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\manager-android'; npx expo start --android"
} elseif ($MobileTarget -eq "web") {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\manager-android'; npx expo start --web --port 8081"
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\manager-android'; npx expo start"
}

# 3. Start Driver Android App
Write-Host "▶ Starting Driver Android App (apps/driver-android) ..." -ForegroundColor Green
if ($MobileTarget -eq "emulator") {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\driver-android'; npx expo start --android"
} elseif ($MobileTarget -eq "web") {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\driver-android'; npx expo start --web --port 8082"
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\driver-android'; npx expo start"
}

Write-Host ""
Write-Host "✅ All platform surfaces launched!" -ForegroundColor Green
Write-Host "------------------------------------------------------------------" -ForegroundColor Gray
Write-Host " 🌐 Web Management:      http://localhost:3000" -ForegroundColor Cyan
Write-Host " 🍳 Kitchen KDS Station:  http://localhost:3000/kds/branch_dizengoff" -ForegroundColor Cyan
Write-Host " 📱 Manager App (Web):    http://localhost:8081" -ForegroundColor Cyan
Write-Host " 🚗 Driver App (Web):     http://localhost:8082" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------------" -ForegroundColor Gray
Write-Host ""

if ($WithSimulator) {
    Write-Host "▶ Launching Live Real-Time Simulator in 4 seconds..." -ForegroundColor Magenta
    Start-Sleep -Seconds 4
    npm run simulate:live
} else {
    Write-Host "To run live simulation at any time:" -ForegroundColor Yellow
    Write-Host "  npm run simulate:live" -ForegroundColor White
}
