// Placeholders are written in double curly braces. `npm run check:legal` fails (and blocks deploy)
// while any remain. Every one needs a fact only the operator can supply.
export interface LegalSection { heading: string; paragraphs?: string[]; items?: string[] }
export interface LegalDoc { title: string; updated: string; intro: string; sections: LegalSection[] }

export const privacy: LegalDoc = {
  title: 'Privacy notice',
  updated: '2026-10-20',
  intro: 'This notice covers this website and the waitlist. It does not cover the Cerna product itself, which will have its own notice before anyone uses it.',
  sections: [
    {
      heading: 'Who is responsible',
      paragraphs: ['{{LEGAL_NAME}}, {{STREET}}, {{POSTCODE_CITY}}, Switzerland. Contact: {{CONTACT_EMAIL}}.'],
    },
    {
      heading: 'What we collect when you join the waitlist',
      items: [
        'Your email address, as you typed it (we lower-case it and trim spaces).',
        'The time you joined.',
        'The wording you agreed to, "One email when Cerna opens, nothing else.", and its version.',
      ],
      paragraphs: ['We do not collect your name, your device details, your location or anything else about you from the form.'],
    },
    {
      heading: 'What we do with it',
      paragraphs: [
        'We use your address to write to you once, when Cerna opens, and to tell you what you need to try it. When someone joins, we also get an email telling us the new address, so we can see the list is working.',
        'You asked for this by joining. You can withdraw at any time (see "Your rights").',
        'We do not show ads and we do not sell or rent your address.',
      ],
    },
    {
      heading: 'Protecting the form from abuse',
      paragraphs: [
        'To stop automated sign-ups we count attempts per connection. We keep only a one-way scrambled version of your IP address for that count, not the address itself, and it is deleted after about two days. We do not store your browser details.',
      ],
    },
    {
      heading: 'Who else handles your data',
      items: [
        'Cloudflare hosts this site and stores the waitlist in a database set to the EU jurisdiction. Cloudflare is a US company; {{CLOUDFLARE_TRANSFER_BASIS}}.',
        'Brevo (a French company, servers in the EU) sends the notification email to us. It does not email you.',
        'Our own mailbox, hosted by Google, receives that notification and so holds each new address; {{GOOGLE_TRANSFER_BASIS}}.',
      ],
      paragraphs: ['These providers act on our instructions. We do not share your address with anyone else.'],
    },
    {
      heading: 'How long we keep it',
      paragraphs: ['{{RETENTION_PERIOD}}. After that, or earlier if you ask, we delete your address from the waitlist and from our mailbox.'],
    },
    {
      heading: 'Cookies and tracking',
      paragraphs: [
        'This site sets no cookies, runs no analytics and loads nothing from other companies, including fonts. Your browser keeps one small note in the tab, saying the opening animation has already played; it never leaves your browser and disappears when you close the tab.',
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: [
        'You can ask us what we hold about you, correct it, delete it, or withdraw your agreement, and you can ask for a copy of it. Email {{CONTACT_EMAIL}}; we will answer within 30 days. Deleting your address means we will not write to you when Cerna opens.',
        'If you think we have handled your data wrongly, you can complain to the Federal Data Protection and Information Commissioner (FDPIC) in Switzerland, or to the data protection authority where you live.',
      ],
    },
    {
      heading: 'Changes',
      paragraphs: ['If we change this notice in a way that matters to you, we will update the date above and, if it affects what you agreed to, tell you by email.'],
    },
  ],
};

export const impressum: LegalDoc = {
  title: 'Impressum',
  updated: '2026-10-20',
  intro: 'Legal notice for this website.',
  sections: [
    {
      heading: 'Operator',
      paragraphs: ['{{LEGAL_NAME}}', '{{STREET}}', '{{POSTCODE_CITY}}', 'Switzerland'],
    },
    { heading: 'Contact', paragraphs: ['{{CONTACT_EMAIL}}'] },
    { heading: 'Register entry', paragraphs: ['{{REGISTER_ENTRY_OR_REMOVE_SECTION}}'] },
  ],
};
