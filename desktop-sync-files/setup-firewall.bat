@echo off
echo ============================================
echo   Ocal Sync Server - Firewall Setup
echo ============================================
echo.
echo This script adds a Windows Firewall rule to allow
echo Ocal Desktop sync server (port 9876) connections
echo from mobile devices on the local network.
echo.
echo Requires administrator privileges.
echo.

:: Check if running as admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: This script must be run as Administrator.
    echo Right-click and select "Run as administrator".
    if not "%1"=="/silent" pause
    exit /b 1
)

:: Remove old rule if exists
netsh advfirewall firewall delete rule name="Ocal Sync Server" >nul 2>&1

:: Add inbound TCP rule for port 9876 on private/domain networks
netsh advfirewall firewall add rule name="Ocal Sync Server" dir=in action=allow protocol=TCP localport=9876 profile=private,domain description="Allow Ocal Browser Desktop sync server connections from mobile devices on the local network"

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] Firewall rule added successfully!
    echo Mobile devices on the same Wi-Fi can now connect to port 9876.
) else (
    echo.
    echo [ERROR] Failed to add firewall rule. Please check your permissions.
)

echo.
if not "%1"=="/silent" pause
