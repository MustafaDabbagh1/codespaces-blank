import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const prerender = false;

const FORM_LABELS: Record<string, string> = {
  'contact-message': 'Contact — Send Us a Message',
  'contact-call-request': 'Contact — Schedule a Call',
  'clover-pricing': 'Clover Pricing Modal',
  'customer-support': 'Customer Support Ticket',
  'repair-demo': 'Repair Demo Request',
};

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderRows(data: Record<string, unknown>): string {
  const skip = new Set(['_form', '_subject', 'website', 'cf-turnstile-response']);
  const rows: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (skip.has(k)) continue;
    if (v === undefined || v === null || v === '') continue;
    const value = Array.isArray(v) ? v.join(', ') : String(v);
    rows.push(
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#0C1A38;vertical-align:top;text-transform:capitalize">${escapeHtml(k)}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#1f2937;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`
    );
  }
  return rows.join('');
}

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const rateLimitBuckets = new Map<string, number[]>();

function getClientIp(request: Request): string {
  // Prefer headers set by trusted ingress proxies (Cloudflare, Replit/nginx)
  // over the client-controllable x-forwarded-for, which can be spoofed and
  // would let an attacker rotate "IPs" per request to bypass the limiter.
  const trusted =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip');
  if (trusted) return trusted.trim();

  // Fall back to the last hop in x-forwarded-for: the value appended by our
  // own ingress is harder to forge than the leftmost (client-supplied) entry.
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const hits = (rateLimitBuckets.get(ip) || []).filter((t) => t > cutoff);

  if (rateLimitBuckets.size > 5000) {
    for (const [k, v] of rateLimitBuckets) {
      const fresh = v.filter((t) => t > cutoff);
      if (fresh.length === 0) rateLimitBuckets.delete(k);
      else rateLimitBuckets.set(k, fresh);
    }
  }

  if (hits.length >= RATE_LIMIT_MAX) {
    const retryAfter = Math.max(
      1,
      Math.ceil((hits[0] + RATE_LIMIT_WINDOW_MS - now) / 1000)
    );
    return { allowed: false, retryAfter };
  }

  hits.push(now);
  rateLimitBuckets.set(ip, hits);
  return { allowed: true, retryAfter: 0 };
}

function getAllowedHosts(request: Request): Set<string> {
  const hosts = new Set<string>();
  const envHosts = process.env.LEAD_ALLOWED_HOSTS;
  if (envHosts) {
    for (const h of envHosts.split(',')) {
      const trimmed = h.trim().toLowerCase();
      if (trimmed) hosts.add(trimmed);
    }
  } else {
    hosts.add('ppdtechnology.com');
    hosts.add('www.ppdtechnology.com');
  }
  const replitDomain = process.env.REPLIT_DEV_DOMAIN;
  if (replitDomain) hosts.add(replitDomain.toLowerCase());
  const selfHost = request.headers.get('host');
  if (selfHost) hosts.add(selfHost.toLowerCase());
  return hosts;
}

async function verifyTurnstile(
  token: string,
  ip: string
): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: true };
  }
  if (!token) {
    return { ok: false, error: 'Missing CAPTCHA token.' };
  }
  try {
    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', token);
    if (ip && ip !== 'unknown') body.set('remoteip', ip);

    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body }
    );
    if (!res.ok) {
      console.error('[lead] Turnstile siteverify HTTP error:', res.status);
      return { ok: false, error: 'CAPTCHA verification failed.' };
    }
    const data = (await res.json()) as {
      success?: boolean;
      'error-codes'?: string[];
    };
    if (!data.success) {
      console.warn('[lead] Turnstile rejected token:', data['error-codes']);
      return { ok: false, error: 'CAPTCHA verification failed.' };
    }
    return { ok: true };
  } catch (err) {
    console.error('[lead] Turnstile verification error:', err);
    return { ok: false, error: 'CAPTCHA verification failed.' };
  }
}

function isOriginAllowed(request: Request): boolean {
  const allowed = getAllowedHosts(request);
  const candidates = [
    request.headers.get('origin'),
    request.headers.get('referer'),
  ].filter((v): v is string => !!v);

  if (candidates.length === 0) return false;

  for (const raw of candidates) {
    try {
      const host = new URL(raw).host.toLowerCase();
      if (allowed.has(host)) return true;
    } catch {
      // ignore unparsable header
    }
  }
  return false;
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.LEAD_TO_EMAIL;
  const fromEmail = process.env.LEAD_FROM_EMAIL;

  if (!apiKey || !toEmail || !fromEmail) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Email service not configured.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!isOriginAllowed(request)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Request origin not allowed.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const ip = getClientIp(request);
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Too many requests. Please try again later.',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
        },
      }
    );
  }

  let payload: Record<string, unknown> = {};
  const contentType = request.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else {
      const fd = await request.formData();
      const obj: Record<string, unknown> = {};
      for (const key of new Set(fd.keys())) {
        const all = fd.getAll(key).filter((v) => typeof v === 'string') as string[];
        obj[key] = all.length > 1 ? all : all[0] ?? '';
      }
      payload = obj;
    }
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid request body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const captchaToken = String(payload['cf-turnstile-response'] || '');
  const captcha = await verifyTurnstile(captchaToken, ip);
  if (!captcha.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: captcha.error || 'CAPTCHA failed.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Honeypot
  if (payload.website && String(payload.website).trim() !== '') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const formKey = String(payload._form || 'unknown').trim();
  const label = FORM_LABELS[formKey] || `Lead — ${formKey}`;
  const subject = String(payload._subject || `New ${label}`);
  const replyTo =
    typeof payload.email === 'string' && payload.email.includes('@')
      ? payload.email
      : undefined;

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f8ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(6,14,33,.08)">
    <div style="background:linear-gradient(135deg,#1549FF,#00CFFF);padding:20px 24px;color:#fff">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">PPD Technology</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px">${escapeHtml(label)}</div>
    </div>
    <div style="padding:8px 12px 24px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${renderRows(payload)}
      </table>
    </div>
    <div style="padding:14px 24px;background:#f5f8ff;font-size:12px;color:#5b74a6">
      Submitted from ${escapeHtml(String(payload._page || request.headers.get('referer') || 'ppdtechnology.com'))}
    </div>
  </div>
</body></html>`;

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject,
      html,
      replyTo,
    });

    if (error) {
      console.error('[lead] Resend error:', error);
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to send email.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[lead] Unexpected error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Failed to send email.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
