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
  const skip = new Set(['_form', '_subject', 'website']);
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
