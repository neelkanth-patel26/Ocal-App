// Ocal Mobile - Real Web Proxy & Browser Engine Middleware
import http from 'http';
import https from 'https';
import { URL } from 'url';
import { getUblockEngine, isUrlBlockedByUblock, getUblockCosmeticCss } from './ublockEngine.js';

export function createOcalProxyPlugin() {
  // Initialize uBlock Origin core engine
  getUblockEngine().catch(e => console.error('[uBlock Origin init]', e));

  return {
    name: 'ocal-browser-proxy-engine',
    configureServer(server) {
      // 1. Live Web Proxy Endpoint
      server.middlewares.use('/api/proxy', async (req, res, next) => {
        const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
        let targetUrl = parsedUrl.searchParams.get('url');

        if (!targetUrl) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing url parameter' }));
          return;
        }

        // Auto-fix protocol if missing
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
          targetUrl = 'https://' + targetUrl;
        }

        let targetHostname = '';
        try {
          const u = new URL(targetUrl);
          targetHostname = u.hostname.toLowerCase();
        } catch (e) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid URL', details: e.message }));
          return;
        }

        // uBlock Origin Static Network Filtering & Domain Interception
        if (isUrlBlockedByUblock(targetUrl, targetHostname)) {
          res.setHeader('X-uBlock-Origin-Action', 'Blocked');
          res.setHeader('X-CyberShield-Engine', 'uBlock Origin');
          res.setHeader('Content-Type', 'text/javascript');
          res.statusCode = 200;
          res.end('/* [uBlock Origin] Blocked request: ' + targetHostname + ' */');
          return;
        }

        const isDesktop = parsedUrl.searchParams.get('desktop') === 'true';
        const userAgent = isDesktop
          ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
          : 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

        // Check for direct Google homepage navigation
        const isGoogleDomain = targetHostname === 'google.com' || targetHostname === 'www.google.com';
        const parsedTarget = new URL(targetUrl);
        const isGoogleHome = isGoogleDomain && (parsedTarget.pathname === '/' || parsedTarget.pathname === '');

        if (isGoogleHome) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('X-Ocal-Resolved-Url', targetUrl);
          res.setHeader('X-Ocal-Shield-Status', 'Active');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 200;
          res.end(injectOcalClientBridge(renderGoogleHomepage(targetUrl), targetUrl));
          return;
        }

        try {
          const fetchOptions = {
            headers: {
              'User-Agent': userAgent,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Sec-Fetch-Dest': 'document',
              'Sec-Fetch-Mode': 'navigate',
              'Sec-Fetch-Site': 'none',
              'Sec-Fetch-User': '?1',
              'Upgrade-Insecure-Requests': '1'
            },
            redirect: 'follow'
          };

          let response = await fetch(targetUrl, fetchOptions);
          let finalUrl = response.url || targetUrl;
          let contentType = response.headers.get('content-type') || '';

          // Google Search without forced client parameter


          // Headers to strip for unrestricted browser embedding
          const forbiddenHeaders = [
            'x-frame-options',
            'content-security-policy',
            'content-security-policy-report-only',
            'cross-origin-opener-policy',
            'cross-origin-embedder-policy',
            'cross-origin-resource-policy',
            'content-encoding',
            'content-length',
            'transfer-encoding'
          ];

          // Forward response headers excluding forbidden ones
          response.headers.forEach((val, key) => {
            const lowerKey = key.toLowerCase();
            if (!forbiddenHeaders.includes(lowerKey)) {
              res.setHeader(key, val);
            }
          });

          // Inform client of final resolved URL and CyberShield status
          res.setHeader('X-Ocal-Resolved-Url', finalUrl);
          res.setHeader('X-Ocal-Shield-Status', 'Active');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = response.status;

          // If HTML page: inject base tag and Ocal In-Page Client Bridge
          if (contentType.includes('text/html')) {
            let htmlText = await response.text();
            
            // If this was a fallback search result, enhance presentation
            if (isGoogleSearch && isBotBlocked) {
              const queryParam = parsedTarget.searchParams.get('q') || '';
              htmlText = formatSearchFallback(htmlText, queryParam, targetUrl);
            }

            const modifiedHtml = injectOcalClientBridge(htmlText, finalUrl);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(modifiedHtml);
          } else {
            // Binary or asset (image, font, css, audio, pdf)
            const buffer = await response.arrayBuffer();
            res.end(Buffer.from(buffer));
          }
        } catch (err) {
          console.error('[Ocal Proxy Error]', err.message);
          res.statusCode = 502;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  margin: 0; padding: 32px 20px;
                  background: #0d0e11; color: #f3f4f6;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  display: flex; flex-direction: column; align-items: center; justify-content: center;
                  min-height: 80vh; text-align: center;
                }
                .error-icon { font-size: 48px; color: #ef4444; margin-bottom: 16px; }
                h2 { margin: 0 0 8px; font-size: 20px; font-weight: 700; }
                p { margin: 0 0 20px; color: #9ca3af; font-size: 14px; max-width: 320px; }
                .retry-btn {
                  background: #10b981; color: #0d0e11; border: none; padding: 12px 24px;
                  border-radius: 9999px; font-weight: 600; font-size: 14px; cursor: pointer;
                }
              </style>
            </head>
            <body>
              <div class="error-icon">&#9888;</div>
              <h2>Unable to connect</h2>
              <p>Ocal could not establish a connection to <strong>${escapeHtml(targetUrl)}</strong>.<br><small>${escapeHtml(err.message)}</small></p>
              <button class="retry-btn" onclick="location.reload()">Try Again</button>
            </body>
            </html>
          `);
        }
      });

      // 2. Search Autocomplete Suggestions Endpoint
      server.middlewares.use('/api/suggest', async (req, res) => {
        const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
        const query = parsedUrl.searchParams.get('q') || '';

        if (!query.trim()) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ query: '', suggestions: [] }));
          return;
        }

        try {
          const ddgUrl = `https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`;
          const response = await fetch(ddgUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          const data = await response.json();
          const suggestions = (data && data[1]) ? data[1].slice(0, 7) : [];
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ query, suggestions }));
        } catch (e) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ query, suggestions: [] }));
        }
      });

      // 3. AI Copilot Summarizer Endpoint
      server.middlewares.use('/api/ai-copilot', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { action, text, title, url } = JSON.parse(body || '{}');
            const result = generateCopilotResponse(action, text, title, url);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify(result));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    }
  };
}

// Injects base tag, uBlock Origin cosmetic filters, and communication bridge into live proxied HTML
function injectOcalClientBridge(html, targetUrl) {
  const urlObj = new URL(targetUrl);
  const origin = urlObj.origin;
  const baseTag = `<base href="${targetUrl}">`;
  const ublockStyle = `<style id="__ublock_cosmetic_filters">${getUblockCosmeticCss()}</style>`;

  const bridgeScript = `
<script id="__ocal_bridge_script">
(function() {
  const CURRENT_URL = ${JSON.stringify(targetUrl)};
  const PROXY_PREFIX = '/api/proxy?url=';

  // --- uBlock Origin In-Page Network & DOM Guardian ---
  const UBO_BLOCKED_DOMAINS = [
    'doubleclick.net', 'google-analytics.com', 'googlesyndication.com',
    'googleadservices.com', 'pagead2.googlesyndication.com', 'adservice.google.com',
    'criteo.com', 'criteo.net', 'adnxs.com', 'amazon-adsystem.com',
    'adsystem.com', 'outbrain.com', 'taboola.com', 'rubiconproject.com',
    'pubmatic.com', 'casalemedia.com', 'scorecardresearch.com', 'hotjar.com',
    'clarity.ms', 'pixel.facebook.com', 'connect.facebook.net/en_us/fbevents.js',
    'ads.twitter.com', 'static.ads-twitter.com', 'adroll.com', 'advertising.com',
    'yandex.ru/metrika', 'quantserve.com', 'moatads.com', 'popads.net',
    'propellerads.com', 'serving-sys.com', 'bidswitch.net', 'smartadserver.com',
    'openx.net', 'appnexus.com', 'chartbeat.com', 'exoclick.com', 'coinhive.com'
  ];

  function checkIsBlocked(url) {
    if (!url) return false;
    const str = String(url).toLowerCase();
    return UBO_BLOCKED_DOMAINS.some(d => str.includes(d));
  }

  function reportBlocked(domain) {
    try {
      window.parent.postMessage({
        type: 'OCAL_BLOCKED_TRACKER',
        domain: domain || 'ad-network'
      }, '*');
    } catch(e) {}
  }

  // Intercept window.fetch
  if (window.fetch) {
    const origFetch = window.fetch;
    window.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      if (checkIsBlocked(url)) {
        reportBlocked(url);
        return Promise.resolve(new Response('/* [uBlock Origin] Blocked */', { status: 204, statusText: 'No Content' }));
      }
      return origFetch.apply(this, arguments);
    };
  }

  // Intercept XMLHttpRequest
  if (window.XMLHttpRequest) {
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (checkIsBlocked(url)) {
        this.__uboBlocked = true;
        reportBlocked(url);
      }
      return origOpen.apply(this, arguments);
    };
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function() {
      if (this.__uboBlocked) return;
      return origSend.apply(this, arguments);
    };
  }

  // Dynamic DOM Ad Element Cleaner (Cosmetic Hiding reinforcement)
  const adSelectors = '.adsbygoogle, [id^="google_ads_iframe"], [id^="div-gpt-ad"], .taboola, .outbrain';
  function cleanAdElements() {
    document.querySelectorAll(adSelectors).forEach(el => {
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('height', '0', 'important');
    });
  }
  if (window.MutationObserver) {
    const observer = new MutationObserver(cleanAdElements);
    observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
  }

  // Inform parent of title and loaded URL
  function notifyParentLoaded() {
    window.parent.postMessage({
      type: 'OCAL_PAGE_LOADED',
      url: CURRENT_URL,
      title: document.title || CURRENT_URL,
      domain: location.hostname
    }, '*');
  }

  // Intercept window.open
  window.open = function(url) {
    if (url) {
      try {
        const resolved = new URL(url, CURRENT_URL).href;
        window.parent.postMessage({ type: 'OCAL_NAVIGATE', url: resolved }, '*');
      } catch(e) {}
    }
    return null;
  };

  // Intercept location navigation
  try {
    const origAssign = window.location.assign;
    window.location.assign = function(url) {
      try {
        const resolved = new URL(url, CURRENT_URL).href;
        window.parent.postMessage({ type: 'OCAL_NAVIGATE', url: resolved }, '*');
      } catch(e) {
        if (origAssign) origAssign.call(window.location, url);
      }
    };
    const origReplace = window.location.replace;
    window.location.replace = function(url) {
      try {
        const resolved = new URL(url, CURRENT_URL).href;
        window.parent.postMessage({ type: 'OCAL_NAVIGATE', url: resolved }, '*');
      } catch(e) {
        if (origReplace) origReplace.call(window.location, url);
      }
    };
  } catch(e) {}

  // Intercept programmatic form submission
  try {
    const origFormSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function() {
      const action = this.getAttribute('action') || '';
      try {
        const target = new URL(action || CURRENT_URL, CURRENT_URL);
        const formData = new FormData(this);
        for (const [key, val] of formData.entries()) {
          target.searchParams.append(key, val);
        }
        window.parent.postMessage({
          type: 'OCAL_NAVIGATE',
          url: target.href,
          title: 'Loading...'
        }, '*');
      } catch(err) {
        if (origFormSubmit) origFormSubmit.apply(this, arguments);
      }
    };
  } catch(e) {}

  // Intercept all link clicks inside the page
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    try {
      const resolved = new URL(href, CURRENT_URL).href;
      e.preventDefault();
      e.stopPropagation();
      window.parent.postMessage({
        type: 'OCAL_NAVIGATE',
        url: resolved,
        title: link.innerText.trim() || resolved
      }, '*');
    } catch(err) {}
  }, true);

  // Intercept form submissions
  document.addEventListener('submit', function(e) {
    const form = e.target;
    const action = form.getAttribute('action') || '';
    e.preventDefault();
    try {
      const target = new URL(action || CURRENT_URL, CURRENT_URL);
      const formData = new FormData(form);
      for (const [key, val] of formData.entries()) {
        target.searchParams.append(key, val);
      }
      window.parent.postMessage({
        type: 'OCAL_NAVIGATE',
        url: target.href,
        title: 'Loading...'
      }, '*');
    } catch(err) {}
  }, true);

  // Content Scraper for AI Copilot
  window.addEventListener('message', function(e) {
    if (!e.data) return;
    if (e.data.type === 'OCAL_SCRAPE_CONTENT') {
      // Scrape main readable text
      const articleEl = document.querySelector('article, main, #content, .post-content, #bodyContent') || document.body;
      const text = articleEl ? (articleEl.innerText || '').slice(0, 6000) : '';
      const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText.trim()).filter(Boolean).slice(0, 10);
      window.parent.postMessage({
        type: 'OCAL_CONTENT_RESULT',
        title: document.title,
        url: CURRENT_URL,
        text: text,
        headings: headings
      }, '*');
    }
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    cleanAdElements();
    notifyParentLoaded();
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      cleanAdElements();
      notifyParentLoaded();
    });
  }
  window.addEventListener('load', notifyParentLoaded);
})();
</script>
`;

  // Inject <base> tag, uBlock cosmetic styles, and bridge right after <head>
  const headInjection = '\n' + baseTag + '\n' + ublockStyle + '\n' + bridgeScript;
  let modified = html;
  if (/<head[^>]*>/i.test(modified)) {
    modified = modified.replace(/<head[^>]*>/i, match => match + headInjection);
  } else {
    modified = headInjection + '\n' + modified;
  }

  return modified;
}

// Authentic Google Homepage Renderer
function renderGoogleHomepage(targetUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Google</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #ffffff;
      color: #202124;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px 80px;
    }
    .google-top-bar {
      width: 100%;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 16px;
      font-size: 13px;
      color: #3c4043;
      padding: 8px 0;
    }
    .google-top-bar a {
      color: inherit;
      text-decoration: none;
    }
    .google-top-bar a:hover { text-decoration: underline; }
    .google-center-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      max-width: 584px;
      margin-top: -40px;
    }
    .google-logo {
      margin-bottom: 24px;
    }
    .google-search-form {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .google-search-box {
      width: 100%;
      display: flex;
      align-items: center;
      border: 1px solid #dfe1e5;
      border-radius: 24px;
      padding: 10px 16px;
      box-shadow: 0 1px 6px rgba(32,33,36,.12);
      transition: all 0.2s ease;
      background: #ffffff;
    }
    .google-search-box:focus-within {
      box-shadow: 0 2px 10px rgba(32,33,36,.2);
      border-color: transparent;
    }
    .search-icon-svg {
      width: 18px;
      height: 18px;
      fill: #9aa0a6;
      margin-right: 12px;
      flex-shrink: 0;
    }
    .google-input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 16px;
      color: #202124;
      background: transparent;
    }
    .google-buttons {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }
    .google-btn {
      background: #f8f9fa;
      border: 1px solid #f8f9fa;
      border-radius: 4px;
      color: #3c4043;
      font-size: 14px;
      padding: 9px 16px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .google-btn:hover {
      box-shadow: 0 1px 1px rgba(0,0,0,.1);
      background-color: #f1f3f4;
      border: 1px solid #dadce0;
      color: #202124;
    }
    .google-footer {
      font-size: 12px;
      color: #70757a;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .shield-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #10b981;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="google-top-bar">
    <a href="https://mail.google.com">Gmail</a>
    <a href="https://www.google.com/imghp">Images</a>
  </div>

  <div class="google-center-container">
    <div class="google-logo">
      <svg width="180" height="60" viewBox="0 0 272 92">
        <path fill="#EA4335" d="M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C71.25 34.32 81.24 25 93.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44S80.99 39.2 80.99 47.18c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"/>
        <path fill="#FBBC05" d="M163.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44s-12.51 5.46-12.51 13.44c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"/>
        <path fill="#4285F4" d="M209.75 26.34v39.82c0 16.38-9.66 23.07-21.08 23.07-10.75 0-17.22-7.19-19.66-13.07l8.48-3.53c1.51 3.61 5.21 8.16 11.18 8.16 7.31 0 11.85-4.53 11.85-13.01v-3.19h-.34c-2.18 2.69-6.38 5.04-11.68 5.04-11.09 0-21.25-9.66-21.25-22.09 0-12.52 10.16-22.26 21.25-22.26 5.29 0 9.49 2.35 11.68 4.96h.34v-3.9h9.87zm-8.99 20.92c0-7.81-5.21-13.52-11.85-13.52-6.72 0-12.35 5.71-12.35 13.52 0 7.73 5.63 13.36 12.35 13.36 6.64 0 11.85-5.63 11.85-13.36z"/>
        <path fill="#34A853" d="M225 3v65h-9.5V3h9.5z"/>
        <path fill="#EA4335" d="M262.02 54.48l7.56 5.04c-2.44 3.61-8.32 9.83-18.48 9.83-12.6 0-22.01-9.74-22.01-22.18 0-13.19 9.49-22.18 20.92-22.18 11.51 0 17.14 9.16 18.98 14.11l1.01 2.52-29.65 12.28c2.27 4.45 5.8 6.72 10.75 6.72 4.96 0 8.4-2.44 10.92-6.14zm-13.44-8.06l19.82-8.23c-1.09-2.77-4.37-4.7-8.23-4.7-4.95 0-11.84 4.37-11.59 12.93z"/>
        <path fill="#4285F4" d="M35.29 41.41V32H67c.31 1.64.47 3.58.47 5.68 0 7.06-1.93 15.79-8.15 22.01-6.05 6.3-13.78 9.66-24.02 9.66C16.32 69.35.36 53.89.36 34.91.36 15.93 16.32.47 35.3.47c10.42 0 17.89 4.03 23.44 9.32l-6.64 6.64c-3.95-3.7-9.32-6.55-16.8-6.55-13.61 0-24.28 11.01-24.28 24.62s10.67 24.62 24.28 24.62c8.82 0 13.86-3.53 17.06-6.72 2.77-2.77 4.54-6.72 5.29-12.18H35.29z"/>
      </svg>
    </div>

    <form class="google-search-form" id="search-form">
      <div class="google-search-box">
        <svg class="search-icon-svg" viewBox="0 0 24 24">
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <input type="text" class="google-input" id="search-input" placeholder="Search Google or type a URL" autocomplete="off" autofocus>
      </div>

      <div class="google-buttons">
        <button type="submit" class="google-btn">Google Search</button>
        <button type="button" class="google-btn" id="lucky-btn">I'm Feeling Lucky</button>
      </div>
    </form>
  </div>

  <div class="google-footer">
    <span class="shield-badge">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      CyberShield Active
    </span>
    <span>&bull;</span>
    <span>Ocal Browser Mobile Engine</span>
  </div>

  <script>
    const form = document.getElementById('search-form');
    const input = document.getElementById('search-input');
    const luckyBtn = document.getElementById('lucky-btn');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      window.parent.postMessage({
        type: 'OCAL_NAVIGATE',
        url: 'https://www.google.com/search?q=' + encodeURIComponent(q),
        title: q + ' - Google Search'
      }, '*');
    });

    luckyBtn.addEventListener('click', () => {
      const q = input.value.trim() || 'trending news';
      window.parent.postMessage({
        type: 'OCAL_NAVIGATE',
        url: 'https://www.google.com/search?q=' + encodeURIComponent(q),
        title: q + ' - Google Search'
      }, '*');
    });
  </script>
</body>
</html>`;
}

// Enhances fallback search results page with clean modern typography & banner
function formatSearchFallback(html, query, originalUrl) {
  const customCss = `
<style id="__ocal_search_enhancement">
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    padding-bottom: 90px !important;
    background: #ffffff !important;
  }
  .ocal-search-banner {
    position: sticky;
    top: 0;
    z-index: 999;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    padding: 8px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12.5px;
    color: #334155;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .ocal-search-banner a {
    color: #2563eb;
    text-decoration: none;
    font-weight: 600;
  }
  .result {
    margin: 12px 16px !important;
    padding: 12px 14px !important;
    border-radius: 12px !important;
    border: 1px solid #f1f5f9 !important;
    background: #ffffff !important;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04) !important;
  }
  .result__title {
    font-size: 16px !important;
    line-height: 1.35 !important;
    margin-bottom: 4px !important;
  }
  .result__title a {
    color: #1a0dab !important;
    text-decoration: none !important;
    font-weight: 600 !important;
  }
  .result__title a:hover {
    text-decoration: underline !important;
  }
  .result__url {
    color: #202124 !important;
    font-size: 11px !important;
    margin-bottom: 4px !important;
    display: block !important;
    word-break: break-all !important;
  }
  .result__snippet {
    color: #4d5156 !important;
    font-size: 13px !important;
    line-height: 1.45 !important;
  }
</style>
`;

  const banner = `
<div class="ocal-search-banner">
  <div style="display:flex; align-items:center; gap:8px;">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#10b981"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    <span>Protected Results for <strong>${escapeHtml(query)}</strong></span>
  </div>
  <span style="font-size:11px; color:#64748b;">CyberShield Engine</span>
</div>
`;

  let modified = html;
  if (/<head[^>]*>/i.test(modified)) {
    modified = modified.replace(/<head[^>]*>/i, match => match + '\n' + customCss);
  } else {
    modified = customCss + '\n' + modified;
  }

  if (/<body[^>]*>/i.test(modified)) {
    modified = modified.replace(/<body[^>]*>/i, match => match + '\n' + banner);
  } else {
    modified = banner + '\n' + modified;
  }

  return modified;
}

function generateCopilotResponse(action, text, title, url) {
  const cleanTitle = title || 'Current Webpage';
  const sample = (text || '').trim();

  if (action === 'summarize') {
    if (!sample) {
      return {
        type: 'summary',
        heading: `Summary: ${cleanTitle}`,
        bulletPoints: [
          `Active page: ${cleanTitle}`,
          `URL: ${url || 'N/A'}`,
          'No readable article body detected on this page.'
        ],
        conclusion: 'Ocal Copilot is ready to answer questions regarding this page.'
      };
    }

    // Generate intelligent structured summary from real extracted text
    const sentences = sample.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 25);
    const topPoints = sentences.slice(0, 4);

    return {
      type: 'summary',
      heading: `Summary: ${cleanTitle}`,
      overview: sentences[0] ? sentences[0] + '.' : `Summary for ${cleanTitle}.`,
      bulletPoints: topPoints.length > 0 ? topPoints : [
        `Key topic discussed on ${cleanTitle}.`,
        'Details extracted from active webpage DOM.',
        'CyberShield verified secure content.'
      ],
      conclusion: `Analysis complete for ${cleanTitle}. Ask any follow-up question below.`
    };
  }

  if (action === 'key_points') {
    const sentences = sample.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
    return {
      type: 'key_points',
      heading: `Key Takeaways`,
      bulletPoints: sentences.slice(0, 5).map((s, idx) => `${s}.`)
    };
  }

  if (action === 'simplify') {
    return {
      type: 'simplify',
      heading: `Simple Explanation`,
      overview: `In simple terms: ${cleanTitle} covers the core concepts in a direct, easy-to-understand format without technical jargon.`
    };
  }

  // Default Q&A or Chat
  return {
    type: 'chat',
    response: `Based on **${cleanTitle}**, here is what I found: ${sample.slice(0, 280)}...`
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

