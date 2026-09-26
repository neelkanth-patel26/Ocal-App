// Ocal AI Copilot Mobile Drawer with Real Gemini / OpenAI Intelligence
export class CopilotDrawer {
  constructor({ containerEl, getActiveTab }) {
    this.container = containerEl;
    this.getActiveTab = getActiveTab;
    this.history = [];
    this.pendingAction = null;
    this.setupListeners();
  }

  setupListeners() {
    // Web iframe bridge fallback
    window.addEventListener('message', (e) => {
      if (!e.data || e.data.type !== 'OCAL_CONTENT_RESULT') return;
      if (this.pendingAction) {
        this.processActionWithContent(this.pendingAction, e.data);
        this.pendingAction = null;
      }
    });
  }

  getApiKey() {
    return (localStorage.getItem('ocal_ai_api_key') || '').trim();
  }

  setApiKey(key) {
    if (key) {
      localStorage.setItem('ocal_ai_api_key', key.trim());
    } else {
      localStorage.removeItem('ocal_ai_api_key');
    }
  }

  open(forceKeyPrompt = false) {
    document.querySelectorAll('.bottom-sheet').forEach(s => s.classList.remove('visible'));
    const apiKey = this.getApiKey();

    if (!apiKey || forceKeyPrompt) {
      this.renderKeyPromptView(Boolean(apiKey));
    } else {
      this.renderMainCopilotView();
    }

    if (window.OcalNative) window.OcalNative.setWebVisible(false);
    this.container.classList.add('visible');
    document.getElementById('drawer-backdrop')?.classList.add('visible');
  }

  close() {
    this.container.classList.remove('visible');
    document.getElementById('drawer-backdrop')?.classList.remove('visible');
    if (window.ocalApp) window.ocalApp.syncNativeWebVisibility();
  }

  renderKeyPromptView(hasExistingKey = false) {
    const existingKey = this.getApiKey();
    this.container.innerHTML = `
      <div class="sheet-handle-bar"><div class="sheet-handle"></div></div>
      <div class="sheet-header">
        <div class="sheet-title" style="display:flex; align-items:center; gap:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/><path d="M19 3v4"/><path d="M21 5h-4"/></svg>
          <span>${hasExistingKey ? 'Configure AI Key' : 'Activate Ocal Copilot'}</span>
        </div>
        <button class="icon-btn" id="copilot-close-btn"><i class="fas fa-times"></i></button>
      </div>
      <div class="sheet-content">
        <div class="copilot-key-prompt-card">
          <div class="copilot-key-badge"><i class="fas fa-sparkles"></i> Free Google AI Studio Key</div>
          <h3>${hasExistingKey ? 'Update API Key' : 'Connect Your AI Key'}</h3>
          <p>Ocal Copilot uses AI to summarize articles, find answers, and explain pages. Get a 100% free Google Gemini API key from Google AI Studio.</p>

          <button class="copilot-get-key-btn" id="copilot-open-aistudio-btn">
            <i class="fas fa-key"></i> Get Free Gemini API Key <i class="fas fa-arrow-up-right-from-square" style="font-size:11px; margin-left:4px;"></i>
          </button>
          <div class="copilot-key-hint">Takes ~30 seconds • Free from Google (or use OpenAI / Groq)</div>

          <div class="copilot-key-input-group">
            <input type="password" id="copilot-key-field" value="${this.escapeHtml(existingKey)}" placeholder="Paste API Key (AIzaSy... / sk-...)">
            <button class="copilot-key-toggle-btn" id="copilot-toggle-key-eye" type="button"><i class="fas fa-eye"></i></button>
          </div>

          <div class="copilot-key-actions">
            <button class="copilot-save-key-btn" id="copilot-save-key-btn">
              <i class="fas fa-check"></i> ${hasExistingKey ? 'Save Key' : 'Activate Copilot'}
            </button>
            ${hasExistingKey ? '<button class="copilot-clear-key-btn" id="copilot-clear-key-btn">Remove</button>' : ''}
          </div>
          <div class="copilot-privacy-note">
            <i class="fas fa-lock"></i> Your key is stored securely on your device only.
          </div>
        </div>
      </div>
    `;

    this.container.querySelector('#copilot-close-btn')?.addEventListener('click', () => this.close());

    // Open Google AI Studio button
    this.container.querySelector('#copilot-open-aistudio-btn')?.addEventListener('click', () => {
      const url = 'https://aistudio.google.com/app/apikey';
      if (window.ocalApp?.tabManager) {
        this.close();
        const tab = window.ocalApp.tabManager.createTab(url);
        window.ocalApp.tabManager.navigateTab(tab.id, url);
      } else {
        window.open(url, '_blank');
      }
    });

    // Toggle password visibility
    const keyInput = this.container.querySelector('#copilot-key-field');
    const eyeBtn = this.container.querySelector('#copilot-toggle-key-eye');
    eyeBtn?.addEventListener('click', () => {
      if (keyInput.type === 'password') {
        keyInput.type = 'text';
        eyeBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
      } else {
        keyInput.type = 'password';
        eyeBtn.innerHTML = '<i class="fas fa-eye"></i>';
      }
    });

    // Save key
    this.container.querySelector('#copilot-save-key-btn')?.addEventListener('click', () => {
      const val = keyInput.value.trim();
      if (!val) {
        alert('Please paste a valid API key (e.g. from Google AI Studio).');
        return;
      }
      this.setApiKey(val);
      this.renderMainCopilotView();
    });

    // Clear key if already set
    this.container.querySelector('#copilot-clear-key-btn')?.addEventListener('click', () => {
      if (confirm('Remove saved AI API key?')) {
        this.setApiKey('');
        this.renderKeyPromptView(false);
      }
    });
  }

  renderMainCopilotView() {
    const activeTab = this.getActiveTab ? this.getActiveTab() : null;
    const currentTitle = activeTab ? (activeTab.title || 'Current Webpage') : 'Current Webpage';

    this.container.innerHTML = `
      <div class="sheet-handle-bar"><div class="sheet-handle"></div></div>
      <div class="sheet-header">
        <div class="sheet-title" style="display:flex; align-items:center; gap:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/><path d="M19 3v4"/><path d="M21 5h-4"/></svg>
          <span>Ocal Copilot</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="copilot-key-config-btn" id="copilot-manage-key-btn" title="API Key Settings">
            <i class="fas fa-key"></i> Key
          </button>
          <button class="icon-btn" id="copilot-close-btn"><i class="fas fa-times"></i></button>
        </div>
      </div>
      <div class="sheet-content">
        <div class="copilot-pills-row">
          <button class="pill-chip" data-action="summarize"><i class="fas fa-file-alt"></i> Summarize Page</button>
          <button class="pill-chip" data-action="key_points"><i class="fas fa-list-check"></i> Key Points</button>
          <button class="pill-chip" data-action="simplify"><i class="fas fa-wand-magic-sparkles"></i> Simplify</button>
        </div>

        <div id="copilot-feed" class="copilot-feed-box">
          <div class="copilot-response-box">
            <h4><i class="fas fa-sparkles"></i> Ready to assist</h4>
            <p>I can summarize <strong>${this.escapeHtml(currentTitle)}</strong>, extract main takeaways, or answer questions about this page.</p>
          </div>
        </div>

        <div class="copilot-input-row">
          <input type="text" class="copilot-input" id="copilot-user-input" placeholder="Ask anything about this page...">
          <button class="copilot-send-btn" id="copilot-send-btn"><i class="fas fa-paper-plane"></i></button>
        </div>
      </div>
    `;

    this.container.querySelector('#copilot-close-btn')?.addEventListener('click', () => this.close());
    this.container.querySelector('#copilot-manage-key-btn')?.addEventListener('click', () => this.open(true));

    this.container.querySelectorAll('.pill-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.getAttribute('data-action');
        this.triggerCopilotAction(action);
      });
    });

    const input = this.container.querySelector('#copilot-user-input');
    const sendBtn = this.container.querySelector('#copilot-send-btn');

    const handleSend = () => {
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      this.triggerCustomQuery(q);
    };

    sendBtn?.addEventListener('click', handleSend);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSend();
    });
  }

  async getPageTextAndMetadata() {
    const activeTab = this.getActiveTab ? this.getActiveTab() : null;
    if (!activeTab) return { title: '', url: '', text: '' };

    if (activeTab.url.startsWith('ocal://')) {
      return {
        title: activeTab.title || 'Ocal Start Page',
        url: activeTab.url,
        text: 'This is the internal Ocal Browser start dashboard with bookmarks and shortcuts.'
      };
    }

    return new Promise((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({
            title: activeTab.title || '',
            url: activeTab.url || '',
            text: activeTab.title || ''
          });
        }
      }, 1400);

      // 1. Android Native WebView bridge
      if (window.OcalNative && typeof window.OcalNative.getPageContent === 'function') {
        window.onNativePageContent = (result) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            try {
              const data = typeof result === 'string' ? JSON.parse(result) : result;
              resolve({
                title: data?.title || activeTab.title || '',
                url: data?.url || activeTab.url || '',
                text: data?.text || activeTab.title || ''
              });
            } catch {
              resolve({ title: activeTab.title || '', url: activeTab.url || '', text: '' });
            }
          }
        };
        window.OcalNative.getPageContent();
        return;
      }

      // 2. Web Iframe Scraper fallback
      if (activeTab.frameEl && activeTab.frameEl.contentWindow) {
        const handler = (e) => {
          if (e.data && e.data.type === 'OCAL_CONTENT_RESULT') {
            window.removeEventListener('message', handler);
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve({
                title: e.data.title || activeTab.title || '',
                url: e.data.url || activeTab.url || '',
                text: e.data.text || activeTab.title || ''
              });
            }
          }
        };
        window.addEventListener('message', handler);
        try {
          activeTab.frameEl.contentWindow.postMessage({ type: 'OCAL_SCRAPE_CONTENT' }, '*');
        } catch {}
      }
    });
  }

  async triggerCopilotAction(action) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.renderKeyPromptView(false);
      return;
    }

    const feed = this.container.querySelector('#copilot-feed');
    const actionLabel = action === 'summarize' ? 'Summarizing page...' :
                        action === 'key_points' ? 'Extracting key takeaways...' :
                        'Simplifying explanation...';

    if (feed) {
      feed.innerHTML += `
        <div class="copilot-response-box" id="pending-reply">
          <h4><i class="fas fa-spinner fa-spin"></i> Ocal Copilot</h4>
          <p style="color:var(--text-muted);">${actionLabel}</p>
        </div>
      `;
      feed.scrollTop = feed.scrollHeight;
    }

    const pageData = await this.getPageTextAndMetadata();
    let prompt = '';

    if (action === 'summarize') {
      prompt = `You are Ocal Copilot, an AI assistant in Ocal Browser.
Summarize the following webpage:
Title: ${pageData.title}
URL: ${pageData.url}
Page Content:
${pageData.text || pageData.title}

Format your response cleanly:
- 1-2 sentence high-level overview.
- 3 to 4 bullet points highlighting key details.
- 1 concise takeaway sentence.`;
    } else if (action === 'key_points') {
      prompt = `Extract the 4 to 6 most important key points and takeaways from this page:
Title: ${pageData.title}
URL: ${pageData.url}
Content:
${pageData.text || pageData.title}

Use clean bullet points (- point).`;
    } else if (action === 'simplify') {
      prompt = `Explain the following page in simple, beginner-friendly terms (like I am 12 years old) without technical jargon:
Title: ${pageData.title}
Content:
${pageData.text || pageData.title}`;
    }

    await this.callAiAndRender(prompt, action);
  }

  async triggerCustomQuery(query) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.renderKeyPromptView(false);
      return;
    }

    const feed = this.container.querySelector('#copilot-feed');
    if (feed) {
      feed.innerHTML += `
        <div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
          <div style="background:var(--bg-hover); border:1px solid var(--border-subtle); border-radius:12px; padding:8px 14px; max-width:85%; font-size:13px; color:var(--text-main);">
            ${this.escapeHtml(query)}
          </div>
        </div>
        <div class="copilot-response-box" id="pending-reply">
          <h4><i class="fas fa-spinner fa-spin"></i> Ocal Copilot</h4>
          <p style="color:var(--text-muted);">Thinking...</p>
        </div>
      `;
      feed.scrollTop = feed.scrollHeight;
    }

    const pageData = await this.getPageTextAndMetadata();
    const prompt = `The user is viewing this webpage in Ocal Browser:
Title: ${pageData.title}
URL: ${pageData.url}
Page Content:
${pageData.text || pageData.title}

User Question: ${query}

Answer the user clearly, concisely, and helpfully using information from the page.`;

    await this.callAiAndRender(prompt, 'chat');
  }

  async callAiAndRender(prompt, actionType) {
    const feed = this.container.querySelector('#copilot-feed');
    const pendingEl = feed?.querySelector('#pending-reply');
    const apiKey = this.getApiKey();

    try {
      let aiText = '';
      if (apiKey.startsWith('sk-')) {
        // OpenAI or compatible endpoint
        aiText = await this.callOpenAiApi(prompt, apiKey);
      } else {
        // Google Gemini API (Primary free provider)
        aiText = await this.callGeminiApi(prompt, apiKey);
      }

      if (pendingEl) {
        pendingEl.id = '';
        const titleIcon = actionType === 'summarize' ? '<i class="fas fa-file-alt"></i> Summary' :
                          actionType === 'key_points' ? '<i class="fas fa-list-check"></i> Key Takeaways' :
                          actionType === 'simplify' ? '<i class="fas fa-wand-magic-sparkles"></i> Simplified' :
                          '<i class="fas fa-sparkles"></i> Copilot Answer';

        pendingEl.innerHTML = `
          <h4>${titleIcon}</h4>
          <div>${this.formatMarkdownHtml(aiText)}</div>
        `;
        if (feed) feed.scrollTop = feed.scrollHeight;
      }
    } catch (err) {
      console.error('[Ocal Copilot Error]', err);
      if (pendingEl) {
        pendingEl.id = '';
        const msg = err.message || 'Unable to connect to AI service';
        pendingEl.innerHTML = `
          <div class="copilot-error-banner">
            <div><strong>AI Request Failed</strong>: ${this.escapeHtml(msg)}</div>
            <button id="copilot-err-fix-key-btn"><i class="fas fa-key"></i> Update API Key</button>
          </div>
        `;
        pendingEl.querySelector('#copilot-err-fix-key-btn')?.addEventListener('click', () => {
          this.open(true);
        });
        if (feed) feed.scrollTop = feed.scrollHeight;
      }
    }
  }

  async callGeminiApi(prompt, apiKey) {
    // Try Gemini 1.5 Flash first, then Gemini 2.0 Flash fallback
    const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
    let lastErr = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }]
              }
            ],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 1024
            }
          })
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          const errMsg = data.error?.message || `HTTP ${res.status}`;
          throw new Error(errMsg);
        }

        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;
        if (text) return text;
      } catch (e) {
        lastErr = e;
        if (e.message && (e.message.includes('API_KEY_INVALID') || e.message.includes('API key not valid'))) {
          throw new Error('Invalid Gemini API Key. Please check the key from Google AI Studio.');
        }
      }
    }

    throw lastErr || new Error('Failed to get response from Gemini AI.');
  }

  async callOpenAiApi(prompt, apiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are Ocal Copilot, an insightful web browsing AI assistant.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 1000
      })
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error?.message || 'OpenAI API request failed');
    }
    return data.choices?.[0]?.message?.content || 'No response generated.';
  }

  formatMarkdownHtml(text) {
    if (!text) return '';
    const lines = text.split('\n');
    let html = '';
    let inList = false;

    for (let rawLine of lines) {
      let line = rawLine.trim();
      if (!line) {
        if (inList) { html += '</ul>'; inList = false; }
        continue;
      }

      // Format bold: **text**
      line = this.escapeHtml(line).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${line.substring(2)}</li>`;
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<p style="margin-bottom:8px;">${line}</p>`;
      }
    }

    if (inList) { html += '</ul>'; }
    return html;
  }

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
