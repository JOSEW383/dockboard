import type { APIRoute } from 'astro';
import { loadConfig } from '../../lib/config';

export const GET: APIRoute = async () => {
  try {
    const config = await loadConfig();
    return Response.json(config, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[dockboard] Failed to load config.yml:', err);
    return Response.json(
      { error: 'Failed to load configuration' },
      { status: 500 }
    );
  }
};

// Re-export types for convenience
export type { ServiceItem, Section, DockboardConfig } from '../../lib/config';
