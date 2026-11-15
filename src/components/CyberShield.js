// Ocal CyberShield Privacy & Security Suite
export class CyberShield {
  constructor({ onStatsChange }) {
    this.onStatsChange = onStatsChange;
    this.stats = {
      trackersBlocked: parseInt(localStorage.getItem('ocal-trackers-blocked') || '0', 10),
      adsBlocked: parseInt(localStorage.getItem('ocal-ads-blocked') || '0', 10),
      httpsUpgraded: parseInt(localStorage.getItem('ocal-https-upgrades') || '0', 10)
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
    const names = { adblock: 'adBlocker', tracker: 'trackerBlocker', https: 'httpsOnly', fingerprint: 'antiFingerprint' };
    const storedKey = Object.keys(names).find(name => names[name] === key) || key;
    const property = names[storedKey];
    if (!property) return;
    this.settings[property] = Boolean(value);
    localStorage.setItem(`ocal-shield-${storedKey}`, String(Boolean(value)));
    if (property === 'adBlocker') {
      window.OcalNative?.setAdBlockEnabled?.(Boolean(value));
      if (window.ocalApp) {
        window.ocalApp.adFilterEnabled = Boolean(value);
        const tab = window.ocalApp.tabManager?.getActiveTab();
        window.ocalApp.updateShieldStats?.(value ? tab?.blockedAdsCount || 0 : 0);
      }
      document.getElementById('shield-power-toggle')?.classList.toggle('active', Boolean(value));
      document.getElementById('shield-power-toggle')?.classList.toggle('inactive', !value);
    }
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

      <!-- Protection Toggles Grouped Table (Material 3 Style) -->
      <div class="apple-grouped-table" style="margin-top: 12px;">
        <div class="apple-grouped-row" style="cursor: default;">
          <div class="apple-row-icon mono-item">
            <span class="material-icons-round" style="font-size: 22px;">block</span>
          </div>
          <div class="apple-row-content">
            <div class="apple-row-title">Ad Filter &amp; Blocker</div>
            <div class="apple-row-subtitle">uBlock Origin network filter &amp; cosmetic hiding</div>
          </div>
          <label class="toggle-switch" style="margin-left: auto;">
            <input aria-label="Ad blocker" type="checkbox" id="toggle-shield-adblock" ${isAdBlock ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="apple-grouped-row" style="cursor: default;">
          <div class="apple-row-icon mono-item">
            <span class="material-icons-round" style="font-size: 22px;">shield</span>
          </div>
          <div class="apple-row-content">
            <div class="apple-row-title">Tracker &amp; Telemetry Defense</div>
            <div class="apple-row-subtitle">Stops cross-site tracking scripts &amp; analytics</div>
          </div>
          <label class="toggle-switch" style="margin-left: auto;">
            <input aria-label="Tracker blocking" type="checkbox" id="toggle-shield-tracker" ${isTracker ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="apple-grouped-row" style="cursor: default;">
          <div class="apple-row-icon mono-item">
            <span class="material-icons-round" style="font-size: 22px;">lock</span>
          </div>
          <div class="apple-row-content">
            <div class="apple-row-title">HTTPS Auto-Upgrades</div>
            <div class="apple-row-subtitle">Upgrades insecure HTTP to TLS encryption</div>
          </div>
          <label class="toggle-switch" style="margin-left: auto;">
            <input aria-label="HTTPS only" type="checkbox" id="toggle-shield-https" ${isHttps ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="apple-grouped-row" style="cursor: default;">
          <div class="apple-row-icon mono-item">
            <span class="material-icons-round" style="font-size: 22px;">fingerprint</span>
          </div>
          <div class="apple-row-content">
            <div class="apple-row-title">Fingerprint Sanitizer</div>
            <div class="apple-row-subtitle">Shields canvas, WebGL, and audio hardware IDs</div>
          </div>
          <label class="toggle-switch" style="margin-left: auto;">
            <input aria-label="Anti fingerprinting" type="checkbox" id="toggle-shield-fingerprint" ${isFingerprint ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div class="shield-footer-note">
        <span class="material-icons-round" style="font-size: 16px; color: var(--accent-primary);">verified_user</span>
        <span>Powered by uBlock Origin static filtering engine &amp; EasyList.</span>
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
