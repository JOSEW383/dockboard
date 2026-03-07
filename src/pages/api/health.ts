import type { APIRoute } from 'astro';
import https from 'node:https';
import http from 'node:http';

/** HTTP request a URL server-side, ignoring self-signed TLS certificates.
 *  Returns { online, ms } where ms is the round-trip time in milliseconds.
 */
function makeRequest(
  urlStr: string,
  method: 'HEAD' | 'GET',
  start: number,
): Promise<{ online: boolean; ms: number }> {
  return new Promise((resolve) => {
    try {
      const url = new URL(urlStr);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: (url.pathname || '/') + url.search,
        method,
        timeout: 6000,
        // Ignore self-signed / internal certificates
        ...(isHttps && { rejectUnauthorized: false }),
      };

      const req = lib.request(options, (res) => {
        const status = res.statusCode ?? 0;
        const contentType = res.headers['content-type'] ?? '';
        res.resume(); // discard body

        // 2xx/3xx = online
        // 401/403 = protected but alive
        // 405 = server rejected HEAD method but is alive (caller should retry with GET)
        // 404 + application/json = live API with no root handler (e.g. microservices)
        // everything else = offline
        const online =
          (status >= 200 && status < 400) ||
          status === 401 ||
          status === 403 ||
          status === 405 ||
          (status === 404 && contentType.includes('application/json'));

        resolve({ online, ms: Date.now() - start, retryWithGet: status === 405 } as never);
      });

      req.on('error', () => resolve({ online: false, ms: 0 } as never));
      req.on('timeout', () => {
        req.destroy();
        resolve({ online: false, ms: 0 } as never);
      });

      req.end();
    } catch {
      resolve({ online: false, ms: 0 } as never);
    }
  });
}

async function checkUrl(urlStr: string): Promise<{ online: boolean; ms: number }> {
  const start = Date.now();
  const head = await makeRequest(urlStr, 'HEAD', start) as { online: boolean; ms: number; retryWithGet?: boolean };

  // If the server returned 405 (Method Not Allowed for HEAD), retry with GET
  if (head.retryWithGet) {
    return makeRequest(urlStr, 'GET', start);
  }

  return { online: head.online, ms: head.ms };
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
