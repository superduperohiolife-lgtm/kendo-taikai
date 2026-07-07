# Kendo Tournament Management System — v0.2

GitHub Pages (frontend) + GAS Web App (API) + Google Sheets (DB).
English UI. Three access tiers.

---

## ⚠ Access keys (temporary — change before real use)

| Key | Value | Role |
|---|---|---|
| VIEW_KEY | `view2026` | View only |
| EDIT_KEY | `edit2026` | View + result entry |
| ADMIN_KEY | `admin2026` | Everything (all pre-match setup) |

Change: GAS editor → Project Settings → Script Properties → edit values (no redeploy needed).

The login screen detects the role automatically from whichever single key is entered.
Distribute the **View key** to most members; give Edit/Admin keys only to the few who need them.

---

## Files

```
gas/Code.gs        API (init, bracket gen, results, progression, 3-tier auth)
frontend/index.html  Login gate + View / Entry / Admin
frontend/app.js      API client, SVG bracket, placement routing, courts
frontend/style.css   Scoresheet theme, mobile-first
```

## Deploy (~10 min)

### A. Sheets + GAS
1. https://sheets.new → create spreadsheet
2. Extensions → Apps Script
3. Paste `gas/Code.gs`, save
4. Run `initSetup` once (creates 5 sheets + keys; check log)
5. Deploy → New deployment → Web app → Execute as **Me**, Access **Anyone**
6. Copy the `/exec` URL
   - On later edits: Manage deployments → edit existing → new version (keeps URL)

### B. GitHub Pages
1. New public repo (e.g. `kendo-taikai`)
2. Put the 3 `frontend/` files at repo root, push
3. Settings → Pages → main / root
4. Open `https://superduperohiolife-lgtm.github.io/kendo-taikai/`

### C. First use
1. On the login screen: paste the `/exec` URL + your key → Enter
2. Admin: create tournament → division → register players (or bulk-edit the sheet) →
   assign slots → (optional) set Placement→Elim routing → set courts
3. Edit: enter results during the event
4. View: watch the bracket update live

## What's new in v0.2

| # | Change |
|---|---|
| 1 | Duplicate tournament / division / player now rejected with an error |
| 2 | Bottom tab shows selected state by inversion (indigo fill) |
| 3 | 3-tier login gate; role auto-detected from key; tabs shown by permission; View is default & most common |
| 4 | Admin can set Placement→Elimination routing in advance ("Group 1 Winner → Elim E3 Red") |
| 5 | View split into Placement / Elimination / Match List; Elimination is an SVG bracket with connector lines (winner path in red), top=Red / bottom=White fixed |
| 6 | Courts editable per match (Placement & Elimination) |
| 7 | Entire UI in English |
| 8 | Player registration and all pre-match setup are Admin-only |
| 9 | Admin has a link to open the spreadsheet for bulk editing |
| 10 | Division pulldown shown only for View/Edit (hidden in Admin) |
| 11 | Mobile: player names wrap instead of truncating; team shown on a second line |

## Notes / limits

- Zoom / scroll controls on the Elimination view (±, Fit); large brackets scroll horizontally.
- Placement routing default = rotation offset (auto). Override any time before results.
- Slot assignment should be finalized before matches start; changing it after results exist requires undo.
- 3rd-place match: non-placement brackets only (unchanged).
- Double-tap the role badge (top-right) to log out / switch key.

## Next

- Phase 5: load the real Jr Youth Girls data and reconcile against the Excel result
- Phase 6: multiple divisions in parallel → team matches
