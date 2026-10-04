// Ocal Browser Mobile - Reference Design Coordinator
import { TabManager } from './components/TabManager.js';
import { CyberShield } from './components/CyberShield.js';
import { CopilotDrawer } from './components/CopilotDrawer.js';
import { DownloadsManager } from './components/DownloadsManager.js';
import { DownloadProgressIndicator } from './components/DownloadProgressIndicator.js';
import { syncClient } from './utils/SyncClient.js';

// Anti-nesting guard: Never render duplicate browser chrome inside an iframe
if (window.self !== window.top) {
  document.documentElement.style.display = 'none';
  throw new Error('[Ocal] Nested iframe detected - UI instantiation aborted.');
}

class OcalMobileApp {
  constructor() {
    this.tabManager = null;
    this.cyberShield = null;
    this.copilotDrawer = null;
    this.downloadsManager = null;
    this.downloadIndicator = null;
    this.suggestDebounceTimer = null;
    this.adFilterEnabled = true;
    this.toastTimer = null;
  }

  init() {
    // 1. Initialize Theme (Deep Black Dark Mode by default)
    const savedTheme = localStorage.getItem('ocal-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateStatusBarTheme(savedTheme === 'dark');

    // 1b. Load glass blur density & global translucency
    localStorage.removeItem('ocal-accent-color');
    const savedBlur = localStorage.getItem('ocal-blur-density');
    const blurNum = savedBlur !== null ? Math.max(0, parseInt(savedBlur, 10)) : 24;
    const px = `${blurNum}px`;
    document.documentElement.style.setProperty('--app-blur-val', px);
    document.documentElement.style.setProperty('--dock-blur-val', px);
    document.documentElement.style.setProperty('--capsule-blur-val', px);
    document.documentElement.style.setProperty('--sheet-blur-val', px);
    document.documentElement.style.setProperty('--popover-blur-val', px);

    if (blurNum === 0) {
      document.documentElement.classList.add('glass-blur-disabled');
      document.documentElement.setAttribute('data-blur', '0');
    } else {
      document.documentElement.classList.remove('glass-blur-disabled');
      document.documentElement.removeAttribute('data-blur');
    }

    // 2. Initialize CyberShield
    this.cyberShield = new CyberShield({
      onStatsChange: () => {
        const activeTab = this.tabManager?.getActiveTab();
        this.updateShieldStats(activeTab?.blockedAdsCount || 0);
      }
    });

    // 3. Initialize Tab Manager
    const viewportContainer = document.getElementById('viewport-container');
    const omniboxInput = document.getElementById('omnibox-input');
    const navBackBtn = document.getElementById('nav-back');
    const navFwdBtn = document.getElementById('nav-forward');
    const tabCounterBadge = document.getElementById('tab-counter-badge');
    const tabsCounterBadge = document.getElementById('tabs-counter-badge');

    this.tabManager = new TabManager({
      viewportContainerEl: viewportContainer,
      onTabChanged: (activeTab) => {
        if (!activeTab) return;
        const isWeb = activeTab.url && !activeTab.url.startsWith('ocal://');
        if (isWeb) {
          document.documentElement.classList.add('is-web-page');
          document.body.classList.add('is-web-page');
          document.body.classList.remove('is-internal-page');
          if (activeTab.thumbnail) {
            this.updateWebBgSnapshot(activeTab.thumbnail);
          } else if (window.OcalNative) {
            const lastThumb = window.OcalNative.getLastTabThumbnail();
            if (lastThumb) this.updateWebBgSnapshot(lastThumb);
          }
        } else {
          document.documentElement.classList.remove('is-web-page');
          document.body.classList.remove('is-web-page');
          document.body.classList.add('is-internal-page');
        }
        this.updateStatusBarTheme();
        this.checkCurrentTabBookmarked();

        if (omniboxInput && document.activeElement !== omniboxInput) {
          if (activeTab.url === 'ocal://home') {
            omniboxInput.value = '';
            omniboxInput.placeholder = 'Search or enter address';
          } else {
            omniboxInput.value = this.formatOmniboxUrl(activeTab.url);
          }
        }

        // Update Nav Buttons
        if (navBackBtn) navBackBtn.disabled = activeTab.historyIdx <= 0;
        if (navFwdBtn) navFwdBtn.disabled = activeTab.historyIdx >= activeTab.history.length - 1;

        // Update shield popover domain and real blocked count
        const isInternalTab = !activeTab.url || activeTab.url.startsWith('ocal://');
        const popoverDomain = document.getElementById('shield-popover-domain');
        if (popoverDomain) {
          if (isInternalTab) {
            popoverDomain.innerText = 'Internal Page';
          } else {
            try {
              const u = new URL(activeTab.url);
              popoverDomain.innerText = u.hostname;
            } catch {
              popoverDomain.innerText = activeTab.url.replace('ocal://', '') || 'Internal Page';
            }
          }
        }
        this.updateShieldStats(activeTab.blockedAdsCount || 0);
      },
      onTabsCountChanged: (count) => {
        if (tabCounterBadge) tabCounterBadge.innerText = count;
        if (tabsCounterBadge) tabsCounterBadge.innerText = count;
      }
    });

    this.tabManager.init();
    this.tabManager.syncThemeToTabs(savedTheme === 'dark');

    // 4. Initialize AI Copilot Drawer
    const copilotSheet = document.getElementById('copilot-sheet');
    this.copilotDrawer = new CopilotDrawer({
      containerEl: copilotSheet,
      getActiveTab: () => this.tabManager.getActiveTab()
    });

    // 4.5 Initialize Downloads Manager & Live Progress Ball Indicator
    this.downloadsManager = new DownloadsManager();
    this.downloadIndicator = new DownloadProgressIndicator(this);

    // 4.6 Initialize Ocal Connect & Device Sync
    syncClient.init();

    // 5. Setup UI Event Listeners
    this.bindUrlCapsuleEvents();
    this.bindBottomNavEvents();
    this.bindShieldPopover();
    this.bindTabsTray();
    this.bindDrawers();
    this.bindBackHandler();
    this.bindEdgeSwipeGesture();
    this.bindInPageNavigationBridge();
    this.setupNativeWebBridge();
    this.setupContextMenuListeners();
    this.checkCurrentTabBookmarked();
    this.syncNativeNavigationState();
    this.setupOverlayObserver();
    this.checkInitialPermissionsPrompt();
  }

  bindUrlCapsuleEvents() {
    const omniboxInput = document.getElementById('omnibox-input');
    const suggestionsDropdown = document.getElementById('suggestions-dropdown');
    const searchBackdrop = document.getElementById('search-backdrop');
    const clearBtn = document.getElementById('capsule-clear-btn');
    const cancelBtn = document.getElementById('capsule-cancel-btn');

    const resetScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
      if (document.body.scrollTop !== 0) document.body.scrollTop = 0;
      if (document.documentElement.scrollTop !== 0) document.documentElement.scrollTop = 0;
    };

    const updateKeyboardLayout = () => {
      document.documentElement.style.removeProperty('--keyboard-offset');
    };

    const enterSearchMode = () => {
      document.body.classList.add('search-active');
      const activeTab = this.tabManager.getActiveTab();
      const thumb = (activeTab && activeTab.thumbnail) || (window.OcalNative ? window.OcalNative.getLastTabThumbnail() : '') || '';
      if (thumb) {
        this.updateWebBgSnapshot(thumb);
      }
      if (window.OcalNative) window.OcalNative.setWebVisible(false);
      resetScroll();
      requestAnimationFrame(resetScroll);
      updateKeyboardLayout();
      if (activeTab && activeTab.url !== 'ocal://home') {
        omniboxInput.value = this.formatOmniboxUrl(activeTab.url);
      }
      if (omniboxInput.value.trim().length > 0) {
        clearBtn?.classList.add('visible');
      } else {
        clearBtn?.classList.remove('visible');
      }
      // Place cursor smoothly at the end without select(), preventing Gboard IME stutter/duplication
      try {
        const len = omniboxInput.value.length;
        omniboxInput.setSelectionRange(len, len);
      } catch {}
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        if (document.body.classList.contains('search-active')) {
          const keyboardH = Math.max(0, Math.round(window.innerHeight - window.visualViewport.height));
          if (keyboardH > 50) {
            document.documentElement.style.setProperty('--keyboard-height', keyboardH + 'px');
            document.body.classList.add('keyboard-open-native');
          } else if (!window.OcalNative) {
            document.documentElement.style.setProperty('--keyboard-height', '0px');
            document.body.classList.remove('keyboard-open-native');
          }
          resetScroll();
        }
      });
    }

    let recognitionInstance = null;
    let isVoiceListening = false;
    const micBtn = document.getElementById('capsule-mic-btn');
    const capsuleBar = document.getElementById('url-capsule-bar');

    const stopVoiceRecognition = () => {
      if (recognitionInstance) {
        try {
          recognitionInstance.stop();
        } catch {
          // ignore
        }
      }
      isVoiceListening = false;
      micBtn?.classList.remove('listening');
      capsuleBar?.classList.remove('voice-listening');
      const activeTab = this.tabManager.getActiveTab();
      if (!document.body.classList.contains('search-active')) {
        omniboxInput.placeholder = 'Search or enter address';
      } else {
        omniboxInput.placeholder = 'Search or enter address';
      }
    };

    const startVoiceRecognition = () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert('Voice typing is not supported in this browser engine. Please test in Google Chrome, Microsoft Edge, or an Android WebKit browser.');
        return;
      }

      enterSearchMode();
      omniboxInput.focus();

      if (recognitionInstance) {
        try {
          recognitionInstance.abort();
        } catch {
          // ignore
        }
      }

      const recognition = new SpeechRecognition();
      recognitionInstance = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isVoiceListening = true;
        micBtn?.classList.add('listening');
        capsuleBar?.classList.add('voice-listening');
        omniboxInput.placeholder = 'Listening... Speak now';
        omniboxInput.value = '';
        clearBtn?.classList.remove('visible');
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalTranscript += res[0].transcript;
          } else {
            interimTranscript += res[0].transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        if (currentText) {
          omniboxInput.value = currentText;
          clearBtn?.classList.add('visible');
          omniboxInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        if (finalTranscript) {
          stopVoiceRecognition();
          setTimeout(() => {
            handleNavigation();
          }, 450);
        }
      };

      recognition.onerror = (event) => {
        console.warn('[Voice Recognition Error]', event.error);
        stopVoiceRecognition();
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          alert('Microphone permission was denied. Please allow microphone access in your browser or device settings.');
        }
      };

      recognition.onend = () => {
        stopVoiceRecognition();
      };

      try {
        recognition.start();
      } catch (err) {
        console.error('[Voice Recognition Start Error]', err);
        stopVoiceRecognition();
      }
    };

    const exitSearchMode = (revert = true) => {
      stopVoiceRecognition();
      clearTimeout(this.suggestDebounceTimer);
      if (this.suggestAbortController) {
        this.suggestAbortController.abort();
        this.suggestAbortController = null;
      }
      document.body.classList.remove('search-active');
      document.body.classList.remove('keyboard-open');
      document.documentElement.style.removeProperty('--keyboard-offset');
      suggestionsDropdown.classList.remove('visible');
      suggestionsDropdown.innerHTML = '';
      clearBtn?.classList.remove('visible');
      resetScroll();
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      if (window.OcalNative && typeof window.OcalNative.hideKeyboard === 'function') {
        window.OcalNative.hideKeyboard();
      }
      if (revert) {
        const activeTab = this.tabManager.getActiveTab();
        if (activeTab) {
          if (activeTab.url === 'ocal://home') {
            omniboxInput.value = '';
            omniboxInput.placeholder = 'Search or enter address';
          } else {
            omniboxInput.value = this.formatOmniboxUrl(activeTab.url);
          }
        }
      }
      this.syncNativeWebVisibility();
      this.syncOverlayState();
      setTimeout(() => this.syncDockLayout && this.syncDockLayout(), 100);
    };

    let isNavigating = false;
    const handleNavigation = () => {
      if (isNavigating) return;
      const q = omniboxInput.value.trim();
      if (!q) return;
      isNavigating = true;
      setTimeout(() => { isNavigating = false; }, 800);

      clearTimeout(this.suggestDebounceTimer);
      if (this.suggestAbortController) {
        this.suggestAbortController.abort();
        this.suggestAbortController = null;
      }
      suggestionsDropdown.classList.remove('visible');
      suggestionsDropdown.innerHTML = '';

      this.animateProgressBar();
      exitSearchMode(false);
      omniboxInput.blur();
      if (window.OcalNative && typeof window.OcalNative.hideKeyboard === 'function') {
        window.OcalNative.hideKeyboard();
      }
      this.tabManager.navigateTab(this.tabManager.activeTabId, q);
    };

    document.getElementById('capsule-url-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      handleNavigation();
    });

    omniboxInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.keyCode === 13 || e.which === 13) {
        e.preventDefault();
        handleNavigation();
      }
      if (e.key === 'Escape' || e.keyCode === 27) {
        exitSearchMode(true);
        omniboxInput.blur();
      }
    });

    omniboxInput.addEventListener('focus', () => {
      enterSearchMode();
      this.positionSuggestionsDropdown();
      requestAnimationFrame(resetScroll);
      setTimeout(resetScroll, 50);
      setTimeout(resetScroll, 200);
    });

    omniboxInput.addEventListener('click', () => {
      enterSearchMode();
      requestAnimationFrame(resetScroll);
      setTimeout(resetScroll, 50);
      setTimeout(resetScroll, 200);
    });

    capsuleBar?.addEventListener('click', (e) => {
      if (e.target.closest('#nav-back, #nav-forward, #nav-reload, #capsule-cancel-btn, #capsule-clear-btn, #capsule-mic-btn, #capsule-shield-btn, #capsule-bookmark-btn')) {
        return;
      }
      enterSearchMode();
      omniboxInput.focus();
      requestAnimationFrame(resetScroll);
      setTimeout(resetScroll, 50);
    });

    searchBackdrop?.addEventListener('click', () => {
      exitSearchMode(true);
      omniboxInput.blur();
    });

    cancelBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      exitSearchMode(true);
      omniboxInput.blur();
    });

    clearBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      omniboxInput.value = '';
      omniboxInput.focus();
      clearBtn.classList.remove('visible');
      suggestionsDropdown.classList.remove('visible');
    });

    suggestionsDropdown.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });

    document.getElementById('nav-back')?.addEventListener('click', () => {
      if (this.tabManager.activeTabId) this.tabManager.goBack(this.tabManager.activeTabId);
    });

    document.getElementById('nav-forward')?.addEventListener('click', () => {
      if (this.tabManager.activeTabId) this.tabManager.goForward(this.tabManager.activeTabId);
    });

    const navReloadBtn = document.getElementById('nav-reload');
    navReloadBtn?.addEventListener('click', () => {
      if (this.tabManager.activeTabId) {
        navReloadBtn.classList.add('is-reloading');
        this.animateProgressBar();
        this.tabManager.reloadTab(this.tabManager.activeTabId);
        setTimeout(() => {
          navReloadBtn.classList.remove('is-reloading');
        }, 700);
      }
    });

    const bookmarkBtn = document.getElementById('capsule-bookmark-btn');
    bookmarkBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.toggleBookmarkCurrentPage();
    });

    micBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isVoiceListening) {
        stopVoiceRecognition();
      } else {
        startVoiceRecognition();
      }
    });

    omniboxInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val.length > 0) {
        clearBtn?.classList.add('visible');
      } else {
        clearBtn?.classList.remove('visible');
      }

      clearTimeout(this.suggestDebounceTimer);
      if (this.suggestAbortController) {
        this.suggestAbortController.abort();
        this.suggestAbortController = null;
      }
      if (!val || val.startsWith('ocal://') || !document.body.classList.contains('search-active')) {
        suggestionsDropdown.classList.remove('visible');
        suggestionsDropdown.innerHTML = '';
        return;
      }

      this.suggestAbortController = new AbortController();
      const currentController = this.suggestAbortController;

      this.suggestDebounceTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/suggest?q=${encodeURIComponent(val)}`, { signal: currentController.signal });
          const data = await res.json();
          if (document.body.classList.contains('search-active') && data.suggestions && data.suggestions.length > 0) {
            this.renderSuggestions(data.suggestions, () => exitSearchMode(false));
          } else {
            suggestionsDropdown.classList.remove('visible');
            suggestionsDropdown.innerHTML = '';
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            suggestionsDropdown.classList.remove('visible');
            suggestionsDropdown.innerHTML = '';
          }
        }
      }, 180);
      this.positionSuggestionsDropdown();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#url-capsule-bar') && !e.target.closest('#suggestions-dropdown')) {
        suggestionsDropdown.classList.remove('visible');
        suggestionsDropdown.innerHTML = '';
      }
    });
  }

  renderSuggestions(suggestions, onSelected) {
    const dropdown = document.getElementById('suggestions-dropdown');
    if (!dropdown || !document.body.classList.contains('search-active')) {
      if (dropdown) {
        dropdown.classList.remove('visible');
        dropdown.innerHTML = '';
      }
      return;
    }
    dropdown.innerHTML = '';
    suggestions.forEach(item => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      div.innerHTML = `
        <i class="fas fa-search"></i>
        <span class="suggestion-text">${this.escapeHtml(item)}</span>
      `;
      div.addEventListener('click', () => {
        const omnibox = document.getElementById('omnibox-input');
        if (omnibox) omnibox.value = item;
        dropdown.classList.remove('visible');
        dropdown.innerHTML = '';
        if (onSelected) onSelected();
        this.tabManager.navigateTab(this.tabManager.activeTabId, item);
      });
      dropdown.appendChild(div);
    });
    this.positionSuggestionsDropdown();
    dropdown.classList.add('visible');
    this.syncOverlayState();
  }

  positionSuggestionsDropdown() {
    const dropdown = document.getElementById('suggestions-dropdown');
    const capsule = document.getElementById('url-capsule-bar');
    if (!dropdown || !capsule) return;

    if (window.innerWidth >= 768) {
      const capsuleRect = capsule.getBoundingClientRect();
      const dock = document.getElementById('bottom-dock');
      const dockRect = dock ? dock.getBoundingClientRect() : { left: 0, top: 0 };

      dropdown.style.position = 'absolute';
      dropdown.style.left = `${capsuleRect.left - dockRect.left}px`;
      dropdown.style.width = `${capsuleRect.width}px`;
      dropdown.style.maxWidth = `${capsuleRect.width}px`;
      dropdown.style.top = `${capsuleRect.bottom - dockRect.top + 6}px`;
      dropdown.style.bottom = 'auto';
      dropdown.style.transform = 'none';
      dropdown.style.margin = '0';
    } else {
      dropdown.style.position = '';
      dropdown.style.left = '';
      dropdown.style.width = '';
      dropdown.style.maxWidth = '';
      dropdown.style.top = '';
      dropdown.style.bottom = '';
      dropdown.style.transform = '';
      dropdown.style.margin = '';
    }
  }

  positionShieldPopover() {
    const popover = document.getElementById('shield-popover');
    const shieldBtn = document.getElementById('capsule-shield-btn');
    const dock = document.getElementById('bottom-dock');
    if (!popover || !shieldBtn || !dock) return;

    if (window.innerWidth >= 768) {
      const btnRect = shieldBtn.getBoundingClientRect();
      const dockRect = dock.getBoundingClientRect();
      const popoverWidth = 360;
      let left = (btnRect.right - popoverWidth) - dockRect.left + 24;
      if (left < 12) left = 12;
      popover.style.left = `${left}px`;
      popover.style.top = `${btnRect.bottom - dockRect.top + 8}px`;
      popover.style.transform = 'none';
      popover.style.bottom = 'auto';
    } else {
      popover.style.left = '';
      popover.style.top = '';
      popover.style.transform = '';
      popover.style.bottom = '';
    }
  }

  updateShieldStats(count) {
    const popoverCount = document.getElementById('shield-popover-count');
    const badgeDot = document.getElementById('shield-badge-dot');
    const activeTab = this.tabManager?.getActiveTab();
    const isInternal = !activeTab || !activeTab.url || activeTab.url.startsWith('ocal://');
    const displayCount = isInternal ? 0 : (typeof count === 'number' ? count : (activeTab?.blockedAdsCount || 0));

    if (popoverCount) {
      popoverCount.innerText = String(displayCount);
    }
    if (badgeDot) {
      if (displayCount > 0 && this.adFilterEnabled) {
        badgeDot.classList.add('active');
      } else {
        badgeDot.classList.remove('active');
      }
    }
  }

  bindBottomNavEvents() {
    document.getElementById('nav-history')?.addEventListener('click', () => {
      this.tabManager.navigateTab(this.tabManager.activeTabId, 'ocal://history');
    });

    document.getElementById('nav-bookmarks')?.addEventListener('click', () => {
      this.tabManager.navigateTab(this.tabManager.activeTabId, 'ocal://bookmarks');
    });

    document.getElementById('nav-new-tab')?.addEventListener('click', () => {
      this.tabManager.createTab('ocal://home', false);
    });

    document.getElementById('nav-tabs')?.addEventListener('click', () => {
      this.openTabsTray();
    });

    document.getElementById('nav-menu')?.addEventListener('click', () => {
      const menuSheet = document.getElementById('menu-sheet');
      if (menuSheet && menuSheet.classList.contains('visible')) {
        this.closeAllSheets();
      } else {
        this.openMoreMenuSheet();
      }
    });

    document.getElementById('dock-left-brand')?.addEventListener('click', () => {
      this.tabManager.navigateTab(this.tabManager.activeTabId, 'ocal://home');
    });
  }

  bindShieldPopover() {
    const popover = document.getElementById('shield-popover');
    const capsuleShieldBtn = document.getElementById('capsule-shield-btn');
    const advancedBtn = document.getElementById('shield-popover-advanced');
    const powerToggle = document.getElementById('shield-power-toggle');
    const countEl = document.getElementById('shield-popover-count');
    const badgeDot = document.getElementById('shield-badge-dot');

    capsuleShieldBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.positionShieldPopover();
      const activeTab = this.tabManager?.getActiveTab();
      const isInternal = !activeTab || !activeTab.url || activeTab.url.startsWith('ocal://');
      const popoverDomain = document.getElementById('shield-popover-domain');
      if (popoverDomain) {
        if (isInternal) {
          popoverDomain.innerText = 'Internal Page';
        } else {
          try {
            popoverDomain.innerText = new URL(activeTab.url).hostname;
          } catch {
            popoverDomain.innerText = activeTab.url;
          }
        }
      }
      this.updateShieldStats(activeTab?.blockedAdsCount || 0);
      popover.classList.toggle('visible');
      this.syncOverlayState();
    });

    powerToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.adFilterEnabled = !this.adFilterEnabled;
      if (window.OcalNative && typeof window.OcalNative.setAdBlockEnabled === 'function') {
        window.OcalNative.setAdBlockEnabled(this.adFilterEnabled);
      }
      this.cyberShield?.updateSetting('adBlocker', this.adFilterEnabled);

      if (this.adFilterEnabled) {
        powerToggle.classList.remove('inactive');
        powerToggle.classList.add('active');
        const activeTab = this.tabManager?.getActiveTab();
        this.updateShieldStats(activeTab?.blockedAdsCount || 0);
      } else {
        powerToggle.classList.remove('active');
        powerToggle.classList.add('inactive');
        this.updateShieldStats(0);
      }
    });

    advancedBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.classList.remove('visible');
      this.syncOverlayState();
      this.openCyberShieldSheet();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#shield-popover') && !e.target.closest('#capsule-shield-btn')) {
        if (popover?.classList.contains('visible')) {
          popover.classList.remove('visible');
          this.syncOverlayState();
        }
      }
    });
  }

  bindTabsTray() {
    const tray = document.getElementById('tabs-tray-container');
    const backdrop = document.getElementById('tabs-tray-backdrop');
    const searchInput = document.getElementById('tabs-search-input');
    const searchContainer = document.getElementById('tabs-search-container');
    const searchToggleBtn = document.getElementById('tabs-search-toggle-btn');
    const searchClearBtn = document.getElementById('tabs-search-clear-btn');
    const popover = document.getElementById('opera-tabs-menu-popover');
    const moreBtn = document.getElementById('tabs-nav-more');

    backdrop?.addEventListener('click', () => {
      this.closeTabsTray();
    });

    // Nav buttons inside tabs tray
    document.getElementById('tabs-nav-history')?.addEventListener('click', () => {
      this.closeTabsTray();
      this.tabManager.navigateTab(this.tabManager.activeTabId, 'ocal://history');
    });

    document.getElementById('tabs-nav-bookmarks')?.addEventListener('click', () => {
      this.closeTabsTray();
      this.tabManager.navigateTab(this.tabManager.activeTabId, 'ocal://bookmarks');
    });

    document.getElementById('tabs-nav-menu')?.addEventListener('click', () => {
      this.closeTabsTray();
      this.openMoreMenuSheet();
    });

    // Tab Counter badge & Done buttons in tabs tray (returns to active tab)
    const handleCloseTray = () => this.closeTabsTray();
    document.getElementById('tabs-done-btn')?.addEventListener('click', handleCloseTray);
    document.getElementById('tabs-nav-done')?.addEventListener('click', handleCloseTray);

    // Toggle search bar
    searchToggleBtn?.addEventListener('click', () => {
      if (searchContainer) {
        const isHidden = searchContainer.style.display === 'none';
        searchContainer.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
          searchInput?.focus();
        } else {
          if (searchInput) searchInput.value = '';
          const carousel = document.getElementById('tabs-carousel');
          if (carousel) this.tabManager?.renderTabsGrid(carousel);
        }
      }
    });

    searchClearBtn?.addEventListener('click', () => {
      if (searchContainer) searchContainer.style.display = 'none';
      if (searchInput) searchInput.value = '';
      const carousel = document.getElementById('tabs-carousel');
      if (carousel) this.tabManager?.renderTabsGrid(carousel);
    });

    // Tabs / Private header segment buttons
    const normalTabBtn = document.getElementById('tab-mode-normal');
    const privateTabBtn = document.getElementById('tab-mode-private');

    let lastModeSwitchTime = 0;
    const switchTabMode = (mode, e) => {
      const now = Date.now();
      if (now - lastModeSwitchTime < 250) return;
      lastModeSwitchTime = now;
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      this.tabManager.tabFilterMode = mode;
      const carousel = document.getElementById('tabs-carousel');
      if (carousel) {
        this.tabManager.renderTabsGrid(carousel, (tabId) => {
          this.tabManager.switchTab(tabId);
          this.closeTabsTray();
        });
      }
    };

    normalTabBtn?.addEventListener('click', (e) => switchTabMode('normal', e));
    normalTabBtn?.addEventListener('touchend', (e) => switchTabMode('normal', e));
    privateTabBtn?.addEventListener('click', (e) => switchTabMode('private', e));
    privateTabBtn?.addEventListener('touchend', (e) => switchTabMode('private', e));

    // View mode layout switcher button in Opera bottom dock (toggles Grid <-> List)
    let lastViewModeTime = 0;
    const toggleViewMode = (e) => {
      const now = Date.now();
      if (now - lastViewModeTime < 250) return;
      lastViewModeTime = now;
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const next = (this.tabManager.currentPreset === 'list') ? 'grid' : 'list';
      this.tabManager.setPreset(next);
    };

    const viewModeBtn = document.getElementById('tabs-nav-view-mode');
    viewModeBtn?.addEventListener('click', toggleViewMode);
    viewModeBtn?.addEventListener('touchend', toggleViewMode);

    // More options menu in Opera bottom dock (⋮)
    moreBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (popover) {
        popover.style.display = popover.style.display === 'none' ? 'flex' : 'none';
      }
    });

    document.addEventListener('click', (e) => {
      if (popover && popover.style.display !== 'none' && !e.target.closest('#opera-tabs-menu-popover') && !e.target.closest('#tabs-nav-more')) {
        popover.style.display = 'none';
      }
    });

    // Close all tabs button
    document.getElementById('tabs-close-all-btn')?.addEventListener('click', () => {
      if (popover) popover.style.display = 'none';
      this.tabManager?.closeAllTabs();
    });

    // Close inactive tabs
    document.getElementById('tabs-menu-close-inactive')?.addEventListener('click', () => {
      if (popover) popover.style.display = 'none';
      const active = this.tabManager.getActiveTab();
      if (active) {
        this.tabManager.tabs = this.tabManager.tabs.filter(t => t.id === active.id);
        this.tabManager.notifyTabsCount();
        const carousel = document.getElementById('tabs-carousel');
        if (carousel) this.tabManager.renderTabsGrid(carousel);
      }
    });

    // New Private Tab from popover
    document.getElementById('tabs-menu-new-private')?.addEventListener('click', () => {
      if (popover) popover.style.display = 'none';
      this.tabManager.tabFilterMode = 'private';
      this.tabManager.createTab('ocal://home', true);
      this.closeTabsTray();
    });

    // Search tabs filter (supports both card and list rows)
    searchInput?.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      const carousel = document.getElementById('tabs-carousel');
      if (!carousel) return;
      carousel.querySelectorAll('.tab-card, .tab-list-row').forEach(card => {
        const title = (card.querySelector('.tab-card-title') || card.querySelector('.tab-list-title'))?.textContent?.toLowerCase() || '';
        const url = card.getAttribute('data-url')?.toLowerCase() || '';
        card.style.display = (!q || title.includes(q) || url.includes(q)) ? '' : 'none';
      });
    });
  }

  openTabsTray() {
    this.closeAllSheets();
    document.body.classList.add('tabs-tray-open');
    if (window.OcalNative && typeof window.OcalNative.setOverlayOpen === 'function') {
      window.OcalNative.setOverlayOpen(true);
    }
    const tray = document.getElementById('tabs-tray-container');
    const carousel = document.getElementById('tabs-carousel');
    const searchInput = document.getElementById('tabs-search-input');
    const mainTabBadge = document.getElementById('tab-counter-badge');

    if (tray && carousel) {
      const activeTab = this.tabManager?.getActiveTab();
      if (this.tabManager && activeTab) {
        this.tabManager.tabFilterMode = activeTab.isIncognito ? 'private' : 'normal';
      }
      if (window.OcalNative && activeTab && !activeTab.url.startsWith('ocal://') && !activeTab.url.includes('dineinstyle.com')) {
        try {
          const freshThumb = window.OcalNative.captureCurrentThumbnailImmediate(activeTab.id);
          if (freshThumb && freshThumb.startsWith('data:image')) {
            activeTab.thumbnail = freshThumb;
            this.tabManager?.setTabThumbnail(activeTab.id, activeTab.url, freshThumb);
          }
        } catch (e) {
          try { window.OcalNative.captureActiveTabThumbnail(activeTab.id); } catch (_) {}
        }
      }

      if (window.OcalNative) window.OcalNative.setWebVisible(false);
      this.tabManager.renderTabsGrid(carousel, (tabId) => {
        this.tabManager.switchTab(tabId);
        this.closeTabsTray();
      });
      if (searchInput) searchInput.value = '';
      tray.classList.add('visible');
      if (mainTabBadge) mainTabBadge.classList.add('active');

      setTimeout(() => {
        const activeCard = carousel.querySelector('.tab-card.active, .tab-list-row.active');
        if (activeCard) {
          activeCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      }, 60);
    }
  }

  closeTabsTray() {
    document.body.classList.remove('tabs-tray-open');
    const tray = document.getElementById('tabs-tray-container');
    const mainTabBadge = document.getElementById('tab-counter-badge');
    tray?.classList.remove('visible');
    if (mainTabBadge) mainTabBadge.classList.remove('active');
    if (window.OcalNative && typeof window.OcalNative.setOverlayOpen === 'function') {
      window.OcalNative.setOverlayOpen(false);
    }
    this.syncNativeWebVisibility();
  }

  bindDrawers() {
    const backdrop = document.getElementById('drawer-backdrop');
    const dismissSheets = (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      this.closeAllSheets();
    };
    backdrop?.addEventListener('click', dismissSheets);
    backdrop?.addEventListener('touchstart', dismissSheets, { passive: false });
    backdrop?.addEventListener('pointerdown', dismissSheets);

    document.getElementById('shield-sheet-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllSheets();
    });

    // Hold-press tactile feedback: translucent blue highlight while pressing
    let holdTimer = null;
    document.addEventListener('touchstart', (e) => {
      const target = e.target.closest('a, button, .tab-card, .top-site-tile, .recent-history-row, .bm-item-row');
      if (target) {
        clearTimeout(holdTimer);
        holdTimer = setTimeout(() => {
          target.classList.add('is-holding-press');
        }, 150);
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      clearTimeout(holdTimer);
      document.querySelectorAll('.is-holding-press').forEach(el => el.classList.remove('is-holding-press'));
    });
    document.addEventListener('touchcancel', () => {
      clearTimeout(holdTimer);
      document.querySelectorAll('.is-holding-press').forEach(el => el.classList.remove('is-holding-press'));
    });
  }

  setupSheetDragDismiss(sheet) {
    if (!sheet || sheet._dragDismissAttached) return;
    sheet._dragDismissAttached = true;
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    sheet.addEventListener('touchstart', (e) => {
      if (!sheet.classList.contains('visible')) return;
      const touch = e.touches[0];
      const target = e.target;
      if (target.closest('.sheet-handle-bar') || target.closest('.sheet-header') || (touch.clientY - sheet.getBoundingClientRect().top < 64)) {
        startY = touch.clientY;
        currentY = startY;
        isDragging = true;
        sheet.style.transition = 'none';
      }
    }, { passive: true });

    sheet.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      const deltaY = touch.clientY - startY;
      if (deltaY > 0) {
        currentY = touch.clientY;
        sheet.style.transform = `translateY(${deltaY}px)`;
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });

    const handleEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      const deltaY = currentY - startY;
      sheet.style.transition = '';
      if (deltaY > 60) {
        sheet.style.transform = '';
        this.closeAllSheets();
      } else {
        sheet.style.transform = '';
      }
    };

    sheet.addEventListener('touchend', handleEnd);
    sheet.addEventListener('touchcancel', handleEnd);
  }

  openCyberShieldSheet() {
    this.closeAllSheets();
    const sheet = document.getElementById('shield-sheet');
    const content = document.getElementById('shield-sheet-content');
    if (sheet && content) {
      this.cyberShield.renderControlSheet(content);
      sheet.classList.remove('visible');
      sheet.style.transform = '';
      void sheet.offsetHeight;
      requestAnimationFrame(() => {
        sheet.classList.add('visible');
        document.getElementById('drawer-backdrop')?.classList.add('visible');
      });
      this.setupSheetDragDismiss(sheet);
      if (window.OcalNative) {
        window.OcalNative.setOverlayOpen?.(true);
        window.OcalNative.setWebVisible(false);
      }
      this.syncNativeNavigationState();
    }
  }

  openMoreMenuSheet() {
    this.closeAllSheets();
    const sheet = document.getElementById('menu-sheet');
    const activeTab = this.tabManager.getActiveTab();
    const isDesktop = activeTab ? activeTab.isDesktop : false;
    const isIncognito = activeTab ? Boolean(activeTab.isIncognito) : false;
    const isAdBlockActive = this.cyberShield ? Boolean(this.cyberShield.settings?.adBlocker) : true;
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const currentUrl = activeTab?.url || '';
    const isInternal = currentUrl.startsWith('ocal://');

    const MENU_ICONS = {
      bookmark: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
      history: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      games: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="4"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="11" r="1" fill="currentColor"/><circle cx="18" cy="13" r="1" fill="currentColor"/></svg>`,
      shield: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
      share: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`,
      incognito: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10s3-4 10-4 10 4 10 4"/><circle cx="7" cy="15" r="3"/><circle cx="17" cy="15" r="3"/><path d="m14 15-4 0"/></svg>`,
      download: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
      key: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 2.5 2.5"/><path d="m18.5 4.5 2.5 2.5"/></svg>`,
      sync: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
      copilot: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/><path d="M19 3v4"/><path d="M21 5h-4"/></svg>`,
      desktop: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
      theme: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>`,
      reload: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>`,
      settings: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
      chevron: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
      close: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
    };

    if (sheet) {
      sheet.innerHTML = `
        <div class="sheet-handle-bar"><div class="sheet-handle"></div></div>
        <div class="sheet-header">
          <div class="sheet-title" style="font-size: 16px; font-weight: 700; letter-spacing: -0.015em;">Menu</div>
          <button class="sheet-close-pill" id="menu-close-btn" title="Close">
            ${MENU_ICONS.close}
          </button>
        </div>
        <div class="sheet-content">
          <!-- 4-Item Compact Quick Action Grid (Pure Monochrome) -->
          <div class="apple-menu-grid">
            <div class="apple-menu-card" id="menu-bookmarks">
              <div class="apple-menu-icon menu-icon-mono">
                ${MENU_ICONS.bookmark}
              </div>
              <span class="apple-menu-label">Bookmarks</span>
            </div>
            <div class="apple-menu-card" id="menu-history">
              <div class="apple-menu-icon menu-icon-mono">
                ${MENU_ICONS.history}
              </div>
              <span class="apple-menu-label">History</span>
            </div>
            <div class="apple-menu-card" id="menu-games">
              <div class="apple-menu-icon menu-icon-mono">
                ${MENU_ICONS.games}
              </div>
              <span class="apple-menu-label">Games</span>
            </div>
            <div class="apple-menu-card" id="menu-shield">
              <div class="apple-menu-icon menu-icon-mono">
                ${MENU_ICONS.shield}
              </div>
              <span class="apple-menu-label">CyberShield</span>
            </div>
          </div>

          <!-- Core Features Section (Image 2 Reference Style: Private, AD Blocker, AI Power) -->
          <div class="apple-grouped-table" style="margin-top: 2px; margin-bottom: 12px;">
            <div class="apple-grouped-row" id="menu-quick-private-row">
              <div class="apple-row-icon mono-item" style="background-color: #18181b;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M20 3H4C2.9 3 2 3.9 2 5v10c0 1.1.9 2 2 2h3v4l4.5-4H20c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" fill="#ffffff"/>
                  <rect x="9" y="9.5" width="6" height="5" rx="1.2" fill="#18181b"/>
                  <path d="M10.2 9.5V7.8a1.8 1.8 0 0 1 3.6 0v1.7" stroke="#18181b" stroke-width="1.5" fill="none"/>
                  <circle cx="12" cy="12" r="0.75" fill="#ffffff"/>
                </svg>
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title" style="font-size: 15.5px; font-weight: 600;">Private</div>
              </div>
              <div class="status-check-badge ${isIncognito ? '' : 'inactive'}" id="badge-quick-private" title="Private Mode">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>

            <div class="apple-grouped-row" id="menu-quick-adblock-row">
              <div class="apple-row-icon mono-item" style="background-color: #18181b;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9.5" stroke="#ffffff" stroke-width="1.8"/>
                  <text x="12" y="15" text-anchor="middle" font-size="8.5" font-weight="800" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, sans-serif" letter-spacing="-0.5px">AD</text>
                  <line x1="4.5" y1="4.5" x2="19.5" y2="19.5" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title" style="font-size: 15.5px; font-weight: 600;">AD Blocker</div>
              </div>
              <div class="status-check-badge ${isAdBlockActive ? '' : 'inactive'}" id="badge-quick-adblock" title="Toggle AD Blocker">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>

            <div class="apple-grouped-row" id="menu-quick-aipower-row">
              <div class="apple-row-icon mono-item" style="background-color: #18181b;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff">
                  <path d="M5 8.5C5.8 8.5 6.5 7.8 6.5 7C6.5 6.2 7.2 5.5 8 5.5C7.2 5.5 6.5 4.8 6.5 4C6.5 3.2 5.8 2.5 5 2.5C4.2 2.5 3.5 3.2 3.5 4C3.5 4.8 2.8 5.5 2 5.5C2.8 5.5 3.5 6.2 3.5 7C3.5 7.8 4.2 8.5 5 8.5Z"/>
                  <path d="M19.7 4.3a2.5 2.5 0 0 0-3.5 0l-3 3 3.5 3.5 3-3a2.5 2.5 0 0 0 0-3.5z"/>
                  <path d="M11.8 8.7 4.2 16.3a1 1 0 0 0-.27.53L3.1 20a.6.6 0 0 0 .7.7l3.2-.83a1 1 0 0 0 .53-.27l7.6-7.6-3.33-3.3z"/>
                </svg>
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title" style="font-size: 15.5px; font-weight: 600;">AI Power</div>
              </div>
              <div class="status-check-badge" id="badge-quick-aipower" title="Launch Ocal Copilot AI">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
          </div>

          <!-- Section 1: Page & Navigation Actions -->
          <div class="apple-grouped-table" style="margin-top: 4px;">
            <div class="apple-grouped-row" id="menu-share-row">
              <div class="apple-row-icon mono-item">
                ${MENU_ICONS.share}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Share Page</div>
                <div class="apple-row-subtitle">${isInternal ? 'Share Ocal Browser' : (activeTab?.title || 'Send or copy link')}</div>
              </div>
              <div class="apple-row-chevron">${MENU_ICONS.chevron}</div>
            </div>
            <div class="apple-grouped-row" id="menu-incognito-row">
              <div class="apple-row-icon mono-item">
                ${MENU_ICONS.incognito}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">New Private Tab</div>
                <div class="apple-row-subtitle">Private browsing with zero history</div>
              </div>
              <div class="apple-row-chevron">${MENU_ICONS.chevron}</div>
            </div>
            <div class="apple-grouped-row" id="menu-reload-row">
              <div class="apple-row-icon mono-item">
                ${MENU_ICONS.reload}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Reload Page</div>
                <div class="apple-row-subtitle">Refresh current web page</div>
              </div>
              <div class="apple-row-chevron">${MENU_ICONS.chevron}</div>
            </div>
            <div class="apple-grouped-row" style="cursor: default;">
              <div class="apple-row-icon mono-item">
                ${MENU_ICONS.desktop}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Desktop Website</div>
                <div class="apple-row-subtitle">Request desktop version of site</div>
              </div>
              <label class="toggle-switch" style="margin-left: auto;">
                <input type="checkbox" id="toggle-desktop-site" ${isDesktop ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <!-- Section 2: Tools & Storage -->
          <div class="apple-grouped-table" style="margin-top: 10px;">
            <div class="apple-grouped-row" id="menu-copilot-row">
              <div class="apple-row-icon mono-copilot">
                ${MENU_ICONS.copilot}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Ocal Copilot</div>
                <div class="apple-row-subtitle">AI-powered page assistant</div>
              </div>
              <div class="apple-row-chevron">${MENU_ICONS.chevron}</div>
            </div>
            <div class="apple-grouped-row" id="menu-downloads-row">
              <div class="apple-row-icon mono-item">
                ${MENU_ICONS.download}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Downloads</div>
                <div class="apple-row-subtitle">File progress, sizes &amp; storage</div>
              </div>
              <div class="apple-row-chevron">${MENU_ICONS.chevron}</div>
            </div>
            <div class="apple-grouped-row" id="menu-passwords-row">
              <div class="apple-row-icon mono-item">
                ${MENU_ICONS.key}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Passwords &amp; Logins</div>
                <div class="apple-row-subtitle">Saved credentials &amp; import</div>
              </div>
              <div class="apple-row-chevron">${MENU_ICONS.chevron}</div>
            </div>
            <div class="apple-grouped-row" id="menu-sync-row">
              <div class="apple-row-icon mono-copilot">
                ${MENU_ICONS.sync}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Ocal Connect &amp; Sync</div>
                <div class="apple-row-subtitle">Pair with PC, clipboard &amp; tabs</div>
              </div>
              <div class="apple-row-chevron">${MENU_ICONS.chevron}</div>
            </div>
          </div>

          <!-- Section 3: Appearance & Preferences -->
          <div class="apple-grouped-table" style="margin-top: 10px;">
            <div class="apple-grouped-row" id="menu-theme-row">
              <div class="apple-row-icon mono-item">
                ${MENU_ICONS.theme}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Appearance Theme</div>
                <div class="apple-row-subtitle">Current: ${currentTheme.toUpperCase()} mode</div>
              </div>
              <div class="apple-row-chevron">${MENU_ICONS.chevron}</div>
            </div>
            <div class="apple-grouped-row" id="menu-settings-row">
              <div class="apple-row-icon mono-item">
                ${MENU_ICONS.settings}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Settings</div>
                <div class="apple-row-subtitle">Search engine, privacy &amp; data</div>
              </div>
              <div class="apple-row-chevron">${MENU_ICONS.chevron}</div>
            </div>
          </div>
        </div>
      `;

      const menuCloseBtn = sheet.querySelector('#menu-close-btn');
      menuCloseBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeAllSheets();
      });
      menuCloseBtn?.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeAllSheets();
      }, { passive: false });

      sheet.querySelector('#menu-bookmarks')?.addEventListener('click', () => {
        this.closeAllSheets();
        this.tabManager.navigateTab(this.tabManager.activeTabId, 'ocal://bookmarks');
      });
      sheet.querySelector('#menu-history')?.addEventListener('click', () => {
        this.closeAllSheets();
        this.tabManager.navigateTab(this.tabManager.activeTabId, 'ocal://history');
      });
      sheet.querySelector('#menu-games')?.addEventListener('click', () => {
        this.closeAllSheets();
        this.tabManager.navigateTab(this.tabManager.activeTabId, 'ocal://games');
      });
      sheet.querySelector('#menu-shield')?.addEventListener('click', () => {
        this.closeAllSheets();
        this.openCyberShieldSheet();
      });

      sheet.querySelector('#menu-quick-private-row')?.addEventListener('click', () => {
        this.closeAllSheets();
        this.tabManager.createTab('ocal://home', true);
        this.showToast('Private browsing tab opened', 'info');
      });

      sheet.querySelector('#menu-quick-adblock-row')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.cyberShield) {
          const nextState = !this.cyberShield.settings.adBlocker;
          this.cyberShield.settings.adBlocker = nextState;
          this.cyberShield.saveSettings();
          const badge = sheet.querySelector('#badge-quick-adblock');
          if (badge) {
            badge.classList.toggle('inactive', !nextState);
          }
          this.showToast(nextState ? 'AD Blocker enabled' : 'AD Blocker disabled', 'shield');
        }
      });

      sheet.querySelector('#menu-quick-aipower-row')?.addEventListener('click', () => {
        this.closeAllSheets();
        this.copilotDrawer.open();
      });

      sheet.querySelector('#menu-share-row')?.addEventListener('click', () => {
        this.closeAllSheets();
        if (activeTab) {
          const shareTitle = activeTab.title || 'Ocal Browser';
          const shareUrl = activeTab.url && !activeTab.url.startsWith('ocal://') ? activeTab.url : 'https://ocal.dev';
          this.shareContent(shareTitle, shareUrl);
        }
      });
      sheet.querySelector('#menu-incognito-row')?.addEventListener('click', () => {
        this.closeAllSheets();
        this.tabManager.createTab('ocal://home', true);
      });
      sheet.querySelector('#menu-copilot-row')?.addEventListener('click', () => {
        this.closeAllSheets();
        this.copilotDrawer.open();
      });
      sheet.querySelector('#menu-downloads-row')?.addEventListener('click', () => {
        this.closeAllSheets();
        this.tabManager.navigateTab(this.tabManager.activeTabId, 'ocal://downloads');
      });
      sheet.querySelector('#menu-passwords-row')?.addEventListener('click', () => {
        this.closeAllSheets();
        this.tabManager.navigateTab(this.tabManager.activeTabId, 'ocal://passwords');
      });
      sheet.querySelector('#menu-sync-row')?.addEventListener('click', () => {
        this.closeAllSheets();
        this.tabManager.navigateTab(this.tabManager.activeTabId, 'ocal://sync');
      });
      sheet.querySelector('#menu-reload-row')?.addEventListener('click', () => {
        this.closeAllSheets();
        if (this.tabManager.activeTabId) {
          const navReloadBtn = document.getElementById('nav-reload');
          navReloadBtn?.classList.add('is-reloading');
          this.animateProgressBar();
          this.tabManager.reloadTab(this.tabManager.activeTabId);
          setTimeout(() => navReloadBtn?.classList.remove('is-reloading'), 700);
        }
      });
      sheet.querySelector('#menu-theme-row')?.addEventListener('click', () => {
        const next = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('ocal-theme', next);
        this.updateStatusBarTheme(next === 'dark');
        this.tabManager?.syncThemeToTabs(next === 'dark');
        this.closeAllSheets();
      });
      sheet.querySelector('#menu-settings-row')?.addEventListener('click', () => {
        this.closeAllSheets();
        this.tabManager.navigateTab(this.tabManager.activeTabId, 'ocal://settings');
      });

      sheet.querySelector('#toggle-desktop-site')?.addEventListener('change', () => {
        if (activeTab) {
          this.tabManager.toggleDesktopMode(activeTab.id);
          this.closeAllSheets();
        }
      });

      sheet.classList.remove('visible');
      sheet.style.transform = '';
      void sheet.offsetHeight;
      requestAnimationFrame(() => {
        sheet.classList.add('visible');
        document.getElementById('drawer-backdrop')?.classList.add('visible');
      });
      this.setupSheetDragDismiss(sheet);
      if (window.OcalNative) {
        window.OcalNative.setOverlayOpen?.(true);
        window.OcalNative.setWebBlurred?.(true);
      }
      this.syncNativeNavigationState();
      this.syncOverlayState();
    }
  }

  closeAllSheets() {
    document.querySelectorAll('.bottom-sheet').forEach(s => {
      s.classList.remove('visible');
      s.style.transform = '';
    });
    document.getElementById('shield-popover')?.classList.remove('visible');
    document.getElementById('dl-quick-popover')?.classList.remove('visible');
    const bgPreview = document.getElementById('context-menu-bg-preview');
    if (bgPreview) {
      bgPreview.classList.remove('visible');
      bgPreview.style.backgroundImage = '';
    }
    const backdrop = document.getElementById('drawer-backdrop');
    backdrop?.classList.remove('visible');
    backdrop?.classList.remove('context-menu-active');
    document.body.classList.remove('context-menu-open');
    if (window.OcalNative) {
      window.OcalNative.setOverlayOpen?.(false);
      window.OcalNative.setWebBlurred?.(false);
    }
    this.syncNativeWebVisibility();
    this.syncNativeNavigationState();
    this.syncOverlayState();
  }

  bindBackHandler() {
    window.handleBackGesture = (event) => {
      if (!event) return;
      const action = event.action || 'commit';
      if (action !== 'commit') return;

      // Priority 1: Search active
      if (document.body.classList.contains('search-active')) {
        this.exitSearchMode();
        this.syncNativeNavigationState();
        return;
      }

      // Priority 2: Context menu
      const ctxSheet = document.getElementById('context-menu-sheet');
      if (ctxSheet && ctxSheet.classList.contains('visible')) {
        this.closeAllSheets();
        this.syncNativeNavigationState();
        return;
      }

      // Priority 3: Other bottom sheets
      const openSheet = document.querySelector('.bottom-sheet.visible');
      if (openSheet) {
        this.closeAllSheets();
        this.syncNativeNavigationState();
        return;
      }

      // Priority 4: Tabs tray
      const tabsTray = document.getElementById('tabs-tray-container');
      if (tabsTray && tabsTray.classList.contains('visible')) {
        this.closeTabsTray();
        this.syncNativeNavigationState();
        return;
      }

      // Priority 5: Shield & Download popovers
      const shieldPopover = document.getElementById('shield-popover');
      if (shieldPopover && shieldPopover.classList.contains('visible')) {
        shieldPopover.classList.remove('visible');
        this.syncNativeNavigationState();
        return;
      }
      const dlPopover = document.getElementById('dl-quick-popover');
      if (dlPopover && dlPopover.classList.contains('visible')) {
        dlPopover.classList.remove('visible');
        this.syncNativeNavigationState();
        return;
      }

      // Priority 6: Tab navigation - Direct back navigation without preview animation
      const activeTab = this.tabManager?.getActiveTab();
      if (activeTab) {
        if (activeTab.historyIdx > 0 || (!activeTab.url.startsWith('ocal://home') && !activeTab.url.startsWith('ocal://'))) {
          this.tabManager.goBack(activeTab.id);
          this.syncNativeNavigationState();
        } else {
          // Already at root home
          if (window.OcalNative && window.OcalNative.exitApp) {
            window.OcalNative.exitApp();
          }
        }
      }
    };
  }

  bindEdgeSwipeGesture() {
    const appRoot = document.getElementById('app-root');
    if (!appRoot) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let isSwiping = false;

    appRoot.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      isSwiping = false;

      // Only initiate if starting near left edge (<= 28px)
      if (touchStartX <= 28) {
        const hasModal = document.body.classList.contains('search-active') ||
          !!document.querySelector('.bottom-sheet.visible') ||
          !!document.querySelector('.tabs-tray-container.visible');
        if (!hasModal) {
          isSwiping = true;
        }
      }
    }, { passive: true });

    appRoot.addEventListener('touchend', (e) => {
      if (!isSwiping) return;
      isSwiping = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;

      if (dx > 45 && dx > Math.abs(dy) * 1.3) {
        const activeTab = this.tabManager?.getActiveTab();
        if (activeTab) {
          this.tabManager.goBack(activeTab.id);
          this.syncNativeNavigationState();
        }
      }
    }, { passive: true });
  }

  startWebBackPeek() {}
  updateWebBackPeek() {}
  commitWebBackPeek() {
    const activeTab = this.tabManager?.getActiveTab();
    if (activeTab) {
      this.tabManager.goBack(activeTab.id);
    }
    this.syncNativeNavigationState();
  }
  cancelWebBackPeek() {}

  syncOverlayState() {
    const isSearch = document.body.classList.contains('search-active');
    const suggestionsOpen = document.getElementById('suggestions-dropdown')?.classList.contains('visible');
    const shieldOpen = document.getElementById('shield-popover')?.classList.contains('visible');
    const dlOpen = document.getElementById('dl-quick-popover')?.classList.contains('visible');
    const contextMenuOpen = document.getElementById('context-menu-sheet')?.classList.contains('visible');
    const sheetOpen = !!document.querySelector('.bottom-sheet.visible, .modal-sheet.visible, .tabs-tray-container.visible, .drawer-backdrop.visible');

    const hasOverlay = Boolean(isSearch || suggestionsOpen || shieldOpen || dlOpen || contextMenuOpen || sheetOpen);

    if (window.OcalNative && typeof window.OcalNative.setOverlayOpen === 'function') {
      window.OcalNative.setOverlayOpen(hasOverlay);
    }
    this.syncNativeNavigationState();
  }

  setupOverlayObserver() {
    const observer = new MutationObserver(() => {
      this.syncOverlayState();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    ['shield-popover', 'dl-quick-popover', 'suggestions-dropdown', 'context-menu-sheet', 'menu-sheet', 'shield-sheet', 'tabs-tray-container', 'drawer-backdrop'].forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  }

  syncNativeNavigationState() {
    if (!window.OcalNative || typeof window.OcalNative.setWebNavigationState !== 'function') return;
    const isSearch = document.body.classList.contains('search-active');
    const hasOverlay = isSearch ||
      !!document.querySelector('.bottom-sheet.visible') ||
      !!document.querySelector('.tabs-tray-container.visible') ||
      !!document.querySelector('.shield-popover.visible') ||
      !!document.querySelector('.drawer-backdrop.visible');

    const activeTab = this.tabManager?.getActiveTab();
    const canGoBack = activeTab ? (activeTab.historyIdx > 0 || (!activeTab.url.startsWith('ocal://home') && !activeTab.url.startsWith('ocal://'))) : false;
    const isAtRoot = activeTab ? (activeTab.url === 'ocal://home' && this.tabManager.tabs.length <= 1) : true;

    try {
      window.OcalNative.setWebNavigationState(canGoBack, hasOverlay, isAtRoot);
    } catch (_) {}
  }

  bindInPageNavigationBridge() {
    window.addEventListener('message', (e) => {
      if (!e.data) return;

      if (e.data.type === 'OCAL_PAGE_LOADED') {
        const activeTab = this.tabManager.getActiveTab();
        if (activeTab && activeTab.id === this.tabManager.activeTabId) {
          if (e.data.title && e.data.title !== 'Start Page' && !e.data.title.startsWith('Ocal ')) {
            activeTab.title = e.data.title;
            try {
              const history = JSON.parse(localStorage.getItem('ocal-history') || '[]');
              const entry = history.find(h => h.url === e.data.url || h.url === activeTab.url);
              if (entry) {
                entry.title = e.data.title;
                localStorage.setItem('ocal-history', JSON.stringify(history));
              }
            } catch (err) {}
          }
          const omnibox = document.getElementById('omnibox-input');
          if (omnibox && document.activeElement !== omnibox) {
            omnibox.value = this.formatOmniboxUrl(e.data.url);
          }
          this.cyberShield.recordBlockedTracker(e.data.domain);
        }
      } else if (e.data.type === 'OCAL_BLOCKED_TRACKER') {
        const activeTab = this.tabManager?.getActiveTab();
        if (activeTab) {
          activeTab.blockedAdsCount = (activeTab.blockedAdsCount || 0) + 1;
          this.updateShieldStats(activeTab.blockedAdsCount);
        }
        this.cyberShield?.recordBlockedTracker(e.data.domain);
      } else if (e.data.type === 'OCAL_NAVIGATE') {
        if (e.data.url && this.tabManager.activeTabId) {
          this.animateProgressBar();
          this.tabManager.navigateTab(this.tabManager.activeTabId, e.data.url);
        }
      }
    });
  }

  animateProgressBar() {
    const bar = document.getElementById('progress-bar');
    if (!bar) return;
    bar.style.opacity = '1';
    bar.style.width = '35%';
    setTimeout(() => { bar.style.width = '75%'; }, 200);
    setTimeout(() => {
      bar.style.width = '100%';
      setTimeout(() => { bar.style.opacity = '0'; bar.style.width = '0%'; }, 250);
    }, 600);
  }

  toggleBookmarkCurrentPage() {
    const activeTab = this.tabManager?.getActiveTab();
    if (!activeTab || !activeTab.url || activeTab.url === 'ocal://home') {
      this.showToast('Open a webpage to bookmark it', 'heart-off');
      return;
    }

    let bookmarks = [];
    try {
      bookmarks = JSON.parse(localStorage.getItem('ocal-bookmarks') || '[]');
    } catch {
      bookmarks = [];
    }

    const currentUrl = activeTab.url;
    const existingIndex = bookmarks.findIndex(b => b.url === currentUrl);
    const heartBtn = document.getElementById('capsule-bookmark-btn');

    if (existingIndex !== -1) {
      // Remove bookmark
      bookmarks.splice(existingIndex, 1);
      localStorage.setItem('ocal-bookmarks', JSON.stringify(bookmarks));
      if (heartBtn) {
        heartBtn.classList.remove('is-bookmarked');
      }
      this.showToast('Removed from Bookmarks', 'heart-off');
    } else {
      // Add bookmark
      let title = activeTab.title;
      if (!title || title.startsWith('http')) {
        title = this.formatOmniboxUrl(currentUrl) || currentUrl;
      }
      bookmarks.unshift({
        url: currentUrl,
        title: title,
        timestamp: Date.now()
      });
      localStorage.setItem('ocal-bookmarks', JSON.stringify(bookmarks));
      if (heartBtn) {
        heartBtn.classList.add('is-bookmarked');
        heartBtn.classList.add('heart-pop');
        setTimeout(() => heartBtn.classList.remove('heart-pop'), 450);
      }
      try {
        if (navigator.vibrate) navigator.vibrate(30);
      } catch {}
      this.showToast('Saved to Bookmarks', 'heart');
    }
  }

  checkCurrentTabBookmarked() {
    const activeTab = this.tabManager?.getActiveTab();
    const heartBtn = document.getElementById('capsule-bookmark-btn');
    if (!heartBtn) return;

    if (!activeTab || !activeTab.url || activeTab.url === 'ocal://home' || activeTab.url.startsWith('ocal://')) {
      heartBtn.classList.remove('is-bookmarked');
      return;
    }

    let bookmarks = [];
    try {
      bookmarks = JSON.parse(localStorage.getItem('ocal-bookmarks') || '[]');
    } catch {
      bookmarks = [];
    }

    const isSaved = bookmarks.some(b => b.url === activeTab.url);
    if (isSaved) {
      heartBtn.classList.add('is-bookmarked');
    } else {
      heartBtn.classList.remove('is-bookmarked');
    }
  }

  showToast(msg, type = 'info') {
    const toast = document.getElementById('ocal-toast');
    const toastMsg = document.getElementById('toast-msg');
    const toastIcon = document.getElementById('toast-icon');
    if (!toast || !toastMsg) return;

    clearTimeout(this.toastTimer);

    let iconHtml = '';
    if (type === 'heart') {
      iconHtml = `<svg width="15" height="15" viewBox="0 0 24 24" fill="#ff2d55" stroke="#ff2d55" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
    } else if (type === 'heart-off') {
      iconHtml = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
    } else if (type === 'download') {
      iconHtml = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
    } else if (type === 'check') {
      iconHtml = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'copy') {
      iconHtml = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    } else {
      iconHtml = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    }

    if (toastIcon) toastIcon.innerHTML = iconHtml;
    toastMsg.innerText = msg;
    toast.classList.add('visible');

    this.toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2400);
  }

  formatOmniboxUrl(url) {
    if (!url || url === 'ocal://home') return '';
    if (url.startsWith('ocal://')) return url.replace('ocal://', '');
    try {
      const u = new URL(url);
      const q = u.searchParams.get('q');
      // If it is a search engine result page, show the search query
      if (q && (u.pathname.includes('/search') || u.pathname.includes('/html') || u.hostname.includes('google') || u.hostname.includes('duckduckgo') || u.hostname.includes('bing') || u.hostname.includes('brave'))) {
        try {
          return decodeURIComponent(q.replace(/\+/g, ' '));
        } catch {
          return q;
        }
      }
      // Otherwise display clean host name without leading www. or html.
      let host = u.hostname.replace(/^(www\.|html\.)/i, '');
      return host || url;
    } catch {
      return url.replace('ocal://', '');
    }
  }

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  setupNativeWebBridge() {
    // Synchronize bottom dock layout dimensions to native Android webview
    this.syncDockLayout = () => {
      if (document.body.classList.contains('search-active')) return;
      const dock = document.getElementById('bottom-dock');
      if (window.OcalNative && dock) {
        const isTop = document.documentElement.getAttribute('data-address-bar') === 'top';
        const rect = dock.getBoundingClientRect();
        const density = window.devicePixelRatio || 1;
        const heightPx = Math.round(rect.height * density);
        window.OcalNative.setDockLayout(heightPx, isTop);
      }
    };
    this.syncDockLayout();
    window.addEventListener('resize', () => {
      if (this.syncDockLayout) this.syncDockLayout();
      this.positionSuggestionsDropdown();
      if (document.getElementById('shield-popover')?.classList.contains('visible')) {
        this.positionShieldPopover();
      }
    });

    // Auto-hide bottom-dock when virtual keyboard opens or when input inside modals/internal pages is focused
    window.addEventListener('focusin', (e) => {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        if (!target.closest('.bottom-dock') && target.id !== 'omnibox-input') {
          document.body.classList.add('keyboard-open');
        }
      }
    });

    window.addEventListener('focusout', (e) => {
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA' && !active.isContentEditable) || active.closest('.bottom-dock') || active.id === 'omnibox-input') {
          document.body.classList.remove('keyboard-open');
        }
      }, 120);
    });

    if (window.visualViewport) {
      const initialH = window.visualViewport.height;
      window.visualViewport.addEventListener('resize', () => {
        const isShrunk = window.visualViewport.height < initialH * 0.78;
        const isInputActive = document.activeElement && 
          (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable) &&
          !document.activeElement.closest('.bottom-dock') &&
          document.activeElement.id !== 'omnibox-input';
        if (isShrunk && isInputActive) {
          document.body.classList.add('keyboard-open');
        } else if (!isInputActive) {
          document.body.classList.remove('keyboard-open');
        }
      });
    }

    // Global listener for native WebView lifecycle events
    window.onNativeWebEvent = (event) => {
      const activeTab = this.tabManager?.getActiveTab();
      if (!activeTab) return;

      if (event.type === 'AD_BLOCKED') {
        const count = parseInt(event.title || '0', 10);
        activeTab.blockedAdsCount = count;
        this.updateShieldStats(count);
        this.cyberShield?.recordBlockedTracker(event.url);
        return;
      }

      if (event.type === 'NAVIGATE_BACK_TO_INTERNAL') {
        if (activeTab.historyIdx > 0) {
          this.tabManager.goBack(activeTab.id);
        } else {
          this.tabManager.navigateTab(activeTab.id, 'ocal://home', false);
        }
        return;
      }

      if (event.type === 'PAGE_STARTED') {
        this.animateProgressBar();
        activeTab.blockedAdsCount = 0;
        this.updateShieldStats(0);
        if (typeof event.canGoBack === 'boolean') window.nativeCanGoBack = event.canGoBack;
        if (typeof event.canGoForward === 'boolean') window.nativeCanGoForward = event.canGoForward;
        if (event.url) {
          activeTab.url = event.url;
          const isWeb = !event.url.startsWith('ocal://');
          if (isWeb) {
            document.documentElement.classList.add('is-web-page');
            document.body.classList.add('is-web-page');
            document.body.classList.remove('is-internal-page');
          } else {
            document.documentElement.classList.remove('is-web-page');
            document.body.classList.remove('is-web-page');
            document.body.classList.add('is-internal-page');
            this.tabManager.navigateTab(activeTab.id, event.url, false);
          }
          const omniboxInput = document.getElementById('omnibox-input');
          if (omniboxInput && document.activeElement !== omniboxInput) {
            omniboxInput.value = this.formatOmniboxUrl(event.url);
          }
        }
        this.checkCurrentTabBookmarked();
      } else if (event.type === 'PAGE_FINISHED') {
        const bar = document.getElementById('progress-bar');
        if (bar) {
          bar.style.width = '100%';
          setTimeout(() => { bar.style.opacity = '0'; bar.style.width = '0%'; }, 200);
        }
        clearTimeout(this.suggestDebounceTimer);
        if (this.suggestAbortController) {
          this.suggestAbortController.abort();
          this.suggestAbortController = null;
        }
        const sDropdown = document.getElementById('suggestions-dropdown');
        if (sDropdown) {
          sDropdown.classList.remove('visible');
          sDropdown.innerHTML = '';
        }
        if (typeof event.canGoBack === 'boolean') window.nativeCanGoBack = event.canGoBack;
        if (typeof event.canGoForward === 'boolean') window.nativeCanGoForward = event.canGoForward;
        if (event.url) {
          activeTab.url = event.url;
          const isWeb = !event.url.startsWith('ocal://');
          if (isWeb) {
            document.documentElement.classList.add('is-web-page');
            document.body.classList.add('is-web-page');
            document.body.classList.remove('is-internal-page');
          } else {
            document.documentElement.classList.remove('is-web-page');
            document.body.classList.remove('is-web-page');
            document.body.classList.add('is-internal-page');
            if (!activeTab.frameWrapperEl?.hasChildNodes()) {
              this.tabManager.navigateTab(activeTab.id, event.url, false);
            }
          }
          const omniboxInput = document.getElementById('omnibox-input');
          if (omniboxInput && document.activeElement !== omniboxInput) {
            omniboxInput.value = this.formatOmniboxUrl(event.url);
          }
          try {
            const u = new URL(event.url);
            const popoverDomain = document.getElementById('shield-popover-domain');
            if (popoverDomain) popoverDomain.innerText = u.hostname;
          } catch {}
        }
        if (event.title) {
          activeTab.title = event.title;
        }
        const navBackBtn = document.getElementById('nav-back');
        const navFwdBtn = document.getElementById('nav-forward');
        if (navBackBtn && typeof event.canGoBack === 'boolean') navBackBtn.disabled = !event.canGoBack;
        if (navFwdBtn && typeof event.canGoForward === 'boolean') navFwdBtn.disabled = !event.canGoForward;
        this.checkCurrentTabBookmarked();
      } else if (event.type === 'TITLE_CHANGED') {
        if (event.title) {
          activeTab.title = event.title;
        }
        this.checkCurrentTabBookmarked();
      } else if (event.type === 'CONTEXT_MENU') {
        this.openContextMenu(event);
      } else if (event.type === 'TAB_THUMBNAIL_CAPTURED') {
        if (event.thumbnail) {
          this.tabManager?.setTabThumbnail(event.tabId, event.url, event.thumbnail);
          this.updateWebBgSnapshot(event.thumbnail);
        }
      } else if (event.type === 'PROGRESS') {
        const bar = document.getElementById('progress-bar');
        if (bar) {
          bar.style.opacity = '1';
          bar.style.width = Math.max(10, event.progress) + '%';
          if (event.progress >= 100) {
            setTimeout(() => { bar.style.opacity = '0'; bar.style.width = '0%'; }, 200);
          }
        }
      }
    };
  }

  syncNativeWebVisibility() {
    if (!window.OcalNative) return;
    const activeTab = this.tabManager?.getActiveTab();
    const isWebUrl = activeTab && !activeTab.url.startsWith('ocal://') && !activeTab.url.includes('dineinstyle.com');
    const isOverlayOpen = document.body.classList.contains('search-active') ||
      document.getElementById('tabs-tray-container')?.classList.contains('visible') ||
      document.getElementById('shield-sheet')?.classList.contains('visible') ||
      document.getElementById('menu-sheet')?.classList.contains('visible') ||
      document.getElementById('copilot-sheet')?.classList.contains('visible') ||
      document.getElementById('context-menu-sheet')?.classList.contains('visible') ||
      document.getElementById('drawer-backdrop')?.classList.contains('visible');
    
    if (isWebUrl && !isOverlayOpen) {
      window.OcalNative.setWebVisible(true);
    } else {
      window.OcalNative.setWebVisible(false);
    }
  }

  updateWebBgSnapshot(dataUrl) {
    if (!dataUrl) return;
    const snapEl = document.getElementById('web-page-bg-snapshot');
    if (snapEl) {
      snapEl.style.backgroundImage = `url("${dataUrl}")`;
    }
  }

  updateStatusBarTheme(isDark = null) {
    const currentTheme = isDark !== null ? (isDark ? 'dark' : 'light') : (document.documentElement.getAttribute('data-theme') || 'light');
    const isDarkMode = currentTheme === 'dark';

    // Synchronize theme to active tabs & native layer
    if (this.tabManager && typeof this.tabManager.syncThemeToTabs === 'function') {
      this.tabManager.syncThemeToTabs(isDarkMode);
    } else if (window.OcalNative && typeof window.OcalNative.setDarkMode === 'function') {
      window.OcalNative.setDarkMode(isDarkMode);
    }

    let bgColor = '#ffffff';
    if (isDarkMode) {
      bgColor = '#000000';
    } else {
      const activeTab = this.tabManager?.getActiveTab();
      const isInternalSubpage = activeTab && activeTab.url?.startsWith('ocal://') && activeTab.url !== 'ocal://home';
      bgColor = isInternalSubpage ? '#f2f2f7' : '#ffffff';
    }

    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute('content', bgColor);

    if (window.OcalNative && typeof window.OcalNative.setStatusBarTheme === 'function') {
      try {
        window.OcalNative.setStatusBarTheme(isDarkMode, bgColor);
      } catch (err) {
        console.warn('[OcalNative] setStatusBarTheme error:', err);
      }
    }
  }

  checkInitialPermissionsPrompt() {
    if (!window.OcalNative) return;
    const hasPrompted = localStorage.getItem('ocal-permissions-prompted');
    if (hasPrompted) return;

    // Gracefully ask user after 1.5 seconds so app renders first
    setTimeout(() => {
      this.showPermissionsDialog();
    }, 1500);
  }

  showPermissionsDialog() {
    const existing = document.getElementById('ocal-permission-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'ocal-permission-modal';
    modal.className = 'permission-modal-backdrop';
    modal.innerHTML = `
      <div class="permission-modal-card">
        <div class="permission-modal-icon">
          <i class="fas fa-shield-halved"></i>
        </div>
        <h3 class="permission-modal-title">Enable Browser Permissions</h3>
        <p class="permission-modal-desc">
          To provide full browser capabilities, Ocal needs permission to download files, send download notifications, and access camera/microphone when requested by websites.
        </p>
        <div class="permission-modal-features">
          <div class="permission-feature-row">
            <i class="fas fa-bell"></i>
            <span>Notifications for download progress and alerts</span>
          </div>
          <div class="permission-feature-row">
            <i class="fas fa-folder-open"></i>
            <span>File manager and download storage</span>
          </div>
          <div class="permission-feature-row">
            <i class="fas fa-camera"></i>
            <span>Camera, mic & location for web apps</span>
          </div>
        </div>
        <div class="permission-modal-actions">
          <button class="permission-btn permission-grant-btn" id="modal-grant-perms-btn">
            Grant Permissions
          </button>
          <button class="permission-btn permission-skip-btn" id="modal-skip-perms-btn">
            Maybe Later
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('visible'));

    modal.querySelector('#modal-grant-perms-btn')?.addEventListener('click', () => {
      localStorage.setItem('ocal-permissions-prompted', 'true');
      modal.classList.remove('visible');
      setTimeout(() => modal.remove(), 250);
      if (window.OcalNative && typeof window.OcalNative.requestAllPermissions === 'function') {
        window.OcalNative.requestAllPermissions();
      }
    });

    modal.querySelector('#modal-skip-perms-btn')?.addEventListener('click', () => {
      localStorage.setItem('ocal-permissions-prompted', 'true');
      modal.classList.remove('visible');
      setTimeout(() => modal.remove(), 250);
    });
  }

  setupContextMenuListeners() {
    let touchTimer = null;
    let startX = 0;
    let startY = 0;

    const clearTimer = () => {
      if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
      }
    };

    document.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) {
        clearTimer();
        return;
      }
      if (e.target.closest('.bottom-dock') || e.target.closest('.bottom-sheet') || e.target.closest('.tabs-tray-container')) {
        clearTimer();
        return;
      }

      // Check if user is tapping/holding plain text or selecting text
      const anchor = e.target.closest('a');
      const img = e.target.closest('img');
      if (!anchor && !img) {
        // Plain text or background: do NOT start context menu timer!
        // This allows browser and Android native text selection and drag selection handles!
        clearTimer();
        return;
      }

      const currentSel = window.getSelection() ? window.getSelection().toString().trim() : '';
      if (currentSel.length > 0) {
        clearTimer();
        return;
      }

      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      clearTimer();
      touchTimer = setTimeout(() => {
        touchTimer = null;
        try {
          if (navigator.vibrate) navigator.vibrate(35);
        } catch {}
        this.inspectAndShowContextMenu(e.target);
      }, 520);
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!touchTimer || !e.touches[0]) return;
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dx > 12 || dy > 12) {
        clearTimer();
      }
    }, { passive: true });

    document.addEventListener('touchend', clearTimer, { passive: true });
    document.addEventListener('touchcancel', clearTimer, { passive: true });
    document.addEventListener('selectionchange', clearTimer, { passive: true });

    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.bottom-dock') || e.target.closest('.bottom-sheet') || e.target.closest('.tabs-tray-container')) {
        return;
      }
      const currentSel = window.getSelection() ? window.getSelection().toString().trim() : '';
      if (currentSel.length > 0) {
        return; // Allow native text selection / copy menu
      }
      const anchor = e.target.closest('a');
      const img = e.target.closest('img');
      if (!anchor && !img) {
        return; // Don't intercept plain text selection
      }
      e.preventDefault();
      this.inspectAndShowContextMenu(e.target);
    });
  }

  inspectAndShowContextMenu(target) {
    if (!target) return;
    const currentSel = window.getSelection() ? window.getSelection().toString().trim() : '';
    if (currentSel.length > 0) return;

    const anchor = target.closest('a');
    const img = target.closest('img');
    if (!anchor && !img) return;

    const activeTab = this.tabManager?.getActiveTab();
    const pageUrl = activeTab?.url || window.location.href;
    const pageTitle = activeTab?.title || document.title || 'Page';

    let hitType = 'page';
    let linkUrl = '';
    let imageUrl = '';
    let title = '';

    if (anchor && img) {
      hitType = 'image-link';
      linkUrl = anchor.href || '';
      imageUrl = img.src || '';
      title = anchor.title || img.alt || anchor.innerText?.trim() || '';
    } else if (anchor) {
      hitType = 'link';
      linkUrl = anchor.href || '';
      title = anchor.title || anchor.innerText?.trim() || '';
    } else if (img) {
      hitType = 'image';
      imageUrl = img.src || '';
      title = img.alt || '';
    } else {
      return;
    }

    this.openContextMenu({
      hitType,
      linkUrl,
      imageUrl,
      title,
      pageUrl,
      pageTitle
    });
  }

  openContextMenu(data) {
    this.closeAllSheets();
    const sheet = document.getElementById('context-menu-sheet');
    if (!sheet) return;

    const hitType = data?.hitType || 'page';
    const linkUrl = data?.linkUrl || '';
    const imageUrl = data?.imageUrl || '';
    const title = data?.title || '';
    const activeTab = this.tabManager?.getActiveTab();
    const pageUrl = data?.pageUrl || activeTab?.url || 'ocal://home';
    const pageTitle = data?.pageTitle || activeTab?.title || 'Start Page';

    const ICONS = {
      newTab: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`,
      bgTab: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="16" height="14" rx="2"/><path d="M6 3h12a2 2 0 0 1 2 2v12"/></svg>`,
      copy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
      share: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>`,
      heart: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
      download: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
      image: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
      reload: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>`,
      chevron: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
      link: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
      page: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/></svg>`
    };

    let previewHtml = '';
    if (imageUrl) {
      previewHtml = `
        <div class="context-preview-card">
          <img class="context-preview-thumb" src="${imageUrl}" onerror="this.style.display='none'"/>
          <div class="context-preview-info">
            <div class="context-preview-title">${title || (linkUrl ? this.formatOmniboxUrl(linkUrl) : 'Image')}</div>
            <div class="context-preview-sub">${linkUrl || imageUrl}</div>
          </div>
        </div>
      `;
    } else if (linkUrl) {
      previewHtml = `
        <div class="context-preview-card">
          <div class="context-preview-icon">${ICONS.link}</div>
          <div class="context-preview-info">
            <div class="context-preview-title">${title || this.formatOmniboxUrl(linkUrl) || linkUrl}</div>
            <div class="context-preview-sub">${linkUrl}</div>
          </div>
        </div>
      `;
    } else {
      previewHtml = `
        <div class="context-preview-card">
          <div class="context-preview-icon">${ICONS.page}</div>
          <div class="context-preview-info">
            <div class="context-preview-title">${pageTitle || 'Page Options'}</div>
            <div class="context-preview-sub">${this.formatOmniboxUrl(pageUrl) || pageUrl}</div>
          </div>
        </div>
      `;
    }

    let rowsHtml = '';
    if (hitType === 'image-link') {
      rowsHtml = `
        <div class="apple-grouped-row" id="ctx-open-new-tab">
          <div class="apple-row-icon mono-item">${ICONS.newTab}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">Open Link in New Tab</div>
            <div class="apple-row-subtitle">Open this destination in a foreground tab</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
        <div class="apple-grouped-row" id="ctx-open-img-tab">
          <div class="apple-row-icon mono-item">${ICONS.image}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">Open Image in New Tab</div>
            <div class="apple-row-subtitle">View image file directly</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
        <div class="apple-grouped-row" id="ctx-save-img">
          <div class="apple-row-icon mono-item">${ICONS.download}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">Save Image</div>
            <div class="apple-row-subtitle">Download image to your device</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
        <div class="apple-grouped-row" id="ctx-copy-link">
          <div class="apple-row-icon mono-item">${ICONS.copy}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">Copy Link Address</div>
            <div class="apple-row-subtitle">Copy link destination to clipboard</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
        <div class="apple-grouped-row" id="ctx-copy-img-link">
          <div class="apple-row-icon mono-item">${ICONS.copy}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">Copy Image Address</div>
            <div class="apple-row-subtitle">Copy image source URL</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
        <div class="apple-grouped-row" id="ctx-share-link">
          <div class="apple-row-icon mono-item">${ICONS.share}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">Share Link</div>
            <div class="apple-row-subtitle">Share link with other apps</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
      `;
    } else if (hitType === 'image') {
      rowsHtml = `
        <div class="apple-grouped-row" id="ctx-open-img-tab">
          <div class="apple-row-icon mono-item">${ICONS.image}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">Open Image in New Tab</div>
            <div class="apple-row-subtitle">View full resolution image</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
        <div class="apple-grouped-row" id="ctx-save-img">
          <div class="apple-row-icon mono-item">${ICONS.download}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">Save Image</div>
            <div class="apple-row-subtitle">Download image to your device</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
        <div class="apple-grouped-row" id="ctx-copy-img-link">
          <div class="apple-row-icon mono-item">${ICONS.copy}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">Copy Image Address</div>
            <div class="apple-row-subtitle">Copy image URL to clipboard</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
        <div class="apple-grouped-row" id="ctx-share-img">
          <div class="apple-row-icon mono-item">${ICONS.share}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">Share Image</div>
            <div class="apple-row-subtitle">Share image link with other apps</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
      `;
    } else if (hitType === 'link') {
      rowsHtml = `
        <div class="apple-grouped-row" id="ctx-open-new-tab">
          <div class="apple-row-icon mono-item">${ICONS.newTab}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">Open in New Tab</div>
            <div class="apple-row-subtitle">Switch to new tab immediately</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
        <div class="apple-grouped-row" id="ctx-open-bg-tab">
          <div class="apple-row-icon mono-item">${ICONS.bgTab}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">Open in Background</div>
            <div class="apple-row-subtitle">Open in a tab behind current page</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
        <div class="apple-grouped-row" id="ctx-copy-link">
          <div class="apple-row-icon mono-item">${ICONS.copy}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">Copy Link Address</div>
            <div class="apple-row-subtitle">Copy URL to clipboard</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
        <div class="apple-grouped-row" id="ctx-share-link">
          <div class="apple-row-icon mono-item">${ICONS.share}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">Share Link</div>
            <div class="apple-row-subtitle">Send link to contacts or apps</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
        <div class="apple-grouped-row" id="ctx-bookmark-link">
          <div class="apple-row-icon mono-item">${ICONS.heart}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">Add to Bookmarks</div>
            <div class="apple-row-subtitle">Save link to your bookmarks</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
      `;
    } else {
      rowsHtml = `
        <div class="apple-grouped-row" id="ctx-reload-page">
          <div class="apple-row-icon mono-item">${ICONS.reload}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">Reload Page</div>
            <div class="apple-row-subtitle">Refresh the current page</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
        <div class="apple-grouped-row" id="ctx-bookmark-page">
          <div class="apple-row-icon mono-item">${ICONS.heart}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">Bookmark Page</div>
            <div class="apple-row-subtitle">Save this page to bookmarks</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
        <div class="apple-grouped-row" id="ctx-share-page">
          <div class="apple-row-icon mono-item">${ICONS.share}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">Share Page</div>
            <div class="apple-row-subtitle">Share this page address</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
        <div class="apple-grouped-row" id="ctx-copy-page-url">
          <div class="apple-row-icon mono-item">${ICONS.copy}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">Copy Page URL</div>
            <div class="apple-row-subtitle">Copy address to clipboard</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
        <div class="apple-grouped-row" id="ctx-new-tab">
          <div class="apple-row-icon mono-item">${ICONS.newTab}</div>
          <div class="apple-row-content">
            <div class="apple-row-title">New Tab</div>
            <div class="apple-row-subtitle">Open a new start page</div>
          </div>
          <div class="apple-row-chevron">${ICONS.chevron}</div>
        </div>
      `;
    }

    sheet.innerHTML = `
      <div class="sheet-handle-bar">
        <div class="sheet-handle"></div>
      </div>
      <div class="sheet-content context-menu-body">
        ${previewHtml}
        <div class="apple-grouped-table">
          ${rowsHtml}
        </div>
        <button class="context-menu-cancel-btn" id="ctx-cancel-btn">Cancel</button>
      </div>
    `;

    sheet.querySelector('#ctx-open-new-tab')?.addEventListener('click', () => {
      this.closeAllSheets();
      if (linkUrl) {
        this.tabManager.createTab(linkUrl, false);
        this.showToast('Opened in new tab', 'info');
      }
    });

    sheet.querySelector('#ctx-open-bg-tab')?.addEventListener('click', () => {
      this.closeAllSheets();
      if (linkUrl) {
        this.tabManager.createTab(linkUrl, true);
        this.showToast('Opened in background', 'info');
      }
    });

    sheet.querySelector('#ctx-copy-link')?.addEventListener('click', () => {
      this.closeAllSheets();
      if (linkUrl) this.copyToClipboard(linkUrl, 'Link copied');
    });

    sheet.querySelector('#ctx-open-img-tab')?.addEventListener('click', () => {
      this.closeAllSheets();
      if (imageUrl) {
        this.tabManager.createTab(imageUrl, false);
        this.showToast('Image opened in new tab', 'info');
      }
    });

    sheet.querySelector('#ctx-save-img')?.addEventListener('click', () => {
      this.closeAllSheets();
      if (imageUrl) this.saveImage(imageUrl);
    });

    sheet.querySelector('#ctx-copy-img-link')?.addEventListener('click', () => {
      this.closeAllSheets();
      if (imageUrl) this.copyToClipboard(imageUrl, 'Image link copied');
    });

    sheet.querySelector('#ctx-share-link')?.addEventListener('click', () => {
      this.closeAllSheets();
      if (linkUrl) this.shareContent(title || 'Check this out', linkUrl);
    });

    sheet.querySelector('#ctx-share-img')?.addEventListener('click', () => {
      this.closeAllSheets();
      if (imageUrl) this.shareContent(title || 'Image', imageUrl);
    });

    sheet.querySelector('#ctx-bookmark-link')?.addEventListener('click', () => {
      this.closeAllSheets();
      if (linkUrl) this.bookmarkSpecificUrl(linkUrl, title);
    });

    sheet.querySelector('#ctx-reload-page')?.addEventListener('click', () => {
      this.closeAllSheets();
      if (this.tabManager.activeTabId) this.tabManager.reloadTab(this.tabManager.activeTabId);
    });

    sheet.querySelector('#ctx-bookmark-page')?.addEventListener('click', () => {
      this.closeAllSheets();
      this.toggleBookmarkCurrentPage();
    });

    sheet.querySelector('#ctx-share-page')?.addEventListener('click', () => {
      this.closeAllSheets();
      this.shareContent(pageTitle, pageUrl);
    });

    sheet.querySelector('#ctx-copy-page-url')?.addEventListener('click', () => {
      this.closeAllSheets();
      this.copyToClipboard(pageUrl, 'Page URL copied');
    });

    sheet.querySelector('#ctx-new-tab')?.addEventListener('click', () => {
      this.closeAllSheets();
      this.tabManager.createTab('ocal://home', false);
    });

    sheet.querySelector('#ctx-cancel-btn')?.addEventListener('click', () => {
      this.closeAllSheets();
    });

    const bgPreview = document.getElementById('context-menu-bg-preview');
    const snapshot = data?.snapshot || activeTab?.thumbnail || (window.OcalNative ? window.OcalNative.getLastTabThumbnail() : '') || '';
    if (bgPreview) {
      if (snapshot && snapshot.startsWith('data:image/')) {
        bgPreview.style.backgroundImage = `url("${snapshot}")`;
        bgPreview.classList.add('visible');
      } else {
        bgPreview.classList.remove('visible');
        bgPreview.style.backgroundImage = '';
      }
    }
    if (snapshot) {
      this.updateWebBgSnapshot(snapshot);
    }

    if (window.OcalNative) {
      window.OcalNative.setOverlayOpen?.(true);
      window.OcalNative.setWebBlurred?.(true);
    }
    sheet.classList.remove('visible');
    sheet.style.transform = '';
    void sheet.offsetHeight;
    requestAnimationFrame(() => {
      sheet.classList.add('visible');
      const backdrop = document.getElementById('drawer-backdrop');
      backdrop?.classList.add('visible');
      backdrop?.classList.add('context-menu-active');
      document.body.classList.add('context-menu-open');
    });
    this.syncNativeNavigationState();
    this.syncOverlayState();
  }

  copyToClipboard(text, label = 'Copied to clipboard') {
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const input = document.createElement('textarea');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      this.showToast(label, 'info');
    } catch {
      this.showToast('Failed to copy', 'danger');
    }
  }

  shareContent(title, url) {
    if (!url) return;
    if (window.OcalNative && typeof window.OcalNative.share === 'function') {
      window.OcalNative.share(title || 'Share', '', url);
    } else if (navigator.share) {
      navigator.share({ title: title || 'Share', url: url }).catch(() => {});
    } else {
      this.copyToClipboard(url, 'Link copied');
    }
  }

  saveImage(url) {
    if (!url) return;
    let filename = 'image.png';
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/');
      const last = parts[parts.length - 1];
      if (last && last.includes('.')) filename = last;
    } catch {}

    if (window.OcalNative && typeof window.OcalNative.triggerDownload === 'function') {
      window.OcalNative.triggerDownload(url, filename, 'image/*');
      this.showToast('Starting image download...', 'download');
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      DownloadsManager.addDownload({
        filename,
        url,
        filePath: 'Download/' + filename,
        totalBytes: 524288,
        downloadedBytes: 524288,
        progress: 100,
        status: 'completed',
        mimetype: 'image/*'
      });
      this.showToast('Image saved', 'download');
    }
  }

  bookmarkSpecificUrl(url, title) {
    if (!url || url.startsWith('ocal://')) return;
    let bookmarks = [];
    try {
      bookmarks = JSON.parse(localStorage.getItem('ocal-bookmarks') || '[]');
    } catch {
      bookmarks = [];
    }

    const idx = bookmarks.findIndex(b => b.url === url);
    if (idx !== -1) {
      this.showToast('Already in Bookmarks', 'heart');
      return;
    }

    bookmarks.unshift({
      url: url,
      title: title || this.formatOmniboxUrl(url) || url,
      timestamp: Date.now()
    });
    localStorage.setItem('ocal-bookmarks', JSON.stringify(bookmarks));
    this.checkCurrentTabBookmarked();
    this.showToast('Saved to Bookmarks', 'heart');
  }
}

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new OcalMobileApp();
  window.ocalApp = app;
  app.init();
});
