import type { APIRoute } from 'astro';
import { loadConfig } from '../../lib/config';

export const GET: APIRoute = async () => {
  const config = await loadConfig();

  const name = config.title ?? 'Dockboard';
  const iconFile = config.icon;

  const icons: object[] = [];

  if (iconFile) {
    const ext = iconFile.split('.').pop()?.toLowerCase();
    const mime =
      ext === 'svg' ? 'image/svg+xml' :
      ext === 'png' ? 'image/png' :
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'webp' ? 'image/webp' :
      'image/png';

    icons.push({
      src: `/icons/${iconFile}`,
      sizes: ext === 'svg' ? 'any' : '512x512',
      type: mime,
      purpose: 'any maskable',
    });
  } else {
    // Fallback icons if no icon is configured
    icons.push(
      { src: '/app-icons/app-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/app-icons/app-icon-512.png', sizes: '512x512', type: 'image/png' },
    );
  }

  const manifest = {
    name,
    short_name: name,
    description: config.subtitle ?? 'Self-hosted service dashboard',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#09090b',
    icons,
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-store',
    },
  });
};
