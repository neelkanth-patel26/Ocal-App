/**
 * ZenReader.js - Distraction-Free Article Reader Mode for Ocal Browser
 * Includes Minimalist Typography, OLED/Paper/Sepia themes, Reading Progress, and TTS Audio Reader.
 */

export class ZenReader {
  constructor(options = {}) {
    this.tabManager = options.tabManager;
    this.cyberShield = options.cyberShield;
    this.container = null;
    this.isOpen = false;
    this.currentArticle = null;

    // Persisted preferences
    this.theme = localStorage.getItem('ocal_zen_theme') || 'oled';
    this.fontSize = parseInt(localStorage.getItem('ocal_zen_fontsize') || '18', 10);
    this.fontFamily = localStorage.getItem('ocal_zen_fontfamily') || 'sans';
    this.speechRate = parseFloat(localStorage.getItem('ocal_zen_speech_rate') || '1.0');

    // TTS state
    this.speechSynthesis = window.speechSynthesis;
    this.utterance = null;
    this.isPlayingAudio = false;
    this.currentParagraphIndex = 0;
    this.paragraphs = [];

    this.init();
  }

  init() {
    // Create base container if not present
    if (!document.getElementById('zen-reader-overlay')) {
      this.container = document.createElement('div');
      this.container.id = 'zen-reader-overlay';
      this.container.className = `zen-reader-overlay theme-${this.theme} font-${this.fontFamily}`;
      this.container.style.display = 'none';
      document.body.appendChild(this.container);
    } else {
      this.container = document.getElementById('zen-reader-overlay');
    }
  }

  /**
   * Open Zen Reader for the active tab
   */
  async open(tab) {
    if (!tab) return;
    this.isOpen = true;
    document.body.classList.add('zen-reader-open');

    // Inform native layer that overlay is open to disable webview touch stealing
    if (window.OcalNative && typeof window.OcalNative.setOverlayOpen === 'function') {
      window.OcalNative.setOverlayOpen(true);
    }

    // Turn status bar pitch black for distraction-free reading
    this.updateStatusBar();
    this.triggerHaptic(12);

    // Show overlay with loading skeleton
    this.container.style.display = 'flex';
    this.container.classList.add('visible');
    this.container.innerHTML = this.getLoadingSkeletonHtml(tab);
    this.attachSkeletonEvents();

    try {
      const data = await this.extractArticle(tab);
      if (!data || (!data.text && !data.html)) {
        throw new Error('No article content found');
      }

      this.currentArticle = data;
      this.renderArticle(data);
    } catch (err) {
      console.warn('[ZenReader] Extraction fallback:', err);
      // Fallback display
      this.renderFallback(tab);
    }
  }

  /**
   * Extract article data via Native Bridge or Iframe
   */
  extractArticle(tab) {
    return new Promise((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(this.createFallbackData(tab));
        }
      }, 1600);

      // 1. Android Native WebView
      if (window.OcalNative && typeof window.OcalNative.getPageContent === 'function') {
        window.onNativePageContent = (result) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            try {
              let parsed = typeof result === 'string' ? JSON.parse(result) : result;
              if (typeof parsed === 'string') parsed = JSON.parse(parsed);
              resolve({
                title: parsed?.title || tab.title || 'Untitled Article',
                url: parsed?.url || tab.url || '',
                author: parsed?.author || '',
                siteName: parsed?.siteName || this.getDomain(tab.url),
                text: parsed?.text || '',
                html: parsed?.html || '',
                wordCount: parsed?.wordCount || (parsed?.text ? parsed.text.split(/\s+/).length : 0),
                readingTime: parsed?.readingTime || Math.max(1, Math.ceil((parsed?.text?.length || 0) / 1000))
              });
            } catch (e) {
              resolve(this.createFallbackData(tab));
            }
          }
        };
        window.OcalNative.getPageContent();
        return;
      }

      // 2. Web Iframe Scraper fallback
      if (tab.frameEl && tab.frameEl.contentDocument) {
        try {
          const doc = tab.frameEl.contentDocument;
          const title = doc.querySelector('meta[property="og:title"]')?.content || doc.title || tab.title || '';
          const author = doc.querySelector('meta[name="author"]')?.content || doc.querySelector('[rel="author"], .byline')?.innerText?.trim() || '';
          const siteName = doc.querySelector('meta[property="og:site_name"]')?.content || this.getDomain(tab.url);
          const article = doc.querySelector('article, [role="main"], .post-content, .article-content, main') || doc.body;
          const clone = article ? article.cloneNode(true) : null;
          let html = '';
          let text = '';
          if (clone) {
            const bad = clone.querySelectorAll('script, style, nav, header, footer, aside, form, iframe, [class*="ad"]');
            bad.forEach(b => b.remove());
            html = clone.innerHTML;
            text = clone.innerText || '';
          }
          resolved = true;
          clearTimeout(timeout);
          resolve({
            title,
            url: tab.url,
            author,
            siteName,
            text,
            html,
            wordCount: text.split(/\s+/).length,
            readingTime: Math.max(1, Math.ceil(text.split(/\s+/).length / 220))
          });
          return;
        } catch (e) {
          // Cross-origin restriction
        }
      }

      // Fallback
      resolved = true;
      clearTimeout(timeout);
      resolve(this.createFallbackData(tab));
    });
  }

  createFallbackData(tab) {
    return {
      title: tab?.title || 'Web Page',
      url: tab?.url || '',
      author: '',
      siteName: this.getDomain(tab?.url),
      text: tab?.title || '',
      html: `<p>${tab?.title || ''}</p>`,
      wordCount: 10,
      readingTime: 1
    };
  }

  getDomain(url) {
    if (!url) return 'Web Article';
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return 'Web Article';
    }
  }

  getLoadingSkeletonHtml(tab) {
    return `
      <div class="zen-top-bar">
        <button class="zen-btn zen-back-btn" id="zen-close-skeleton" title="Back to Web">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Web</span>
        </button>
        <div class="zen-site-capsule">${this.getDomain(tab?.url)}</div>
        <div style="width: 60px;"></div>
      </div>
      <div class="zen-skeleton-container">
        <div class="zen-skeleton-line title"></div>
        <div class="zen-skeleton-line subtitle"></div>
        <div class="zen-skeleton-meta">
          <div class="zen-skeleton-pill"></div>
          <div class="zen-skeleton-pill"></div>
        </div>
        <div class="zen-skeleton-paragraph">
          <div class="zen-skeleton-line"></div>
          <div class="zen-skeleton-line"></div>
          <div class="zen-skeleton-line"></div>
          <div class="zen-skeleton-line short"></div>
        </div>
        <div class="zen-skeleton-paragraph">
          <div class="zen-skeleton-line"></div>
          <div class="zen-skeleton-line"></div>
          <div class="zen-skeleton-line short"></div>
        </div>
      </div>
    `;
  }

  attachSkeletonEvents() {
    this.container.querySelector('#zen-close-skeleton')?.addEventListener('click', () => {
      this.close();
    });
  }

  renderFallback(tab) {
    this.renderArticle({
      title: tab?.title || 'Reader Mode',
      url: tab?.url || '',
      author: '',
      siteName: this.getDomain(tab?.url),
      text: 'Unable to extract full text automatically from this page. You can still read the original web version.',
      html: `<p>Unable to extract clean article text from this page. You can return to the regular web view or open Ocal Copilot for an instant summary.</p>`,
      wordCount: 20,
      readingTime: 1
    });
  }

  /**
   * Render Clean Reader View
   */
  renderArticle(data) {
    const wordCount = data.wordCount || 100;
    const readingTime = data.readingTime || Math.max(1, Math.ceil(wordCount / 220));

    // Process HTML content
    let contentHtml = data.html;
    if (!contentHtml || contentHtml.trim().length < 50) {
      // Split plain text into clean paragraphs
      contentHtml = (data.text || '')
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => `<p>${this.escapeHtml(p)}</p>`)
        .join('');
    }

    this.container.className = `zen-reader-overlay theme-${this.theme} font-${this.fontFamily} visible`;
    this.container.innerHTML = `
      <!-- Top Scroll Progress Line -->
      <div class="zen-progress-bar-wrap">
        <div class="zen-progress-bar-fill" id="zen-scroll-progress"></div>
      </div>

      <!-- Pinned Top Header -->
      <header class="zen-top-bar">
        <button class="zen-btn zen-back-btn" id="zen-back-btn" title="Back to Web">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Web</span>
        </button>

        <div class="zen-site-capsule" title="${this.escapeHtml(data.url)}">
          ${this.escapeHtml(data.siteName || 'Article')}
        </div>

        <div class="zen-top-actions">
          <button class="zen-action-pill" id="zen-speech-toggle" title="Read Aloud (TTS)">
            <svg class="tts-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
            <span class="tts-label">Listen</span>
          </button>

          <button class="zen-action-pill aa-pill" id="zen-aa-btn" title="Appearance & Font">
            <span>Aa</span>
          </button>

          <button class="zen-action-icon" id="zen-share-btn" title="Share Article">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
              <polyline points="16 6 12 2 8 6"></polyline>
              <line x1="12" y1="2" x2="12" y2="15"></line>
            </svg>
          </button>
        </div>
      </header>

      <!-- Appearance Floating Popover -->
      <div class="zen-appearance-popover" id="zen-appearance-popover" style="display: none;">
        <div class="popover-section-label">Reading Theme</div>
        <div class="zen-theme-selector">
          <button class="theme-chip theme-oled ${this.theme === 'oled' ? 'active' : ''}" data-theme="oled" title="OLED Pitch Black">
            <span class="chip-dot"></span>
            <span>OLED</span>
          </button>
          <button class="theme-chip theme-paper ${this.theme === 'paper' ? 'active' : ''}" data-theme="paper" title="Crisp Paper">
            <span class="chip-dot"></span>
            <span>Paper</span>
          </button>
          <button class="theme-chip theme-sepia ${this.theme === 'sepia' ? 'active' : ''}" data-theme="sepia" title="Warm Sepia">
            <span class="chip-dot"></span>
            <span>Sepia</span>
          </button>
          <button class="theme-chip theme-slate ${this.theme === 'slate' ? 'active' : ''}" data-theme="slate" title="Warm Sunset">
            <span class="chip-dot"></span>
            <span>Slate</span>
          </button>
        </div>

        <div class="popover-section-label">Font Family</div>
        <div class="zen-font-selector">
          <button class="font-chip ${this.fontFamily === 'sans' ? 'active' : ''}" data-family="sans">Sans</button>
          <button class="font-chip serif-style ${this.fontFamily === 'serif' ? 'active' : ''}" data-family="serif">Serif</button>
          <button class="font-chip mono-style ${this.fontFamily === 'mono' ? 'active' : ''}" data-family="mono">Mono</button>
        </div>

        <div class="popover-section-label">Font Size</div>
        <div class="zen-size-controls">
          <button class="size-btn" id="zen-font-decrease" title="Smaller text">A-</button>
          <div class="size-display" id="zen-font-display">${this.fontSize}px</div>
          <button class="size-btn" id="zen-font-increase" title="Larger text">A+</button>
        </div>
      </div>

      <!-- Main Reader Body (Scrollable Article) -->
      <main class="zen-scroll-body" id="zen-scroll-body">
        <article class="zen-article-container" style="font-size: ${this.fontSize}px;">
          <!-- Article Header -->
          <header class="zen-article-header">
            <h1 class="zen-article-title">${this.escapeHtml(data.title)}</h1>
            <div class="zen-article-meta">
              ${data.author ? `<span class="zen-meta-item zen-author"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${this.escapeHtml(data.author)}</span> • ` : ''}
              <span class="zen-meta-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${readingTime} min read</span> • 
              <span class="zen-meta-item">${wordCount.toLocaleString()} words</span>
            </div>
          </header>

          <hr class="zen-article-divider" />

          <!-- Article Core Content -->
          <div class="zen-article-content" id="zen-article-content">
            ${contentHtml}
          </div>

          <!-- Bottom Footer -->
          <footer class="zen-article-footer">
            <div class="zen-footer-card">
              <div class="zen-footer-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                </svg>
              </div>
              <div class="zen-footer-info">
                <div class="zen-footer-title">End of Article</div>
                <div class="zen-footer-sub">Read distraction-free in Ocal Browser</div>
              </div>
              <button class="zen-footer-back-btn" id="zen-footer-back-btn">Exit Reader</button>
            </div>
          </footer>
        </article>
      </main>

      <!-- Floating TTS Audio Player Pill -->
      <div class="zen-audio-bar" id="zen-audio-bar" style="display: none;">
        <div class="audio-wave" id="audio-wave-anim">
          <span></span><span></span><span></span><span></span>
        </div>

        <button class="audio-ctrl-btn" id="audio-prev-btn" title="Previous paragraph">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
        </button>

        <button class="audio-play-btn" id="audio-play-btn" title="Play / Pause">
          <svg class="play-svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          <svg class="pause-svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
        </button>

        <button class="audio-ctrl-btn" id="audio-next-btn" title="Next paragraph">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
        </button>

        <button class="audio-rate-btn" id="audio-rate-btn" title="Playback Speed">
          ${this.speechRate}x
        </button>

        <button class="audio-close-btn" id="audio-close-btn" title="Stop listening">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `;

    this.bindEvents();
    this.prepareParagraphs();
  }

  bindEvents() {
    // 1. Back buttons
    this.container.querySelector('#zen-back-btn')?.addEventListener('click', () => this.close());
    this.container.querySelector('#zen-footer-back-btn')?.addEventListener('click', () => this.close());

    // 2. Scroll Progress Bar
    const scrollBody = this.container.querySelector('#zen-scroll-body');
    const progressBar = this.container.querySelector('#zen-scroll-progress');
    if (scrollBody && progressBar) {
      scrollBody.addEventListener('scroll', () => {
        const total = scrollBody.scrollHeight - scrollBody.clientHeight;
        const progress = total > 0 ? (scrollBody.scrollTop / total) * 100 : 0;
        progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
      }, { passive: true });
    }

    // 3. Appearance Popover Toggle
    const aaBtn = this.container.querySelector('#zen-aa-btn');
    const popover = this.container.querySelector('#zen-appearance-popover');
    aaBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.triggerHaptic(8);
      const isVisible = popover.style.display !== 'none';
      popover.style.display = isVisible ? 'none' : 'block';
    });

    // Close popover when clicking outside
    this.container.addEventListener('click', (e) => {
      if (popover && !popover.contains(e.target) && e.target !== aaBtn) {
        popover.style.display = 'none';
      }
    });

    // 4. Themes
    this.container.querySelectorAll('.theme-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.triggerHaptic(8);
        const t = chip.getAttribute('data-theme');
        this.setTheme(t);
        this.container.querySelectorAll('.theme-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });

    // 5. Font Families
    this.container.querySelectorAll('.font-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.triggerHaptic(8);
        const f = chip.getAttribute('data-family');
        this.setFontFamily(f);
        this.container.querySelectorAll('.font-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });

    // 6. Font Size Controls
    const fontDisplay = this.container.querySelector('#zen-font-display');
    const article = this.container.querySelector('.zen-article-container');
    this.container.querySelector('#zen-font-decrease')?.addEventListener('click', () => {
      this.triggerHaptic(8);
      if (this.fontSize > 14) {
        this.fontSize -= 2;
        localStorage.setItem('ocal_zen_fontsize', this.fontSize.toString());
        if (fontDisplay) fontDisplay.textContent = `${this.fontSize}px`;
        if (article) article.style.fontSize = `${this.fontSize}px`;
      }
    });
    this.container.querySelector('#zen-font-increase')?.addEventListener('click', () => {
      this.triggerHaptic(8);
      if (this.fontSize < 28) {
        this.fontSize += 2;
        localStorage.setItem('ocal_zen_fontsize', this.fontSize.toString());
        if (fontDisplay) fontDisplay.textContent = `${this.fontSize}px`;
        if (article) article.style.fontSize = `${this.fontSize}px`;
      }
    });

    // 7. Share Button
    this.container.querySelector('#zen-share-btn')?.addEventListener('click', () => {
      this.triggerHaptic(10);
      const title = this.currentArticle?.title || 'Article';
      const url = this.currentArticle?.url || '';
      if (window.OcalNative && typeof window.OcalNative.share === 'function') {
        window.OcalNative.share(title, 'Check out this article in Ocal Browser', url);
      } else if (navigator.share) {
        navigator.share({ title, url }).catch(() => {});
      } else {
        navigator.clipboard?.writeText(url);
        alert('Link copied to clipboard!');
      }
    });

    // 8. TTS Audio Controls
    this.container.querySelector('#zen-speech-toggle')?.addEventListener('click', () => {
      this.triggerHaptic(10);
      this.toggleAudioPlayer();
    });

    const playBtn = this.container.querySelector('#audio-play-btn');
    playBtn?.addEventListener('click', () => {
      this.triggerHaptic(10);
      this.togglePlayPauseAudio();
    });

    this.container.querySelector('#audio-prev-btn')?.addEventListener('click', () => {
      this.triggerHaptic(8);
      this.skipParagraph(-1);
    });

    this.container.querySelector('#audio-next-btn')?.addEventListener('click', () => {
      this.triggerHaptic(8);
      this.skipParagraph(1);
    });

    this.container.querySelector('#audio-rate-btn')?.addEventListener('click', () => {
      this.triggerHaptic(8);
      this.cycleSpeedRate();
    });

    this.container.querySelector('#audio-close-btn')?.addEventListener('click', () => {
      this.triggerHaptic(8);
      this.stopAudio();
      const audioBar = this.container.querySelector('#zen-audio-bar');
      if (audioBar) audioBar.style.display = 'none';
      const speechToggle = this.container.querySelector('#zen-speech-toggle');
      if (speechToggle) speechToggle.classList.remove('active');
    });
  }

  setTheme(t) {
    this.theme = t;
    localStorage.setItem('ocal_zen_theme', t);
    this.container.className = `zen-reader-overlay theme-${this.theme} font-${this.fontFamily} visible`;
    this.updateStatusBar();
  }

  updateStatusBar() {
    let colorHex = '#000000';
    let isDark = true;

    if (this.theme === 'paper') {
      colorHex = '#ffffff';
      isDark = false;
    } else if (this.theme === 'sepia') {
      colorHex = '#fbf0d9';
      isDark = false;
    } else if (this.theme === 'slate') {
      colorHex = '#000000';
      isDark = true;
    } else {
      // OLED pitch black default
      colorHex = '#000000';
      isDark = true;
    }

    // 1. Meta theme-color for WebView/Chrome
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute('content', colorHex);

    // 2. Android Native Status Bar
    if (window.OcalNative && typeof window.OcalNative.setStatusBarTheme === 'function') {
      try {
        window.OcalNative.setStatusBarTheme(isDark, colorHex);
      } catch (e) {
        console.warn('[ZenReader] setStatusBarTheme error:', e);
      }
    }
  }

  setFontFamily(f) {
    this.fontFamily = f;
    localStorage.setItem('ocal_zen_fontfamily', f);
    this.container.className = `zen-reader-overlay theme-${this.theme} font-${this.fontFamily} visible`;
  }

  /**
   * Cleans text to make speech narration sound fluent, natural and conversational
   */
  cleanTextForSpeech(text) {
    if (!text) return '';
    return text
      // 1. Remove bracketed citations and editor markers: [1], [2], [citation needed], [edit], [note 1]
      .replace(/\[(?:\d+|citation needed|edit|note\s*\d+|clarification needed|page needed|[a-z])\]/gi, '')
      // 2. Remove pronunciation guides, IPA notations, and audio prompt tags
      .replace(/\(\s*(?:listen|audio|pronunciation:[^)]+|\/[^/)]+\/)\s*\)/gi, '')
      .replace(/\/[bcdfghjklmnpqrstvwxyzæɑɒɔəɛɜɪiʊuʌθðʃʒtʃdʒŋˈˌː.]+\//gi, '')
      // 3. Remove URLs
      .replace(/https?:\/\/\S+/gi, '')
      // 4. Expand abbreviations into natural spoken English
      .replace(/\be\.g\.,?\s*/gi, 'for example, ')
      .replace(/\bi\.e\.,?\s*/gi, 'that is, ')
      .replace(/\betc\.\s*/gi, 'etcetera. ')
      .replace(/\bvs\.\s*/gi, 'versus ')
      .replace(/\bca\.\s*/gi, 'circa ')
      .replace(/\bapprox\.\s*/gi, 'approximately ')
      .replace(/\bdept\.\s*/gi, 'department ')
      .replace(/\bno\.\s*(?=\d)/gi, 'number ')
      .replace(/\bvol\.\s*(?=\d)/gi, 'volume ')
      .replace(/\bp\.\s*(?=\d)/gi, 'page ')
      .replace(/\bpp\.\s*(?=\d)/gi, 'pages ')
      // 5. Remove parenthetical editorial notes
      .replace(/\((?:see below|pictured|source:[^)]+)\)/gi, '')
      // 6. Remove dangling bullets and noisy symbols
      .replace(/[•*~|^§#]/g, '')
      // 7. Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Smart filter to detect boilerplate, Wikipedia redirect notes, duplicate titles, and navigational noise
   */
  isBoilerplateOrRedirect(text, el, normTitle) {
    if (!text || text.length < 4) return true;

    // Check duplicate title (skip reading duplicate title heading)
    const normText = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normTitle && (normText === normTitle || (normTitle.length > 8 && normText.startsWith(normTitle) && normText.length < normTitle.length + 8))) {
      return true;
    }

    // Common Wikipedia / article redirects & boilerplate patterns
    const SKIP_PATTERNS = [
      /^this article is about/i,
      /^for other uses,? see/i,
      /^for other people named/i,
      /^for the .+ see/i,
      /^redirected from/i,
      /^not to be confused with/i,
      /^main article:?/i,
      /^see also:?/i,
      /^see:?/i,
      /^jump to (navigation|search)/i,
      /^from wikipedia, the free encyclopedia/i,
      /^(table of )?contents\s*(\[hide\])?$/i,
      /^(references|external links|further reading|bibliography|notes|citations|sources|see also)$/i,
      /^share (this|on)/i,
      /^(photo|image|illustration|credit):/i,
      /^cookie (policy|preferences|notice)/i,
      /^sign in to /i,
      /^advertisement$/i,
      /^listen to this article/i,
      /^all rights reserved/i,
      /^subscribe for /i,
      /^edit\b/i
    ];

    if (SKIP_PATTERNS.some(re => re.test(text))) {
      return true;
    }

    // Check parent containers
    if (el && el.closest) {
      if (el.closest('.hatnote, .dablink, .metadata, .infobox, .sidebar, .navbox, .toc, .reference, .reflist, .catlinks, [role="navigation"], .noprint')) {
        return true;
      }
    }

    // Check bullet points (li)
    if (el && el.tagName && el.tagName.toLowerCase() === 'li') {
      // Skip short redirect bullet points or single-link redirects
      if (text.length < 24) return true;
      if (/^(see|main article|redirect)/i.test(text)) return true;
      const anchors = el.querySelectorAll('a');
      if (anchors.length === 1 && text.length < 50 && anchors[0].innerText.trim() === text) {
        return true;
      }
    }

    return false;
  }

  /**
   * Smart TTS Text to Speech Player Logic
   */
  prepareParagraphs() {
    const contentEl = this.container.querySelector('#zen-article-content');
    if (!contentEl) return;
    this.paragraphs = [];

    const normTitle = (this.currentArticle?.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    // 1. Add Title once as intro if valid
    const titleEl = this.container.querySelector('.zen-article-title');
    if (titleEl && titleEl.innerText?.trim()) {
      const cleanTitle = this.cleanTextForSpeech(titleEl.innerText.trim());
      if (cleanTitle) {
        this.paragraphs.push({
          id: 'title',
          element: titleEl,
          text: cleanTitle
        });
      }
    }

    // 2. Query article content elements
    const elements = contentEl.querySelectorAll('p, h1, h2, h3, h4, blockquote, li');

    if (elements.length > 0) {
      elements.forEach((el, idx) => {
        const rawText = el.innerText?.trim();
        if (!rawText) return;

        // Smart filter: check if this is boilerplate, redirect, or duplicate title
        if (this.isBoilerplateOrRedirect(rawText, el, normTitle)) {
          return;
        }

        const clean = this.cleanTextForSpeech(rawText);
        // Only keep if meaningful content remains after cleaning
        if (clean && clean.length > 8) {
          el.setAttribute('data-zen-para-id', String(idx));
          this.paragraphs.push({
            id: idx,
            element: el,
            text: clean
          });
        }
      });
    }

    // 3. Fallback: If no elements passed filtering, chunk raw article text cleanly
    if (this.paragraphs.length <= 1) {
      const rawText = contentEl.innerText?.trim() || this.currentArticle?.text || '';
      const chunks = rawText.split(/\n\s*\n|\n+/).map(c => c.trim()).filter(c => c.length > 15);
      chunks.forEach((chunk, idx) => {
        if (!this.isBoilerplateOrRedirect(chunk, null, normTitle)) {
          const clean = this.cleanTextForSpeech(chunk);
          if (clean && clean.length > 10) {
            const p = document.createElement('p');
            p.innerText = clean;
            this.paragraphs.push({
              id: 'chunk_' + idx,
              element: p,
              text: clean
            });
          }
        }
      });
    }

    this.currentParagraphIndex = 0;
  }

  toggleAudioPlayer() {
    const audioBar = this.container.querySelector('#zen-audio-bar');
    const speechToggle = this.container.querySelector('#zen-speech-toggle');
    if (!audioBar) return;

    if (audioBar.style.display === 'none') {
      audioBar.style.display = 'flex';
      speechToggle?.classList.add('active');
      if (!this.isPlayingAudio) {
        this.playAudioParagraph(this.currentParagraphIndex);
      }
    } else {
      audioBar.style.display = 'none';
      speechToggle?.classList.remove('active');
      this.pauseAudio();
    }
  }

  togglePlayPauseAudio() {
    if (this.isPlayingAudio) {
      this.pauseAudio();
    } else {
      this.resumeOrPlayAudio();
    }
  }

  resumeOrPlayAudio() {
    if (window.OcalNative && typeof window.OcalNative.speak === 'function') {
      this.playAudioParagraph(this.currentParagraphIndex);
      return;
    }

    if (this.speechSynthesis && this.speechSynthesis.paused) {
      this.speechSynthesis.resume();
      this.setAudioPlayingUi(true);
      return;
    }

    this.playAudioParagraph(this.currentParagraphIndex);
  }

  playAudioParagraph(index) {
    if (!this.paragraphs.length) return;
    if (index < 0) index = 0;
    if (index >= this.paragraphs.length) {
      this.stopAudio();
      return;
    }

    this.currentParagraphIndex = index;
    const item = this.paragraphs[index];

    // Highlight active element and smooth scroll
    this.paragraphs.forEach(p => p.element?.classList?.remove('zen-speaking'));
    if (item.element && item.element.classList) {
      item.element.classList.add('zen-speaking');
      try {
        item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {}
    }

    this.setAudioPlayingUi(true);

    // 1. Android Native TTS Engine
    if (window.OcalNative && typeof window.OcalNative.speak === 'function') {
      window.onNativeTtsStart = (utteranceId) => {
        this.setAudioPlayingUi(true);
      };
      window.onNativeTtsDone = (utteranceId) => {
        item.element?.classList?.remove('zen-speaking');
        if (this.currentParagraphIndex + 1 < this.paragraphs.length) {
          this.playAudioParagraph(this.currentParagraphIndex + 1);
        } else {
          this.stopAudio();
        }
      };
      window.onNativeTtsError = (utteranceId) => {
        console.warn('[ZenReader Native TTS error]:', utteranceId);
        item.element?.classList?.remove('zen-speaking');
        // Fallback to Web Speech API
        this.speakWebSpeech(item);
      };

      window.OcalNative.speak(item.text, this.speechRate, String(index));
      return;
    }

    // 2. Web Speech API fallback
    this.speakWebSpeech(item);
  }

  speakWebSpeech(item) {
    if (!window.speechSynthesis) {
      alert('Text-to-speech is not supported on this device.');
      this.setAudioPlayingUi(false);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      this.utterance = new SpeechSynthesisUtterance(item.text);
      this.utterance.rate = this.speechRate;
      this.utterance.pitch = 1.0;

      // Select best natural voice if available
      try {
        const voices = window.speechSynthesis.getVoices?.() || [];
        if (voices.length > 0) {
          const userLang = (navigator.language || 'en').slice(0, 2);
          const naturalVoice = voices.find(v => v.lang.startsWith(userLang) && (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google') || v.name.includes('Online')))
            || voices.find(v => v.lang.startsWith(userLang))
            || voices[0];
          if (naturalVoice) this.utterance.voice = naturalVoice;
        }
      } catch (_) {}

      this.utterance.onend = () => {
        item.element?.classList?.remove('zen-speaking');
        if (this.currentParagraphIndex + 1 < this.paragraphs.length) {
          this.playAudioParagraph(this.currentParagraphIndex + 1);
        } else {
          this.stopAudio();
        }
      };

      this.utterance.onerror = (e) => {
        console.warn('[ZenReader WebSpeech TTS error]:', e);
        item.element?.classList?.remove('zen-speaking');
        this.setAudioPlayingUi(false);
      };

      window.speechSynthesis.speak(this.utterance);
      this.setAudioPlayingUi(true);
    } catch (err) {
      console.warn('[ZenReader] WebSpeech failed:', err);
      this.setAudioPlayingUi(false);
    }
  }

  pauseAudio() {
    if (window.OcalNative && typeof window.OcalNative.stopSpeaking === 'function') {
      window.OcalNative.stopSpeaking();
    }
    if (this.speechSynthesis && this.isPlayingAudio) {
      try { this.speechSynthesis.pause(); } catch {}
    }
    this.setAudioPlayingUi(false);
  }

  stopAudio() {
    if (window.OcalNative && typeof window.OcalNative.stopSpeaking === 'function') {
      window.OcalNative.stopSpeaking();
    }
    if (this.speechSynthesis) {
      try { this.speechSynthesis.cancel(); } catch {}
    }
    this.paragraphs.forEach(p => p.element?.classList?.remove('zen-speaking'));
    this.setAudioPlayingUi(false);
  }

  skipParagraph(dir) {
    const nextIdx = this.currentParagraphIndex + dir;
    if (nextIdx >= 0 && nextIdx < this.paragraphs.length) {
      this.playAudioParagraph(nextIdx);
    }
  }

  cycleSpeedRate() {
    const rates = [0.8, 1.0, 1.25, 1.5, 2.0];
    let nextIdx = rates.indexOf(this.speechRate) + 1;
    if (nextIdx >= rates.length || nextIdx < 0) nextIdx = 0;
    this.speechRate = rates[nextIdx];
    localStorage.setItem('ocal_zen_speech_rate', this.speechRate.toString());

    const rateBtn = this.container.querySelector('#audio-rate-btn');
    if (rateBtn) rateBtn.textContent = `${this.speechRate}x`;

    if (this.isPlayingAudio) {
      this.playAudioParagraph(this.currentParagraphIndex);
    }
  }

  setAudioPlayingUi(isPlaying) {
    this.isPlayingAudio = isPlaying;
    const playSvg = this.container.querySelector('.play-svg');
    const pauseSvg = this.container.querySelector('.pause-svg');
    const waveAnim = this.container.querySelector('#audio-wave-anim');

    if (playSvg && pauseSvg) {
      playSvg.style.display = isPlaying ? 'none' : 'block';
      pauseSvg.style.display = isPlaying ? 'block' : 'none';
    }
    if (waveAnim) {
      waveAnim.classList.toggle('playing', isPlaying);
    }
  }

  triggerHaptic(ms = 10) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch {}
  }

  escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Close Zen Reader
   */
  close() {
    this.triggerHaptic(10);
    this.stopAudio();
    this.isOpen = false;
    document.body.classList.remove('zen-reader-open');

    // Notify native layer that reader overlay is closed
    if (window.OcalNative && typeof window.OcalNative.setOverlayOpen === 'function') {
      window.OcalNative.setOverlayOpen(false);
    }

    if (this.container) {
      this.container.classList.remove('visible');
      setTimeout(() => {
        if (!this.isOpen) {
          this.container.style.display = 'none';
          this.container.innerHTML = '';
        }
      }, 250);
    }

    // Revert status bar to browser theme
    if (window.app && typeof window.app.updateStatusBarColor === 'function') {
      window.app.updateStatusBarColor();
      window.app.syncOverlayState?.();
    }
  }
}
