# Design review: the D5 rebuild (2026-10-21)

Status: input for an owner decision; nothing here is decided.

Target: the landing page as rebuilt on D5 (commit `3bc579c`). Method: the `adversarial-design-review` skill. One evidence packet (screenshots at 390/768/1024/1440, intro frames, interaction states, reduced motion, measured targets and contrast), three independent Opus critics (message and comprehension; visual craft; interaction and motion), every geometric or behavioural claim re-measured in the browser before it was kept. No new Codex research run was needed; the skill's own research (`~/.agents/skills/adversarial-design-review/references/`) supplied the criteria.

## Where the critics agree (independently)

1. **The form error sits too far from the field** (craft, interaction). The error appears under the helper note, about 45px below the input, and the field keeps its blue focus border. Measured defect.
2. **The demo data is not one consistent story** (message, craft). The hero shows `CHF 46.20` and `-oct` files; beat 2 shows `−84.30` with no currency; beat 3 says September. Spreadsheet users notice this kind of seam.
3. **The demos should state an outcome for each choice** (message, interaction). In beat 2, "Confirm all 4" is active while TWINT is still "Restaurants?" and "1 to check", which contradicts "where Cerna is unsure, it waits for you". In beat 3, pressing "One-off" changes only the button.
4. **What to preserve** (all three): the live strikethrough headline; the raw bank strings tidying into Swiss merchants with CHF and the visible `EUR 18.40 at 0.9353`; "your rule: SBB → Transport" and "same as last 14 times" as proof that categories learn; the single-field form with the "fx" nod and the "last cell" note; restrained palette where the pastel pills are the only colour besides indigo; reduced-motion parity.

## Measured defects (verified in the browser)

| # | Finding | Evidence | Change |
|---|---|---|---|
| D1 | Layout shift about 3.5s after load: the hero card renders 5 rows during the intro, the duplicate collapses, the card loses about 74px and the next section moves up while in view | intro frames 2600 vs 6500ms | Keep the card height constant (see decision B) |
| D2 | On phones the tidy sequence plays below the fold, so phone visitors only see the finished state | sequence starts 1s after load regardless of visibility; at 390 the card starts at the bottom of the fold | Start it when the card is half visible (D5 did this) |
| D3 | The formula caret blinks for 6.6s; WCAG 2.2.2 asks for blinking to stop within 5s | `animation: blink 1.1s steps(1) 6` | Three blinks, then still |
| D4 | Demo controls are below 44px tall: the "Restaurants?" pill is 28px, the beat-3 choices are 32px | `checks.json` | Pad the hit area to 44px without changing the look |
| D5 | Muted text on the grey header bands is 4.41:1 ("Done · 4 transactions", "overlap ignored") | measured contrast | Darken `--muted` slightly on `--cell-head` |
| D6 | Beat 2 lets you confirm an unsure guess | see "Where the critics agree", item 3 | "Confirm 3" until TWINT is picked, then "Confirm all 4" |

## Bets and changes (need an owner call)

- **A. Put the content on the spreadsheet grid.** Today the grid lines sit at x=55, 156… while the content edge is x=136 and the card's right edge is x=1304. The header uses a different container from the content. These offsets come from D5 itself. Aligning the columns to the content edges would make the backdrop look structural rather than like wallpaper (craft critic). This departs from D5 pixel-for-pixel, but not in spirit.
- **B. Leave the merged duplicate visible.** Make the settled state keep a faded, struck-through second Coop row ("also in revolut-oct.csv · kept once") rather than collapsing it. Dedupe is the claim a spreadsheet user cares about most, and today it shows only as a label. This also fixes D1, because the card never changes height. It departs from D5, where the row disappears.
- **C. Unify the demo data.** Use October everywhere, `CHF` with a sign convention shared by all four visuals, and give each choice a result line ("Noted. Cerna won't flag this again.").
- **D. Make the demo's dark Confirm button an outline**, so indigo remains the only filled primary action. Small.

## Tensions with owner decisions, stated as choices

- **"1-1 with D5" against the grid alignment (A) and the persistent duplicate (B).** Both are departures from D5's pixels. Both serve its idea.
- **Bank coverage.** Only UBS and Revolut appear anywhere. A PostFinance or ZKB customer may conclude "not for me" (message critic). Any line about this needs the owner's words and has to be true at launch, for example "Starting with UBS and Revolut." Today the owner's copy deliberately says "whatever is easiest for you".
- **Not taken up:** the craft critic suggested tighter body leading (1.45 instead of D5's 1.55) and removing the card border under each beat's rule. Both are D5's own choices and are taste; they stay unless the owner wants them changed.

## Cheapest real tests

- A five-second test with five Swiss people who track money in a spreadsheet, using one screenshot at 1440 and one at 390. Ask "What does it do?", "Would it work with your bank?" and "What did Cerna do to Coop?". This settles B and the bank-coverage question.
- On the live page, ask the same people to "tell Cerna TWINT was dinner" in beat 2, and watch whether they find the dashed pill or press Confirm first. This settles D6.

## Condensed critiques

- **Message:** the page is clear in five seconds at both widths. The proof comes from the Swiss specifics (Migros, TWINT, `4'812`, the SUMIFS bar); without them the headline and the closing would fit any budgeting app. Nothing on the page overpromises. "Take everything with you" must be true at launch.
- **Craft:** no P1 findings. The issues are edges and consistency. The memorable decision is already there: the strikethrough together with the tidying card.
- **Interaction:** the intro holds nothing back (the form is usable at about 1.5s). The clutter is up for under 0.9s, so it may read as a flash rather than a mess (hypothesis; check with a frame-by-frame recording).
