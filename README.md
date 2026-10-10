# TEM Store

Second Nature cookies, gadgets, kid toys, a discreet category, and a members-only Vault — one Node.js/Express/PostgreSQL/Sequelize/EJS/Tailwind storefront.

## Stack
- Node.js + Express
- PostgreSQL + Sequelize ORM
- EJS templates + express-ejs-layouts
- Tailwind CSS
- Paystack for payments
- Postgres-backed sessions (guest carts persist across visits)

## Recent additions
- **Role-based redirects**: staff land in the right part of `/admin` on login; customers go to the store (or wherever they were headed). Already-logged-in visitors are bounced away from `/login` and `/register`.
- **Riders & logistics**: a `rider` role, rider assignment on home-delivery orders (`/admin/orders/:id/assign-rider`), a rider dashboard at `/admin/rider` to start/complete deliveries, and a customer-facing confirmation code the rider must collect before marking a delivery complete.
- **Refunds**: cancelling a paid online order automatically refunds it via Paystack (POS/cash sales are untouched — only online, Paystack-paid orders).
- **Third-party products** (e.g. Oriflame): set `fulfillmentType: 'third_party'` and a `leadTimeDays` on a product in `/admin/products`. These skip branch stock checks entirely and stamp the order with an `expectedReadyAt` date shown to the customer.
- **Cart stepper**: "Add to Cart" becomes a live +/- stepper once an item's in the cart, everywhere a product card appears — no page reload.
- **Mobile bottom nav** for logged-in customers (Home/Shop/Cart/Orders/Profile).
- **New public pages**: `/profile` (edit details + password), `/locations` (all pickup kiosks), `/team`, `/apply/rider` (application form → admin review at `/admin/rider-applications` → approving creates a rider login), `/investors`.
- **Admin product creation**: `/admin/products` — add new catalog items directly (not just via the seed script), with optional initial branch stock.
- **Color scheme**: lemon green and gold, applied via the same design tokens (`cocoa`, `caramel`, `forest`, etc.) so no view markup needed to change.

## Logistics as its own function
Logistics no longer lives inside `Order` — it runs on its own `Shipment` entity (`models/Shipment.js`), loosely linked back to an order via a nullable `orderId`. This is the seam that lets logistics operate as a distinct function inside TEM Store today, and potentially serve other businesses later, without TEM Store's order system needing to change: a `Shipment` optionally has `source: 'external'` with `externalClientName`/`externalReference` instead of an order at all. Every part of the logistics flow — the dispatch queue, rider assignment, the rider's manifest — works off `Shipment`, not `Order`.

**The flow, by role:**
1. **Inventory managers / branch managers** (`/admin/logistics/process`, own branch only): see paid/processing home-delivery orders at their branch, click **Mark Ready for Shipment** to turn one into a `Shipment` (this builds the manifest from the order's line items and copies over the delivery address/confirmation code). They can also assign a rider from their own branch right there.
2. **Logistics HOD** (`/admin/logistics/queue`, `logistics` role or `super_admin`): sees every shipment awaiting dispatch or already moving, across **every branch** — this is the actual "waiting for shipment" queue — and can assign or reassign any rider to any shipment.
3. **Riders** (`/admin/rider`): see only their own assigned shipments, each showing the full manifest ("2x Classic Chocolate Chip, 1x Wireless Earbuds Pro"), recipient, and address. They tap **Start Delivery**, then **Complete** by entering the code the recipient reads off their order page — that's the proof-of-ownership step.

Order status stays in sync automatically for the customer-facing order page (`processing` → `out_for_delivery` → `completed`) as the underlying shipment moves through its lifecycle, via `services/logisticsService.js`.

## Product home delivery is priced per city, not per state
A state can have wildly different delivery costs depending on which LGA/city within it you're shipping to, so `DeliveryZone` is keyed by **city + state**, not state alone. Manage it at `/admin/delivery-zones` (super_admin) — add a city, set its fee and estimated delivery time, toggle it on/off. Seeded to start with just Calabar Municipal and Calabar South, each priced separately; add more cities (and eventually other states) the same way, whenever you're ready to expand.

At checkout, the customer picks a **state**, which filters a **city** dropdown — both are populated entirely from this table, so there's no free-text city field to mistype or to select somewhere you don't actually deliver to. The delivery fee previews live as soon as a city is picked. This same data also drives the public `/where-we-ship` page (alongside the separate walk-in courier pricing), so what a customer sees at checkout always matches what's advertised publicly.

The branch-fulfillment algorithm now also prefers a branch in the **same city** first, before falling back to same-state, then nationwide.

## Walk-in courier bookings (external shipments)
This is where "logistics as its own function" becomes concrete: a `Shipment` doesn't need a TEM Store order behind it at all. Branch staff or the logistics HOD can book a standalone delivery for a customer who just wants to send a package — nothing to do with a product purchase.

- **`/admin/logistics/book`** (branch staff and logistics HOD): sender/recipient details, destination, package size, and what's being sent. Fee is calculated live from the selected **courier zone** — a flat base fee that covers a negligible-size package (documents, small envelopes), plus a surcharge if it's medium or large. Submitting shows a confirmation screen with the code to give the sender.
- **`/admin/courier-zones`** (super_admin): manage the destinations and their pricing — this is also what powers the public **`/where-we-ship`** page, so pricing only needs to be set in one place.
- These bookings land in the same dispatch queue and process pages as TEM Store order shipments, get assigned to the same riders, and go through the same start/complete-with-code flow — a rider can't tell the difference between delivering cookies and delivering someone's documents, which is the point.

## Market-readiness batch (payments, notifications, images, growth tools)

**Paystack webhooks** — `POST /webhooks/paystack` is the safety net for payment confirmation: it's registered *before* `express.json()` in `server.js` and parses its own raw body (`express.raw()`) so Paystack's HMAC-SHA512 signature can be verified against the exact bytes sent. Both the webhook and the browser redirect (`/checkout/callback`) call the same `services/paymentService.js` functions, which check `paymentStatus` before doing anything — so it doesn't matter which one fires first, or if both do.

**Email notifications (Brevo)** — `services/emailService.js` is the single place every outgoing email goes through. Wired in at: order confirmation (on payment success), order status changes (admin updates status → customer gets emailed), rider assignment (rider gets emailed the moment they're assigned), vault expiry reminders (see scheduler below), email verification, and the contact form (now actually sends, instead of just showing "received"). A missing `BREVO_API_KEY` never breaks a request — it logs a warning and moves on.

**Cloudinary image uploads** — `services/cloudinaryService.js` + `multer` (memory storage). Wired into product creation (`/admin/products`) and the new team page manager (`/admin/team`) — both accept a real file upload now, with a URL field kept as a fallback for products.

**Email verification (soft)** — registering sends a verification email with a token link (`/verify-email?token=...`). It does **not** block login or checkout — the account works immediately either way. The profile page shows a banner with a resend button if unverified. If you want it to be a hard requirement before checkout, that's a small change to `middleware/auth.js`'s `requireAuth`.

**Discount codes** — `/admin/discounts` to create percent or flat codes with optional minimum order, max uses, and expiry. Applied and validated at checkout before the Paystack charge is created; usage count increments only once the order is actually created (not on failed attempts).

**Rider earnings** — every shipment gets a `riderPayout` computed at creation time (a configurable percentage — `RIDER_PAYOUT_PERCENT` — of the delivery/courier fee). Riders see a full breakdown at `/admin/rider/earnings`: today, this week, all-time, and what's still unpaid out.

**Sales & ops reporting** — `/admin/reports` (super_admin): revenue-by-day bar chart, top products by quantity/revenue, revenue by branch, and a CSV export of paid orders for the selected window (7/30/90 days).

**Product search + filtering** — the `/shop` page now has a search box, min/max price filters, and sort (newest, price asc/desc, name A–Z), all via query params so results are shareable/bookmarkable.

**Vault expiry reminder scheduler** — `services/schedulerService.js` runs in-process (no external cron needed) — once on boot, then every 24 hours — and emails anyone whose vault subscription expires within 3 days, exactly once per subscription (tracked via `reminderSentAt` on `UserSubscription`). Fine for a single server instance; if you ever run multiple instances, move this to a real job queue so reminders can't double-send.

**One thing worth testing first after deploy:** the reporting queries in `controllers/admin/reportController.js` use raw grouped SQL aggregates (`GROUP BY` across joined tables) — these follow correct Sequelize patterns but weren't run against a live database during development (no DB access in the build environment). Worth a quick sanity check on `/admin/reports` once you have real order data.

## 1. Install dependencies


```bash
npm install
```

## 2. Set up environment variables
```bash
cp .env.example .env
```
Fill in:
- `DB_*` — your local Postgres credentials
- `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` — from your Paystack dashboard (use test keys first)
- `SESSION_SECRET` — any long random string
- `APP_URL` — e.g. `http://localhost:3000` in dev, your real domain in production (must be a **publicly reachable HTTPS URL** in production for the Paystack webhook to work — Paystack can't call `localhost`)
- `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` — from your Brevo account; emails are silently skipped (with a console warning) if this isn't set, so the app still runs fine without it in early dev
- `ADMIN_NOTIFICATION_EMAIL` — where contact form submissions land
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` — from your Cloudinary dashboard; without these, image uploads in the admin panel will error, but pasting an image URL still works as a fallback
- `RIDER_PAYOUT_PERCENT` — what percentage of a delivery/courier fee a rider earns per shipment (default 60)

**Also set up the Paystack webhook** in your Paystack dashboard (Settings → API Keys & Webhooks): point it at `https://yourdomain.com/webhooks/paystack`. This is what confirms payment even if a customer's browser never makes it back to your site after paying.

## 3. Create the database
**Using Neon:** create a project at neon.tech, grab the connection string from the dashboard, and set it as `DATABASE_URL` in `.env` (see the comment there) — the database itself already exists, nothing more to do here.

**Using local Postgres:**
```bash
createdb tem_store
```
Leave `DATABASE_URL` unset/commented out in `.env` and the app connects to your local Postgres via the `DB_*` variables instead. Switching between the two later is just commenting/uncommenting `DATABASE_URL` — nothing else in the app changes.

## 4. Run the app
```bash
npm run dev
```
That's it — on startup, the app automatically:
1. Connects to Postgres
2. Creates every table from the models if it doesn't exist yet (`sequelize.sync({ alter: true })`)
3. Seeds starter data (categories, the four Second Nature cookies, sample gadget/kid-toy/vault products, three Calabar pickup kiosks, a Cross River delivery zone, and the 6-month Vault tier) — **only if the `products` table is empty**, so it never duplicates data on restart.

You'll see `No products found — seeding starter data...` in the console the first time. On every later restart it's skipped automatically.

If you ever want to reseed by hand (e.g. after wiping the products table), run:
```bash
npm run seed
```

## 5. Build Tailwind CSS
```bash
npm run css:build
```
During development, run this in a separate terminal to auto-rebuild on change:
```bash
npm run css:watch
```

Visit `http://localhost:3000`.

## Product images
Seeded products point to `/public/images/*.png` paths that don't exist yet — drop your real product photos in `public/images/` using the same filenames (e.g. `cookie-classic.png`), or update the `imageUrl` values in `seeders/seed.js` / directly in the database. Missing images fall back to a placeholder automatically.

## How the tiered catalog works
- **Public** (`visibilityTier: 'public'`) — cookies, kid toys, gadgets. Shown in nav, search, and homepage.
- **Discreet** (`visibilityTier: 'discreet'`) — reachable only at `/shop/discreet`, a URL that is never linked from navigation or the public shop grid. Share it privately with customers who ask.
- **Exclusive** (`visibilityTier: 'exclusive'`) — the Vault. Requires an active or grace-period subscription; anyone else gets a plain 404 at `/vault`, not a "locked" message, so the section's existence stays low-profile.

## Vault subscriptions
- `/vault/redeem` — visible, lets a logged-in customer pay for 6 months of access via Paystack.
- Subscription status flows `active → grace → expired`. The grace window (default 5 days, set per-tier in `SubscriptionTier.gracePeriodDays`) is checked live in `middleware/vaultAccess.js` on every request, so it's always accurate even without a cron job running.
- If you want automatic email/SMS renewal reminders, that's the next thing to add — see `services/` for where a `notificationService.js` would plug in.

## Orders, pickup, and delivery
- **Pickup**: `PickupLocation` rows represent kiosks. Seeded with three Calabar locations. Pickup is free by default (`fee` field exists in case a specific kiosk ever needs a handling charge).
- **Home delivery**: `DeliveryZone` rows map a state to a flat delivery fee and estimated delivery time. Only one zone (Cross River) is seeded. **To add a new state/branch, insert a new `DeliveryZone` row — no code changes needed.**
- As you open branches in new states, the same pattern extends: add pickup locations tied to `city`/`state`, and a matching `DeliveryZone`. A future step (noted but not built) is auto-suggesting the nearest branch based on `User.state`.

## Checkout & payment flow
1. Guest browses and adds to cart (session-based cart).
2. At checkout, login is required — `requireAuth` middleware redirects to `/login?next=/checkout`.
3. On login/register, the guest cart is merged into the user's persistent cart.
4. Customer picks pickup or home delivery, order is created as `pending_payment`, and they're redirected to Paystack.
5. Paystack redirects back to `/checkout/callback`, which **re-verifies the transaction server-side** (never trusts the redirect alone) before marking the order paid and clearing the cart.

## Dev seed data (for local testing)
Once the app has run at least once (so the base catalog exists), generate test accounts, sample orders, and an active vault subscription:
```bash
npm run seed:dev
```
This creates:
- `buyer@test.com` — has 3 sample orders (paid/pickup, paid/delivery, pending payment) so `/orders` isn't empty
- `vault@test.com` — has an active 6-month vault subscription, so `/vault` is unlocked immediately
- `newuser@test.com` — a clean account with nothing attached
- `manager@test.com` — `branch_manager` at a seeded kiosk (inventory + POS + own-branch orders)
- `pos@test.com` — `sales_pos` at the same kiosk (POS terminal only)
- `inventory@test.com` — `inventory_staff` at the same kiosk (inventory + receiving transfers only)
- `logistics@test.com` — `logistics` (all orders/status updates across branches, no inventory access)

All test accounts use the password `password123`. Safe to re-run — it won't duplicate users or orders.

## Product images (placeholders)
Real product photos go in `public/images/`, filenames referenced in `seeders/seed.js`. To regenerate simple on-brand placeholder images (useful before you have real photography):
```bash
npm run generate:images
```
Requires Python 3 with Pillow (`pip install pillow`) — most dev machines with Python already have it.

## Admin panel, staff roles, and POS
Visit `/admin` while logged in as staff. Roles and what they can see:

| Role | Access |
|---|---|
| `super_admin` | Everything — all branches, all orders, staff, branches, batches, products, rider applications |
| `branch_manager` | Their own branch's inventory, POS, and orders assigned to their branch |
| `inventory_staff` | Their own branch's inventory + receiving stock transfers |
| `sales_pos` | POS terminal only, scoped to their branch — dashboard shows only their own sales |
| `logistics` | All orders across every branch (status updates, rider assignment), no inventory access |
| `rider` | Only their assigned deliveries — start delivery, complete with customer confirmation code |

Permissions live in one place — `middleware/staffAuth.js` — so changing what a role can do never means hunting through controllers.

**Default super admin** (created by `npm run seed`): `admin@temstore.com` / `admin12345` — change this immediately in production. Create additional staff at `/admin/staff` (super_admin only); assign each to a branch there.

**The fulfillment algorithm** (`services/inventoryService.js` → `findFulfillingBranch`):
1. For a home-delivery order, look at active branches in the customer's own state that can fully cover the cart, and pick the one with the most spare stock across the cart (least likely to run out next).
2. If no in-state branch can fully cover it, fall back to any active branch nationwide that can (e.g. a central warehouse), same scoring.
3. If nothing can fully cover it, the order is rejected at checkout with a clear message — orders are never silently split across branches, keeping picking/packing/courier handoff simple as more branches open.

For pickup orders, the customer's chosen branch is validated against its own stock before the order is created.

**Every stock movement** — production landing, transfers, online order fulfillment, POS sales, manual adjustments, cancellations — goes through `adjustBranchStock()`, which writes an `InventoryLog` row (product, branch, delta, resulting balance, reason, who did it, when). That's the record for you to review all activity across every branch.

**POS (walk-in sales):** `branch_manager` and `sales_pos` staff get a terminal at `/admin/pos`, scoped to their own branch's inventory only. A sale creates an `Order` with `source: 'pos'`, deducts stock immediately (never oversells — checked inside a DB transaction), and produces a printable receipt.

**Stock transfers** (`/admin/transfers`): move stock from Central Production (or any branch) to a retail kiosk. `super_admin` can move stock anywhere; branch-scoped staff can only *receive* transfers into their own branch, never redirect stock elsewhere.

## Product authenticity: batches & verification codes
Every unit you produce gets a unique, single-use code printed on its packaging. Customers check it at `/verify` to confirm the item is genuine; once checked, that code can never be reused.

**Recording a new production batch:**
```bash
node seeders/newBatch.js <product-slug> <quantity> [--branch=<branch-slug>] ["optional notes"]
```
Example:
```bash
node seeders/newBatch.js classic-chocolate-chip 200 "August batch, morning run"
```
By default, stock lands at the **Central Production** branch (created by the base seed). To land it directly at a specific kiosk instead:
```bash
node seeders/newBatch.js classic-chocolate-chip 200 --branch=tem-kiosk-marian-market "Direct to kiosk"
```
This will:
1. Create a `ProductionBatch` record with an auto-generated batch number (e.g. `CCC-20260814-A`)
2. Generate `<quantity>` unique verification codes (format `TEM-XXXX-XXXX-XXXX`), each tied to that batch and product
3. Land `<quantity>` units of stock at the target branch (logged in `InventoryLog`, visible at `/admin/inventory`)
4. Export all the codes to `exports/<batch-number>.csv` — print these onto your labels/stickers

From Central Production, move stock out to retail kiosks via `/admin/transfers`.

Customers verify at `/verify`. First scan/entry marks the code used and shows the product + batch info; any repeat entry of the same code shows "already verified" instead of the product details — which is also your signal that a code may have been copied onto a counterfeit.

## What's intentionally left for you to wire up
- Admin panel for managing products/orders/pickup locations (currently all seeded/managed via DB directly or a script)
- Email/SMS notifications (order confirmation, vault renewal reminders)
- Real product photography in `public/images/`
- Production session cookie settings (`secure: true` behind HTTPS)
- A cron job to formally flip subscription statuses daily (functionally optional — middleware checks live — but useful for admin dashboards/reporting)

## Project structure
```
tem-store/
  config/database.js        Sequelize connection
  models/                   User, Category, Product, Cart, Order, Vault subscriptions, etc.
  controllers/               Route logic
  routes/                    Express routers
  middleware/                 auth.js, vaultAccess.js
  services/                   paystack.js, cartService.js
  seeders/seed.js             Starter data
  views/                      EJS templates
  public/css/                 Tailwind input + built output
```
