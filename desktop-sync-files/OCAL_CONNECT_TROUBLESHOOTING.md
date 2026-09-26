# Ocal Connect - Sync Troubleshooting Guide

## Architecture Overview

```
┌─────────────────────┐         Wi-Fi / LAN          ┌──────────────────────┐
│  Ocal Desktop       │  ◄── HTTP (port 9876) ──►    │  Ocal Mobile         │
│  (Electron/Node.js) │                               │  (Capacitor/Android) │
│                     │                               │                      │
│  syncServer.js      │  ◄── SSE (real-time) ──       │  SyncClient.js       │
│  qrGenerator.js     │      POST (sync data) ──►    │  QrScanner.js        │
└─────────────────────┘                               └──────────────────────┘
```

- **Desktop** runs a Node.js HTTP server on `0.0.0.0:9876`
- **Mobile** connects via `fetch()` HTTP requests and listens via SSE (Server-Sent Events)
- Pairing uses a 6-digit PIN + token, exchanged via QR code or manual entry

---

## Common Issues & Fixes

### 1. "Cannot reach desktop" / Connection Timeout

**Symptoms:** Mobile shows "Cannot reach desktop at http://x.x.x.x:9876"

**Fixes:**
1. **Same Wi-Fi**: Both devices MUST be on the exact same Wi-Fi network
2. **Firewall**: Run `desktop-sync-files/setup-firewall.bat` as Administrator
3. **VPN**: Disable any VPN on both devices
4. **Desktop server running**: Ensure Ocal Desktop is open and the sync server started
   - Check: Open `http://YOUR_IP:9876/api/info` in a browser on the PC. You should see JSON.
5. **Correct IP**: The IP shown in Settings → Ocal Connect should be your LAN IP (192.168.x.x or 10.x.x.x)

### 2. "Authentication failed" / Wrong PIN

**Symptoms:** Mobile gets HTTP 401 error

**Fixes:**
1. The PIN regenerates every time the desktop server restarts
2. Make sure you're using the **current** PIN shown on the desktop screen
3. The token in the QR code is also single-use per session

### 3. Mixed Content / Fetch Blocked

**Symptoms:** `fetch()` silently fails, no network request visible

**Root Cause:** Capacitor's `androidScheme` was set to `https`, blocking HTTP requests.

**Fix Applied:** Changed `capacitor.config.json` → `androidScheme: "http"`

If issue recurs:
```json
// capacitor.config.json
{
  "server": {
    "androidScheme": "http",  // NOT "https"
    "cleartext": true,
    "allowNavigation": ["*"]
  }
}
```

Then rebuild: `npm run build && npx cap sync android`

### 4. QR Scanner Not Working

**Symptoms:** Camera opens but never detects the QR code

**Fixes:**
1. Ensure good lighting on the QR code
2. Hold phone steady, ~6-10 inches from screen
3. The QR must contain valid JSON with `host`, `port`, `pin` fields
4. Fallback: Use manual IP + PIN entry instead

### 5. SSE Stream Disconnects

**Symptoms:** Real-time push (tabs, clipboard) stops working after some time

**Explanation:** Mobile may lose SSE connection when app goes to background. The client auto-reconnects after 5 seconds.

---

## Key Files

| File | Location | Purpose |
|------|----------|---------|
| `syncServer.js` | Desktop: `Brower/syncServer.js` | HTTP + SSE server (Node.js) |
| `qrGenerator.js` | Desktop: `Brower/qrGenerator.js` | Pure JS QR code SVG generator |
| `SyncClient.js` | Mobile: `src/utils/SyncClient.js` | HTTP client + SSE consumer |
| `QrScanner.js` | Mobile: `src/utils/QrScanner.js` | Camera-based QR code reader |
| `InternalPages.js` | Mobile: `src/components/InternalPages.js` | Sync page UI (renderSync) |
| `capacitor.config.json` | Mobile root | Capacitor settings (scheme, cleartext) |
| `AndroidManifest.xml` | `android/app/src/main/` | Permissions, cleartext, network config |
| `network_security_config.xml` | `android/.../res/xml/` | Android network security policy |

## API Endpoints (Desktop Server)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/info` | Server status, IP, PIN, paired device |
| `GET` | `/api/events` | SSE stream (real-time push to mobile) |
| `POST` | `/api/pair` | Pair with PIN/token → returns sessionKey |
| `POST` | `/api/send-tab` | Mobile sends tab URL to desktop |
| `POST` | `/api/clipboard` | Bidirectional clipboard sharing |
| `POST` | `/api/sync/bookmarks` | Merge bookmarks between devices |
| `POST` | `/api/sync/passwords` | Merge password vault |
| `POST` | `/api/sync/history` | Merge browsing history |
| `POST` | `/api/unpair` | Disconnect device, regenerate PIN |

## Rebuild Steps

```bash
# 1. Build the web assets
cd "C:\Project\Gaming Network\Software\Ocal App"
npm run build

# 2. Sync to Android
npx cap sync android

# 3. Open in Android Studio & run
npx cap open android

# 4. For desktop, restart Electron
cd "C:\Project\Gaming Network\Software\Brower"
npm start
```

## Firewall Setup (Windows)

Run as Administrator:
```
desktop-sync-files\setup-firewall.bat
```

Or manually:
```powershell
netsh advfirewall firewall add rule name="Ocal Sync Server" dir=in action=allow protocol=TCP localport=9876 profile=private,domain
```
