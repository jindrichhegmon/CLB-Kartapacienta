# Část A – Návrh řešení

## 1. O co jde

Pacienti v závěru života odcházejí z nemocnice s rozhodnutím o tom, jakou péči si přejí. V domově pro seniory, u praktického lékaře ani u záchranné služby o tom ale nikdo neví. Výsledkem jsou zbytečné resuscitace, výjezdy a hospitalizace proti vůli pacienta.

**Mobil u lůžka (paliativní průkaz)** je krizový plán péče, který má pacient vždy u sebe. Lékař garanta ho založí v centrální aplikaci a nahraje do jednoduchého telefonu, který leží u lůžka. Sestry, hospic, praktický lékař a rodina z něj čerpají a připisují do něj. Záchranáři vidí krizovou kartu bez přihlašování.

> **Pět zásad řešení.** (1) Garant zavede pacienta v centrální aplikaci, ta je primárním záznamem. (2) Telefon u pacienta s ní komunikuje výhradně šifrovaně. (3) Telefon ukazuje poslední stav i bez připojení. (4) Při každém připojení se data automaticky sesynchronizují oběma směry. (5) Veškeré dotazy na AI jsou anonymní.

![640](schema.png)

## 2. Příběh pacienta

Pan Novák, 82 let, pokročilé srdeční selhání, je hospitalizován. Paliativní tým s ním a s dcerou vede rozhovor o cílech péče. Pan Novák si přeje už nebýt resuscitován, nechce další hospitalizace, chce být doma nebo v domově a mít ulevováno od dušnosti. Lékař to zapíše do lékařské zprávy a sepíše s ním dříve vyslovené přání.

Dosud by tím příběh v nemocnici skončil a každý další poskytovatel by začínal od nuly. Nově **lékař paliativního týmu zavede pana Nováka v centrální aplikaci** a nahraje průkaz do telefonu, který si pacient odnáší s sebou: cíl péče, limitace a čím jsou doloženy, kdo za něj smí rozhodovat, SOS léky, běžný funkční stav, kontakty.

Pan Novák se vrací do domova pro seniory. Sestra si průkaz přečte, ví, co je u něj „normální“ a co je nové, a do deníku zapisuje změny stavu a podané SOS léky. Praktický lékař průkaz při návštěvě vidí a upravuje medikaci. Mobilní hospic, který domov navštěvuje, převezme garanci a pracuje s tímtéž záznamem. Dcera ví, kde jsou všechny informace, a nemusí je nikomu vysvětlovat znovu.

V noci se pan Novák zhorší. Sestra zapíše, co se děje a co už udělala, a volá podle průkazu, tedy nejdřív hospic, ne rovnou 155. Pokud přece jen přijede záchranná služba, posádka vidí na první pohled krizovou kartu: KPR ne, cíl symptomatická péče, doklad je dříve vyslovené přání z daného data, telefon na lékaře hospice. Nemusí nic hledat a nerozhoduje naslepo. V pokoji je slabý signál, ale karta i deník fungují; zápisy se odešlou, jakmile se telefon připojí.

Po třech měsících centrální aplikace upozorní, že plán čeká na revizi. Lékař hospice ho s panem Novákem projde, upraví a znovu potvrdí; nová verze se sama nahraje do telefonu. Po úmrtí lékař pořídí výpis do dokumentace, průkaz uzavře a telefon se vymazaný vrátí do oběhu.

## 3. Stakeholdeři a jejich role

| Kdo | Co dělá s průkazem | Co z něj má |
|---|---|---|
| **Pacient a rodina** | Má průkaz u sebe, určuje, kdo z rodiny má přístup | Jistota, že jeho přání jsou známa; rodina nemusí nic opakovaně vysvětlovat |
| **Paliativní tým nemocnice** | Zavádí pacienta v centrální aplikaci po rozhovoru o cílech péče, je dočasným garantem | Rozhodnutí z nemocnice se přenese dál a neztratí se při propuštění |
| **Mobilní hospic / paliativní ambulance** | Přebírá garanci, reviduje plán, je prvním kontaktem při zhoršení | Pacient je převzat s hotovým plánem, méně zbytečných výjezdů ZZS a hospitalizací |
| **Praktický lékař** | Čte, upravuje medikaci; u klientů domovů může být garantem | Má podklad pro vlastní zápis, nemusí rozhodovat o pacientovi, kterého málo zná |
| **Sestry domova pro seniory** | Čtou, zapisují do deníku stav a podané SOS léky, při zhoršení vyplní důvod volání | Vědí, co dělat a komu volat; nevyplňují za lékaře to, co jim nepřísluší |
| **ZZS Zlínského kraje** | Čte krizovou kartu, zapíše výjezd | Okamžitě ví, o jaký doklad se limitace opírá, a má telefon na lékaře, který ji stanovil |
| **Opatrovník / zástupce** | Je uveden s rolí „rozhoduje“, odděleně od osob, které se jen informují | Je kontaktován tehdy, když se rozhoduje |
| **ČSPM / PS RIPP** | Vydává metodiku: kdo zakládá, kdo reviduje a jak často, vzor zápisu o cílech péče | Nástroj je odborně ukotvený |
| **Provozovatel** (Nadace Most k domovu) | Vydává a spravuje telefony, eviduje oprávněné osoby, školí | Doložitelné, kdo měl k záznamu přístup |
| **FamiCura** | Provozuje centrální aplikaci jako zpracovatel | Využití stávající evidence poskytovatelů a lékařů |

## 4. Jak to funguje v praxi

**Zapůjčený telefon u pacienta.** Pacient dostane při založení průkazu jednoduchý telefon se SIM, který slouží jen tomuto účelu. Nic jiného na něm neběží a na obrazovce je pořád jen průkaz. Telefon leží na nočním stolku, v pokoji v domově, při převozu jede s pacientem. Zápůjčku zajišťuje provozovatel, po ukončení péče se telefon vymazaný vrací do oběhu. Pilot počítá s 20 telefony pro 15–20 pacientů.

- **Záchranář nebo kdokoli u pacienta** vezme telefon do ruky a vidí krizovou kartu bez přihlašování.
- **Sestra a rodina** zadají osobní PIN a vidí celý záznam, mohou připsat změnu stavu nebo podaný lék.
- **Lékař** se ověří přes centrální aplikaci (načte QR kód svým přihlášeným telefonem) a teprve pak může měnit cíl péče, limitace nebo pořídit výpis.
- **K telefonu patří vždy tištěná krizová karta** pro případ vybité baterie nebo ztráty.

**Proč zapůjčený telefon a ne telefon rodiny:** pacient v domově často telefon nemá nebo ho neumí obsluhovat; rodina nebývá přítomna, když přijede záchranka; údaje nejsou na soukromém telefonu s dalšími aplikacemi; všichni pracují s jednou verzí záznamu; jednotné zařízení jde snadno zaškolit a spravovat. Aplikace na telefonu rodiny je možná druhá etapa po vyhodnocení pilotu.

## 5. Úrovně přístupu

| Úroveň | Kdo | Rozsah |
|---|---|---|
| Bez přihlášení | ZZS, kdokoli u pacienta | Krizová karta ke čtení, zápis výjezdu |
| Pečující | rodina, sestry, hospic, PL | Celý záznam ke čtení, zápisy do deníku (jen doplňovat, ne mazat) |
| Lékař | ověřený lékař garanta nebo týmu | Cíl péče, limitace, revize plánu, pořízení výpisu |
| Garant | lékař poskytovatele, který vede plán | Navíc tým kolem pacienta, předání garance, ukončení |

Limitace a cíl péče může zapsat **jen lékař** (nelze „vyplní sestra, podepíše lékař“) a kontakty jsou rozděleny podle **rolí** (rozhoduje / informovat / pečuje), nikoli jako jedno pořadí volání.

## 6. Obrazovky průkazu

| Obrazovka | Kdo ji vidí | Co obsahuje | Co lze udělat |
|---|---|---|---|
| **A. Krizová karta** | kdokoli, bez přihlášení | Jméno, rok narození, KPR ano/ne, cíl péče jednou větou, čím doloženo, alergie, SOS léky, koho volat, kdo rozhoduje | Číst, zavolat, zapsat výjezd ZZS |
| **B. Plán péče** | pečující čtou, lékař zapisuje | Cíl péče, limitace, odkaz na lékařskou zprávu a dříve vyslovené přání, funkční stav, platnost, lékař | Lékař: upravit, potvrdit revizi |
| **C. Deník** | pečující, lékař | Chronologie zápisů: kdy, kdo, role, text | Rychlé zápisy; nelze mazat |
| **D. Zhoršení stavu** | sestra, rodina, hospic | Průvodce: co se děje, co jsem udělal, komu volám | Shrnutí pro ZZS, upozornění sestře garanta |
| **E. Kontakty** | všichni | Rozhoduje / informovat / pečuje | Volat; lékař mění role |
| **F. Dokumenty a správa** | lékař | Kopie DVP, lékařská zpráva, tisk karty | Výpis do dokumentace, ukončení |

![250](karta.png)

*Ukázka krizové karty z prototypu (smyšlená data). Funkční demo: clb-paliativprukaz.netlify.app*

## 7. Předávání pacienta mezi poskytovateli

**Garant průkazu** je vždy jeden poskytovatel s lékařem, který právě odpovídá za plán péče: nemocniční paliativní tým (dočasně, nejdéle 30 dní po propuštění), mobilní hospic, paliativní ambulance nebo praktický lékař. Domov pro seniory garantem není. **Tým kolem pacienta** je seznam poskytovatelů s přístupem, každý s rolí a dobou platnosti. Při přesunu pacienta se mění tým, telefon zůstává stejný.

**Předání garance:** dosavadní garant zvolí „Předat“, přijímající lékař převzetí potvrdí. Do potvrzení zůstává garance u odesílajícího; po 72 hodinách bez potvrzení přijde upozornění oběma stranám. Pokud PL garanci nepřevezme, nabídne se paliativní ambulance. Při odchodu ze zařízení se PINy jeho personálu automaticky zneplatní.

| Situace | Kdo zakládá | Garant poté | Tým u pacienta | Telefon |
|---|---|---|---|---|
| Nemocnice → hospic | paliativní tým nemocnice | hospic | hospic, PL, rodina | jde domů |
| Nemocnice → domov s pobytovou službou | paliativní tým nemocnice | PL klienta / paliativní ambulance | sestry domova, PL, rodina | v pokoji klienta |
| Domov → hospic | existuje | z PL na hospic | hospic přibude, domov odchází | jde s pacientem |
| PL → domov | PL | PL | sestry domova, rodina | vydá provozovatel |
| Domov → jiný domov | existuje | beze změny | starý domov odchází, nový přichází | jde s pacientem |
| Kdekoli → hospitalizace | – | beze změny | nemocnice jako host (čtení, výpis) | jede s pacientem |

## 8. Právní rámec (stručně)

Rámec je k potvrzení právníkem a ČSPM; nejde o právní stanovisko.

- **Průkaz není zdravotnickou dokumentací**, ale sdílený výtah z ní (§ 65 zák. 372/2011 Sb.). Každý poskytovatel zapisuje dál do své dokumentace; primárním dokladem cíle péče zůstává lékařská zpráva, na kterou průkaz odkazuje.
- **Limitace je pro ZZS závazná jen s platným dříve vysloveným přáním** (§ 36) nebo s doloženým rozhodnutím lékaře (doporučení ČLK 1/2010). Průkaz nese kopii listiny a údaj, kde je originál.
- **Zástupné rozhodování** se eviduje podle zákona, odděleně od kontaktů k informování.
- **GDPR:** správcem plánu péče je garant, poskytovatelé v týmu jsou správci svých zápisů, provozovatel centrální aplikace je zpracovatel (případně společní správci podle čl. 26). Nutné je DPIA, smlouvy o zpracování, informace pacientovi a nesmazatelný log přístupů. Dotazy na AI jsou anonymizované, takže údaje s identitou pacienta neopouštějí centrální aplikaci.
- **Není zdravotnickým prostředkem** (MDR), pokud záznam pouze eviduje a zobrazuje a nic nevyhodnocuje ani nedoporučuje. AI jen předvyplňuje, rozhoduje lékař.
- Archivace po ukončení podle vyhlášky 98/2012 Sb.; struktura odpovídá připravovanému urgentnímu souhrnu podle zákona o elektronizaci zdravotnictví.

## 9. Pilot, financování a co potřebujeme od MUDr. Kabelky

**Pilot:** Centrum LB, Mobilní hospic Most k domovu, 1–2 domovy ve Zlíně, ZZS Zlínského kraje; 15–20 pacientů, 3 měsíce, poté revize formuláře i metodiky. Měříme výjezdy ZZS a hospitalizace proti plánu péče a spokojenost sester a rodin.

**Financování zařízení:** žádost Nadace Most k domovu Zlín do programu ČSOB pomáhá regionům („Mobil u lůžka: jedna karta pro všechny, kdo pečují“). Rozpočet 100 700 Kč na 20 telefonů se SIM, pouzdra, tištěné karty, nastavení a školení. Vývoj, provoz a metodiku dodávají DDE Consulting, FamiCura a Centrum LB jako nefinanční vklad.

**Od MUDr. Kabelky potřebujeme:**

1. Stanovisko ČSPM k principu průkazu, který zakládá a reviduje výhradně lékař.
2. Potvrzení obsahu krizové karty (8–10 položek, pořadí).
3. Závazný slovník cíle péče a limitací (reakce na výhradu dr. Kopeckého k pojmu „cíl péče“).
4. Vzor zápisu o rozhovoru o cílech péče, na který průkaz odkazuje.
5. Pravidla revize: interval (návrh 3 měsíce), kdo reviduje u klientů domovů, které události revizi vynucují.
6. Potvrzení rolí a rozsahu zápisů sester a rodiny.
7. Autorství metodiky (PS RIPP / ČSPM) a posouzení právníkem ČSPM.
8. Doporučení pro pilot: nemocniční paliativní tým, ZZS ZK, domovy; souhlas se sdílením s dr. Kopeckým a dr. Slámovou.


# Část B – Architektura a provoz

## 10. Architektura

| Složka | Kdo ji používá | Co dělá |
|---|---|---|
| **Centrální aplikace** (FamiCura, hosting ČR/EU) | garant, tým, provozovatel | Primární záznam: pacienti, plán péče ve verzích, deník, tým, předávání garance, PINy, upozornění, log přístupů |
| **Webový portál průkazu** | PL, domov, nemocnice jako host | Zjednodušený přístup pro ty, kdo nepracují ve FamiCuře |
| **Telefon u pacienta** (Android) | kdokoli u lůžka | Šifrovaná offline kopie, krizová karta bez přihlášení, fronta zápisů bez signálu |
| **Anonymizační brána + AI** | centrální aplikace | Rozbor propouštěcí zprávy a dotazy jen nad anonymním textem |
| **MDM** (správa zařízení) | provozovatel | Kiosk režim, aktualizace, vzdálené zamčení a smazání; obsah průkazu nevidí |

## 11. Role a identifikace

| Role | Jak se identifikuje | Smí |
|---|---|---|
| Garant – nemocniční paliativní tým | účet v centrální aplikaci (2FA) | zavést pacienta, první plán, spárovat telefon, předat garanci |
| Garant – hospic / ambulance / PL | účet (2FA); na telefonu QR výzva → kód | plán péče, limitace, revize, předání, ukončení |
| Sestra hospice | účet; na telefonu QR | deník, zhoršení, kontakty |
| Praktický lékař (není garant) | jednorázový kód z centrální aplikace | medikace, čtení |
| Sestra domova | osobní 6místný PIN vázaný na tým | deník, SOS léky, zhoršení |
| Rodina | osobní PIN | čtení, pozorování |
| ZZS | bez přihlášení | krizová karta, zápis výjezdu („neověřeno“) |
| Správce zařízení | konzole MDM | zamknout, smazat, aktualizovat – obsah nevidí |

**Ověření lékaře na telefonu:** telefon ukáže QR s jednorázovou výzvou → lékař ji načte přihlášeným účtem → centrální aplikace vydá podepsaný kód (platnost 10 min) → průkaz odemčen na 30 min. Pro situace bez signálu mají lékaři garanta předem vydané jednorázové offline kódy ověřitelné podpisem. Automatické zamčení po 2 min nečinnosti, zákaz snímků obrazovky.

## 12. Synchronizace

| Co | Směr | Kdy |
|---|---|---|
| Zápisy (deník, zhoršení, výjezd ZZS) | telefon → centrální aplikace | ihned; bez signálu fronta, odeslání při nejbližším připojení |
| Zhoršení stavu | → sestra garanta na službě | ihned; SMS/push bez zdravotních údajů |
| Plán péče, medikace, kontakty, tým | centrální aplikace → telefon | ihned (tichý push), pojistně 1× za hodinu a vždy při obnovení spojení |
| Kontrolní signál (baterie, poslední sync) | telefon → přehled garanta | 1× za hodinu; upozornění při výpadku > 12 h nebo baterii < 20 % |
| Aktualizace aplikace | MDM → telefon | v noci při nabíjení |

**Konflikty:** deník se jen doplňuje, takže se slučuje bez konfliktu. Plán péče má jednu autoritativní verzi s číslem a podpisem lékaře; telefon ho nikdy nepřepíše. Telefon zobrazuje čas poslední synchronizace a při stáří > 24 h výrazné upozornění.

## 13. AI pouze anonymně

1. Text (propouštěcí zpráva, dotaz) projde **anonymizační bránou v centrální aplikaci**: odstraní se jméno, rodné číslo, datum narození, adresa, telefony, e-maily, číslo pojištěnce, jména příbuzných a lékařů; nahradí se značkami ([PACIENT], [DATUM_1]…). Věk se převede na rozmezí.
2. Na AI odchází jen anonymizovaný text, bez ID pacienta a bez vazby na zařízení.
3. Odpověď AI se v centrální aplikaci přiřadí zpět k pacientovi a značky se doplní.
4. Fotografie zprávy se převádí na text (OCR) v centrální aplikaci nebo v telefonu, ne u AI.
5. Poskytovatel AI smluvně bez uchovávání dat a bez tréninku na nich; každý dotaz se loguje (kdo, kdy, k čemu – bez obsahu).
6. AI nic nerozhoduje: předvyplní a upozorní na chybějící údaje, lékař potvrdí.

## 14. Telefon a bezpečnost

- **Zařízení:** Android Enterprise v režimu „dedicated device“ (kiosk): běží jen aplikace průkazu, šifrování zařízení, zablokované USB ladění, vzdálené smazání.
- **Připojení:** jen mobilní data přes SIM, Wi-Fi a Bluetooth vypnuto, komunikace povolena pouze s centrální aplikací a MDM. Volání jen na čísla z průkazu a 155.
- **Data v telefonu:** šifrovaná databáze (SQLCipher), klíč v Android Keystore; bez přihlášení je dostupný jen výřez krizové karty.
- **Přenos:** TLS 1.3, pinning certifikátu, vlastní klientský certifikát každého zařízení (mTLS) – ukradený telefon se odpojí jedním kliknutím.
- **Server:** oddělená databáze průkazů, šifrování v klidu, hosting v ČR/EU, denní zálohy, neměnný log přístupů.
- **Ztráta telefonu:** vzdálené smazání a zneplatnění certifikátu; data jsou v centrální aplikaci, náhradní telefon se spáruje do 5 minut.
- **Notifikace a SMS** nikdy neobsahují jméno ani diagnózu.

## 15. Životní cyklus průkazu

1. Provozovatel připraví telefon v MDM (kiosk, čeká na spárování).
2. Garant zavede pacienta v centrální aplikaci (ručně nebo z anonymně rozebrané propouštěcí zprávy), spáruje telefon QR kódem, vytiskne záložní kartu, vydá PINy rodině a zařízení.
3. Při přesunu pacienta garant předá garanci nebo upraví tým; telefon jde s pacientem.
4. Při ukončení garant pořídí výpis a uzavře průkaz; MDM telefon vymaže a vrátí do oběhu; záznam se archivuje v centrální aplikaci.


# Část C – Zadání pro vývoj

## 16. Cíl a rozsah MVP

Dodat do pilotního provozu (20 telefonů, 15–20 pacientů, 3 měsíce) systém, který splní zásady z části A: centrální aplikace jako primární záznam, šifrovaná komunikace, telefon funkční offline se synchronizací při připojení a AI jen nad anonymním textem. Funkčním vzorem obrazovek a chování je prototyp na clb-paliativprukaz.netlify.app (verze v8, data jen v telefonu).

| V MVP | Mimo MVP (další etapy) |
|---|---|
| Centrální aplikace jako modul FamiCury (multi-tenant „Paliativní průkaz ZK“) | Aplikace na soukromém telefonu rodiny |
| Webový portál pro PL, domovy a nemocnice | iOS |
| Android aplikace v kiosk režimu (obrazovky A–F) | Napojení na NIS nemocnic a na urgentní souhrn (EZ) |
| Předávání garance a tým kolem pacienta | Elektronický podpis dokumentů (kvalifikovaný) |
| Anonymizační brána a AI rozbor propouštěcí zprávy | Statistiky pro plátce a kraj nad rámec pilotu |
| Integrace MDM, notifikace bez zdravotních údajů, výpis PDF | Vícejazyčnost |

## 17. Komponenty a doporučené technologie

| Komponenta | Doporučení | Poznámka |
|---|---|---|
| Backend centrální aplikace | Rozšíření FamiCury: PostgreSQL, REST API popsané v OpenAPI 3 | Oddělené schéma `prukaz`, vlastní tenant |
| Web garanta a portál | Stávající webový frontend FamiCury; portál jako samostatná zjednodušená aplikace | Responzivní, přihlášení 2FA |
| Mobilní aplikace | Nativní Android (Kotlin, Jetpack Compose), Room + SQLCipher, WorkManager pro synchronizaci, FCM jen jako signál „je nová verze“ | Min. Android 12; cílové telefony Samsung A06 / Moto G15 |
| Správa zařízení | Android Management API (Google) nebo komerční MDM s podporou dedicated device | Výběr podle ceny za 20 zařízení |
| Anonymizace | Služba v centrální aplikaci: známé identifikátory pacienta + regulární výrazy + NER model běžící lokálně | Bez volání externích služeb |
| OCR | Na serveru (Tesseract nebo ekvivalent s českým jazykem) nebo ML Kit v telefonu | Obrázek nikdy neopouští centrální aplikaci |
| AI | LLM přes API s nulovou retencí (zero data retention) | Jen anonymní text |
| Notifikace | SMS přes Twilio, push přes FCM | Bez jména a diagnózy |
| Hosting | ČR/EU, šifrování disků, denní zálohy, oddělené prostředí test/produkce | |

## 18. Datový model (hlavní entity)

| Entita | Klíčové atributy | Pravidla |
|---|---|---|
| `poskytovatel` | IČO, IČP, název, typ (nemocnice / hospic / ambulance / PL / domov), smí být garantem | Domov nesmí být garantem |
| `uzivatel` | jméno, poskytovatel, role, je lékař, číslo ČLK, 2FA | Lékařské akce jen s příznakem lékaře |
| `pacient` | ID průkazu (P-xxx), jméno, RČ, datum narození, pojišťovna | Identita jen v centrální aplikaci |
| `prukaz` | pacient, stav (aktivní / uzavřený / archiv), založen, uzavřen | Jeden aktivní průkaz na pacienta |
| `garance` | průkaz, poskytovatel, lékař, od, do, stav předání (navrženo / potvrzeno / odmítnuto) | Vždy právě jedna platná garance |
| `clen_tymu` | průkaz, poskytovatel, role, platnost od–do | Přístupy se odvozují odtud |
| `plan_verze` | průkaz, číslo verze, cíl péče, limitace, funkční stav, platnost do, doklad (DVP / zpráva), podepsal lékař, čas | Neměnné; nová úprava = nová verze |
| `kontakt` | průkaz, jméno, telefon, skupina (rozhoduje / informovat / pečuje), vztah, pořadí | |
| `lek_sos` | průkaz, lék, dávka, indikace, max. denně | Součást verze plánu |
| `denik_zapis` | UUID z telefonu, průkaz, typ, text, autor, role, vytvořeno (čas telefonu), přijato (čas serveru), zařízení | Jen přidávat; oprava = nový zápis s odkazem |
| `dokument` | průkaz, typ (DVP, propouštěcí zpráva), soubor (šifrovaně), kde je originál | |
| `zarizeni` | IMEI / ID MDM, otisk certifikátu, stav, průkaz, poslední sync, baterie | Zneplatnění certifikátu = okamžité odpojení |
| `pin` | osoba, průkaz, tým, hash (Argon2), platnost, pokusy | Zneplatnění při odchodu člena týmu |
| `offline_kod` | lékař, průkaz, kód (podepsaný), platnost, použit | Jednorázový |
| `audit_log` | kdo, kdy, zařízení / web, akce, objekt | Neměnný (append-only) |
| `ai_dotaz_log` | kdo, kdy, účel, délka textu, výsledek kontroly anonymizace | Bez obsahu |

## 19. Funkční požadavky

**Centrální aplikace (web garanta a týmu)**

| ID | Požadavek |
|---|---|
| F-01 | Seznam pacientů garanta a týmu s barevným stavem: revize plánu, zhoršení, telefon bez spojení > 12 h, baterie < 20 % |
| F-02 | Založení pacienta: ručně nebo průvodcem z propouštěcí zprávy (foto / PDF → OCR → anonymizace → AI rozbor → předvyplněný formulář → lékař potvrdí) |
| F-03 | Plán péče ve verzích; každá změna vyžaduje lékaře a vytváří novou verzi; zobrazení rozdílů mezi verzemi |
| F-04 | Spárování telefonu: garant vygeneruje jednorázový QR kód (platnost 15 min), telefon ho načte a stáhne první verzi |
| F-05 | Tým kolem pacienta: přidání a odebrání poskytovatele, role, platnost; vydání a zneplatnění PINů |
| F-06 | Předání garance: návrh → potvrzení přijímajícím lékařem; upozornění po 72 h; omezení nemocnice na 30 dní |
| F-07 | Revize: upozornění 14 dní před koncem platnosti plánu; potvrzení revize lékařem |
| F-08 | Tisk záložní krizové karty (PDF A6/A5) z aktuální verze |
| F-09 | Výpis do dokumentace (PDF): plán, historie verzí, deník, přístupy |
| F-10 | Ukončení průkazu: výpis, uzavření, pokyn MDM k vymazání telefonu, archivace |
| F-11 | Přehled zařízení pro provozovatele: stav, poslední sync, baterie, akce zamknout / smazat / vyměnit |
| F-12 | Webový portál pro PL a domovy: čtení, deník, medikace (PL), bez přístupu ke správě |

**Telefon u pacienta**

| ID | Požadavek |
|---|---|
| M-01 | Po zapnutí a odemčení obrazovky se ihned zobrazí krizová karta, bez přihlášení a bez sítě (< 2 s) |
| M-02 | Obrazovky A–F podle části A; dlaždice místo spodní lišty; velké písmo, vysoký kontrast |
| M-03 | Odemčení PINem (sestra, rodina) nebo ověřením lékaře (QR výzva / offline kód); zamčení po 2 min |
| M-04 | Zápisy do deníku, SOS léků a zhoršení fungují offline; ukládají se do fronty s UUID a časem telefonu |
| M-05 | Synchronizace: při obnovení spojení, po tichém push a pojistně 1× za hodinu; indikátor „Aktualizováno před …“ a výrazné varování při stáří > 24 h |
| M-06 | Zápis výjezdu ZZS bez přihlášení, označený „neověřeno“ |
| M-07 | Volání jen na čísla z průkazu a 155 jedním dotykem |
| M-08 | Kontrolní signál 1× za hodinu (baterie, verze plánu, stav fronty) |
| M-09 | Zákaz snímků obrazovky, žádná zdravotní data v notifikacích |
| M-10 | Po vzdáleném smazání nebo zneplatnění certifikátu se lokální databáze nevratně odstraní |

## 20. Synchronizační protokol

Telefon komunikuje s jedním endpointem přes mTLS. Každá výměna je idempotentní:

| Volání | Telefon posílá | Server vrací |
|---|---|---|
| `POST /device/pair` | párovací kód z QR, veřejný klíč zařízení | podepsaný klientský certifikát, ID průkazu, první balík dat |
| `POST /device/sync` | číslo verze plánu, kurzor deníku, frontu zápisů (UUID, typ, text, čas, autor) | potvrzená UUID, novou verzi plánu (je-li), nové zápisy od kurzoru, tým, kontakty, PINy (hashe), čas serveru |
| `POST /device/heartbeat` | baterie, verze aplikace, délka fronty, čas posledního sync | pokyny (sync ihned, zamknout, smazat) |
| `POST /device/doctor-challenge` | výzva z QR, odpověď lékaře | podepsaný odemykací token (30 min) |

**Pravidla:** zápis se z fronty smaže až po potvrzení jeho UUID; opakované odeslání téhož UUID se ignoruje. Plán péče posílá jen server, telefon ho nikdy nemění. Čas zápisu se ukládá dvakrát (telefon, server), v deníku se zobrazuje čas telefonu s označením zpožděného přenosu. Velikost balíku do 200 kB, aby sync prošel i slabým signálem; dokumenty se stahují zvlášť a jen na vyžádání.

## 21. Anonymizační brána – požadavky

| ID | Požadavek |
|---|---|
| A-01 | Vstup: text (z OCR nebo vložený) a ID průkazu; výstup: anonymní text + mapa značek (mapa zůstává jen v centrální aplikaci) |
| A-02 | Krok 1: nahrazení známých identifikátorů pacienta z databáze (jméno ve všech pádech, RČ, datum narození, adresa, telefony, jména kontaktů a lékařů) |
| A-03 | Krok 2: regulární výrazy (RČ, data, telefony, e-maily, PSČ, čísla pojištěnce, IČP) |
| A-04 | Krok 3: lokální NER model pro zbývající jména osob a míst |
| A-05 | Kontrola před odesláním: pokud výstup obsahuje cokoli z kroku 2, dotaz se zablokuje a zaloguje |
| A-06 | Věk převést na pětileté rozmezí, data na relativní („před 3 dny“) tam, kde nejsou nutná |
| A-07 | Testovací sada min. 50 reálných propouštěcích zpráv (v testovacím prostředí): akceptace = 0 úniků identifikátorů z kroků 1–2 |
| A-08 | Smlouva s poskytovatelem AI: nulová retence, žádný trénink, zpracování v EU, je-li dostupné |

## 22. Nefunkční požadavky

- **Dostupnost** centrální aplikace 99,5 % v pracovní době, výpadek serveru nesmí omezit čtení průkazu v telefonu.
- **Výkon:** krizová karta < 2 s od probuzení telefonu; sync běžného balíku < 5 s na 3G.
- **Baterie:** při hodinovém kontrolním signálu výdrž telefonu min. 3 dny.
- **Bezpečnost:** penetrační test před pilotem; OWASP MASVS L2 pro mobil, OWASP ASVS L2 pro web; tajné klíče jen v Keystore a trezoru serveru.
- **Audit:** každé čtení plné části průkazu a každá změna v neměnném logu; uchování po dobu archivace dokumentace.
- **Přístupnost a jazyk:** čeština, velké písmo, ovládání jednou rukou, vysoký kontrast pro noční provoz.
- **Provoz:** monitorování serveru, upozornění na neúspěšné sync a zablokované AI dotazy, denní zálohy s testem obnovy 1× měsíčně.

## 23. Akceptační scénáře

| # | Scénář | Očekávaný výsledek |
|---|---|---|
| 1 | Telefon v režimu letadlo, sestra zapíše 3 zápisy, pak se připojí | Všechny 3 zápisy jsou do 1 min v centrální aplikaci, žádný dvakrát |
| 2 | Lékař změní plán na webu, telefon je online | Nová verze je v telefonu do 1 min |
| 3 | Totéž, telefon je 2 dny offline | Telefon ukazuje starou verzi s varováním; po připojení se nová verze stáhne |
| 4 | ZZS vezme zamčený telefon | Vidí krizovou kartu, volá jedním dotykem, zapíše výjezd „neověřeno“ |
| 5 | Předání garance nemocnice → hospic | Do potvrzení garant nemocnice; po potvrzení hospic, nemocnice má jen čtení a po 30 dnech nic |
| 6 | Pacient přejde z domova A do domova B | PINy domova A přestanou fungovat při nejbližší synchronizaci |
| 7 | Ztráta telefonu | Po „Smazat“ v přehledu je certifikát neplatný, data v telefonu smazána, náhradní telefon spárován do 5 min |
| 8 | AI rozbor zprávy s RČ a jménem | Odeslaný text (log v testovacím prostředí) neobsahuje jméno, RČ ani datum narození |
| 9 | Sestra zadá 5× špatný PIN | Telefon zablokuje PIN na 15 min, zapíše událost |

## 24. Etapy a dodávky

| Etapa | Obsah | Odhad |
|---|---|---|
| 0. Odborné vstupy | Slovník cíle péče a limitací, obsah karty, pravidla revize (od MUDr. Kabelky / ČSPM) | souběžně |
| 1. Centrální aplikace | Datový model, web garanta, tým, předávání, tisk karty, výpis | 4 týdny |
| 2. Telefon a synchronizace | Android aplikace A–F, offline fronta, sync, párování, MDM | 4 týdny |
| 3. AI a anonymizace | OCR, brána, testovací sada, průvodce založením | 2 týdny |
| 4. Bezpečnost a právní | Penetrační test, DPIA, smlouvy, informace pacientovi | 2 týdny, souběžně s 3 |
| 5. Pilot | Školení, 20 telefonů, provoz 3 měsíce, vyhodnocení | 3 měsíce |

**Dodávky:** zdrojové kódy v repozitáři, OpenAPI specifikace, instalační balík (APK) a konfigurace MDM, provozní příručka, uživatelské návody pro garanta, sestru a rodinu, výsledky testů.

**Předpoklady zadání:** centrální aplikace se staví jako modul FamiCury na její stávající databázi PostgreSQL; mobilní aplikace je nativní Android (kvůli kiosk režimu, šifrování a spolehlivé synchronizaci na pozadí); odhady jsou orientační pro jednoho až dva vývojáře a upřesní se po etapě 0.
