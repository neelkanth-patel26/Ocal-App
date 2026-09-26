/**
 * Ocal Sync & Device Connect Server (Pure Node.js)
 * Runs inside Ocal Desktop (Electron main process)
 * Handles local network device pairing, SSE real-time events,
 * clipboard sharing, tab pushing, and bookmarks/passwords/history sync.
 * Supports persistent device pairing sessions and automatic firewall configuration.
 */

const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec, spawn } = require('child_process');
const { generateQrSvg } = require('./qrGenerator.js');

class OcalSyncServer {
    constructor(callbacks = {}) {
        this.callbacks = Object.assign({
            getBookmarks: () => [],
            setBookmarks: () => {},
            getHistory: () => [],
            setHistory: () => {},
            getPasswords: () => [],
            setPasswords: () => {},
            onReceiveTab: () => {},
            onReceiveClipboard: () => {},
            getClipboardText: () => '',
            setClipboardText: () => {},
            onDevicePaired: () => {},
            onDeviceUnpaired: () => {}
        }, callbacks);

        this.port = 9876;
        this.activeSseClients = new Set();
        this.server = null;
        this.isRunning = false;
        this.pingInterval = null;
        this.sessionsFile = path.join(__dirname, 'ocal-sync-sessions.json');

        // Load persistent sessions & PIN
        this._loadPersistentData();

        // Check and configure Windows firewall rule in background
        this.ensureFirewallRule().catch(() => {});
    }

    _loadPersistentData() {
        try {
            if (fs.existsSync(this.sessionsFile)) {
                const data = JSON.parse(fs.readFileSync(this.sessionsFile, 'utf8'));
                this.pairingPin = data.pairingPin || this._generatePin();
                this.pairingToken = data.pairingToken || crypto.randomBytes(8).toString('hex');
                this.sessions = data.sessions || {};
                this.pairedDevice = data.lastPairedDevice || null;
                // If there was a paired device, find its sessionKey
                const keys = Object.keys(this.sessions);
                this.sessionKey = keys.length > 0 ? keys[keys.length - 1] : '';
                return;
            }
        } catch (e) {
            console.warn('[OcalSyncServer] Error loading persistent sessions:', e);
        }

        this.pairingPin = this._generatePin();
        this.pairingToken = crypto.randomBytes(8).toString('hex');
        this.sessions = {};
        this.sessionKey = '';
        this.pairedDevice = null;
        this._savePersistentData();
    }

    _savePersistentData() {
        try {
            const data = {
                pairingPin: this.pairingPin,
                pairingToken: this.pairingToken,
                sessions: this.sessions,
                lastPairedDevice: this.pairedDevice,
                savedAt: Date.now()
            };
            fs.writeFileSync(this.sessionsFile, JSON.stringify(data, null, 2), 'utf8');
        } catch (e) {
            console.warn('[OcalSyncServer] Error saving persistent sessions:', e);
        }
    }

    _generatePin() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    regeneratePin() {
        this.pairingPin = this._generatePin();
        this.pairingToken = crypto.randomBytes(8).toString('hex');
        this._savePersistentData();
        // Also trigger firewall check when user explicitly regenerates PIN / QR
        this.ensureFirewallRule(true).catch(() => {});
        return this.getStatus();
    }

    async ensureFirewallRule(forcePrompt = false) {
        if (process.platform !== 'win32') return true;

        return new Promise((resolve) => {
            // First check if rule already exists
            exec('netsh advfirewall firewall show rule name="Ocal Sync Server"', (err, stdout) => {
                const exists = !err && stdout && stdout.includes('Ocal Sync Server') && !stdout.includes('No rules match');
                if (exists && !forcePrompt) {
                    return resolve(true);
                }

                // If rule doesn't exist or force requested, run setup-firewall.bat with elevation
                const batPath = path.join(__dirname, 'setup-firewall.bat');
                if (fs.existsSync(batPath)) {
                    console.log('[OcalSyncServer] Launching firewall setup with elevation...');
                    const psCmd = `Start-Process -FilePath "cmd.exe" -ArgumentList '/c', '""${batPath}""' -Verb RunAs -WindowStyle Hidden`;
                    exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCmd}"`, (psErr) => {
                        if (psErr) {
                            console.warn('[OcalSyncServer] Firewall elevation prompt closed or failed:', psErr.message);
                        } else {
                            console.log('[OcalSyncServer] Firewall rule added successfully.');
                        }
                        resolve(!psErr);
                    });
                } else {
                    resolve(false);
                }
            });
        });
    }

    getLanIp() {
        const interfaces = os.networkInterfaces();
        const preferredIps = [];
        const fallbackIps = [];

        for (const name of Object.keys(interfaces)) {
            for (const net of interfaces[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    if (net.address.startsWith('192.168.') || net.address.startsWith('10.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(net.address)) {
                        preferredIps.push(net.address);
                    } else {
                        fallbackIps.push(net.address);
                    }
                }
            }
        }

        return preferredIps[0] || fallbackIps[0] || '127.0.0.1';
    }

    getPairingPayload() {
        return {
            v: 1,
            type: 'ocal-sync',
            host: this.getLanIp(),
            port: this.port,
            pin: this.pairingPin,
            token: this.pairingToken,
            name: `${os.hostname()} (Windows)`
        };
    }

    getQrSvg(size = 230) {
        try {
            const payloadStr = JSON.stringify(this.getPairingPayload());
            return generateQrSvg(payloadStr, size);
        } catch (e) {
            console.error('[OcalSyncServer] Error generating QR code:', e);
            return '<svg></svg>';
        }
    }

    getStatus() {
        return {
            running: this.isRunning,
            host: this.getLanIp(),
            port: this.port,
            pin: this.pairingPin,
            token: this.pairingToken,
            deviceName: `${os.hostname()} (Windows)`,
            paired: !!this.pairedDevice,
            pairedDevice: this.pairedDevice,
            qrSvg: this.getQrSvg()
        };
    }

    start(desiredPort = 9876) {
        if (this.isRunning && this.server) {
            return Promise.resolve(this.getStatus());
        }

        this.port = desiredPort;

        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => this._handleRequest(req, res));

            this.server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    console.warn(`[OcalSyncServer] Port ${this.port} is in use, trying ${this.port + 1}...`);
                    this.port++;
                    this.server.listen(this.port, '0.0.0.0');
                } else {
                    console.error('[OcalSyncServer] Server error:', err);
                    reject(err);
                }
            });

            this.server.listen(this.port, '0.0.0.0', () => {
                this.isRunning = true;
                console.log(`[OcalSyncServer] Server active on http://${this.getLanIp()}:${this.port} (PIN: ${this.pairingPin})`);

                // Start SSE keepalive ping every 15s
                this.pingInterval = setInterval(() => {
                    this._broadcastSse({ type: 'ping', timestamp: Date.now() });
                }, 15000);

                resolve(this.getStatus());
            });
        });
    }

    stop() {
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.activeSseClients.forEach(res => {
            try { res.end(); } catch (e) {}
        });
        this.activeSseClients.clear();

        if (this.server) {
            this.server.close();
            this.server = null;
        }
        this.isRunning = false;
        console.log('[OcalSyncServer] Server stopped');
    }

    unpairDevice() {
        this.sessions = {};
        this.pairedDevice = null;
        this.sessionKey = '';
        this._savePersistentData();

        this._broadcastSse({
            type: 'unpaired',
            timestamp: Date.now()
        });

        if (typeof this.callbacks.onDeviceUnpaired === 'function') {
            this.callbacks.onDeviceUnpaired();
        }

        return this.getStatus();
    }

    // Broadcast SSE event to all connected mobile clients
    _broadcastSse(data) {
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        this.activeSseClients.forEach(res => {
            try {
                res.write(payload);
            } catch (e) {
                this.activeSseClients.delete(res);
            }
        });
    }

    // Push tab to mobile
    sendTabToMobile(url, title = '') {
        if (!url) return false;
        this._broadcastSse({
            type: 'open_tab',
            url,
            title: title || url,
            timestamp: Date.now()
        });
        return true;
    }

    // Push clipboard to mobile
    sendClipboardToMobile(text) {
        if (!text) return false;
        this._broadcastSse({
            type: 'clipboard',
            text,
            timestamp: Date.now()
        });
        return true;
    }

    // Trigger full sync from mobile
    requestSyncFromMobile() {
        this._broadcastSse({
            type: 'sync_requested',
            timestamp: Date.now()
        });
        return true;
    }

    // Request handler
    _handleRequest(req, res) {
        // Universal CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Ocal-Token, X-Ocal-Session');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            return res.end();
        }

        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = parsedUrl.pathname;

        // Route: Status & Info
        if (pathname === '/api/info' && req.method === 'GET') {
            return this._sendJson(res, 200, this.getStatus());
        }

        // Route: Server-Sent Events (SSE) Stream
        if (pathname === '/api/events' && req.method === 'GET') {
            const querySessionKey = parsedUrl.searchParams.get('sessionKey');
            if (querySessionKey && this.sessions[querySessionKey]) {
                this.pairedDevice = this.sessions[querySessionKey];
                this.pairedDevice.lastSeen = Date.now();
                this.sessionKey = querySessionKey;
                this._savePersistentData();
            }

            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });
            res.write(`data: ${JSON.stringify({ type: 'connected', server: `${os.hostname()} (Windows)`, timestamp: Date.now() })}\n\n`);

            this.activeSseClients.add(res);

            // Notify desktop that mobile is actively connected
            if (this.pairedDevice) {
                this._broadcastSse({
                    type: 'paired',
                    device: this.pairedDevice,
                    timestamp: Date.now()
                });
                if (typeof this.callbacks.onDevicePaired === 'function') {
                    this.callbacks.onDevicePaired(this.pairedDevice);
                }
            }

            req.on('close', () => {
                this.activeSseClients.delete(res);
            });
            return;
        }

        // Read JSON body for POST endpoints
        if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', () => {
                let data = {};
                try {
                    data = bodyStr ? JSON.parse(bodyStr) : {};
                } catch (e) {
                    return this._sendJson(res, 400, { success: false, error: 'Invalid JSON body' });
                }

                this._handlePostRoute(pathname, data, req, res);
            });
            return;
        }

        return this._sendJson(res, 404, { success: false, error: 'Not Found' });
    }

    _handlePostRoute(pathname, data, req, res) {
        // 1. Device Pairing Endpoint
        if (pathname === '/api/pair') {
            const pinMatches = data.pin && String(data.pin).trim() === String(this.pairingPin).trim();
            const tokenMatches = data.token && String(data.token).trim() === String(this.pairingToken).trim();

            if (!pinMatches && !tokenMatches) {
                return this._sendJson(res, 401, {
                    success: false,
                    error: 'Authentication failed. Incorrect 6-digit PIN or token.'
                });
            }

            this.sessionKey = crypto.randomBytes(16).toString('hex');
            this.pairedDevice = {
                name: data.deviceName || 'Ocal Mobile Browser',
                ip: req.socket.remoteAddress || '',
                connectedAt: Date.now(),
                lastSeen: Date.now()
            };

            // Store in persistent sessions map
            this.sessions[this.sessionKey] = this.pairedDevice;
            this._savePersistentData();

            console.log(`[OcalSyncServer] Device paired successfully: ${this.pairedDevice.name} (${this.pairedDevice.ip})`);

            // Notify SSE clients & callbacks
            this._broadcastSse({
                type: 'paired',
                device: this.pairedDevice,
                timestamp: Date.now()
            });

            if (typeof this.callbacks.onDevicePaired === 'function') {
                this.callbacks.onDevicePaired(this.pairedDevice);
            }

            return this._sendJson(res, 200, {
                success: true,
                sessionKey: this.sessionKey,
                desktopName: `${os.hostname()} (Windows)`
            });
        }

        // 1b. Seamless Reconnect Endpoint (when mobile app restarts or wakes up)
        if (pathname === '/api/reconnect') {
            const sKey = data.sessionKey;
            if (sKey && this.sessions[sKey]) {
                this.pairedDevice = this.sessions[sKey];
                this.pairedDevice.lastSeen = Date.now();
                if (data.deviceName) this.pairedDevice.name = data.deviceName;
                this.sessionKey = sKey;
                this._savePersistentData();

                this._broadcastSse({
                    type: 'paired',
                    device: this.pairedDevice,
                    timestamp: Date.now()
                });

                if (typeof this.callbacks.onDevicePaired === 'function') {
                    this.callbacks.onDevicePaired(this.pairedDevice);
                }

                return this._sendJson(res, 200, {
                    success: true,
                    reconnected: true,
                    desktopName: `${os.hostname()} (Windows)`
                });
            } else {
                return this._sendJson(res, 401, {
                    success: false,
                    error: 'Session expired or not found. Please pair again via QR code.'
                });
            }
        }

        // 1c. Trigger Firewall Setup manually from Desktop or Mobile
        if (pathname === '/api/firewall/setup') {
            this.ensureFirewallRule(true).then((ok) => {
                return this._sendJson(res, 200, { success: ok });
            });
            return;
        }

        // Verify session key or PIN for subsequent authenticated actions
        const isAuth = (data.sessionKey && (data.sessionKey === this.sessionKey || !!this.sessions[data.sessionKey])) ||
                       (data.pin && String(data.pin).trim() === String(this.pairingPin).trim()) ||
                       (data.token && data.token === this.pairingToken);

        if (!isAuth && Object.keys(this.sessions).length > 0) {
            return this._sendJson(res, 401, { success: false, error: 'Unauthorized session' });
        }

        if (this.pairedDevice) {
            this.pairedDevice.lastSeen = Date.now();
        }

        // 2. Receive tab sent from mobile to open on desktop
        if (pathname === '/api/send-tab') {
            if (!data.url) {
                return this._sendJson(res, 400, { success: false, error: 'URL is required' });
            }

            try {
                this.callbacks.onReceiveTab(data.url, data.title || data.url);
                return this._sendJson(res, 200, { success: true, message: 'Tab opened on desktop' });
            } catch (err) {
                return this._sendJson(res, 500, { success: false, error: err.message });
            }
        }

        // 3. Shared Clipboard
        if (pathname === '/api/clipboard') {
            if (typeof data.text === 'string' && data.text) {
                this.callbacks.setClipboardText(data.text);
                this.callbacks.onReceiveClipboard(data.text);
                return this._sendJson(res, 200, { success: true, message: 'Copied to desktop clipboard' });
            } else {
                const curText = this.callbacks.getClipboardText() || '';
                return this._sendJson(res, 200, { success: true, text: curText });
            }
        }

        // 4. Sync Bookmarks (Bidirectional Merge)
        if (pathname === '/api/sync/bookmarks') {
            const incoming = Array.isArray(data.bookmarks) ? data.bookmarks : [];
            const local = Array.isArray(this.callbacks.getBookmarks()) ? this.callbacks.getBookmarks() : [];

            const urlMap = new Map();
            local.forEach(b => {
                if (b && b.url) urlMap.set(b.url.trim(), b);
            });
            incoming.forEach(b => {
                if (b && b.url) {
                    const u = b.url.trim();
                    if (!urlMap.has(u)) {
                        urlMap.set(u, {
                            id: b.id || 'bm_sync_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                            title: b.title || b.name || u,
                            url: u,
                            folder: b.folder || 'Mobile',
                            createdAt: b.createdAt || Date.now()
                        });
                    }
                }
            });

            const merged = Array.from(urlMap.values());
            this.callbacks.setBookmarks(merged);
            return this._sendJson(res, 200, { success: true, bookmarks: merged });
        }

        // 5. Sync Passwords (Bidirectional Merge)
        if (pathname === '/api/sync/passwords') {
            const incoming = Array.isArray(data.passwords) ? data.passwords : [];
            const local = Array.isArray(this.callbacks.getPasswords()) ? this.callbacks.getPasswords() : [];

            const credMap = new Map();
            local.forEach(p => {
                const key = `${(p.url || p.site || '').toLowerCase()}|${(p.username || '').toLowerCase()}`;
                if (key !== '|') credMap.set(key, p);
            });

            incoming.forEach(p => {
                const key = `${(p.url || p.site || '').toLowerCase()}|${(p.username || '').toLowerCase()}`;
                if (key !== '|' && !credMap.has(key)) {
                    credMap.set(key, {
                        id: p.id || 'pwd_sync_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                        site: p.site || p.url || '',
                        url: p.url || p.site || '',
                        username: p.username || '',
                        password: p.password || '',
                        createdAt: p.createdAt || Date.now()
                    });
                }
            });

            const merged = Array.from(credMap.values());
            this.callbacks.setPasswords(merged);
            return this._sendJson(res, 200, { success: true, passwords: merged });
        }

        // 6. Sync History (Bidirectional Merge)
        if (pathname === '/api/sync/history') {
            const incoming = Array.isArray(data.history) ? data.history : [];
            const local = Array.isArray(this.callbacks.getHistory()) ? this.callbacks.getHistory() : [];

            const histMap = new Map();
            local.forEach(h => {
                if (h && h.url) histMap.set(h.url.trim(), h);
            });

            incoming.forEach(h => {
                if (h && h.url) {
                    const u = h.url.trim();
                    if (!histMap.has(u)) {
                        histMap.set(u, {
                            id: h.id || 'hist_sync_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                            title: h.title || u,
                            url: u,
                            visitedAt: h.visitedAt || Date.now()
                        });
                    }
                }
            });

            const merged = Array.from(histMap.values())
                .sort((a, b) => (b.visitedAt || 0) - (a.visitedAt || 0))
                .slice(0, 1000);

            this.callbacks.setHistory(merged);
            return this._sendJson(res, 200, { success: true, history: merged });
        }

        return this._sendJson(res, 404, { success: false, error: 'Endpoint not found' });
    }

    _sendJson(res, statusCode, data) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }
}

module.exports = { OcalSyncServer };
