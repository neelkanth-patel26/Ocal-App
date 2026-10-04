// Ocal Mobile Tab Manager with Real Multi-Tab Switching & Incognito
import { InternalPages } from './InternalPages.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

export class TabManager {
  constructor({ viewportContainerEl, onTabChanged, onTabsCountChanged, onNavigate }) {
    this.viewportContainer = viewportContainerEl;
    this.onTabChanged = onTabChanged;
    this.onTabsCountChanged = onTabsCountChanged;
    this.onNavigate = onNavigate;

    this.tabs = [];
    this.activeTabId = null;
    this.tabCounter = 1;
    this.isIncognitoMode = false;
    this.tabFilterMode = 'normal';
    this.currentPreset = localStorage.getItem('ocal-tabs-preset') || 'grid';
  }

  setPreset(preset) {
    if (!['grid', 'stack', 'list'].includes(preset)) return;
    this.currentPreset = preset;
    try { localStorage.setItem('ocal-tabs-preset', preset); } catch (_) {}
    const sheet = document.getElementById('tabs-tray-sheet');
    if (sheet) {
      sheet.classList.remove('tabs-view-grid', 'tabs-view-stack', 'tabs-view-list');
      sheet.classList.add(`tabs-view-${preset}`);
    }
    this.updateViewModeButtonIcon();
    const carousel = document.getElementById('tabs-carousel');
    if (carousel) {
      this.renderTabsGrid(carousel, (tabId) => {
        this.switchTab(tabId);
        window.ocalApp?.closeTabsTray?.();
      });
    }
  }

  updateViewModeButtonIcon() {
    const btn = document.getElementById('tabs-nav-view-mode');
    if (!btn) return;
    if (this.currentPreset === 'list') {
      btn.title = "Switch to Grid View";
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
          <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
          <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
          <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
        </svg>
      `;
    } else {
      btn.title = "Switch to List View";
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="7" y="4" width="10" height="16" rx="2.5"></rect>
          <line x1="3.5" y1="7.5" x2="3.5" y2="16.5"></line>
          <line x1="20.5" y1="7.5" x2="20.5" y2="16.5"></line>
        </svg>
      `;
    }
  }

  closeAllTabs() {
    if (this.tabFilterMode === 'private') {
      const privateTabs = this.tabs.filter(t => t.isIncognito);
      privateTabs.forEach(tab => {
        try { sessionStorage.removeItem(`ocal_thumb_${tab.id}`); } catch (_) {}
        if (tab.frameWrapperEl?.parentNode) {
          tab.frameWrapperEl.parentNode.removeChild(tab.frameWrapperEl);
        }
      });
      this.tabs = this.tabs.filter(t => !t.isIncognito);
      if (this.tabs.length > 0) {
        this.switchTab(this.tabs[0].id);
      } else {
        this.createTab('ocal://home', false);
      }
    } else {
      const normalTabs = this.tabs.filter(t => !t.isIncognito);
      normalTabs.forEach(tab => {
        try { sessionStorage.removeItem(`ocal_thumb_${tab.id}`); } catch (_) {}
        if (tab.frameWrapperEl?.parentNode) {
          tab.frameWrapperEl.parentNode.removeChild(tab.frameWrapperEl);
        }
      });
      this.tabs = this.tabs.filter(t => t.isIncognito);
      const newNormal = this.createTab('ocal://home', false);
      this.switchTab(newNormal.id);
    }
    this.notifyTabsCount();
    const carousel = document.getElementById('tabs-carousel');
    if (carousel) {
      this.renderTabsGrid(carousel, (tabId) => {
        this.switchTab(tabId);
        window.ocalApp?.closeTabsTray?.();
      });
    }
  }

  init() {
    this.createTab('ocal://home');
  }

  createTab(initialUrl = 'ocal://home', isIncognito = false) {
    const tabId = `tab-${this.tabCounter++}`;
    const frameWrapper = document.createElement('div');
    frameWrapper.className = 'tab-frame-wrapper';
    frameWrapper.id = `frame-wrapper-${tabId}`;
    this.viewportContainer.appendChild(frameWrapper);

    let displayTitle = 'New Tab';
    if (initialUrl.includes('dineinstyle.com')) displayTitle = 'Dine in Style';
    else if (initialUrl.includes('twitter.com') || initialUrl.includes('x.com')) displayTitle = 'Twitter';
    else if (initialUrl === 'ocal://home') displayTitle = 'Start Page';
    else if (initialUrl.startsWith('ocal://')) {
      const p = initialUrl.replace('ocal://', '').split('?')[0].split('#')[0];
      displayTitle = p.charAt(0).toUpperCase() + p.slice(1);
    }
    else displayTitle = initialUrl;

    let cachedThumb = null;
    try {
      cachedThumb = sessionStorage.getItem(`ocal_thumb_${tabId}`);
    } catch (e) {}

    const tab = {
      id: tabId,
      url: initialUrl,
      title: displayTitle,
      isIncognito: isIncognito,
      thumbnail: cachedThumb || null,
      frameWrapperEl: frameWrapper,
      frameEl: null,
      history: [initialUrl],
      historyIdx: 0,
      isDesktop: localStorage.getItem('ocal-desktop-default') === 'true',
      blockedAdsCount: 0
    };

    this.tabs.push(tab);
    this.switchTab(tabId);
    this.navigateTab(tabId, initialUrl, false);
    this.notifyTabsCount();
    return tab;
  }

  closeTab(tabId) {
    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    try {
      sessionStorage.removeItem(`ocal_thumb_${tabId}`);
    } catch (e) {}

    const tab = this.tabs[index];
    if (tab.frameWrapperEl && tab.frameWrapperEl.parentNode) {
      tab.frameWrapperEl.parentNode.removeChild(tab.frameWrapperEl);
    }

    this.tabs.splice(index, 1);

    if (this.tabs.length === 0) {
      this.createTab('ocal://home', this.isIncognitoMode);
    } else {
      const nextTab = this.tabs[Math.max(0, index - 1)];
      this.switchTab(nextTab.id);
    }
    this.notifyTabsCount();
  }

  switchTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    // Immediately capture snapshot of outgoing tab so it's not lost
    const prevTab = this.getActiveTab();
    if (prevTab && prevTab.id !== tabId && !prevTab.url.startsWith('ocal://') && window.OcalNative) {
      try {
        const freshThumb = window.OcalNative.captureCurrentThumbnailImmediate(prevTab.id);
        if (freshThumb && freshThumb.startsWith('data:image')) {
          prevTab.thumbnail = freshThumb;
          try { sessionStorage.setItem(`ocal_thumb_${prevTab.id}`, freshThumb); } catch (e) {}
        }
      } catch (_) {}
    }

    this.activeTabId = tabId;

    // Toggle active classes on frame wrappers
    this.tabs.forEach(t => {
      if (t.id === tabId) {
        t.frameWrapperEl.classList.add('active');
      } else {
        t.frameWrapperEl.classList.remove('active');
      }
    });

    // Sync native Android web view visibility & URL
    if (window.OcalNative) {
      if (tab.url.startsWith('ocal://') || tab.url.includes('dineinstyle.com')) {
        window.OcalNative.setWebVisible(false);
      } else {
        if (typeof window.OcalNative.setDesktopMode === 'function') {
          window.OcalNative.setDesktopMode(!!tab.isDesktop, false);
        }
        window.OcalNative.setWebVisible(true);
        window.OcalNative.openUrl(tab.url);
      }
    }

    if (this.onTabChanged) this.onTabChanged(tab);
  }

  isDarkMode() {
    const theme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('ocal-theme') || 'dark';
    return theme === 'dark';
  }

  getActiveTab() {
    return this.tabs.find(t => t.id === this.activeTabId) || null;
  }

  navigateTab(tabId, url, pushHistory = true) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    // Normalizing URL
    let targetUrl = url.trim();
    if (
      !targetUrl.startsWith('ocal://') &&
      !targetUrl.startsWith('http://') &&
      !targetUrl.startsWith('https://') &&
      !targetUrl.startsWith('file://') &&
      !targetUrl.startsWith('about:')
    ) {
      const isIpOrLocal = /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:[0-9]+)?(\/.*)?$/i.test(targetUrl);
      const isDomainLike = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:[0-9]+)?(\/.*)?$/i.test(targetUrl);
      const hasHostAndPort = /^[a-zA-Z0-9_.-]+:[0-9]+(\/.*)?$/i.test(targetUrl);

      if (isIpOrLocal || isDomainLike || hasHostAndPort || (targetUrl.includes('.') && !targetUrl.includes(' '))) {
        if (/^localhost(:[0-9]+)?(\/.*)?$/i.test(targetUrl) || /^127\.0\.0\.1(:[0-9]+)?(\/.*)?$/i.test(targetUrl)) {
          targetUrl = 'http://' + targetUrl;
        } else if (/^(\d{1,3}\.){3}\d{1,3}(:[0-9]+)?(\/.*)?$/i.test(targetUrl)) {
          // If port is 8090, 8443, 443, captive portals or HTTPS appliances use https
          if (/:8090(\/|$)/.test(targetUrl) || /:8443(\/|$)/.test(targetUrl) || /:443(\/|$)/.test(targetUrl)) {
            targetUrl = 'https://' + targetUrl;
          } else {
            targetUrl = 'http://' + targetUrl;
          }
        } else {
          targetUrl = 'https://' + targetUrl;
        }
      } else {
        // Search query
        const isDark = this.isDarkMode();
        const engine = localStorage.getItem('ocal-engine') || 'Google';
        if (engine === 'DuckDuckGo') {
          targetUrl = `https://duckduckgo.com/?q=${encodeURIComponent(targetUrl)}&kae=${isDark ? 'd' : '-1'}`;
        } else if (engine === 'Bing') {
          targetUrl = `https://www.bing.com/search?q=${encodeURIComponent(targetUrl)}`;
        } else if (engine === 'Brave') {
          targetUrl = `https://search.brave.com/search?q=${encodeURIComponent(targetUrl)}`;
        } else if (engine === 'Yahoo') {
          targetUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(targetUrl)}`;
        } else if (engine === 'Ecosia') {
          targetUrl = `https://www.ecosia.org/search?q=${encodeURIComponent(targetUrl)}`;
        } else {
          targetUrl = `https://www.google.com/search?q=${encodeURIComponent(targetUrl)}&cs=${isDark ? '1' : '0'}`;
        }
      }
    }

    tab.url = targetUrl;
    tab.blockedAdsCount = 0;
    if (pushHistory) {
      tab.history = tab.history.slice(0, tab.historyIdx + 1);
      tab.history.push(targetUrl);
      tab.historyIdx = tab.history.length - 1;
    }

    // Record in global history if not incognito
    if (!tab.isIncognito && !targetUrl.startsWith('ocal://')) {
      let smartTitle = '';
      try {
        const u = new URL(targetUrl);
        const q = u.searchParams.get('q');
        if (q) {
          try {
            smartTitle = decodeURIComponent(q.replace(/\+/g, ' '));
          } catch {
            smartTitle = q;
          }
        } else {
          smartTitle = u.hostname.replace(/^(www\.|html\.)/i, '');
        }
      } catch {
        smartTitle = targetUrl;
      }
      tab.title = smartTitle;

      const history = JSON.parse(localStorage.getItem('ocal-history') || '[]');
      const filtered = history.filter(h => h.url !== targetUrl);
      filtered.unshift({ url: targetUrl, title: smartTitle, timestamp: Date.now() });
      localStorage.setItem('ocal-history', JSON.stringify(filtered.slice(0, 100)));
    }

    if (targetUrl.startsWith('ocal://') || targetUrl.includes('dineinstyle.com')) {
      // Internal page
      document.documentElement.classList.remove('is-web-page');
      document.body.classList.remove('is-web-page');
      document.body.classList.add('is-internal-page');
      tab.frameWrapperEl.innerHTML = '';
      tab.frameEl = null;
      if (window.OcalNative && tab.id === this.activeTabId) {
        window.OcalNative.setWebVisible(false);
      }

      const internalView = InternalPages.render(targetUrl, (dest) => {
        this.navigateTab(tabId, dest, true);
      });
      if (typeof internalView === 'string') {
        tab.frameWrapperEl.innerHTML = internalView;
      } else {
        tab.frameWrapperEl.appendChild(internalView);
      }
      if (targetUrl.includes('dineinstyle.com')) {
        tab.title = 'Dine in Style';
      } else if (targetUrl === 'ocal://home') {
        tab.title = 'Start Page';
      } else {
        const p = targetUrl.replace('ocal://', '').split('?')[0].split('#')[0];
        tab.title = p.charAt(0).toUpperCase() + p.slice(1);
      }
      if (this.onTabChanged && tab.id === this.activeTabId) this.onTabChanged(tab);
    } else {
      // External web page
      let host = 'Website';
      try {
        host = new URL(targetUrl).hostname;
      } catch {
        host = targetUrl;
      }

      // Case A: Android Native Web Engine (Bypasses all localhost / iframe / CAPTCHA blocks)
      if (window.OcalNative) {
        tab.frameEl = null;
        tab.title = host;
        tab.frameWrapperEl.innerHTML = '';
        if (tab.id === this.activeTabId) {
          document.documentElement.classList.add('is-web-page');
          document.body.classList.add('is-web-page');
          document.body.classList.remove('is-internal-page');
          if (typeof window.OcalNative.setDesktopMode === 'function') {
            window.OcalNative.setDesktopMode(!!tab.isDesktop, false);
          }
          if (typeof window.OcalNative.setDarkMode === 'function') {
            window.OcalNative.setDarkMode(this.isDarkMode());
          }
          window.OcalNative.setWebVisible(true);
          window.OcalNative.openUrl(targetUrl);
        }
        if (this.onTabChanged && tab.id === this.activeTabId) this.onTabChanged(tab);
        return;
      }

      // Clear previous DOM frame contents for iframe/desktop mode
      tab.frameWrapperEl.innerHTML = '';

      // Case B: Electron Desktop Webview Tag
      const isElectron = typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent);
      if (isElectron) {
        const webview = document.createElement('webview');
        webview.className = 'tab-web-frame';
        webview.setAttribute('src', targetUrl);
        webview.setAttribute('allowpopups', 'true');
        webview.setAttribute('webpreferences', 'contextIsolation=false,nodeIntegration=false');
        
        webview.addEventListener('page-title-updated', (e) => {
          tab.title = e.title;
          if (this.onTabChanged && tab.id === this.activeTabId) this.onTabChanged(tab);
        });
        webview.addEventListener('did-navigate', (e) => {
          tab.url = e.url;
          if (this.onTabChanged && tab.id === this.activeTabId) this.onTabChanged(tab);
        });
        webview.addEventListener('did-fail-load', (e) => {
          if (e.errorCode !== -3) {
            this.showTabError(tab, targetUrl);
          }
        });

        tab.frameEl = webview;
        tab.frameWrapperEl.appendChild(webview);
        tab.title = host;
        if (this.onTabChanged && tab.id === this.activeTabId) this.onTabChanged(tab);
        return;
      }

      // Case C: Standard Browser Fallback (Vite dev server preview)
      const loaderEl = document.createElement('div');
      loaderEl.className = 'tab-loading-overlay';
      loaderEl.innerHTML = `
        <div class="tab-loading-card">
          <div class="tab-loading-spinner"></div>
          <div class="tab-loading-title">Connecting to web</div>
          <div class="tab-loading-domain">${escapeHtml(host)}</div>
        </div>
      `;
      tab.frameWrapperEl.appendChild(loaderEl);

      // Live web page via high performance unblocking proxy
      const iframe = document.createElement('iframe');
      iframe.className = 'tab-web-frame';
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads');
      iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      
      const isDark = this.isDarkMode();
      const desktopParam = tab.isDesktop ? '&desktop=true' : '';
      const darkParam = `&dark=${isDark ? 'true' : 'false'}`;
      iframe.src = `/api/proxy?url=${encodeURIComponent(targetUrl)}${desktopParam}${darkParam}`;
      
      let loadFinished = false;
      const removeLoader = () => {
        if (loadFinished) return;
        loadFinished = true;
        loaderEl.classList.add('fade-out');
        setTimeout(() => {
          if (loaderEl.parentNode) loaderEl.parentNode.removeChild(loaderEl);
        }, 320);
      };

      // Safety timer (max 10s before auto-dismissing loader)
      const timeoutId = setTimeout(() => {
        removeLoader();
      }, 10000);

      iframe.onload = () => {
        clearTimeout(timeoutId);
        removeLoader();
        try {
          iframe.contentWindow?.postMessage({ type: 'OCAL_SET_THEME', isDark: this.isDarkMode() }, '*');
        } catch (e) {}
      };

      iframe.onerror = () => {
        clearTimeout(timeoutId);
        this.showTabError(tab, targetUrl);
      };

      tab.frameEl = iframe;
      tab.frameWrapperEl.appendChild(iframe);
      tab.title = host;
      if (this.onTabChanged && tab.id === this.activeTabId) this.onTabChanged(tab);
    }
  }

  syncThemeToTabs(isDark) {
    if (window.OcalNative && typeof window.OcalNative.setDarkMode === 'function') {
      window.OcalNative.setDarkMode(isDark);
    }
    this.tabs.forEach(tab => {
      if (tab.frameEl && tab.frameEl.tagName === 'IFRAME') {
        try {
          tab.frameEl.contentWindow?.postMessage({ type: 'OCAL_SET_THEME', isDark }, '*');
        } catch (e) {}
      }
    });
  }

  showTabError(tab, failedUrl) {
    if (!tab || !tab.frameWrapperEl) return;
    let host = failedUrl;
    try { host = new URL(failedUrl).hostname; } catch {}

    tab.frameWrapperEl.innerHTML = `
      <div class="subpage-container" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:24px;">
        <div style="width:64px; height:64px; border-radius:50%; background:rgba(239, 68, 68, 0.1); color:#ef4444; display:flex; align-items:center; justify-content:center; font-size:28px; margin-bottom:16px;">
          <i class="fas fa-triangle-exclamation"></i>
        </div>
        <h2 style="font-size:19px; font-weight:700; margin-bottom:8px; color:var(--text-main);">Unable to Load Page</h2>
        <p style="font-size:13.5px; color:var(--text-muted); max-width:300px; line-height:1.45; margin-bottom:24px;">
          Ocal could not connect to <strong>${escapeHtml(host)}</strong>. Please check your connection or search for this query.
        </p>
        <div style="display:flex; flex-direction:column; gap:10px; width:100%; max-width:240px;">
          <button id="tab-err-retry" style="background:var(--accent-primary); color:#ffffff; border:none; padding:12px; border-radius:12px; font-weight:600; font-size:14px; cursor:pointer;">
            Try Again
          </button>
          <button id="tab-err-search" style="background:var(--bg-elevated); color:var(--text-main); border:1px solid var(--border-medium); padding:12px; border-radius:12px; font-weight:600; font-size:14px; cursor:pointer;">
            Search with ${escapeHtml(localStorage.getItem('ocal-engine') || 'Google')}
          </button>
          <button id="tab-err-home" style="background:transparent; color:var(--text-muted); border:none; padding:8px; font-weight:500; font-size:13px; cursor:pointer;">
            Return to Start Page
          </button>
        </div>
      </div>
    `;

    tab.frameWrapperEl.querySelector('#tab-err-retry')?.addEventListener('click', () => {
      this.navigateTab(tab.id, failedUrl, false);
    });
    tab.frameWrapperEl.querySelector('#tab-err-search')?.addEventListener('click', () => {
      const q = failedUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
      this.navigateTab(tab.id, q, true);
    });
    tab.frameWrapperEl.querySelector('#tab-err-home')?.addEventListener('click', () => {
      this.navigateTab(tab.id, 'ocal://home', true);
    });
  }

  goBack(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    if (window.OcalNative && !tab.url.startsWith('ocal://')) {
      window.OcalNative.goBack();
      return;
    }
    if (tab.frameEl && typeof tab.frameEl.goBack === 'function') {
      tab.frameEl.goBack();
      return;
    }
    if (tab.historyIdx <= 0) {
      if (!tab.url.startsWith('ocal://home')) {
        this.navigateTab(tabId, 'ocal://home', false);
      }
      return;
    }
    tab.historyIdx--;
    const prevUrl = tab.history[tab.historyIdx];
    this.navigateTab(tabId, prevUrl, false);
  }

  goForward(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    if (window.OcalNative && !tab.url.startsWith('ocal://')) {
      if (window.nativeCanGoForward) {
        window.OcalNative.goForward();
        return;
      }
    }
    if (tab.frameEl && typeof tab.frameEl.goForward === 'function') {
      tab.frameEl.goForward();
      return;
    }
    if (tab.historyIdx >= tab.history.length - 1) return;
    tab.historyIdx++;
    const nextUrl = tab.history[tab.historyIdx];
    this.navigateTab(tabId, nextUrl, false);
  }

  reloadTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    if (window.OcalNative && !tab.url.startsWith('ocal://')) {
      window.OcalNative.reload();
      return;
    }
    if (tab.frameEl && typeof tab.frameEl.reload === 'function') {
      tab.frameEl.reload();
      return;
    }
    this.navigateTab(tabId, tab.url, false);
  }

  toggleDesktopMode(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return false;
    tab.isDesktop = !tab.isDesktop;
    if (window.OcalNative && tab.id === this.activeTabId && !tab.url.startsWith('ocal://')) {
      if (typeof window.OcalNative.setDesktopMode === 'function') {
        window.OcalNative.setDesktopMode(tab.isDesktop, true);
      } else {
        this.navigateTab(tabId, tab.url, false);
      }
    } else {
      this.navigateTab(tabId, tab.url, false);
    }
    return tab.isDesktop;
  }

  notifyTabsCount() {
    if (this.onTabsCountChanged) {
      this.onTabsCountChanged(this.tabs.length);
    }
  }

  setTabThumbnail(tabId, url, thumbnail) {
    if (!thumbnail) return;
    let tab = null;
    if (tabId) tab = this.tabs.find(t => t.id === tabId);
    if (!tab && url) tab = this.tabs.find(t => t.url === url);
    if (!tab) tab = this.getActiveTab();
    if (!tab) return;

    tab.thumbnail = thumbnail;
    try {
      sessionStorage.setItem(`ocal_thumb_${tab.id}`, thumbnail);
    } catch (e) {}

    const card = document.querySelector(`.tab-card[data-tab-id="${tab.id}"]`);
    if (card) {
      const previewEl = card.querySelector('.tab-card-preview');
      if (previewEl) {
        previewEl.innerHTML = this.renderTabPreviewHtml(tab);
      }
    }
  }

  getTabFaviconHtml(tab) {
    if (tab.isIncognito) {
      return '<span class="tab-card-private-icon-solid" style="display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; border-radius:4px; background:#9333ea; color:#ffffff; flex-shrink:0;"><i class="fas fa-user-secret" style="color:#ffffff; font-size:9.5px;"></i></span>';
    }
    if (tab.url === 'ocal://home') {
      return '<i class="fas fa-compass" style="color:inherit; font-size:11px;"></i>';
    }
    if (tab.url.startsWith('ocal://settings')) {
      return '<i class="fas fa-sliders" style="color:inherit; font-size:11px;"></i>';
    }
    if (tab.url.startsWith('ocal://bookmarks')) {
      return '<i class="fas fa-bookmark" style="color:inherit; font-size:11px;"></i>';
    }
    if (tab.url.startsWith('ocal://history')) {
      return '<i class="far fa-clock" style="color:inherit; font-size:11px;"></i>';
    }
    if (tab.url.startsWith('ocal://downloads')) {
      return '<i class="fas fa-arrow-down" style="color:inherit; font-size:11px;"></i>';
    }
    if (tab.url.startsWith('ocal://sync')) {
      return '<i class="fas fa-arrows-rotate" style="color:inherit; font-size:11px;"></i>';
    }
    if (tab.url.startsWith('ocal://passwords')) {
      return '<i class="fas fa-key" style="color:inherit; font-size:11px;"></i>';
    }
    if (tab.url.startsWith('ocal://games') || tab.url.startsWith('ocal://snake') || tab.url.startsWith('ocal://tetris')) {
      return '<i class="fas fa-gamepad" style="color:inherit; font-size:11px;"></i>';
    }

    let domain = '';
    try {
      domain = new URL(tab.url).hostname;
    } catch {
      domain = tab.url;
    }
    return `
      <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64"
           class="tab-card-favicon-img"
           alt=""
           onload="this.style.display='block'; if(this.nextElementSibling) this.nextElementSibling.style.display='none';"
           onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"
           style="width:14px; height:14px; border-radius:3px; object-fit:contain; display:none; filter:grayscale(1);" />
      <span class="tab-card-favicon-fallback" style="display:flex; align-items:center; justify-content:center; width:14px; height:14px;">
        <i class="fas fa-globe" style="color:inherit; font-size:11px;"></i>
      </span>
    `;
  }

  getDomainGradient(domain = '') {
    // Pure sleek monochrome gradient
    return 'linear-gradient(180deg, #18181b 0%, #111113 100%)';
  }

  getInternalPageInfo(url) {
    if (!url || !url.startsWith('ocal://')) return { name: 'Internal Page', icon: 'fas fa-layer-group' };
    const path = url.replace('ocal://', '').split('?')[0].split('#')[0].toLowerCase();
    switch (path) {
      case 'home':
      case '':
        return { name: 'Start Page', icon: 'fas fa-compass' };
      case 'settings':
        return { name: 'Settings', icon: 'fas fa-sliders' };
      case 'history':
        return { name: 'History', icon: 'far fa-clock' };
      case 'bookmarks':
        return { name: 'Bookmarks', icon: 'fas fa-bookmark' };
      case 'downloads':
        return { name: 'Downloads', icon: 'fas fa-arrow-down' };
      case 'sync':
        return { name: 'Sync', icon: 'fas fa-arrows-rotate' };
      case 'passwords':
        return { name: 'Passwords', icon: 'fas fa-key' };
      case 'games':
        return { name: 'Games', icon: 'fas fa-gamepad' };
      case 'snake':
        return { name: 'Cyber Snake', icon: 'fas fa-ghost' };
      case 'tetris':
        return { name: 'Classic Tetris', icon: 'fas fa-cubes' };
      default: {
        const title = path.charAt(0).toUpperCase() + path.slice(1);
        return { name: title || 'Internal Page', icon: 'fas fa-layer-group' };
      }
    }
  }

  renderTabPreviewHtml(tab) {
    // 1. For Internal Pages (ocal://*): Match Ocal Home Page style
    if (!tab.url || tab.url.startsWith('ocal://')) {
      const isStartPage = !tab.url || tab.url === 'ocal://home' || tab.url === 'ocal://';
      if (tab.isIncognito && isStartPage) {
        return `
          <div class="tab-internal-dial-preview">
            <div class="tab-internal-dial-tile" style="background-color: #9333ea !important; color: #ffffff !important; border: none !important; box-shadow: 0 4px 14px rgba(147, 51, 234, 0.4) !important;">
              <i class="fas fa-user-secret" style="font-size: 22px; color: #ffffff;"></i>
            </div>
            <span class="tab-internal-dial-name" style="font-weight: 600;">Private Browsing</span>
          </div>
        `;
      }
      if (isStartPage) {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const logoSrc = isDark ? '/assets/Dark.png' : '/assets/Light.png';
        return `
          <div class="tab-home-preview">
            <div class="tab-home-preview-logo">
              <img src="${logoSrc}" alt="Ocal Logo" class="tab-home-logo-img" />
            </div>
            <div class="tab-home-preview-wordmark">Ocal</div>
            <div class="tab-home-mini-grid">
              <div class="tab-home-mini-tile"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="1" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg></div>
              <div class="tab-home-mini-tile"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="11" r="3"/></svg></div>
              <div class="tab-home-mini-tile"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></div>
              <div class="tab-home-mini-tile"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.56 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701z"/></svg></div>
            </div>
          </div>
        `;
      }

      const info = this.getInternalPageInfo(tab.url || 'ocal://home');
      return `
        <div class="tab-internal-dial-preview">
          <div class="tab-internal-dial-tile">
            <i class="${info.icon}"></i>
          </div>
          <span class="tab-internal-dial-name">${escapeHtml(info.name)}</span>
        </div>
      `;
    }

    // 2. Real captured WebView Screenshot Thumbnail for external websites
    if (tab.thumbnail) {
      let cleanDomain = '';
      try {
        cleanDomain = new URL(tab.url).hostname.replace(/^www\./i, '');
      } catch {
        cleanDomain = tab.url;
      }
      return `
        <div class="tab-preview-screenshot">
          <img src="${tab.thumbnail}" class="tab-screenshot-img" alt="${escapeHtml(tab.title)}" loading="lazy" />
          <div class="tab-screenshot-gloss"></div>
          <div class="tab-screenshot-domain-pill">
            <i class="fas fa-lock" style="font-size:7.5px; color:#ffffff;"></i>
            <span>${escapeHtml(cleanDomain)}</span>
          </div>
        </div>
      `;
    }

    // 10. In Browser / Vite / Electron environment, show live scaled iframe preview
    if (!window.OcalNative && tab.url.startsWith('http')) {
      const desktopParam = tab.isDesktop ? '&desktop=true' : '';
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(tab.url)}${desktopParam}`;
      let domain = '';
      try { domain = new URL(tab.url).hostname.replace(/^www\./i, ''); } catch { domain = tab.url; }
      return `
        <div class="tab-mini-viewport-wrap">
          <iframe src="${proxyUrl}" class="tab-mini-preview-iframe" loading="lazy" sandbox="allow-scripts allow-same-origin allow-forms" tabindex="-1"></iframe>
          <div class="tab-mini-preview-shield"></div>
          <div class="tab-screenshot-domain-pill">
            <i class="fas fa-lock" style="font-size:7.5px; color:#ffffff;"></i>
            <span>${escapeHtml(domain)}</span>
          </div>
        </div>
      `;
    }

    // 11. Custom Brand: Dine in Style (Luxury Monochrome Fashion Card)
    if (tab.url.includes('dineinstyle.com')) {
      return `
        <div class="tab-mockup-dine-mono">
          <div class="dine-line-1">Autumn '23</div>
          <div class="dine-line-2">Collection</div>
          <div class="dine-btn-mono">Shop Collection</div>
          <div class="tab-mockup-footer" style="position:absolute; bottom:4px; left:0; right:0;">
            <span class="tab-mockup-domain-pill"><i class="fas fa-lock" style="font-size:7px; color:#ffffff;"></i><span>dineinstyle.com</span></span>
          </div>
        </div>
      `;
    }

    // 12. Custom Brand: X / Twitter (Sleek Dark Theme)
    if (tab.url.includes('twitter.com') || tab.url.includes('x.com')) {
      return `
        <div class="tab-mock-social" style="background:#000000;">
          <div class="tab-mock-social-banner" style="background:#161618; border-bottom:1px solid rgba(255,255,255,0.08);"></div>
          <div class="tab-mock-social-profile">
            <div class="tab-mock-social-avatar" style="background:#000000; color:#ffffff; border:1px solid rgba(255,255,255,0.2);"><i class="fab fa-x-twitter"></i></div>
            <div class="tab-mock-social-btn" style="background:#ffffff; color:#000000; font-weight:700;">Follow</div>
          </div>
          <div class="tab-mock-social-info">
            <div class="tab-mock-social-name" style="color:#ffffff;">X <i class="fas fa-circle-check" style="color:#ffffff; font-size:8px;"></i></div>
            <div class="tab-mock-social-handle" style="color:#a1a1aa;">@X • Trending worldwide</div>
            <div class="tab-mock-social-tweet" style="color:#e4e4e7;">Explore what's happening right now across news, tech &amp; culture.</div>
          </div>
          <div class="tab-mockup-footer">
            <span class="tab-mockup-domain-pill"><i class="fas fa-lock" style="font-size:7px; color:#ffffff;"></i><span>x.com</span></span>
          </div>
        </div>
      `;
    }

    let domain = '';
    try {
      const u = new URL(tab.url);
      domain = u.hostname.replace(/^www\./i, '');
    } catch {
      domain = tab.url;
    }
    const siteTitle = tab.title && tab.title !== tab.url ? tab.title : domain;

    // 13. Google / Search engines (Monochrome Clean Search)
    if (domain.includes('google') || tab.url.includes('/search') || domain.includes('bing') || domain.includes('duckduckgo')) {
      let query = '';
      try {
        const u = new URL(tab.url);
        query = u.searchParams.get('q') || '';
      } catch {}
      const displayQuery = query || siteTitle || 'Web Search';
      return `
        <div class="tab-mock-google" style="background:#000000;">
          <div class="tab-google-top" style="border-bottom:1px solid rgba(255,255,255,0.08);">
            <span class="tab-google-logo" style="color:#ffffff; font-weight:700; font-size:12px; letter-spacing:-0.03em;">Google</span>
            <div class="tab-google-searchbar" style="background:#141416; border:1px solid rgba(255,255,255,0.08);">
              <i class="fas fa-search" style="font-size:6.5px; color:#a1a1aa;"></i>
              <span class="tab-google-query" style="color:#ffffff;">${escapeHtml(displayQuery)}</span>
            </div>
          </div>
          <div class="tab-google-results">
            <div class="tab-google-result-item" style="background:#121214; border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:6px 8px;">
              <div class="tab-google-cite" style="color:#a1a1aa;">${escapeHtml(domain)} › ...</div>
              <div class="tab-google-heading" style="color:#ffffff;">${escapeHtml(siteTitle)}</div>
              <div class="tab-google-snippet" style="color:#71717a;">Verified web results, articles, top media, and official resources.</div>
            </div>
          </div>
          <div class="tab-mockup-footer">
            <span class="tab-mockup-domain-pill"><i class="fas fa-lock" style="font-size:7px; color:#ffffff;"></i><span>${escapeHtml(domain)}</span></span>
          </div>
        </div>
      `;
    }

    // 14. YouTube / Video (Monochrome Video Card)
    if (domain.includes('youtube') || domain.includes('youtu.be')) {
      return `
        <div class="tab-mock-youtube" style="background:#000000;">
          <div class="tab-yt-topbar" style="border-bottom:1px solid rgba(255,255,255,0.08);">
            <div class="tab-yt-logo" style="color:#ffffff;"><i class="fab fa-youtube" style="color:#ffffff; font-size:12px;"></i><span>YouTube</span></div>
            <i class="fas fa-search" style="font-size:8px; color:#a1a1aa;"></i>
          </div>
          <div class="tab-yt-player-box">
            <div class="tab-yt-player-thumb" style="background:#141416; border:1px solid rgba(255,255,255,0.08);">
              <div class="tab-yt-play-btn" style="background:rgba(255,255,255,0.9); color:#000000;"><i class="fas fa-play" style="font-size:9px; margin-left:2px;"></i></div>
              <span class="tab-yt-duration" style="background:rgba(0,0,0,0.8); color:#ffffff;">12:45</span>
            </div>
          </div>
          <div class="tab-yt-details" style="padding:6px 8px;">
            <div class="tab-yt-video-title" style="color:#ffffff;">${escapeHtml(siteTitle)}</div>
            <div class="tab-yt-channel-row">
              <span class="tab-yt-channel-name" style="color:#a1a1aa;">Official Channel</span>
            </div>
          </div>
          <div class="tab-mockup-footer">
            <span class="tab-mockup-domain-pill"><i class="fas fa-lock" style="font-size:7px; color:#ffffff;"></i><span>youtube.com</span></span>
          </div>
        </div>
      `;
    }

    // 15. Reddit (Monochrome Discussion Card)
    if (domain.includes('reddit')) {
      return `
        <div class="tab-mock-reddit" style="background:#000000;">
          <div class="tab-reddit-topbar" style="border-bottom:1px solid rgba(255,255,255,0.08);">
            <div class="tab-reddit-logo" style="color:#ffffff;"><i class="fab fa-reddit-alien" style="color:#ffffff; font-size:12px;"></i><span>reddit</span></div>
            <span class="tab-reddit-sub" style="color:#a1a1aa;">r/trending</span>
          </div>
          <div class="tab-reddit-card" style="background:#141416; border:1px solid rgba(255,255,255,0.08); border-radius:8px; margin:6px 8px; padding:6px 8px;">
            <div class="tab-reddit-meta" style="color:#71717a;">u/headline • 3h ago</div>
            <div class="tab-reddit-title" style="color:#ffffff; font-size:9.5px; font-weight:600;">${escapeHtml(siteTitle)}</div>
            <div class="tab-reddit-actions" style="margin-top:6px; display:flex; gap:6px;">
              <div class="tab-reddit-vote" style="background:rgba(255,255,255,0.06); color:#ffffff; padding:2px 6px; border-radius:4px;"><i class="fas fa-arrow-up" style="color:#ffffff;"></i> <span>4.1k</span></div>
              <div class="tab-reddit-pill" style="background:rgba(255,255,255,0.06); color:#a1a1aa; padding:2px 6px; border-radius:4px;"><i class="far fa-comment-alt"></i> <span>324</span></div>
            </div>
          </div>
          <div class="tab-mockup-footer">
            <span class="tab-mockup-domain-pill"><i class="fas fa-lock" style="font-size:7px; color:#ffffff;"></i><span>reddit.com</span></span>
          </div>
        </div>
      `;
    }

    // 16. GitHub (Monochrome Code Card)
    if (domain.includes('github')) {
      return `
        <div class="tab-mock-github" style="background:#000000;">
          <div class="tab-gh-topbar" style="border-bottom:1px solid rgba(255,255,255,0.08);">
            <i class="fab fa-github" style="font-size:13px; color:#ffffff;"></i>
            <span class="tab-gh-repo-path" style="color:#ffffff;">repo / ${escapeHtml(siteTitle)}</span>
          </div>
          <div class="tab-gh-stats">
            <span class="tab-gh-badge" style="background:#141416; color:#a1a1aa; border:1px solid rgba(255,255,255,0.08);"><i class="far fa-star"></i> 24.8k</span>
            <span class="tab-gh-badge" style="background:#141416; color:#a1a1aa; border:1px solid rgba(255,255,255,0.08);"><i class="fas fa-code-fork"></i> 3.2k</span>
          </div>
          <div class="tab-gh-file-box" style="background:#141416; border:1px solid rgba(255,255,255,0.08); border-radius:8px; margin:6px 8px; padding:4px;">
            <div class="tab-gh-file-row"><i class="far fa-folder" style="color:#ffffff;"></i><span>src</span><span class="tab-gh-msg" style="color:#71717a;">core modules</span></div>
            <div class="tab-gh-file-row"><i class="far fa-file-code" style="color:#a1a1aa;"></i><span>package.json</span><span class="tab-gh-msg" style="color:#71717a;">release v2.0.0</span></div>
          </div>
          <div class="tab-mockup-footer">
            <span class="tab-mockup-domain-pill"><i class="fas fa-lock" style="font-size:7px; color:#ffffff;"></i><span>github.com</span></span>
          </div>
        </div>
      `;
    }

    // 17. Wikipedia (Monochrome Article Card)
    if (domain.includes('wikipedia')) {
      return `
        <div class="tab-mock-wiki" style="background:#000000;">
          <div class="tab-wiki-topbar" style="border-bottom:1px solid rgba(255,255,255,0.08);">
            <div class="tab-wiki-logo" style="color:#ffffff;"><i class="fab fa-wikipedia-w"></i><span>WIKIPEDIA</span></div>
            <i class="fas fa-search" style="font-size:8px; opacity:0.6; color:#ffffff;"></i>
          </div>
          <div class="tab-wiki-body" style="padding:8px;">
            <div class="tab-wiki-heading" style="color:#ffffff;">${escapeHtml(siteTitle)}</div>
            <div class="tab-wiki-subheading" style="color:#a1a1aa;">From Wikipedia, the free encyclopedia</div>
            <div class="tab-wiki-paragraph" style="color:#71717a; font-size:8px; line-height:1.3; margin-top:4px;">
              Documented article with encyclopedic analysis and verified references.
            </div>
          </div>
          <div class="tab-mockup-footer">
            <span class="tab-mockup-domain-pill"><i class="fas fa-lock" style="font-size:7px; color:#ffffff;"></i><span>wikipedia.org</span></span>
          </div>
        </div>
      `;
    }

    // 18. Universal Sleek Monochrome Landing Page (All other external websites)
    return `
      <div class="tab-rich-web-preview" style="background:#000000;">
        <div class="tab-rich-header" style="background:#141416; border-bottom:1px solid rgba(255,255,255,0.08);">
          <div class="tab-rich-nav">
            <div class="tab-rich-favicon-wrap">
              <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128"
                   alt=""
                   onload="this.style.display='block'; if(this.nextElementSibling) this.nextElementSibling.style.display='none';"
                   onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"
                   style="width:16px; height:16px; object-fit:contain; display:none;" />
              <div class="tab-rich-favicon-fallback" style="display:flex; align-items:center; justify-content:center; width:16px; height:16px; color:#ffffff; font-size:9px;">
                <i class="fas fa-globe"></i>
              </div>
            </div>
            <span class="tab-rich-nav-brand" style="color:#ffffff;">${escapeHtml(domain)}</span>
            <div class="tab-rich-nav-dots" style="color:#a1a1aa;"><i class="fas fa-ellipsis"></i></div>
          </div>
          <div class="tab-rich-hero-text" style="padding-top:6px;">
            <div class="tab-rich-hero-title" style="color:#ffffff; font-size:12px;">${escapeHtml(siteTitle)}</div>
            <div class="tab-rich-hero-cta" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); color:#ffffff; font-size:8px;">Explore Website</div>
          </div>
        </div>
        <div class="tab-rich-body" style="padding:8px;">
          <div class="tab-rich-card" style="background:#121214; border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:6px 8px;">
            <div class="tab-rich-card-lines">
              <div class="tab-rich-text-line" style="width:85%; background:rgba(255,255,255,0.12); height:5px; border-radius:3px; margin-bottom:4px;"></div>
              <div class="tab-rich-text-line" style="width:60%; background:rgba(255,255,255,0.06); height:5px; border-radius:3px;"></div>
            </div>
          </div>
          <div class="tab-rich-grid" style="display:flex; gap:6px; margin-top:6px;">
            <div class="tab-rich-grid-cell" style="background:#141416; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:4px 6px; display:flex; align-items:center; gap:4px; font-size:8px; color:#ffffff;"><i class="fas fa-bolt" style="color:#ffffff; font-size:8px;"></i><span>Features</span></div>
            <div class="tab-rich-grid-cell" style="background:#141416; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:4px 6px; display:flex; align-items:center; gap:4px; font-size:8px; color:#ffffff;"><i class="fas fa-shield" style="color:#a1a1aa; font-size:8px;"></i><span>Secure</span></div>
          </div>
        </div>
        <div class="tab-mockup-footer">
          <span class="tab-mockup-domain-pill">
            <i class="fas fa-lock" style="font-size:7px; color:#ffffff;"></i>
            <span>${escapeHtml(domain)}</span>
          </span>
        </div>
      </div>
    `;
  }

  renderTabsGrid(gridContainerEl, onSelect) {
    gridContainerEl.innerHTML = '';

    // Synchronize container sheet class with current layout preset
    const sheet = document.getElementById('tabs-tray-sheet');
    if (sheet) {
      sheet.classList.remove('tabs-view-grid', 'tabs-view-stack', 'tabs-view-list');
      sheet.classList.add(`tabs-view-${this.currentPreset || 'grid'}`);
    }
    this.updateViewModeButtonIcon();

    const normalTabs = this.tabs.filter(t => !t.isIncognito);
    const privateTabs = this.tabs.filter(t => t.isIncognito);

    if (!this.tabFilterMode) {
      const activeTab = this.getActiveTab();
      this.tabFilterMode = (activeTab && activeTab.isIncognito) ? 'private' : 'normal';
    }

    // Update count labels in segmented buttons and bottom dock badge
    const normalCountEl = document.getElementById('tabs-normal-count');
    if (normalCountEl) normalCountEl.textContent = `Tabs (${normalTabs.length})`;
    const privateCountEl = document.getElementById('tabs-private-count');
    if (privateCountEl) privateCountEl.textContent = `Private (${privateTabs.length})`;
    const operaBadge = document.getElementById('opera-tab-badge-count');
    if (operaBadge) {
      const activeCount = this.tabFilterMode === 'private' ? privateTabs.length : normalTabs.length;
      operaBadge.textContent = `${activeCount}`;
    }

    const normalBtn = document.getElementById('tab-mode-normal');
    const privateBtn = document.getElementById('tab-mode-private');
    if (normalBtn) normalBtn.classList.toggle('active', this.tabFilterMode === 'normal');
    if (privateBtn) privateBtn.classList.toggle('active', this.tabFilterMode === 'private');

    // Wire mode buttons
    if (normalBtn && !normalBtn._hasBound) {
      normalBtn._hasBound = true;
      const onNormal = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        this.tabFilterMode = 'normal';
        this.renderTabsGrid(gridContainerEl, onSelect);
      };
      normalBtn.addEventListener('click', onNormal);
      normalBtn.addEventListener('touchend', onNormal);
    }
    if (privateBtn && !privateBtn._hasBound) {
      privateBtn._hasBound = true;
      const onPrivate = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        this.tabFilterMode = 'private';
        this.renderTabsGrid(gridContainerEl, onSelect);
      };
      privateBtn.addEventListener('click', onPrivate);
      privateBtn.addEventListener('touchend', onPrivate);
    }

    // Wire Done button
    const doneBtn = document.getElementById('tabs-done-btn');
    if (doneBtn && !doneBtn._hasBound) {
      doneBtn._hasBound = true;
      doneBtn.addEventListener('click', () => {
        window.ocalApp?.closeTabsTray?.();
      });
    }

    // Wire bottom new tab button
    const bottomNewTabBtn = document.getElementById('tabs-bottom-nav')?.querySelector('#tabs-nav-new-tab') || document.getElementById('tabs-nav-new-tab');
    if (bottomNewTabBtn && !bottomNewTabBtn._hasBound) {
      bottomNewTabBtn._hasBound = true;
      bottomNewTabBtn.addEventListener('click', () => {
        this.createTab('ocal://home', this.tabFilterMode === 'private');
        if (onSelect) onSelect(this.activeTabId);
      });
    }

    // Wire search filter
    const searchInput = document.getElementById('tabs-search-input');
    const searchQuery = (searchInput?.value || '').toLowerCase().trim();

    let visibleTabs = this.tabFilterMode === 'private' ? privateTabs : normalTabs;
    if (searchQuery) {
      visibleTabs = visibleTabs.filter(t => (t.title || '').toLowerCase().includes(searchQuery) || (t.url || '').toLowerCase().includes(searchQuery));
    }

    // Empty state for private mode when 0 private tabs
    if (this.tabFilterMode === 'private' && privateTabs.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'tabs-empty-private-state';
      emptyDiv.innerHTML = `
        <div class="tabs-empty-private-icon"><i class="fas fa-user-secret"></i></div>
        <h3>Private Browsing</h3>
        <p>Browsing history, search queries, and cookies are not kept when you browse privately in Ocal.</p>
        <button class="tabs-create-private-btn" id="tabs-create-first-private-btn">
          <i class="fas fa-plus"></i>
          <span>Open Private Tab</span>
        </button>
      `;
      emptyDiv.querySelector('#tabs-create-first-private-btn')?.addEventListener('click', () => {
        this.createTab('ocal://home', true);
        if (onSelect) onSelect(this.activeTabId);
      });
      gridContainerEl.appendChild(emptyDiv);
      return;
    }

    // If List View mode is active, render sleek rows
    if (this.currentPreset === 'list') {
      visibleTabs.forEach(tab => {
        const row = document.createElement('div');
        row.className = `tab-list-row ${tab.id === this.activeTabId ? 'active' : ''}`;
        row.setAttribute('data-tab-id', tab.id);

        const faviconHtml = this.getTabFaviconHtml(tab);
        const rawTitle = tab.title || tab.url;
        let displayTitle = rawTitle.startsWith('ocal://')
          ? (rawTitle === 'ocal://home' ? 'Start Page' : rawTitle.replace('ocal://', '').split('?')[0].replace(/^./, c => c.toUpperCase()))
          : rawTitle.replace(/^Ocal\s+/i, '');
        if (displayTitle === 'Home') displayTitle = 'Start Page';

        let cleanUrl = tab.url;
        try {
          if (cleanUrl.startsWith('http')) {
            cleanUrl = new URL(cleanUrl).hostname.replace(/^www\./i, '');
          }
        } catch (_) {}

        row.innerHTML = `
          <div class="tab-list-favicon">
            ${faviconHtml}
            ${tab.id === this.activeTabId ? '<div class="tab-list-active-dot"></div>' : ''}
          </div>
          <div class="tab-list-info">
            <div class="tab-list-title">${escapeHtml(displayTitle)}</div>
            <div class="tab-list-meta">
              ${tab.isIncognito ? '<span class="tab-incognito-pill"><i class="fas fa-user-secret" style="font-size:7px;"></i> Private</span>' : ''}
              <span class="tab-list-url">${escapeHtml(cleanUrl)}</span>
            </div>
          </div>
          <button class="tab-list-close" data-id="${tab.id}" title="Close Tab">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        `;

        row.addEventListener('click', (e) => {
          if (e.target.closest('.tab-list-close')) return;
          if (onSelect) onSelect(tab.id);
          else this.switchTab(tab.id);
        });

        row.querySelector('.tab-list-close')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.closeTab(tab.id);
          this.renderTabsGrid(gridContainerEl, onSelect);
        });

        gridContainerEl.appendChild(row);
      });

      // Add New Tab List Item
      const addRow = document.createElement('div');
      addRow.className = 'tab-list-row tab-list-add-row';
      addRow.innerHTML = `
        <div class="tab-list-favicon tab-list-add-favicon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <div class="tab-list-info">
          <div class="tab-list-title">New ${this.tabFilterMode === 'private' ? 'Private ' : ''}Tab</div>
          <div class="tab-list-meta"><span class="tab-list-url">Open a new tab</span></div>
        </div>
      `;
      addRow.addEventListener('click', () => {
        this.createTab('ocal://home', this.tabFilterMode === 'private');
        if (onSelect) onSelect(this.activeTabId);
      });
      gridContainerEl.appendChild(addRow);
      return;
    }

    // Render tab cards in 2-column grid
    visibleTabs.forEach(tab => {
      const card = document.createElement('div');
      card.className = `tab-card ${tab.id === this.activeTabId ? 'active' : ''}`;
      card.setAttribute('data-tab-id', tab.id);
      card.setAttribute('data-url', tab.url);

      const faviconHtml = this.getTabFaviconHtml(tab);
      const previewHtml = this.renderTabPreviewHtml(tab);

      const rawTitle = tab.title || tab.url;
      let displayTitle = rawTitle.startsWith('ocal://')
        ? (rawTitle === 'ocal://home' ? 'Start Page' : rawTitle.replace('ocal://', '').split('?')[0].replace(/^./, c => c.toUpperCase()))
        : rawTitle.replace(/^Ocal\s+/i, '');
      if (displayTitle === 'Home') displayTitle = 'Start Page';

      card.innerHTML = `
        ${tab.isIncognito ? '<div class="tab-card-incognito-badge"><i class="fas fa-user-secret" style="font-size:7.5px;"></i> Private</div>' : ''}
        <div class="tab-card-header">
          <div class="tab-card-favicon">${faviconHtml}</div>
          <span class="tab-card-title">${escapeHtml(displayTitle)}</span>
          <button class="tab-card-close" data-id="${tab.id}" title="Close Tab">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="tab-card-preview-inner">
          <div class="tab-card-preview">${previewHtml}</div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.tab-card-close')) return;
        if (onSelect) {
          onSelect(tab.id);
        } else {
          this.switchTab(tab.id);
        }
      });

      card.querySelector('.tab-card-close')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tab.id);
        this.renderTabsGrid(gridContainerEl, onSelect);
      });

      gridContainerEl.appendChild(card);
    });

    // "+ New Tab" Action Card styled like Home Page favorites tile
    const addCard = document.createElement('div');
    addCard.className = 'tab-card tab-card-add';
    addCard.innerHTML = `
      <div class="tab-add-content">
        <div class="tab-add-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <span class="tab-add-label">New ${this.tabFilterMode === 'private' ? 'Private ' : ''}Tab</span>
      </div>
    `;
    addCard.addEventListener('click', () => {
      this.createTab('ocal://home', this.tabFilterMode === 'private');
      if (onSelect) onSelect(this.activeTabId);
    });
    gridContainerEl.appendChild(addCard);
  }
}
