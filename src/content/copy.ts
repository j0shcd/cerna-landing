export type WaitlistError = 'invalid_email' | 'rate_limited' | 'save_failed';
export const copy = {
  brand: 'Cerna',
  title: 'Cerna — Life doesn’t fit in a spreadsheet.',
  description: 'Cerna reads your bank statements, drops the duplicates, converts every currency and categorizes each transaction.',
  skip: 'Skip to content',
  headline: { start: 'Life doesn’t fit', middle: 'in a ', strike: 'spreadsheet', end: '.' },
  subhead: 'Cerna reads your bank statements, drops the duplicates, converts every currency and categorizes each transaction. You check in, adjust course, and get back to living.',
  formula: '=SUMIFS(C:C, A:A, "Migros*", B:B, ">="&DATE(2026,10,1))',
  formulaRef: 'B2', fx: 'fx',
  form: {
    label: 'Email address', placeholder: 'you@example.com', button: 'Join the waitlist', busy: 'Joining…', company: 'Company',
    note: 'The last cell you fill in. One email when Cerna opens, nothing else.',
    success: (email: string) => `You’re on the list. We’ll write to ${email} when Cerna opens.`,
    redirectedSuccess: 'You’re on the list. We’ll write when Cerna opens.',
    errors: {
      invalid_email: 'That address looks incomplete. Check for a missing @ or a typo.',
      rate_limited: 'Too many tries from this connection. Please try again in a few minutes.',
      save_failed: 'We couldn’t save your address just now, so you’re not on the list yet. Please try again in a minute.',
    } satisfies Record<WaitlistError, string>,
  },
  featuresHeading: 'The tidying is Cerna’s job. The decisions stay yours.',
  features: [
    { title: 'Drop in your statements.', body: 'UBS PDFs, Revolut exports, whatever is easiest for you. Cerna reads them, notices the same payment arriving twice, and keeps it once. Every currency is converted at the rate of its own day.' },
    { title: 'It sorts. You nod.', body: 'Every transaction arrives with a category already suggested. Where Cerna is unsure, it says so and waits for you. Correct it once and it remembers.' },
    { title: 'Your month, in a minute.', body: 'A short read on what changed and why. No budget to police, no daily ritual. Then close the laptop.' },
  ],
  closing: 'Close the spreadsheet.',
  privacyTitle: 'Private by default.',
  privacy: 'Your statements are read to serve you, and no one else. We will never serve you ads, and never sell your data. Leave whenever you like and take everything with you.',
  copyright: '©', sample: 'Sample data', replay: 'Replay', check: '✓',
  statement: {
    label: 'Bank statements becoming categorized transactions', files: ['ubs-oct.pdf', 'revolut-oct.csv'],
    reading: 'Reading 2 statements…', done: 'Done · 4 transactions', summary: '1 duplicate merged · 1 converted',
    rows: [
      { raw: 'TWINT *MIGROS M ZUERICH HB 1210', clean: 'Migros', amount: 'CHF 46.20', category: 'Groceries', pigment: 'sage', note: '12 October' },
      { raw: 'COOP-3021 BASEL BAHNHOF', clean: 'Coop', amount: 'CHF 23.85', category: 'Groceries', pigment: 'sage', note: 'Duplicate merged' },
      { raw: 'COOP-3021 BASEL BAHNHOF', clean: 'Coop', amount: 'CHF 23.85', category: '', pigment: 'warm', note: 'Same payment · kept once', duplicate: true },
      { raw: 'REVOLUT*LIDL MILANO IT', clean: 'Lidl, Milano', amount: 'EUR 18.40', converted: 'CHF 17.21', category: 'Groceries', pigment: 'sage', note: 'EUR 18.40 × 0.9353' },
      { raw: 'CARD 4412 SBB CFF FFS ONLINE', clean: 'SBB', amount: 'CHF 64.00', category: 'Transport', pigment: 'slate', note: '14 October' },
    ],
  },
  import: {
    files: [{ name: 'ubs-sep.pdf', detail: 'UBS · PDF', rows: 142, duplicates: 3 }, { name: 'revolut-sep.csv', detail: 'Revolut · CSV · EUR', rows: 79, duplicates: 6 }],
    tray: 'Drop a sample statement here', rows: 'rows read', duplicates: 'duplicates set aside', conversion: 'EUR 42.80 → CHF 40.11', rate: 'rate of 14 September', added: 'Statement added',
  },
  categorize: {
    rows: [
      { merchant: 'Migros', amount: '−84.30', category: 'Groceries', pigment: 'sage' },
      { merchant: 'SBB', amount: '−42.00', category: 'Transport', pigment: 'slate' },
      { merchant: 'TWINT', amount: '−36.50', category: 'Restaurants', pigment: 'ochre', uncertain: true },
      { merchant: 'Coop', amount: '−12.95', category: 'Groceries', pigment: 'sage' },
    ],
    uncertain: '? Restaurants', categories: ['Restaurants', 'Groceries', 'Other'], menu: 'Category for TWINT', confirm: 'Confirm 4', confirmed: '4 confirmed', remember: 'Cerna will remember this.',
  },
  checkIn: {
    heading: 'September spending', total: "CHF 4'812", status: 'Within your usual', range: "Usual range: CHF 4'400–5'200",
    first: 'Restaurants CHF 140 above usual.', detail: 'Three more visits, similar bills.',
    second: 'Lisbon trip: EUR 612.40 converted at each day’s rate.', choices: ['One-off', 'Keep an eye on it'],
  },
  clutter: ['#REF!', 'dup? check UBS', '=SUMIF(C:C,…)', 'EUR 42.00', 'CHF 84.30', 'fix FX', '??', 'COOP-4521', 'Revolut', '=C41*0.937', '14.09.', 'TWINT *ANNA', '#VALUE!', 'copy from tab 2', 'CHF 249.00', 'SBB EASYRIDE'],
} as const;
