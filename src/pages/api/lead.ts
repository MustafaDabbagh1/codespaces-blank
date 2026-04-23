import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { checkRateLimit } from '../../lib/rateLimit';

export const prerender = false;

const FORM_LABELS: Record<string, string> = {
  'contact-message': 'Contact — Send Us a Message',
  'contact-call-request': 'Contact — Schedule a Call',
  'clover-pricing': 'Clover Pricing Modal',
  'customer-support': 'Customer Support Ticket',
  'repair-demo': 'Repair Demo Request',
};

const MAX_TOTAL_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 10;

const ALLOWED_MIME = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
]);

const ALLOWED_EXT = new Set<string>([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif',
  'pdf', 'txt', 'log', 'csv', 'json', 'zip',
]);

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function isAllowedFile(file: File): boolean {
  const ext = extOf(file.name);
  if (!ALLOWED_EXT.has(ext)) return false;
  // If a MIME type is provided, it must also be in the allowlist.
  // Missing MIME (some browsers/clients omit it for .log/.txt) is acceptable
  // because the extension already passed the allowlist.
  if (file.type && !ALLOWED_MIME.has(file.type)) return false;
  return true;
}

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

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

type Attachment = { filename: string; content: Buffer; contentType?: string };

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
  const { allowed, retryAfter } = await checkRateLimit(ip);
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
  const attachments: Attachment[] = [];
  const contentType = request.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else {
      const fd = await request.formData();
      const obj: Record<string, unknown> = {};
      const fileEntries: File[] = [];
      for (const key of new Set(fd.keys())) {
        const all = fd.getAll(key);
        const strings = all.filter((v) => typeof v === 'string') as string[];
        if (strings.length > 0) {
          obj[key] = strings.length > 1 ? strings : strings[0];
        }
        for (const v of all) {
          if (v instanceof File && v.size > 0) fileEntries.push(v);
        }
      }
      payload = obj;

      if (fileEntries.length > MAX_FILES) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `Too many attachments. Please send up to ${MAX_FILES} files.`,
          }),
          { status: 413, headers: { 'Content-Type': 'application/json' } }
        );
      }

      let totalBytes = 0;
      for (const f of fileEntries) {
        if (!isAllowedFile(f)) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: `Unsupported file type: ${f.name}. Allowed: images, PDF, TXT, LOG, CSV, JSON, ZIP.`,
            }),
            { status: 415, headers: { 'Content-Type': 'application/json' } }
          );
        }
        totalBytes += f.size;
        if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: `Attachments exceed the 10 MB total limit.`,
            }),
            { status: 413, headers: { 'Content-Type': 'application/json' } }
          );
        }
        const buf = Buffer.from(await f.arrayBuffer());
        attachments.push({
          filename: f.name || 'attachment',
          content: buf,
          contentType: f.type || undefined,
        });
      }
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

  const attachmentsRowHtml = attachments.length
    ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#0C1A38;vertical-align:top">Attachments</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#1f2937">${attachments
        .map(
          (a) =>
            `${escapeHtml(a.filename)} <span style="color:#5b74a6">(${formatBytes(
              a.content.length
            )})</span>`
        )
        .join('<br/>')}</td></tr>`
    : '';

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
        ${attachmentsRowHtml}
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
      attachments: attachments.length
        ? attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
          }))
        : undefined,
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
