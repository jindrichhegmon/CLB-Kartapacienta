/**
 * Videohovor (od 0.11.45): telefon u pacienta (po odemknutí PINem – rodina i tým) ↔ lékař / tým v centrální aplikaci.
 * Samotný hovor vede server videohovorů Jitsi Meet (KP_JITSI_URL, nejlépe vlastní na VPS – deploy/vps-jitsi.sh);
 * Karta jen vytvoří místnost s náhodným názvem, zapíše hovor do A_KP_Videohovor a deníku a dá oběma stranám odkaz.
 * Obsah hovoru se nikde neukládá; do deníku jde jen „videohovor zahájen / ukončen“.
 */
import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { zapisDenik } from './kp.js';

export const ZVONI_MIN = 3;          // nepřijatý hovor po 3 minutách končí jako NEPRIJAT
export const PROBIHA_MAX_H = 3;      // hovor bez ukončení po 3 hodinách končí sám

/** Adresa serveru videohovorů bez lomítka na konci; prázdná = videohovory vypnuté. */
export function videoServer() {
  return String(config.video.server || '').trim().replace(/\/+$/, '');
}

/** Název místnosti: kód průkazu + 10 náhodných znaků (jen malá písmena a číslice, aby prošel v adrese Jitsi). */
export function novaMistnost(kodPrukazu = '') {
  const kod = String(kodPrukazu).toLowerCase().replace(/[^a-z0-9]/g, '') || 'kp';
  const abeceda = 'abcdefghjkmnpqrstuvwxyz23456789';
  const b = randomBytes(10);
  let n = '';
  for (let i = 0; i < 10; i++) n += abeceda[b[i] % abeceda.length];
  return `kp-${kod}-${n}`;
}

/** Odkaz do místnosti s předvyplněným jménem a bez úvodní obrazovky Jitsi (stejný pro telefon i prohlížeč lékaře). */
export function odkazDoHovoru(mistnost, jmeno) {
  const server = videoServer();
  if (!server || !/^[a-z0-9-]{3,80}$/.test(mistnost)) return null;
  const nastaveni = ['config.prejoinPageEnabled=false', 'config.disableDeepLinking=true', 'config.startWithVideoMuted=false', 'config.startWithAudioMuted=false',
    `userInfo.displayName=${encodeURIComponent(JSON.stringify(String(jmeno || 'Karta pacienta').slice(0, 60)))}`];
  return `${server}/${mistnost}#${nastaveni.join('&')}`;
}

function radek(r) {
  return r ? { id: r.VideohovorID, mistnost: r.Mistnost, stav: r.Stav, zahajil: r.Zahajil, zahajilJmeno: r.ZahajilJmeno, zahajilRole: r.ZahajilRole,
    zahajeno: r.Zahajeno, prijato: r.Prijato, ukonceno: r.Ukonceno } : null;
}

const SLOUPCE = `VideohovorID, Mistnost, Zahajil, ZahajilJmeno, ZahajilRole, Stav, CONVERT(char(16), Zahajeno, 120) AS Zahajeno,
  CONVERT(char(16), Prijato, 120) AS Prijato, CONVERT(char(16), Ukonceno, 120) AS Ukonceno`;

/** Aktivní hovor pacienta (ZVONI / PROBIHA); prošlé hovory nejdřív uzavře. */
export async function aktivniHovor(q, pacientId) {
  await q.exec(`UPDATE dbo.A_KP_Videohovor SET Stav = 'NEPRIJAT', Ukonceno = SYSDATETIME() WHERE PacientID = @p AND Stav = 'ZVONI' AND Zahajeno < DATEADD(minute, -@m, SYSDATETIME())`, { p: pacientId, m: ZVONI_MIN });
  await q.exec(`UPDATE dbo.A_KP_Videohovor SET Stav = 'UKONCEN', Ukonceno = SYSDATETIME() WHERE PacientID = @p AND Stav = 'PROBIHA' AND Prijato < DATEADD(hour, -@h, SYSDATETIME())`, { p: pacientId, h: PROBIHA_MAX_H });
  return radek(await q.one(`SELECT TOP 1 ${SLOUPCE} FROM dbo.A_KP_Videohovor WHERE PacientID = @p AND Stav IN ('ZVONI', 'PROBIHA') ORDER BY VideohovorID DESC`, { p: pacientId }));
}

/** Zahájí hovor (nebo vrátí už běžící – druhá strana se připojí do téže místnosti). */
export async function zahajHovor(q, { pacientId, kodPrukazu, zahajil, jmeno, role = null, uzivatelId = null, zarizeniId = null }) {
  const bezici = await aktivniHovor(q, pacientId);
  if (bezici) return { ...bezici, novy: false };
  const mistnost = novaMistnost(kodPrukazu);
  const r = await q.one(`INSERT INTO dbo.A_KP_Videohovor (PacientID, Mistnost, Zahajil, ZahajilJmeno, ZahajilRole, UzivatelID, ZarizeniID)
    OUTPUT inserted.VideohovorID VALUES (@p, @m, @z, @j, @r, @u, @zid)`,
  { p: pacientId, m: mistnost, z: zahajil, j: String(jmeno || '').slice(0, 150) || 'neuvedeno', r: role ? String(role).slice(0, 10) : null, u: uzivatelId, zid: zarizeniId });
  await zapisDenik(q, { pacientId, typ: 'Videohovor', role: role || (zahajil === 'CENTRALA' ? 'lekar' : 'system'), autor: jmeno || 'neuvedeno', uzivatelId, zarizeniId,
    text: zahajil === 'TELEFON' ? 'Videohovor zahájen z telefonu u pacienta – čeká na tým.' : 'Videohovor zahájen z centrální aplikace – telefon u pacienta zvoní.' });
  return { ...(await aktivniHovor(q, pacientId)), id: r.VideohovorID, novy: true };
}

export async function prijmiHovor(q, pacientId, id) {
  await q.exec(`UPDATE dbo.A_KP_Videohovor SET Stav = 'PROBIHA', Prijato = SYSDATETIME() WHERE VideohovorID = @id AND PacientID = @p AND Stav = 'ZVONI'`, { id, p: pacientId });
  return aktivniHovor(q, pacientId);
}

export async function ukonciHovor(q, pacientId, id, { jmeno, role = null, uzivatelId = null, zarizeniId = null }) {
  const r = await q.one(`SELECT Stav, Zahajeno, Prijato FROM dbo.A_KP_Videohovor WHERE VideohovorID = @id AND PacientID = @p`, { id, p: pacientId });
  if (!r || !['ZVONI', 'PROBIHA'].includes(r.Stav)) return aktivniHovor(q, pacientId);
  const prijat = r.Stav === 'PROBIHA';
  await q.exec(`UPDATE dbo.A_KP_Videohovor SET Stav = @s, Ukonceno = SYSDATETIME() WHERE VideohovorID = @id`, { id, s: prijat ? 'UKONCEN' : 'NEPRIJAT' });
  const minut = prijat && r.Prijato ? Math.max(1, Math.round((Date.now() - new Date(r.Prijato).getTime()) / 60000)) : 0;
  await zapisDenik(q, { pacientId, typ: 'Videohovor', role: role || 'system', autor: jmeno || 'neuvedeno', uzivatelId, zarizeniId,
    text: prijat ? `Videohovor ukončen (${minut} min).` : 'Videohovor nebyl přijat.' });
  return aktivniHovor(q, pacientId);
}

