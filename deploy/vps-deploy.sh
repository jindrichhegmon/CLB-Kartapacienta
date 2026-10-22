#!/usr/bin/env bash
# Nasazení / aktualizace Karty pacienta na VPS (spouštět z Macu ve složce repozitáře):
#   ./deploy/vps-deploy.sh
# - zkopíruje kód (bez node_modules, .env, .git) do /opt/clb-kartapacienta
# - při prvním nasazení vytvoří .env: spojení PeceDomaPlus a klíč AI převezme z /opt/jhn-apps/.env,
#   vygeneruje KP_SECRET a heslo správy tenantů KP_ADMIN_HESLO (vypíše ho jednou)
# - nainstaluje balíčky, spustí migraci tabulek A_KP_* (idempotentní), (re)startuje pm2
# - doplní do Caddy doménu kartapacienta.95-216-201-2.sslip.io → 127.0.0.1:3120
# - od 0.6.0: vygeneruje KP_PARTNER_KLIC a zapíše ho i do /opt/jhn-apps/.env (KARTA_URL, KARTA_PARTNER_KLIC, KARTA_TENANT –
#   tenant Centra LB; jiný: KARTA_TENANT=… ./deploy/vps-deploy.sh), aby PéčeDoma ukázalo lékaři kód lékaře dne
set -e
VPS="${VPS:-root@95.216.201.2}"
KEY="${KEY:-$HOME/.ssh/id_ed25519_jhnapps}"
DIR=/opt/clb-kartapacienta
DOMENA="${DOMENA:-kartapacienta.95-216-201-2.sslip.io}"
PORT=3120

cd "$(dirname "$0")/.."
# Jedno sdílené SSH spojení (ControlMaster) s opakováním: server odmítá spojení otevřená rychle po sobě („Connection reset by peer“)
CM="$HOME/.ssh/cm-jhnapps-%r@%h-%p"
SSH="ssh -i $KEY -o BatchMode=yes -o ConnectTimeout=20 -o ControlMaster=auto -o ControlPath=$CM -o ControlPersist=180"
trap 'ssh -o ControlPath="$CM" -O exit "$VPS" >/dev/null 2>&1 || true' EXIT
for i in 1 2 3 4 5 6; do
  if $SSH "$VPS" true 2>/dev/null; then break; fi
  if [ "$i" = 6 ]; then echo "Server $VPS nepřijímá SSH spojení ani po 2 minutách – zkuste skript spustit znovu za pár minut." >&2; exit 1; fi
  echo "   server zatím nepřijímá SSH spojení – zkusím znovu za 20 s ($i/5)"; sleep 20
done
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
# Kód lékaře dne pro PéčeDoma (od 0.6.0): partnerský klíč sdílený s jhn-apps na stejném VPS (/api/partner/kod-dne)
if ! grep -q '^KP_PARTNER_KLIC=' .env; then
  echo "KP_PARTNER_KLIC=\$(openssl rand -hex 24)" >> .env
  echo "=== Do .env doplněn KP_PARTNER_KLIC (partnerské API pro PéčeDoma) ==="
fi
J=/opt/jhn-apps/.env
if [ -f "\$J" ] && ! grep -q '^KARTA_PARTNER_KLIC=' "\$J"; then
  {
    echo "KARTA_URL=http://127.0.0.1:$PORT"
    echo "KARTA_PARTNER_KLIC=\$(grep ^KP_PARTNER_KLIC= .env | cut -d= -f2)"
    echo "KARTA_TENANT=${KARTA_TENANT:-02570459DSIDEQAJ}"
  } >> "\$J"
  su - jhnapps -c "pm2 restart jhn-apps --update-env >/dev/null" || true
  echo "=== Do /opt/jhn-apps/.env doplněno KARTA_URL, KARTA_PARTNER_KLIC a KARTA_TENANT (PéčeDoma → kód lékaře dne); jhn-apps restartován ==="
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
