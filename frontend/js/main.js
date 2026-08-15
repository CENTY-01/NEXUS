(() => {
  const toggle = document.getElementById('theme-toggle');
  const stored = localStorage.getItem('nexus_theme');
  if (stored) document.documentElement.setAttribute('data-theme', stored);
  updateIcon();

  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    if (next === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    localStorage.setItem('nexus_theme', next);
    updateIcon();
  });

  function updateIcon() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    toggle.textContent = isLight ? '☀️' : '🌙';
  }
})();
