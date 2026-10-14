import { request } from 'node:https';

export interface HttpResponse {
  status: number;
  /** Header names in lower case. */
  headers: Record<string, string>;
  body: string;
}

export type Transport = (url: string, headers: Record<string, string>, timeoutMs: number) => Promise<HttpResponse>;

/**
 * GET over node:https with a hard deadline for the whole exchange. node:https rather than
 * fetch, so the bundle runs on whichever Node runtime the Alexa-hosted Lambda has.
 */
export const httpsGet: Transport = (url, headers, timeoutMs) =>
  new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET', headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        clearTimeout(timer);
        const out: Record<string, string> = {};
        for (const [name, value] of Object.entries(res.headers)) {
          if (value !== undefined) out[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
        }
        resolve({ status: res.statusCode ?? 0, headers: out, body: Buffer.concat(chunks).toString('utf8') });
      });
      res.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    const timer = setTimeout(() => req.destroy(new Error('timeout')), timeoutMs);
    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    req.end();
  });
