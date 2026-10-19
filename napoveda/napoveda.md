# Nápověda – Karta pacienta

Karta pacienta (paliativní průkaz) je krizový plán péče, který má pacient vždy u sebe v telefonu. Garant (hospic, paliativní ambulance, praktický lékař nebo dočasně nemocnice) plán vede v centrální aplikaci, telefon u lůžka ho ukazuje i bez signálu a posádka záchranky vidí krizovou kartu bez přihlášení. Obrázky v návodu jsou ukázkové, se smyšlenými jmény.

## 1. Co je Karta pacienta

Aplikace má tři části, všechny na jedné adrese:

| Část | Adresa | Pro koho |
|---|---|---|
| Centrální aplikace | `/centrala/` | garant a tým kolem pacienta – lékaři, sestry, správce organizace |
| Karta na telefonu | `/karta/` | telefon u lůžka pacienta – pečující (rodina, sestry), lékař na místě, posádka ZZS |
| Správa tenantů | `/tenanti/` | provozovatel platformy – zakládá organizace |

Jak to funguje v kostce:

1. Lékař v centrální aplikaci založí pacienta – údaje načte ze souboru z portálu PéčeDoma, z propouštěcí zprávy (anonymní rozbor) nebo je vyplní ručně – a stanoví **cíl péče a limitace**.
2. U pacienta je uvedené **číslo telefonu s kartou**. Kartu jde nahrát jen do telefonu s tímto číslem: odkazem z SMS nebo naskenováním QR kódu.
3. Každé pracoviště – garant i partneři (domov, praktický lékař…) – si své **lidi a týmy** zapíše jednou (ručně, ze souboru CSV nebo z PéčeDoma). K pacientovi se pak lidé jen **přiřadí** – celý tým jedním zaškrtnutím.
4. Telefon ukazuje **krizovou kartu** (bez přihlášení – stačí záchranné službě). Přiřazení lidé se odemknou svým **osobním PINem**, rodina PINem od garanta, lékař na místě **kódem lékaře**. Co kdo vidí a zapíše, určuje jeho **role** (lékař, praktický lékař, hospic, sestra DPS, rodina, ZZS). Vše funguje i bez signálu a sesynchronizuje se při nejbližším připojení.
5. Plán péče mění jen lékař v centrální aplikaci. Každá změna je nová verze s podpisem, telefon plán nikdy nepřepíše.

> Karta je vždy jen v jednom telefonu. Nový telefon zablokuje předchozí a zablokovaný telefon se při připojení sám vymaže.

## 2. Přihlášení a můj účet

Centrální aplikaci otevřete odkazem, který dostanete od správce organizace (`…/centrala/?t=KÓD_ORGANIZACE`) – kód organizace se pak vyplní sám. Zadáte **přihlašovací jméno** a **heslo**.

![Přihlášení do centrální aplikace](/napoveda/img/c-prihlaseni.png)

- Po prvním přihlášení heslem od správce aplikace vyžádá **vlastní heslo** (aspoň 10 znaků).
- Heslo kdykoli změníte v menu **Můj účet**. Tam vidíte i své pracoviště a role.
- Přihlášení platí 12 hodin, pak se přihlaste znovu. Tlačítko **Odhlásit** je vpravo nahoře.
- Zapomenuté heslo: správce organizace vám v **Správa organizace → Uživatelé** vydá nové první heslo.

V hlavičce jsou vždy tlačítka **📖** (tato nápověda) a **🎨** (barevné schéma) a vlevo dole modré **?** pro dotaz do chatu nápovědy.

Role uživatelů:

| Role | Co smí |
|---|---|
| lékař | zakládá pacienty, mění plán péče (je-li jeho pracoviště garant nebo lékař v týmu), vydává kód lékaře |
| sestra | zapisuje do deníku, upravuje kontakty |
| jen čtení | jen se dívá |
| správce | spravuje pracoviště, uživatele a nastavení organizace; vidí všechny pacienty |

## 3. Přehled pacientů

Menu **Pacienti** ukazuje pacienty, u kterých je vaše pracoviště v týmu (správce vidí všechny).

![Přehled pacientů s upozorněními](/napoveda/img/c-pacienti.png)

- Nahoře je panel **Upozornění**: plán po platnosti nebo blížící se revize, probíhající zhoršení stavu, telefon se dlouho nepřipojil nebo má slabou baterii, průkaz ještě není v žádném telefonu, čekající předání garance, nemocnice garantem déle než 30 dní, pacient bez garanta. Klik na upozornění otevře pacienta.
- V seznamu je u každého pacienta kód průkazu (`P-0001`), garant, platnost plánu a stav telefonu (zelená tečka = připojil se v posledních 12 hodinách).
- Přepínačem nahoře zobrazíte **uzavřené průkazy**.
- Klik na pacienta otevře jeho detail se záložkami (kapitoly 5–9).

## 4. Nový pacient

Menu **+ Nový pacient** (jen lékař). Průvodce má dva kroky.

### Krok 1 – odkud vzít údaje

![Nový pacient – načtení z PéčeDoma nebo z propouštěcí zprávy](/napoveda/img/c-novy-1.png)

Tři možnosti:

1. **Načíst klienta z PéčeDoma** (nejrychlejší): v portálu PéčeDoma v Datech klienta uložte **Export pro Kartu pacienta** (soubor JSON) a tady ho načtěte tlačítkem **Načíst soubor JSON**. Vyplní se údaje pacienta, diagnózy, léky, funkční stav a kontakty; číslo telefonu s kartou se předvyplní telefonem klienta.
2. **Propouštěcí zpráva**: vložte text, nahrajte textový soubor nebo vyfoťte zprávu (fotka se převede na text přímo v prohlížeči) a klikněte na **Anonymní rozbor zprávy**. Text projde anonymizační bránou – jména, rodná čísla, data, adresy a telefony se nahradí značkami – a teprve pak ho rozebere AI. Když by v textu zůstal identifikátor, dotaz se neodešle.
3. **Vyplnit ručně bez zprávy**.

### Krok 2 – kontrola a doplnění

![Nový pacient – kontrola údajů po načtení z PéčeDoma](/napoveda/img/c-novy-2.png)

- **Identifikace pacienta**: jméno, rodné číslo, datum a rok narození, pojišťovna, kde pobývá, adresa.
- **Telefon s kartou \*** (povinné): číslo telefonu u pacienta, na kterém bude karta. Na žádném jiném telefonu ji nahrát nepůjde.
- **Cíl péče a limitace**: potvrzuje lékař. Cíl péče je symptomatická, omezená, nebo plná léčba; limitace (KPR, ventilace, hospitalizace…) jsou to, co se neprovádí. Vyplňte doklad – dříve vyslovené přání (DVP) a kde je jeho originál, nebo lékařskou zprávu / zápis o rozhovoru.
- **Kontakty** a **Garant a tým**: kdo rozhoduje, koho informovat, kdo pečuje; které pracoviště je garantem a která jsou v týmu.
- Vpravo je panel, co ze souboru bylo převzato a co je potřeba zkontrolovat.

Tlačítkem **Založit průkaz** vznikne pacient s kódem `P-xxxx` a první verze plánu. Pak telefon spárujte (kapitola 8).

## 5. Krizová karta a plán péče

### Krizová karta

![Detail pacienta – krizová karta](/napoveda/img/c-karta.png)

Záložka **Krizová karta** ukazuje přesně to, co vidí posádka ZZS na telefonu bez přihlášení: cíl péče, limitace s dokladem, SOS léky, alergie, telefon na garanta a lékaře, kontakty. Limitace je pro posádku závazná jen s doloženým dříve vysloveným přáním nebo rozhodnutím lékaře – karta proto vždy uvádí doklad.

Tlačítka: **Potvrdit revizi plánu** (lékař), **Výpis do dokumentace** (text celého průkazu pro zdravotnickou dokumentaci, ke zkopírování nebo stažení), **Tisk karty**. Panel **Telefon u pacienta** ukáže, jestli má telefon aktuální verzi plánu.

### Plán péče

![Plán péče s verzemi](/napoveda/img/c-plan.png)

- Plán upravuje jen **lékař** pracoviště, které je garant nebo lékař v týmu. Ostatní ho vidí jen ke čtení.
- **Uložit jako novou verzi** – každá změna je nová verze s podpisem lékaře, starší verze zůstávají (seznam **Verze plánu** vpravo, klik zobrazí starou verzi).
- **Platnost plánu do** – po datu platnosti se v přehledu i u pacienta objeví upozornění a lékař udělá **revizi**: potvrdí, že plán platí beze změny, a nastaví novou platnost. Výchozí interval revize nastavuje správce (kapitola 12).
- Sestra ani rodina cíl péče a limitace vyplnit nemohou.

## 6. Deník a kontakty

### Deník

![Deník pacienta](/napoveda/img/c-denik.png)

- Do deníku zapisuje tým kolem pacienta (role péče, lékař, garant). Vyberete **typ** (změna stavu, podán SOS lék, návštěva lékaře, návštěva hospice, telefonát, pozorování rodiny, zhoršení stavu, stav stabilizován) a napíšete text.
- Zápisy **nelze mazat ani měnit**, jen doplňovat.
- Zápisy z telefonu mají čas, kdy byly pořízeny, i když se odeslaly později. Zápis posádky ZZS je označený jako neověřený.

### Kontakty

![Kontakty pacienta](/napoveda/img/c-kontakty.png)

Tři skupiny: **Rozhoduje** (zástupce, opatrovník, určená osoba – tuto skupinu přiděluje jen lékař na základě dokladu), **Informovat** a **Pečuje** (hospic, lékaři, nemocnice). Kontakt má jméno a vztah, telefon, poznámku (např. „volat jako první“) a pořadí. Kontakty upravuje tým kolem pacienta.

## 7. Tým a garance

![Tým kolem pacienta a předání garance](/napoveda/img/c-tym.png)

**Garant** je jedno pracoviště, které za průkaz odpovídá a jako jediné spravuje tým. Garantem smí být nemocnice (dočasně, nejvýš 30 dní), hospic, paliativní ambulance nebo praktický lékař – domov pro seniory ne.

**Tým kolem pacienta** – pracoviště, která pacienta vidí, a jejich role:

| Role | Co smí |
|---|---|
| garant | všechno včetně správy týmu a předání garance |
| lékař | lékaři pracoviště mění plán péče; deník, kontakty |
| péče | deník a kontakty |
| host | jen čtení (např. nemocnice při hospitalizaci) |

- **Přidat pracoviště do týmu**: vyberete pracoviště a roli. Nabízejí se jen pracoviště založená ve **Správa organizace → Pracoviště** – když tam žádné další není, aplikace nabídne tlačítko **Založit pracoviště**.
- **Odebrat**: pracoviště ztratí přístup a PINy jeho lidí přestanou platit při nejbližší synchronizaci telefonu.
- Při přesunu pacienta se mění jen tým, telefon s kartou zůstává stejný.

**Předání garance**:

1. Garant vybere **Nový garant**, napíše poznámku a klikne na **Navrhnout předání**.
2. Lékař přebírajícího pracoviště uvidí pacienta s upozorněním a klikne na **Převzít garanci**, nebo **Odmítnout** s důvodem.
3. Do potvrzení zůstává garance u původního pracoviště; po 72 hodinách bez potvrzení přijde upozornění.
4. Po převzetí se z původního garanta stane člen týmu s rolí péče.

**Historie garance** ukazuje všechny garanty se stavem navrženo / platná / ukončená / odmítnuto. Historie nejde mazat.

## 8. Telefon a PINy

![Telefon u pacienta a PINy pro pečující](/napoveda/img/c-telefon.png)

### Spárování telefonu

Karta je jen v jednom telefonu – s číslem uvedeným u pacienta (pole **Telefon s kartou** v Údajích). Párovat smí garant nebo lékař v týmu.

1. Klikněte na **Poslat odkaz SMS na +420…** – pacientovi přijde SMS s odkazem, nebo na **Spárovat telefon** – otevře se okno s QR kódem a kódy.
2. Na telefonu otevřete odkaz z SMS, nebo v aplikaci karty klepněte na **Načíst QR kód fotoaparátem** a namiřte na obrazovku (kapitola 13).
3. Telefon zadá **své číslo**. Server kartu nahraje jen tehdy, když se číslo shoduje s číslem u pacienta; jiné číslo odmítne.

![Okno Spárovat telefon – QR kód, kódy a SMS](/napoveda/img/c-parovani.png)

- Párovací kód platí **15 minut a jen jednou**. Pro nový pokus klikněte znovu na Spárovat telefon.
- Po spárování se případný předchozí telefon pacienta zablokuje.
- Když SMS nejde odeslat, okno napíše proč a spárujete QR kódem.
- **Zablokovat** – ztracený telefon; při nejbližším připojení se data z něj vymažou. **Vráceno** – zablokovaný telefon, který se vrátil.
- Změna čísla v Údajích zablokuje telefon na předchozím čísle.

### Kód lékaře

Tlačítko **Kód lékaře pro odemčení** (jen lékař, když je telefon spárovaný) vydá šestimístný kód. Lékař na místě ho zadá v telefonu (**Jsem lékař**) a odemkne kartu. Kód platí 5 minut, telefon ho ověří i bez signálu a vydání se zapíše do logu.

### Lidé, kteří odemknou kartu

Lékaři, sestry, pečovatelé hospice i domova se **nezapisují ke každému pacientovi znovu**. Jsou jednou zapsaní v agendě **Lidé a týmy** (kapitola 11) a mají osobní PIN. U pacienta je jen přiřadíte:

1. Klikněte na **+ Přiřadit lidi z týmů**.
2. Nabídnou se lidé pracovišť, která jsou v týmu kolem pacienta (záložka Tým a garance), rozdělení podle týmů. Zaškrtněte **celý tým** nebo jednotlivé lidi.
3. **Přiřadit vybrané** – při nejbližší synchronizaci telefonu odemknou kartu svým osobním PINem. Co uvidí a zapíší, určuje jejich role (kapitola 10).

![Přiřazení lidí z týmů pracovišť k pacientovi](/napoveda/img/c-prirazeni.png)

- Garant a lékař v týmu přiřazují lidi všech pracovišť v týmu. Partner (např. domov s rolí péče) přiřazuje své vlastní lidi.
- **Odebrat** – člověk kartu tohoto pacienta už neodemkne. Když pracoviště odejde z týmu, jeho lidé se odeberou sami.

### Rodina a jednorázové PINy

Rodině vydejte PIN přímo u pacienta: **jméno držitele**, role **rodina** a **Vydat PIN**. Šestimístný PIN se zobrazí **jen jednou** – předejte ho. Stejně jde vydat jednorázový PIN i komukoli, kdo není v Lidech a týmech. **Zrušit** PIN zneplatní hned.

**Záchranná služba** žádný PIN ani seznam lidí nepotřebuje – krizovou kartu vidí bez přihlášení a jméno a posádku zapíše až u zápisu výjezdu.

## 9. Údaje, dokumenty a uzavření průkazu

![Údaje pacienta](/napoveda/img/c-udaje.png)

- **Údaje**: identifikace pacienta a **Telefon s kartou**. Upravuje garant nebo lékař (**Uložit údaje**). Identifikační údaje (jméno, RČ, adresa) zůstávají jen v centrální aplikaci; telefon dostane jméno a rok narození, AI nedostane nic z toho.
- **Informace pacientovi** – lékař tlačítkem **Potvrdit podpis** zaznamená, že pacient / zástupce dostal informace a podepsal je.
- **Dokumenty**: dříve vyslovené přání, lékařské zprávy, informace pacientovi a jiné (PDF nebo foto do 8 MB) a poznámka, kde je originál. Vkládá garant nebo lékař, klik na dokument ho otevře.
- **Přístupy** (garant a správce): kdo a kdy průkaz zobrazil nebo měnil.
- **Uzavřít průkaz** (garant): vyberete důvod (úmrtí, předání mimo síť, hospitalizace, na přání pacienta, jiný). Telefon se při příštím připojení vymaže a PINy přestanou platit. Předtím si pořiďte **výpis do dokumentace**.

## 10. Role na kartě – kdo co vidí a zapisuje

Role jsou stejné jako v ukázkové verzi. Každý po odemknutí karty vidí nahoře, kdo je přihlášený a co jeho role smí, a nabídnou se mu jen jeho typy zápisů.

| Role | Jak se dostane ke kartě | Co vidí | Co zapisuje do deníku |
|---|---|---|---|
| Lékař | osobní PIN (Lidé a týmy) nebo kód lékaře | celý záznam | návštěva lékaře, změna stavu, podán SOS lék, návštěva hospice, telefonát, zhoršení |
| Praktický lékař | osobní PIN nebo kód lékaře | celý záznam | návštěva lékaře, změna stavu, podán SOS lék, telefonát, zhoršení |
| Hospic | osobní PIN | celý záznam, je prvním kontaktem při zhoršení | návštěva hospice, změna stavu, podán SOS lék, návštěva lékaře, telefonát, zhoršení |
| Sestra DPS | osobní PIN | celý záznam | změna stavu, podán SOS lék, návštěva lékaře, telefonát, pozorování, zhoršení |
| Rodina | PIN od garanta u pacienta | celý záznam | pozorování, podán SOS lék, změna stavu, telefonát, zhoršení |
| ZZS | bez PINu | jen krizovou kartu | jen výjezd – jméno a posádku zapíše až u výjezdu |

![Telefon – po odemknutí je vidět jméno, role a co role smí](/napoveda/img/k-odemceno.png)

- **Plán péče** (cíl péče, limitace, léky) mění jen lékař v centrální aplikaci. Telefon ho všem rolím jen zobrazuje.
- Typy zápisů hlídá i server: zápis, který role nesmí, se do deníku nepřijme.
- Role člověka nastavíte v agendě Lidé a týmy (kapitola 11), roli rodinného PINu při jeho vydání (kapitola 8).

## 11. Lidé a týmy

Menu **Lidé a týmy** (všichni kromě role jen čtení). Každé pracoviště – garant i partneři, např. domov pro seniory nebo praktický lékař – si tu své lidi zapíše **jednou** a rozdělí je do týmů. Správce organizace spravuje lidi všech pracovišť, ostatní lidi svého pracoviště.

![Lidé a týmy – lidé pracovišť po týmech](/napoveda/img/c-lide.png)

### Přidání člověka

**+ Člověk**: pracoviště, tým (volitelně, např. „Tým Zlín“ nebo „Oddělení A“), jméno, **role na kartě** (lékař, praktický lékař, hospic, sestra DPS), telefon, e-mail. Po uložení se zobrazí **osobní PIN** – jen jednou. Když je zaškrtnuté **poslat osobní PIN SMS**, přijde mu PIN na telefon.

![Úprava člověka – role na kartě a nový PIN](/napoveda/img/c-osoba.png)

- Klik na řádek člověka ho upraví. **Nový PIN** – dosavadní PIN přestane platit na všech telefonech.
- Zrušené zaškrtnutí **aktivní** člověka vyřadí: kartu už neodemkne u žádného pacienta (vyřazené ukáže zaškrtnutí **i vyřazení**).
- Sloupec **Pacientů** ukazuje, u kolika aktivních pacientů je člověk přiřazený.

### Načtení z PéčeDoma

**Načíst z PéčeDoma** nabídne uživatele portálu PéčeDoma vaší organizace (stejná databáze). Role se navrhne podle role v PéčeDoma a typu pracoviště (lékař → lékař, u praktika praktický lékař; sestra → hospic, v domově sestra DPS). Správci a monitor bez další role a lidé, kteří už načtení jsou, nejsou předvybraní. Před načtením jde u každého upravit roli a tým.

![Načtení týmu z PéčeDoma](/napoveda/img/c-lide-import.png)

### Načtení ze souboru CSV

**Načíst CSV** – soubor z Excelu (uložit jako CSV, oddělovač středník nebo čárka, kódování UTF-8 i Windows-1250). Sloupce: **jméno; role; telefon; e-mail; tým** – první řádek může být záhlaví. Role stačí napsat slovy (lékař, praktický lékař, sestra, pečovatelka, hospic, sestra DPS). Tlačítko **Vzor CSV** stáhne ukázkový soubor.

Kdo už v pracovišti je (stejné jméno), se jen aktualizuje a PIN mu zůstane. Novým lidem se vydá osobní PIN.

### Osobní PINy

Po načtení se zobrazí seznam nových lidí s PINy. **Vytisknout kartičky** připraví kartičky k rozstříhání (jméno, role, PIN); nebo je pošlete SMS. PINy se zobrazují jen jednou.

![Vydané osobní PINy – tisk kartiček](/napoveda/img/c-piny.png)

K pacientovi lidi přiřadíte v detailu pacienta → **Telefon a PINy** → **+ Přiřadit lidi z týmů** (kapitola 8).

## 12. Správa organizace

Menu **Správa organizace** (jen správce) má záložky:

![Správa organizace – pracoviště](/napoveda/img/c-pracoviste.png)

- **Pracoviště**: **+ Pracoviště** – název, typ (nemocnice, hospic, ambulance, praktický lékař, domov, ZZS, jiný), telefon 24/7, IČO / IČP, adresa. Garantem může být jen nemocnice, hospic, ambulance nebo PL. Každý partner, který má s pacienty pracovat, musí být pracovištěm v této organizaci. Klik na řádek pracoviště upraví nebo vypne.
- **Uživatelé** (přihlášení do centrální aplikace – lidé s PINem pro telefon jsou v agendě Lidé a týmy): **+ Uživatel** – jméno, přihlašovací jméno, pracoviště, role (lékař, sestra, jen čtení, správce), telefon, e-mail, číslo ČLK. Po uložení se zobrazí **první heslo**, které uživateli předáte; dokud si ho nezmění, vidíte ho v seznamu. Tlačítko pro nové heslo slouží i při zapomenutém hesle.

![Správa organizace – uživatelé](/napoveda/img/c-uzivatele.png)

- **Telefony**: všechny telefony u pacientů – stav, poslední spojení, baterie, verze aplikace a plánu. Klik otevře pacienta.
- **Log přístupů a AI**: neměnný záznam, kdo co zobrazil a změnil, a dotazy na AI (jen délka a počet anonymizovaných údajů, bez obsahu).
- **Nastavení**: **Název sítě** (zobrazuje se v hlavičce), výchozí **interval revize plánu** v měsících a **odkaz pro přihlášení** uživatelů, který rozešlete.

## 13. Karta na telefonu – instalace a spárování

![Telefon – spárování karty](/napoveda/img/k-parovani.png)

1. Na telefonu u pacienta otevřete adresu karty (`…/karta/`) nebo odkaz z SMS.
2. **iPhone**: chcete-li kartu jako aplikaci na ploše, nejdřív ji přidejte na plochu (Sdílet → **Přidat na plochu**), otevřete ji z plochy a **spárujte až tam**. Aplikace na ploše má vlastní úložiště – co se spáruje v Safari, na ploše nebude. **Android**: v Chromu menu ⋮ → Přidat na plochu / Nainstalovat aplikaci.
3. Klepněte na **Načíst QR kód fotoaparátem** a namiřte na QR kód v okně Spárovat telefon v centrální aplikaci (nebo kódy opište ručně, nebo otevřete odkaz z SMS – kódy se vyplní samy).
4. Zadejte **číslo tohoto telefonu** a klepněte na **Spárovat**. Karta se nahraje jen tehdy, když číslo odpovídá číslu u pacienta.

![Telefon – načtení QR kódu fotoaparátem](/napoveda/img/k-qr.png)

- Telefon poprvé požádá o přístup k fotoaparátu – povolte ho. Když ho omylem zakážete, povolte ho v nastavení telefonu, nebo kódy opište.
- Data jsou v telefonu **šifrovaná**; telefon používejte jen pro tento průkaz.
- Hláška „Karta tohoto pacienta je určená pro jiné číslo telefonu“ znamená, že číslo neodpovídá – zkontrolujte ho v centrální aplikaci (Údaje → Telefon s kartou).

## 14. Karta na telefonu – každodenní používání

### Zamčená karta – pro každého, i pro záchranku

![Telefon – zamčená krizová karta](/napoveda/img/k-zamceno.png)

Bez přihlášení je vidět **krizová karta**: cíl péče, limitace s dokladem, SOS léky, alergie, kontakty a telefon na garanta. **Záchranná služba** nepotřebuje PIN ani žádný seznam lidí: bez přihlášení zapíše **výjezd** – výsledek zásahu, **své jméno a posádku** (povinné) a poznámku. V deníku je výjezd označený jako neověřený.

![Telefon – zápis výjezdu záchranné služby](/napoveda/img/k-zzs.png)

Pruh nahoře ukazuje, kdy se karta naposledy aktualizovala. Když jsou data starší než 24 hodin, objeví se červené upozornění – připojte telefon k síti.

### Odemknutí

- **Odemknout PINem** → osobní PIN z vašeho pracoviště (lékař, hospic, sestra DPS, praktický lékař) nebo PIN, který rodině vydal garant. Po 5 chybných pokusech se okno zavře.
- **Kód lékaře** → kód z centrální aplikace pro lékaře, který na kartu přiřazený není (platí 5 minut).
- Po odemknutí je nahoře vidět, kdo je přihlášený a co jeho role smí (kapitola 10).
- Karta se sama zamkne po 2 minutách bez dotyku; ručně tlačítkem s rolí vpravo nahoře.

![Telefon – odemčená karta pro pečující](/napoveda/img/k-odemceno.png)

Po odemknutí jsou dlaždice **Karta, Plán, Deník, Zhoršení, Kontakty, Tým**:

- **Deník** – vyberete typ zápisu (nabízí se jen to, co vaše role smí) a napíšete text; zápis se uloží pod vaším jménem. Funguje i bez signálu, odešle se při nejbližším připojení (číslo na dlaždici = kolik zápisů čeká na odeslání).

![Telefon – zápis do deníku](/napoveda/img/k-denik.png)

- **Zhoršení** – průvodce: co pozoruji (dušnost, bolest, neklid…), co jsem udělal(a) (podán SOS lék, poloha…), komu jsem volal(a). **Zapsat zhoršení a zobrazit na kartě** – zhoršení se ukáže na kartě i v centrální aplikaci; po zlepšení klepněte na **Stav stabilizován**. Tlačítko **Volat** vytočí první pečující kontakt.

![Telefon – průvodce zhoršením stavu](/napoveda/img/k-zhorseni.png)

- **Plán** – cíl péče, limitace, doklad, SOS léky a pravidelná medikace, kdo plán stanovil a do kdy platí. Plán mění jen lékař v centrální aplikaci.
- **Kontakty** a **Tým** – kontakty po skupinách, garant, tým a údaje o tomto telefonu (kdy byl spárován, poslední spojení, co čeká na odeslání).

Při ohrožení života volejte **155** – karta nenahrazuje záchrannou službu.

## 15. Správa tenantů

Jen pro provozovatele platformy (`/tenanti/`, heslo správy).

![Správa tenantů – seznam organizací](/napoveda/img/t-seznam.png)

- **Tenant** = organizace, která provozuje síť karet (např. nadace pro kraj nebo jeden hospic). Uvnitř tenanta jsou pracoviště, uživatelé a pacienti.
- **+ Založit tenanta**: IČO (**Načíst z ARES** doplní název a adresu), typ prvního pracoviště, telefon 24/7, název sítě a správce organizace (jméno, přihlašovací jméno, e-mail, telefon, zda je lékař). Vznikne tenant, první pracoviště a účet správce s **prvním heslem**, které se zobrazí jen jednou, spolu s textem k odeslání správci.
- Organizace se stejným IČO se znovu nezakládá – jen se jí zapne karta pacienta.
- Klik na tenanta: přehled, uživatelé, **Zapnout / Vypnout kartu pacienta** a **nové heslo** pro správce, který heslo zapomněl.

![Správa tenantů – založení organizace](/napoveda/img/t-zalozit.png)

## 16. Vzhled, nápověda a chat

### Vzhled – barevná schémata

Tlačítko **🎨** v hlavičce (na telefonu v okně nápovědy) otevře výběr barevného schématu: Karta modrá (výchozí, v noci tmavá podle systému), PéčeDoma Plus zelená, Datec modrá, Veselá, Konzervativní, Letní, Zimní, Podzimní, Jarní a Tmavá. Volba platí jen na tomto zařízení a v tomto prohlížeči. Barvy stavů (červená, oranžová, zelená) zůstávají stejné.

![Vzhled – výběr barevného schématu](/napoveda/img/c-vzhled.png)

### Nápověda

Tlačítko **📖** otevře tento návod rovnou na kapitole k obrazovce, kterou máte otevřenou. Vlevo je obsah, klik na obrázek ho zvětší, **🖨 Tisk** vytiskne celý návod (v tiskovém okně jde zvolit Uložit jako PDF).

### Chat nápovědy

Tlačítko **💬 Zeptat se** (nebo modré **?** vlevo dole v centrální aplikaci) otevře chat. Asistent odpovídá česky **jen podle tohoto návodu**, ví, kterou obrazovku máte otevřenou, a na konci odpovědi nabídne odkaz na kapitolu návodu.

![Chat nápovědy](/napoveda/img/c-chat.png)

- Chat **nevidí data pacientů**. Do dotazu nepište jména, rodná čísla ani telefony – dotaz projde anonymizační bránou, a kdyby v něm identifikátor zůstal, neodešle se.
- Chat mohou používat přihlášení uživatelé a spárované telefony. Konverzace zůstává jen v tomto okně prohlížeče (tlačítko **Nový** ji smaže).

## 17. Bezpečnost a soukromí

- Prohlížeč neposílá do databáze žádné příkazy – vše jde přes server a je vázané na přihlášeného uživatele. Každá organizace vidí jen svá data.
- Pacienta vidí jen pracoviště v týmu kolem pacienta a správce organizace. Každé zobrazení a změna se zapisuje do neměnného logu přístupů.
- Telefon: data v telefonu jsou šifrovaná klíčem, který nejde z telefonu vyexportovat; v databázi je jen otisk tokenu telefonu. Zablokovaný nebo uzavřený průkaz se z telefonu při připojení vymaže.
- **AI jen anonymně**: rozbor propouštěcí zprávy i chat nápovědy dostávají text až po anonymizaci (jména, rodná čísla, data, adresy, telefony, e-maily → značky). Když v textu zůstane něco jako identifikátor, dotaz se neodešle.
- Deník, historie garance, verze plánu a log přístupů nejde mazat ani přepisovat.

## 18. Časté otázky

**Po přidání karty na plochu iPhonu se aplikace ptá znovu na kódy.** Aplikace na ploše má vlastní úložiště. V centrální aplikaci klikněte znovu na Spárovat telefon (kód platí jen jednou) a v aplikaci na ploše klepněte na Načíst QR kód fotoaparátem (kapitola 13).

**Telefon hlásí „určená pro jiné číslo telefonu“.** Zadané číslo neodpovídá poli Telefon s kartou u pacienta. Opravte číslo v Údajích, nebo zadejte číslo telefonu, který držíte.

**V Týmu a garanci se nenabízí žádné pracoviště.** V organizaci zatím není další pracoviště. Založte ho ve Správa organizace → Pracoviště (kapitola 12).

**Nejde poslat SMS.** Okno Spárovat telefon napíše důvod. Spárujte QR kódem; nastavení SMS na serveru řeší provozovatel.

**Plán je po platnosti.** Lékař v záložce Krizová karta klikne na Potvrdit revizi plánu, nebo plán upraví a uloží novou verzi.

**Ztratil se telefon.** V záložce Telefon a PINy telefon zablokujte – při připojení se vymaže. Pak spárujte nový.

**Pečující zapomněl PIN.** PIN nejde zobrazit znovu. Člověku z Lidí a týmů vydejte **Nový PIN** (platí pak u všech jeho pacientů), rodinný PIN u pacienta zrušte a vydejte nový.

**Musím každou sestru domova zapisovat ke každému pacientovi?** Ne. Domov (nebo správce) své sestry zapíše jednou v Lidech a týmech, rozdělí do oddělení a k pacientovi přiřadíte celé oddělení jedním zaškrtnutím.

**Jak se do karty dostane záchranka?** Bez PINu – krizovou kartu vidí každý. Jméno a posádku zapíše až u zápisu výjezdu.

**Zapsal jsem do deníku chybu.** Zápisy nejde mazat. Napište nový zápis s opravou.

**Data na telefonu jsou stará.** Připojte telefon k internetu a klepněte na pruh s časem aktualizace (synchronizovat). Karta se synchronizuje i sama při každém otevření a každých 5 minut.
