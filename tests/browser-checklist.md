# Browser acceptance checks

Use only `demo-calendar-checkin` on the local Firestore Emulator for writes.

- Calendar: current Vietnam month, Monday-first, current date highlight, previous/next year boundary, Today button, exact date links, three avatars plus +N.
- Subscription: switch months quickly, old results never replace current month; retry errors; cache/offline distinguished from confirmed empty.
- Layout: 320px, 360px and desktop, no horizontal scroll, visible keyboard focus.
- Detail: invalid date blocks writes, five cards in two columns, selection alone never writes, explicit Check-in button only.
- Guests: inline form, Vietnamese names, invalid/empty/too-long/HTML names rejected, failed submission retains input, success clears input.
- Server confirmation: offline write stays pending, no successful badge; reconnect confirms once, no duplicate guest document.
- Realtime: second tab sees new check-in, reload preserves it, concurrent member attempts cannot create a second document.
- Lifecycle: browser back/forward restores live subscription exactly once; links preserve month and local emulator flag.
- Initialization: block Firebase CDN requests, show a readable error instead of endless loading.

Automated results and remaining manual checks are recorded in README after verification.
