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
): Promise<{ online: boolean; ms: number; retryWithGet?: boolean }> {
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
        res.resume(); // discard body

        // Consider service online for any non-5xx HTTP response.
        // Mark offline for server errors (5xx), network errors, DNS errors and timeouts.
        const online = status > 0 && status < 500;

        resolve({ online, ms: Date.now() - start, retryWithGet: status === 405 });
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

async function checkUrl(urlStr: string): Promise<{ online: boolean; ms: number }> {
  const start = Date.now();
  const head = await makeRequest(urlStr, 'HEAD', start);

  // Retry with GET when HEAD is not supported (405) or HEAD fails at transport
  // level (some services close the connection on HEAD but answer GET).
  if (head.retryWithGet || (!head.online && head.ms === 0)) {
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
