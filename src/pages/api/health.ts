import type { APIRoute } from 'astro';
import https from 'node:https';
import http from 'node:http';

/** HEAD-request a URL server-side, ignoring self-signed TLS certificates.
 *  Returns { online, ms } where ms is the round-trip time in milliseconds.
 */
function checkUrl(urlStr: string): Promise<{ online: boolean; ms: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    try {
      const url = new URL(urlStr);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: (url.pathname || '/') + url.search,
        method: 'HEAD',
        timeout: 6000,
        // Ignore self-signed / internal certificates
        ...(isHttps && { rejectUnauthorized: false }),
      };

      const req = lib.request(options, (res) => {
        const status = res.statusCode ?? 0;
        // 2xx/3xx = online; 401/403 = protected but alive; everything else (404, 5xx…) = offline
        const online = (status >= 200 && status < 400) || status === 401 || status === 403;
        resolve({ online, ms: Date.now() - start });
        res.resume(); // discard body
      });

      req.on('error', () => resolve({ online: false, ms: 0 }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ online: false, ms: 0 });
      });

      req.end();
    } catch {
      resolve({ online: false, ms: 0 });
    }
  });
}

export const GET: APIRoute = async ({ request }) => {
  const urlParam = new URL(request.url).searchParams.get('url');

  if (!urlParam) {
    return new Response(JSON.stringify({ online: false, error: 'Missing url param' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await checkUrl(urlParam);

  return new Response(JSON.stringify({ online: result.online, ms: result.ms }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
};
