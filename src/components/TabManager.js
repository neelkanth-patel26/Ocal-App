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
      isDesktop: false
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
      if (tab.url.startsWith('ocal://')) {
        window.OcalNative.setWebVisible(false);
      } else {
        window.OcalNative.setWebVisible(true);
        window.OcalNative.openUrl(tab.url);
      }
    }

    if (this.onTabChanged) this.onTabChanged(tab);
  }

  getActiveTab() {
    return this.tabs.find(t => t.id === this.activeTabId) || null;
  }

  navigateTab(tabId, url, pushHistory = true) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    // Normalizing URL
    let targetUrl = url.trim();
    if (!targetUrl.startsWith('ocal://') && !targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      if (targetUrl.includes('.') && !targetUrl.includes(' ')) {
        targetUrl = 'https://' + targetUrl;
      } else {
        // Search query
        const engine = localStorage.getItem('ocal-engine') || 'Google';
        if (engine === 'DuckDuckGo') targetUrl = `https://duckduckgo.com/?q=${encodeURIComponent(targetUrl)}`;
        else if (engine === 'Bing') targetUrl = `https://www.bing.com/search?q=${encodeURIComponent(targetUrl)}`;
        else if (engine === 'Brave') targetUrl = `https://search.brave.com/search?q=${encodeURIComponent(targetUrl)}`;
        else targetUrl = `https://www.google.com/search?q=${encodeURIComponent(targetUrl)}`;
      }
    }

    tab.url = targetUrl;
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

    if (targetUrl.startsWith('ocal://')) {
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
      tab.title = targetUrl === 'ocal://home' ? 'Start Page' : 'Ocal ' + targetUrl.replace('ocal://', '').replace(/^./, c => c.toUpperCase());
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
      
      const desktopParam = tab.isDesktop ? '&desktop=true' : '';
      iframe.src = `/api/proxy?url=${encodeURIComponent(targetUrl)}${desktopParam}`;
      
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
    this.navigateTab(tabId, tab.url, false);
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
      return '<i class="fas fa-user-secret" style="color:var(--text-muted); font-size:11px;"></i>';
    }
    if (tab.url === 'ocal://home') {
      return '<i class="fas fa-compass" style="color:var(--accent-primary); font-size:11px;"></i>';
    }
    if (tab.url.startsWith('ocal://bookmarks')) {
      return '<i class="fas fa-thumbtack" style="color:#f59e0b; font-size:11px;"></i>';
    }
    if (tab.url.startsWith('ocal://history')) {
      return '<i class="far fa-clock" style="color:#3b82f6; font-size:11px;"></i>';
    }
    if (tab.url.startsWith('ocal://downloads')) {
      return '<i class="fas fa-arrow-down" style="color:#10b981; font-size:11px;"></i>';
    }
    if (tab.url.startsWith('ocal://sync')) {
      return '<i class="fas fa-qrcode" style="color:#8b5cf6; font-size:11px;"></i>';
    }
    if (tab.url.startsWith('ocal://games')) {
      return '<i class="fas fa-gamepad" style="color:#ec4899; font-size:11px;"></i>';
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
           style="width:14px; height:14px; border-radius:3px; object-fit:contain; display:none;" />
      <span class="tab-card-favicon-fallback" style="display:flex; align-items:center; justify-content:center; width:14px; height:14px;">
        <i class="fas fa-globe" style="color:var(--accent-primary); font-size:11px;"></i>
      </span>
    `;
  }

  getDomainGradient(domain = '') {
    const d = domain.toLowerCase();
    if (d.includes('google')) return 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)';
    if (d.includes('youtube')) return 'linear-gradient(135deg, #ef4444 0%, #991b1b 100%)';
    if (d.includes('twitter') || d.includes('x.com')) return 'linear-gradient(135deg, #0f172a 0%, #334155 100%)';
    if (d.includes('reddit')) return 'linear-gradient(135deg, #ff4500 0%, #ea580c 100%)';
    if (d.includes('discord')) return 'linear-gradient(135deg, #5865f2 0%, #4338ca 100%)';
    if (d.includes('github')) return 'linear-gradient(135deg, #181717 0%, #374151 100%)';
    if (d.includes('wikipedia')) return 'linear-gradient(135deg, #475569 0%, #64748b 100%)';
    if (d.includes('amazon')) return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    if (d.includes('apple')) return 'linear-gradient(135deg, #374151 0%, #111827 100%)';
    if (d.includes('twitch')) return 'linear-gradient(135deg, #9146ff 0%, #772ce8 100%)';
    if (d.includes('instagram')) return 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)';
    if (d.includes('facebook')) return 'linear-gradient(135deg, #1877f2 0%, #0c4a6e 100%)';
    if (d.includes('netflix')) return 'linear-gradient(135deg, #e50914 0%, #1f1f1f 100%)';
    if (d.includes('spotify')) return 'linear-gradient(135deg, #1db954 0%, #121212 100%)';

    let hash = 0;
    for (let i = 0; i < d.length; i++) hash = (hash << 5) - hash + d.charCodeAt(i);
    const hues = [210, 260, 285, 335, 155, 185, 25, 45];
    const hue = hues[Math.abs(hash) % hues.length];
    return `linear-gradient(135deg, hsl(${hue}, 70%, 45%) 0%, hsl(${(hue + 45) % 360}, 65%, 25%) 100%)`;
  }

  renderTabPreviewHtml(tab) {
    // 1. Real captured WebView Screenshot Thumbnail
    if (tab.thumbnail) {
      let cleanDomain = 'ocal';
      try {
        if (!tab.url.startsWith('ocal://')) {
          cleanDomain = new URL(tab.url).hostname.replace(/^www\./i, '');
        } else {
          cleanDomain = tab.url.replace('ocal://', '');
        }
      } catch {
        cleanDomain = tab.url;
      }
      return `
        <div class="tab-preview-screenshot">
          <img src="${tab.thumbnail}" class="tab-screenshot-img" alt="${escapeHtml(tab.title)}" loading="lazy" />
          <div class="tab-screenshot-gloss"></div>
          <div class="tab-screenshot-domain-pill">
            <i class="fas fa-lock" style="font-size:7.5px; color:#10b981;"></i>
            <span>${escapeHtml(cleanDomain)}</span>
          </div>
        </div>
      `;
    }

    // 2. Ocal Start Page
    if (tab.url === 'ocal://home') {
      return `
        <div class="tab-preview-home">
          <div class="tab-home-wordmark">Ocal</div>
          <div class="tab-home-search-mock">
            <i class="fas fa-search" style="font-size:7px; opacity:0.6;"></i>
            <span>Search or type URL</span>
          </div>
          <div class="tab-home-dials-grid">
            <div class="tab-home-dial-item"><div class="tab-home-dial-icon" style="background:#4285f422; color:#4285f4;"><i class="fab fa-google"></i></div><span class="tab-home-dial-label">Google</span></div>
            <div class="tab-home-dial-item"><div class="tab-home-dial-icon" style="background:var(--bg-elevated); color:var(--text-main);"><i class="fab fa-youtube"></i></div><span class="tab-home-dial-label">YouTube</span></div>
            <div class="tab-home-dial-item"><div class="tab-home-dial-icon" style="background:#ff450022; color:#ff4500;"><i class="fab fa-reddit"></i></div><span class="tab-home-dial-label">Reddit</span></div>
            <div class="tab-home-dial-item"><div class="tab-home-dial-icon" style="background:#5865f222; color:#5865f2;"><i class="fab fa-discord"></i></div><span class="tab-home-dial-label">Discord</span></div>
            <div class="tab-home-dial-item"><div class="tab-home-dial-icon" style="background:#24292e22; color:var(--text-main);"><i class="fab fa-github"></i></div><span class="tab-home-dial-label">GitHub</span></div>
            <div class="tab-home-dial-item"><div class="tab-home-dial-icon" style="background:#1d9bf022; color:#1d9bf0;"><i class="fab fa-x-twitter"></i></div><span class="tab-home-dial-label">X</span></div>
            <div class="tab-home-dial-item"><div class="tab-home-dial-icon" style="background:#10b98122; color:#10b981;"><i class="fas fa-robot"></i></div><span class="tab-home-dial-label">AI</span></div>
            <div class="tab-home-dial-item"><div class="tab-home-dial-icon" style="background:#8b5cf622; color:#8b5cf6;"><i class="fas fa-gamepad"></i></div><span class="tab-home-dial-label">Games</span></div>
          </div>
        </div>
      `;
    }

    // 3. Bookmarks Page
    if (tab.url.startsWith('ocal://bookmarks')) {
      let bmarks = [];
      try { bmarks = JSON.parse(localStorage.getItem('ocal-bookmarks') || '[]'); } catch {}
      const previewItems = bmarks.slice(0, 3);
      return `
        <div class="tab-internal-preview tab-internal-bookmarks">
          <div class="tab-internal-banner" style="background:linear-gradient(135deg, #f59e0b 0%, #b45309 100%);">
            <i class="fas fa-thumbtack"></i>
            <span>Bookmarks</span>
          </div>
          <div class="tab-internal-list">
            ${previewItems.length > 0 ? previewItems.map(b => `
              <div class="tab-internal-row">
                <i class="fas fa-bookmark" style="color:#f59e0b; font-size:8px;"></i>
                <span class="tab-internal-row-text">${escapeHtml(b.title || b.url)}</span>
              </div>
            `).join('') : `
              <div class="tab-internal-empty">
                <i class="far fa-star" style="font-size:16px; opacity:0.3; margin-bottom:4px;"></i>
                <span>No bookmarks saved</span>
              </div>
            `}
          </div>
          <div class="tab-internal-footer">
            <span class="tab-internal-badge">${bmarks.length} saved</span>
          </div>
        </div>
      `;
    }

    // 4. History Page
    if (tab.url.startsWith('ocal://history')) {
      let hist = [];
      try { hist = JSON.parse(localStorage.getItem('ocal-history') || '[]'); } catch {}
      const previewItems = hist.slice(0, 3);
      return `
        <div class="tab-internal-preview tab-internal-history">
          <div class="tab-internal-banner" style="background:linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);">
            <i class="far fa-clock"></i>
            <span>Browsing History</span>
          </div>
          <div class="tab-internal-list">
            ${previewItems.length > 0 ? previewItems.map(h => `
              <div class="tab-internal-row">
                <i class="fas fa-globe" style="color:#3b82f6; font-size:8px;"></i>
                <span class="tab-internal-row-text">${escapeHtml(h.title || h.url)}</span>
              </div>
            `).join('') : `
              <div class="tab-internal-empty">
                <i class="far fa-compass" style="font-size:16px; opacity:0.3; margin-bottom:4px;"></i>
                <span>No history yet</span>
              </div>
            `}
          </div>
          <div class="tab-internal-footer">
            <span class="tab-internal-badge">${hist.length} visited</span>
          </div>
        </div>
      `;
    }

    // 5. Desktop Sync Page
    if (tab.url.startsWith('ocal://sync')) {
      return `
        <div class="tab-internal-preview tab-internal-sync">
          <div class="tab-internal-banner" style="background:linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);">
            <i class="fas fa-qrcode"></i>
            <span>Ocal Connect</span>
          </div>
          <div class="tab-internal-sync-body">
            <div class="tab-internal-sync-icon-box">
              <i class="fas fa-laptop" style="font-size:16px; color:#8b5cf6;"></i>
              <div class="tab-sync-wave"><i class="fas fa-link" style="font-size:10px;"></i></div>
              <i class="fas fa-mobile-screen" style="font-size:16px; color:#8b5cf6;"></i>
            </div>
            <span style="font-size:9.5px; font-weight:600; color:var(--text-main);">Desktop Sync Ready</span>
          </div>
          <div class="tab-internal-footer">
            <span class="tab-internal-badge" style="background:rgba(139,92,246,0.15); color:#8b5cf6;">PC & Android</span>
          </div>
        </div>
      `;
    }

    // 6. Downloads Page
    if (tab.url.startsWith('ocal://downloads')) {
      let downloads = [];
      try { downloads = JSON.parse(localStorage.getItem('ocal-downloads') || '[]'); } catch {}
      return `
        <div class="tab-internal-preview tab-internal-downloads">
          <div class="tab-internal-banner" style="background:linear-gradient(135deg, #10b981 0%, #047857 100%);">
            <i class="fas fa-arrow-down"></i>
            <span>Downloads</span>
          </div>
          <div class="tab-internal-list">
            ${downloads.length > 0 ? downloads.slice(0, 3).map(d => `
              <div class="tab-internal-row">
                <i class="fas fa-file-arrow-down" style="color:#10b981; font-size:8px;"></i>
                <span class="tab-internal-row-text">${escapeHtml(d.filename || 'File')}</span>
              </div>
            `).join('') : `
              <div class="tab-internal-empty">
                <i class="far fa-folder-open" style="font-size:16px; opacity:0.3; margin-bottom:4px;"></i>
                <span>No downloads yet</span>
              </div>
            `}
          </div>
          <div class="tab-internal-footer">
            <span class="tab-internal-badge">${downloads.length} files</span>
          </div>
        </div>
      `;
    }

    // 7. Games Hub Page
    if (tab.url.startsWith('ocal://games')) {
      return `
        <div class="tab-internal-preview tab-internal-games">
          <div class="tab-internal-banner" style="background:linear-gradient(135deg, #ec4899 0%, #be185d 100%);">
            <i class="fas fa-gamepad"></i>
            <span>Gaming Hub</span>
          </div>
          <div class="tab-internal-list" style="padding:10px 8px; gap:6px;">
            <div class="tab-game-mini-pill" style="background:rgba(236,72,153,0.1); border:1px solid rgba(236,72,153,0.2);"><i class="fas fa-ghost" style="color:#ec4899; font-size:9px;"></i><span>Retro Arcade</span></div>
            <div class="tab-game-mini-pill" style="background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.2);"><i class="fas fa-chess" style="color:#3b82f6; font-size:9px;"></i><span>Chess Master</span></div>
            <div class="tab-game-mini-pill" style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.2);"><i class="fas fa-puzzle-piece" style="color:#10b981; font-size:9px;"></i><span>2048 Puzzle</span></div>
          </div>
          <div class="tab-internal-footer">
            <span class="tab-internal-badge" style="color:#ec4899;">Play Offline</span>
          </div>
        </div>
      `;
    }

    // 8. In Browser / Vite / Electron environment, show live scaled iframe preview
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
            <i class="fas fa-lock" style="font-size:7.5px; color:#10b981;"></i>
            <span>${escapeHtml(domain)}</span>
          </div>
        </div>
      `;
    }

    // 9. Custom Brand & Domain High-Fidelity Previews
    if (tab.url.includes('dineinstyle.com')) {
      return `
        <div style="width:100%; height:100%; background-image:url('https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=400&q=80'), linear-gradient(180deg, #1e293b, #0f172a); background-size:cover; background-position:center; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:12px; position:relative;">
          <div style="position:absolute; inset:0; background:rgba(0,0,0,0.35);"></div>
          <div style="position:relative; z-index:2;">
            <div style="font-size:15px; font-weight:800; color:#fff; line-height:1.1;">Autumn <span style="color:#d8ff00;">'23</span></div>
            <div style="font-size:15px; font-weight:800; color:#fff; line-height:1.1; margin-bottom:8px;">Collection</div>
            <div style="padding:4px 12px; border-radius:9999px; background:rgba(0,0,0,0.7); color:#fff; font-size:8.5px; font-weight:700; display:inline-block;">Shop Now</div>
          </div>
          <div class="tab-screenshot-domain-pill" style="position:absolute; bottom:8px; left:50%; transform:translateX(-50%); z-index:4;">
            <i class="fas fa-lock" style="font-size:7.5px; color:#10b981;"></i>
            <span>dineinstyle.com</span>
          </div>
        </div>
      `;
    }

    if (tab.url.includes('twitter.com') || tab.url.includes('x.com')) {
      return `
        <div class="tab-mock-social">
          <div class="tab-mock-social-banner" style="background:linear-gradient(135deg, #0f172a, #334155);"></div>
          <div class="tab-mock-social-profile">
            <div class="tab-mock-social-avatar"><i class="fab fa-x-twitter"></i></div>
            <div class="tab-mock-social-btn">Follow</div>
          </div>
          <div class="tab-mock-social-info">
            <div class="tab-mock-social-name">X / Twitter <i class="fas fa-check-circle" style="color:#1d9bf0; font-size:8px;"></i></div>
            <div class="tab-mock-social-handle">@X • Trending worldwide</div>
            <div class="tab-mock-social-tweet">Explore what's happening right now across news, tech &amp; culture.</div>
          </div>
          <div class="tab-mockup-footer">
            <span class="tab-mockup-domain-pill"><i class="fas fa-lock" style="font-size:7px; color:#10b981;"></i><span>x.com</span></span>
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
    const gradient = this.getDomainGradient(domain);
    const siteTitle = tab.title && tab.title !== tab.url ? tab.title : domain;

    // Google / Search engines
    if (domain.includes('google') || tab.url.includes('/search') || domain.includes('bing') || domain.includes('duckduckgo')) {
      let query = '';
      try {
        const u = new URL(tab.url);
        query = u.searchParams.get('q') || '';
      } catch {}
      const displayQuery = query || siteTitle || 'Web Search';
      return `
        <div class="tab-mock-google">
          <div class="tab-google-top">
            <span class="tab-google-logo"><span style="color:#4285f4">G</span><span style="color:#ea4335">o</span><span style="color:#fbbc05">o</span><span style="color:#4285f4">g</span><span style="color:#34a853">l</span><span style="color:#ea4335">e</span></span>
            <div class="tab-google-searchbar">
              <i class="fas fa-search" style="font-size:6.5px; color:var(--text-muted);"></i>
              <span class="tab-google-query">${escapeHtml(displayQuery)}</span>
            </div>
          </div>
          <div class="tab-google-results">
            <div class="tab-google-result-item">
              <div class="tab-google-cite">${escapeHtml(domain)} › ...</div>
              <div class="tab-google-heading">${escapeHtml(siteTitle)}</div>
              <div class="tab-google-snippet">Verified web results, articles, top media, and official resources.</div>
            </div>
            <div class="tab-google-result-item" style="opacity:0.85;">
              <div class="tab-google-cite">news › latest</div>
              <div class="tab-google-heading">${escapeHtml(siteTitle)} - News &amp; Updates</div>
              <div class="tab-google-snippet">Recent reports and discussion covering ${escapeHtml(displayQuery)}.</div>
            </div>
          </div>
          <div class="tab-mockup-footer">
            <span class="tab-mockup-domain-pill"><i class="fas fa-lock" style="font-size:7px; color:#10b981;"></i><span>${escapeHtml(domain)}</span></span>
          </div>
        </div>
      `;
    }

    // YouTube / Video
    if (domain.includes('youtube') || domain.includes('youtu.be')) {
      return `
        <div class="tab-mock-youtube">
          <div class="tab-yt-topbar">
            <div class="tab-yt-logo"><i class="fab fa-youtube" style="color:#ff0000; font-size:12px;"></i><span>YouTube</span></div>
            <i class="fas fa-search" style="font-size:8px; color:var(--text-muted);"></i>
          </div>
          <div class="tab-yt-player-box">
            <div class="tab-yt-player-thumb" style="background:${gradient};">
              <div class="tab-yt-play-btn"><i class="fas fa-play" style="font-size:9px; margin-left:2px;"></i></div>
              <span class="tab-yt-duration">12:45</span>
            </div>
            <div class="tab-yt-progress-line"></div>
          </div>
          <div class="tab-yt-details">
            <div class="tab-yt-video-title">${escapeHtml(siteTitle)}</div>
            <div class="tab-yt-channel-row">
              <div class="tab-yt-channel-avatar"><i class="fas fa-play-circle" style="color:#ff0000; font-size:11px;"></i></div>
              <div class="tab-yt-channel-info">
                <span class="tab-yt-channel-name">Official Channel <i class="fas fa-check-circle" style="font-size:7px; color:#3b82f6;"></i></span>
                <span class="tab-yt-views">740K views • 2 days ago</span>
              </div>
            </div>
          </div>
          <div class="tab-mockup-footer">
            <span class="tab-mockup-domain-pill"><i class="fas fa-lock" style="font-size:7px; color:#10b981;"></i><span>youtube.com</span></span>
          </div>
        </div>
      `;
    }

    // Reddit
    if (domain.includes('reddit')) {
      return `
        <div class="tab-mock-reddit">
          <div class="tab-reddit-topbar">
            <div class="tab-reddit-logo"><i class="fab fa-reddit-alien" style="color:#ff4500; font-size:12px;"></i><span>reddit</span></div>
            <span class="tab-reddit-sub">r/trending</span>
          </div>
          <div class="tab-reddit-card">
            <div class="tab-reddit-meta">u/headline • 3h ago</div>
            <div class="tab-reddit-title">${escapeHtml(siteTitle)}</div>
            <div class="tab-reddit-actions">
              <div class="tab-reddit-vote"><i class="fas fa-arrow-up" style="color:#ff4500;"></i><span>4.1k</span><i class="fas fa-arrow-down"></i></div>
              <div class="tab-reddit-pill"><i class="far fa-comment-alt"></i><span>324</span></div>
              <div class="tab-reddit-pill"><i class="fas fa-share"></i></div>
            </div>
          </div>
          <div class="tab-reddit-card" style="opacity:0.75; padding:5px 7px;">
            <div class="tab-reddit-meta">u/community • 5h ago</div>
            <div class="tab-reddit-title" style="font-size:9px;">Discussion &amp; Top Comments</div>
          </div>
          <div class="tab-mockup-footer">
            <span class="tab-mockup-domain-pill"><i class="fas fa-lock" style="font-size:7px; color:#10b981;"></i><span>reddit.com</span></span>
          </div>
        </div>
      `;
    }

    // Wikipedia
    if (domain.includes('wikipedia')) {
      return `
        <div class="tab-mock-wiki">
          <div class="tab-wiki-topbar">
            <div class="tab-wiki-logo"><i class="fab fa-wikipedia-w"></i><span>WIKIPEDIA</span></div>
            <i class="fas fa-search" style="font-size:8px; opacity:0.6;"></i>
          </div>
          <div class="tab-wiki-body">
            <div class="tab-wiki-heading">${escapeHtml(siteTitle)}</div>
            <div class="tab-wiki-subheading">From Wikipedia, the free encyclopedia</div>
            <div class="tab-wiki-paragraph">
              <strong>${escapeHtml(siteTitle)}</strong> is an encyclopedic subject documented with historical overview, scientific analysis, and comprehensive references.
            </div>
            <div class="tab-wiki-infobox">
              <div class="tab-wiki-infobox-header">Quick Facts</div>
              <div class="tab-wiki-infobox-row"><span>Classification</span><b>Major Article</b></div>
              <div class="tab-wiki-infobox-row"><span>Status</span><b>Verified</b></div>
            </div>
          </div>
          <div class="tab-mockup-footer">
            <span class="tab-mockup-domain-pill"><i class="fas fa-lock" style="font-size:7px; color:#10b981;"></i><span>wikipedia.org</span></span>
          </div>
        </div>
      `;
    }

    // GitHub
    if (domain.includes('github')) {
      return `
        <div class="tab-mock-github">
          <div class="tab-gh-topbar">
            <i class="fab fa-github" style="font-size:13px; color:#fff;"></i>
            <span class="tab-gh-repo-path">repo / ${escapeHtml(siteTitle)}</span>
          </div>
          <div class="tab-gh-stats">
            <span class="tab-gh-badge"><i class="far fa-star"></i> 24.8k</span>
            <span class="tab-gh-badge"><i class="fas fa-code-fork"></i> 3.2k</span>
            <span class="tab-gh-badge" style="color:#f1e05a;">● TypeScript</span>
          </div>
          <div class="tab-gh-file-box">
            <div class="tab-gh-file-row"><i class="far fa-folder" style="color:#54aeff;"></i><span>src</span><span class="tab-gh-msg">core modules</span></div>
            <div class="tab-gh-file-row"><i class="far fa-file-code" style="color:#8b949e;"></i><span>package.json</span><span class="tab-gh-msg">release v2.0.0</span></div>
            <div class="tab-gh-file-row"><i class="far fa-file-alt" style="color:#8b949e;"></i><span>README.md</span><span class="tab-gh-msg">docs &amp; guide</span></div>
          </div>
          <div class="tab-mockup-footer">
            <span class="tab-mockup-domain-pill"><i class="fas fa-lock" style="font-size:7px; color:#10b981;"></i><span>github.com</span></span>
          </div>
        </div>
      `;
    }

    // E-Commerce / Store
    if (domain.includes('amazon') || domain.includes('ebay') || domain.includes('walmart') || domain.includes('shopify') || domain.includes('store')) {
      return `
        <div class="tab-mock-shop">
          <div class="tab-shop-topbar">
            <div class="tab-shop-logo"><i class="fas fa-bag-shopping" style="color:#f59e0b;"></i><span>Marketplace</span></div>
            <i class="fas fa-cart-shopping" style="font-size:9px; color:var(--text-muted);"></i>
          </div>
          <div class="tab-shop-hero" style="background:${gradient};">
            <div class="tab-shop-prime-badge"><i class="fas fa-check" style="font-size:7px;"></i> Top Choice</div>
            <div class="tab-shop-stars">★★★★★ <span style="font-size:7px; opacity:0.85;">(4.9)</span></div>
          </div>
          <div class="tab-shop-details">
            <div class="tab-shop-title">${escapeHtml(siteTitle)}</div>
            <div class="tab-shop-price-row">
              <span class="tab-shop-price">$39.99</span>
              <span class="tab-shop-stock">In Stock</span>
            </div>
            <div class="tab-shop-btn">View Product</div>
          </div>
          <div class="tab-mockup-footer">
            <span class="tab-mockup-domain-pill"><i class="fas fa-lock" style="font-size:7px; color:#10b981;"></i><span>${escapeHtml(domain)}</span></span>
          </div>
        </div>
      `;
    }

    // 10. Universal Rich Web Layout (Stunning Landing Page Mockup for all other websites)
    return `
      <div class="tab-rich-web-preview">
        <div class="tab-rich-header" style="background:${gradient};">
          <div class="tab-rich-header-gloss"></div>
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
            <span class="tab-rich-nav-brand">${escapeHtml(domain)}</span>
            <div class="tab-rich-nav-dots"><i class="fas fa-ellipsis"></i></div>
          </div>
          <div class="tab-rich-hero-text">
            <div class="tab-rich-hero-title">${escapeHtml(siteTitle)}</div>
            <div class="tab-rich-hero-cta">Explore Website</div>
          </div>
        </div>
        <div class="tab-rich-body">
          <div class="tab-rich-card">
            <div class="tab-rich-card-accent" style="background:${gradient};"></div>
            <div class="tab-rich-card-lines">
              <div class="tab-rich-text-line" style="width:85%;"></div>
              <div class="tab-rich-text-line" style="width:60%;"></div>
            </div>
          </div>
          <div class="tab-rich-grid">
            <div class="tab-rich-grid-cell"><i class="fas fa-bolt" style="color:var(--accent-primary); font-size:9px;"></i><span>Features</span></div>
            <div class="tab-rich-grid-cell"><i class="fas fa-shield-alt" style="color:#10b981; font-size:9px;"></i><span>Security</span></div>
          </div>
        </div>
        <div class="tab-mockup-footer">
          <span class="tab-mockup-domain-pill">
            <i class="fas fa-lock" style="font-size:7px; color:#10b981;"></i>
            <span>${escapeHtml(domain)}</span>
          </span>
        </div>
      </div>
    `;
  }

  renderTabsGrid(gridContainerEl, onSelect) {
    gridContainerEl.innerHTML = '';
    this.tabs.forEach(tab => {
      const card = document.createElement('div');
      card.className = `tab-card ${tab.id === this.activeTabId ? 'active' : ''}`;
      card.setAttribute('data-tab-id', tab.id);
      card.setAttribute('data-url', tab.url);

      const faviconHtml = this.getTabFaviconHtml(tab);
      const previewHtml = this.renderTabPreviewHtml(tab);

      card.innerHTML = `
        <div class="tab-card-header">
          <div class="tab-card-favicon">${faviconHtml}</div>
          <span class="tab-card-title">${escapeHtml(tab.title || tab.url)}</span>
          <button class="tab-card-close" data-id="${tab.id}" title="Close Tab"><i class="fas fa-times"></i></button>
        </div>
        <div class="tab-card-preview">${previewHtml}</div>
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

    // Dedicated "+ New Tab" Action Card
    const addCard = document.createElement('div');
    addCard.className = 'tab-card tab-card-add';
    addCard.innerHTML = `
      <div class="tab-add-content">
        <div class="tab-add-icon"><i class="fas fa-plus"></i></div>
        <span class="tab-add-label">New Tab</span>
      </div>
    `;
    addCard.addEventListener('click', () => {
      this.createTab('ocal://home');
      if (onSelect) onSelect(this.activeTabId);
    });
    gridContainerEl.appendChild(addCard);
  }
}
