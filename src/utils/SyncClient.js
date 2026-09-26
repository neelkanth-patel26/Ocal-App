/**
 * Ocal Sync Client (Mobile Browser)
 * Connects to Ocal Desktop Browser via local network (Wi-Fi)
 * Supports QR code pairing, 6-digit PIN verification, real-time SSE push
 * (incoming tabs & clipboard), persistent pairing sessions with auto-reconnection,
 * and full bidirectional sync (bookmarks, passwords, history).
 */

import { PasswordManager } from './DataImporter.js';

export class SyncClient {
  constructor() {
    this.storageKey = 'ocal-sync-session';
    this.session = this._loadSession();
    this.eventSource = null;
    this.listeners = new Set();
    this.reconnectTimeout = null;
    this.connectionStatus = this.isPaired() ? 'disconnected' : 'not-paired';
    this.reconnectAttempts = 0;
  }

  _loadSession() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  _saveSession(session) {
    this.session = session;
    if (session) {
      localStorage.setItem(this.storageKey, JSON.stringify(session));
      this.connectionStatus = 'reconnecting';
    } else {
      localStorage.removeItem(this.storageKey);
      this.connectionStatus = 'not-paired';
    }
    this._notifyListeners('session-changed', this.session);
  }

  isPaired() {
    return !!(this.session && this.session.host && this.session.sessionKey);
  }

  getSession() {
    return this.session;
  }

  getConnectionStatus() {
    return this.connectionStatus;
  }

  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notifyListeners(event, data) {
    this.listeners.forEach(cb => {
      try { cb(event, data); } catch (e) { console.error('[SyncClient] Listener error:', e); }
    });
  }

  // Initialize and auto-reconnect if already paired
  init() {
    if (this.isPaired()) {
      console.log('[SyncClient] Found existing pairing session, auto-reconnecting...');
      this.reconnect();
    }

    // Auto-reconnect when app is reopened from background or screen is unlocked
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isPaired()) {
        console.log('[SyncClient] App became visible, checking sync connection...');
        if (!this.eventSource || this.eventSource.readyState === EventSource.CLOSED) {
          this.reconnect();
        }
      }
    });

    // Auto-reconnect when device regains Wi-Fi / network connectivity
    window.addEventListener('online', () => {
      if (this.isPaired()) {
        console.log('[SyncClient] Device back online, reconnecting sync...');
        this.reconnect();
      }
    });

    window.addEventListener('focus', () => {
      if (this.isPaired() && (!this.eventSource || this.eventSource.readyState === EventSource.CLOSED)) {
        this.reconnect();
      }
    });
  }

  // Actively attempt reconnection to the saved desktop browser
  async reconnect() {
    if (!this.isPaired()) return false;
    const { host, port, sessionKey } = this.session;

    this.connectionStatus = 'reconnecting';
    this._notifyListeners('status', 'reconnecting');

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);

      const res = await fetch(`http://${host}:${port}/api/reconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionKey,
          deviceName: 'Ocal Mobile (Android)'
        }),
        signal: ctrl.signal
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (data.desktopName) {
          this.session.desktopName = data.desktopName;
          this._saveSession(this.session);
        }
        this.reconnectAttempts = 0;
        this.startSse();
        return true;
      }
    } catch (e) {
      // Reconnect ping failed, still attempt SSE in case network is warming up
    }

    this.startSse();
    return false;
  }

  // Pair using QR Code payload: JSON object, URI (ocal-sync:// or http://), or raw host:pin
  async pairWithQr(qrData) {
    let payload = null;

    if (typeof qrData === 'object' && qrData !== null) {
      payload = qrData;
    } else if (typeof qrData === 'string') {
      const trimmed = qrData.trim();

      // 1. Try parsing as JSON object
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          payload = JSON.parse(trimmed);
        } catch (e) {}
      }

      // 2. Try parsing as URI (ocal-sync:// or http:// or https://)
      if (!payload) {
        try {
          let uriStr = trimmed;
          if (uriStr.startsWith('ocal-sync://')) {
            uriStr = uriStr.replace('ocal-sync://', 'http://');
          } else if (!uriStr.includes('://')) {
            uriStr = 'http://' + uriStr;
          }
          const u = new URL(uriStr);
          payload = {
            host: u.hostname,
            port: parseInt(u.port, 10) || 9876,
            pin: u.searchParams.get('pin') || '',
            token: u.searchParams.get('token') || '',
            name: decodeURIComponent(u.searchParams.get('name') || 'Ocal Desktop')
          };
        } catch (e) {
          console.warn('[SyncClient] URI parsing error:', e);
        }
      }

      // 3. Fallback: raw host:pin or host:port:pin
      if (!payload || !payload.host) {
        const parts = trimmed.split(/[:\s,]+/);
        if (parts.length >= 2) {
          if (parts.length === 2) {
            payload = { host: parts[0], port: 9876, pin: parts[1] };
          } else if (parts.length >= 3) {
            payload = { host: parts[0], port: parseInt(parts[1], 10) || 9876, pin: parts[2] };
          }
        }
      }
    }

    if (!payload || !payload.host || (!payload.pin && !payload.token)) {
      throw new Error('Invalid pairing QR code. Please scan the QR code displayed in Ocal Desktop Settings > Ocal Connect.');
    }

    const port = parseInt(payload.port, 10) || 9876;
    const url = `http://${payload.host}:${port}/api/pair`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: payload.pin,
        token: payload.token,
        deviceName: 'Ocal Mobile (Android)'
      }),
      signal: ctrl.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Pairing failed (HTTP ${res.status}). Verify both devices are on the same Wi-Fi.`);
    }

    const data = await res.json();
    this._saveSession({
      host: payload.host,
      port: port,
      sessionKey: data.sessionKey,
      desktopName: data.desktopName || payload.name || 'Ocal Desktop',
      pairedAt: Date.now()
    });

    this.startSse();
    return this.session;
  }

  // Pair manually using IP and 6-digit PIN
  async pairManual(ip, port = 9876, pin) {
    let cleanIp = String(ip || '').trim().replace(/^https?:\/\//i, '').split('/')[0];
    let cleanPort = parseInt(port, 10) || 9876;
    const cleanPin = String(pin || '').trim();

    if (cleanIp.includes(':')) {
      const parts = cleanIp.split(':');
      cleanIp = parts[0];
      cleanPort = parseInt(parts[1], 10) || cleanPort;
    }

    if (!cleanIp) throw new Error('Please enter a valid Desktop IP address (e.g. 192.168.1.5 or 10.94.26.241).');
    if (!cleanPin) throw new Error('Please enter the 6-digit PIN displayed on your PC screen.');

    const baseUrl = `http://${cleanIp}:${cleanPort}`;

    // Step 1: Pre-check server reachability
    try {
      const pingCtrl = new AbortController();
      const pingTimer = setTimeout(() => pingCtrl.abort(), 5000);
      const pingRes = await fetch(`${baseUrl}/api/info`, {
        method: 'GET',
        signal: pingCtrl.signal
      });
      clearTimeout(pingTimer);
      if (!pingRes.ok) {
        throw new Error(`Server responded with HTTP ${pingRes.status}`);
      }
    } catch (pingErr) {
      if (pingErr.name === 'AbortError') {
        throw new Error(`Cannot reach desktop at ${baseUrl}. Make sure:\n• Both devices are on the same Wi-Fi\n• Ocal Desktop browser is running\n• Firewall allows port ${cleanPort}`);
      }
      throw new Error(`Cannot connect to ${baseUrl}: ${pingErr.message}`);
    }

    // Step 2: Attempt pairing with timeout
    const pairCtrl = new AbortController();
    const pairTimer = setTimeout(() => pairCtrl.abort(), 8000);

    const url = `${baseUrl}/api/pair`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: cleanPin,
        deviceName: 'Ocal Mobile (Android)'
      }),
      signal: pairCtrl.signal
    });
    clearTimeout(pairTimer);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Connection failed (HTTP ${res.status}). Ensure PC and phone are on the same Wi-Fi network.`);
    }

    const data = await res.json();
    this._saveSession({
      host: cleanIp,
      port: cleanPort,
      sessionKey: data.sessionKey,
      desktopName: data.desktopName || 'Ocal Desktop',
      pairedAt: Date.now()
    });

    this.startSse();
    return this.session;
  }

  // Start Server-Sent Events listener for real-time push from Desktop
  startSse() {
    if (!this.isPaired()) return;
    if (this.eventSource) {
      try { this.eventSource.close(); } catch (e) {}
      this.eventSource = null;
    }

    const { host, port, sessionKey } = this.session;
    const streamUrl = `http://${host}:${port}/api/events?sessionKey=${encodeURIComponent(sessionKey || '')}`;

    try {
      this.eventSource = new EventSource(streamUrl);

      this.eventSource.onopen = () => {
        console.log('[SyncClient] Connected to Desktop SSE event stream');
        this.connectionStatus = 'connected';
        this.reconnectAttempts = 0;
        this._notifyListeners('connected', this.session);
        this._notifyListeners('status', 'connected');
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this._handleIncomingEvent(data);
        } catch (e) {
          console.warn('[SyncClient] Failed parsing incoming SSE event:', e);
        }
      };

      this.eventSource.onerror = () => {
        this.connectionStatus = 'reconnecting';
        this._notifyListeners('status', 'reconnecting');

        if (this.eventSource) {
          try { this.eventSource.close(); } catch (e) {}
          this.eventSource = null;
        }

        clearTimeout(this.reconnectTimeout);
        // Exponential backoff with ceiling (3s, 5s, 8s, max 12s)
        this.reconnectAttempts++;
        const delay = Math.min(3000 + (this.reconnectAttempts * 1500), 12000);
        console.warn(`[SyncClient] SSE disconnected. Reconnecting in ${Math.round(delay/1000)}s...`);

        this.reconnectTimeout = setTimeout(() => {
          if (this.isPaired()) {
            this.reconnect();
          }
        }, delay);
      };
    } catch (e) {
      console.error('[SyncClient] Could not initiate SSE stream:', e);
    }
  }

  _handleIncomingEvent(data) {
    if (!data || !data.type) return;

    if (data.type === 'open_tab' && data.url) {
      console.log('[SyncClient] Desktop sent tab:', data.url);
      if (window.ocalApp && window.ocalApp.tabManager) {
        window.ocalApp.tabManager.createTab(data.url);
        window.ocalApp.showToast?.(`Opened tab from PC: ${data.title || data.url}`, 'compass');
      }
    } else if (data.type === 'clipboard' && data.text) {
      console.log('[SyncClient] Desktop sent clipboard');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(data.text).catch(() => {});
      }
      window.ocalApp?.showToast?.('Copied text from Desktop!', 'check');
    } else if (data.type === 'sync_requested') {
      console.log('[SyncClient] Desktop requested full sync');
      this.syncAll().then(() => {
        window.ocalApp?.showToast?.('Synced with Desktop!', 'check');
      }).catch(e => console.warn('[SyncClient] Auto-sync failed:', e));
    } else if (data.type === 'unpaired') {
      console.log('[SyncClient] Desktop unpaired');
      this._saveSession(null);
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      window.ocalApp?.showToast?.('Disconnected from Desktop', 'trash');
    }

    this._notifyListeners('event', data);
  }

  // Send current mobile tab to Desktop browser
  async sendActiveTab(url, title = '') {
    if (!this.isPaired()) throw new Error('Not paired with a desktop browser.');
    const { host, port, sessionKey } = this.session;

    const res = await fetch(`http://${host}:${port}/api/send-tab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, title, sessionKey })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to send tab to PC');
    }

    return await res.json();
  }

  // Send text to Desktop clipboard
  async sendClipboard(text) {
    if (!this.isPaired()) throw new Error('Not paired with a desktop browser.');
    const { host, port, sessionKey } = this.session;

    const res = await fetch(`http://${host}:${port}/api/clipboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sessionKey })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to send clipboard to PC');
    }

    return await res.json();
  }

  // Sync Bookmarks bidirectionally
  async syncBookmarks() {
    if (!this.isPaired()) throw new Error('Not paired with a desktop browser.');
    const { host, port, sessionKey } = this.session;

    const localBookmarks = JSON.parse(localStorage.getItem('ocal-bookmarks') || '[]');
    const res = await fetch(`http://${host}:${port}/api/sync/bookmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookmarks: localBookmarks, sessionKey })
    });

    if (!res.ok) throw new Error('Failed to sync bookmarks');
    const data = await res.json();

    if (Array.isArray(data.bookmarks)) {
      localStorage.setItem('ocal-bookmarks', JSON.stringify(data.bookmarks));
      window.ocalApp?.checkCurrentTabBookmarked?.();
    }
    return data.bookmarks || [];
  }

  // Sync Passwords Vault bidirectionally
  async syncPasswords() {
    if (!this.isPaired()) throw new Error('Not paired with a desktop browser.');
    const { host, port, sessionKey } = this.session;

    const localPasswords = PasswordManager.getPasswords();
    const res = await fetch(`http://${host}:${port}/api/sync/passwords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passwords: localPasswords, sessionKey })
    });

    if (!res.ok) throw new Error('Failed to sync passwords');
    const data = await res.json();

    if (Array.isArray(data.passwords)) {
      PasswordManager.savePasswords(data.passwords);
    }
    return data.passwords || [];
  }

  // Sync Browsing History bidirectionally
  async syncHistory() {
    if (!this.isPaired()) throw new Error('Not paired with a desktop browser.');
    const { host, port, sessionKey } = this.session;

    const localHistory = JSON.parse(localStorage.getItem('ocal-history') || '[]');
    const res = await fetch(`http://${host}:${port}/api/sync/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: localHistory, sessionKey })
    });

    if (!res.ok) throw new Error('Failed to sync history');
    const data = await res.json();

    if (Array.isArray(data.history)) {
      localStorage.setItem('ocal-history', JSON.stringify(data.history));
    }
    return data.history || [];
  }

  // Execute full sync
  async syncAll() {
    const [bookmarks, passwords, history] = await Promise.all([
      this.syncBookmarks(),
      this.syncPasswords(),
      this.syncHistory()
    ]);
    return { bookmarks, passwords, history };
  }

  // Unpair device
  async unpair() {
    if (this.session) {
      try {
        const { host, port, sessionKey } = this.session;
        await fetch(`http://${host}:${port}/api/unpair`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionKey })
        });
      } catch (e) {}
    }

    if (this.eventSource) {
      try { this.eventSource.close(); } catch (e) {}
      this.eventSource = null;
    }
    clearTimeout(this.reconnectTimeout);
    this._saveSession(null);
  }
}

// Global Singleton
export const syncClient = new SyncClient();
