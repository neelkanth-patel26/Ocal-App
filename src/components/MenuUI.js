import '../styles/menus.css';

export const menuIcon = name => `<span class="material-icons-round" aria-hidden="true">${name}</span>`;
const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const item = (id, icon, title, subtitle = '') => `<button type="button" class="m-menu-row" id="${id}">${menuIcon(icon)}<span class="m-menu-row-copy"><strong>${title}</strong>${subtitle ? `<span>${subtitle}</span>` : ''}</span>${menuIcon('chevron_right')}</button>`;

export function renderMoreMenu({ isIncognito, isAdBlockActive, isDesktop, currentTheme, activeTab, isInternal }) {
  return `
    <div class="sheet-handle-bar"><div class="sheet-handle"></div></div>
    <header class="sheet-header m-menu-header"><div><div class="m-eyebrow">YOUR BROWSER, YOUR WAY</div><h2 class="sheet-title">A little more Ocal</h2></div><button class="sheet-close-pill" id="menu-close-btn" aria-label="Close menu">${menuIcon('close')}</button></header>
    <div class="sheet-content m-menu-content">
      <div class="m-page-context">${menuIcon(isIncognito ? 'visibility_off' : isInternal ? 'explore' : 'language')}<span><strong>${safe(isInternal ? 'Ocal Browser' : activeTab?.title || 'Current page')}</strong><span>${isIncognito ? 'Private browsing' : isInternal ? 'Make yourself at home' : safe(activeTab?.url || '')}</span></span></div>
      <div class="m-quick-actions" aria-label="Quick destinations">
        ${[['menu-bookmarks','bookmarks','Saved'],['menu-history','history','History'],['menu-downloads-row','download','Downloads'],['menu-shield','shield','Protection']].map(([id,icon,label])=>`<button id="${id}" class="m-quick-action">${menuIcon(icon)}<span>${label}</span></button>`).join('')}
      </div>
      <div class="m-feature-actions">
        <button id="menu-quick-private-row" class="m-feature-card">${menuIcon('visibility_off')}<strong>Private tab</strong><span>Open a separate space</span>${menuIcon('add')}</button>
        <button id="menu-quick-adblock-row" class="m-feature-card" role="switch" aria-checked="${isAdBlockActive}" aria-label="Ad blocker">${menuIcon('shield')}<strong>Ad blocker</strong><span id="menu-adblock-state">${isAdBlockActive ? 'Filtering is on' : 'Filtering is off'}</span><span class="m-switch-track ${isAdBlockActive ? '' : 'inactive'}" id="badge-quick-adblock" aria-hidden="true"><span></span></span></button>
      </div>
      <section class="m-menu-section"><h3>This page</h3><div class="m-menu-list">
        ${item('menu-share-row','ios_share','Share page',isInternal ? 'Send someone Ocal' : 'Send or copy a link')}
        ${item('menu-reload-row','refresh','Reload page')}
        ${item('menu-reader-mode-row','auto_stories','Zen Reader','Read and listen without distractions')}
        <label class="m-menu-row m-menu-toggle" for="toggle-desktop-site">${menuIcon('desktop_windows')}<span class="m-menu-row-copy"><strong>Desktop site</strong><span>Use the desktop layout</span></span><span class="toggle-switch"><input type="checkbox" id="toggle-desktop-site" aria-label="Desktop site" ${isDesktop ? 'checked' : ''}><span class="toggle-slider"></span></span></label>
      </div></section>
      <section class="m-menu-section"><h3>Explore your tools</h3><div class="m-menu-list">
        ${item('menu-copilot-row','auto_awesome','Ocal Copilot','Summarize, explore, and ask')}
        ${item('menu-sync-row','devices','Connect devices','Continue on your desktop')}
        ${item('menu-passwords-row','key','Passwords & logins')}
        ${item('menu-games','sports_esports','Games','Take a little break')}
      </div></section>
      <section class="m-menu-section"><h3>Make it yours</h3><div class="m-menu-list">
        ${isIncognito ? '' : item('menu-theme-row',currentTheme === 'dark' ? 'light_mode' : 'dark_mode',currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')}
        ${item('menu-settings-row','tune',isIncognito ? 'Private settings' : 'Settings','Appearance, search, and preferences')}
      </div></section>
    </div>`;
}

// Dialog semantics and focus are shared by dynamically created menus and dialogs.
let focusedOverlay = null;
let returnFocus = null;
const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).opacity !== '0';
export function syncDialogFocus() {
  const overlays = [...document.querySelectorAll('.modal-overlay, .bottom-sheet.visible')].filter(visible);
  overlays.sort((a,b) => (Number(getComputedStyle(a).zIndex) || 0) - (Number(getComputedStyle(b).zIndex) || 0));
  const top = overlays.at(-1) || null;
  if (top === focusedOverlay) return;
  if (!top) {
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
    focusedOverlay = null; returnFocus = null; return;
  }
  if (!focusedOverlay) returnFocus = document.activeElement;
  focusedOverlay = top;
  top.setAttribute('role','dialog'); top.setAttribute('aria-modal','true');
  const title = top.querySelector('.modal-title, .sheet-title, .m-dialog-title');
  if (title) top.setAttribute('aria-label', title.textContent.trim());
  else top.setAttribute('aria-label','Page actions');
  const first = top.querySelector('button, input:not([type="hidden"]), [tabindex="0"]');
  if (!top.contains(document.activeElement)) first?.focus({preventScroll:true});
}

document.addEventListener('keydown', event => {
  if (!focusedOverlay || !visible(focusedOverlay)) return;
  if (event.key === 'Escape') {
    const close = focusedOverlay.querySelector('.modal-close-btn, .sheet-close-pill, #copilot-close-btn, #ctx-cancel-btn, #modal-cancel-action, #close-pwd-modal');
    if (close) { event.preventDefault(); event.stopImmediatePropagation(); close.click(); }
  }
  if (event.key === 'Tab') {
    const focusable = [...focusedOverlay.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea, select, a[href], [tabindex="0"]')].filter(visible);
    if (!focusable.length) { event.preventDefault(); return; }
    const index = focusable.indexOf(document.activeElement);
    if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1).focus(); }
    else if (!event.shiftKey && (index === focusable.length - 1 || index === -1)) { event.preventDefault(); focusable[0].focus(); }
  }
}, true);
