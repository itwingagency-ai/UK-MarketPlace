#!/usr/bin/env bash
# Ship the committed HEAD to personalVps, rebuild the API container and the
# web portal. Run from the repo root on the Mac: ./deploy/ukmarketplace/deploy.sh
#
# Needs (one-time, see README.md): DNS for $DOMAIN, the env file on the
# server, the nginx vhost, and /var/www/$DOMAIN owned by tayyab.
set -euo pipefail

HOST=${UKM_HOST:-personalVps}
DOMAIN=${UKM_DOMAIN:-ukmarketplace.itwing.cloud}
APP_DIR=/home/tayyab/ukmarketplace
WEB_ROOT=/var/www/$DOMAIN

cd "$(git rev-parse --show-toplevel)"
if [ -n "$(git status --porcelain -- Backend Frontend-Web deploy)" ]; then
  echo "Uncommitted changes in Backend/Frontend-Web/deploy — deploy ships HEAD only." >&2
  echo "Commit first (or stash) so the server matches git." >&2
  exit 1
fi
REV=$(git rev-parse --short HEAD)
echo "→ Shipping $REV to $HOST"

git archive --format=tar HEAD Backend Frontend-Web deploy \
  | ssh "$HOST" "mkdir -p $APP_DIR && cd $APP_DIR && rm -rf Backend Frontend-Web deploy && tar -xf - && echo $REV > REVISION"

ssh "$HOST" bash -s <<REMOTE
set -euo pipefail
cd $APP_DIR

echo "→ Building web portal"
docker run --rm -v "\$PWD/Frontend-Web:/app" -w /app \
  -e VITE_API_BASE_URL=https://$DOMAIN \
  -u "\$(id -u):\$(id -g)" -e npm_config_cache=/tmp/.npm \
  node:20-alpine sh -c "npm ci --no-audit --no-fund && npm run build"
rsync -a --delete Frontend-Web/dist/ $WEB_ROOT/

echo "→ Rebuilding API"
cd deploy/ukmarketplace
docker compose up -d --build
# </dev/null: exec -T would otherwise swallow the rest of this heredoc
docker compose exec -T api node seed-global-categories.js </dev/null | tail -3

for i in \$(seq 1 20); do
  if curl -fs http://127.0.0.1:8050/health >/dev/null; then echo "→ API healthy"; break; fi
  sleep 2
  [ "\$i" = 20 ] && { echo "API did not come up"; docker compose logs --tail 50 api; exit 1; }
done
REMOTE

curl -fsS "https://$DOMAIN/api/v1/platform/settings" >/dev/null && echo "✓ Live: https://$DOMAIN ($REV)"
