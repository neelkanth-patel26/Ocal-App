// Ocal Browser - GitHub Release Tracker & Automatic Update System
import { DownloadsManager } from '../components/DownloadsManager.js';

export const APP_VERSION = '3.2.0';
export const GITHUB_REPO = 'neelkanth-patel26/Ocal-App';
export const GITHUB_API_RELEASES = `https://api.github.com/repos/${GITHUB_REPO}/releases`;
export const GITHUB_RELEASES_WEB = `https://github.com/${GITHUB_REPO}/releases`;

// Built-in fallback catalog when offline or before any GitHub releases are published
const BUNDLED_CATALOG = [
  {
    tag_name: 'v3.2.0',
    name: 'Ocal Mobile Browser v3.2.0',
    published_at: '2026-11-11T14:45:00Z',
    body: `### What's New in v3.2.0\n- 🕶️ Seamless pure black status bar in Private Browsing mode with zero dividing lines\n- 🔄 Fixed back gesture navigation from web results to previous internal pages (Start Page, Bookmarks, History)\n- 📱 Ultra-clean borderless bottom navigation bar in pure white\n- 🚀 Integrated GitHub Release Catalog & Automatic Update System`,
    html_url: GITHUB_RELEASES_WEB,
    assets: [
      {
        name: 'Ocal-Browser-v3.2.0.apk',
        size: 4819736,
        browser_download_url: `${GITHUB_RELEASES_WEB}/download/v3.2.0/Ocal-Browser-v3.2.0.apk`
      }
    ]
  },
  {
    tag_name: 'v3.0.1',
    name: 'Ocal Mobile Browser v3.0.1',
    published_at: '2026-11-11T12:00:00Z',
    body: `### What's New in v3.0.1\n- ✨ Ultra-clean borderless bottom navigation bar in pure white\n- 🎨 Apple-style circular accent color swatches with active ring indicator\n- 🎛️ Segmented glass blur density controls (Off, 12px, 24px, 36px, 48px)\n- 🛡️ Built-in uBlock Origin core ad blocker with zero tracking\n- 📖 Zen Reader mode with hands-free Text-to-Speech audio\n- 🚀 Zero-shadow minimal start page with customizable shortcuts\n- 🔄 Integrated GitHub Release Catalog & Automatic Update System`,
    html_url: GITHUB_RELEASES_WEB,
    assets: [
      {
        name: 'Ocal-Browser-v3.0.1.apk',
        size: 4819736,
        browser_download_url: `${GITHUB_RELEASES_WEB}/download/v3.0.1/Ocal-Browser-v3.0.1.apk`
      }
    ]
  }
];

export class UpdateManager {
  static getAppVersion() {
    return APP_VERSION;
  }

  static isAutoCheckEnabled() {
    try {
      return localStorage.getItem('ocal_auto_update_check') !== 'false';
    } catch {
      return true;
    }
  }

  static setAutoCheckEnabled(enabled) {
    try {
      localStorage.setItem('ocal_auto_update_check', enabled ? 'true' : 'false');
    } catch {}
  }

  // Parses version string (e.g. "v3.0.2" -> [3, 0, 2])
  static parseVersion(vStr) {
    if (!vStr || typeof vStr !== 'string') return [0, 0, 0];
    const cleaned = vStr.trim().replace(/^[vV]/, '');
    const parts = cleaned.split(/[-+.]/).map(p => {
      const n = parseInt(p, 10);
      return isNaN(n) ? 0 : n;
    });
    while (parts.length < 3) parts.push(0);
    return parts.slice(0, 3);
  }

  // Returns true if remoteVersion is strictly newer than localVersion
  static isNewerVersion(remoteStr, localStr = APP_VERSION) {
    const r = this.parseVersion(remoteStr);
    const l = this.parseVersion(localStr);
    for (let i = 0; i < 3; i++) {
      if (r[i] > l[i]) return true;
      if (r[i] < l[i]) return false;
    }
    return false;
  }

  static formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  }

  static formatDate(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return isoStr;
    }
  }

  // Fetch all releases from GitHub Releases API with caching
  static async fetchReleases(forceRefresh = false) {
    const cacheKey = 'ocal_cached_releases';
    const timeKey = 'ocal_cached_releases_time';

    if (!forceRefresh) {
      try {
        const cachedTime = parseInt(localStorage.getItem(timeKey) || '0', 10);
        const cachedData = localStorage.getItem(cacheKey);
        // 10 minutes cache
        if (cachedData && (Date.now() - cachedTime < 10 * 60 * 1000)) {
          const parsed = JSON.parse(cachedData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return { releases: parsed, fromCache: true };
          }
        }
      } catch {}
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const resp = await fetch(GITHUB_API_RELEASES, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        throw new Error(`GitHub API error HTTP ${resp.status}`);
      }

      const releases = await resp.json();
      if (Array.isArray(releases)) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(releases));
          localStorage.setItem(timeKey, Date.now().toString());
          localStorage.setItem('ocal_last_update_check_time', Date.now().toString());
        } catch {}
        return { releases, fromCache: false };
      }
    } catch (err) {
      console.warn('[UpdateManager] Failed to fetch live releases from GitHub:', err.message);
    }

    // Try returning old cache if available
    try {
      const oldCache = localStorage.getItem(cacheKey);
      if (oldCache) {
        const parsed = JSON.parse(oldCache);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { releases: parsed, fromCache: true, offline: true };
        }
      }
    } catch {}

    // Fallback to bundled catalog
    return { releases: BUNDLED_CATALOG, fromCache: false, fallback: true };
  }

  // Checks for updates against GitHub Releases
  static async checkForUpdates(manual = false) {
    const { releases, fallback, offline } = await this.fetchReleases(manual);
    
    // Find latest non-draft release
    const validReleases = releases.filter(r => !r.draft);
    if (!validReleases || validReleases.length === 0) {
      return {
        hasUpdate: false,
        currentVersion: APP_VERSION,
        latestVersion: APP_VERSION,
        release: null,
        message: 'No releases found on GitHub. You are running the latest version.'
      };
    }

    const latest = validReleases[0];
    const latestTag = latest.tag_name || latest.name || APP_VERSION;
    const hasUpdate = this.isNewerVersion(latestTag, APP_VERSION);

    return {
      hasUpdate,
      currentVersion: APP_VERSION,
      latestVersion: latestTag,
      release: latest,
      allReleases: validReleases,
      fallback,
      offline
    };
  }

  // Finds APK file asset in a release
  static getApkAsset(release) {
    if (!release || !Array.isArray(release.assets)) return null;
    return release.assets.find(a => a.name && a.name.toLowerCase().endsWith('.apk')) || null;
  }

  // Triggers download and installation of a release APK
  static downloadAndInstall(release) {
    const apkAsset = this.getApkAsset(release);
    const targetUrl = apkAsset ? apkAsset.browser_download_url : (release.html_url || GITHUB_RELEASES_WEB);
    const filename = apkAsset ? apkAsset.name : `ocal-browser-${release.tag_name || 'update'}.apk`;

    // 1. Android Native Download via DownloadManager
    if (window.OcalNative && typeof window.OcalNative.triggerDownload === 'function') {
      try {
        window.OcalNative.triggerDownload(targetUrl, filename, 'application/vnd.android.package-archive');
        window.ocalApp?.showToast?.(`Downloading ${filename}... Check notification or Downloads to install.`, 'download');
      } catch (e) {
        console.warn('[UpdateManager] Native download failed, falling back', e);
      }
    }

    // 2. Track in DownloadsManager
    try {
      DownloadsManager.addDownload({
        filename,
        url: targetUrl,
        fileSize: apkAsset ? apkAsset.size : 0,
        mimetype: 'application/vnd.android.package-archive',
        status: 'downloading'
      });
    } catch {}

    // 3. Fallback web download
    if (!window.OcalNative) {
      const a = document.createElement('a');
      a.href = targetUrl;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.ocalApp?.showToast?.(`Downloading update from GitHub...`, 'download');
    }
  }

  // Automatic Background Check on Startup
  static async initAutoCheck(app) {
    if (!this.isAutoCheckEnabled()) return;

    // Check interval: at most once every 4 hours automatically
    const lastCheck = parseInt(localStorage.getItem('ocal_last_update_check_time') || '0', 10);
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    if (Date.now() - lastCheck < FOUR_HOURS) return;

    try {
      const result = await this.checkForUpdates(false);
      if (result.hasUpdate && result.release) {
        const snoozed = localStorage.getItem('ocal_snoozed_update_version');
        if (snoozed === result.latestVersion) return;

        // Display subtle update banner on home page or toast
        this.showUpdateBannerOnStartPage(result.release);
      }
    } catch (e) {
      console.warn('[UpdateManager] Auto check failed silently', e);
    }
  }

  // Insert an update banner on the start page if one is available
  static showUpdateBannerOnStartPage(release) {
    const existing = document.getElementById('ocal-auto-update-banner');
    if (existing) return;

    const stripContainer = document.querySelector('.home-page-container, .opera-home-view');
    if (!stripContainer) return;

    const banner = document.createElement('div');
    banner.className = 'opera-feature-strip';
    banner.id = 'ocal-auto-update-banner';
    banner.style.marginTop = '12px';

    const apkAsset = this.getApkAsset(release);
    const sizeStr = apkAsset ? ` • ${this.formatBytes(apkAsset.size)}` : '';

    banner.innerHTML = `
      <div class="opera-strip-card" style="border: 1px solid var(--accent-primary); background: var(--bg-surface);">
        <div class="strip-icon-box" style="background: var(--accent-primary); color: var(--on-accent, #fff);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 16 12 12 8 16"></polyline>
            <line x1="12" y1="12" x2="12" y2="21"></line>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path>
          </svg>
        </div>
        <div class="strip-info">
          <div class="strip-title" style="color: var(--accent-primary); font-weight:700;">Update Available: ${escapeHtml(release.tag_name || 'New Version')}</div>
          <div class="strip-desc">${escapeHtml(release.name || 'New performance and feature update')}${sizeStr}</div>
        </div>
        <div class="strip-actions">
          <span class="strip-pill" style="background: var(--accent-primary); color: var(--on-accent, #fff);">Update</span>
          <button class="strip-dismiss-btn" id="dismiss-update-banner-btn" type="button" aria-label="Dismiss banner" title="Dismiss">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    `;

    banner.querySelector('.opera-strip-card').addEventListener('click', (e) => {
      if (e.target.closest('#dismiss-update-banner-btn')) return;
      this.showUpdateModal(release);
    });

    banner.querySelector('#dismiss-update-banner-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      localStorage.setItem('ocal_snoozed_update_version', release.tag_name || '');
      banner.remove();
    });

    const dialGrid = stripContainer.querySelector('.opera-dial-grid');
    if (dialGrid && dialGrid.nextSibling) {
      stripContainer.insertBefore(banner, dialGrid.nextSibling);
    } else {
      stripContainer.appendChild(banner);
    }
  }

  // Display the dedicated "New Update Available" Modal Dialog
  static showUpdateModal(release) {
    document.querySelectorAll('#ocal-update-modal').forEach(m => m.remove());

    const apkAsset = this.getApkAsset(release);
    const sizeStr = apkAsset ? this.formatBytes(apkAsset.size) : '';
    const dateStr = this.formatDate(release.published_at);
    const tagName = release.tag_name || 'v3.0.x';
    const title = release.name || `Ocal Browser ${tagName}`;

    // Format markdown release notes into clean HTML
    const formattedNotes = formatChangelog(release.body || 'Performance enhancements, security updates, and bug fixes.');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'ocal-update-modal';
    modal.style.display = 'flex';
    modal.style.zIndex = '999999';

    modal.innerHTML = `
      <div class="modal-dialog-card update-modal-card">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="update-icon-squircle">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 16 12 12 8 16"></polyline>
                <line x1="12" y1="12" x2="12" y2="21"></line>
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path>
              </svg>
            </div>
            <div>
              <div class="modal-title">New Update Available</div>
              <div style="font-size:11.5px; color:var(--text-muted);">${dateStr}</div>
            </div>
          </div>
          <button class="modal-close-btn" id="update-modal-close" aria-label="Close dialog">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="modal-body update-modal-body">
          <div class="update-version-banner">
            <div class="update-tag-pill">${escapeHtml(tagName)}</div>
            <div class="update-version-meta">
              <div class="update-version-name">${escapeHtml(title)}</div>
              <div class="update-version-sub">Current: v${APP_VERSION} ${sizeStr ? `• Size: ${sizeStr}` : ''}</div>
            </div>
          </div>

          <div class="update-changelog-box">
            <div class="update-changelog-header">Release Notes & Changelog</div>
            <div class="update-changelog-content">
              ${formattedNotes}
            </div>
          </div>

          ${apkAsset ? `
          <div class="update-asset-card">
            <div class="update-asset-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </div>
            <div class="update-asset-details">
              <div class="update-asset-filename">${escapeHtml(apkAsset.name)}</div>
              <div class="update-asset-size">Official Android Package (${sizeStr || 'Direct Download'})</div>
            </div>
          </div>
          ` : ''}
        </div>

        <div class="modal-footer update-modal-footer">
          <button type="button" class="btn btn-secondary update-btn-view-gh" id="update-btn-gh">
            View on GitHub ↗
          </button>
          <button type="button" class="btn btn-primary update-btn-download" id="update-btn-download-install">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download &amp; Install
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('#update-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    modal.querySelector('#update-btn-gh').addEventListener('click', () => {
      closeModal();
      const url = release.html_url || GITHUB_RELEASES_WEB;
      if (window.ocalApp?.tabManager) {
        window.ocalApp.tabManager.openTab(url);
      } else {
        window.open(url, '_blank');
      }
    });

    modal.querySelector('#update-btn-download-install').addEventListener('click', () => {
      closeModal();
      this.downloadAndInstall(release);
    });
  }

  // Display the full "Release Catalog & Version History" Modal
  static async showCatalogModal() {
    document.querySelectorAll('#ocal-catalog-modal').forEach(m => m.remove());

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'ocal-catalog-modal';
    modal.style.display = 'flex';
    modal.style.zIndex = '999999';

    modal.innerHTML = `
      <div class="modal-dialog-card catalog-modal-card">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="catalog-icon-squircle">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
            </div>
            <div>
              <div class="modal-title">Release Catalog</div>
              <div style="font-size:11.5px; color:var(--text-muted);">Official GitHub Releases &amp; Changelog</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <button class="catalog-refresh-btn" id="catalog-refresh-btn" title="Refresh releases" aria-label="Refresh">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
            </button>
            <button class="modal-close-btn" id="catalog-modal-close" aria-label="Close dialog">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="modal-body catalog-modal-body" id="catalog-modal-content">
          <div class="catalog-loading">
            <div class="catalog-spinner"></div>
            <div>Loading releases from GitHub...</div>
          </div>
        </div>

        <div class="modal-footer" style="padding: 12px 18px; border-top: 0.5px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:11.5px; color:var(--text-subtle);">Installed: v${APP_VERSION}</span>
          <button type="button" class="btn btn-secondary" id="catalog-open-gh-btn" style="font-size:12px; padding: 6px 12px;">
            Open on GitHub ↗
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('#catalog-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    modal.querySelector('#catalog-open-gh-btn').addEventListener('click', () => {
      closeModal();
      if (window.ocalApp?.tabManager) {
        window.ocalApp.tabManager.openTab(GITHUB_RELEASES_WEB);
      } else {
        window.open(GITHUB_RELEASES_WEB, '_blank');
      }
    });

    const refreshBtn = modal.querySelector('#catalog-refresh-btn');
    refreshBtn?.addEventListener('click', () => {
      refreshBtn.classList.add('rotating');
      renderCatalog(true).finally(() => {
        refreshBtn.classList.remove('rotating');
      });
    });

    const renderCatalog = async (force = false) => {
      const container = modal.querySelector('#catalog-modal-content');
      if (!container) return;

      container.innerHTML = `
        <div class="catalog-loading">
          <div class="catalog-spinner"></div>
          <div>Querying GitHub Releases...</div>
        </div>
      `;

      const { releases, fallback, offline } = await this.fetchReleases(force);

      if (!releases || releases.length === 0) {
        container.innerHTML = `
          <div class="catalog-empty">
            <div style="font-size:24px; margin-bottom:8px;">📦</div>
            <div style="font-weight:600; font-size:14px; color:var(--text-main);">No Releases Found Yet</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:4px; max-width:260px; text-align:center;">
              Releases are tracked live from GitHub repository <code>${GITHUB_REPO}</code>.
            </div>
            <button class="btn btn-primary" id="catalog-empty-gh-btn" style="margin-top:14px; font-size:12px;">
              View GitHub Releases
            </button>
          </div>
        `;
        container.querySelector('#catalog-empty-gh-btn')?.addEventListener('click', () => {
          closeModal();
          window.ocalApp?.tabManager?.openTab(GITHUB_RELEASES_WEB);
        });
        return;
      }

      let html = '';
      if (offline || fallback) {
        html += `
          <div class="catalog-notice-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>Viewing cached release catalog. Connect to the internet for live updates.</span>
          </div>
        `;
      }

      releases.forEach((rel, idx) => {
        const tag = rel.tag_name || 'v3.0.x';
        const isCurrent = tag.replace(/^v/i, '') === APP_VERSION;
        const isNewer = UpdateManager.isNewerVersion(tag, APP_VERSION);
        const apkAsset = UpdateManager.getApkAsset(rel);
        const dateStr = UpdateManager.formatDate(rel.published_at);
        const formattedNotes = formatChangelog(rel.body || 'No release notes provided.');

        html += `
          <div class="catalog-release-card ${isCurrent ? 'is-current-version' : ''} ${isNewer ? 'is-newer-version' : ''}">
            <div class="catalog-card-header">
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="catalog-card-tag">${escapeHtml(tag)}</span>
                ${isCurrent ? '<span class="catalog-status-badge current">Current</span>' : ''}
                ${isNewer ? '<span class="catalog-status-badge newer">Newer</span>' : ''}
              </div>
              <span class="catalog-card-date">${escapeHtml(dateStr)}</span>
            </div>

            <div class="catalog-card-title">${escapeHtml(rel.name || tag)}</div>
            <div class="catalog-card-notes">${formattedNotes}</div>

            <div class="catalog-card-actions">
              ${apkAsset ? `
                <button type="button" class="btn btn-primary catalog-dl-btn" data-tag="${escapeHtml(tag)}" style="font-size:12px; padding:6px 12px; gap:6px;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Download APK (${UpdateManager.formatBytes(apkAsset.size) || 'Direct'})
                </button>
              ` : `
                <button type="button" class="btn btn-secondary catalog-view-btn" data-url="${escapeHtml(rel.html_url || GITHUB_RELEASES_WEB)}" style="font-size:12px; padding:6px 12px;">
                  View on GitHub ↗
                </button>
              `}
            </div>
          </div>
        `;
      });

      container.innerHTML = html;

      // Bind download buttons
      container.querySelectorAll('.catalog-dl-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tag = btn.getAttribute('data-tag');
          const rel = releases.find(r => r.tag_name === tag);
          if (rel) {
            closeModal();
            UpdateManager.downloadAndInstall(rel);
          }
        });
      });

      container.querySelectorAll('.catalog-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const url = btn.getAttribute('data-url');
          closeModal();
          if (window.ocalApp?.tabManager) {
            window.ocalApp.tabManager.openTab(url);
          } else {
            window.open(url, '_blank');
          }
        });
      });
    };

    renderCatalog(false);
  }
}

// Simple helper to format Markdown changelog into styled HTML
function formatChangelog(markdown) {
  if (!markdown) return '';
  const lines = markdown.split('\n');
  let html = '';
  let inList = false;

  lines.forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) {
      if (inList) { html += '</ul>'; inList = false; }
      return;
    }

    if (line.startsWith('### ') || line.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false; }
      const text = line.replace(/^#+\s*/, '');
      html += `<div class="changelog-heading">${escapeHtml(text)}</div>`;
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) { html += '<ul class="changelog-list">'; inList = true; }
      const text = line.replace(/^[-*]\s*/, '');
      html += `<li>${escapeHtml(text)}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p class="changelog-p">${escapeHtml(line)}</p>`;
    }
  });

  if (inList) html += '</ul>';
  return html;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

