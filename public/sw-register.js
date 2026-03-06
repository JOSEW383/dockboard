// Service Worker registration
// This file is served as a static asset and inlined in Base.astro
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => console.warn('[dockboard] SW registration failed:', err));
  });
}
