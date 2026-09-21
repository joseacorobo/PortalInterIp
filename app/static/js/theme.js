/**
 * theme.js - Toggle claro/oscuro (Nativo Stitch)
 * Portal Operaciones IP - Inter Telecomunicaciones C.A.
 * Sistema dual: data-theme (CSS tokens) + clase .dark (Tailwind compat)
 * Persiste en localStorage, por defecto 'light' (Modo Claro).
 */
(function () {
  const KEY = 'ip-theme';
  const root = document.documentElement;

  function applyTheme(theme) {
    // 1) CSS custom properties
    root.setAttribute('data-theme', theme);
    
    // 2) Clase .dark
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // 3) Actualizar boton de tema en header si existe
    const headerBtn = document.getElementById('theme-toggle');
    if (headerBtn) {
      headerBtn.setAttribute('aria-label', theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    }

    // 4) Actualizar boton de tema en sidebar de Stitch
    const sidebarText = document.getElementById('theme-mode-text');
    if (sidebarText) {
      sidebarText.innerText = theme === 'dark' ? 'Modo oscuro' : 'Modo claro';
    }
    const sidebarBtn = document.getElementById('theme-toggle-sidebar');
    if (sidebarBtn) {
      const icon = sidebarBtn.querySelector('[data-lucide]');
      if (icon) {
        icon.setAttribute('data-lucide', theme === 'dark' ? 'moon' : 'sun');
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons({ nodes: [icon] });
        }
      }
    }
  }

  // Por defecto 'light' para el nuevo diseño institucional de Stitch
  function getInitialTheme() {
    const saved = localStorage.getItem(KEY) || localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light';
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(getInitialTheme());
  });

  window.toggleTheme = function () {
    const current = root.getAttribute('data-theme') ?? 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(KEY, next);
    applyTheme(next);
  };
})();
