// Ocal Mobile Internal Pages Generator (ocal://)
import { DownloadsManager } from './DownloadsManager.js';
import { DataImporter, PasswordManager } from '../utils/DataImporter.js';
import { syncClient } from '../utils/SyncClient.js';
import { QrScanner } from '../utils/QrScanner.js';

export class InternalPages {
  static render(url, onNavigate) {
    const raw = (url || 'ocal://home').toLowerCase();
    const clean = raw.replace('ocal://', '').replace('https://', '').replace('http://', '').replace('www.', '');

    if (clean === 'home' || clean === '') {
      return this.renderHome(onNavigate);
    } else if (clean.startsWith('dineinstyle') || clean.includes('dineinstyle.com')) {
      return this.renderDineInStyle(onNavigate);
    } else if (clean.startsWith('twitter') || clean.includes('twitter.com') || clean.includes('x.com')) {
      return this.renderTwitter(onNavigate);
    } else if (clean === 'games') {
      return this.renderGames(onNavigate);
    } else if (clean === 'snake') {
      return this.renderSnake(onNavigate);
    } else if (clean === 'tetris') {
      return this.renderTetris(onNavigate);
    } else if (clean === 'pdf') {
      return this.renderPdfViewer(onNavigate);
    } else if (clean === 'volume') {
      return this.renderVolumeBooster(onNavigate);
    } else if (clean === 'bookmarks') {
      return this.renderBookmarks(onNavigate);
    } else if (clean === 'downloads') {
      return this.renderDownloads(onNavigate);
    } else if (clean === 'sync') {
      return this.renderSync(onNavigate);
    } else if (clean === 'passwords') {
      return this.renderPasswords(onNavigate);
    } else if (clean === 'history') {
      return this.renderHistory(onNavigate);
    } else if (clean === 'settings') {
      return this.renderSettings(onNavigate);
    }

    return `
      <div class="subpage-container">
        <div class="subpage-header">
          <button class="subpage-back-btn" id="error-back-btn"><i class="fas fa-chevron-left"></i></button>
          <div class="subpage-header-title">Page Not Found</div>
          <div style="width:36px;"></div>
        </div>
        <div class="subpage-content" style="padding-top:40px;">
          <div class="subpage-empty-state">
            <div class="subpage-empty-icon danger">
              <i class="fas fa-circle-exclamation"></i>
            </div>
            <div class="subpage-empty-title" style="font-size:18px;">URL Cannot Be Reached</div>
            <p class="subpage-empty-desc">${escapeHtml(url)}</p>
            <button class="pill-chip" id="error-home-btn" style="background:var(--accent-primary); color:#ffffff; border:none; margin:20px auto 0; padding:10px 24px; font-weight:600; cursor:pointer;">
              Return to Start Page
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // 1. Ocal Minimalist Start Page (Wordmark, Speed Dial & Editorial News)
  static renderHome(onNavigate) {
    const container = document.createElement('div');
    container.className = 'internal-page-container home-page-container';

    container.innerHTML = `
      <div class="opera-home-view">
        <!-- Minimal Brand Logo & Wordmark -->
        <div class="opera-hero-container">
          <div class="opera-logo-badge">
            <img src="/assets/Light.png" alt="Ocal Logo" class="opera-brand-logo-img light-logo" />
            <img src="/assets/Dark.png" alt="Ocal Logo" class="opera-brand-logo-img dark-logo" />
          </div>
          <h1 class="opera-wordmark">Ocal</h1>
        </div>

        <!-- Section: Favorites -->
        <div class="opera-section-label">Favorites</div>
        <div class="opera-speed-dial">
          <div class="opera-dial-item" data-url="https://dineinstyle.com">
            <div class="opera-dial-tile" style="color:var(--text-main);">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            </div>
            <span class="opera-dial-title">Dine in Style</span>
          </div>
          <div class="opera-dial-item" data-url="https://duckduckgo.com">
            <div class="opera-dial-tile" style="color:var(--text-main);">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="11" r="3"/></svg>
            </div>
            <span class="opera-dial-title">DuckDuckGo</span>
          </div>
          <div class="opera-dial-item" data-url="https://twitter.com">
            <div class="opera-dial-tile" style="color:var(--text-main);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </div>
            <span class="opera-dial-title">Twitter</span>
          </div>
          <div class="opera-dial-item" data-url="https://reddit.com">
            <div class="opera-dial-tile" style="color:var(--text-main);">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.56 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.56 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
            </div>
            <span class="opera-dial-title">Reddit</span>
          </div>
          <div class="opera-dial-item" data-url="https://discord.com">
            <div class="opera-dial-tile" style="color:var(--text-main);">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
            </div>
            <span class="opera-dial-title">Discord</span>
          </div>
          <div class="opera-dial-item" data-url="https://github.com">
            <div class="opera-dial-tile" style="color:var(--text-main);">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            </div>
            <span class="opera-dial-title">GitHub</span>
          </div>
          <div class="opera-dial-item" data-url="https://en.m.wikipedia.org">
            <div class="opera-dial-tile" style="color:var(--text-main);">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601 1.082 2.646 4.818 10.521 4.818 10.521l.136.046 2.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0 .105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136 1.422l1.582 3.252 1.758-3.504c.293-.64.233-.801.111-.947-.07-.084-.305-.22-.812-.24l-.201-.021c-.052 0-.098-.015-.145-.051-.045-.031-.067-.076-.067-.129v-.427l.061-.045c1.247-.008 4.043 0 4.043 0l.059.045v.436c0 .121-.059.178-.193.178-.646.03-.782.095-1.023.439-.12.186-.375.589-.646 1.039l-2.301 4.273-.065.135 2.792 5.712.17.048 4.396-10.438c.154-.422.129-.722-.064-.895-.197-.172-.346-.273-.857-.295l-.42-.016c-.061 0-.105-.014-.152-.045-.043-.029-.072-.075-.072-.119v-.436l.059-.045h4.961l.041.045v.437c0 .119-.074.18-.209.18-.648.03-1.127.18-1.443.421-.314.255-.557.616-.736 1.067 0 0-4.043 9.258-5.426 12.339-.525 1.007-1.053.917-1.503-.031-.571-1.171-1.773-3.786-2.646-5.71l.053-.036z"/></svg>
            </div>
            <span class="opera-dial-title">Wikipedia</span>
          </div>
          <div class="opera-dial-item" data-url="https://youtube.com">
            <div class="opera-dial-tile" style="color:var(--text-main);">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </div>
            <span class="opera-dial-title">YouTube</span>
          </div>
        </div>
      </div>
    `;

    // Bind clicks
    container.querySelectorAll('.opera-dial-item').forEach(item => {
      item.addEventListener('click', () => {
        const u = item.getAttribute('data-url');
        if (u && onNavigate) onNavigate(u);
      });
    });

    return container;
  }

  // Exact Recreation of "Dine in Style" (Matches Reference Mockup Screen 1)
  static renderDineInStyle(onNavigate) {
    const container = document.createElement('div');
    container.className = 'internal-page-container';
    container.innerHTML = `
      <div class="dine-site-container">
        <div class="dine-hero-bg" style="background-image: url('https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1080&q=80'), linear-gradient(180deg, #1e293b 0%, #0f172a 100%);">
          <div class="dine-hero-overlay"></div>
          <div></div>
          <div class="dine-hero-content">
            <div class="dine-title-line1">Autumn <span>'23</span></div>
            <div class="dine-title-line2">Collection</div>
            <div class="dine-pieces-pill">24 Unique Pieces</div>
            <button class="dine-shop-btn" id="dine-shop-btn">Shop Now</button>
          </div>
        </div>
      </div>
    `;
    container.querySelector('#dine-shop-btn')?.addEventListener('click', () => {
      alert('Autumn \'23 Collection added to bag!');
    });
    return container;
  }

  // Exact Recreation of Twitter Profile (Matches Reference Mockup Screen 3)
  static renderTwitter(onNavigate) {
    const container = document.createElement('div');
    container.className = 'internal-page-container';
    container.innerHTML = `
      <div class="twitter-page-container">
        <div class="twitter-banner"></div>
        <div class="twitter-profile-bar">
          <div class="twitter-avatar"><i class="fas fa-user"></i></div>
          <button class="twitter-edit-btn">Edit profile</button>
        </div>
        <div class="twitter-info">
          <div class="twitter-name">Ionut Zamfir <i class="fas fa-check-circle" style="color:#1d9bf0; font-size:14px;"></i></div>
          <div class="twitter-handle">@ionutz</div>
          <div class="twitter-bio">Product Designer who loves to create awesome interfaces.</div>
          <div class="twitter-stats">
            <span><b>583</b> Following</span>
            <span><b>2,659</b> Followers</span>
          </div>
        </div>
        <div style="border-top: 1px solid #eff3f4; padding: 14px 16px;">
          <div style="font-size:12px; color:#536471; margin-bottom:6px;"><i class="fas fa-thumbtack"></i> Pinned</div>
          <div style="font-size:14px; line-height:1.4;">Excited to share our brand new mobile browser experience! Fast, clean, and private. 🚀</div>
        </div>
      </div>
    `;
    return container;
  }

  // 2. Games Hub (Retro Arcade)
  static renderGames(onNavigate) {
    const container = document.createElement('div');
    container.className = 'subpage-container';
    container.innerHTML = `
      <div class="subpage-header">
        <button class="subpage-back-btn" id="games-back-btn"><i class="fas fa-chevron-left"></i></button>
        <div class="subpage-header-title">Games Hub</div>
        <div style="width:36px;"></div>
      </div>

      <div class="subpage-content">
        <div class="arcade-hero-card">
          <div class="arcade-hero-badge">
            <i class="fa-solid fa-gamepad"></i>
          </div>
          <div class="arcade-hero-info">
            <div class="arcade-hero-title">Retro Arcade</div>
            <div class="arcade-hero-desc">Built-in offline games designed for touch. No internet or downloads needed.</div>
          </div>
        </div>

        <div class="subpage-section-title">Built-in Offline Games</div>
        
        <div class="game-hub-card" id="play-snake-card">
          <div class="game-icon-tile">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div class="game-hub-details">
            <div class="game-hub-header-row">
              <div class="game-hub-title">Cyber Snake</div>
              <span class="game-tag">OFFLINE</span>
            </div>
            <div class="game-hub-desc">Classic retro arcade snake with on-screen glass D-pad.</div>
            <div class="game-features-row">
              <span>Instant Play</span>
              <span class="history-separator">•</span>
              <span>60 FPS</span>
              <span class="history-separator">•</span>
              <span>High Score</span>
            </div>
          </div>
          <button class="game-play-btn" id="btn-play-snake">
            <i class="fa-solid fa-play" style="font-size:10px;"></i> PLAY
          </button>
        </div>

        <div class="game-hub-card" id="play-tetris-card">
          <div class="game-icon-tile">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <div class="game-hub-details">
            <div class="game-hub-header-row">
              <div class="game-hub-title">Block Drop (Tetris)</div>
              <span class="game-tag">OFFLINE</span>
            </div>
            <div class="game-hub-desc">Falling tetromino block puzzle optimized for touchscreens.</div>
            <div class="game-features-row">
              <span>Touch Controls</span>
              <span class="history-separator">•</span>
              <span>Levels & Speed</span>
            </div>
          </div>
          <button class="game-play-btn" id="btn-play-tetris">
            <i class="fa-solid fa-play" style="font-size:10px;"></i> PLAY
          </button>
        </div>
      </div>
    `;

    container.querySelector('#games-back-btn')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('ocal://home');
    });
    container.querySelector('#play-snake-card')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('ocal://snake');
    });
    container.querySelector('#play-tetris-card')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('ocal://tetris');
    });

    return container;
  }

  // 3. Playable Snake Game with Touch D-Pad
  static renderSnake(onNavigate) {
    const container = document.createElement('div');
    container.className = 'subpage-container';
    container.innerHTML = `
      <div class="subpage-header">
        <button class="subpage-back-btn" id="snake-exit-btn"><i class="fas fa-chevron-left"></i></button>
        <div class="subpage-header-title">Cyber Snake</div>
        <div style="font-family:var(--font-mono); font-weight:700; color:var(--accent-primary); font-size:14px;" id="snake-score">000</div>
      </div>

      <div class="subpage-content" style="align-items:center;">
        <canvas id="snake-canvas" width="300" height="300" style="background:#0a0d14; border:1px solid var(--glass-border); border-radius:18px; box-shadow:var(--glass-shadow);"></canvas>

        <!-- Touch Controls -->
        <div style="display:grid; grid-template-columns:repeat(3, 62px); grid-template-rows:repeat(3, 54px); gap:8px; margin-top:16px;">
          <div></div>
          <button class="icon-btn" id="dpad-up" style="width:100%; height:100%; background:var(--sheet-card-bg); border:1px solid var(--sheet-card-border); border-radius:14px;"><i class="fas fa-chevron-up"></i></button>
          <div></div>
          <button class="icon-btn" id="dpad-left" style="width:100%; height:100%; background:var(--sheet-card-bg); border:1px solid var(--sheet-card-border); border-radius:14px;"><i class="fas fa-chevron-left"></i></button>
          <button class="icon-btn" id="snake-reset-btn" style="width:100%; height:100%; background:var(--accent-subtle); border:1px solid var(--accent-border); border-radius:14px; color:var(--accent-primary);"><i class="fas fa-rotate-right"></i></button>
          <button class="icon-btn" id="dpad-right" style="width:100%; height:100%; background:var(--sheet-card-bg); border:1px solid var(--sheet-card-border); border-radius:14px;"><i class="fas fa-chevron-right"></i></button>
          <div></div>
          <button class="icon-btn" id="dpad-down" style="width:100%; height:100%; background:var(--sheet-card-bg); border:1px solid var(--sheet-card-border); border-radius:14px;"><i class="fas fa-chevron-down"></i></button>
          <div></div>
        </div>
      </div>
    `;

    container.querySelector('#snake-exit-btn')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('ocal://games');
    });

    setTimeout(() => {
      const canvas = container.querySelector('#snake-canvas');
      const scoreEl = container.querySelector('#snake-score');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const grid = 15;
      let count = 0;
      let snake = { x: 150, y: 150, dx: grid, dy: 0, cells: [], maxCells: 4 };
      let apple = { x: 60, y: 60 };
      let score = 0;
      let animId = null;

      function resetGame() {
        snake.x = 150; snake.y = 150;
        snake.cells = []; snake.maxCells = 4;
        snake.dx = grid; snake.dy = 0;
        score = 0;
        if (scoreEl) scoreEl.innerText = '000';
      }

      function loop() {
        animId = requestAnimationFrame(loop);
        if (++count < 6) return;
        count = 0;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        snake.x += snake.dx;
        snake.y += snake.dy;

        if (snake.x < 0) snake.x = canvas.width - grid;
        else if (snake.x >= canvas.width) snake.x = 0;
        if (snake.y < 0) snake.y = canvas.height - grid;
        else if (snake.y >= canvas.height) snake.y = 0;

        snake.cells.unshift({ x: snake.x, y: snake.y });
        if (snake.cells.length > snake.maxCells) snake.cells.pop();

        ctx.fillStyle = '#ef4444';
        ctx.fillRect(apple.x, apple.y, grid - 1, grid - 1);

        ctx.fillStyle = '#10b981';
        snake.cells.forEach((cell, index) => {
          ctx.fillRect(cell.x, cell.y, grid - 1, grid - 1);
          if (cell.x === apple.x && cell.y === apple.y) {
            snake.maxCells++;
            score += 10;
            if (scoreEl) scoreEl.innerText = String(score).padStart(3, '0');
            apple.x = Math.floor(Math.random() * 20) * grid;
            apple.y = Math.floor(Math.random() * 20) * grid;
          }
          for (let i = index + 1; i < snake.cells.length; i++) {
            if (cell.x === snake.cells[i].x && cell.y === snake.cells[i].y) {
              resetGame();
            }
          }
        });
      }

      animId = requestAnimationFrame(loop);

      container.querySelector('#dpad-up')?.addEventListener('click', () => { if (snake.dy === 0) { snake.dy = -grid; snake.dx = 0; } });
      container.querySelector('#dpad-down')?.addEventListener('click', () => { if (snake.dy === 0) { snake.dy = grid; snake.dx = 0; } });
      container.querySelector('#dpad-left')?.addEventListener('click', () => { if (snake.dx === 0) { snake.dx = -grid; snake.dy = 0; } });
      container.querySelector('#dpad-right')?.addEventListener('click', () => { if (snake.dx === 0) { snake.dx = grid; snake.dy = 0; } });
      container.querySelector('#snake-reset-btn')?.addEventListener('click', resetGame);
    }, 50);

    return container;
  }

  // 4. Playable Tetris Game
  static renderTetris(onNavigate) {
    const container = document.createElement('div');
    container.className = 'subpage-container';
    container.innerHTML = `
      <div class="subpage-header">
        <button class="subpage-back-btn" id="tetris-exit-btn"><i class="fas fa-chevron-left"></i></button>
        <div class="subpage-header-title">Block Drop</div>
        <div style="font-family:var(--font-mono); font-weight:700; color:var(--accent-primary); font-size:14px;" id="tetris-score">000</div>
      </div>

      <div class="subpage-content" style="align-items:center;">
        <canvas id="tetris-canvas" width="240" height="360" style="background:#0a0d14; border:1px solid var(--glass-border); border-radius:18px; box-shadow:var(--glass-shadow);"></canvas>

        <div style="display:flex; gap:12px; margin-top:16px;">
          <button class="icon-btn" id="t-left" style="width:54px; height:54px; background:var(--sheet-card-bg); border:1px solid var(--sheet-card-border); border-radius:14px;"><i class="fas fa-arrow-left"></i></button>
          <button class="icon-btn" id="t-rotate" style="width:54px; height:54px; background:var(--accent-subtle); border:1px solid var(--accent-border); border-radius:14px; color:var(--accent-primary);"><i class="fas fa-rotate"></i></button>
          <button class="icon-btn" id="t-down" style="width:54px; height:54px; background:var(--sheet-card-bg); border:1px solid var(--sheet-card-border); border-radius:14px;"><i class="fas fa-arrow-down"></i></button>
          <button class="icon-btn" id="t-right" style="width:54px; height:54px; background:var(--sheet-card-bg); border:1px solid var(--sheet-card-border); border-radius:14px;"><i class="fas fa-arrow-right"></i></button>
        </div>
      </div>
    `;

    container.querySelector('#tetris-exit-btn')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('ocal://games');
    });

    return container;
  }

  // 5. Volume Booster
  static renderVolumeBooster(onNavigate) {
    const container = document.createElement('div');
    container.className = 'subpage-container';
    container.innerHTML = `
      <div class="subpage-header">
        <button class="subpage-back-btn" id="volume-back-btn"><i class="fas fa-chevron-left"></i></button>
        <div class="subpage-header-title">Volume Booster</div>
        <button class="subpage-action-btn" id="volume-reset-btn">Reset</button>
      </div>

      <div class="subpage-content">
        <div class="volume-dial-card">
          <div class="quick-tool-icon" style="width:48px; height:48px; font-size:22px; margin:0 auto; color:#0ea5e9; background:rgba(14, 165, 233, 0.15);">
            <i class="fas fa-volume-high"></i>
          </div>
          <div class="volume-big-val" id="boost-display">100%</div>
          <p style="color:var(--text-muted); font-size:13px; margin-bottom:12px;">Audio amplification beyond standard limits.</p>

          <input type="range" class="volume-slider" id="boost-slider" min="100" max="600" value="100" step="25">
          
          <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-subtle); margin-top:6px; font-family:var(--font-mono);">
            <span>100%</span>
            <span>300%</span>
            <span>600%</span>
          </div>

          <div class="volume-preset-grid">
            <button class="volume-preset-btn active" data-val="100">100%</button>
            <button class="volume-preset-btn" data-val="200">200%</button>
            <button class="volume-preset-btn" data-val="400">400%</button>
            <button class="volume-preset-btn" data-val="600">600%</button>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#volume-back-btn')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('ocal://home');
    });

    const slider = container.querySelector('#boost-slider');
    const disp = container.querySelector('#boost-display');
    const presetBtns = container.querySelectorAll('.volume-preset-btn');

    const updateVal = (val) => {
      if (slider) slider.value = val;
      if (disp) disp.innerText = `${val}%`;
      presetBtns.forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-val') === String(val));
      });
    };

    slider?.addEventListener('input', (e) => updateVal(e.target.value));

    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => updateVal(btn.getAttribute('data-val')));
    });

    container.querySelector('#volume-reset-btn')?.addEventListener('click', () => updateVal(100));

    return container;
  }

  // 6. PDF Document Reader
  static renderPdfViewer(onNavigate) {
    const container = document.createElement('div');
    container.className = 'subpage-container';
    container.innerHTML = `
      <div class="subpage-header">
        <button class="subpage-back-btn" id="pdf-back-btn"><i class="fas fa-chevron-left"></i></button>
        <div class="subpage-header-title">PDF Document Reader</div>
        <div style="width:36px;"></div>
      </div>

      <div class="subpage-content">
        <input type="file" id="pdf-file-input" accept="application/pdf" style="display:none;">
        
        <div class="pdf-dropzone" id="pdf-trigger-dropzone">
          <div class="quick-tool-icon" style="width:52px; height:52px; font-size:24px; margin:0 auto 12px; color:#ef4444; background:rgba(239, 68, 68, 0.15);">
            <i class="fas fa-file-pdf"></i>
          </div>
          <div style="font-size:15px; font-weight:700; color:var(--text-main);">Choose a PDF Document</div>
          <p style="color:var(--text-muted); font-size:12.5px; margin-top:4px;">Open and read local PDF files offline with continuous scroll.</p>
        </div>

        <div id="pdf-render-area" style="display:none; background:var(--sheet-card-bg); border:1px solid var(--sheet-card-border); border-radius:18px; overflow:hidden;">
        </div>
      </div>
    `;

    container.querySelector('#pdf-back-btn')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('ocal://home');
    });

    const fileInput = container.querySelector('#pdf-file-input');
    const dropzone = container.querySelector('#pdf-trigger-dropzone');
    const renderArea = container.querySelector('#pdf-render-area');

    dropzone?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file || !renderArea) return;
      const url = URL.createObjectURL(file);
      renderArea.style.display = 'block';
      renderArea.innerHTML = `<iframe src="${url}" style="width:100%; height:550px; border:none; background:#ffffff;"></iframe>`;
    });

    return container;
  }

  // 7. Bookmarks Manager
  static renderBookmarks(onNavigate) {
    const container = document.createElement('div');
    container.className = 'subpage-container';
    const bookmarks = JSON.parse(localStorage.getItem('ocal-bookmarks') || '[]');

    let contentHtml = '';
    if (bookmarks.length === 0) {
      contentHtml = `
        <div class="subpage-empty-state">
          <div class="subpage-empty-icon bookmarks">
            <i class="fas fa-bookmark"></i>
          </div>
          <div class="subpage-empty-title">No Bookmarks Saved</div>
          <p class="subpage-empty-desc">Tap the heart icon in the address bar to bookmark any page, or import your bookmarks from another browser.</p>
          <button class="pill-chip" id="empty-import-bm-btn" style="background:var(--accent-primary); color:#ffffff; border:none; margin:16px auto 0; padding:10px 22px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-file-import"></i>
            <span>Import Bookmarks File</span>
          </button>
        </div>
      `;
    } else {
      contentHtml = `
        <div class="history-search-container">
          <div class="history-search-bar">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" class="history-search-input" id="bm-filter-input" placeholder="Search bookmarks..." autocomplete="off" />
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:0 2px;">
          <div class="subpage-section-title" style="margin-bottom:0;">Saved Links (${bookmarks.length})</div>
          <div style="display:flex; gap:6px;">
            <button class="pill-chip" id="export-bm-btn" style="background:var(--bg-hover); color:var(--text-main); border:1px solid var(--border-medium); padding:5px 12px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
              <i class="fa-solid fa-file-export" style="font-size:11px;"></i> Export
            </button>
          </div>
        </div>

        <div class="apple-grouped-table" id="bookmarks-list">
          ${bookmarks.map((bm, index) => {
            let domain = '';
            try { domain = new URL(bm.url).hostname.replace(/^(www\.|html\.)/i, ''); } catch { domain = bm.url; }
            const initial = (domain || 'B')[0].toUpperCase();
            return `
              <div class="history-item-row bookmark-item-row" data-url="${escapeHtml(bm.url)}" data-title="${escapeHtml((bm.title || bm.url).toLowerCase())}">
                <div class="apple-row-icon mono-domain">
                  <span style="font-size:13px; font-weight:700;">${escapeHtml(initial)}</span>
                </div>
                <div class="history-content">
                  <div class="history-title">${escapeHtml(bm.title || bm.url)}</div>
                  <div class="history-meta">
                    <span class="history-domain-pill">${escapeHtml(domain)}</span>
                    <span class="history-separator">•</span>
                    <span>${escapeHtml(bm.url.replace(/^https?:\/\/(www\.)?/, '').substring(0, 42))}</span>
                  </div>
                </div>
                <button class="history-delete-btn delete-bm-btn" data-index="${index}" title="Remove Bookmark">
                  <i class="fa-solid fa-xmark" style="font-size:13px;"></i>
                </button>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    container.innerHTML = `
      <input type="file" id="bm-file-input" accept=".html,.htm,.json" style="display:none;" />

      <div class="subpage-header">
        <button class="subpage-back-btn" id="bm-back-btn"><i class="fas fa-chevron-left"></i></button>
        <div class="subpage-header-title">Bookmarks</div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="subpage-action-btn" id="import-bm-header-btn" title="Import Bookmarks from Chrome/Firefox/Safari/Edge">
            <i class="fa-solid fa-file-import" style="margin-right:4px;"></i>Import
          </button>
          ${bookmarks.length > 0 ? '<button class="subpage-action-btn danger" id="clear-bookmarks-btn">Clear</button>' : ''}
        </div>
      </div>

      <div class="subpage-content">
        ${contentHtml}
      </div>
    `;

    container.querySelector('#bm-back-btn')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('ocal://home');
    });

    // File input handling for bookmark import
    const bmFileInput = container.querySelector('#bm-file-input');
    const triggerBmImport = () => bmFileInput?.click();

    container.querySelector('#import-bm-header-btn')?.addEventListener('click', triggerBmImport);
    container.querySelector('#empty-import-bm-btn')?.addEventListener('click', triggerBmImport);

    bmFileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const content = evt.target.result;
          let result;
          if (file.name.toLowerCase().endsWith('.json')) {
            result = DataImporter.parseBookmarksJson(content);
          } else {
            result = DataImporter.parseBookmarksHtml(content);
          }
          if (window.ocalApp && typeof window.ocalApp.showToast === 'function') {
            window.ocalApp.showToast(`Imported ${result.added} new bookmarks!`, 'check');
          } else {
            alert(`Successfully imported ${result.added} bookmarks!`);
          }
          window.ocalApp?.checkCurrentTabBookmarked?.();
          if (onNavigate) onNavigate('ocal://bookmarks');
        } catch (err) {
          console.error('[Bookmarks Import Error]', err);
          alert('Failed to import bookmarks: ' + (err.message || 'Invalid format'));
        }
      };
      reader.readAsText(file);
    });

    container.querySelector('#export-bm-btn')?.addEventListener('click', () => {
      const count = DataImporter.exportBookmarksHtml();
      window.ocalApp?.showToast?.(`Exported ${count} bookmarks to file`, 'download');
    });

    container.querySelector('#clear-bookmarks-btn')?.addEventListener('click', () => {
      if (confirm('Clear all saved bookmarks?')) {
        localStorage.setItem('ocal-bookmarks', '[]');
        window.ocalApp?.checkCurrentTabBookmarked?.();
        if (onNavigate) onNavigate('ocal://bookmarks');
      }
    });

    // Bookmarks filter
    const bmFilter = container.querySelector('#bm-filter-input');
    if (bmFilter) {
      bmFilter.addEventListener('input', (e) => {
        const val = e.target.value.trim().toLowerCase();
        container.querySelectorAll('.bookmark-item-row').forEach(row => {
          const title = row.getAttribute('data-title') || '';
          const url = (row.getAttribute('data-url') || '').toLowerCase();
          if (!val || title.includes(val) || url.includes(val)) {
            row.style.display = 'flex';
          } else {
            row.style.display = 'none';
          }
        });
      });
    }

    container.querySelectorAll('.bookmark-item-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.delete-bm-btn')) return;
        const u = row.getAttribute('data-url');
        if (u && onNavigate) onNavigate(u);
      });
    });

    container.querySelectorAll('.delete-bm-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        bookmarks.splice(idx, 1);
        localStorage.setItem('ocal-bookmarks', JSON.stringify(bookmarks));
        window.ocalApp?.checkCurrentTabBookmarked?.();
        if (onNavigate) onNavigate('ocal://bookmarks');
      });
    });

    return container;
  }

  // 7.4 Passwords & Logins Vault Manager
  static renderPasswords(onNavigate) {
    const container = document.createElement('div');
    container.className = 'subpage-container';
    const passwords = PasswordManager.getPasswords();

    let contentHtml = '';
    if (passwords.length === 0) {
      contentHtml = `
        <div class="subpage-empty-state">
          <div class="subpage-empty-icon" style="background:var(--bg-hover); color:var(--accent-primary);">
            <i class="fa-solid fa-key" style="font-size:24px;"></i>
          </div>
          <div class="subpage-empty-title">No Saved Logins</div>
          <p class="subpage-empty-desc">Import your passwords directly from Chrome, Firefox, Safari, Edge, or password manager CSV files.</p>
          <div style="display:flex; flex-direction:column; gap:10px; width:100%; max-width:280px; margin:20px auto 0;">
            <button class="pill-chip" id="empty-import-pwd-btn" style="background:var(--accent-primary); color:#ffffff; border:none; padding:12px 20px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:8px;">
              <i class="fa-solid fa-file-import"></i>
              <span>Import Passwords CSV</span>
            </button>
            <button class="pill-chip" id="empty-add-pwd-btn" style="background:var(--bg-hover); color:var(--text-main); border:1px solid var(--border-medium); padding:10px 20px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:8px;">
              <i class="fa-solid fa-plus"></i>
              <span>Add Password Manually</span>
            </button>
          </div>
        </div>
      `;
    } else {
      contentHtml = `
        <div class="history-search-container">
          <div class="history-search-bar">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" class="history-search-input" id="pwd-filter-input" placeholder="Search logins & websites..." autocomplete="off" />
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:0 2px;">
          <div class="subpage-section-title" style="margin-bottom:0;">Saved Logins (${passwords.length})</div>
          <div style="display:flex; gap:6px;">
            <button class="pill-chip" id="import-pwd-quick-btn" style="background:var(--bg-hover); color:var(--text-main); border:1px solid var(--border-medium); padding:5px 10px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
              <i class="fa-solid fa-file-import" style="font-size:11px;"></i> Import
            </button>
            <button class="pill-chip" id="export-pwd-btn" style="background:var(--bg-hover); color:var(--text-main); border:1px solid var(--border-medium); padding:5px 10px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
              <i class="fa-solid fa-file-export" style="font-size:11px;"></i> Export
            </button>
          </div>
        </div>

        <div class="apple-grouped-table" id="passwords-list">
          ${passwords.map((item) => {
            const domain = item.domain || PasswordManager.extractDomain(item.url || item.name);
            const initial = (domain || 'K')[0].toUpperCase();
            const safeName = item.name || domain || 'Website Login';
            const safeUser = item.username || 'No Username';
            const safePwd = item.password || '';

            return `
              <div class="password-vault-row" data-id="${escapeHtml(item.id)}" data-search="${escapeHtml((safeName + ' ' + domain + ' ' + safeUser).toLowerCase())}">
                <div class="password-row-main">
                  <div class="apple-row-icon mono-domain" style="background:var(--bg-hover);">
                    <span style="font-size:13px; font-weight:700;">${escapeHtml(initial)}</span>
                  </div>
                  <div class="history-content" style="min-width:0;">
                    <div class="history-title" style="display:flex; align-items:center; gap:6px;">
                      <span>${escapeHtml(safeName)}</span>
                      ${item.url ? `<span class="history-domain-pill">${escapeHtml(domain)}</span>` : ''}
                    </div>
                    <div class="history-meta" style="margin-top:2px;">
                      <span class="password-user-label">${escapeHtml(safeUser)}</span>
                    </div>
                  </div>
                  <button class="history-delete-btn delete-pwd-btn" data-id="${escapeHtml(item.id)}" title="Delete Login">
                    <i class="fa-solid fa-xmark" style="font-size:13px;"></i>
                  </button>
                </div>

                <div class="password-field-container">
                  <div class="password-value-box">
                    <span class="password-text-display masked" id="pwd-val-${escapeHtml(item.id)}">••••••••</span>
                    <button class="pwd-action-icon-btn toggle-reveal-pwd" data-id="${escapeHtml(item.id)}" data-raw="${escapeHtml(safePwd)}" title="Show/Hide Password">
                      <i class="fa-solid fa-eye" style="font-size:13px;"></i>
                    </button>
                  </div>
                  <div class="password-actions-bar">
                    <button class="pwd-action-pill copy-user-btn" data-user="${escapeHtml(safeUser)}" title="Copy Username">
                      <i class="fa-solid fa-user" style="font-size:11px;"></i>
                      <span>Copy User</span>
                    </button>
                    <button class="pwd-action-pill copy-pwd-btn" data-pwd="${escapeHtml(safePwd)}" title="Copy Password">
                      <i class="fa-solid fa-key" style="font-size:11px;"></i>
                      <span>Copy Pass</span>
                    </button>
                    ${item.url ? `
                      <button class="pwd-action-pill open-url-btn" data-url="${escapeHtml(item.url)}" title="Go to website">
                        <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:10px;"></i>
                        <span>Visit</span>
                      </button>
                    ` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    container.innerHTML = `
      <input type="file" id="pwd-file-input" accept=".csv,.json,.txt" style="display:none;" />
      
      <div class="subpage-header">
        <button class="subpage-back-btn" id="pwd-back-btn"><i class="fas fa-chevron-left"></i></button>
        <div class="subpage-header-title">Passwords</div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="subpage-action-btn primary" id="add-pwd-modal-btn">
            <i class="fa-solid fa-plus" style="margin-right:3px;"></i>Add
          </button>
          ${passwords.length > 0 ? '<button class="subpage-action-btn danger" id="clear-passwords-btn">Clear</button>' : ''}
        </div>
      </div>

      <div class="subpage-content">
        ${contentHtml}
      </div>

      <!-- Add Password Modal Dialog -->
      <div class="modal-overlay" id="add-pwd-modal" style="display:none;">
        <div class="modal-dialog-card">
          <div class="modal-header">
            <div class="modal-title">Save New Password</div>
            <button class="modal-close-btn" id="close-pwd-modal"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            <label class="modal-label">Website or App URL</label>
            <input type="text" class="modal-input" id="modal-pwd-url" placeholder="e.g. google.com or https://..." />
            
            <label class="modal-label">Username or Email</label>
            <input type="text" class="modal-input" id="modal-pwd-user" placeholder="username@example.com" />
            
            <label class="modal-label">Password</label>
            <div style="position:relative; display:flex; align-items:center;">
              <input type="password" class="modal-input" id="modal-pwd-pass" placeholder="Enter password" style="padding-right:40px; margin-bottom:0;" />
              <button type="button" id="modal-pwd-eye" style="position:absolute; right:10px; background:none; border:none; color:var(--text-subtle); cursor:pointer;">
                <i class="fa-solid fa-eye"></i>
              </button>
            </div>
            
            <label class="modal-label" style="margin-top:14px;">Notes (Optional)</label>
            <input type="text" class="modal-input" id="modal-pwd-notes" placeholder="Optional notes" />
          </div>
          <div class="modal-footer">
            <button class="modal-btn secondary" id="cancel-pwd-modal">Cancel</button>
            <button class="modal-btn primary" id="save-pwd-modal">Save Login</button>
          </div>
        </div>
      </div>
    `;

    // Navigation back
    container.querySelector('#pwd-back-btn')?.addEventListener('click', () => {
      if (typeof closeModal === 'function') closeModal();
      const openM = document.getElementById('add-pwd-modal');
      if (openM) openM.remove();
      document.body.classList.remove('modal-open');
      document.body.classList.remove('keyboard-open');
      if (onNavigate) onNavigate('ocal://settings');
    });

    // File input handling for password CSV import
    const pwdFileInput = container.querySelector('#pwd-file-input');
    const triggerPwdImport = () => pwdFileInput?.click();

    container.querySelector('#empty-import-pwd-btn')?.addEventListener('click', triggerPwdImport);
    container.querySelector('#import-pwd-quick-btn')?.addEventListener('click', triggerPwdImport);

    pwdFileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const content = evt.target.result;
          let result;
          if (file.name.toLowerCase().endsWith('.json')) {
            result = DataImporter.parsePasswordsJson(content);
          } else {
            result = DataImporter.parsePasswordsCsv(content);
          }
          if (window.ocalApp && typeof window.ocalApp.showToast === 'function') {
            window.ocalApp.showToast(`Imported ${result.added} passwords!`, 'check');
          } else {
            alert(`Successfully imported ${result.added} logins!`);
          }
          if (onNavigate) onNavigate('ocal://passwords');
        } catch (err) {
          console.error('[Passwords Import Error]', err);
          alert('Failed to import passwords: ' + (err.message || 'Invalid format'));
        }
      };
      reader.readAsText(file);
    });

    // Export CSV
    container.querySelector('#export-pwd-btn')?.addEventListener('click', () => {
      const count = DataImporter.exportPasswordsCsv();
      window.ocalApp?.showToast?.(`Exported ${count} logins to CSV`, 'download');
    });

    // Clear all passwords
    container.querySelector('#clear-passwords-btn')?.addEventListener('click', () => {
      if (confirm('Clear all saved passwords from vault? This cannot be undone.')) {
        PasswordManager.clearAll();
        if (onNavigate) onNavigate('ocal://passwords');
      }
    });

    // Search filter
    const pwdFilter = container.querySelector('#pwd-filter-input');
    if (pwdFilter) {
      pwdFilter.addEventListener('input', (e) => {
        const val = e.target.value.trim().toLowerCase();
        container.querySelectorAll('.password-vault-row').forEach(row => {
          const searchStr = row.getAttribute('data-search') || '';
          if (!val || searchStr.includes(val)) {
            row.style.display = 'block';
          } else {
            row.style.display = 'none';
          }
        });
      });
    }

    // Toggle reveal password
    container.querySelectorAll('.toggle-reveal-pwd').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const raw = btn.getAttribute('data-raw') || '';
        const textEl = container.querySelector(`#pwd-val-${id}`);
        const icon = btn.querySelector('i');
        if (!textEl) return;

        if (textEl.classList.contains('masked')) {
          textEl.textContent = raw;
          textEl.classList.remove('masked');
          icon?.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
          textEl.textContent = '••••••••';
          textEl.classList.add('masked');
          icon?.classList.replace('fa-eye-slash', 'fa-eye');
        }
      });
    });

    // Copy username
    container.querySelectorAll('.copy-user-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const user = btn.getAttribute('data-user') || '';
        if (user && user !== 'No Username') {
          navigator.clipboard.writeText(user).then(() => {
            window.ocalApp?.showToast?.('Username copied to clipboard', 'copy');
          }).catch(() => {
            window.ocalApp?.showToast?.(user, 'info');
          });
        }
      });
    });

    // Copy password
    container.querySelectorAll('.copy-pwd-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pwd = btn.getAttribute('data-pwd') || '';
        if (pwd) {
          navigator.clipboard.writeText(pwd).then(() => {
            window.ocalApp?.showToast?.('Password copied to clipboard', 'copy');
          }).catch(() => {
            window.ocalApp?.showToast?.('Copied to clipboard', 'info');
          });
        }
      });
    });

    // Open URL
    container.querySelectorAll('.open-url-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const u = btn.getAttribute('data-url') || '';
        if (u && onNavigate) onNavigate(u);
      });
    });

    // Delete individual password
    container.querySelectorAll('.delete-pwd-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (confirm('Delete this saved login?')) {
          PasswordManager.deletePassword(id);
          if (onNavigate) onNavigate('ocal://passwords');
        }
      });
    });

    // Add Password Modal
    const modal = container.querySelector('#add-pwd-modal');
    const openModal = () => {
      if (modal) {
        if (modal.parentElement !== document.body) {
          document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
        setTimeout(() => {
          modal.querySelector('#modal-pwd-url')?.focus();
        }, 80);
      }
    };
    const closeModal = () => {
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
        document.body.classList.remove('keyboard-open');
      }
      if (window.OcalNative && typeof window.OcalNative.hideKeyboard === 'function') {
        window.OcalNative.hideKeyboard();
      }
    };

    container.querySelector('#add-pwd-modal-btn')?.addEventListener('click', openModal);
    container.querySelector('#empty-add-pwd-btn')?.addEventListener('click', openModal);
    modal?.querySelector('#close-pwd-modal')?.addEventListener('click', closeModal);
    modal?.querySelector('#cancel-pwd-modal')?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    const modalEye = modal?.querySelector('#modal-pwd-eye');
    const modalPassInput = modal?.querySelector('#modal-pwd-pass');
    modalEye?.addEventListener('click', () => {
      if (!modalPassInput) return;
      if (modalPassInput.type === 'password') {
        modalPassInput.type = 'text';
        modalEye.querySelector('i')?.classList.replace('fa-eye', 'fa-eye-slash');
      } else {
        modalPassInput.type = 'password';
        modalEye.querySelector('i')?.classList.replace('fa-eye-slash', 'fa-eye');
      }
    });

    modal?.querySelector('#save-pwd-modal')?.addEventListener('click', () => {
      const url = modal.querySelector('#modal-pwd-url')?.value.trim() || '';
      const username = modal.querySelector('#modal-pwd-user')?.value.trim() || '';
      const password = modal.querySelector('#modal-pwd-pass')?.value || '';
      const notes = modal.querySelector('#modal-pwd-notes')?.value.trim() || '';

      if (!password) {
        alert('Please enter a password.');
        return;
      }

      PasswordManager.addPassword({
        url,
        username,
        password,
        notes
      });

      closeModal();
      if (modal.parentElement === document.body) {
        modal.remove();
      }
      window.ocalApp?.showToast?.('Login saved to vault!', 'check');
      if (onNavigate) onNavigate('ocal://passwords');
    });

    return container;
  }

  // 7.45 Ocal Connect & Device Sync
  static renderSync(onNavigate) {
    const container = document.createElement('div');
    container.className = 'subpage-container';

    const isPaired = syncClient.isPaired();
    const session = syncClient.getSession();
    const qrScanner = new QrScanner();

    let contentHtml = '';

    if (isPaired) {
      contentHtml = `
        <div class="sync-status-card connected">
          <div class="sync-status-icon pulse">
            <i class="fa-solid fa-link" style="font-size:20px; color:#34c759;"></i>
          </div>
          <div class="sync-status-info">
            <div class="sync-status-title" style="display:flex; align-items:center; gap:6px;">
              <span class="sync-status-indicator ${syncClient.getConnectionStatus() === 'reconnecting' ? 'syncing' : 'online'}" id="sync-live-dot"></span>
              <span id="sync-live-title">${syncClient.getConnectionStatus() === 'reconnecting' ? 'Reconnecting to PC...' : 'Connected to Desktop'}</span>
            </div>
            <div class="sync-status-sub">${escapeHtml(session.desktopName || 'Ocal Desktop PC')}</div>
            <div class="sync-status-host">http://${escapeHtml(session.host)}:${session.port}</div>
          </div>
          <button class="pwd-action-pill" id="sync-reconnect-btn" style="margin-left:auto; ${syncClient.getConnectionStatus() === 'reconnecting' ? '' : 'display:none;'}">Reconnect</button>
        </div>

        <div class="subpage-section-title">Quick Actions</div>
        <div class="apple-grouped-table">
          <div class="apple-grouped-row" id="sync-send-tab-row" style="cursor:pointer;">
            <div class="apple-row-icon mono-item">
              <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:13px;"></i>
            </div>
            <div class="apple-row-content">
              <div class="apple-row-title">Send Current Tab to PC</div>
              <div class="apple-row-subtitle">Open your active page on your desktop screen</div>
            </div>
            <div class="apple-row-chevron"><i class="fas fa-chevron-right"></i></div>
          </div>

          <div class="apple-grouped-row" id="sync-send-clipboard-row" style="cursor:pointer;">
            <div class="apple-row-icon mono-item">
              <i class="fa-solid fa-clipboard" style="font-size:13px;"></i>
            </div>
            <div class="apple-row-content">
              <div class="apple-row-title">Send Clipboard to PC</div>
              <div class="apple-row-subtitle">Push text or copied link to Windows clipboard</div>
            </div>
            <div class="apple-row-chevron"><i class="fas fa-chevron-right"></i></div>
          </div>
        </div>

        <div class="subpage-section-title">Data Synchronization</div>
        <div class="apple-grouped-table">
          <div class="apple-grouped-row" id="sync-bookmarks-row" style="cursor:pointer;">
            <div class="apple-row-icon mono-item">
              <i class="fa-solid fa-bookmark" style="font-size:13px;"></i>
            </div>
            <div class="apple-row-content">
              <div class="apple-row-title">Sync Bookmarks</div>
              <div class="apple-row-subtitle">Merge saved bookmarks with desktop</div>
            </div>
            <button class="pwd-action-pill" id="sync-bm-btn" style="margin-left:auto;">Sync</button>
          </div>

          <div class="apple-grouped-row" id="sync-passwords-row" style="cursor:pointer;">
            <div class="apple-row-icon mono-item">
              <i class="fa-solid fa-key" style="font-size:13px;"></i>
            </div>
            <div class="apple-row-content">
              <div class="apple-row-title">Sync Passwords Vault</div>
              <div class="apple-row-subtitle">Merge saved accounts and credentials</div>
            </div>
            <button class="pwd-action-pill" id="sync-pwd-btn" style="margin-left:auto;">Sync</button>
          </div>

          <div class="apple-grouped-row" id="sync-history-row" style="cursor:pointer;">
            <div class="apple-row-icon mono-item">
              <i class="fa-solid fa-clock-rotate-left" style="font-size:13px;"></i>
            </div>
            <div class="apple-row-content">
              <div class="apple-row-title">Sync Browsing History</div>
              <div class="apple-row-subtitle">Combine recent history across devices</div>
            </div>
            <button class="pwd-action-pill" id="sync-hist-btn" style="margin-left:auto;">Sync</button>
          </div>

          <div class="apple-grouped-row" id="sync-all-row" style="cursor:pointer;">
            <div class="apple-row-icon mono-copilot">
              <i class="fa-solid fa-arrows-rotate" style="font-size:13px;"></i>
            </div>
            <div class="apple-row-content">
              <div class="apple-row-title" style="font-weight:700;">Sync All Data Now</div>
              <div class="apple-row-subtitle">Merge bookmarks, passwords &amp; history in one tap</div>
            </div>
            <button class="modal-btn primary" id="sync-all-btn" style="margin-left:auto; padding:5px 12px; font-size:12px;">Sync All</button>
          </div>
        </div>

        <div class="subpage-section-title">Device Connection</div>
        <div class="apple-grouped-table">
          <div class="apple-grouped-row" id="sync-disconnect-row" style="cursor:pointer;">
            <div class="apple-row-icon mono-item" style="color:#ff3b30;">
              <i class="fa-solid fa-link-slash" style="font-size:13px;"></i>
            </div>
            <div class="apple-row-content">
              <div class="apple-row-title" style="color:#ff3b30; font-weight:700;">Disconnect Desktop</div>
              <div class="apple-row-subtitle">Unpair device and stop real-time events</div>
            </div>
          </div>
        </div>
      `;
    } else {
      contentHtml = `
        <!-- Minimalist Hero matching Home Page -->
        <div class="sync-minimal-hero">
          <div class="sync-hero-badge">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </div>
          <h2 class="sync-hero-title">Ocal Connect</h2>
          <p class="sync-hero-subtitle">Pair with Ocal on your PC for seamless tabs and history</p>
          <div class="sync-hero-pill">
            <span class="sync-status-indicator online"></span>
            <span>Same Wi-Fi Network</span>
          </div>
        </div>

        <!-- Clean Minimalist Viewfinder Card -->
        <div class="scanner-card">
          <div class="scanner-viewfinder" id="scanner-viewfinder-box">
            <video id="qr-scanner-video" playsinline muted autoplay style="width:100%; height:100%; object-fit:cover; display:none;"></video>
            
            <!-- Floating Controls Overlay -->
            <div class="scanner-floating-controls" id="scanner-floating-controls" style="display:none;">
              <button class="scanner-pill-btn" id="scanner-torch-btn" type="button">
                <i class="fa-solid fa-bolt"></i> Flash
              </button>
              <button class="scanner-pill-btn" id="scanner-flip-btn" type="button">
                <i class="fa-solid fa-camera-rotate"></i> Flip
              </button>
            </div>

            <div class="scanner-overlay-frame" id="scanner-overlay-frame" style="display:none;">
              <div class="scanner-corner top-left"></div>
              <div class="scanner-corner top-right"></div>
              <div class="scanner-corner bottom-left"></div>
              <div class="scanner-corner bottom-right"></div>
              <div class="scanner-laser" id="scanner-laser-line"></div>
            </div>

            <div class="scanner-placeholder" id="scanner-placeholder-view">
              <div class="scanner-placeholder-icon">
                <i class="fa-solid fa-camera"></i>
              </div>
              <div class="scanner-placeholder-title">Ready to Scan</div>
              <div class="scanner-placeholder-desc">Align desktop QR code inside frame</div>
            </div>
          </div>

          <div class="scanner-actions">
            <button class="scanner-action-btn primary" id="toggle-camera-btn">
              <i class="fa-solid fa-camera"></i><span id="camera-btn-text">Start Camera Scanner</span>
            </button>
            <button class="scanner-action-btn secondary" id="scan-photo-btn">
              <i class="fa-solid fa-image"></i><span>Scan from Photo / Screenshot</span>
            </button>
            <input type="file" id="scanner-file-input" accept="image/*" style="display:none;" />
          </div>
          <div id="scanner-status-msg" class="scanner-msg" style="display:none;"></div>
        </div>

        <!-- Manual PIN Connect Section -->
        <div class="subpage-section-title">Manual PIN Connection</div>
        <div class="apple-grouped-table sync-manual-table">
          <div class="sync-input-group">
            <label class="sync-input-label">Desktop IP Address</label>
            <input type="text" class="sync-input" id="manual-sync-ip" placeholder="e.g. 192.168.1.5" />
          </div>
          <div class="sync-input-row">
            <div class="sync-input-group flex-2">
              <label class="sync-input-label">6-Digit PIN</label>
              <input type="text" class="sync-input pin-input" id="manual-sync-pin" placeholder="740887" maxlength="6" />
            </div>
            <div class="sync-input-group flex-1">
              <label class="sync-input-label">Port</label>
              <input type="number" class="sync-input" id="manual-sync-port" value="9876" />
            </div>
          </div>
          <button class="scanner-action-btn primary" id="manual-connect-btn" style="margin-top:4px;">
            <i class="fa-solid fa-link"></i><span>Verify &amp; Connect</span>
          </button>
        </div>

        <!-- How to connect steps -->
        <div class="subpage-section-title">How to Find QR on Desktop</div>
        <div class="apple-grouped-table sync-instructions-table">
          <div class="sync-step-row">
            <div class="sync-step-num">1</div>
            <div class="sync-step-text">Open <b>Ocal Browser</b> on your PC</div>
          </div>
          <div class="sync-step-row">
            <div class="sync-step-num">2</div>
            <div class="sync-step-text">Go to <b>Settings &rarr; Ocal Connect (Sync)</b></div>
          </div>
          <div class="sync-step-row">
            <div class="sync-step-num">3</div>
            <div class="sync-step-text">Scan the QR code or enter the 6-digit PIN</div>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="subpage-header">
        <button class="subpage-back-btn" id="sync-back-btn"><i class="fas fa-chevron-left"></i></button>
        <div class="subpage-header-title">Ocal Connect &amp; Sync</div>
        <div style="width:36px;"></div>
      </div>

      <div class="subpage-content">
        ${contentHtml}
      </div>
    `;

    // Clean teardown when leaving page
    let unsubSync = null;
    const cleanup = () => {
      qrScanner.stop();
      if (unsubSync) unsubSync();
    };

    container.querySelector('#sync-back-btn')?.addEventListener('click', () => {
      cleanup();
      if (onNavigate) onNavigate('ocal://home');
    });

    if (isPaired) {
      const liveDot = container.querySelector('#sync-live-dot');
      const liveTitle = container.querySelector('#sync-live-title');
      const reconnectBtn = container.querySelector('#sync-reconnect-btn');

      const updateStatusUI = (status) => {
        if (!liveDot || !liveTitle) return;
        if (status === 'connected') {
          liveDot.className = 'sync-status-indicator online';
          liveTitle.textContent = 'Connected to Desktop';
          if (reconnectBtn) reconnectBtn.style.display = 'none';
        } else if (status === 'reconnecting') {
          liveDot.className = 'sync-status-indicator syncing';
          liveTitle.textContent = 'Reconnecting to PC...';
          if (reconnectBtn) reconnectBtn.style.display = 'inline-block';
        }
      };

      unsubSync = syncClient.addListener((event, data) => {
        if (event === 'status') updateStatusUI(data);
        if (event === 'connected') updateStatusUI('connected');
      });

      reconnectBtn?.addEventListener('click', async () => {
        reconnectBtn.textContent = 'Connecting...';
        await syncClient.reconnect();
        setTimeout(() => { if (reconnectBtn) reconnectBtn.textContent = 'Reconnect'; }, 2000);
      });
      // 1. Send Active Tab
      container.querySelector('#sync-send-tab-row')?.addEventListener('click', async () => {
        const curTab = window.ocalApp?.tabManager?.getActiveTab();
        const url = curTab?.url || 'https://google.com';
        const title = curTab?.title || url;
        try {
          await syncClient.sendActiveTab(url, title);
          window.ocalApp?.showToast?.(`Sent tab to PC: ${title}`, 'check');
        } catch (err) {
          alert('Failed to send tab: ' + err.message);
        }
      });

      // 2. Send Clipboard
      container.querySelector('#sync-send-clipboard-row')?.addEventListener('click', async () => {
        try {
          let text = '';
          if (navigator.clipboard && navigator.clipboard.readText) {
            text = await navigator.clipboard.readText().catch(() => '');
          }
          if (!text) {
            text = prompt('Enter text or URL to send to Windows desktop clipboard:');
          }
          if (text) {
            await syncClient.sendClipboard(text);
            window.ocalApp?.showToast?.('Sent text to PC clipboard!', 'check');
          }
        } catch (err) {
          alert('Failed to send clipboard: ' + err.message);
        }
      });

      // 3. Sync Bookmarks
      container.querySelector('#sync-bm-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const bms = await syncClient.syncBookmarks();
          window.ocalApp?.showToast?.(`Bookmarks synced (${bms.length} total)`, 'check');
        } catch (err) {
          alert('Bookmark sync failed: ' + err.message);
        }
      });

      // 4. Sync Passwords
      container.querySelector('#sync-pwd-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const pwds = await syncClient.syncPasswords();
          window.ocalApp?.showToast?.(`Passwords synced (${pwds.length} total)`, 'check');
        } catch (err) {
          alert('Password sync failed: ' + err.message);
        }
      });

      // 5. Sync History
      container.querySelector('#sync-hist-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const hist = await syncClient.syncHistory();
          window.ocalApp?.showToast?.(`History synced (${hist.length} items)`, 'check');
        } catch (err) {
          alert('History sync failed: ' + err.message);
        }
      });

      // 6. Sync All
      container.querySelector('#sync-all-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const btn = container.querySelector('#sync-all-btn');
        if (btn) btn.textContent = 'Syncing...';
        try {
          await syncClient.syncAll();
          window.ocalApp?.showToast?.('All data successfully synced with Desktop!', 'check');
        } catch (err) {
          alert('Sync failed: ' + err.message);
        } finally {
          if (btn) btn.textContent = 'Sync All';
        }
      });

      // 7. Disconnect
      container.querySelector('#sync-disconnect-row')?.addEventListener('click', async () => {
        if (confirm('Disconnect from desktop browser?')) {
          await syncClient.unpair();
          cleanup();
          if (onNavigate) onNavigate('ocal://sync');
        }
      });
    } else {
      // Camera Scanner, Torch, Flip & Manual PIN
      let cameraActive = false;
      const toggleBtn = container.querySelector('#toggle-camera-btn');
      const btnText = container.querySelector('#camera-btn-text');
      const videoEl = container.querySelector('#qr-scanner-video');
      const frameEl = container.querySelector('#scanner-overlay-frame');
      const controlsEl = container.querySelector('#scanner-floating-controls');
      const placeholderEl = container.querySelector('#scanner-placeholder-view');
      const statusMsg = container.querySelector('#scanner-status-msg');
      const torchBtn = container.querySelector('#scanner-torch-btn');
      const flipBtn = container.querySelector('#scanner-flip-btn');
      const photoBtn = container.querySelector('#scan-photo-btn');
      const fileInput = container.querySelector('#scanner-file-input');

      const stopCam = () => {
        qrScanner.stop();
        cameraActive = false;
        if (videoEl) videoEl.style.display = 'none';
        if (frameEl) frameEl.style.display = 'none';
        if (controlsEl) controlsEl.style.display = 'none';
        if (placeholderEl) placeholderEl.style.display = 'flex';
        if (btnText) btnText.textContent = 'Start Camera Scanner';
        if (torchBtn) {
          torchBtn.classList.remove('active');
          torchBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Flash';
        }
      };

      const onScanSuccess = async (scannedText) => {
        console.log('[Scanner] QR detected:', scannedText);
        stopCam();
        if (statusMsg) {
          statusMsg.style.display = 'block';
          statusMsg.textContent = 'Verifying pairing credentials...';
        }
        try {
          await syncClient.pairWithQr(scannedText);
          window.ocalApp?.showToast?.('Successfully paired with Desktop!', 'check');
          cleanup();
          if (onNavigate) onNavigate('ocal://sync');
        } catch (err) {
          if (statusMsg) statusMsg.textContent = err.message || 'Pairing failed';
          alert('Pairing error: ' + err.message);
        }
      };

      const onScanError = (err) => {
        console.warn('[Scanner] Camera error:', err);
        stopCam();
        if (statusMsg) {
          statusMsg.style.display = 'block';
          statusMsg.textContent = 'Camera unavailable or permission denied. Please enter PIN below.';
        }
      };

      const startCam = () => {
        if (!videoEl) return;
        videoEl.style.display = 'block';
        if (frameEl) frameEl.style.display = 'block';
        if (controlsEl) controlsEl.style.display = 'flex';
        if (placeholderEl) placeholderEl.style.display = 'none';
        if (btnText) btnText.textContent = 'Stop Camera';
        cameraActive = true;

        if (statusMsg) {
          statusMsg.style.display = 'block';
          statusMsg.textContent = 'Align QR code within the frame...';
        }

        qrScanner.start(videoEl, onScanSuccess, onScanError);
      };

      toggleBtn?.addEventListener('click', () => {
        if (cameraActive) stopCam();
        else startCam();
      });

      // Torch toggle
      torchBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const isOn = await qrScanner.toggleTorch();
        if (torchBtn) {
          torchBtn.classList.toggle('active', isOn);
          torchBtn.innerHTML = isOn
            ? '<i class="fa-solid fa-bolt-slash"></i> Flash Off'
            : '<i class="fa-solid fa-bolt"></i> Flash';
        }
      });

      // Flip camera
      flipBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await qrScanner.switchCamera(onScanSuccess, onScanError);
      });

      // Photo / Screenshot upload fallback
      photoBtn?.addEventListener('click', () => {
        fileInput?.click();
      });

      fileInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (statusMsg) {
          statusMsg.style.display = 'block';
          statusMsg.textContent = 'Scanning image for QR code...';
        }
        try {
          const scannedText = await qrScanner.scanImageFile(file);
          onScanSuccess(scannedText);
        } catch (err) {
          if (statusMsg) statusMsg.textContent = err.message || 'No QR code found in image';
          alert(err.message || 'No QR code found in image. Please try another photo or enter PIN manually.');
        }
      });

      // Manual Connect
      container.querySelector('#manual-connect-btn')?.addEventListener('click', async () => {
        const ip = container.querySelector('#manual-sync-ip')?.value.trim();
        const pin = container.querySelector('#manual-sync-pin')?.value.trim();
        const port = container.querySelector('#manual-sync-port')?.value.trim() || 9876;

        if (!ip) {
          alert('Please enter your PC IP address.');
          return;
        }
        if (!pin) {
          alert('Please enter the 6-digit PIN.');
          return;
        }

        const connectBtn = container.querySelector('#manual-connect-btn');
        const originalBtnHtml = connectBtn?.innerHTML;

        try {
          if (connectBtn) connectBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>Connecting...';
          
          await syncClient.pairManual(ip, port, pin);
          window.ocalApp?.showToast?.('Successfully connected to Desktop!', 'check');
          cleanup();
          if (onNavigate) onNavigate('ocal://sync');
        } catch (err) {
          const msg = err.message || 'Unknown connection error';
          if (msg.includes('Cannot reach') || msg.includes('Cannot connect') || err.name === 'AbortError') {
            alert(`🔌 Connection Failed\n\n${msg}\n\nTroubleshooting:\n1. Check both devices are on the same Wi-Fi\n2. Open Ocal Desktop → Settings → Ocal Connect\n3. Click "Run Firewall Setup" on your PC\n4. Disable VPN on both devices`);
          } else {
            alert('Connection failed: ' + msg);
          }
        } finally {
          if (connectBtn) connectBtn.innerHTML = originalBtnHtml || '<i class="fa-solid fa-link" style="margin-right:6px;"></i>Verify &amp; Connect';
        }
      });
    }

    return container;
  }

  // 7.5 Downloads Manager
  static renderDownloads(onNavigate) {
    const container = document.createElement('div');
    container.className = 'subpage-container';
    let currentFilter = 'all';

    const renderList = () => {
      const listEl = container.querySelector('#downloads-list-wrapper');
      if (!listEl) return;

      const downloads = DownloadsManager.getDownloads();
      let filtered = downloads;
      if (currentFilter === 'active') {
        filtered = downloads.filter(d => d.status === 'downloading');
      } else if (currentFilter === 'completed') {
        filtered = downloads.filter(d => d.status === 'completed');
      }

      const searchVal = (container.querySelector('#dl-filter-input')?.value || '').trim().toLowerCase();
      if (searchVal) {
        filtered = filtered.filter(d => (d.filename || '').toLowerCase().includes(searchVal) || (d.filePath || '').toLowerCase().includes(searchVal));
      }

      if (filtered.length === 0) {
        listEl.innerHTML = `
          <div class="subpage-empty-state" style="padding: 48px 16px;">
            <div class="subpage-empty-icon" style="background-color: var(--bg-hover); color: var(--text-muted);">
              <i class="fas fa-arrow-down-to-bracket"></i>
            </div>
            <div class="subpage-empty-title">${downloads.length === 0 ? 'No Downloads Yet' : 'No Matching Downloads'}</div>
            <p class="subpage-empty-desc">${downloads.length === 0 ? 'Files downloaded from the web will appear here with real-time progress and storage location.' : 'Try changing your search query or filter.'}</p>
            ${downloads.length === 0 ? `
              <button class="pill-chip" id="demo-download-btn" style="background:var(--text-main); color:var(--bg-main); border:none; margin:16px auto 0; padding:9px 22px; font-weight:700; cursor:pointer; font-size:12.5px; border-radius: 9999px;">
                Download Sample PDF
              </button>
            ` : ''}
          </div>
        `;

        listEl.querySelector('#demo-download-btn')?.addEventListener('click', () => {
          const sample = DownloadsManager.addDownload({
            filename: 'Ocal_Browser_Guide.pdf',
            url: 'https://ocal.net/docs/guide.pdf',
            filePath: '/storage/emulated/0/Download/Ocal_Browser_Guide.pdf',
            totalBytes: 5242880,
            downloadedBytes: 524288,
            progress: 10,
            status: 'downloading',
            mimetype: 'application/pdf'
          });

          // Simulate live progress
          let currentProg = 10;
          const interval = setInterval(() => {
            currentProg += 18;
            if (currentProg >= 100) {
              clearInterval(interval);
              DownloadsManager.updateDownload(sample.id, {
                downloadedBytes: 5242880,
                progress: 100,
                status: 'completed'
              });
              if (window.ocalApp && typeof window.ocalApp.showToast === 'function') {
                window.ocalApp.showToast('Downloaded Ocal_Browser_Guide.pdf', 'check');
              }
            } else {
              DownloadsManager.updateDownload(sample.id, {
                downloadedBytes: Math.round(5242880 * (currentProg / 100)),
                progress: currentProg,
                status: 'downloading'
              });
            }
          }, 650);
        });
        return;
      }

      listEl.innerHTML = `
        <div class="apple-grouped-table">
          ${filtered.map(dl => {
            const iconInfo = DownloadsManager.getFileIconClass(dl.filename, dl.mimetype);
            const isDownloading = dl.status === 'downloading';
            const isFailed = dl.status === 'failed';
            const formattedSize = DownloadsManager.formatBytes(dl.totalBytes || dl.fileSize);
            const downloadedFormatted = DownloadsManager.formatBytes(dl.downloadedBytes);

            let dateStr = 'Just now';
            if (dl.timestamp) {
              const d = new Date(dl.timestamp);
              dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            }

            return `
              <div class="dl-item-row" data-id="${escapeHtml(String(dl.id))}">
                <div class="dl-file-icon ${iconInfo.type}">
                  <i class="${iconInfo.icon}"></i>
                </div>
                <div class="dl-file-info">
                  <div class="dl-filename" title="${escapeHtml(dl.filename)}">${escapeHtml(dl.filename)}</div>
                  ${isDownloading ? `
                    <div class="dl-progress-wrapper">
                      <div class="dl-progress-bar">
                        <div class="dl-progress-fill" style="width: ${dl.progress}%;"></div>
                      </div>
                      <div class="dl-progress-stats">
                        <span>${dl.progress}% • ${downloadedFormatted} / ${formattedSize}</span>
                        <span style="color:var(--accent-primary); font-weight:600;">Downloading</span>
                      </div>
                    </div>
                  ` : `
                    <div class="dl-meta">
                      <span>${formattedSize}</span>
                      <span style="opacity:0.4;">•</span>
                      <span>${escapeHtml(dateStr)}</span>
                      ${isFailed ? '<span style="color:var(--danger); font-weight:700;">• Failed</span>' : ''}
                    </div>
                    <div class="dl-path-badge" title="Storage Location: ${escapeHtml(dl.filePath || ('Download/' + dl.filename))}">
                      <i class="fas fa-folder-open" style="font-size:9.5px; opacity:0.8;"></i>
                      <span>${escapeHtml(dl.filePath || ('Download/' + dl.filename))}</span>
                    </div>
                  `}
                </div>
                <div class="dl-actions">
                  ${!isDownloading && !isFailed ? `
                    <button class="dl-open-btn open-dl-btn" data-id="${escapeHtml(String(dl.id))}">Open</button>
                  ` : ''}
                  <button class="dl-copy-btn copy-dl-path" data-path="${escapeHtml(dl.filePath || ('Download/' + dl.filename))}" title="Copy File Location">
                    <i class="fas fa-copy"></i>
                  </button>
                  <button class="history-delete-btn delete-dl-btn" data-id="${escapeHtml(String(dl.id))}" title="Delete Record">
                    <i class="fa-solid fa-xmark" style="font-size:13px;"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Bind actions
      listEl.querySelectorAll('.open-dl-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          const dl = DownloadsManager.getDownloads().find(d => String(d.id) === String(id));
          if (dl) {
            if (window.OcalNative && typeof window.OcalNative.openDownloadedFile === 'function') {
              window.OcalNative.openDownloadedFile(dl.filePath, dl.mimetype || '*/*');
            } else if (dl.url && dl.url.startsWith('http')) {
              window.open(dl.url, '_blank');
            } else {
              window.ocalApp?.showToast?.('File: ' + dl.filePath, 'folder');
            }
          }
        });
      });

      listEl.querySelectorAll('.copy-dl-path').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const path = btn.getAttribute('data-path');
          if (path) {
            navigator.clipboard?.writeText?.(path).catch(() => {});
            if (window.ocalApp && typeof window.ocalApp.showToast === 'function') {
              window.ocalApp.showToast('Location copied to clipboard', 'copy');
            }
          }
        });
      });

      listEl.querySelectorAll('.delete-dl-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          DownloadsManager.removeDownload(id);
          renderList();
        });
      });
    };

    container.innerHTML = `
      <div class="subpage-header">
        <button class="subpage-back-btn" id="dl-back-btn"><i class="fas fa-chevron-left"></i></button>
        <div class="subpage-header-title">Downloads</div>
        <button class="subpage-action-btn danger" id="clear-downloads-btn">Clear</button>
      </div>

      <div class="subpage-content">
        <!-- Search bar -->
        <div class="history-search-container">
          <div class="history-search-bar">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" class="history-search-input" id="dl-filter-input" placeholder="Search downloads..." autocomplete="off" />
          </div>
        </div>

        <!-- Filter tabs (All / Active / Completed) -->
        <div class="dl-tabs-bar">
          <button class="dl-tab-chip active" data-filter="all">All</button>
          <button class="dl-tab-chip" data-filter="active">Downloading</button>
          <button class="dl-tab-chip" data-filter="completed">Completed</button>
        </div>

        <!-- Downloads List Container -->
        <div id="downloads-list-wrapper"></div>
      </div>
    `;

    // Back button
    container.querySelector('#dl-back-btn')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('ocal://home');
    });

    // Clear all completed button
    container.querySelector('#clear-downloads-btn')?.addEventListener('click', () => {
      const allDls = DownloadsManager.getDownloads();
      if (allDls.length === 0) return;
      if (confirm('Clear completed downloads history?')) {
        DownloadsManager.clearCompleted();
        renderList();
      }
    });

    // Search filter
    container.querySelector('#dl-filter-input')?.addEventListener('input', () => {
      renderList();
    });

    // Tab filter chips
    container.querySelectorAll('.dl-tab-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.dl-tab-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.getAttribute('data-filter') || 'all';
        renderList();
      });
    });

    // Initial render
    setTimeout(() => renderList(), 0);

    // Live update listener while page is open
    const removeListener = DownloadsManager.addListener(() => {
      renderList();
    });

    // Cleanup when container is detached
    const observer = new MutationObserver(() => {
      if (!document.body.contains(container)) {
        removeListener();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return container;
  }

  // 8. Browsing History Grouped by Date & Site
  static renderHistory(onNavigate) {
    const container = document.createElement('div');
    container.className = 'subpage-container';
    const history = JSON.parse(localStorage.getItem('ocal-history') || '[]');
    let currentView = localStorage.getItem('ocal-history-view') || 'date';

    let contentHtml = '';
    if (history.length === 0) {
      contentHtml = `
        <div class="subpage-empty-state">
          <div class="subpage-empty-icon history">
            <i class="fas fa-clock-rotate-left"></i>
          </div>
          <div class="subpage-empty-title">History is Clean</div>
          <p class="subpage-empty-desc">Websites and searches you visit will appear here.</p>
        </div>
      `;
    } else {
      // 1. Compute Date Grouping
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfYesterday = startOfToday - 86400000;
      const startOfWeek = startOfToday - 6 * 86400000;

      const dateGroups = [
        { id: 'today', title: 'Today', items: [] },
        { id: 'yesterday', title: 'Yesterday', items: [] },
        { id: 'week', title: 'Previous 7 Days', items: [] },
        { id: 'older', title: 'Older', items: [] }
      ];

      history.forEach((item, index) => {
        const ts = item.timestamp || 0;
        if (ts >= startOfToday) {
          dateGroups[0].items.push({ item, index });
        } else if (ts >= startOfYesterday) {
          dateGroups[1].items.push({ item, index });
        } else if (ts >= startOfWeek) {
          dateGroups[2].items.push({ item, index });
        } else {
          dateGroups[3].items.push({ item, index });
        }
      });

      // 2. Compute Site Grouping
      const siteMap = new Map();
      history.forEach((item, index) => {
        let domain = 'other';
        try {
          domain = new URL(item.url).hostname.replace(/^(www\.|html\.)/i, '');
        } catch {
          domain = item.url.replace(/^https?:\/\//i, '').split('/')[0] || 'other';
        }
        if (!siteMap.has(domain)) {
          siteMap.set(domain, []);
        }
        siteMap.get(domain).push({ item, index });
      });

      const siteGroups = Array.from(siteMap.entries()).sort((a, b) => b[1].length - a[1].length);

      // Render helper for an individual history row
      const renderRow = (item, index) => {
        const formatted = formatSmartHistoryItem(item);
        const initial = (formatted.domain || 'W')[0].toUpperCase();
        return `
          <div class="history-item-row" data-url="${escapeHtml(item.url)}" data-index="${index}" data-title="${escapeHtml(formatted.title.toLowerCase())}">
            <div class="apple-row-icon ${formatted.isSearch ? 'mono-search' : 'mono-domain'}">
              ${formatted.isSearch 
                ? '<i class="fa-solid fa-magnifying-glass" style="font-size:13px;"></i>' 
                : `<span style="font-size:13px; font-weight:700;">${escapeHtml(initial)}</span>`}
            </div>
            <div class="history-content">
              <div class="history-title">${escapeHtml(formatted.title)}</div>
              <div class="history-meta">
                <span class="history-domain-pill">${escapeHtml(formatted.domain || 'web')}</span>
                <span class="history-separator">•</span>
                <span>${formatted.isSearch ? 'Search' : escapeHtml(formatted.url.replace(/^https?:\/\/(www\.)?/, '').substring(0, 36))}</span>
                <span class="history-separator">•</span>
                <span class="history-time-tag">${escapeHtml(formatted.timeStr)}</span>
              </div>
            </div>
            <button class="history-delete-btn" data-url="${escapeHtml(item.url)}" title="Remove">
              <i class="fa-solid fa-xmark" style="font-size:13px;"></i>
            </button>
          </div>
        `;
      };

      contentHtml = `
        <div class="history-search-container">
          <div class="history-search-bar">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" class="history-search-input" id="history-filter-input" placeholder="Search pages, domains and links..." autocomplete="off" />
          </div>
        </div>

        <!-- Segmented Switcher: By Date vs By Site -->
        <div class="history-view-segmented" id="history-view-segmented">
          <button class="history-segment-btn ${currentView === 'date' ? 'active' : ''}" data-view="date">
            <i class="far fa-calendar"></i>
            <span>By Date</span>
          </button>
          <button class="history-segment-btn ${currentView === 'site' ? 'active' : ''}" data-view="site">
            <i class="fas fa-globe"></i>
            <span>By Site</span>
          </button>
        </div>

        <!-- 1. By Date Container -->
        <div id="history-date-view-container" style="display: ${currentView === 'date' ? 'block' : 'none'};">
          ${dateGroups.filter(g => g.items.length > 0).map(group => `
            <div class="history-date-section" data-group="${group.id}">
              <div class="history-date-header">
                <span class="history-date-title">${group.title}</span>
                <span class="history-date-badge">${group.items.length}</span>
              </div>
              <div class="apple-grouped-table">
                ${group.items.map(entry => renderRow(entry.item, entry.index)).join('')}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- 2. By Site Container -->
        <div id="history-site-view-container" style="display: ${currentView === 'site' ? 'block' : 'none'};">
          ${siteGroups.map(([domain, items]) => {
            const initial = domain[0].toUpperCase();
            return `
              <div class="history-site-card" data-domain="${escapeHtml(domain.toLowerCase())}">
                <div class="history-site-header">
                  <div class="history-site-icon">${escapeHtml(initial)}</div>
                  <div class="history-site-info">
                    <div class="history-site-domain">${escapeHtml(domain)}</div>
                    <div class="history-site-count">${items.length} ${items.length === 1 ? 'visit' : 'visits'}</div>
                  </div>
                  <div class="history-site-actions">
                    <button class="history-site-delete-btn" data-domain="${escapeHtml(domain)}" title="Clear all for this site">
                      <i class="fa-regular fa-trash-can"></i>
                    </button>
                    <div class="history-site-chevron"><i class="fas fa-chevron-right"></i></div>
                  </div>
                </div>
                <div class="history-site-items">
                  <div class="apple-grouped-table" style="border:none; border-radius:0;">
                    ${items.map(entry => renderRow(entry.item, entry.index)).join('')}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    container.innerHTML = `
      <div class="subpage-header">
        <button class="subpage-back-btn" id="history-back-btn"><i class="fas fa-chevron-left"></i></button>
        <div class="subpage-header-title">Browsing History</div>
        ${history.length > 0 ? '<button class="subpage-action-btn danger" id="clear-history-btn">Clear All</button>' : '<div style="width:36px;"></div>'}
      </div>

      <div class="subpage-content">
        ${contentHtml}
      </div>
    `;

    container.querySelector('#history-back-btn')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('ocal://home');
    });

    // View switcher (By Date vs By Site)
    container.querySelectorAll('.history-segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        currentView = view;
        try { localStorage.setItem('ocal-history-view', view); } catch (_) {}
        container.querySelectorAll('.history-segment-btn').forEach(b => b.classList.toggle('active', b === btn));
        const dateContainer = container.querySelector('#history-date-view-container');
        const siteContainer = container.querySelector('#history-site-view-container');
        if (dateContainer) dateContainer.style.display = view === 'date' ? 'block' : 'none';
        if (siteContainer) siteContainer.style.display = view === 'site' ? 'block' : 'none';
      });
    });

    // Site card accordion toggle
    container.querySelectorAll('.history-site-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if (e.target.closest('.history-site-delete-btn')) return;
        const card = header.closest('.history-site-card');
        card?.classList.toggle('expanded');
      });
    });

    // Clear whole site history
    container.querySelectorAll('.history-site-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetDomain = btn.getAttribute('data-domain');
        if (!targetDomain) return;
        if (confirm(`Remove all history entries for "${targetDomain}"?`)) {
          const curHistory = JSON.parse(localStorage.getItem('ocal-history') || '[]');
          const updated = curHistory.filter(h => {
            try {
              const d = new URL(h.url).hostname.replace(/^(www\.|html\.)/i, '');
              return d.toLowerCase() !== targetDomain.toLowerCase();
            } catch {
              return true;
            }
          });
          localStorage.setItem('ocal-history', JSON.stringify(updated));
          if (onNavigate) onNavigate('ocal://history');
        }
      });
    });

    // Row clicks
    container.querySelectorAll('.history-item-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.history-delete-btn')) return;
        const u = row.getAttribute('data-url');
        if (u && onNavigate) onNavigate(u);
      });
    });

    // Individual delete
    container.querySelectorAll('.history-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetUrl = btn.getAttribute('data-url');
        const curHistory = JSON.parse(localStorage.getItem('ocal-history') || '[]');
        const updated = curHistory.filter(h => h.url !== targetUrl);
        localStorage.setItem('ocal-history', JSON.stringify(updated));
        if (onNavigate) onNavigate('ocal://history');
      });
    });

    // Search filter input
    const filterInput = container.querySelector('#history-filter-input');
    if (filterInput) {
      filterInput.addEventListener('input', (e) => {
        const val = e.target.value.trim().toLowerCase();

        // 1. Date View Filter
        container.querySelectorAll('#history-date-view-container .history-item-row').forEach(row => {
          const rowTitle = row.getAttribute('data-title') || '';
          const rowUrl = (row.getAttribute('data-url') || '').toLowerCase();
          const match = !val || rowTitle.includes(val) || rowUrl.includes(val);
          row.style.display = match ? 'flex' : 'none';
        });

        container.querySelectorAll('#history-date-view-container .history-date-section').forEach(sec => {
          const hasVisible = Array.from(sec.querySelectorAll('.history-item-row')).some(r => r.style.display !== 'none');
          sec.style.display = hasVisible ? 'block' : 'none';
        });

        // 2. Site View Filter
        container.querySelectorAll('#history-site-view-container .history-site-card').forEach(card => {
          const domain = (card.getAttribute('data-domain') || '').toLowerCase();
          let hasMatchingChild = false;
          card.querySelectorAll('.history-item-row').forEach(row => {
            const rowTitle = row.getAttribute('data-title') || '';
            const rowUrl = (row.getAttribute('data-url') || '').toLowerCase();
            const match = !val || rowTitle.includes(val) || rowUrl.includes(val);
            row.style.display = match ? 'flex' : 'none';
            if (match) hasMatchingChild = true;
          });

          if (!val) {
            card.style.display = 'block';
          } else if (domain.includes(val) || hasMatchingChild) {
            card.style.display = 'block';
            card.classList.add('expanded'); // Auto-expand matching site
          } else {
            card.style.display = 'none';
          }
        });
      });
    }

    container.querySelector('#clear-history-btn')?.addEventListener('click', () => {
      if (confirm('Clear all browsing history?')) {
        localStorage.setItem('ocal-history', '[]');
        if (onNavigate) onNavigate('ocal://history');
      }
    });

    return container;
  }

  // 9. Apple Inset Grouped Settings (Complete Redesign)
  static renderSettings(onNavigate) {
    const container = document.createElement('div');
    container.className = 'subpage-container';
    const currentTheme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('ocal-theme') || 'light';
    const currentEngine = localStorage.getItem('ocal-engine') || 'Google';
    const isAdBlock = localStorage.getItem('ocal-shield-adblock') !== 'false';
    const isHttps = localStorage.getItem('ocal-shield-https') !== 'false';
    const isSuggestions = localStorage.getItem('ocal-suggestions') !== 'false';
    const isDesktopDefault = localStorage.getItem('ocal-desktop-default') === 'true';
    const passwordsCount = PasswordManager.getPasswords().length;
    const aiKey = localStorage.getItem('ocal_ai_api_key') || '';

    const currentBlur = parseInt(localStorage.getItem('ocal-blur-density') ?? '24', 10);

    const SETTINGS_ICONS = {
      back: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
      sparkles: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></svg>`,
      moon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>`,
      google: `<svg width="19" height="19" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/></svg>`,
      duck: `<svg width="22" height="22" viewBox="47 3 115 115"><defs><clipPath id="ddg-clip"><circle cx="104.83" cy="60.219" r="54"/></clipPath></defs><circle cx="104.83" cy="60.219" r="54" fill="#DE5833"/><g clip-path="url(#ddg-clip)"><path d="M115.96 113.78c-2.51-4.88-4.91-9.37-6.4-12.34-3.96-7.93-7.94-19.11-6.13-26.32.33-1.31-3.73-48.51-6.6-50.03-3.19-1.7-10.12-3.94-13.71-4.54-2.5-.4-3.07.3-4.12.46.99.1 5.7 2.42 6.61 2.55-.91.62-3.6-.02-5.32.74-.87.4-1.52 1.88-1.5 2.58 4.9-.5 12.56-.01 17.1 2-3.61.41-9.09.87-11.45 2.11-6.84 3.6-9.86 12.03-8.06 22.13 1.79 10.08 9.72 46.85 12.25 59.13 2.52 12.27 31.51 9.7 27.32 1.53z" fill="#D5D7D8"/><path d="M119.6 114.97c-3.01-5.97-6.08-11.68-7.86-15.22-3.97-7.94-7.93-19.11-6.13-26.32.34-1.31.34-6.67 1.43-7.38 8.41-5.5 7.81-.19 11.19-2.65 1.74-1.27 3.13-2.8 3.74-4.9 2.16-7.58-3-20.77-8.78-26.54-1.88-1.88-4.76-3.06-8.02-3.68-1.25-1.72-3.27-3.36-6.13-4.89a28.86 28.86 0 0 0-18.27-2.88c1 .1 3.26 2.14 4.17 2.27-1.38.94-5.05.82-5.03 2.9 4.92-.5 10.3.28 14.84 2.3-3.6.4-6.96 1.3-9.31 2.54-6.86 3.6-8.66 10.81-6.86 20.91 1.81 10.1 9.74 46.88 12.26 59.13 2.53 12.26 32.5 11.8 28.77 4.41z" fill="#FFF"/></g><circle r="3.79" cx="90.3" cy="51.94" fill="#2D4F8E"/><circle r=".98" cx="91.99" cy="50.68" fill="#FFF"/><path fill="#FDD20A" d="M101.9 66.55c.38-2.3 6.3-6.63 10.5-6.9 4.2-.26 5.5-.2 9-1.04 3.51-.83 12.54-3.08 15.03-4.24 2.5-1.15 13.1.57 5.63 4.74-3.23 1.81-11.94 5.13-18.17 6.99-6.22 1.86-9.99-1.78-12.06 1.28-1.64 2.43-.33 5.76 7.1 6.45 10.04.93 19.66-4.52 20.72-1.62 1.06 2.9-8.62 6.5-14.52 6.62-5.9.11-17.78-3.9-19.56-5.14-1.79-1.23-4.16-4.13-3.67-7.14z"/><g><path fill="#65BC46" d="M106.44 96.85s-14.1-7.53-14.33-4.48c-.24 3.06 0 15.51 1.64 16.45 1.65.94 13.4-6.1 13.4-6.1l-.7-5.88zm5.4-.48s9.64-7.29 11.76-6.82c2.11.48 2.58 15.51.7 16.23-1.88.7-12.9-3.81-12.9-3.81l.45-5.6z"/><path fill="#43A244" d="M103.03 97.64c0 4.93-.71 7.05 1.4 7.52 2.12.47 6.11 0 7.53-.94 1.4-.94.23-7.28-.24-8.46-.47-1.18-8.7-.24-8.7 1.88z"/></g></svg>`,
      bing: `<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path fill="#24C7B8" d="M8.35 5.046a.615.615 0 0 0-.54.575c-.009.13-.006.14.289.899.67 1.727.833 2.142.86 2.2q.101.215.277.395c.089.092.148.141.247.208.176.117.262.15.944.351.664.197 1.026.327 1.338.482.405.201.688.43.866.7.128.195.242.544.291.896.02.137.02.44 0 .564-.041.27-.124.495-.252.684-.067.1-.044.084.055-.039.278-.346.562-.938.707-1.475a4.42 4.42 0 0 0-2.14-5.028 70 70 0 0 0-.888-.465l-.53-.277-.353-.184c-.16-.082-.266-.138-.345-.18-.368-.192-.523-.27-.568-.283a1 1 0 0 0-.194-.03z"/><path fill="#008AD7" d="M9.152 11.493a3 3 0 0 0-.135.083 320 320 0 0 0-1.513.934l-.8.496c-.012.01-.587.367-.876.543a1.9 1.9 0 0 1-.732.257c-.12.017-.349.017-.47 0a1.9 1.9 0 0 1-.884-.358 2.5 2.5 0 0 1-.365-.364 1.9 1.9 0 0 1-.34-.76 1 1 0 0 0-.027-.121c-.005-.006.004.092.022.22.018.132.057.324.098.489a4.1 4.1 0 0 0 2.487 2.796c.359.142.72.23 1.114.275.147.016.566.023.72.011a4.1 4.1 0 0 0 1.956-.661l.235-.149.394-.248.258-.163 1.164-.736c.51-.32.663-.433.9-.665.099-.097.248-.262.255-.283.002-.005.028-.046.059-.091a1.64 1.64 0 0 0 .25-.682c.02-.124.02-.427 0-.565a3 3 0 0 0-.213-.758c-.15-.314-.47-.6-.928-.83a2 2 0 0 0-.273-.12c-.006 0-.433.26-.948.58l-1.113.687z"/><path fill="#008373" d="m3.004 12.184.03.129c.089.402.245.693.515.963a1.82 1.82 0 0 0 1.312.543c.361 0 .673-.09.994-.287l.472-.29.373-.23V5.334c0-1.537-.003-2.45-.008-2.521a1.82 1.82 0 0 0-.535-1.177c-.097-.096-.18-.16-.427-.33L4.183.24c-.239-.163-.258-.175-.33-.2a.63.63 0 0 0-.842.464c-.009.042-.01.603-.01 3.646l.003 8.035Z"/></svg>`,
      brave: `<svg width="19" height="19" viewBox="0 0 24 24"><path fill="#FB542B" d="M15.68 0l2.096 2.38s1.84-.512 2.709.358c.868.87 1.584 1.638 1.584 1.638l-.562 1.381.715 2.047s-2.104 7.98-2.35 8.955c-.486 1.919-.818 2.66-2.198 3.633-1.38.972-3.884 2.66-4.293 2.916-.409.256-.92.692-1.38.692-.46 0-.97-.436-1.38-.692a185.796 185.796 0 01-4.293-2.916c-1.38-.973-1.712-1.714-2.197-3.633-.247-.975-2.351-8.955-2.351-8.955l.715-2.047-.562-1.381s.716-.768 1.585-1.638c.868-.87 2.708-.358 2.708-.358L8.321 0h7.36zm-3.679 14.936c-.14 0-1.038.317-1.758.69-.72.373-1.242.637-1.409.742-.167.104-.065.301.087.409.152.107 2.194 1.69 2.393 1.866.198.175.489.464.687.464.198 0 .49-.29.688-.464.198-.175 2.24-1.759 2.392-1.866.152-.108.254-.305.087-.41-.167-.104-.689-.368-1.41-.741-.72-.373-1.617-.69-1.757-.69zm0-11.278s-.409.001-1.022.206-1.278.46-1.584.46c-.307 0-2.581-.434-2.581-.434S4.119 7.152 4.119 7.849c0 .697.339.881.68 1.243l2.02 2.149c.192.203.59.511.356 1.066-.235.555-.58 1.26-.196 1.977.384.716 1.042 1.194 1.464 1.115.421-.08 1.412-.598 1.776-.834.364-.237 1.518-1.19 1.518-1.554 0-.365-1.193-1.02-1.413-1.168-.22-.15-1.226-.725-1.247-.95-.02-.227-.012-.293.284-.851.297-.559.831-1.304.742-1.8-.089-.495-.95-.753-1.565-.986-.615-.232-1.799-.671-1.947-.74-.148-.068-.11-.133.339-.175.448-.043 1.719-.212 2.292-.052.573.16 1.552.403 1.632.532.079.13.149.134.067.579-.081.445-.5 2.581-.541 2.96-.04.38-.12.63.288.724.409.094 1.097.256 1.333.256s.924-.162 1.333-.256c.408-.093.329-.344.288-.723-.04-.38-.46-2.516-.541-2.961-.082-.445-.012-.45.067-.579.08-.129 1.059-.372 1.632-.532.573-.16 1.845.009 2.292.052.449.042.487.107.339.175-.148.069-1.332.508-1.947.74-.615.233-1.476.49-1.565.986-.09.496.445 1.241.742 1.8.297.558.304.624.284.85-.02.226-1.026.802-1.247.95-.22.15-1.413.804-1.413 1.169 0 .364 1.154 1.317 1.518 1.554.364.236 1.355.755 1.776.834.422.079 1.08-.4 1.464-1.115.384-.716.039-1.422-.195-1.977-.235-.555.163-.863.355-1.066l2.02-2.149c.341-.362.68-.546.68-1.243 0-.697-2.695-3.96-2.695-3.96s-2.274.436-2.58.436c-.307 0-.972-.256-1.585-.461-.613-.205-1.022-.206-1.022-.206z"/></svg>`,
      shield: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
      lock: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
      trash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
      suggest: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></svg>`,
      desktop: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
      compass: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
      key: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 2.5 2.5"/><path d="m18.5 4.5 2.5 2.5"/></svg>`,
      bookmark: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
      import: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
      export: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
      check: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
      chevron: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`
    };

    container.innerHTML = `
      <div class="subpage-header">
        <button class="subpage-back-btn" id="settings-back-btn" title="Back">${SETTINGS_ICONS.back}</button>
        <div class="subpage-header-title">Settings</div>
        <button class="subpage-action-btn" id="settings-done-btn">Done</button>
      </div>

      <div class="subpage-content">
        <!-- Appearance & Customization Section -->
        <div>
          <div class="subpage-section-title">Appearance & Customization</div>
          <div class="apple-grouped-table">
            <div class="apple-grouped-row" style="cursor:default;">
              <div class="apple-row-icon mono-item">
                ${SETTINGS_ICONS.moon}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Dark Mode</div>
                <div class="apple-row-subtitle">Solid midnight slate theme</div>
              </div>
              <label class="toggle-switch" style="margin-left: auto;">
                <input type="checkbox" id="theme-toggle" ${currentTheme === 'dark' ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <!-- Glass Blur Master Toggle -->
            <div class="apple-grouped-row" style="cursor:default; border-top: 0.5px solid var(--glass-border-subtle);">
              <div class="apple-row-icon mono-item">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Glass Blur & Translucency</div>
                <div class="apple-row-subtitle">Frosted glass on navigation, menus & drawers</div>
              </div>
              <label class="toggle-switch" style="margin-left: auto;">
                <input type="checkbox" id="blur-master-toggle" ${currentBlur > 0 ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <!-- Glass Blur Density Presets & Slider -->
            <div class="blur-control-card" style="border-top: 0.5px solid var(--glass-border-subtle);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2px;">
                <div class="apple-row-title" style="font-size:13px; font-weight:600;">Blur Intensity</div>
                <span class="blur-val-badge" id="blur-val-display">${currentBlur === 0 ? 'Off (0px)' : currentBlur + 'px'}</span>
              </div>
              <div class="blur-preset-chips" id="blur-preset-chips">
                <button class="blur-chip-btn ${currentBlur === 0 ? 'active' : ''}" data-blur="0">Off (0px)</button>
                <button class="blur-chip-btn ${currentBlur === 12 ? 'active' : ''}" data-blur="12">Subtle (12px)</button>
                <button class="blur-chip-btn ${currentBlur === 24 ? 'active' : ''}" data-blur="24">Standard (24px)</button>
                <button class="blur-chip-btn ${currentBlur === 36 ? 'active' : ''}" data-blur="36">Deep (36px)</button>
                <button class="blur-chip-btn ${currentBlur === 48 ? 'active' : ''}" data-blur="48">Ultra (48px)</button>
              </div>
              <div class="blur-slider-row">
                <input type="range" class="blur-range-input" id="blur-range-slider" min="0" max="48" step="2" value="${currentBlur}">
              </div>
              <div style="font-size: 11px; color: var(--text-subtle); margin-top: 8px; line-height: 1.4;">
                Adjusts blur across URL capsule, bottom dock, menu drawers, tab tray, and dialogs. Turning off renders clean solid surfaces.
              </div>
            </div>
          </div>
        </div>

        <!-- Default Search Engine Section -->
        <div>
          <div class="subpage-section-title">Default Search Engine</div>
          <div class="apple-grouped-table">
            <div class="apple-grouped-row engine-pick-row" data-eng="Google">
              <div class="apple-row-icon engine-tile">
                ${SETTINGS_ICONS.google}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Google</div>
              </div>
              ${currentEngine === 'Google' ? SETTINGS_ICONS.check : ''}
            </div>

            <div class="apple-grouped-row engine-pick-row" data-eng="DuckDuckGo">
              <div class="apple-row-icon engine-tile">
                ${SETTINGS_ICONS.duck}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">DuckDuckGo</div>
              </div>
              ${currentEngine === 'DuckDuckGo' ? SETTINGS_ICONS.check : ''}
            </div>

            <div class="apple-grouped-row engine-pick-row" data-eng="Bing">
              <div class="apple-row-icon engine-tile">
                ${SETTINGS_ICONS.bing}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Bing</div>
              </div>
              ${currentEngine === 'Bing' ? SETTINGS_ICONS.check : ''}
            </div>

            <div class="apple-grouped-row engine-pick-row" data-eng="Brave">
              <div class="apple-row-icon engine-tile">
                ${SETTINGS_ICONS.brave}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Brave</div>
              </div>
              ${currentEngine === 'Brave' ? SETTINGS_ICONS.check : ''}
            </div>
          </div>
        </div>

        <!-- Privacy & Security Section -->
        <div>
          <div class="subpage-section-title">Privacy & Security</div>
          <div class="apple-grouped-table">
            <div class="apple-grouped-row" style="cursor:default;">
              <div class="apple-row-icon mono-copilot" style="font-weight:800; font-size:11px; font-family:var(--font-sans); letter-spacing:-0.5px;">
                uBO
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">uBlock Origin Ad Blocker</div>
                <div class="apple-row-subtitle">Block intrusive ads, banners & tracking</div>
              </div>
              <label class="toggle-switch" style="margin-left: auto;">
                <input type="checkbox" id="toggle-shield-adblock" ${isAdBlock ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="apple-grouped-row" style="cursor:default;">
              <div class="apple-row-icon mono-item">
                ${SETTINGS_ICONS.lock}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">HTTPS Upgrades</div>
                <div class="apple-row-subtitle">Automatically upgrade insecure HTTP requests</div>
              </div>
              <label class="toggle-switch" style="margin-left: auto;">
                <input type="checkbox" id="toggle-shield-https" ${isHttps ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="apple-grouped-row" id="clear-all-data-row">
              <div class="apple-row-icon mono-item">
                ${SETTINGS_ICONS.trash}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Clear Browsing Data & Cache</div>
                <div class="apple-row-subtitle">Removes history, cached images, and tabs</div>
              </div>
              <div class="apple-row-chevron">${SETTINGS_ICONS.chevron}</div>
            </div>
          </div>
        </div>

        <!-- Browsing Preferences Section -->
        <div>
          <div class="subpage-section-title">Browsing Preferences</div>
          <div class="apple-grouped-table">
            <div class="apple-grouped-row" style="cursor:default;">
              <div class="apple-row-icon mono-item">
                ${SETTINGS_ICONS.suggest}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Search Suggestions</div>
                <div class="apple-row-subtitle">Show query ideas as you type</div>
              </div>
              <label class="toggle-switch" style="margin-left: auto;">
                <input type="checkbox" id="toggle-suggestions" ${isSuggestions ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="apple-grouped-row" style="cursor:default;">
              <div class="apple-row-icon mono-item">
                ${SETTINGS_ICONS.desktop}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Desktop Mode by Default</div>
                <div class="apple-row-subtitle">Request desktop version on new pages</div>
              </div>
              <label class="toggle-switch" style="margin-left: auto;">
                <input type="checkbox" id="toggle-desktop-default" ${isDesktopDefault ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- AI Copilot Intelligence Section -->
        <div>
          <div class="subpage-section-title">AI Intelligence</div>
          <div class="apple-grouped-table">
            <div class="apple-grouped-row" id="settings-ai-key-row" style="cursor:pointer;">
              <div class="apple-row-icon mono-copilot">
                ${SETTINGS_ICONS.sparkles}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Ocal AI Copilot Key</div>
                <div class="apple-row-subtitle">${aiKey ? 'Configured • Ready for instant summaries & chat' : 'Connect free Google Gemini or OpenAI key'}</div>
              </div>
              <div style="margin-left:auto; display:flex; align-items:center; gap:8px;">
                <span class="sync-badge-pill ${aiKey ? 'connected' : 'disconnected'}">
                  ${aiKey ? 'Active' : 'Get Key'}
                </span>
                <div class="apple-row-chevron">${SETTINGS_ICONS.chevron}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Connected Devices / Ocal Sync Section -->
        <div>
          <div class="subpage-section-title">Connected Devices</div>
          <div class="apple-grouped-table">
            <div class="apple-grouped-row" id="settings-sync-row" style="cursor:pointer;">
              <div class="apple-row-icon mono-copilot">
                <i class="fa-solid fa-qrcode" style="font-size:14px;"></i>
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Ocal Connect (Sync)</div>
                <div class="apple-row-subtitle">${syncClient.isPaired() ? 'Connected to ' + escapeHtml(syncClient.getSession().desktopName || 'PC') : 'Pair with Windows desktop browser'}</div>
              </div>
              <div style="margin-left:auto; display:flex; align-items:center; gap:8px;">
                <span class="sync-badge-pill ${syncClient.isPaired() ? 'connected' : 'disconnected'}">
                  ${syncClient.isPaired() ? 'Connected' : 'Not Paired'}
                </span>
                <div class="apple-row-chevron">${SETTINGS_ICONS.chevron}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Passwords & Browser Data Import Section -->
        <div>
          <div class="subpage-section-title">Passwords & Data Import</div>
          <div class="apple-grouped-table">
            <div class="apple-grouped-row" id="settings-passwords-row">
              <div class="apple-row-icon mono-item">
                ${SETTINGS_ICONS.key}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Passwords & Logins</div>
                <div class="apple-row-subtitle">${passwordsCount > 0 ? passwordsCount + ' saved accounts' : 'Manage and copy saved passwords'}</div>
              </div>
              <div class="apple-row-chevron">${SETTINGS_ICONS.chevron}</div>
            </div>

            <div class="apple-grouped-row" id="settings-import-bm-row">
              <div class="apple-row-icon mono-item">
                ${SETTINGS_ICONS.bookmark}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Import Bookmarks</div>
                <div class="apple-row-subtitle">From Chrome, Firefox, Safari HTML/JSON</div>
              </div>
              <div class="apple-row-chevron">${SETTINGS_ICONS.chevron}</div>
            </div>

            <div class="apple-grouped-row" id="settings-import-pwd-row">
              <div class="apple-row-icon mono-item">
                ${SETTINGS_ICONS.import}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Import Passwords</div>
                <div class="apple-row-subtitle">From Chrome, Firefox, Edge, Safari CSV</div>
              </div>
              <div class="apple-row-chevron">${SETTINGS_ICONS.chevron}</div>
            </div>

            <div class="apple-grouped-row" id="settings-export-bm-row">
              <div class="apple-row-icon mono-item">
                ${SETTINGS_ICONS.export}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Export Bookmarks</div>
                <div class="apple-row-subtitle">Download HTML backup of bookmarks</div>
              </div>
              <div class="apple-row-chevron">${SETTINGS_ICONS.chevron}</div>
            </div>
          </div>
        </div>

        <!-- About Section -->
        <div>
          <div class="subpage-section-title">About</div>
          <div class="apple-grouped-table">
            <div class="apple-grouped-row" style="cursor:default;">
              <div class="apple-row-icon mono-copilot">
                ${SETTINGS_ICONS.compass}
              </div>
              <div class="apple-row-content">
                <div class="apple-row-title">Ocal Mobile Browser</div>
                <div class="apple-row-subtitle">Version 1.0.4 (WebKit Modern Engine)</div>
              </div>
              <span style="font-size:11.5px; font-weight:600; color:var(--text-subtle); padding:3px 8px; border-radius:6px; background:rgba(0,0,0,0.05);">v1.0.4</span>
            </div>
          </div>
        </div>
      </div>

      <input type="file" id="settings-bm-file-input" accept=".html,.htm,.json" style="display:none;" />
      <input type="file" id="settings-pwd-file-input" accept=".csv,.json,.txt" style="display:none;" />
    `;

    container.querySelector('#settings-back-btn')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('ocal://home');
    });
    container.querySelector('#settings-done-btn')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('ocal://home');
    });

    // Passwords subpage row
    container.querySelector('#settings-passwords-row')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('ocal://passwords');
    });

    // Ocal Connect / Sync subpage row
    container.querySelector('#settings-sync-row')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('ocal://sync');
    });

    // AI Key config row
    container.querySelector('#settings-ai-key-row')?.addEventListener('click', () => {
      window.ocalApp?.copilotDrawer?.open?.(true);
    });

    // Import Bookmarks from Settings
    const settingsBmFile = container.querySelector('#settings-bm-file-input');
    container.querySelector('#settings-import-bm-row')?.addEventListener('click', () => {
      settingsBmFile?.click();
    });
    settingsBmFile?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const content = evt.target.result;
          let result;
          if (file.name.toLowerCase().endsWith('.json')) {
            result = DataImporter.parseBookmarksJson(content);
          } else {
            result = DataImporter.parseBookmarksHtml(content);
          }
          window.ocalApp?.showToast?.(`Imported ${result.added} new bookmarks!`, 'check');
          window.ocalApp?.checkCurrentTabBookmarked?.();
        } catch (err) {
          alert('Failed to import bookmarks: ' + (err.message || 'Invalid format'));
        }
      };
      reader.readAsText(file);
    });

    // Import Passwords from Settings
    const settingsPwdFile = container.querySelector('#settings-pwd-file-input');
    container.querySelector('#settings-import-pwd-row')?.addEventListener('click', () => {
      settingsPwdFile?.click();
    });
    settingsPwdFile?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const content = evt.target.result;
          let result;
          if (file.name.toLowerCase().endsWith('.json')) {
            result = DataImporter.parsePasswordsJson(content);
          } else {
            result = DataImporter.parsePasswordsCsv(content);
          }
          window.ocalApp?.showToast?.(`Imported ${result.added} passwords!`, 'check');
          if (onNavigate) onNavigate('ocal://passwords');
        } catch (err) {
          alert('Failed to import passwords: ' + (err.message || 'Invalid format'));
        }
      };
      reader.readAsText(file);
    });

    // Export Bookmarks from Settings
    container.querySelector('#settings-export-bm-row')?.addEventListener('click', () => {
      const count = DataImporter.exportBookmarksHtml();
      window.ocalApp?.showToast?.(`Exported ${count} bookmarks to file`, 'download');
    });

    container.querySelector('#theme-toggle')?.addEventListener('change', (e) => {
      const t = e.target.checked ? 'dark' : 'light';
      localStorage.setItem('ocal-theme', t);
      document.documentElement.setAttribute('data-theme', t);
      if (window.ocalApp?.updateStatusBarTheme) {
        window.ocalApp.updateStatusBarTheme(t === 'dark');
      }
    });

    // Helper to calculate rgba
    // Live Blur Density & Global Glass Blur updates
    const applyBlur = (val) => {
      const num = Math.max(0, parseInt(val, 10) || 0);
      const px = `${num}px`;
      localStorage.setItem('ocal-blur-density', num);
      localStorage.setItem('ocal-blur-enabled', num > 0 ? 'true' : 'false');

      // Update global CSS variables on :root
      document.documentElement.style.setProperty('--app-blur-val', px);
      document.documentElement.style.setProperty('--dock-blur-val', px);
      document.documentElement.style.setProperty('--capsule-blur-val', px);
      document.documentElement.style.setProperty('--sheet-blur-val', px);
      document.documentElement.style.setProperty('--popover-blur-val', px);

      // Toggle solid mode vs glass blur mode across whole app
      if (num === 0) {
        document.documentElement.classList.add('glass-blur-disabled');
        document.documentElement.setAttribute('data-blur', '0');
      } else {
        document.documentElement.classList.remove('glass-blur-disabled');
        document.documentElement.removeAttribute('data-blur');
      }

      // Update UI in settings
      const display = container.querySelector('#blur-val-display');
      if (display) display.textContent = num === 0 ? 'Off (0px)' : px;

      const slider = container.querySelector('#blur-range-slider');
      if (slider) slider.value = num;

      const masterToggle = container.querySelector('#blur-master-toggle');
      if (masterToggle) masterToggle.checked = num > 0;

      container.querySelectorAll('#blur-preset-chips .blur-chip-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.getAttribute('data-blur'), 10) === num);
      });
    };

    container.querySelector('#blur-master-toggle')?.addEventListener('change', (e) => {
      if (e.target.checked) {
        applyBlur(24);
      } else {
        applyBlur(0);
      }
    });

    container.querySelectorAll('.blur-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const blur = btn.getAttribute('data-blur');
        if (blur !== null) applyBlur(blur);
      });
    });

    container.querySelector('#blur-range-slider')?.addEventListener('input', (e) => {
      applyBlur(e.target.value);
    });

    container.querySelector('#toggle-shield-adblock')?.addEventListener('change', (e) => {
      localStorage.setItem('ocal-shield-adblock', e.target.checked);
    });

    container.querySelector('#toggle-shield-https')?.addEventListener('change', (e) => {
      localStorage.setItem('ocal-shield-https', e.target.checked);
    });

    container.querySelector('#toggle-suggestions')?.addEventListener('change', (e) => {
      localStorage.setItem('ocal-suggestions', e.target.checked);
    });

    container.querySelector('#toggle-desktop-default')?.addEventListener('change', (e) => {
      localStorage.setItem('ocal-desktop-default', e.target.checked);
    });

    container.querySelectorAll('.engine-pick-row').forEach(row => {
      row.addEventListener('click', () => {
        const eng = row.getAttribute('data-eng');
        localStorage.setItem('ocal-engine', eng);
        if (onNavigate) onNavigate('ocal://settings');
      });
    });

    container.querySelector('#clear-all-data-row')?.addEventListener('click', () => {
      if (confirm('Clear all browsing history, cache, and open tabs?')) {
        localStorage.removeItem('ocal-history');
        localStorage.removeItem('ocal-trackers-blocked');
        localStorage.removeItem('ocal-ads-blocked');
        alert('Browsing data and cache cleared successfully.');
        if (onNavigate) onNavigate('ocal://home');
      }
    });

    return container;
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatSmartHistoryItem(item) {
  let title = item.title || '';
  let url = item.url || '';
  let domain = '';
  let isSearch = false;
  let query = '';

  try {
    const u = new URL(url);
    domain = u.hostname.replace(/^(www\.|html\.)/i, '');
    const q = u.searchParams.get('q');
    if (q && (u.pathname.includes('/search') || u.pathname.includes('/html') || domain.includes('google') || domain.includes('duckduckgo') || domain.includes('bing') || domain.includes('brave'))) {
      isSearch = true;
      try {
        query = decodeURIComponent(q.replace(/\+/g, ' '));
      } catch {
        query = q;
      }
      title = query;
    } else if (!title || title === 'Start Page' || title.startsWith('Ocal ') || title === 'Untitled Tab') {
      const path = u.pathname !== '/' ? u.pathname.split('/').filter(Boolean)[0] : '';
      title = path ? `${domain} / ${path}` : domain;
    }
  } catch {
    domain = url.replace(/^https?:\/\//i, '').split('/')[0];
    if (!title || title === 'Start Page' || title.startsWith('Ocal ')) title = domain || url;
  }

  // Format relative time
  let timeStr = 'Recent';
  if (item.timestamp) {
    const diffMin = Math.floor((Date.now() - item.timestamp) / 60000);
    if (diffMin < 1) timeStr = 'Just now';
    else if (diffMin < 60) timeStr = `${diffMin}m ago`;
    else if (diffMin < 1440) timeStr = `${Math.floor(diffMin / 60)}h ago`;
    else timeStr = `${Math.floor(diffMin / 1440)}d ago`;
  }

  return { title, url, domain, isSearch, query, timeStr };
}
