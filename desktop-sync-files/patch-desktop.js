import fs from 'fs';
import path from 'path';

const browerDir = 'C:/Project/Gaming Network/Software/Brower';

// ── 1. Patch preload.js ─────────────────────────────────────────────────────
console.log('Patching preload.js...');
const preloadFile = path.join(browerDir, 'preload.js');
let preload = fs.readFileSync(preloadFile, 'utf8');

const syncPreloadCode = `
  // Ocal Connect / Mobile Sync
  syncGetStatus:       ()         => ipcRenderer.invoke('sync:get-status'),
  syncStart:           ()         => ipcRenderer.invoke('sync:start'),
  syncStop:            ()         => ipcRenderer.invoke('sync:stop'),
  syncSendTab:         (url, title) => ipcRenderer.invoke('sync:send-tab', { url, title }),
  syncSendClipboard:   (text)     => ipcRenderer.invoke('sync:send-clipboard', text),
  syncTriggerSync:     ()         => ipcRenderer.invoke('sync:trigger-sync'),
  syncUnpair:          ()         => ipcRenderer.invoke('sync:unpair'),
  onSyncStatusChanged: (cb)       => ipcRenderer.on('sync:status-changed', (e, d) => cb(d)),
`;

if (!preload.includes('syncGetStatus:')) {
    const anchor = "toggleBookmark: (bm)    => ipcRenderer.send('toggle-bookmark', bm),";
    if (preload.includes(anchor)) {
        preload = preload.replace(anchor, anchor + '\n' + syncPreloadCode);
        fs.writeFileSync(preloadFile, preload, 'utf8');
        console.log('✓ preload.js patched successfully');
    } else {
        console.error('✗ Anchor not found in preload.js');
    }
} else {
    console.log('• preload.js already contains sync methods');
}

// ── 2. Patch main.js ────────────────────────────────────────────────────────
console.log('Patching main.js...');
const mainFile = path.join(browerDir, 'main.js');
let mainCode = fs.readFileSync(mainFile, 'utf8');

// 2a. Add server auto-start inside whenReady
const whenReadyAnchor = "createMainWindow();";
const whenReadyInitCall = `
    // Initialize Ocal Connect Sync Server for cross-device mobile integration
    try {
        initOcalSyncServer();
    } catch (e) {
        console.error('[OcalSync] Failed to initialize sync server:', e);
    }
`;

if (!mainCode.includes('initOcalSyncServer();')) {
    if (mainCode.includes(whenReadyAnchor)) {
        // Replace first occurrence inside whenReady (which is after line 437000)
        const idx = mainCode.lastIndexOf(whenReadyAnchor);
        if (idx !== -1) {
            mainCode = mainCode.substring(0, idx + whenReadyAnchor.length) + whenReadyInitCall + mainCode.substring(idx + whenReadyAnchor.length);
            console.log('✓ main.js whenReady hook added');
        }
    }
}

// 2b. Add OcalSyncServer implementation and IPC handlers at the bottom
const syncServerBlock = `

// ─────────────────────────────────────────────────────────────────────────────
// ── Ocal Connect / Mobile Cross-Device Sync Server ───────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

const { OcalSyncServer } = require('./syncServer.js');
let ocalSyncServerInstance = null;

function initOcalSyncServer() {
    if (ocalSyncServerInstance) return ocalSyncServerInstance;

    ocalSyncServerInstance = new OcalSyncServer({
        port: 9876,
        deviceName: \`Ocal PC (\${os.hostname() || 'Windows'})\`,

        onOpenTab: (url, title) => {
            console.log('[OcalSync] Remote tab requested from mobile:', url, title);
            if (url) {
                createNewTab(url);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.focus();
                }
            }
        },

        onClipboardReceived: (text) => {
            console.log('[OcalSync] Remote clipboard text received from mobile:', text ? text.substring(0, 30) : '');
            if (text) {
                clipboard.writeText(text);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('show-toast', {
                        message: 'Copied text received from mobile!',
                        icon: 'fa-copy'
                    });
                }
            }
        },

        onBookmarksReceived: (remoteBookmarks) => {
            console.log('[OcalSync] Received bookmarks from mobile:', remoteBookmarks ? remoteBookmarks.length : 0);
            if (Array.isArray(remoteBookmarks) && remoteBookmarks.length > 0) {
                if (!userSettings.bookmarks) userSettings.bookmarks = [];
                const existingUrls = new Set(userSettings.bookmarks.map(b => (b.url || '').toLowerCase()));
                let added = 0;
                remoteBookmarks.forEach(rb => {
                    if (rb.url && !existingUrls.has(rb.url.toLowerCase())) {
                        userSettings.bookmarks.push({
                            id: 'sync_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                            title: rb.title || rb.name || rb.url,
                            url: rb.url,
                            favicon: rb.favicon || rb.icon || '',
                            createdAt: Date.now()
                        });
                        existingUrls.add(rb.url.toLowerCase());
                        added++;
                    }
                });
                if (added > 0) {
                    saveSettings(userSettings);
                    broadcastSettings();
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('show-toast', {
                            message: \`Synced \${added} new bookmark(s) from mobile!\`,
                            icon: 'fa-bookmark'
                        });
                    }
                }
            }
        },

        onPasswordsReceived: (remoteVault) => {
            console.log('[OcalSync] Received passwords from mobile:', remoteVault ? remoteVault.length : 0);
            if (Array.isArray(remoteVault) && remoteVault.length > 0) {
                const localVault = loadPasswordVaultRaw();
                let changed = 0;
                remoteVault.forEach(rp => {
                    if (!rp.domain && !rp.url) return;
                    const domain = rp.domain || normalizeDomainName(rp.url || '');
                    const existingIdx = localVault.findIndex(lp =>
                        (lp.domain && domain && lp.domain.toLowerCase() === domain.toLowerCase()) &&
                        (lp.username === rp.username)
                    );
                    if (existingIdx !== -1) {
                        if (rp.password && rp.updatedAt && (!localVault[existingIdx].updatedAt || rp.updatedAt > localVault[existingIdx].updatedAt)) {
                            localVault[existingIdx].passwordEncrypted = encryptSecret(rp.password);
                            localVault[existingIdx].updatedAt = rp.updatedAt || Date.now();
                            changed++;
                        }
                    } else if (rp.password) {
                        localVault.push({
                            id: 'sync_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                            domain: domain,
                            origin: rp.origin || rp.url || '',
                            username: rp.username || '',
                            passwordEncrypted: encryptSecret(rp.password),
                            createdAt: rp.createdAt || Date.now(),
                            updatedAt: rp.updatedAt || Date.now()
                        });
                        changed++;
                    }
                });
                if (changed > 0) {
                    savePasswordVaultRaw(localVault);
                    notifyPasswordStatusForActiveTab();
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('show-toast', {
                            message: \`Synced \${changed} password credential(s) from mobile!\`,
                            icon: 'fa-key'
                        });
                    }
                }
            }
        },

        onHistoryReceived: (remoteHistory) => {
            console.log('[OcalSync] Received history from mobile:', remoteHistory ? remoteHistory.length : 0);
            if (Array.isArray(remoteHistory) && remoteHistory.length > 0) {
                if (!userSettings.history) userSettings.history = [];
                const existingUrls = new Set(userSettings.history.map(h => (h.url || '').toLowerCase()));
                let added = 0;
                remoteHistory.forEach(rh => {
                    if (rh.url && !existingUrls.has(rh.url.toLowerCase())) {
                        userSettings.history.push({
                            title: rh.title || rh.url,
                            url: rh.url,
                            timestamp: rh.timestamp || rh.visitedAt || Date.now()
                        });
                        existingUrls.add(rh.url.toLowerCase());
                        added++;
                    }
                });
                if (added > 0) {
                    userSettings.history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                    if (userSettings.history.length > 3000) userSettings.history.length = 3000;
                    saveSettings(userSettings);
                    broadcastSettings();
                }
            }
        },

        getBookmarks: () => {
            return userSettings.bookmarks || [];
        },

        getPasswords: () => {
            const rawVault = loadPasswordVaultRaw();
            return rawVault.map(item => ({
                id: item.id,
                domain: item.domain,
                origin: item.origin,
                username: item.username,
                password: decryptSecret(item.passwordEncrypted),
                createdAt: item.createdAt,
                updatedAt: item.updatedAt
            }));
        },

        getHistory: () => {
            return (userSettings.history || []).slice(0, 500);
        },

        onPairingSuccess: (device) => {
            console.log('[OcalSync] Device successfully paired:', device.name);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('sync:status-changed', ocalSyncServerInstance.getStatus());
                mainWindow.webContents.send('show-toast', {
                    message: \`Connected to \${device.name}!\`,
                    icon: 'fa-mobile-screen'
                });
            }
        },

        onUnpaired: () => {
            console.log('[OcalSync] Mobile device unpaired');
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('sync:status-changed', ocalSyncServerInstance.getStatus());
                mainWindow.webContents.send('show-toast', {
                    message: 'Mobile device disconnected.',
                    icon: 'fa-link-slash'
                });
            }
        }
    });

    ocalSyncServerInstance.start();
    return ocalSyncServerInstance;
}

// IPC Handlers for Ocal Sync
ipcMain.handle('sync:get-status', () => {
    if (!ocalSyncServerInstance) initOcalSyncServer();
    return ocalSyncServerInstance.getStatus();
});

ipcMain.handle('sync:start', () => {
    if (!ocalSyncServerInstance) initOcalSyncServer();
    return ocalSyncServerInstance.start();
});

ipcMain.handle('sync:stop', () => {
    if (ocalSyncServerInstance) ocalSyncServerInstance.stop();
    return { success: true };
});

ipcMain.handle('sync:send-tab', (e, tabData) => {
    if (!ocalSyncServerInstance) initOcalSyncServer();
    let url = tabData && tabData.url;
    let title = tabData && tabData.title;
    if (!url) {
        const activeEntry = views.find(v => v.id === activeViewId);
        if (activeEntry && activeEntry.view && activeEntry.view.webContents && !activeEntry.view.webContents.isDestroyed()) {
            url = activeEntry.view.webContents.getURL();
            title = activeEntry.view.webContents.getTitle();
        }
    }
    return ocalSyncServerInstance.sendTabToMobile(url, title);
});

ipcMain.handle('sync:send-clipboard', (e, text) => {
    if (!ocalSyncServerInstance) initOcalSyncServer();
    const content = text || clipboard.readText();
    return ocalSyncServerInstance.sendClipboardToMobile(content);
});

ipcMain.handle('sync:trigger-sync', () => {
    if (!ocalSyncServerInstance) initOcalSyncServer();
    return ocalSyncServerInstance.requestSyncFromMobile();
});

ipcMain.handle('sync:unpair', () => {
    if (!ocalSyncServerInstance) initOcalSyncServer();
    return ocalSyncServerInstance.unpairDevice();
});
`;

if (!mainCode.includes('// ── Ocal Connect / Mobile Cross-Device Sync Server')) {
    mainCode += syncServerBlock;
    fs.writeFileSync(mainFile, mainCode, 'utf8');
    console.log('✓ main.js sync block added successfully');
} else {
    console.log('• main.js already contains sync block');
}

// ── 3. Patch settings.html ──────────────────────────────────────────────────
console.log('Patching settings.html...');
const settingsHtmlFile = path.join(browerDir, 'settings.html');
let settingsHtml = fs.readFileSync(settingsHtmlFile, 'utf8');

// 3a. Add sidebar nav item
const navAnchor = '<div class="nav-item" data-section="about">';
const navItemHtml = `                <div class="nav-item" data-section="sync">
                    <div class="nav-item-icon" style="color: var(--accent);"><i class="fas fa-qrcode"></i></div>
                    <span>Ocal Connect</span>
                </div>
`;

if (!settingsHtml.includes('data-section="sync"')) {
    if (settingsHtml.includes(navAnchor)) {
        settingsHtml = settingsHtml.replace(navAnchor, navItemHtml + navAnchor);
        console.log('✓ settings.html nav item added');
    }
}

// 3b. Add sync section
const mainEndAnchor = '</main>';
const syncSectionHtml = `
            <!-- ─── OCAL CONNECT & MOBILE SYNC SECTION ────────────────────────── -->
            <section id="sync" class="section">
                <!-- Home-style Header Row: Title & Stats Bar -->
                <div class="home-settings-header-row">
                    <div class="home-settings-greeting">
                        <h1 class="home-settings-title">Ocal Connect & Mobile Sync</h1>
                        <div class="home-settings-subtitle">
                            <i class="fas fa-quote-left home-quote-icon"></i>
                            <span>Link this Windows desktop browser with the Ocal Mobile Android app for real-time tab push, shared clipboard, bookmark and encrypted password vault synchronization.</span>
                        </div>
                    </div>

                    <!-- Dot-Matrix Stats Bar -->
                    <div class="home-stats-bar">
                        <div class="home-stat-item">
                            <span class="home-dot-num" id="sync-stat-status" style="color: var(--accent);">Listening</span>
                            <span class="home-badge home-badge-lime" id="sync-stat-port">Port 9876</span>
                        </div>
                        <div class="home-stat-item">
                            <span class="home-dot-num" id="sync-stat-device">None</span>
                            <span class="home-badge" id="sync-stat-badge">Mobile Device</span>
                        </div>
                    </div>
                </div>

                <div class="page-body">
                    <div class="homepage-bento-grid security-bento-grid">

                        <!-- ─── 1. Scan to Connect (QR Code & PIN) ─── -->
                        <div class="card homepage-bento-card security-bento-card sp-card-white" style="grid-column: span 6;">
                            <div class="hbc-header">
                                <div class="hbc-header-left">
                                    <div class="hbc-icon" style="background: rgba(9, 240, 160, 0.12); color: var(--accent);">
                                        <i class="fas fa-qrcode"></i>
                                    </div>
                                    <div class="hbc-identity">
                                        <h4 class="hbc-name">Pair Mobile Device</h4>
                                        <div class="hbc-tagline">Scan QR code or enter PIN from Ocal Mobile</div>
                                    </div>
                                </div>
                            </div>

                            <div style="display: flex; flex-direction: column; align-items: center; padding: 18px 12px; gap: 14px;">
                                <!-- QR SVG Container -->
                                <div id="sync-qr-container" style="background: #ffffff; padding: 12px; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.15); border: 2px solid var(--accent); width: 204px; height: 204px; display: flex; align-items: center; justify-content: center;">
                                    <i class="fas fa-spinner fa-spin" style="font-size: 28px; color: #666;"></i>
                                </div>

                                <!-- 6-Digit PIN Display -->
                                <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%;">
                                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary, #888); font-weight: 700;">Manual 6-Digit PIN</div>
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span id="sync-pin-display" style="font-family: 'JetBrains Mono', 'Space Mono', monospace; font-size: 24px; font-weight: 800; letter-spacing: 4px; color: var(--accent); background: rgba(9, 240, 160, 0.08); padding: 4px 14px; border-radius: 10px; border: 1px solid rgba(9, 240, 160, 0.25);">------</span>
                                        <button id="sync-copy-pin-btn" class="btn" style="padding: 6px 12px; font-size: 11.5px; border-radius: 8px; background: var(--bg-input, #1e1e24); border: 1px solid rgba(255,255,255,0.1); cursor: pointer; color: var(--text-primary, #fff);">
                                            <i class="fas fa-copy"></i>
                                        </button>
                                    </div>
                                </div>

                                <!-- Local LAN IP and Port -->
                                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); padding: 8px 12px; border-radius: 10px; font-size: 11.5px;">
                                    <div style="display: flex; align-items: center; gap: 6px; color: var(--text-secondary, #aaa);">
                                        <i class="fas fa-network-wired" style="color: var(--accent);"></i>
                                        <span id="sync-ip-display">http://--.--.--.--:9876</span>
                                    </div>
                                    <button id="sync-copy-ip-btn" class="btn" style="background: none; border: none; color: var(--accent); cursor: pointer; font-size: 11px; font-weight: 600;">
                                        Copy URL
                                    </button>
                                </div>

                                <div style="font-size: 11px; line-height: 1.5; color: var(--text-secondary, #888); text-align: center; margin-top: 4px;">
                                    Make sure both your PC and mobile device are connected to the same Wi-Fi router / local network.
                                </div>
                            </div>
                        </div>

                        <!-- ─── 2. Connected Device & Live Actions ─── -->
                        <div class="card homepage-bento-card security-bento-card sp-card-white" style="grid-column: span 6;">
                            <div class="hbc-header">
                                <div class="hbc-header-left">
                                    <div class="hbc-icon" style="background: rgba(66, 133, 244, 0.12); color: #4285f4;">
                                        <i class="fas fa-mobile-screen-button"></i>
                                    </div>
                                    <div class="hbc-identity">
                                        <h4 class="hbc-name">Device Status & Actions</h4>
                                        <div class="hbc-tagline">Push tabs, shared clipboard & real-time synchronization</div>
                                    </div>
                                </div>
                            </div>

                            <div style="padding: 18px 14px; display: flex; flex-direction: column; gap: 14px;">
                                <!-- Device Info Card -->
                                <div id="sync-device-card" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 12px; padding: 14px; display: flex; align-items: center; justify-content: space-between;">
                                    <div style="display: flex; align-items: center; gap: 12px;">
                                        <div id="sync-device-icon" style="width: 40px; height: 40px; border-radius: 10px; background: rgba(9, 240, 160, 0.1); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 18px;">
                                            <i class="fas fa-mobile-screen"></i>
                                        </div>
                                        <div>
                                            <div id="sync-device-name" style="font-size: 13.5px; font-weight: 700; color: var(--text-primary, #fff);">No Mobile Device Connected</div>
                                            <div id="sync-device-sub" style="font-size: 11px; color: var(--text-secondary, #888); margin-top: 2px;">Waiting for scan from Ocal Mobile...</div>
                                        </div>
                                    </div>
                                    <span id="sync-status-pill" style="font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px; background: rgba(255,255,255,0.08); color: var(--text-secondary, #aaa);">Unpaired</span>
                                </div>

                                <!-- Live Cross-Device Actions -->
                                <div style="display: flex; flex-direction: column; gap: 8px;">
                                    <button id="sync-send-tab-btn" class="btn" style="display: flex; align-items: center; gap: 10px; justify-content: center; padding: 11px; border-radius: 10px; background: var(--accent); color: #000; font-weight: 700; font-size: 12.5px; border: none; cursor: pointer; transition: opacity 0.2s;" disabled>
                                        <i class="fas fa-arrow-up-right-from-square"></i>
                                        <span>Send Active Tab to Mobile</span>
                                    </button>

                                    <button id="sync-send-clipboard-btn" class="btn" style="display: flex; align-items: center; gap: 10px; justify-content: center; padding: 10px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: var(--text-primary, #fff); font-weight: 600; font-size: 12px; cursor: pointer;" disabled>
                                        <i class="fas fa-clipboard"></i>
                                        <span>Push PC Clipboard to Mobile</span>
                                    </button>

                                    <button id="sync-trigger-all-btn" class="btn" style="display: flex; align-items: center; gap: 10px; justify-content: center; padding: 10px; border-radius: 10px; background: rgba(9, 240, 160, 0.08); border: 1px solid rgba(9, 240, 160, 0.25); color: var(--accent); font-weight: 600; font-size: 12px; cursor: pointer;" disabled>
                                        <i class="fas fa-rotate"></i>
                                        <span>Request Full Sync (Bookmarks, Vault, History)</span>
                                    </button>

                                    <button id="sync-unpair-btn" class="btn" style="display: none; align-items: center; gap: 10px; justify-content: center; padding: 8px; border-radius: 10px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); color: #ef4444; font-weight: 600; font-size: 11.5px; cursor: pointer;">
                                        <i class="fas fa-link-slash"></i>
                                        <span>Disconnect Mobile Device</span>
                                    </button>
                                </div>

                                <!-- Capabilities Notice -->
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 6px;">
                                    <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 8px; border-radius: 8px; text-align: center;">
                                        <i class="fas fa-bookmark" style="color: #f59e0b; font-size: 14px;"></i>
                                        <div style="font-size: 10.5px; font-weight: 600; margin-top: 4px;">Bookmarks</div>
                                    </div>
                                    <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 8px; border-radius: 8px; text-align: center;">
                                        <i class="fas fa-key" style="color: var(--accent); font-size: 14px;"></i>
                                        <div style="font-size: 10.5px; font-weight: 600; margin-top: 4px;">Vault Passwords</div>
                                    </div>
                                    <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 8px; border-radius: 8px; text-align: center;">
                                        <i class="fas fa-clock-rotate-left" style="color: #8b5cf6; font-size: 14px;"></i>
                                        <div style="font-size: 10.5px; font-weight: 600; margin-top: 4px;">History</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>
`;

if (!settingsHtml.includes('id="sync"')) {
    if (settingsHtml.includes(mainEndAnchor)) {
        settingsHtml = settingsHtml.replace(mainEndAnchor, syncSectionHtml + '\n        ' + mainEndAnchor);
        fs.writeFileSync(settingsHtmlFile, settingsHtml, 'utf8');
        console.log('✓ settings.html sync section added');
    }
} else {
    console.log('• settings.html already contains sync section');
}

// ── 4. Patch settings.js ────────────────────────────────────────────────────
console.log('Patching settings.js...');
const settingsJsFile = path.join(browerDir, 'settings.js');
let settingsJs = fs.readFileSync(settingsJsFile, 'utf8');

const syncSettingsLogic = `
// ─────────────────────────────────────────────────────────────────────────────
// ── Ocal Connect (Desktop <-> Mobile Sync) UI Controller ──────────────────────
// ─────────────────────────────────────────────────────────────────────────────

let _currentSyncStatus = null;

async function refreshOcalSyncUI() {
    if (!window.electronAPI || !window.electronAPI.syncGetStatus) return;
    try {
        const st = await window.electronAPI.syncGetStatus();
        _currentSyncStatus = st;
        renderOcalSyncUI(st);
    } catch (e) {
        console.warn('[SyncUI] Failed to get sync status:', e);
    }
}

function renderOcalSyncUI(st) {
    if (!st) return;

    // 1. QR Code Container
    const qrContainer = document.getElementById('sync-qr-container');
    if (qrContainer && st.qrSvg) {
        qrContainer.innerHTML = st.qrSvg;
        const svgEl = qrContainer.querySelector('svg');
        if (svgEl) {
            svgEl.style.width = '100%';
            svgEl.style.height = '100%';
        }
    }

    // 2. PIN Display
    const pinDisplay = document.getElementById('sync-pin-display');
    if (pinDisplay) {
        pinDisplay.textContent = st.pairingPin || '------';
    }

    // 3. IP / URL Display
    const ipDisplay = document.getElementById('sync-ip-display');
    if (ipDisplay) {
        ipDisplay.textContent = \`http://\${st.lanIp || '127.0.0.1'}:\${st.port || 9876}\`;
    }

    // 4. Header stats
    const statStatus = document.getElementById('sync-stat-status');
    const statPort = document.getElementById('sync-stat-port');
    const statDevice = document.getElementById('sync-stat-device');
    const statBadge = document.getElementById('sync-stat-badge');

    if (statPort) statPort.textContent = \`Port \${st.port || 9876}\`;

    const isPaired = !!(st.pairedDevice);
    if (statStatus) {
        statStatus.textContent = isPaired ? 'Connected' : (st.isRunning ? 'Listening' : 'Stopped');
        statStatus.style.color = isPaired ? 'var(--accent)' : (st.isRunning ? 'var(--accent)' : '#ef4444');
    }
    if (statDevice) {
        statDevice.textContent = isPaired ? (st.pairedDevice.name || 'Mobile App') : 'None';
    }
    if (statBadge) {
        statBadge.className = isPaired ? 'home-badge home-badge-lime' : 'home-badge';
        statBadge.textContent = isPaired ? 'Online' : 'Mobile Device';
    }

    // 5. Device Card Details
    const deviceName = document.getElementById('sync-device-name');
    const deviceSub = document.getElementById('sync-device-sub');
    const statusPill = document.getElementById('sync-status-pill');
    const sendTabBtn = document.getElementById('sync-send-tab-btn');
    const sendClipBtn = document.getElementById('sync-send-clipboard-btn');
    const triggerAllBtn = document.getElementById('sync-trigger-all-btn');
    const unpairBtn = document.getElementById('sync-unpair-btn');

    if (isPaired) {
        if (deviceName) deviceName.textContent = st.pairedDevice.name || 'Ocal Mobile Android';
        if (deviceSub) {
            const lastSync = st.lastSyncTime ? new Date(st.lastSyncTime).toLocaleTimeString() : 'Just now';
            deviceSub.textContent = \`IP: \${st.pairedDevice.ip} · Last Synced: \${lastSync}\`;
        }
        if (statusPill) {
            statusPill.textContent = 'Linked';
            statusPill.style.background = 'rgba(9, 240, 160, 0.15)';
            statusPill.style.color = 'var(--accent)';
        }
        if (sendTabBtn) sendTabBtn.disabled = false;
        if (sendClipBtn) sendClipBtn.disabled = false;
        if (triggerAllBtn) triggerAllBtn.disabled = false;
        if (unpairBtn) unpairBtn.style.display = 'inline-flex';
    } else {
        if (deviceName) deviceName.textContent = 'No Mobile Device Connected';
        if (deviceSub) deviceSub.textContent = 'Waiting for scan from Ocal Mobile...';
        if (statusPill) {
            statusPill.textContent = 'Unpaired';
            statusPill.style.background = 'rgba(255,255,255,0.08)';
            statusPill.style.color = 'var(--text-secondary, #aaa)';
        }
        if (sendTabBtn) sendTabBtn.disabled = true;
        if (sendClipBtn) sendClipBtn.disabled = true;
        if (triggerAllBtn) triggerAllBtn.disabled = true;
        if (unpairBtn) unpairBtn.style.display = 'none';
    }
}

function initOcalSyncEventListeners() {
    // Copy PIN button
    const copyPinBtn = document.getElementById('sync-copy-pin-btn');
    if (copyPinBtn) {
        copyPinBtn.addEventListener('click', () => {
            if (_currentSyncStatus && _currentSyncStatus.pairingPin) {
                navigator.clipboard.writeText(_currentSyncStatus.pairingPin);
                copyPinBtn.innerHTML = '<i class="fas fa-check" style="color: var(--accent);"></i>';
                setTimeout(() => { copyPinBtn.innerHTML = '<i class="fas fa-copy"></i>'; }, 1800);
            }
        });
    }

    // Copy IP button
    const copyIpBtn = document.getElementById('sync-copy-ip-btn');
    if (copyIpBtn) {
        copyIpBtn.addEventListener('click', () => {
            if (_currentSyncStatus) {
                const url = \`http://\${_currentSyncStatus.lanIp}:\${_currentSyncStatus.port}\`;
                navigator.clipboard.writeText(url);
                copyIpBtn.textContent = 'Copied!';
                setTimeout(() => { copyIpBtn.textContent = 'Copy URL'; }, 1800);
            }
        });
    }

    // Send active tab button
    const sendTabBtn = document.getElementById('sync-send-tab-btn');
    if (sendTabBtn) {
        sendTabBtn.addEventListener('click', async () => {
            if (!window.electronAPI || !window.electronAPI.syncSendTab) return;
            sendTabBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Sending Tab...</span>';
            try {
                const res = await window.electronAPI.syncSendTab();
                if (res && res.success) {
                    sendTabBtn.innerHTML = '<i class="fas fa-check"></i> <span>Tab Sent to Mobile!</span>';
                } else {
                    sendTabBtn.innerHTML = '<i class="fas fa-circle-exclamation"></i> <span>Failed</span>';
                }
            } catch (e) {
                sendTabBtn.innerHTML = '<i class="fas fa-circle-exclamation"></i> <span>Error</span>';
            }
            setTimeout(() => {
                sendTabBtn.innerHTML = '<i class="fas fa-arrow-up-right-from-square"></i> <span>Send Active Tab to Mobile</span>';
            }, 2000);
        });
    }

    // Push clipboard button
    const sendClipBtn = document.getElementById('sync-send-clipboard-btn');
    if (sendClipBtn) {
        sendClipBtn.addEventListener('click', async () => {
            if (!window.electronAPI || !window.electronAPI.syncSendClipboard) return;
            sendClipBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Pushing Clipboard...</span>';
            try {
                const res = await window.electronAPI.syncSendClipboard();
                if (res && res.success) {
                    sendClipBtn.innerHTML = '<i class="fas fa-check" style="color: var(--accent);"></i> <span>Clipboard Sent!</span>';
                } else {
                    sendClipBtn.innerHTML = '<span>Failed</span>';
                }
            } catch (e) {
                sendClipBtn.innerHTML = '<span>Error</span>';
            }
            setTimeout(() => {
                sendClipBtn.innerHTML = '<i class="fas fa-clipboard"></i> <span>Push PC Clipboard to Mobile</span>';
            }, 2000);
        });
    }

    // Trigger full sync button
    const triggerAllBtn = document.getElementById('sync-trigger-all-btn');
    if (triggerAllBtn) {
        triggerAllBtn.addEventListener('click', async () => {
            if (!window.electronAPI || !window.electronAPI.syncTriggerSync) return;
            triggerAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Requesting Sync...</span>';
            try {
                await window.electronAPI.syncTriggerSync();
                triggerAllBtn.innerHTML = '<i class="fas fa-check" style="color: var(--accent);"></i> <span>Sync Requested!</span>';
            } catch (e) {
                triggerAllBtn.innerHTML = '<span>Error</span>';
            }
            setTimeout(() => {
                triggerAllBtn.innerHTML = '<i class="fas fa-rotate"></i> <span>Request Full Sync (Bookmarks, Vault, History)</span>';
            }, 2000);
        });
    }

    // Unpair button
    const unpairBtn = document.getElementById('sync-unpair-btn');
    if (unpairBtn) {
        unpairBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to disconnect your mobile device?')) return;
            if (window.electronAPI && window.electronAPI.syncUnpair) {
                await window.electronAPI.syncUnpair();
                refreshOcalSyncUI();
            }
        });
    }

    // Listen to real-time status push from main process
    if (window.electronAPI && window.electronAPI.onSyncStatusChanged) {
        window.electronAPI.onSyncStatusChanged((status) => {
            _currentSyncStatus = status;
            renderOcalSyncUI(status);
        });
    }
}

// Hook into showSection to auto-refresh when sync tab is selected
const _origShowSection = typeof showSection === 'function' ? showSection : null;
if (_origShowSection) {
    window.showSection = function(id) {
        _origShowSection(id);
        if (id === 'sync') {
            refreshOcalSyncUI();
        }
    };
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initOcalSyncEventListeners();
    refreshOcalSyncUI();
});
`;

if (!settingsJs.includes('// ── Ocal Connect (Desktop <-> Mobile Sync) UI Controller')) {
    settingsJs += '\n' + syncSettingsLogic;
    fs.writeFileSync(settingsJsFile, settingsJs, 'utf8');
    console.log('✓ settings.js sync controller added');
} else {
    console.log('• settings.js already contains sync controller');
}

// ── 5. Create OCAL_CONNECT_SYNC_GUIDE.md ─────────────────────────────────────
console.log('Creating OCAL_CONNECT_SYNC_GUIDE.md...');
const guidePath = path.join(browerDir, 'OCAL_CONNECT_SYNC_GUIDE.md');
const guideContent = `# Ocal Connect: Desktop & Mobile Cross-Device Sync Guide

## Overview
**Ocal Connect** is a high-speed, local-network cross-device bridge designed to link the **Ocal Windows Desktop Browser** (\`C:\\Project\\Gaming Network\\Software\\Brower\`) with the **Ocal Mobile Android Application** (\`c:\\Project\\Gaming Network\\Software\\Ocal App\`).

Unlike traditional cloud-tethered browsers, Ocal Connect operates over zero-trust **Local Area Network (LAN) / same Wi-Fi** using authenticated peer-to-peer HTTP and Server-Sent Events (SSE). No credentials or browsing data ever leave your local router.

---

## Key Features

1. **Seamless QR Code & PIN Pairing**
   - The Desktop browser runs an embedded HTTP + SSE daemon on port \`9876\`.
   - Generates an instant high-contrast SVG QR code encoding:
     \`\`\`
     ocal-sync://{LAN_IP}:9876?pin={6_DIGIT_PIN}&name={PC_HOSTNAME}&token={SESSION_TOKEN}
     \`\`\`
   - Mobile scans the QR code via its built-in camera scanner, or the user enters the 6-digit PIN manually.

2. **Push Active Tab ("Send to PC" / "Send to Phone")**
   - Push current webpage tab from Mobile to Desktop: Desktop immediately opens the tab via \`createNewTab(url)\`.
   - Push active tab from Desktop to Mobile: Mobile receives an SSE \`open_tab\` event and navigates or opens a new tab.

3. **Universal Shared Clipboard**
   - Copy any link, snippet, or text on PC and tap "Push PC Clipboard to Mobile".
   - Copy text on phone and tap "Send Clipboard to PC": desktop clipboard is updated instantly via Electron \`clipboard.writeText()\`.

4. **Encrypted Password Vault Sync**
   - Bi-directionally synchronizes saved web credentials.
   - Encrypted with AES-256-GCM / Electron \`safeStorage\` on desktop and AES-GCM on mobile.

5. **Bookmarks & Chronological History Sync**
   - Bidirectional non-destructive deduplication of bookmarks.
   - Chronological timeline merge of browsing history without overwriting existing timestamps.

---

## Architecture & Communication Protocol

\`\`\`
┌────────────────────────────────────────┐             ┌────────────────────────────────────────┐
│         Ocal Desktop Browser           │             │          Ocal Mobile App               │
│  (C:\\...\\Software\\Brower)               │             │  (c:\\...\\Software\\Ocal App)           │
│                                        │             │                                        │
│  ┌──────────────────────────────────┐  │             │  ┌──────────────────────────────────┐  │
│  │ OcalSyncServer (Node.js/Electron)│  │             │  │ SyncClient (ESM / Capacitor)     │  │
│  │ Port: 9876 (HTTP & SSE)          │  │             │  │ BarcodeDetector / QrScanner      │  │
│  └──────────────────────────────────┘  │             │  └──────────────────────────────────┘  │
│         ▲                    │         │             │         ▲                    │         │
│         │ POST /api/pair     │         │             │         │ GET /api/events    │         │
│         │ (PIN auth)         │         │             │         │ (SSE Real-time)    │         │
│         │                    ▼         │             │         │                    ▼         │
│         │              SSE Event Stream├─────────────┼─────────┘                              │
│         │              (open_tab,      │             │                                        │
│         │               clipboard,     │             │                                        │
│         │               sync_requested)│             │                                        │
│         │                              │             │                                        │
│         └──────────────────────────────┼─────────────┼────────────────────────────────────────┘
│                                        │             │
└────────────────────────────────────────┘             └────────────────────────────────────────┘
\`\`\`

---

## REST & Event API Reference (Port 9876)

All authenticated endpoints require header:
\`X-Ocal-Token: {pairingToken}\`

| Endpoint | Method | Description |
|---|---|---|
| \`/api/info\` | \`GET\` | Returns server status, device name, and pairing readiness. |
| \`/api/pair\` | \`POST\` | Body: \`{ pin: "123456", deviceName: "Ocal Mobile", deviceId: "..." }\`. Verifies PIN and returns session token. |
| \`/api/events\` | \`GET\` | Opens persistent Server-Sent Events (SSE) stream for real-time remote commands. |
| \`/api/send-tab\` | \`POST\` | Body: \`{ url: "https://...", title: "..." }\`. Opens URL on receiving device. |
| \`/api/clipboard\` | \`POST\` | Body: \`{ text: "..." }\`. Copies text to recipient clipboard. |
| \`/api/sync/bookmarks\` | \`POST\` | Body: \`{ bookmarks: [...] }\`. Merges bookmarks and returns desktop bookmarks. |
| \`/api/sync/passwords\` | \`POST\` | Body: \`{ vault: [...] }\`. Merges encrypted credentials and returns desktop vault. |
| \`/api/sync/history\` | \`POST\` | Body: \`{ history: [...] }\`. Merges browsing history and returns desktop history. |
| \`/api/unpair\` | \`POST\` | Unpairs active mobile connection and invalidates session token. |

---

## Troubleshooting & FAQ

### 1. "Failed to connect to Desktop" / "Connection Timed Out"
- **Cause**: Windows Defender Firewall or router Wi-Fi client isolation.
- **Fix**:
  1. Ensure both your PC and mobile device are connected to the same Wi-Fi SSID.
  2. If Windows Defender Firewall blocks port 9876, run this PowerShell command as Administrator on PC:
     \`\`\`powershell
     New-NetFirewallRule -DisplayName "Ocal Connect Sync Server" -Direction Inbound -LocalPort 9876 -Protocol TCP -Action Allow
     \`\`\`

### 2. "Camera scanner is not reading QR code"
- **Fix**:
  1. Ensure lighting is clear and lens is focused.
  2. Use the **Manual 6-Digit PIN** fallback:
     - On Desktop: Open \`ocal://settings#sync\` (or Settings > Ocal Connect). Note the 6-digit PIN and the IP (e.g. \`http://192.168.1.5:9876\`).
     - On Mobile: In the Sync page, tap "Enter PIN & IP Manually", enter the IP and 6-digit PIN, then tap "Connect".

### 3. How to access Ocal Connect in the apps
- **Desktop**: Open Settings (\`ocal://settings\`) > Click **Ocal Connect** tab in the sidebar nav.
- **Mobile**: Tap the **3-dot menu** at the bottom right > Select **Ocal Connect / Sync**, or navigate directly to \`ocal://sync\`.

---
*Created for Ocal Browser Suite by Gaming Network Studio (2026).*
`;

fs.writeFileSync(guidePath, guideContent, 'utf8');
console.log('✓ OCAL_CONNECT_SYNC_GUIDE.md created');

console.log('\\nAll desktop modifications applied successfully!');
