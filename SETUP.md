# Local Setup

Three apps in one repo:

| Folder | What | Runs on |
|---|---|---|
| `Backend` | Express 5 + MongoDB (Mongoose) REST API | `http://localhost:5001` |
| `Frontend-Web` | Vite + React admin/vendor portal | `http://localhost:5173` |
| `Frontend` | Expo (SDK 56) React Native customer app | Metro on `:8081` |

## Prerequisites

- Node.js 20.19+ (this machine: v20.20.2). Note: the AWS SDK warns it will require Node 22+ after early 2027.
- MongoDB 7 (`mongodb-community@7.0`) + `mongodb-database-tools`, both already installed via Homebrew.

## Port note

The repo defaults the API to port **5000**, but on macOS that port is held by
ControlCenter (AirPlay Receiver). This setup uses **5001** instead, and
`Backend/.env`, `Frontend-Web/.env` and `Frontend/src/constants.js` are all set
to match. To go back to 5000, turn off *System Settings → General → AirDrop &
Handoff → AirPlay Receiver* and change those three files.

## 1. MongoDB

`brew services` refuses to load the `mongodb/brew` tap unless it is trusted, so
mongod is started directly:

```bash
mongod --config /opt/homebrew/etc/mongod.conf --fork
```

To stop it: `pkill mongod`.

If you would rather have it auto-start on login, trust the tap once
(`brew trust mongodb/brew`) and then use `brew services start mongodb-community@7.0`.

## 2. Backend

```bash
cd Backend
npm install
node restore-dump.js   # loads Backend/dump/*.json into the `multistore` db
npm run dev            # nodemon on :5001
```

`Backend/.env` already exists (see `.env.example` for the shape). Only these six
are required — everything else is optional and currently blank:
`PORT`, `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`.

### About `restore-dump.js`

`take_dump.js` exports with `JSON.stringify`, which flattens ObjectIds to plain
hex strings and Dates to ISO strings. `restore-dump.js` reads the Mongoose
schemas to find which paths are genuinely ObjectIds and converts only those, so
`populate()` and every `ref` lookup still resolve. A naive re-import leaves the
references as strings and silently returns `null` for every joined document.

It wipes each collection before inserting, so it is safe to re-run.

### Seed scripts (optional, richer data)

The restored dump is minimal (2 products, 2 stores). For more:
`seed-dummy-data.js`, `seed-magnum.js`, `seed-meow.js`, `seed-reviews.js`,
`seed-paid-orders.js`, `seed-reported-reviews.js`, `seed-admin.js`.

## 3. Admin portal

```bash
cd Frontend-Web
npm install
npm run dev            # :5173
```

Reads `VITE_API_BASE_URL` (set to `http://localhost:5001`, no trailing slash —
`src/api/client.js` appends `/api/v1`).

## 4. Mobile app

```bash
cd Frontend
npm install
npx expo start
```

`npx expo-doctor` passes 21/21. Two fixes were needed to get there:
`expo-font` was a missing peer dependency of `@expo/vector-icons` (the app can
crash without it outside Expo Go), and `expo` was pinned a patch behind the SDK.

**Expo Go will not work here.** The app depends on `expo-dev-client` plus native
config plugins (`@react-native-google-signin/google-signin`,
`@stripe/stripe-react-native`), so it needs a development build:

```bash
npx expo run:ios          # or run:android — generates native dirs via prebuild
# or: eas build --profile development
```

The API URL lives in `Frontend/src/constants.js`. It is set to
`http://192.168.0.5:5001/api/v1` (this machine's LAN IP) so a physical device
can reach the backend. Re-check that IP if you switch networks.

## Test accounts

Restored from the dump:

| Email | Password | Role |
|---|---|---|
| `superadmin@marketplace.co.uk` | `abdullah2@12` | admin |
| `admin@marketplace.co.uk` | `abdullah2@12` | admin |
| `vendor@marketplace.co.uk` | `password123` | vendor |
| `customer@marketplace.co.uk` | `password123` | customer |

(`testuser1@store.com` is also in the dump but its password is not in any seed script.)

## What is not configured

These are blank in `Backend/.env`, so the matching features will not work until
you supply credentials:

- **Stripe** — checkout and payment webhooks
- **AWS S3** — product/store image uploads
- **SMTP + Twilio** — email / SMS / WhatsApp notifications
  (`NOTIFICATIONS_ENABLED=false` for now so sends fail quietly rather than erroring)
- **Google** — OAuth sign-in (`GOOGLE_CLIENT_ID`) and address-based store
  discovery (`GOOGLE_MAPS_API_KEY`)

## Verified working

- `GET /api/v1/platform/settings` → 200
- `GET /api/v1/products/search` → 200, with `store` and `category` correctly populated
- `POST /api/v1/auth/login` → returns access + refresh tokens for all four accounts above
- Admin portal loads at `:5173` with no console errors; `npm run build` succeeds
- Metro bundles the RN app for iOS with no errors
