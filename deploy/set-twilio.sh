#!/usr/bin/env bash
# Nastaví na VPS údaje k Twiliu (SMS) pro Kartu pacienta i jhn-apps a obě aplikace restartuje.
# Spouštět z Macu ve složce repozitáře:  ./deploy/set-twilio.sh
# Account SID a Auth Token najdete na https://console.twilio.com (úvodní stránka účtu, Account Info).
# Hodnoty se zadávají sem do Terminálu (token se nezobrazuje) a na server jdou přes SSH, ne v příkazové řádce.
set -e
VPS="${VPS:-root@95.216.201.2}"
KEY="${KEY:-$HOME/.ssh/id_ed25519_jhnapps}"

read -r -p "Twilio Account SID (začíná AC…): " SID
read -r -s -p "Twilio Auth Token (nezobrazuje se): " TOKEN; echo
read -r -p "Odesílací číslo SMS [+420736354150]: " FROM
FROM="${FROM:-+420736354150}"
[[ "$SID" =~ ^AC[0-9a-fA-F]{32}$ ]] || { echo "Account SID má tvar AC + 32 znaků (0-9, a-f)."; exit 1; }
[[ "$TOKEN" =~ ^[0-9a-fA-F]{32}$ ]] || { echo "Auth Token má 32 znaků (0-9, a-f)."; exit 1; }

# Jedno sdílené SSH spojení (ControlMaster) s opakováním: server odmítá spojení otevřená rychle po sobě („Connection reset by peer“)
CM="$HOME/.ssh/cm-jhnapps-%r@%h-%p"
SSH="ssh -i $KEY -o BatchMode=yes -o ConnectTimeout=20 -o ControlMaster=auto -o ControlPath=$CM -o ControlPersist=180"
trap 'ssh -o ControlPath="$CM" -O exit "$VPS" >/dev/null 2>&1 || true' EXIT
for i in 1 2 3 4 5 6; do
  if $SSH "$VPS" true 2>/dev/null; then break; fi
  if [ "$i" = 6 ]; then echo "Server $VPS nepřijímá SSH spojení ani po 2 minutách – zkuste skript spustit znovu za pár minut." >&2; exit 1; fi
  echo "   server zatím nepřijímá SSH spojení – zkusím znovu za 20 s ($i/5)"; sleep 20
done
# 1) hodnoty do dočasného souboru na serveru (přes stdin, jen pro roota)
printf 'TWILIO_ACCOUNT_SID=%s\nTWILIO_AUTH_TOKEN=%s\nTWILIO_SMS_FROM=%s\n' "$SID" "$TOKEN" "$FROM" | $SSH "$VPS" "umask 077 && cat > /root/.twilio-nove"
# 2) zapsat do .env obou aplikací a restartovat
$SSH "$VPS" bash -s <<'EOF'
set -e
for D in /opt/jhn-apps /opt/clb-kartapacienta; do
  [ -d "$D" ] || continue
  touch "$D/.env"
  sed -i -E '/^[[:space:]]*(export[[:space:]]+)?TWILIO_(ACCOUNT_SID|AUTH_TOKEN|SMS_FROM)=/d' "$D/.env"
  cat /root/.twilio-nove >> "$D/.env"
  chown jhnapps:jhnapps "$D/.env" && chmod 600 "$D/.env"
  echo "Uloženo do $D/.env"
done
rm -f /root/.twilio-nove
su - jhnapps -c "pm2 restart jhn-apps --update-env >/dev/null" || echo "jhn-apps se nepodařilo restartovat"
su - jhnapps -c "pm2 restart clb-kartapacienta --update-env >/dev/null" || echo "Kartu pacienta se nepodařilo restartovat"
sleep 2
echo "Karta pacienta: $(curl -s localhost:3120/api/health | grep -o '"sms":"[^"]*"' || echo 'stav SMS nezjištěn')"
EOF
echo 'Hotovo. Když výše stojí "sms":"zapnuto", SMS s odkazem na spárování funguje.'
