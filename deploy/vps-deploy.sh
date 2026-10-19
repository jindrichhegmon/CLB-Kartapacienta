#!/usr/bin/env bash
# Nasazení / aktualizace Karty pacienta na VPS (spouštět z Macu ve složce repozitáře):
#   ./deploy/vps-deploy.sh
# - zkopíruje kód (bez node_modules, .env, .git) do /opt/clb-kartapacienta
# - při prvním nasazení vytvoří .env: spojení PeceDomaPlus a klíč AI převezme z /opt/jhn-apps/.env,
#   vygeneruje KP_SECRET a heslo správy tenantů KP_ADMIN_HESLO (vypíše ho jednou)
# - nainstaluje balíčky, spustí migraci tabulek A_KP_* (idempotentní), (re)startuje pm2
# - doplní do Caddy doménu kartapacienta.95-216-201-2.sslip.io → 127.0.0.1:3120
set -e
VPS="${VPS:-root@95.216.201.2}"
KEY="${KEY:-$HOME/.ssh/id_ed25519_jhnapps}"
DIR=/opt/clb-kartapacienta
DOMENA="${DOMENA:-kartapacienta.95-216-201-2.sslip.io}"
PORT=3120
SSH="ssh -i $KEY -o BatchMode=yes"

cd "$(dirname "$0")/.."
$SSH "$VPS" "mkdir -p $DIR"
rsync -az --delete -e "$SSH" --exclude node_modules --exclude .git --exclude .DS_Store --exclude .env ./ "$VPS:$DIR/"

$SSH "$VPS" bash -s <<EOF
set -e
cd $DIR
if [ ! -f .env ]; then
  J=/opt/jhn-apps/.env
  {
    echo "PORT=$PORT"
    echo "HOST=127.0.0.1"
    echo "KP_VEREJNA_ADRESA=https://$DOMENA"
    grep -E '^(DB_PECEDOMAPLUS_(DATABASE|USER|PASSWORD|SERVER|PORT)|SQL_SERVER|SQL_PORT|SQL_ENCRYPT|SQL_TRUST_CERT|ANTHROPIC_API_KEY)=' \$J || true
    echo "KP_SECRET=\$(openssl rand -base64 48 | tr -d '\n')"
    echo "KP_ADMIN_HESLO=\$(openssl rand -base64 18 | tr -d '/+=\n' | cut -c1-20)"
  } > .env
  chmod 600 .env
  echo "=== Vytvořen .env – heslo správy tenantů (uschovejte): \$(grep ^KP_ADMIN_HESLO= .env | cut -d= -f2) ==="
fi
# SMS s odkazem na spárování telefonu (od 0.2.0): Twilio převezme z jhn-apps, když v .env ještě není
if ! grep -qE '^[[:space:]]*(export[[:space:]]+)?TWILIO_' .env && grep -qE '^[[:space:]]*(export[[:space:]]+)?TWILIO_' /opt/jhn-apps/.env 2>/dev/null; then
  grep -E '^[[:space:]]*(export[[:space:]]+)?TWILIO_' /opt/jhn-apps/.env | sed -E 's/^[[:space:]]*(export[[:space:]]+)?//' >> .env
  echo "=== Do .env doplněno nastavení SMS (TWILIO_*) z /opt/jhn-apps/.env ==="
fi
chown -R jhnapps:jhnapps $DIR
su - jhnapps -c "cd $DIR && npm install --omit=dev --no-audit --no-fund 2>&1 | tail -1 && npm run migrate 2>&1 | tail -4"
if su - jhnapps -c "pm2 describe clb-kartapacienta" >/dev/null 2>&1; then
  su - jhnapps -c "pm2 restart clb-kartapacienta --update-env"
else
  su - jhnapps -c "cd $DIR && pm2 start deploy/ecosystem.config.cjs && pm2 save"
fi
if ! grep -q "$DOMENA" /etc/caddy/Caddyfile; then
  printf '\n$DOMENA {\n\tencode gzip\n\trequest_body {\n\t\tmax_size 12MB\n\t}\n\treverse_proxy 127.0.0.1:$PORT\n}\n' >> /etc/caddy/Caddyfile
  systemctl reload caddy
  echo "Caddy: doplněna doména $DOMENA"
fi
sleep 2
curl -s localhost:$PORT/api/health; echo
EOF
echo
echo "Hotovo: https://$DOMENA  (log: ssh -i $KEY $VPS \"su - jhnapps -c 'pm2 logs clb-kartapacienta --lines 50'\")"
