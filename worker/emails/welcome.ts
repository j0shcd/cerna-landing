// The welcome email sent to every new signup (owner's copy, 2026-10-22).
// Plain text first; the HTML version is the same words in the page's paper-and-ink look.
// Email clients cannot load the site's fonts or CSS variables, so colours are literal here.
const paragraphs = [
  'You’re officially on the waitlist for Cerna, your new financial assistant.',
  'We’re reimagining how people can stay on top of their finances. Our goal is that everyone can spend a little less time in spreadsheets and more time living free from money stress.',
  '👀 Keep an eye on your inbox. You’ll be invited to the app soon.',
  'Thanks for being here from the start.<br>We can’t wait to share what’s coming.',
];

export const welcomeSubject = 'You’re on the waitlist ✉️';

export function welcomeEmail(unsubscribeUrl: string): { subject: string; text: string; html: string } {
  const text = [
    'Hey there,',
    ...paragraphs.map(p => p.replace('<br>', '\n')),
    '— Josh',
    '',
    'Cerna · Based in Zurich',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n\n');

  const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  const p = (body: string) => `<p style="margin:0 0 16px;font:400 16px/1.55 ${sans};color:#17191c">${body}</p>`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${welcomeSubject}</title></head>
<body style="margin:0;padding:0;background:#fafaf7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf7"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 0 28px;font:600 22px/1 ${sans};letter-spacing:-0.02em;color:#17191c">Cerna</td></tr>
<tr><td style="padding:28px;background:#ffffff;border:1px solid #e4e5e0;border-radius:8px">
${p('Hey there,')}
${paragraphs.map(p).join('\n')}
<p style="margin:0;font:400 16px/1.55 ${sans};color:#17191c">— Josh</p>
</td></tr>
<tr><td style="padding:20px 4px 0;font:400 13px/1.6 ${sans};color:#6b7076">Cerna · Based in Zurich<br><a href="${unsubscribeUrl}" style="color:#6b7076;text-decoration:underline">Unsubscribe</a></td></tr>
</table></td></tr></table>
</body></html>`;

  return { subject: welcomeSubject, text, html };
}
