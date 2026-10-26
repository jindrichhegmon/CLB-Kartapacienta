# CLB-Kartapacienta – Karta pacienta (paliativní průkaz)

Krizový plán péče, který má pacient vždy u sebe. Garant zavede pacienta v centrální aplikaci,
telefon u lůžka s ní komunikuje šifrovaně, ukazuje poslední stav i bez připojení a při každém
připojení se sesynchronizuje. Dotazy na AI jsou vždy anonymní.

**Živě:** https://kartapacienta.95-216-201-2.sslip.io (VPS Hetzner, pm2 `clb-kartapacienta`, port 3120, Caddy)

| Aplikace | Adresa | Pro koho |
|---|---|---|
| Správa tenantů | `/tenanti/` | provozovatel platformy – založení organizace jedním formulářem |
| Centrální aplikace | `/centrala/?t=<IDTENANT>` | garant a tým kolem pacienta (nemocnice, hospic, PL, domov) |
| Karta na mobil | `/karta/` | zapůjčený telefon u lůžka (PWA, offline, šifrovaná data) – **jeden pacient, jen v telefonu s číslem uvedeným u pacienta** |
| Můj průkaz | `/pacient/` | vlastní telefon soběstačného pacienta (PWA) – data od lékaře jen ke čtení, vlastní přání, léky a poznámky jen v telefonu |

Vše startuje z jednoho serveru (`src/server.js`), zatím ne z Netlify. Make se nepoužívá.
Od 0.2.0 je to ostrá verze: lokální prototyp `/demo/` je zrušený (adresa přesměruje na úvod) a nový tenant se zakládá bez ukázkových dat.

## Ostrá verze (0.2.0) – jeden telefon na pacienta, načtení z PéčeDoma

- **Telefon s kartou:** u každého pacienta je povinné číslo telefonu, na kterém bude karta (`A_KP_Pacient.TelefonKarty`,
  normalizované `+420…`, `src/telefon.js`). Telefon se spáruje jen tehdy, když při párování zadá **stejné číslo**
  (`/api/d/parovat { tenant, kod, telefon }`) – jiné číslo server odmítne. Spárovaný telefon si číslo pamatuje
  (`A_KP_Zarizeni.Telefon`). Při změně čísla v Údajích se telefon spárovaný s předchozím číslem zablokuje (při připojení se
  vymaže). Jako dosud platí: nový telefon zablokuje předchozí, takže karta je vždy jen v jednom telefonu.
- **SMS s odkazem:** v záložce Telefon a PINy tlačítko „Poslat odkaz SMS na …“ (a totéž v okně „Spárovat telefon“) vydá
  párovací kód a pošle odkaz SMS přímo na číslo s kartou (Twilio, proměnné `TWILIO_*` jako jhn-apps; když v `.env` karty
  chybí, server je přečte z `/opt/jhn-apps/.env`, odesílací číslo výchozí `+420736354150`). Stav ukazuje `/api/health` → `sms`.
  Když SMS nejde, okno napíše proč a páruje se QR kódem a potvrzením čísla.
  Údaje k Twiliu (Account SID, Auth Token z console.twilio.com) na VPS nastaví `./deploy/set-twilio.sh` – zapíše je do `.env` karty i jhn-apps a obě restartuje.
- **Načtení z PéčeDoma:** v průvodci „Nový pacient“ tlačítko **Načíst soubor JSON** převezme soubor z portálu PéčeDoma
  (Data klienta → Export pro Kartu pacienta, `format: 'CLB-Kartapacienta/pacient'`): údaje pacienta, diagnózy, léky, funkční
  stav a kontakty. Lékař zkontroluje a doplní cíl péče, limitace a číslo telefonu s kartou (předvyplněný je telefon klienta).
- **QR kód přímo v aplikaci (0.2.2):** na úvodní obrazovce karty tlačítko **Načíst QR kód fotoaparátem** (BarcodeDetector, na iPhonu
  `public/shared/jsqr.min.js`, jsQR 1.4.0, Apache-2.0). Na iPhonu má aplikace přidaná na plochu vlastní úložiště, proto se páruje až v ní –
  karta to v Safari připomene.
- Migrace `sql/03_kp_telefon_karty.sql` (idempotentní) přidá sloupce `TelefonKarty` a `Telefon`.

## Více průkazů v jednom telefonu (0.11.0)

- Telefon u lůžka (`public/karta/`) drží seznam průkazů `KARTY` (šifrované úložiště `{ karty: [...] }`, starší uložení jednoho průkazu se převede);
  `D` je vybraný průkaz. Víc průkazů → po spuštění a po zamknutí **výběr pacienta** (`kresliVyber`: jméno, kód, pobyt, zhoršení, fronta,
  stará data), šipka zpět v hlavičce (`btnVyber`), tlačítko Přidat další průkaz. Párování s kódem (QR / SMS odkaz) průkaz **přidá** vedle
  stávajících (tentýž pacient s novým kódem nahradí svůj starý); `sync({ karta })` běží pro každý průkaz zvlášť (`syncVse`), `smazat` / 401
  odebere jen ten jeden (`odeberKartu`). Server beze změny: každý pacient má své zařízení a token, číslo telefonu u pacientů je stejné.
  Centrála v okně Spárovat telefon ukáže `dalsiNaTelefonu` – čí průkazy už na tom čísle jsou.

## Týmy lidí (0.10.0)

- 0.11.21: role na kartě `LEKAR` se jmenuje **Lékař a spec. sestra** (ROLE_OSOBY, ROLE_KARTA, KP.ROLE, ROLE_CHAT/ROLE_LEKY, nápověda kap. 10 a 11); práva beze změny – specializovaná sestra s touto rolí upravuje léky na telefonu jako lékař.
- 0.11.20: Zpřístupnit pacientovi – **text SMS viditelný a upravitelný** v okně (`pz_txt`, značka `{odkaz}`, počet znaků a SMS, pamatuje se v `localStorage.kp_sms_pacient`); server `POST /pacient/:id/pacientovi` bere `text` (≤ 600 znaků, výchozí `SMS_PACIENT_VYCHOZI` i v `/ja`), vrací odeslaný text, audit „vlastní text“.
- 0.11.19: chat PéčeDoma – bubliny barevně podle autora (`.msg.tym` modře = poskytovatel/tým, `.msg.klient` fialově = klient, rodina, karta) ve všech třech aplikacích; zarovnání vpravo/vlevo zůstává podle toho, kdo chat otevřel.
- 0.11.18: párovací kód se znovu nevydává, dokud platí (karta ≥ 10 min, Můj průkaz ≥ 1 h a stejné číslo) – QR, SMS i další kliknutí vrací stejný kód (audit „párovací kód zobrazen znovu“); nápověda kap. 8 a 18.
- 0.11.17: **Štítky na telefon** (`stitkyOkno`): samolepky 70 × 37 mm, 3 × 8 na A4, tisk přes nové okno (`@page A4, margin 0`, absolutní pozice); komu telefon patří (garant nebo společný text), jméno + kód, kam volat (telefon 24/7 garanta, jinak zadané číslo); výběr pacientů, kopie, první volný štítek. Tlačítka v přehledu Pacienti a v záložce Telefon a PINy; nápověda kap. 3 a 8.
- 0.11.16: pacient v domově seniorů odlišený v přehledu (štítek `.chip.dom` + pruh `tr.vdomove`) a v záhlaví detailu; `/prehled` vrací `domov` = název pracoviště typu DOMOV v aktivním týmu, frontend `vDomove()` s náhradou podle textu pobytu.
- 0.11.15: Pacienti – panel Upozornění jako `<details>` (nad 3 zavřený, souhrn podle druhu, stav v `localStorage.kp_upoz`), sloupec **Adresa** místo Pobyt (`/prehled` vrací `adresa`, pobyt jako podřádek), **fulltextové hledání** v agendách (`hledatHTML`/`bindHledani`: Pacienti, Lidé a týmy, Pracoviště, Uživatelé, Telefony, Log přístupů; filtruje řádky tabulek bez diakritiky, text se pamatuje v `S.hledat`).
- 0.11.14: centrální aplikace přes celou šířku obrazovky (`.app.wide{max-width:none}`; dřív 1180 px), od 1500 px větší boční odsazení.
- 0.11.13: políčka vedle sebe (`.frow`) v jedné úrovni: `.field` uvnitř řádku je `display:contents`, popisek / políčko / nápověda mají každý svůj řádek mřížky (popisek zarovnaný dolů), takže dvouřádkový popisek ani nápověda pod políčkem souseda neposunou. Snímkový skript hlídá, že horní hrany políček v jednom řádku jsou stejné.
- 0.11.12: záložka **Údaje** v detailu pacienta přejmenována na **Detail pacienta** (TAB_NAZ, tabs, nápověda kap. 9).
- 0.11.11: pruh pod hlavičkou v obou telefonních aplikacích (`.rezim` v `kp.css`): **Karta týmu · telefon u pacienta** (po odemknutí i role a jméno) × **Karta pacienta a rodiny · vlastní telefon pacienta**. Můj průkaz už nemá vlastní seznam léků ani Přidat lék – léky mění jen lékař; pacient a rodina jen zaznamenávají podání (sdílení: položka `LEKY` z telefonu pacienta odpadá, server ji dál přijme).
- 0.11.10: párovací kód (`POST /api/d/parovat`, `GET /api/d/parovaci-info`) platí po celou dobu platnosti i po spárování (`Stav IN ('CEKA','SPAROVANO')`, `ParovaciKod` se po spárování nenuluje) – stejné číslo telefonu ho smí použít znovu (aplikace na ploše iPhonu má vlastní úložiště), předchozí kopie dostane 401 a odebere se; audit „telefon spárován znovu stejným kódem“. Platnost kódu karty 15 → 30 minut. Texty v párování, nápověda (kap. 8, 18, 19).
- 0.11.9: Můj průkaz – **Předepsané léky** ve skupinách jako v centrále (`KP.SKUPINY_LEKU`, bloky `.lkskup`) a denní záznam **Podán / Nepodán** u každého léku (`D.moje.podani`, jen pro doplňování, jen v telefonu; „naposled podán“, dnešní záznamy, okno Historie). Sdílení týmu: nový druh `PODANI` (posledních 30 dní) v `DRUHY_SDILENI` a `DRUH_OD_PACIENTA`. `KP.casLokalni(posunDni)`.
- 0.11.8: jednotný vzhled všech políček a výběrů (`kp.css`: jedno pravidlo pro `input`/`select`/`textarea` i mimo `.field` – filtr v Lidé a týmy, tabulka importu, hledání klienta PéčeDoma, poznámka u zhoršení; v telefonu 42 px i v oknech přes `body:has(.app:not(.wide))`). Snímkový skript hlídá, že každé viditelné políčko má na obrazovce stejnou výšku (38 px počítač / 42 px telefon).
- 0.11.7: **Vytisknout kartičky s PINem** v okně týmu (`POST /tym-lidi/:id/piny`): platné PINy všech aktivních členů (i jiných pracovišť), `bezPinu` = členové s PINem jen v otisku, `noveChybejicim: true` jim vydá nový; `pinyOkno(piny, nadpis)` s pracovištěm a označením nového PINu; audit.
- 0.11.6: **Zobrazit PIN** v okně člena týmu (`POST /osoba/:id/pin/zobrazit`, audit): PIN se při vydání ukládá i šifrovaně klíčem serveru (`A_KP_Osoba.PinSifrovany`, `sql/01h_kp_osoba_pin.sql`, `zasifruj`/`desifruj`); telefon ověřuje dál jen Salt/Hash. Starší PINy bez šifrované kopie → 409 a nabídka nového PINu. Okno přejmenováno na „Upravit – člen týmu“, tlačítko „+ Člen týmu“.
- 0.11.5: uživatelé PéčeDoma pro Lidé a týmy přes partnerské API (`uzivatelePd` → pecedoma-karta akce `uzivatele`, CLB1 s telefony); kopie `A_MSPPP_UzivatelSestra` v PeceDomaPlus telefony nemá a použije se jen bez nastaveného propojení (`zdroj: 'db'`, centrála upozorní).
- 0.11.4: `A_KP_Pacient.Email` (`sql/03b_kp_pacient_email.sql`) – pole E-mail pacienta v Údajích a průvodci (z exportu PéčeDoma `pacient.email`), `POST /pacient` a `/udaje` ho ukládají; do balíku telefonu nejde.
- 0.11.3: **Aktualizovat z PéčeDoma** (`POST /lide/pecedoma/aktualizovat { poskytovatelId | osobaId }`): telefon a `ExterniID` podle `A_MSPPP_UzivatelSestra` (párování `pd:<UzivatelID>`, jinak jméno); portál e-mail nevede. Tlačítko v liště Lidé a týmy a v okně člověka; `GET /lide` vrací `externiId`.
- 0.11.2: **Smazat tým** v okně týmu (`POST /tym-lidi/:id/smazat`): zneaktivní, synchronizuje členy u pacientů (přepis na jiný tým / vyřazení), vynuluje `A_KP_PacientOsoba.TymLidiID`, smaže `A_KP_PacientTym`, `A_KP_TymClen` a hlavičku; audit.
- 0.11.1: `synchronizujTymUPacientu` respektuje `UX_A_KP_PacientOsoba_Aktivni` (člověk u pacienta aktivní nejvýš jednou): člen ve dvou týmech téhož pacienta nebo přiřazený dřív jednotlivě se znovu nevkládá; při odchodu z jednoho týmu se řádek jen přepíše na jiný aktivní tým; deaktivace / aktivace člena platí pro člověka u pacienta, stav členů v detailu podle kteréhokoli jeho řádku.
- 0.10.2: **členství v týmu explicitně** (`A_KP_TymClen`, `sql/01f_kp_tym_clenove.sql` převezme stávající `A_KP_Osoba.Tym`): tým patří pracovišti, které ho založilo (garant), členem může být kdokoli z organizace (i jiná pracoviště), člověk ve více týmech. `GET /lide` vrací `clenstvi`; `POST /tym-lidi { clenove }` zapisuje `A_KP_TymClen`; `synchronizujTymUPacientu` přidá pracoviště členů do `A_KP_Tym` (péče) u pacientů s týmem; nabídka týmů u pacienta nese `mimoTym` (pracoviště, která se přidají). Textový `A_KP_Osoba.Tym` se už nepoužívá, formulář člověka tým neukazuje (týmy jen v okně týmu).
- 0.10.1: krizová karta (`KP.kartaHTML`, oddíl KOHO VOLAT) ukazuje po řádcích Nejdřív a Lékař plánu **všechny důležité kontakty** v pořadí ze záložky (Rozhoduje první, pak Informovat a Pečuje) se štítkem skupiny a poznámkou; dřív byla vidět jen skupina rozhoduje.
- Agenda **Lidé a týmy** spravuje i týmy: `A_KP_TymLidi` (hlavička týmu v pracovišti: název, popis, aktivní; `sql/01e_kp_tymy.sql` ji založí i pro týmy,
  které už lidé měli v `A_KP_Osoba.Tym`). Členství zůstává `A_KP_Osoba.Tym` = název týmu (člověk nejvýš v jednom týmu). `POST /api/c/tym-lidi`
  (založení / úprava / členové), `GET /lide` vrací `tymy`. Formulář člověka vybírá tým ze seznamu; CSV a PéčeDoma import týmy zakládá sám.
- **U pacienta se vybírá celý tým** (`A_KP_PacientTym`, panel Týmy u pacienta v záložce Tým a garance, `POST /pacient/:id/tym-lidi`
  `{ pridatTymId | odebratTymId | tymId+osobaId+aktivni }`); členové se materializují do `A_KP_PacientOsoba` se sloupcem `TymLidiID`,
  takže telefon (`balikProZarizeni`) i deník přístupů čtou totéž co dřív. U pacienta jde člena jen **deaktivovat / aktivovat**; jednotlivé
  přidávání (`POST /pacient/:id/lide { pridat }`) je vypnuté, `odebrat` zůstává pro záznamy bez týmu. `synchronizujTymUPacientu` po každé změně
  týmu nebo člověka doplní nové členy ke všem pacientům s týmem a odebere ty, kdo v týmu nejsou (deaktivovaný člen se sám nevrací).
  Přidání týmu pracoviště mimo tým kolem pacienta ho garantovi přidá s rolí péče. Odebrání pracoviště z týmu vyřadí i jeho týmy u pacienta.

## Diagnóza první, jedny léky, deník o pacientovi (0.9.0)

- Záložky v pořadí Krizová karta, Diagnóza, Plán péče, Léky, … (centrála i telefon); telefon ukazuje Diagnózu i na zamčené první stránce. Záložka **Diagnóza** = dg, funkční stav, alergie (lékař upraví = nová verze plánu).
- **Léky – jedna agenda** (`KP.leky(b)`): u pacienta s `PdKlientID` jsou léky z PéčeDoma (`A_KP_PdSync`, zdroj `A_MSPPP_Medikace`) a Karta je
  tam i mění: `GET/POST /api/c/pacient/:id/leky`, `POST …/leky/smaz` → jhn-apps `pecedoma-karta` akce `leky` / `lek-uloz` / `lek-smaz`
  (zneaktivnění), pak okamžitá synchronizace, deník `Úprava léků`, audit. Bez propojení jsou léky v plánu (nová verze přes `/plan`).
  Krizová karta, výpis, telefon i Můj průkaz berou léky z `KP.leky`; formulář plánu léky nemá (jen průvodce Nový pacient).
  Balík telefonu nese `pecedoma.propojeno`.
- 0.9.6: záložka **Důležité kontakty** (centrála): jeden seznam v pořadí Poradi/KontaktID jako v kartě a na telefonu, formulář vedle, úprava přímo ve formuláři (`S.kontEdit`, žádné okno s duplicitními id – dřívější okno četlo prázdná pole formuláře stránky a kontakt přepsalo prázdnými hodnotami), šipky ↑↓ = `POST /kontakt { id, jenPoradi, poradi }` bez deníku; server: prázdné `poradi` = beze změny (dřív `Number('') = 0`), u úpravy povinné jméno i telefon.
- 0.9.5: skupiny léků v `KP.lekyRadky` jako samostatné bloky (`.lkskup`: barevný pruh vlevo, podbarvené záhlaví s počtem – SOS oranžově, opioidy červeně, pravidelné modře, parenterální fialově).
- 0.9.4: **vzhled jako PéčeDoma** (`public/shared/kp.css`): paleta modrých odstínů (`--bg #f0f7fd`, `--line #d6e6f5`, `--head`, `--top1`), písmo Segoe UI / system-ui, hlavička s přechodem a bílými prvky, tlačítka 38 px (`.btn.sm` 32 px, obrys v hlavní barvě, primární plné, `.btn.ulozit` zelené = tlačítka Uložit / Zapsat), pole formulářů 38 px (telefon 42 px / 16 px kvůli zoomu iOS), záhlaví panelů a tabulek jako `th` portálu, řádky tabulek 8 px, štítky jako `.tag`, panely 10 px s jemným stínem, toast vpravo dole. Schémata 🎨 dopočítávají i `--head`, `--line`, `--top1`.
- 0.9.3: skupina **Opioidy** zvlášť od pravidelné medikace (PéčeDoma typ `OPIOID`, portál 2.00): `A_KP_PdSync.Opioidy` (migrace v `01d`), `normalizujSync` / `stavSync` / balík `pecedoma.opioidy`, plán `opioidy` (`normalizujPlan`), `KP.leky().opioidy`, `KP.SKUPINY_LEKU` (SOS léky, Opioidy, Pravidelná medikace, Parenterálně) pro `KP.lekyRadky` i okno léku; krizová karta ukazuje opioidy pod SOS léky; telefon lékaře má na dlaždici Léky jen jeden upravitelný seznam (bez zdvojeného výpisu). Stávající léky v CLB1 byly přetříděny podle názvu (63 záznamů u 54 klientů).
- 0.9.2: **DIAGNÓZA je první oddíl krizové karty** (`KP.kartaHTML`, `.sec.navy`: dg + funkční stav) – centrála, telefon i zamčený, Můj průkaz, tisk; `KP.SYSTEM_TYPY` (Systém, Úprava údajů) mimo hlavní deník i „poslední zápis“ v kartě.
- 0.9.1: Diagnóza i na zamčené první stránce telefonu; lékař (role lekar / pl) upravuje léky propojeného pacienta z telefonu (`GET/POST /api/d/leky`, `/leky/smaz`, deník neověřený zápis, audit); sdílené `KP.lekyRadky` / `KP.lekOkno`; tlačítka v patičce karty se zalamují.
- **Deník**: `KP.denikHTML` ukazuje zápisy o pacientovi, typ `Systém` sbalený v „Systémové záznamy“; počet v záložce bez systémových.

## Chat PéčeDoma a návštěva v kartě (0.8.0)

- **Nejbližší návštěva** z PéčeDoma je oddíl krizové karty (`KP.kartaHTML`, `.sec.green`) – centrála, telefon (i zamčený pro ZZS), Můj průkaz, tisk.
  `balikZDetailu` i `balikProZarizeni` předávají `pecedoma` (sync + `chat`).
- **Chat PéčeDoma s klientem** = vlákno `A_MSPPP_Zprava` portálu (Data klienta → Zprávy) přes jhn-apps `pecedoma-karta` akce `zpravy` / `zprava`
  (partnerský klíč; text dostane značku `[Karta · kdo]`, portál a aplikace klienta ji vidí). Centrála: `GET /api/c/pacient/:id/pecedoma/zpravy`,
  `POST …/pecedoma/zprava` (tým kolem pacienta, OD_TYMU, kdo = jméno uživatele). Telefony: `GET /api/d/pecedoma/zpravy`, `POST /api/d/pecedoma/zprava`
  (token zařízení; OD_PACIENTA; zapůjčený telefon píše pod rolí a jménem odemknutí, Můj průkaz jako „pacient“). Telefon token PéčeDoma nikdy nedostane,
  vše jde přes server Karty, každé zobrazení a odeslání je v auditu. Společné okno `KP.chatOkno` v `public/shared/kp.js`.
- Telefon: tlačítko **Přidat kartu na plochu telefonu** na obrazovce párování (Android/Chrome, `beforeinstallprompt`).
- 0.8.6: odkaz v SMS i QR nese číslo (`#p=TENANT.KOD.T420…`), telefon ho předvyplní okamžitě i bez spojení; serverové dohledání z 0.8.5 zůstává pro starší odkazy a ručně opsaný kód.
- 0.8.5: `GET /api/d/parovaci-info?tenant&kod` vrátí k platnému kódu číslo, pro které byl vydán (limit 30/h na IP); telefon i Můj průkaz ho po načtení kódu předvyplní a uživatel jen potvrdí (`Potvrdit a spárovat/propojit`); párování číslo dál ověřuje.
- 0.8.4: poslední dvě zprávy chatu jsou vidět rovnou v panelu (`KP.chatNahled`; telefon a Můj průkaz je drží v `D.zpravy`, načítají nejvýš jednou za 5 min; centrála načte při vykreslení záložky), `KP.chatOkno` volá `poZmene(zpravy)`.
- 0.8.3: minimum textů na obrazovce – `KP.sbalVysvetlivky(root)` přesune `.note` a `.rolehelp` (bez třídy `keep`) na konec do sbaleného bloku `<details class="vysv">` „Vysvětlivky“; telefon, Můj průkaz (všechny obrazovky) i detail pacienta v centrále; tisk blok skrývá.
- 0.8.2: chat na zablokovaném či odpojeném telefonu vrací 403 se srozumitelnou hláškou (GET i POST) a telefon hned spustí sync, aby ukázal obrazovku „Lékař ukončil přístup“.
- 0.8.1: v Mém průkazu je chat na hlavní stránce pod krizovou kartou jako **Zprávy pro a od lékaře** (`KP.chatOkno` bere `nazvy` stran: „Vy“ / „Lékař a tým“).

## Propojení s PéčeDoma (0.7.0)

- **Nastavení** (Správa organizace → Nastavení → Propojení s PéčeDoma, `A_KP_Nastaveni`): `PD_ODKAZ` (adresa portálu organizace – ukazuje se
  u pacienta), `PD_API` (server jhn-apps, výchozí `https://95-216-201-2.sslip.io`), `PD_TOKEN` (x-app-token aplikace, do prohlížeče se nevrací),
  `PD_SYNC` (automatická synchronizace). Server se PéčeDoma prokazuje navíc `KP_PARTNER_KLIC` (`klic` v těle) – `src/pecedoma.js`.
- **Výběr klienta** v průvodci Nový pacient (`GET /api/c/pecedoma/klienti?q=`, `GET /api/c/pecedoma/klient/:id` → stejný JSON jako soubor
  Export pro Kartu pacienta); pacient si pamatuje `A_KP_Pacient.PdKlientID` (i při načtení ze souboru – `puvod.famicuraKlientId`).
- **Synchronizace** propojených pacientů (`A_KP_PdSync`): aktivní léky (SOS, pravidelné) a nejbližší plánovaná návštěva z kalendáře FK
  (kdy, lékař/sestra, služba · stav · místo). Automaticky po startu a každých 30 min (tenanti s `PD_SYNC=1`, `KP_PECEDOMA_SYNC=0` vypne),
  ručně tlačítkem u pacienta (Detail pacienta → PéčeDoma), při založení a propojení. **Plán péče se nemění** – léky z PéčeDoma se ukazují vedle plánu
  (centrála, telefon, Můj průkaz) a lékař je tlačítkem převezme do formuláře nové verze. Návštěva je v Krizové kartě a na telefonu.
- Druhá strana: jhn-apps `pecedoma-karta` (akce `klienti`, `klient`, `sync` s partnerským klíčem), `pecedoma-famicura` exportuje `sestavKartu`.
- Migrace `sql/01d_kp_pecedoma.sql`.

## Dva režimy telefonu a doklad k limitacím (0.5.0)

- **Zapůjčený telefon** (`/karta/`, `A_KP_Zarizeni.Rezim = 'ZAPUJCENY'`) – beze změny: telefon garanta jen s kartou, ZZS bez PINu, tým osobními PINy.
- **Můj průkaz** (`/pacient/`, `Rezim = 'PACIENT'`) – podle připomínek MUDr. Kabelky:
  - garant nebo lékař v týmu v Telefon a PINy → **Zpřístupnit pacientovi v jeho telefonu** (`POST /api/c/pacient/:id/pacientovi { telefon, sms }`):
    kód jen pro číslo pacienta (uložené v `A_KP_Zarizeni.Telefon`), SMS s odkazem `/pacient/#p=…` nebo QR v ordinaci, platí 3 dny;
  - telefon pacienta dostane plán, kontakty a tým (`balikProZarizeni(…, { rezim: 'PACIENT' })`) – **bez deníku, PINů týmu a tajemství kódu lékaře**,
    do deníku nezapisuje; „Ukončit přístup“ → při synchronizaci `{ prikaz: 'odpojit' }`, nic se nemaže (kopie pacienta, § 65);
  - vlastní záznamy pacienta (hodnoty a přání s původem, léky, které skutečně užívá, poznámky a otázky) jsou **jen v telefonu**, šifrované dvakrát
    (PBKDF2 z PINu pacienta 310 000 iterací + nevyexportovatelný klíč telefonu); zapomenutý PIN nikdo neobnoví;
  - **Sdílet**: výběr → náhled s datem vytvoření a původem každé položky → tisk/PDF, poslat jinam (Web Share) nebo **poslat týmu**
    (`POST /api/d/sdilet` → `A_KP_Sdileni`, jen doplňovat, + zápis „Sdíleno pacientem“; v centrále panel **Od pacienta** v Krizové kartě);
  - **Nouzové info**: připravený text do Zdravotního ID na zamčené obrazovce (iPhone, Android).
- **Doklad k limitacím** (`normalizujDoklad` v `src/kp.js`, `KP.dokladHTML`): u DVP písemné poučení lékařem, úředně ověřený podpis, nebo
  „sepsáno při přijetí u poskytovatele“ (karta pro ZZS napíše, že platí jen tam). Vyplnění v aplikaci DVP nevytváří – formulář to říká.
- **Dokumenty** mají datum a pracoviště, které je vydalo (původ informace).
- Migrace `sql/01c_kp_pacient.sql` (před `02_kp_rls.sql`): `Rezim`, `A_KP_Sdileni` s triggerem jen pro doplňování, `DatumDokumentu`, `Pracoviste`.

## Lidé a týmy, role na kartě (0.4.0)

- **Lidé a týmy** (menu v centrále, `A_KP_Osoba`): každé pracoviště – garant i partner (domov, PL) – zapíše své lidi **jednou** a rozdělí do týmů;
  ručně, z **CSV** (jméno; role; telefon; e-mail; tým – UTF-8 i Windows-1250) nebo **z PéčeDoma** (`A_MSPPP_UzivatelSestra` ve stejné databázi
  a tenantu). Každý dostane **osobní PIN** (zobrazí se jednou, tisk kartiček, volitelně SMS), který platí u všech pacientů, ke kterým je přiřazen.
- **Přiřazení k pacientovi** (`A_KP_PacientOsoba`, detail → Telefon a PINy → Přiřadit lidi z týmů): celý tým nebo jednotlivci z pracovišť v týmu
  kolem pacienta; garant a lékař kohokoli, partner své lidi. Odchod pracoviště z týmu přiřazení zruší. Telefon dostane PINy přiřazených lidí v balíku.
- **Role na kartě** jako v demu: lékař, praktický lékař, hospic, sestra DPS (osobní PIN), rodina (PIN u pacienta), ZZS (bez PINu, jméno a posádka
  povinně až u výjezdu). Po odemknutí telefon ukáže, co role smí; typy zápisů = `POVOLENE` v `src/routes/device.js` (test hlídá shodu).
- Migrace `sql/01b_kp_lide.sql` běží před `02_kp_rls.sql`, takže indexy a RLS doplní tentýž běh.

## Standard aplikací (0.3.0) – nápověda, chat a vzhled jako PéčeDoma

- **📖 Nápověda** ve všech aplikacích: návod s obrázky (`napoveda/napoveda.md`, 19 kapitol, snímky v `public/napoveda/img`),
  obsah vlevo, otevře se na kapitole k aktuální obrazovce, klik zvětší obrázek, **🖨 Tisk** / Uložit jako PDF. Na telefonu funguje i offline.
- **💬 Chat nad návodem** (`POST /api/napoveda/dotaz`, `src/routes/napoveda.js`): Claude odpovídá jen podle návodu a odkáže na kapitolu;
  jen pro přihlášené (session centrály / správy tenantů) a spárované telefony; dotazy jdou přes anonymizační bránu; bez `ANTHROPIC_API_KEY`
  odpoví lokální hledání v návodu. V centrále modré **?** vlevo dole.
- **🎨 Vzhled**: 10 barevných schémat jako v PéčeDoma (Karta modrá – výchozí, v noci tmavá podle systému –, PéčeDoma Plus zelená, Datec modrá,
  Veselá, Konzervativní, Letní, Zimní, Podzimní, Jarní, Tmavá); pamatuje se na zařízení (`localStorage kp_vzhled`). Společný modul `public/shared/kp-napoveda.js`.
- **Snímky do návodu** se smyšlenými daty, bez databáze: `node scripts/napoveda-snimky.mjs` (Playwright) a `python3 scripts/napoveda-zmensit.py` (256 barev).

## Tenanti – stejný princip jako Péče doma Plus

- Databáze **PeceDomaPlus** (Srv-MPerfect), sdílená tabulka `dbo.Tenants` (IDTENANT `char(16)` = IČO + 8 písmen).
- 14 tabulek **`A_KP_*`**, v každé první sloupec `IDTENANT` s `DEFAULT SESSION_CONTEXT('IDTENANT')`, FK na `Tenants`,
  index `IX_<tabulka>_Tenant` a FILTER + BLOCK predikát v `sec.TenantPolicy` (Row-Level Security).
- Server každou operaci spouští v transakci, která nejdřív nastaví `sp_set_session_context 'IDTENANT'`
  (`src/db.js → vTenantu`). Bez kontextu databáze nevrátí nic, `'*'` je správcovský režim (jen správa tenantů a migrace).
- **Tenant = organizace, která provozuje síť karet** (např. Nadace Most k domovu Zlín pro kraj, nebo jeden hospic).
  Uvnitř tenanta jsou pracoviště (`A_KP_Poskytovatel`: nemocnice, hospic, ambulance, PL, domov, ZZS), uživatelé,
  pacienti, garance a tým kolem pacienta – předání pacienta mezi pracovišti tak zůstává uvnitř RLS.
- **Snadné založení tenanta** (`/tenanti/` → „Založit tenanta“): IČO (název a adresa z ARES), typ prvního pracoviště,
  jméno a login správce. Vznikne tenant (nebo se použije existující se stejným IČO, např. CLB
  `02570459DSIDEQAJ`), první pracoviště, správce s vygenerovaným heslem a odkaz pro přihlášení + text k odeslání.

### Tabulky

| Tabulka | Obsah |
|---|---|
| `A_KP_Nastaveni` | `KP_AKTIVNI`, `NAZEV_SITE`, `INTERVAL_REVIZE` |
| `A_KP_Poskytovatel` | pracoviště; `SmiBytGarant` = nemocnice, hospic, ambulance, PL (domov ne) |
| `A_KP_Uzivatel` | login (unikátní v tenantu), scrypt hash, role `admin,lekar,sestra,ctenar` |
| `A_KP_Pacient` | identita (jen v centrále), kód průkazu `P-0001`, stav |
| `A_KP_Garance` | garant: `NAVRZENO → PLATNA → UKONCENA` / `ODMITNUTO`; vždy max. 1 platná (filtrovaný unikátní index) |
| `A_KP_Tym` | tým kolem pacienta: `GARANT`, `LEKAR`, `PECE`, `HOST` |
| `A_KP_PlanVerze` | plán péče jako JSON, neměnné verze s podpisem lékaře |
| `A_KP_Kontakt` | `ROZHODUJE` / `INFORMOVAT` / `PECUJE` |
| `A_KP_Denik` | jen doplňovat (trigger brání UPDATE/DELETE), UUID z telefonu = idempotentní sync |
| `A_KP_Zarizeni` | telefony: párovací kód, SHA-256 tokenu, šifrované tajemství pro kód lékaře, poslední sync, baterie |
| `A_KP_Pin` | PINy pečujících (PBKDF2-SHA256, ověřuje i telefon offline) |
| `A_KP_Dokument` | DVP, zprávy (varbinary) |
| `A_KP_AuditLog` | neměnný log přístupů |
| `A_KP_AIDotaz` | log dotazů na AI bez obsahu (délka, počet anonymizovaných údajů, blokováno) |

DDL: `sql/01_kp_tabulky.sql`, `sql/02_kp_rls.sql` (idempotentní, `npm run migrate`).

## Bezpečnost a soukromí

- Prohlížeč neposílá žádné SQL – všechny dotazy jsou pevně na serveru a vázané na přihlášenou session (HMAC, 12 h).
- Přístup k pacientovi jen pro pracoviště v týmu kolem pacienta (nebo správce tenanta); plán mění jen lékař garanta / lékař v týmu.
- Telefon: token zařízení (v DB jen SHA-256), data v IndexedDB šifrovaná AES-GCM klíčem, který nejde vyexportovat;
  zablokovaný telefon se při připojení vymaže; nový telefon automaticky zablokuje předchozí.
- Kód lékaře = **kód dne** (od 0.6.0): HMAC-SHA256(tajemství telefonu, `kod-dne:RRRR-MM-DD` v Europe/Prague), 6 číslic, celý kalendářní
  den stejný → telefon ho ověří offline (přijme i včerejší kvůli půlnoci); zobrazení se loguje. Stejný kód vrací partnerské API
  `GET /api/partner/kod-dne?tenant=&rc=&kdo=` (hlavička `x-partner-klic` = `KP_PARTNER_KLIC`) – používá ho PéčeDoma (jhn-apps
  `pecedoma-karta`, `.env`: `KARTA_URL`, `KARTA_PARTNER_KLIC`, `KARTA_TENANT`; doplní `deploy/vps-deploy.sh`) v Datech klienta.
- Tlačítka na zamčené kartě (0.6.0): **Přístup rodina** (PIN od garanta), **Přístup tým** (osobní PIN: sestra DPS, hospic, PL, lékař),
  **Lékař bez PINu** (kód dne); ZZS nic nezadává.
- **AI jen anonymně** (`src/anonym.js`): e-maily, známé identifikátory pacienta (jméno ve všech pádech, RČ, datum narození,
  adresa, telefony, jména kontaktů), pak vzory (RČ, data, telefony, PSČ, IČP, tituly + jména, příbuzní + jména).
  Rok narození → věkové rozmezí. Když po anonymizaci zůstane něco podobného identifikátoru, dotaz se neodešle.
  Fotka zprávy se převádí na text v prohlížeči (tesseract.js), k AI jde jen anonymní text. Bez `ANTHROPIC_API_KEY` běží lokální rozbor.

## Vývoj

```bash
cp .env.example .env    # doplnit heslo DB, KP_SECRET, KP_ADMIN_HESLO
npm install
npm test                # anonymizace, TOTP, PIN, hesla, session
npm run migrate         # tabulky A_KP_* (potřebuje přístup na SQL – jen z VPS)
npm start               # http://127.0.0.1:3120
```

SQL server pustí jen whitelistované IP (VPS 95.216.201.2) – lokálně na Macu databáze nepůjde, testuje se na VPS.

## Nasazení

```bash
cd ~/Documents/Claude/Projects/CLB-Kartapacienta && git pull && ./deploy/vps-deploy.sh
```

Skript při prvním běhu vytvoří na VPS `.env` (DB a AI převezme z `/opt/jhn-apps/.env`, vygeneruje `KP_SECRET`
a heslo správy tenantů a jednou ho vypíše), spustí migraci, pm2 a doplní doménu do Caddy.

## API (zkráceně)

- `GET /api/health`
- `/api/admin/*` – `login`, `ares`, `tenanti`, `zalozit`, `aktivni`, `spravci`, `reset-hesla`
- `/api/c/*` – `login`, `ja`, `heslo`, `prehled`, `poskytovatele`, `pacient` (+ `/:id`, `/udaje`, `/plan`, `/kontakt`, `/denik`, `/tym`,
  `/predat`, `/prevzit`, `/parovat`, `/zarizeni`, `/pin`, `/kod-lekare`, `/dokument`, `/vypis`, `/uzavrit`, `/souhlas`), `ai/rozbor`,
  správa: `poskytovatel`, `uzivatele`, `uzivatel`, `zarizeni`, `audit`, `nastaveni`
- `/api/d/*` – `parovat` (kód z QR → token + balík), `sync` (fronta zápisů → potvrzená UUID + aktuální balík / příkaz smazat)
- `/api/napoveda` – návod (Markdown, veřejné), `/api/napoveda/dotaz` – chat nad návodem (přihlášený uživatel / spárovaný telefon)

Podklady k návrhu (proč a jak): `docs/`.
