// web/scripts/theme.js

export function initTheme() {
  const themeSelector = document.getElementById('themeSelector');
  if (!themeSelector) return;

  const applyTheme = (theme) => {
    document.body.className = theme;
    localStorage.setItem('streamGuruTheme', theme);
    themeSelector.value = theme;
  };

  const savedTheme = localStorage.getItem('streamGuruTheme') || '';
  applyTheme(savedTheme);

  themeSelector.addEventListener('change', () => applyTheme(themeSelector.value));
}