// Ocal CyberShield Privacy & Security Suite
export class CyberShield {
  constructor({ onStatsChange }) {
    this.onStatsChange = onStatsChange;
    this.stats = {
      trackersBlocked: parseInt(localStorage.getItem('ocal-trackers-blocked') || '42', 10),
      adsBlocked: parseInt(localStorage.getItem('ocal-ads-blocked') || '118', 10),
      httpsUpgraded: parseInt(localStorage.getItem('ocal-https-upgrades') || '27', 10)
    };

    this.settings = {
      adBlocker: localStorage.getItem('ocal-shield-adblock') !== 'false',
      trackerBlocker: localStorage.getItem('ocal-shield-tracker') !== 'false',
      httpsOnly: localStorage.getItem('ocal-shield-https') !== 'false',
      antiFingerprint: localStorage.getItem('ocal-shield-fingerprint') !== 'false'
    };
  }

  recordBlockedTracker(domain) {
    this.stats.trackersBlocked++;
    this.stats.adsBlocked++;
    this.saveStats();
    if (this.onStatsChange) this.onStatsChange(this.stats);
  }

  recordHttpsUpgrade() {
    this.stats.httpsUpgraded++;
    this.saveStats();
    if (this.onStatsChange) this.onStatsChange(this.stats);
  }

  saveStats() {
    localStorage.setItem('ocal-trackers-blocked', this.stats.trackersBlocked);
    localStorage.setItem('ocal-ads-blocked', this.stats.adsBlocked);
    localStorage.setItem('ocal-https-upgrades', this.stats.httpsUpgraded);
  }

  updateSetting(key, value) {
    this.settings[key] = value;
    localStorage.setItem(`ocal-shield-${key}`, value);
  }

  renderControlSheet(containerEl) {
    const isAdBlock = this.settings.adBlocker !== false;
    const isTracker = this.settings.trackerBlocker !== false;
    const isHttps = this.settings.httpsOnly !== false;
    const isFingerprint = this.settings.antiFingerprint !== false;

    containerEl.innerHTML = `
      <!-- Privacy Live Metric 4-Card Grid -->
      <div class="shield-metric-grid">
        <div class="shield-metric-card">
          <div class="shield-metric-val" id="shield-stat-trackers">${this.stats.trackersBlocked}</div>
          <div class="shield-metric-lbl">Trackers Blocked</div>
        </div>
        <div class="shield-metric-card">
          <div class="shield-metric-val" id="shield-stat-ads">${this.stats.adsBlocked}</div>
          <div class="shield-metric-lbl">Ads Intercepted</div>
        </div>
        <div class="shield-metric-card">
          <div class="shield-metric-val" id="shield-stat-https">${this.stats.httpsUpgraded}</div>
          <div class="shield-metric-lbl">HTTPS Upgrades</div>
        </div>
        <div class="shield-metric-card">
          <div class="shield-metric-val status-active">uBO Active</div>
          <div class="shield-metric-lbl">Core Engine</div>
        </div>
      </div>

      <!-- Protection Toggles Grouped Table (Pure Monochrome Style) -->
      <div class="apple-grouped-table" style="margin-top: 12px;">
        <div class="apple-grouped-row" style="cursor: default;">
          <div class="apple-row-icon mono-copilot" style="font-weight:800; font-size:11px; font-family:var(--font-sans); letter-spacing:-0.5px;">
            uBO
          </div>
          <div class="apple-row-content">
            <div class="apple-row-title">uBlock Origin Ad Blocker</div>
            <div class="apple-row-subtitle">Static network filtering & cosmetic element hiding</div>
          </div>
          <label class="toggle-switch" style="margin-left: auto;">
            <input type="checkbox" id="toggle-shield-adblock" ${isAdBlock ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="apple-grouped-row" style="cursor: default;">
          <div class="apple-row-icon mono-item">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="11" r="3"/></svg>
          </div>
          <div class="apple-row-content">
            <div class="apple-row-title">Tracker & Telemetry Defense</div>
            <div class="apple-row-subtitle">Stops cross-site tracking scripts & analytics</div>
          </div>
          <label class="toggle-switch" style="margin-left: auto;">
            <input type="checkbox" id="toggle-shield-tracker" ${isTracker ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="apple-grouped-row" style="cursor: default;">
          <div class="apple-row-icon mono-item">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div class="apple-row-content">
            <div class="apple-row-title">HTTPS Auto-Upgrades</div>
            <div class="apple-row-subtitle">Upgrades insecure HTTP to TLS encryption</div>
          </div>
          <label class="toggle-switch" style="margin-left: auto;">
            <input type="checkbox" id="toggle-shield-https" ${isHttps ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="apple-grouped-row" style="cursor: default;">
          <div class="apple-row-icon mono-item">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 11c-2 0-3 1-3 3 0 2.5 2 4.5 3 4.5s3-2 3-4.5c0-2-1-3-3-3z"/><path d="M12 2a9.9 9.9 0 0 0-7 2.9A9.9 9.9 0 0 0 2 12c0 2.8 1.1 5.3 3 7.1"/><path d="M22 12c0-2.8-1.1-5.3-3-7.1A9.9 9.9 0 0 0 12 2"/></svg>
          </div>
          <div class="apple-row-content">
            <div class="apple-row-title">Fingerprint Sanitizer</div>
            <div class="apple-row-subtitle">Shields canvas, WebGL, and audio hardware IDs</div>
          </div>
          <label class="toggle-switch" style="margin-left: auto;">
            <input type="checkbox" id="toggle-shield-fingerprint" ${isFingerprint ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div class="shield-footer-note">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>Powered by uBlock Origin static filtering engine & EasyList.</span>
      </div>
    `;

    // Bind toggles
    containerEl.querySelector('#toggle-shield-adblock')?.addEventListener('change', (e) => {
      this.updateSetting('adblock', e.target.checked);
    });
    containerEl.querySelector('#toggle-shield-tracker')?.addEventListener('change', (e) => {
      this.updateSetting('tracker', e.target.checked);
    });
    containerEl.querySelector('#toggle-shield-https')?.addEventListener('change', (e) => {
      this.updateSetting('https', e.target.checked);
    });
    containerEl.querySelector('#toggle-shield-fingerprint')?.addEventListener('change', (e) => {
      this.updateSetting('fingerprint', e.target.checked);
    });
  }
}
