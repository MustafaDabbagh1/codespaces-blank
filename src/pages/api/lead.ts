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
  'restaurants-demo': 'Restaurants — Demo Request',
  'healthcare-demo': 'Healthcare — Demo Request',
  'contractors-demo': 'Contractors — Demo Request',
  'korona-demo': 'KORONA POS — Demo Request',
  'pays-pos-demo': 'Pays POS — Demo Request',
  'vp-800-demo': 'VP800 — Demo Request',
  'mx-build-demo': 'MX Build — Demo Request',
  'become-a-partner': 'Become a Partner — Application',
  'merchant-signup': 'Merchant Processing Application',
  'refer-program': 'Referral Program — New Referral',
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

type ReceiptCopy = {
  subject: string;
  heading: string;
  intro: string;
  nextSteps: string[];
};

function getReceiptCopy(formKey: string, label: string): ReceiptCopy {
  const isDemo =
    formKey.endsWith('-demo') ||
    formKey === 'clover-pricing' ||
    formKey === 'contact-call-request';
  const isApplication =
    formKey === 'become-a-partner' || formKey === 'merchant-signup';
  const isReferral = formKey === 'refer-program';
  const isSupport = formKey === 'customer-support';

  if (isReferral) {
    return {
      subject: 'We received your referral — PPD Technology',
      heading: 'Thanks for your referral!',
      intro:
        "We've received the referral details you submitted. Our partner team will reach out to your contact shortly and keep you posted on their progress.",
      nextSteps: [
        'A partner specialist will contact your referral within 1–2 business days.',
        "We'll email you once the referral has been engaged so you can track its status.",
        "If we need more context to make the introduction, we'll reply to this email.",
      ],
    };
  }

  if (isApplication) {
    return {
      subject: `We received your application — ${label}`,
      heading: 'Thanks for applying!',
      intro:
        "We've received your application and a member of our onboarding team is already reviewing it. A copy of what you submitted is below for your records.",
      nextSteps: [
        'Our team will review your application within 1 business day.',
        "We may reply to this email if we need additional information or documentation.",
        "Once approved, you'll receive next-step instructions to get fully set up.",
      ],
    };
  }

  if (isSupport) {
    return {
      subject: 'We received your support request — PPD Technology',
      heading: 'Your support ticket has been received',
      intro:
        "Thanks for reaching out. Our support team has received your ticket and will follow up as soon as possible. A copy of what you submitted is below for your records.",
      nextSteps: [
        'A support specialist will reply to this email with next steps.',
        'Please reply to this thread if you have any additional details to share.',
        'For urgent issues, you can also call our support line during business hours.',
      ],
    };
  }

  if (isDemo) {
    return {
      subject: `We received your demo request — ${label}`,
      heading: 'Thanks for requesting a demo!',
      intro:
        "We've received your request and a product specialist will be in touch shortly to schedule your personalized walkthrough. A copy of what you submitted is below for your records.",
      nextSteps: [
        'A specialist will reach out within 1 business day to coordinate a time.',
        "We'll tailor the demo to the use case and questions you shared.",
        "If your timeline shifts, just reply to this email and we'll adjust.",
      ],
    };
  }

  return {
    subject: `We received your message — ${label}`,
    heading: 'Thanks for reaching out!',
    intro:
      "We've received your message and a member of our team will get back to you shortly. A copy of what you submitted is below for your records.",
    nextSteps: [
      'A member of our team will reply within 1 business day.',
      'Feel free to reply to this email with any additional details.',
    ],
  };
}

function buildReceiptHtml(
  copy: ReceiptCopy,
  label: string,
  payload: Record<string, unknown>
): string {
  const stepsHtml = copy.nextSteps
    .map(
      (s) =>
        `<li style="margin-bottom:6px;color:#1f2937">${escapeHtml(s)}</li>`
    )
    .join('');

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f8ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(6,14,33,.08)">
    <div style="background:linear-gradient(135deg,#1549FF,#00CFFF);padding:24px;color:#fff">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">PPD Technology</div>
      <div style="font-size:22px;font-weight:700;margin-top:6px">${escapeHtml(copy.heading)}</div>
      <div style="font-size:13px;margin-top:6px;opacity:.9">${escapeHtml(label)}</div>
    </div>
    <div style="padding:20px 24px 8px">
      <p style="margin:0 0 16px;color:#1f2937;font-size:14px;line-height:1.6">${escapeHtml(copy.intro)}</p>
      <div style="font-size:13px;font-weight:700;color:#0C1A38;text-transform:uppercase;letter-spacing:.06em;margin:18px 0 8px">What happens next</div>
      <ul style="padding-left:20px;margin:0 0 16px;font-size:14px;line-height:1.5">${stepsHtml}</ul>
      <div style="font-size:13px;font-weight:700;color:#0C1A38;text-transform:uppercase;letter-spacing:.06em;margin:18px 0 8px">What you submitted</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;border-top:1px solid #e5e7eb">
        ${renderRows(payload)}
      </table>
    </div>
    <div style="padding:14px 24px;background:#f5f8ff;font-size:12px;color:#5b74a6">
      This is an automated confirmation from PPD Technology. If you did not submit this form, please ignore this email.
    </div>
  </div>
</body></html>`;
}

function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  // Simple, conservative check — avoid sending receipts to obviously bad addresses.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
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

    // Send a branded confirmation receipt to the visitor. This is best-effort:
    // any failure here is logged but must not affect the response, since the
    // internal lead email has already been delivered successfully.
    if (isValidEmail(payload.email)) {
      const visitorEmail = (payload.email as string).trim();
      const copy = getReceiptCopy(formKey, label);
      const receiptHtml = buildReceiptHtml(copy, label, payload);
      try {
        const { error: receiptError } = await resend.emails.send({
          from: fromEmail,
          to: [visitorEmail],
          subject: copy.subject,
          html: receiptHtml,
          replyTo: toEmail,
        });
        if (receiptError) {
          console.error('[lead] Visitor receipt send error:', receiptError);
        }
      } catch (receiptErr) {
        console.error('[lead] Visitor receipt unexpected error:', receiptErr);
      }
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
