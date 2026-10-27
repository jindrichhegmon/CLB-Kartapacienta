#!/usr/bin/env bash
# Vlastní server videohovorů (Jitsi Meet v Dockeru) na VPS pro Kartu pacienta – spouštět z Macu ve složce repozitáře:
#   ./deploy/vps-jitsi.sh
# - nainstaluje Docker (pokud chybí) a docker-jitsi-meet do /opt/jitsi, bez přihlašování (místnosti chrání náhodný název)
# - Caddy: doména jitsi.95-216-201-2.sslip.io → 127.0.0.1:8000 (TLS řeší Caddy), JVB posílá média na UDP 10000
# - do /opt/clb-kartapacienta/.env doplní KP_JITSI_URL a restartuje Kartu
# Nároky: zhruba 2–3 GB RAM navíc. Data hovorů zůstávají na VPS (nic se nenahrává).
set -e
VPS="${VPS:-root@95.216.201.2}"
KEY="${KEY:-$HOME/.ssh/id_ed25519_jhnapps}"
IP="${IP:-95.216.201.2}"
DOMENA="${DOMENA:-jitsi.95-216-201-2.sslip.io}"
KARTA_DIR=/opt/clb-kartapacienta
SSH="ssh -i $KEY -o BatchMode=yes"

$SSH "$VPS" bash -s <<EOF
set -e
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq docker.io docker-compose-v2 >/dev/null
  systemctl enable --now docker
  echo "=== Docker nainstalován ==="
fi
if [ ! -d /opt/jitsi ]; then
  git clone -q --depth 1 https://github.com/jitsi/docker-jitsi-meet /opt/jitsi
  echo "=== docker-jitsi-meet stažen do /opt/jitsi ==="
fi
cd /opt/jitsi
if [ ! -f .env ]; then
  cp env.example .env
  ./gen-passwords.sh
  sed -i -e 's#^HTTP_PORT=.*#HTTP_PORT=8000#' -e 's#^HTTPS_PORT=.*#HTTPS_PORT=8443#' \\
         -e 's#^TZ=.*#TZ=Europe/Prague#' -e 's#^\\(#\\)\\{0,1\\}PUBLIC_URL=.*#PUBLIC_URL=https://$DOMENA#' \\
         -e 's#^\\(#\\)\\{0,1\\}JVB_ADVERTISE_IPS=.*#JVB_ADVERTISE_IPS=$IP#' \\
         -e 's#^\\(#\\)\\{0,1\\}DISABLE_HTTPS=.*#DISABLE_HTTPS=1#' -e 's#^\\(#\\)\\{0,1\\}ENABLE_LETSENCRYPT=.*#ENABLE_LETSENCRYPT=0#' .env
  grep -q '^PUBLIC_URL=' .env || echo "PUBLIC_URL=https://$DOMENA" >> .env
  grep -q '^JVB_ADVERTISE_IPS=' .env || echo "JVB_ADVERTISE_IPS=$IP" >> .env
  grep -q '^DISABLE_HTTPS=' .env || echo "DISABLE_HTTPS=1" >> .env
  grep -q '^ENABLE_LETSENCRYPT=' .env || echo "ENABLE_LETSENCRYPT=0" >> .env
  # bez přihlašování: kdo zná náhodný název místnosti, může dovnitř (Karta ho dává jen oběma stranám hovoru)
  grep -q '^ENABLE_AUTH=' .env && sed -i 's#^ENABLE_AUTH=.*#ENABLE_AUTH=0#' .env || echo "ENABLE_AUTH=0" >> .env
  grep -q '^ENABLE_GUESTS=' .env && sed -i 's#^ENABLE_GUESTS=.*#ENABLE_GUESTS=1#' .env || echo "ENABLE_GUESTS=1" >> .env
  echo "=== /opt/jitsi/.env připraven ==="
fi
mkdir -p ~/.jitsi-meet-cfg/{web,transcripts,prosody/config,prosody/prosody-plugins-custom,jicofo,jvb,jigasi,jibri}
docker compose up -d
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q '^Status: active'; then ufw allow 10000/udp >/dev/null; fi
if ! grep -q "$DOMENA" /etc/caddy/Caddyfile; then
  printf '\n$DOMENA {\n\tencode gzip\n\treverse_proxy 127.0.0.1:8000\n}\n' >> /etc/caddy/Caddyfile
  systemctl reload caddy
  echo "=== Caddy: doplněna doména $DOMENA ==="
fi
if [ -f $KARTA_DIR/.env ]; then
  if grep -q '^KP_JITSI_URL=' $KARTA_DIR/.env; then sed -i "s#^KP_JITSI_URL=.*#KP_JITSI_URL=https://$DOMENA#" $KARTA_DIR/.env; else echo "KP_JITSI_URL=https://$DOMENA" >> $KARTA_DIR/.env; fi
  su - jhnapps -c "pm2 restart clb-kartapacienta --update-env >/dev/null" || true
  echo "=== Karta: KP_JITSI_URL=https://$DOMENA, server restartován ==="
fi
sleep 5
docker compose ps --format 'table {{.Name}}\t{{.Status}}'
EOF
echo
echo "Hotovo. Server videohovorů: https://$DOMENA (otevřete v prohlížeči – má se ukázat úvodní stránka Jitsi Meet)."
echo "V Kartě se po odemknutí PINem objeví dlaždice Videohovor; v centrále u pacienta tlačítko Videohovor na telefon."
