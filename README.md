# What changed this round

Per your instructions: nothing that already works was touched. Every
change below is additive or fixes something genuinely broken — listed
with the one small label-text exception called out explicitly.

## 1. View button on /donor/own-items — fixed (real bug)
The button's `onClick` was an empty function:
```tsx
onClick={async () => {
  // optional delete functionality placeholder
}}
```
It never did anything. Added a detail modal (`ItemDetailModal`) that
opens on click and shows the item's full info (quantity, date, org,
status, description, message). Nothing else on the page changed.

## 2. Org had no way to see/approve donor-item submissions — added
This is why donor-own-items never showed up as "requests" anywhere on
the org side: `getOrgDonations` only ever queried the `donations`
collection. Donor items live in a separate `donorItems` collection that
no org-facing screen ever looked at.

Added a new **"Donor Items"** tab to the existing Sponsorship Requests
page (`components/org/sponsorship-requests.tsx`), sitting alongside
All/Pending/Approved/Completed/Rejected. It's a fully self-contained
sub-component (`DonorItemsTab`) with its own data loading and its own
card UI — it does not share state, hooks, or render logic with the
existing donation tabs, so the existing tabs behave exactly as before.

Org can now Approve / Reject a pending donor item, and once Approved,
Mark Completed.

**The one unavoidable touch to existing rendering:** the whole tab strip
used to be hidden behind `{donations.length === 0 ? <empty state> : <Tabs>}`.
That meant if an org had zero regular donations, the new Donor Items tab
would never be reachable even if donor items existed. I widened that
condition so the tab strip (including Donor Items) always renders; the
original "No sponsorship requests yet" message still shows in exactly
the same way, just now living inside the "All" tab's content instead of
replacing the whole component. Orgs with existing donations see no
difference at all.

## 3. Donor item approval has no "Completed" step — added
`DonorItemDoc.status` was `"Pending" | "Approved" | "Rejected"` — no
final delivered/completed state, so there was no way to mark an item as
actually fulfilled (mirroring how regular donations go
Pending → Approved → Completed).

- Added `"Completed"` to the status type.
- Added `markDonorItemCompleted(itemId)` in `lib/firestore.ts` — only
  updates the `donorItems` doc, same as the existing
  `updateDonorItemStatus`. Never touches `requirements` or `slots`.
- Wired into the new "Mark Completed" button in the Donor Items tab.

## 4. Impact page counted non-completed donor items — fixed, with a label change
You said: *"items which are completed only should show."* Previously
`donorItemsCount` counted ALL donor items regardless of status, and
`mealsFunded` added in `Approved` items. Both now only count items with
`status === "Completed"`.

**One small UI text change, flagged explicitly:** the "My Items
Submitted" stat card's subtitle previously said *"Items you offered
directly"* — now that the number only counts Completed items, I changed
it to *"Completed items only"* so the label doesn't mislead (the old
text would now describe a number that's clearly not "all items you
offered"). If you'd rather keep the old subtitle text and just accept
the mismatch, revert that one line — everything else is unaffected.

## Files in this zip
```
lib/firestore.ts                          ← replace existing
components/org/sponsorship-requests.tsx   ← replace existing
app/donor/impact/page.tsx                 ← replace existing
app/donor/own-items/page.tsx              ← replace existing
```

## Still not addressed (separate from what you asked this round)
- `/donor/requests` and `/donor/donations` only ever show **regular**
  donations (the `donations` collection), never donor-items. That's
  expected — donor-items have their own page (`/donor/own-items`) and
  now their own org-side tab. If you want donor-items to ALSO show on
  `/donor/requests`, that's a separate, larger change (merging two
  different document shapes into one list) — let me know if you want
  that instead of/in addition to the separate own-items page.
- The `donorItems` Firestore collection still needs the rules block from
  the previous zip (`firestore.rules.ADD-THIS-BLOCK.txt`) added to your
  real `firestore.rules` and deployed, or reads/writes to it will fail
  with a permissions error regardless of any code fix.
