import '../styles/internal-pages.css';

const pages = {
  error: { title: 'A little off the map', label: 'Page not found', icon: 'explore_off', group: 'Your browser', description: 'This internal page could not be found. Choose a destination below.' },
  bookmarks: { title: 'Saved places', label: 'Bookmarks', icon: 'bookmarks', group: 'Your library', description: 'The useful, the inspiring, and the worth-coming-back-to.' },
  history: { title: 'Retrace your steps', label: 'History', icon: 'history', group: 'Your library', description: 'Find that page again. Your browsing, organized by time or website.' },
  downloads: { title: 'Your downloads', label: 'Downloads', icon: 'download', group: 'Your library', description: 'Follow your downloads and find the files you have saved.' },
  passwords: { title: 'Your logins', label: 'Passwords', icon: 'key', group: 'Your library', description: 'Find, import, and manage the logins you keep in Ocal.' },
  settings: { title: 'Make it yours', label: 'Settings', icon: 'tune', group: 'Your browser', description: 'A few thoughtful adjustments. A browser that feels like you.' },
  sync: { title: 'Better, together', label: 'Connect', icon: 'devices', group: 'Your browser', description: 'Bring your phone and desktop together. Pick up where you left off.' },
  games: { title: 'Take a little break', label: 'Games', icon: 'sports_esports', group: 'Your tools', description: 'Small games for a change of pace. Choose something to play.' },
  snake: { title: 'Cyber Snake', label: 'Snake', icon: 'sports_esports', group: 'Your tools', description: 'Follow your curiosity. Collect food and keep clear of your tail.' },
  tetris: { title: 'Block Drop', label: 'Block Drop', icon: 'grid_view', group: 'Your tools', description: 'Your block puzzle workspace.' },
  pdf: { title: 'Room to read', label: 'PDF reader', icon: 'description', group: 'Your tools', description: 'Open a document from your device and settle into the details.' },
  volume: { title: 'Find your level', label: 'Volume', icon: 'volume_up', group: 'Your tools', description: 'Adjust the amplification level and choose a preset.' },
};
const icon = name => `<span class="material-icons-round" aria-hidden="true">${name}</span>`;
const navRoutes = ['bookmarks', 'history', 'downloads', 'passwords', 'settings', 'sync', 'games', 'pdf', 'volume'];

/** Restructure existing page nodes, preserving their bound listeners and native bridge IDs. */
export function presentInternalPage(container, route, onNavigate, privateMode = false) {
  if (!(container instanceof HTMLElement)) return container;
  const meta = { ...pages[route] };
  const isPrivatePage = container.classList.contains('private-subpage-container');
  if (isPrivatePage) {
    meta.group = 'Private browsing';
    if (route === 'bookmarks') { meta.title = 'Your private collection'; meta.description = 'Bookmarks kept separate from your regular browsing.'; }
    if (route === 'history') { meta.title = 'Just this session'; meta.description = 'Switch between your open private tabs. Regular history stays separate.'; }
    if (route === 'settings') { meta.title = 'Your private preferences'; meta.description = 'Choose how private browsing works for you.'; }
  }
  container.classList.add('ip-page', `ip-${route}`);
  container.dataset.internalPage = route;
  const header = container.querySelector(':scope > .subpage-header');
  const content = container.querySelector(':scope > .subpage-content');
  if (!header || !content) return container;
  const title = header.querySelector('.subpage-header-title');
  const back = header.querySelector('.subpage-back-btn');
  back?.setAttribute('aria-label', ['snake', 'tetris'].includes(route) ? 'Back to games' : 'Back to start page');
  if (back) back.innerHTML = icon('arrow_back');
  const actions = document.createElement('div');
  actions.className = 'ip-actions';
  for (const child of [...header.children]) {
    if (child !== title && child !== back && (child.querySelector('button') || child.matches('button, [id$="score"]'))) actions.append(child);
    else if (child !== title && child !== back) child.remove();
  }
  if (title) title.textContent = `Ocal / ${meta.group}`;
  const badge = document.createElement('span');
  badge.className = 'ip-mode-label';
  badge.innerHTML = icon(privateMode ? 'visibility_off' : 'explore');
  badge.setAttribute('aria-label', privateMode ? 'Private mode' : 'Ocal');
  header.append(badge);

  const workspace = document.createElement('div');
  workspace.className = 'ip-workspace';
  const navigation = document.createElement('nav');
  navigation.className = 'ip-navigation';
  navigation.setAttribute('aria-label', 'Internal pages');
  const navTitle = document.createElement('div');
  navTitle.className = 'ip-nav-heading'; navTitle.textContent = 'YOUR OCAL'; navigation.append(navTitle);
  // Keep private entry points scoped to the private library and its preferences.
  const destinations = privateMode ? ['bookmarks', 'history', 'settings'] : navRoutes;
  for (const key of destinations) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ip-nav-item';
    button.innerHTML = `${icon(pages[key].icon)}<span>${pages[key].label}</span>`;
    if (key === route || (key === 'games' && ['snake', 'tetris'].includes(route))) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => onNavigate?.(`ocal://${key}`));
    navigation.append(button);
  }
  const main = document.createElement('div');
  main.className = 'ip-main';
  const intro = document.createElement('section');
  intro.className = 'ip-intro';
  intro.innerHTML = `<div class="ip-intro-copy"><div class="ip-eyebrow">${meta.group}</div><h1>${meta.title}</h1><p>${meta.description}</p></div><div class="ip-page-symbol">${icon(meta.icon)}</div>`;
  intro.append(actions);
  main.append(intro, content);
  workspace.append(navigation, main);
  header.after(workspace);
  requestAnimationFrame(() => {
    const current = navigation.querySelector('[aria-current="page"]');
    if (current && navigation.scrollWidth > navigation.clientWidth) {
      navigation.scrollLeft = current.offsetLeft - navigation.offsetLeft - 8;
    }
  });

  content.querySelectorAll('input:not([type="hidden"]):not([type="file"]), select').forEach(input => {
    if (input.hasAttribute('aria-label') || input.labels?.length) return;
    const row = input.closest('.apple-grouped-row');
    input.setAttribute('aria-label', row?.querySelector('.apple-row-title')?.textContent || input.placeholder || 'Value');
  });
  content.querySelectorAll('.bookmark-item-row, .history-item-row[data-url], .history-site-header, .private-history-tab-item, .game-hub-card, .apple-grouped-row[id]').forEach(row => {
    if (row.matches('button, a') || row.querySelector('input, select')) return;
    if (row.style.cursor === 'default') return;
    row.tabIndex = 0; row.setAttribute('role', 'button');
    row.addEventListener('keydown', event => {
      if (event.target !== row || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault(); row.click();
    });
  });
  if (route === 'settings') arrangeSettings(content);
  if (route === 'bookmarks' && !isPrivatePage) arrangeBookmarks(content);
  if (['bookmarks', 'passwords'].includes(route)) addFilterFeedback(content, route);
  if (route === 'sync') arrangeConnect(content);
  if (route === 'downloads') arrangeDownloads(content);
  if (route === 'games') arrangeGames(content);
  if (['snake', 'tetris'].includes(route)) arrangeGame(content, route);
  if (route === 'pdf') arrangePdf(content);
  if (route === 'volume') arrangeVolume(content);
  if (isPrivatePage && route === 'history') {
    content.querySelector('.private-shield-hero-tag').textContent = 'PRIVATE SESSION';
    content.querySelector('.private-shield-hero-title').textContent = 'History takes a break';
  }
  return container;
}

function arrangeSettings(content) {
  const sections = [...content.querySelectorAll(':scope > .settings-section')];
  const oldNav = content.querySelector('.settings-shortcuts');
  const names = oldNav ? [...oldNav.querySelectorAll('button')].map(button => button.textContent) : [];
  oldNav?.remove();
  const toolbar = document.createElement('div');
  toolbar.className = 'ip-settings-tools';
  toolbar.innerHTML = `<label class="ip-search-field">${icon('search')}<input type="search" placeholder="Find a setting" aria-label="Find a setting" autocomplete="off"></label><div class="ip-setting-categories" role="group" aria-label="Settings categories"></div>`;
  const noResults = document.createElement('div');
  noResults.className = 'ip-no-results'; noResults.hidden = true; noResults.setAttribute('role', 'status');
  noResults.textContent = 'No settings found. Try a different word or category.';
  content.prepend(toolbar); content.append(noResults);
  const sectionIcons = ['palette', 'search', 'shield', 'language', 'auto_awesome', 'devices', 'key', 'system_update', 'info'];
  let selected = 'all';
  const categoryGroup = toolbar.querySelector('.ip-setting-categories');
  const filter = () => {
    const query = toolbar.querySelector('input').value.trim().toLowerCase();
    let visible = 0;
    sections.forEach((section, index) => {
      const match = (selected === 'all' || selected === String(index)) && section.textContent.toLowerCase().includes(query);
      section.hidden = !match;
      if (match) visible++;
    });
    noResults.hidden = visible > 0;
    content.querySelector('.ip-settings-grid')?.classList.toggle('ip-single-result', visible === 1);
  };
  ['All settings', ...names].forEach((name, index) => {
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'ip-category'; button.setAttribute('aria-pressed', String(index === 0));
    button.innerHTML = `${icon(index ? sectionIcons[index - 1] || 'tune' : 'apps')}<span>${name}</span>`;
    button.addEventListener('click', () => {
      selected = index === 0 ? 'all' : String(index - 1);
      categoryGroup.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      filter();
    });
    categoryGroup.append(button);
  });
  toolbar.querySelector('input').addEventListener('input', filter);
  const grid = document.createElement('div'); grid.className = 'ip-settings-grid';
  sections.forEach((section, index) => {
    const heading = section.querySelector('.subpage-section-title');
    if (heading) heading.insertAdjacentHTML('afterbegin', icon(sectionIcons[index] || 'tune'));
    grid.append(section);
  });
  noResults.before(grid);
}

function arrangeBookmarks(content) {
  const list = content.querySelector('#bookmarks-list');
  if (!list) return;
  const rows = [...list.querySelectorAll('.bookmark-item-row')];
  const toolbar = document.createElement('div'); toolbar.className = 'ip-list-toolbar';
  const count = document.createElement('span'); count.textContent = `${rows.length} saved ${rows.length === 1 ? 'place' : 'places'}`;
  const label = document.createElement('label'); label.textContent = 'Sort ';
  const select = document.createElement('select'); select.setAttribute('aria-label', 'Sort bookmarks');
  select.innerHTML = '<option value="saved">Saved order</option><option value="name">Name A–Z</option><option value="site">Website</option>';
  select.addEventListener('change', () => {
    const sorted = [...rows];
    if (select.value !== 'saved') sorted.sort((a, b) => {
      const key = select.value === 'name' ? 'title' : 'url';
      return (a.dataset[key] || '').localeCompare(b.dataset[key] || '');
    });
    list.append(...sorted);
  });
  label.append(select); toolbar.append(count, label); list.before(toolbar);
}

function addFilterFeedback(content, route) {
  const input = content.querySelector(route === 'bookmarks' ? '#bm-filter-input' : '#pwd-filter-input');
  if (!input) return;
  const feedback = document.createElement('p'); feedback.className = 'ip-no-results'; feedback.hidden = true; feedback.setAttribute('role', 'status');
  feedback.textContent = 'No matches. Try another name or website.'; content.append(feedback);
  input.addEventListener('input', () => {
    const rows = [...content.querySelectorAll(route === 'bookmarks' ? '.bookmark-item-row' : '.password-vault-row')];
    feedback.hidden = !input.value.trim() || !rows.length || rows.some(row => row.style.display !== 'none');
  });
}

function arrangeConnect(content) {
  content.querySelector('.sync-minimal-hero')?.remove();
  content.classList.remove('connect-pairing-layout');
  const scanner = content.querySelector('.scanner-card');
  const manual = content.querySelector('.connect-manual') || content.querySelector('.sync-manual-table')?.parentElement;
  if (!scanner || !manual) return;
  manual.classList.add('connect-manual');
  content.classList.add('ip-pairing-workspace');
  const setup = content.querySelector('.connect-setup');
  if (setup) {
    const instructions = setup.querySelector('.sync-instructions-table');
    const details = document.createElement('details'); details.className = 'ip-pairing-help';
    details.innerHTML = `<summary><span class="material-icons-round ip-help-icon" aria-hidden="true">help_outline</span><span class="ip-help-title">Where do I find my connection code?</span><span class="material-icons-round ip-help-chevron" aria-hidden="true">expand_more</span></summary>`;
    if (instructions) details.append(instructions);
    setup.replaceWith(details);
    content.append(details);
  }
  const connectionNote = document.createElement('div'); connectionNote.className = 'ip-connection-note';
  connectionNote.innerHTML = `${icon('wifi')}<span>Keep both devices on the same Wi-Fi network.</span>`;
  const choices = document.createElement('div'); choices.className = 'ip-pairing-methods';
  choices.setAttribute('role', 'group'); choices.setAttribute('aria-label', 'Connection method');
  choices.innerHTML = `<button type="button" data-method="qr" aria-pressed="true">${icon('qr_code_scanner')}<span>Scan a QR code</span></button><button type="button" data-method="code" aria-pressed="false">${icon('dialpad')}<span>Enter a code</span></button>`;
  content.prepend(connectionNote, choices);
  scanner.classList.add('ip-scanner-panel');
  const title = scanner.querySelector('.subpage-section-title');
  if (title) title.textContent = 'Bring your devices together';
  const phIcon = scanner.querySelector('.scanner-placeholder-icon');
  if (phIcon) phIcon.innerHTML = icon('qr_code_scanner');
  const phTitle = scanner.querySelector('.scanner-placeholder-title');
  if (phTitle) phTitle.textContent = 'Your desktop, meet your phone';
  const phDesc = scanner.querySelector('.scanner-placeholder-desc');
  if (phDesc) phDesc.textContent = 'Scan the QR code in Ocal Connect on your desktop.';
  const camBtnText = scanner.querySelector('#camera-btn-text');
  if (camBtnText) camBtnText.textContent = 'Use camera';
  const photoText = scanner.querySelector('#scan-photo-btn span');
  if (photoText) photoText.textContent = 'Choose QR image';
  const manualTitle = manual.querySelector('.subpage-section-title');
  if (manualTitle) manualTitle.textContent = 'Connect with a code';

  const showMethod = (method) => {
    const isCode = method === 'code';
    if (isCode && scanner.querySelector('video')?.style.display === 'block') {
      scanner.querySelector('#toggle-camera-btn')?.click();
    }
    scanner.hidden = isCode;
    manual.hidden = !isCode;
    scanner.classList.toggle('is-hidden', isCode);
    manual.classList.toggle('is-hidden', !isCode);
    scanner.style.setProperty('display', isCode ? 'none' : 'flex', 'important');
    manual.style.setProperty('display', isCode ? 'flex' : 'none', 'important');
    choices.querySelectorAll('button').forEach(item => {
      item.setAttribute('aria-pressed', String(item.dataset.method === method));
    });
  };

  showMethod('qr');
  choices.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
      showMethod(button.dataset.method);
    });
  });
}

function arrangeGames(content) {
  content.querySelector('.arcade-hero-card')?.remove();
  const grid = document.createElement('div'); grid.className = 'ip-games-grid';
  content.querySelectorAll('.game-hub-card').forEach((card, index) => {
    const artwork = document.createElement('div'); artwork.className = `ip-game-art ip-game-art-${index}`; artwork.setAttribute('aria-hidden', 'true');
    artwork.innerHTML = Array.from({ length: 9 }, (_, i) => `<span style="--tile:${i}"></span>`).join('');
    card.prepend(artwork);
    card.querySelector('.game-icon-tile')?.remove();
    card.querySelectorAll('.game-features-row').forEach(el => el.remove());
    grid.append(card);
  });
  content.append(grid);
}
function arrangeGame(content, route) {
  const canvas = content.querySelector('canvas');
  if (canvas) {
    canvas.setAttribute('aria-label', route === 'snake' ? 'Snake game board' : 'Block Drop board');
    const stage = document.createElement('div'); stage.className = 'ip-game-stage'; canvas.before(stage); stage.append(canvas);
  }
  const labels = { 'snake-up': 'Move up', 'snake-down': 'Move down', 'snake-left': 'Move left', 'snake-right': 'Move right', 'snake-reset': 'Restart game', 't-left': 'Move left', 't-right': 'Move right', 't-down': 'Move down', 't-rotate': 'Rotate block' };
  content.querySelectorAll('button[id]').forEach(button => button.setAttribute('aria-label', labels[button.id.replace(/-btn$/, '')] || button.id.replaceAll('-', ' ')));
}
function arrangePdf(content) {
  const zone = content.querySelector('.pdf-dropzone');
  if (!zone) return;
  const callout = document.createElement('span'); callout.className = 'ip-filled-action'; callout.innerHTML = `${icon('add')} Choose a PDF`; zone.append(callout);
  const help = document.createElement('div'); help.className = 'ip-tool-note'; help.innerHTML = `${icon('folder_open')}<span>Choose a file stored on this device. PDF display depends on your browser’s built-in viewer.</span>`;
  zone.after(help);
}
function arrangeVolume(content) {
  const card = content.querySelector('.volume-dial-card');
  if (!card) return;
  const label = document.createElement('div'); label.className = 'ip-eyebrow'; label.textContent = 'AMPLIFICATION'; card.prepend(label);
  content.querySelectorAll('.volume-preset-btn').forEach(button => {
    button.setAttribute('aria-pressed', String(button.classList.contains('active')));
    button.addEventListener('click', () => content.querySelectorAll('.volume-preset-btn').forEach(item => item.setAttribute('aria-pressed', String(item === button))));
  });
  content.closest('.ip-page').querySelector('#volume-reset-btn')?.addEventListener('click', () => content.querySelectorAll('.volume-preset-btn').forEach(button => button.setAttribute('aria-pressed', String(button.classList.contains('active')))));
  content.querySelector('#boost-slider')?.addEventListener('input', () => content.querySelectorAll('.volume-preset-btn').forEach(button => button.setAttribute('aria-pressed', String(button.classList.contains('active')))));
}

function arrangeDownloads(content) {
  const summary = document.createElement('div'); summary.className = 'ip-download-summary';
  summary.innerHTML = [['all', 'All files', 'folder'], ['active', 'In progress', 'downloading'], ['completed', 'Completed', 'task_alt']].map(([key, label, symbol]) => `<div class="ip-stat">${icon(symbol)}<strong data-download-count="${key}">0</strong><span>${label}</span></div>`).join('');
  content.prepend(summary);
  content.querySelectorAll('.dl-tab-chip').forEach(chip => {
    chip.setAttribute('aria-pressed', String(chip.classList.contains('active')));
    chip.addEventListener('click', () => content.querySelectorAll('.dl-tab-chip').forEach(item => item.setAttribute('aria-pressed', String(item === chip))));
  });
}
