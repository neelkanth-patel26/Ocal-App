import { syncDialogFocus } from './MenuUI.js';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@material-design-icons/font/round.css';
import '@material/web/ripple/ripple.js';
import '@material/web/chips/assist-chip.js';
import '@material/web/icon/icon.js';
import '../styles/material.css';
import '../styles/tab-workspace.css';

// Enhance native buttons without replacing their event handlers or browser bridge IDs.
function enhance(root) {
  if (!(root instanceof Element)) return;
  const buttons = [...root.querySelectorAll('button')];
  if (root.matches('button')) buttons.unshift(root);
  for (const button of buttons) {
    if (!button.querySelector(':scope > md-ripple')) {
      button.classList.add('material-control');
      const ripple = document.createElement('md-ripple');
      ripple.setAttribute('aria-hidden', 'true');
      button.append(ripple);
    }
    if (!button.hasAttribute('aria-label') && button.title) button.setAttribute('aria-label', button.title);
  }
  root.querySelectorAll('i.fas, i.far, i.fa-solid, i.fa-regular').forEach(icon => icon.setAttribute('aria-hidden', 'true'));
}

const nav = {
  'nav-history': ['history', 'History'],
  'nav-bookmarks': ['bookmark_border', 'Saved'],
  'nav-new-tab': ['add', 'New tab'],
  'nav-menu': ['more_horiz', 'Menu']
};
for (const [id, [icon, label]] of Object.entries(nav)) {
  const button = document.getElementById(id);
  if (button) {
    const isActive = id === 'nav-new-tab';
    button.innerHTML = `<div class="m3-nav-indicator ${isActive ? 'active' : ''}"><span class="material-icons-round" aria-hidden="true">${icon}</span></div><span class="material-nav-label">${label}</span>`;
  }
}
const tabs = document.getElementById('nav-tabs');
if (tabs) {
  const currentCount = tabs.querySelector('#tab-counter-badge')?.textContent?.trim() || '1';
  tabs.innerHTML = `<div class="m3-nav-indicator"><div class="tab-badge" id="tab-counter-badge">${currentCount}</div></div><span class="material-nav-label">Tabs</span>`;
}
enhance(document.body);
let focusFrame;
const observer = new MutationObserver(records => {
  cancelAnimationFrame(focusFrame);
  focusFrame = requestAnimationFrame(syncDialogFocus);
  for (const record of records) {
    if (record.type === 'childList' && record.target instanceof Element && record.target.matches('button')) enhance(record.target);
    for (const node of record.addedNodes) {
      if (node instanceof Element && node.tagName !== 'MD-RIPPLE') enhance(node);
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
