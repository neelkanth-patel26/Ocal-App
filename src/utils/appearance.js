// Material 3 color system: Presets and dynamic adaptive palette engine.
export const accentChoices = [
  { id: 'default', label: 'Fern' },
  { id: 'blue', label: 'Ocean' },
  { id: 'violet', label: 'Iris' },
  { id: 'teal', label: 'Jade' },
  { id: 'rose', label: 'Rose' },
  { id: 'adaptive', label: 'Adaptive' },
];

const DYNAMIC_TOKEN_KEYS = [
  '--md-sys-color-primary',
  '--md-sys-color-on-primary',
  '--md-sys-color-primary-container',
  '--md-sys-color-on-primary-container',
  '--md-sys-color-surface',
  '--md-sys-color-surface-container',
  '--md-sys-color-surface-container-high',
  '--md-sys-color-on-surface',
  '--md-sys-color-on-surface-variant',
  '--md-sys-color-outline',
  '--md-sys-color-outline-variant',
  '--accent-primary',
  '--accent-primary-hover',
  '--on-accent',
  '--accent-subtle',
  '--accent-border',
  '--bg-main',
  '--bg-surface',
  '--bg-elevated',
];

/** Convert hex (#rgb, #rrggbb) or rgb(r, g, b) to { h, s, l } with h in [0, 360], s in [0, 100], l in [0, 100]. */
export function hexToHsl(colorStr) {
  let str = String(colorStr || '').trim();
  if (str.startsWith('rgb')) {
    const m = str.match(/rgb(?:a)?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) {
      const r = parseInt(m[1], 10) / 255;
      const g = parseInt(m[2], 10) / 255;
      const b = parseInt(m[3], 10) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h = Math.round(h * 60);
      }
      return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
    }
  }
  let c = str.replace('#', '').trim();
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length !== 6) return { h: 95, s: 35, l: 30 };
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h = Math.round(h * 60);
  }
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Convert { h, s, l } to #rrggbb. */
export function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Generate full Material 3 tonal palette tokens from a single seed color.
 */
export function generateM3TonalTokens(seedHex, isDark = false) {
  const { h, s } = hexToHsl(seedHex);
  const baseSat = Math.max(25, Math.min(85, s));

  if (!isDark) {
    const primary = hslToHex(h, Math.min(baseSat, 65), 38);
    const primaryContainer = hslToHex(h, Math.min(baseSat, 75), 88);
    const onPrimaryContainer = hslToHex(h, Math.min(baseSat, 85), 14);
    const surface = hslToHex(h, 20, 97);
    const surfaceContainer = hslToHex(h, 16, 92);
    const surfaceContainerHigh = hslToHex(h, 16, 89);
    const onSurface = hslToHex(h, 12, 11);
    const onSurfaceVariant = hslToHex(h, 10, 28);
    const outline = hslToHex(h, 8, 46);
    const outlineVariant = hslToHex(h, 12, 78);

    return {
      '--md-sys-color-primary': primary,
      '--md-sys-color-on-primary': '#ffffff',
      '--md-sys-color-primary-container': primaryContainer,
      '--md-sys-color-on-primary-container': onPrimaryContainer,
      '--md-sys-color-surface': surface,
      '--md-sys-color-surface-container': surfaceContainer,
      '--md-sys-color-surface-container-high': surfaceContainerHigh,
      '--md-sys-color-on-surface': onSurface,
      '--md-sys-color-on-surface-variant': onSurfaceVariant,
      '--md-sys-color-outline': outline,
      '--md-sys-color-outline-variant': outlineVariant,
      '--accent-primary': primary,
      '--accent-primary-hover': hslToHex(h, Math.min(baseSat, 65), 32),
      '--on-accent': '#ffffff',
      '--accent-subtle': primaryContainer,
      '--accent-border': outlineVariant,
      '--bg-main': surface,
      '--bg-surface': surfaceContainer,
      '--bg-elevated': surfaceContainerHigh,
    };
  } else {
    const primary = hslToHex(h, Math.min(baseSat, 75), 75);
    const primaryContainer = hslToHex(h, Math.min(baseSat, 65), 26);
    const onPrimaryContainer = hslToHex(h, Math.min(baseSat, 75), 88);
    const surface = hslToHex(h, 14, 7);
    const surfaceContainer = hslToHex(h, 14, 12);
    const surfaceContainerHigh = hslToHex(h, 14, 16);
    const onSurface = hslToHex(h, 12, 88);
    const onSurfaceVariant = hslToHex(h, 10, 75);
    const outline = hslToHex(h, 8, 55);
    const outlineVariant = hslToHex(h, 10, 28);

    return {
      '--md-sys-color-primary': primary,
      '--md-sys-color-on-primary': hslToHex(h, Math.min(baseSat, 80), 15),
      '--md-sys-color-primary-container': primaryContainer,
      '--md-sys-color-on-primary-container': onPrimaryContainer,
      '--md-sys-color-surface': surface,
      '--md-sys-color-surface-container': surfaceContainer,
      '--md-sys-color-surface-container-high': surfaceContainerHigh,
      '--md-sys-color-on-surface': onSurface,
      '--md-sys-color-on-surface-variant': onSurfaceVariant,
      '--md-sys-color-outline': outline,
      '--md-sys-color-outline-variant': outlineVariant,
      '--accent-primary': primary,
      '--accent-primary-hover': hslToHex(h, Math.min(baseSat, 75), 82),
      '--on-accent': hslToHex(h, Math.min(baseSat, 80), 15),
      '--accent-subtle': primaryContainer,
      '--accent-border': outlineVariant,
      '--bg-main': surface,
      '--bg-surface': surfaceContainer,
      '--bg-elevated': surfaceContainerHigh,
    };
  }
}

/** Clear dynamically injected style properties from documentElement. */
export function clearAdaptiveTokens() {
  const rootStyle = document.documentElement.style;
  for (const key of DYNAMIC_TOKEN_KEYS) {
    rootStyle.removeProperty(key);
  }
}

/** Apply dynamically generated tokens to documentElement. */
export function applyAdaptiveTokens(tokens) {
  const rootStyle = document.documentElement.style;
  for (const [key, val] of Object.entries(tokens)) {
    rootStyle.setProperty(key, val);
  }
}

/**
 * Apply the selected accent choice or adaptive dynamic palette.
 */
export function applyAccent(value = localStorage.getItem('ocal-accent-color')) {
  const choice = accentChoices.some(item => item.id === value) ? value : 'default';
  document.documentElement.dataset.accent = choice;

  if (choice === 'adaptive') {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const seed = localStorage.getItem('ocal-adaptive-seed') || '#526534';
    const tokens = generateM3TonalTokens(seed, isDark);
    applyAdaptiveTokens(tokens);
  } else {
    clearAdaptiveTokens();
  }

  if (window.ocalApp?.updateStatusBarTheme) {
    window.ocalApp.updateStatusBarTheme();
  }

  return choice;
}

/**
 * Dynamically synchronize page theme color to adaptive palette when in Adaptive mode.
 */
export function syncAdaptivePageTheme(colorHex) {
  if (document.documentElement.dataset.accent !== 'adaptive' || !colorHex) return;
  localStorage.setItem('ocal-adaptive-seed', colorHex);
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const tokens = generateM3TonalTokens(colorHex, isDark);
  applyAdaptiveTokens(tokens);
  if (window.ocalApp?.updateStatusBarTheme) {
    window.ocalApp.updateStatusBarTheme();
  }
}

