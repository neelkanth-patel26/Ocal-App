// Ocal Browser Circular Download Progress Indicator & Quick Popover
import { DownloadsManager } from './DownloadsManager.js';

export class DownloadProgressIndicator {
  constructor(app) {
    this.app = app;
    this.ballBtn = document.getElementById('capsule-download-btn');
    this.ballFill = document.getElementById('dl-ball-fill');
    this.ballText = document.getElementById('dl-ball-text');
    this.ballCheck = document.getElementById('dl-ball-check');
    this.popover = document.getElementById('dl-quick-popover');
    this.popoverBody = document.getElementById('dl-quick-popover-body');
    this.popoverCloseBtn = document.getElementById('dl-popover-close-btn');
    this.viewAllBtn = document.getElementById('dl-quick-view-all-btn');

    this.circumference = 69.115; // 2 * Math.PI * 11
    this.hideTimer = null;
    this.lastActiveCount = 0;

    this.init();
  }

  init() {
    this.bindEvents();
    // Subscribe to download events from DownloadsManager
    DownloadsManager.addListener((item, type) => {
      this.handleDownloadChange(item, type);
    });
    // Check initial state
    this.syncState();
  }

  bindEvents() {
    this.ballBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closePopover();
      this.hideBall();
      if (this.app?.tabManager) {
        this.app.tabManager.navigateTab(this.app.tabManager.activeTabId, 'ocal://downloads');
      }
    });

    this.popoverCloseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closePopover();
    });

    this.viewAllBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closePopover();
      if (this.app?.tabManager) {
        this.app.tabManager.navigateTab(this.app.tabManager.activeTabId, 'ocal://downloads');
      }
    });

    document.addEventListener('click', (e) => {
      if (this.popover?.classList.contains('visible')) {
        if (!e.target.closest('#dl-quick-popover') && !e.target.closest('#capsule-download-btn')) {
          this.closePopover();
        }
      }
    });
  }

  handleDownloadChange(item, type) {
    if (type === 'added') {
      this.showBall();
      this.clearHideTimer();
    }
    this.syncState();
  }

  syncState() {
    const all = DownloadsManager.getDownloads();
    const active = all.filter(d => d.status === 'downloading');

    if (active.length > 0) {
      this.clearHideTimer();
      this.showBall();
      this.ballBtn?.classList.remove('is-completed');

      // Calculate progress (average of active downloads or main item)
      let sum = 0;
      active.forEach(d => { sum += (d.progress || 0); });
      const avgProgress = Math.min(99, Math.max(1, Math.round(sum / active.length)));

      this.renderProgress(avgProgress, false);
      this.lastActiveCount = active.length;
    } else {
      // No currently active downloads
      if (this.lastActiveCount > 0) {
        // Just finished downloading!
        this.lastActiveCount = 0;
        this.renderProgress(100, true);
        this.ballBtn?.classList.add('is-completed');
        this.startHideTimer(3500); // Auto-hide completed ball cleanly after 3.5s
      } else {
        // No active downloads and no recent completion
        if (!this.hideTimer && !this.popover?.classList.contains('visible')) {
          this.hideBall();
        }
      }
    }

    if (this.popover?.classList.contains('visible')) {
      this.renderPopover();
    }
  }

  renderProgress(progress, isComplete) {
    if (!this.ballFill || !this.ballText || !this.ballCheck) return;

    if (isComplete || progress >= 100) {
      this.ballFill.style.strokeDashoffset = '0px';
      this.ballText.style.display = 'none';
      this.ballCheck.style.display = 'block';
    } else {
      const offset = this.circumference - (progress / 100) * this.circumference;
      this.ballFill.style.strokeDashoffset = `${offset}px`;
      this.ballText.textContent = `${progress}%`;
      this.ballText.style.display = 'block';
      this.ballCheck.style.display = 'none';
    }
  }

  showBall() {
    if (!this.ballBtn) return;
    this.ballBtn.style.display = 'flex';
    this.ballBtn.classList.add('is-active');
  }

  hideBall() {
    if (!this.ballBtn) return;
    this.ballBtn.classList.remove('is-active', 'is-completed');
    this.ballBtn.style.display = 'none';
    this.closePopover();
  }

  startHideTimer(ms = 14000) {
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      const active = DownloadsManager.getDownloads().filter(d => d.status === 'downloading');
      if (active.length === 0 && !this.popover?.classList.contains('visible')) {
        this.hideBall();
      }
    }, ms);
  }

  clearHideTimer() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  togglePopover() {
    if (!this.popover) return;
    if (this.popover.classList.contains('visible')) {
      this.closePopover();
    } else {
      this.openPopover();
    }
  }

  openPopover() {
    if (!this.popover) return;
    this.renderPopover();
    this.popover.classList.add('visible');
    // Hide other popovers (like shield)
    document.getElementById('shield-popover')?.classList.remove('visible');
  }

  closePopover() {
    this.popover?.classList.remove('visible');
  }

  renderPopover() {
    if (!this.popoverBody) return;
    const all = DownloadsManager.getDownloads();
    const active = all.filter(d => d.status === 'downloading');
    const completed = all.filter(d => d.status !== 'downloading');

    let html = '';

    if (active.length === 0 && completed.length === 0) {
      this.popoverBody.innerHTML = `
        <div style="padding: 18px 8px; text-align: center; color: var(--text-muted); font-size: 13px;">
          <i class="fas fa-arrow-down-to-bracket" style="font-size: 20px; margin-bottom: 8px; opacity: 0.5;"></i>
          <div>No active downloads</div>
        </div>
      `;
      return;
    }

    // 1. Active Downloads
    if (active.length > 0) {
      html += `
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 6px; padding-left: 2px;">
          Downloading (${active.length})
        </div>
      `;
      active.forEach(dl => {
        const iconInfo = DownloadsManager.getFileIconClass(dl.filename, dl.mimetype);
        const downloadedStr = DownloadsManager.formatBytes(dl.downloadedBytes);
        const totalStr = DownloadsManager.formatBytes(dl.totalBytes || dl.fileSize);
        html += `
          <div class="dl-popover-item">
            <div class="dl-popover-icon">
              <i class="${iconInfo.icon}"></i>
            </div>
            <div class="dl-popover-info">
              <div class="dl-popover-name" title="${this.escapeHtml(dl.filename)}">${this.escapeHtml(dl.filename)}</div>
              <div class="dl-popover-progress-bar">
                <div class="dl-popover-progress-fill" style="width: ${dl.progress}%;"></div>
              </div>
              <div class="dl-popover-stats">
                <span>${dl.progress}%</span>
                <span>${downloadedStr} / ${totalStr}</span>
              </div>
            </div>
          </div>
        `;
      });
    }

    // 2. Recent Completed (up to 3)
    if (completed.length > 0) {
      if (active.length > 0) {
        html += `
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin: 10px 0 6px; padding-left: 2px;">
            Recent
          </div>
        `;
      }
      completed.slice(0, 3).forEach(dl => {
        const iconInfo = DownloadsManager.getFileIconClass(dl.filename, dl.mimetype);
        const sizeStr = DownloadsManager.formatBytes(dl.totalBytes || dl.fileSize);
        const isFailed = dl.status === 'failed';
        html += `
          <div class="dl-popover-item">
            <div class="dl-popover-icon">
              <i class="${iconInfo.icon}"></i>
            </div>
            <div class="dl-popover-info">
              <div class="dl-popover-name" title="${this.escapeHtml(dl.filename)}">${this.escapeHtml(dl.filename)}</div>
              <div class="dl-popover-stats">
                <span>${sizeStr}</span>
                <span style="${isFailed ? 'color: var(--danger); font-weight: 600;' : 'color: var(--text-muted);'}">
                  ${isFailed ? 'Failed' : 'Completed'}
                </span>
              </div>
            </div>
            ${!isFailed ? `
              <button class="dl-popover-open-btn" data-id="${this.escapeHtml(String(dl.id))}">
                Open
              </button>
            ` : ''}
          </div>
        `;
      });
    }

    this.popoverBody.innerHTML = html;

    // Attach Open File listeners
    this.popoverBody.querySelectorAll('.dl-popover-open-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const dl = all.find(d => String(d.id) === String(id));
        if (dl) {
          if (window.OcalNative && typeof window.OcalNative.openDownloadedFile === 'function') {
            window.OcalNative.openDownloadedFile(dl.filePath, dl.mimetype || '*/*');
          } else if (dl.url && dl.url.startsWith('http')) {
            window.open(dl.url, '_blank');
          } else {
            this.app?.showToast?.('File: ' + dl.filePath, 'folder');
          }
          this.closePopover();
        }
      });
    });
  }

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
