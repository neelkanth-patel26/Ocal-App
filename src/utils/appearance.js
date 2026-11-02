// Restrict persisted choices to known palettes; CSS supplies theme-specific colors.
export const accentChoices = [
  { id: 'default', label: 'Classic' },
  { id: 'blue', label: 'Ocean' },
  { id: 'violet', label: 'Iris' },
  { id: 'teal', label: 'Jade' },
  { id: 'rose', label: 'Rose' },
];

export function applyAccent(value = localStorage.getItem('ocal-accent-color')) {
  const choice = accentChoices.some(item => item.id === value) ? value : 'default';
  document.documentElement.dataset.accent = choice;
  return choice;
}
