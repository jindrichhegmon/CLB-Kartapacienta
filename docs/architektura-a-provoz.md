# Mobil u lůžka – architektura a provoz

Verze 17. 10. 2026 · navazuje na Návrh pro MUDr. Kabelku (část 5)

## Zásady

1. **Centrální aplikace je primární záznam.** Garant v ní pacienta zavede, vede plán péče a spravuje tým kolem pacienta.
2. **Telefon u pacienta je šifrovaná offline kopie.** Vždy ukazuje poslední synchronizovaný stav, i bez signálu.
3. **Synchronizace při každém připojení.** Zápisy pořízené bez signálu čekají ve frontě a odešlou se automaticky, jakmile je spojení; zároveň se stáhnou změny z centrální aplikace.
4. **Veškerá komunikace telefon ↔ centrální aplikace je šifrovaná.**
5. **Veškeré dotazy na AI jsou anonymní.** AI nikdy nedostane údaje, ze kterých by šlo pacienta identifikovat.

## Architektura

```
 Garant / tým (web)            Centrální aplikace (FamiCura, hosting ČR/EU)          Telefon u pacienta
 ─────────────────            ─────────────────────────────────────────            ──────────────────
 nemocnice, hospic,   ──TLS──▶ evidence poskytovatelů a lékařů                    ◀──mTLS──▶  šifrovaná DB (offline kopie)
 ambulance, PL, domov         pacienti, plán péče (verze), deník, přístupy                     krizová karta bez přihlášení
                              předávání garance, PINy, upozornění                             fronta zápisů bez signálu
                              anonymizační brána ──▶ AI (bez identity)                         MDM: kiosk, vzdálené smazání
```

## Role a identifikace

| Role | Jak se identifikuje | Smí |
|---|---|---|
| Garant – nemocniční paliativní tým | účet v centrální aplikaci (2FA) | zavést pacienta, první plán, spárovat telefon, předat garanci |
| Garant – hospic / ambulance / PL | účet v centrální aplikaci; na telefonu QR výzva → kód | plán péče, limitace, revize, předání, ukončení |
| Sestra hospice | účet, na telefonu QR/NFC | deník, zhoršení, kontakty |
| Praktický lékař (není garant) | jednorázový kód z centrální aplikace | medikace, čtení |
| Sestra domova | osobní 6místný PIN vázaný na tým | deník, SOS léky, zhoršení |
| Rodina | osobní PIN | čtení, pozorování |
| ZZS | bez přihlášení | krizová karta, zápis výjezdu („neověřeno“) |
| Správce zařízení | konzole MDM | zamknout, smazat, aktualizovat – **obsah nevidí** |

Ověření lékaře na telefonu: telefon ukáže QR s jednorázovou výzvou → lékař ji načte přihlášeným účtem → centrální aplikace vydá podepsaný kód (platnost 10 min) → průkaz odemčen na 30 min. Pro výjezdy bez signálu mají lékaři garanta předem vydané jednorázové offline kódy ověřitelné podpisem. Automatické zamčení po 2 min, zákaz snímků obrazovky.

## Garance a tým kolem pacienta

- **Garant** = jeden poskytovatel s lékařem odpovědný za plán péče. Domov pro seniory garantem není.
- **Tým kolem pacienta** = poskytovatelé s přístupem, každý s rolí a platností. Mění se s pobytem pacienta, telefon zůstává.
- **Předání garance:** odesílající zvolí „Předat“, přijímající potvrdí. Do potvrzení garance zůstává u odesílajícího; po 72 h upozornění oběma stranám. Nemocnice je garantem nejdéle 30 dní po propuštění. Pokud PL garanci nepřevezme, nabídne se paliativní ambulance.
- Při odchodu ze zařízení se jeho PINy automaticky zneplatní.

| Situace | Kdo zakládá | Garant poté | Tým u pacienta | Telefon |
|---|---|---|---|---|
| Nemocnice → hospic | paliativní tým nemocnice | hospic | hospic, PL, rodina | jde domů |
| Nemocnice → domov s pobytovou službou | paliativní tým nemocnice | PL klienta / paliativní ambulance | sestry domova, PL, rodina | v pokoji klienta |
| Domov → hospic | existuje | z PL na hospic | hospic přibude, domov odchází při odchodu domů | jde s pacientem |
| PL → domov | PL | PL | sestry domova, rodina | vydá provozovatel |
| Domov → jiný domov | existuje | beze změny (mění se jen s PL) | starý domov odchází, nový přichází | jde s pacientem |
| Kdekoli → hospitalizace | – | beze změny | nemocnice jako host (čtení, výpis) | jede s pacientem |

## Synchronizace

| Co | Směr | Kdy |
|---|---|---|
| Zápisy (deník, zhoršení, výjezd ZZS) | telefon → centrální aplikace | ihned po uložení; bez signálu fronta, **odeslání při nejbližším připojení** |
| Zhoršení stavu | → sestra garanta na službě | ihned; SMS/push **bez zdravotních údajů** („Pacient P-012: nový záznam, otevřete aplikaci“) |
| Plán péče, medikace, kontakty, tým | centrální aplikace → telefon | ihned (tichý push „nová verze“), pojistně 1× za hodinu a **vždy při obnovení spojení** |
| Kontrolní signál (baterie, poslední sync) | telefon → přehled garanta | 1× za hodinu; upozornění při výpadku > 12 h nebo baterii < 20 % |
| Aktualizace aplikace | MDM → telefon | v noci při nabíjení |

Konflikty: deník se jen doplňuje (slučuje se bez konfliktu). Plán péče má jednu autoritativní verzi s číslem a podpisem lékaře; starší verze z telefonu ji nikdy nepřepíše. Telefon zobrazuje čas poslední synchronizace a při stáří > 24 h výrazné upozornění.

## AI pouze anonymně

1. Text (propouštěcí zpráva, dotaz) projde **anonymizační bránou v centrální aplikaci**: odstraní se jméno, rodné číslo, datum narození, adresa, telefony, e-maily, čísla pojištěnce, jména příbuzných a lékařů; nahradí se zástupnými značkami ([PACIENT], [DATUM_1]…). Věk se převede na rozmezí.
2. Na AI odchází jen anonymizovaný text, bez ID pacienta a bez vazby na zařízení.
3. Odpověď AI se v centrální aplikaci přiřadí zpět k pacientovi a značky se doplní.
4. Fotografie zprávy se rozpoznávají (OCR) **v centrální aplikaci nebo v telefonu**, ne u AI; AI dostává až anonymizovaný text.
5. Poskytovatel AI smluvně bez uchovávání dat a bez tréninku na nich; každý dotaz se loguje (kdo, kdy, k čemu – bez obsahu).
6. AI nic nerozhoduje: předvyplní a upozorní na chybějící údaje, lékař potvrdí.

## Telefon a připojení

- Android Enterprise, režim „dedicated device“: běží jen aplikace průkazu, šifrování zařízení, vzdálené smazání, zablokované USB a ladění.
- Jen mobilní data přes SIM; Wi-Fi a Bluetooth vypnuto. Komunikace povolena pouze s centrální aplikací a MDM.
- Volání jen na čísla z průkazu (hospic, lékař garanta, zástupce, 155).
- Telefony vlastní a spravuje jeden provozovatel (např. Nadace Most k domovu); při změně garanta se telefon nepřepárovává, mění se jen oprávnění.

## Bezpečnost dat

- **Telefon:** šifrovaná databáze (SQLCipher), klíč v Android Keystore; bez přihlášení dostupný jen výřez krizové karty.
- **Přenos:** TLS 1.3, pinning certifikátu, vlastní klientský certifikát každého zařízení (mTLS) – ukradený telefon se odpojí jedním kliknutím.
- **Server:** oddělená databáze průkazů, šifrování v klidu, hosting v ČR/EU, denní zálohy, neměnný log přístupů.
- **Ztráta telefonu:** vzdálené smazání + zneplatnění certifikátu; data jsou v centrální aplikaci, náhradní telefon se spáruje do 5 minut.
- **Notifikace a SMS** nikdy neobsahují jméno ani diagnózu.

## Právní rámec (k posouzení právníkem)

- Správcem plánu péče je garant; poskytovatelé v týmu jsou správci svých zápisů; provozovatel centrální aplikace je zpracovatel. Ostatní ošetřující poskytovatelé přistupují v rozsahu § 65 zák. 372/2011 Sb.
- Model sdílené platformy se střídajícími se správci (případně společní správci podle čl. 26 GDPR) je nejcitlivější bod návrhu.
- Povinné: DPIA, smlouvy o zpracování (hosting, AI), informace pacientovi, archivace po ukončení podle vyhlášky 98/2012 Sb.
- Anonymní AI dotazy nejsou zpracováním osobních údajů u poskytovatele AI, pokud anonymizace skutečně znemožní identifikaci – ověřit testem a v DPIA.

## Životní cyklus

1. Provozovatel připraví telefon v MDM (kiosk, čeká na párování).
2. Garant zavede pacienta v centrální aplikaci (ručně nebo z anonymně rozebrané propouštěcí zprávy), spáruje telefon QR kódem, vytiskne záložní kartu, vydá PINy rodině a zařízení.
3. Při přesunu pacienta garant předá garanci / upraví tým; telefon jde s pacientem.
4. Při ukončení garant pořídí výpis a uzavře průkaz; MDM telefon vymaže a vrátí do oběhu; záznam se archivuje v centrální aplikaci.
