# UK Marketplace on personalVps

Live target: **https://ukmarketplace.itwing.cloud** — admin/vendor portal at `/`,
API at `/api/v1`, Socket.IO at `/socket.io`, uploaded images at `/uploads`.

| Piece | Where |
|---|---|
| Code | `/home/tayyab/ukmarketplace` (git archive of HEAD; `REVISION` = commit) |
| Containers | `ukmarketplace-mongo-1` (Mongo 7, not published), `ukmarketplace-api-1` → `127.0.0.1:8050` |
| Env | `/home/tayyab/envs/ukmarketplace.backend.env` (600) — JWT secrets generated on the server |
| Demo logins | `/home/tayyab/envs/ukmarketplace.credentials` (600) — passwords rotated on deploy, not the ones in SETUP.md |
| Portal files | `/var/www/ukmarketplace.itwing.cloud` |
| nginx | `/etc/nginx/sites-available/ukmarketplace.itwing.cloud` (copy of `nginx.conf`) |
| Data | Docker volumes `ukmarketplace_mongo-data`, `ukmarketplace_uploads` |

## Deploy
```bash
./deploy/ukmarketplace/deploy.sh      # from the repo root; ships committed HEAD
```
It builds the portal with `VITE_API_BASE_URL=https://ukmarketplace.itwing.cloud`,
rebuilds the API image, and runs `seed-global-categories.js` (idempotent).

## Adding credentials later
Edit the env file on the server, then `cd ~/ukmarketplace/deploy/ukmarketplace && docker compose up -d`.
- **SMTP** + `NOTIFICATIONS_ENABLED=true` — needed for email OTP signup and password reset.
- **Stripe** keys + webhook `https://ukmarketplace.itwing.cloud/api/v1/payments/webhook`.
- **AWS S3** — once set, new uploads go to S3 (existing ones stay on the volume).
- **GOOGLE_CLIENT_ID** (comma-separated web/Android/iOS IDs), **GOOGLE_MAPS_API_KEY**.

## Mobile app
Build with `EXPO_PUBLIC_API_URL=https://ukmarketplace.itwing.cloud/api/v1`
(e.g. in `eas.json` → `build.<profile>.env`).

## One-time setup (already done)
1. DNS: A record `ukmarketplace` → 76.13.181.210 in the itwing.cloud zone (personal Hostinger).
2. As root: env file, `/var/www/ukmarketplace.itwing.cloud` owned by tayyab, nginx vhost enabled.
3. `certbot --nginx -d ukmarketplace.itwing.cloud --redirect` once DNS resolves.
