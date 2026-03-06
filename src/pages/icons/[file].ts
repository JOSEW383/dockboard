import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { getIconsDir } from '../../lib/config';

const MIME: Record<string, string> = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
};

export const GET: APIRoute = async ({ params }) => {
  const file = params.file;

  // Security: reject path traversal attempts
  if (!file || file.includes('..') || file.includes('/')) {
    return new Response('Not found', { status: 404 });
  }

  const ext = extname(file).toLowerCase();
  const mime = MIME[ext];
  if (!mime) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const iconsDir = getIconsDir();
    const filePath = join(iconsDir, basename(file));
    const data = await readFile(filePath);

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
};
