# Handover — UK Marketplace

Status as of **26 Nov 2026**. Start here, then read `SETUP.md` (local run) and
`deploy/ukmarketplace/README.md` (server).

## Which branch

**Work from `ui-redesign`.** It holds everything since September: branding
cleanup, Category Studio, the Docker deploy, and feature Waves 0–6.

`main` and `development` stop at 16 Sept 2026 (iOS / pod / gradle build fixes).
They have **diverged** from `ui-redesign`. The PR `ui-redesign → main` brings
them together; resolve conflicts in the native build files (`Frontend/ios`,
`Frontend/android`, `package.json`) by keeping the September build fixes and
the newer app code. Until that PR is merged, branch new work off `ui-redesign`.

The `wave*` and `polish-fixes` branches are local snapshots that are already
inside `ui-redesign`; ignore them.

## What the repo is

| Folder | What |
|---|---|
| `Backend/` | Express 5 + MongoDB (Mongoose), Stripe, Twilio, nodemailer, JWT + refresh tokens, Socket.IO |
| `Frontend/` | Expo React Native **customer** app (and the rider app screens) |
| `Frontend-Web/` | React 19 / Vite **admin + vendor** portal |
| `deploy/ukmarketplace/` | Docker Compose, nginx and `deploy.sh` for the live server |

Money is stored in **pence** (integers). All store totals go through
`Backend/src/lib/pricing`; order status side effects live in
`lib/orderTransitions`. Don't compute totals anywhere else.

Tests: `cd Backend && npm test` (node:test, needs a local Mongo replica set — see `SETUP.md`).

## What's built (Waves 0–6)

- **0** Single pricing module, single currency (`PlatformSettings.currency`, GBP), helmet + rate limits on `/auth`, test suite.
- **1** Coupons, offers engine, fees, tips, minimum order, order breakdown.
- **2** Click & collect, delivery time slots, "I've arrived", live orders socket in the portal.
- **3** Rewards points wallet, referrals / invite codes.
- **4** Riders, rider assignment, proof of delivery, age (ID) checks, item substitutions.
- **5** Account deletion, app version gate, home banners, deep links, saved cards.
- **6** Repeat orders (subscriptions).
- Plus: Category Studio (`GlobalCategory`, admin `/admin/categories`, seeded by `seed-global-categories.js`).

## Not done / needs attention

1. **Live server is behind.** https://ukmarketplace.itwing.cloud runs `e73b2ef`
   (14 Nov); Waves 0–6 are not deployed. Run `./deploy/ukmarketplace/deploy.sh`
   once the branch is checked — new models may need seed data.
2. **Credentials missing on the server** (`/home/tayyab/envs/ukmarketplace.backend.env`):
   - SMTP + `NOTIFICATIONS_ENABLED=true` — without it email-OTP signup and password reset don't work.
   - Stripe keys + webhook `https://ukmarketplace.itwing.cloud/api/v1/payments/webhook` — **auto-refund on cancel and saved cards are untested**.
   - `GOOGLE_CLIENT_ID` (comma list web/Android/iOS) — Google login returns 503 while blank.
   - `GOOGLE_MAPS_API_KEY`, AWS S3 (uploads stay on the Docker volume until set).
3. **App store submission** not started. Build with
   `EXPO_PUBLIC_API_URL=https://ukmarketplace.itwing.cloud/api/v1`. The Expo
   slug stays `Frontend` because it's tied to the EAS projectId — don't rename it.
4. Dead code: "More" tab and `StoreListScreen` are unused.
5. Not yet built from the roadmap: multi-PSP payments, server-driven theming.

## Access you'll need (ask the project owner, not in the repo)

- GitHub access to `itwingagency-ai/UK-MarketPlace`.
- Backend env file and the demo logins (`/home/tayyab/envs/ukmarketplace.credentials`
  on the server — passwords there are rotated, the ones in `SETUP.md` are local only).
- SSH to the server, if you'll deploy.

## Rules

- Product is *inspired by* Snappy Shopper, not a copy: no Snappy code, brand,
  assets, or calls to their backend.
- Never commit `.env` files or keys; `Backend/.env.example` lists every variable.
