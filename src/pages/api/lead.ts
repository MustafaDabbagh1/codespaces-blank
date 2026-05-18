import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const prerender = false;

const HONEYPOT_FIELDS = ['website', '_gotcha', '_honey', 'website_url', 'company_website', 'hp_field', 'fax'];

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });

const prettyLabel = (key: string): string =>
  key
    .replace(/^_+/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim() || key;

const isEmail = (v: unknown): v is string =>
  typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const wantsJson = (request: Request): boolean => {
  const ctype = request.headers.get('content-type') || '';
  if (ctype.includes('application/json')) return true;
  const accept = request.headers.get('accept') || '';
  const xrw = request.headers.get('x-requested-with') || '';
  if (accept.includes('application/json') || xrw.toLowerCase() === 'xmlhttprequest') return true;
  // Browsers tag fetch() with Sec-Fetch-Dest: empty (and Mode: cors/same-origin);
  // a real <form> submit uses Dest: document and Mode: navigate.
  const dest = (request.headers.get('sec-fetch-dest') || '').toLowerCase();
  const mode = (request.headers.get('sec-fetch-mode') || '').toLowerCase();
  if (dest && dest !== 'document') return true;
  if (mode && mode !== 'navigate') return true;
  return false;
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

class BadRequestError extends Error {}

const readBody = async (request: Request): Promise<Record<string, unknown>> => {
  const ctype = request.headers.get('content-type') || '';
  if (ctype.includes('application/json')) {
    let parsed: unknown;
    try {
      parsed = await request.json();
    } catch {
      throw new BadRequestError('Invalid JSON body');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadRequestError('JSON body must be an object');
    }
    return parsed as Record<string, unknown>;
  }
  const form = await request.formData();
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    const value = typeof v === 'string' ? v : (v as File).name;
    if (k in out) {
      const existing = out[k];
      out[k] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      out[k] = value;
    }
  }
  return out;
};

export const POST: APIRoute = async ({ request, redirect }) => {
  const json = wantsJson(request);

  let data: Record<string, unknown> = {};
  try {
    data = await readBody(request);
  } catch (err) {
    const isBad = err instanceof BadRequestError;
    if (!isBad) console.error('[/api/lead] body parse error:', err);
    const status = isBad ? 400 : 400;
    const msg = isBad ? (err as Error).message : 'Invalid request body';
    return json
      ? jsonResponse({ ok: false, error: msg }, status)
      : new Response(msg, { status });
  }

  // Honeypot — silently accept and bail
  for (const hp of HONEYPOT_FIELDS) {
    const v = data[hp];
    if (typeof v === 'string' && v.trim() !== '') {
      return json ? jsonResponse({ ok: true }) : redirect('/thank-you', 303);
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.LEAD_TO_EMAIL;
  const fromEmail = process.env.LEAD_FROM_EMAIL;

  if (!apiKey || !toEmail || !fromEmail) {
    console.error('[/api/lead] missing env: RESEND_API_KEY / LEAD_TO_EMAIL / LEAD_FROM_EMAIL');
    return json
      ? jsonResponse({ ok: false, error: 'Email service not configured' }, 500)
      : new Response('Email service is not configured. Please contact support.', { status: 500 });
  }

  const formTag = typeof data._form === 'string' && data._form.trim()
    ? data._form.trim().slice(0, 80)
    : 'lead';
  // Prefer the form's own _subject (sanitized) when provided; otherwise build one.
  const rawSubject = typeof data._subject === 'string' ? data._subject.trim() : '';
  const cleanSubject = rawSubject.replace(/[\r\n]+/g, ' ').slice(0, 150);
  const subject = cleanSubject || `[PPD Lead] ${formTag}`;

  // Always include the source page URL — use _page if the form sent one,
  // otherwise fall back to the Referer header so emails always show origin.
  if (!data._page || (typeof data._page === 'string' && !data._page.trim())) {
    const referer = request.headers.get('referer');
    if (referer) data._page = referer;
  }

  const entries = Object.entries(data).filter(
    ([k, v]) =>
      !HONEYPOT_FIELDS.includes(k) &&
      v !== undefined &&
      v !== null &&
      String(v).length > 0
  );

  const rowsHtml = entries
    .map(([k, v]) => {
      const val = Array.isArray(v) ? v.join(', ') : String(v);
      return `<tr><td style="padding:6px 12px;font-weight:600;color:#1549FF;vertical-align:top;border-bottom:1px solid #eee">${escapeHtml(prettyLabel(k))}</td><td style="padding:6px 12px;white-space:pre-wrap;border-bottom:1px solid #eee">${escapeHtml(val)}</td></tr>`;
    })
    .join('');

  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;background:#f6f8ff;padding:24px"><div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;box-shadow:0 6px 24px rgba(20,40,90,.08)"><h2 style="margin:0 0 4px;color:#060E21">New ${escapeHtml(formTag)} submission</h2><p style="margin:0 0 16px;color:#555;font-size:13px">Submitted via ppdtechnology.com</p><table style="border-collapse:collapse;width:100%;font-size:14px">${rowsHtml || '<tr><td style="padding:6px 12px;color:#888">(no fields submitted)</td></tr>'}</table></div></body></html>`;

  const text = entries
    .map(([k, v]) => `${prettyLabel(k)}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');

  const replyTo = isEmail(data.email) ? data.email : undefined;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject,
      html,
      text,
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) {
      console.error('[/api/lead] Resend error:', error);
      return json
        ? jsonResponse({ ok: false, error: 'Failed to send email' }, 502)
        : new Response('Failed to send email. Please try again or contact support.', { status: 502 });
    }
  } catch (err) {
    console.error('[/api/lead] send exception:', err);
    return json
      ? jsonResponse({ ok: false, error: 'Server error' }, 500)
      : new Response('Server error. Please try again or contact support.', { status: 500 });
  }

  return json ? jsonResponse({ ok: true }) : redirect('/thank-you', 303);
};

export const GET: APIRoute = () =>
  new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });

export const ALL: APIRoute = ({ request }) => {
  if (request.method === 'POST' || request.method === 'GET') {
    return new Response(null, { status: 405 });
  }
  return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
};
