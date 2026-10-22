# Nápověda – Karta pacienta

Karta pacienta (paliativní průkaz) je krizový plán péče, který má pacient vždy u sebe v telefonu. Garant (hospic, paliativní ambulance, praktický lékař nebo dočasně nemocnice) plán vede v centrální aplikaci, telefon u lůžka ho ukazuje i bez signálu a posádka záchranky vidí krizovou kartu bez přihlášení. Obrázky v návodu jsou ukázkové, se smyšlenými jmény.

## 1. Co je Karta pacienta

Aplikace má čtyři části, všechny na jedné adrese:

| Část | Adresa | Pro koho |
|---|---|---|
| Centrální aplikace | `/centrala/` | garant a tým kolem pacienta – lékaři, sestry, správce organizace |
| Karta na telefonu | `/karta/` | zapůjčený telefon u lůžka pacienta (jen karta) – pečující (rodina, sestry), lékař na místě, posádka ZZS |
| Můj průkaz | `/pacient/` | vlastní telefon soběstačného pacienta – plán od lékaře a vlastní přání, léky a poznámky (kapitola 19) |
| Správa tenantů | `/tenanti/` | provozovatel platformy – zakládá organizace |

Jak to funguje v kostce:

1. Lékař v centrální aplikaci založí pacienta – údaje načte ze souboru z portálu PéčeDoma, z propouštěcí zprávy (anonymní rozbor) nebo je vyplní ručně – a stanoví **cíl péče a limitace**.
2. U pacienta je uvedené **číslo telefonu s kartou**. Kartu jde nahrát jen do telefonu s tímto číslem: odkazem z SMS nebo naskenováním QR kódu.
3. Každé pracoviště – garant i partneři (domov, praktický lékař…) – si své **lidi a týmy** zapíše jednou (ručně, ze souboru CSV nebo z PéčeDoma). K pacientovi se pak lidé jen **přiřadí** – celý tým jedním zaškrtnutím.
4. Telefon ukazuje **krizovou kartu** (bez přihlášení – stačí záchranné službě). Přiřazení lidé se odemknou svým **osobním PINem**, rodina PINem od garanta, lékař na místě **kódem lékaře**. Co kdo vidí a zapíše, určuje jeho **role** (lékař, praktický lékař, hospic, sestra DPS, rodina, ZZS). Vše funguje i bez signálu a sesynchronizuje se při nejbližším připojení.
5. Plán péče mění jen lékař v centrální aplikaci. Každá změna je nová verze s podpisem, telefon plán nikdy nepřepíše.

> Karta je vždy jen v jednom zapůjčeném telefonu. Nový telefon zablokuje předchozí a zablokovaný telefon se při připojení sám vymaže. Vedle toho může mít pacient průkaz i ve vlastním telefonu v aplikaci **Můj průkaz** (kapitola 19).

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

![Výběr klienta z PéčeDoma – skupiny hospic / 720 / LPP a hledání](/napoveda/img/c-novy-pecedoma.png)

Tři možnosti:

1. **Načíst klienta z PéčeDoma** (nejrychlejší): když správce nastavil propojení s PéčeDoma (kapitola 12), klikněte na **Vybrat klienta z PéčeDoma**, napište část jména nebo rodné číslo, stiskněte **Hledat** a klienta vyberte. Nad seznamem jsou stejná tlačítka skupin jako v PéčeDoma v Klientech – **🏥 Pacienti hospic (926)**, **🩺 Pacienti odbornost 720** a **📞 Linka paliativní podpory** (u tlačítka je počet klientů ve skupině); zapnuté tlačítko omezí seznam na skupinu, víc tlačítek najednou ukáže kohokoli z nich a klient má štítky skupin i v seznamu – údaje, diagnózy, léky, funkční stav a kontakty se načtou rovnou. Pacient zůstane s klientem PéčeDoma **propojený** (léky a návštěvy se pak přebírají dál, kapitola 9). Bez propojení: v portálu PéčeDoma v Datech klienta uložte **Export pro Kartu pacienta** (soubor JSON) a tady ho načtěte tlačítkem **Načíst soubor JSON**. Vyplní se údaje pacienta, diagnózy, léky, funkční stav a kontakty; číslo telefonu s kartou se předvyplní telefonem klienta.
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

Panel **Nejbližší návštěva** (PéčeDoma) ukazuje u propojeného pacienta nejbližší plánovanou návštěvu z kalendáře FK – kdy a kdo (lékař, sestra). Totéž vidí telefon u pacienta i Můj průkaz.

Panel **Od pacienta** se objeví, když pacient z aplikace Můj průkaz sám pošle své údaje – hodnoty a přání, léky, které skutečně užívá, poznámky a otázky. U každé položky je původ (např. „jak si pamatuji rozhovor se zdravotníkem“) a datum aktualizace. Jsou to údaje pacienta, ne lékařský záznam ani dříve vyslovené přání; v deníku je o tom zápis **Sdíleno pacientem**.

![Panel Od pacienta v záložce Krizová karta](/napoveda/img/c-od-pacienta.png)

### Plán péče

![Plán péče s verzemi](/napoveda/img/c-plan.png)

- Plán upravuje jen **lékař** pracoviště, které je garant nebo lékař v týmu. Ostatní ho vidí jen ke čtení.
- **Uložit jako novou verzi** – každá změna je nová verze s podpisem lékaře, starší verze zůstávají (seznam **Verze plánu** vpravo, klik zobrazí starou verzi).
- **Platnost plánu do** – po datu platnosti se v přehledu i u pacienta objeví upozornění a lékař udělá **revizi**: potvrdí, že plán platí beze změny, a nastaví novou platnost. Výchozí interval revize nastavuje správce (kapitola 12).
- Sestra ani rodina cíl péče a limitace vyplnit nemohou.

**Doklad k limitacím.** Aplikace jen eviduje, jaký doklad existuje – vyplnění v aplikaci samo dříve vyslovené přání (DVP) nevytváří. U DVP vyplňte datum, kde je originál a:

- **Písemné poučení lékařem** a **Podpis pacienta – úředně ověřený**: když je obojí doloženo, karta ukáže zelené *poučení lékařem a ověřený podpis*; jinak žluté upozornění, ať posádka ověří originál.
- **DVP sepsané při přijetí u poskytovatele**: vyplňte jen tehdy, když bylo přání sepsáno při přijetí do péče nebo při hospitalizaci. Takové přání platí jen u tohoto poskytovatele – karta pro ZZS to tak i napíše.
- Bez DVP karta uvádí **rozhodnutí lékaře** a odkaz na zprávu nebo zápis o rozhovoru.

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

Tlačítko **Kód lékaře na dnešek** (jen lékař, když je telefon spárovaný) ukáže šestimístný kód pro lékaře, který k pacientovi není přiřazený (pohotovost, zástup). Kód platí **celý kalendářní den** a je pořád stejný – o půlnoci se změní. Lékař na místě ho zadá v telefonu tlačítkem **Lékař bez PINu** spolu se svým jménem; telefon ho ověří i bez signálu (přijme i včerejší kód) a odemknutí se zapíše se jménem. Stejný kód lékař najde i v **PéčeDoma** v Datech klienta (tlačítko 🪪 Kód lékaře na kartu). Každé zobrazení kódu je v logu přístupů.

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

### Vlastní telefon pacienta (Můj průkaz)

Soběstačný pacient může mít průkaz i ve svém telefonu – v aplikaci **Můj průkaz** (kapitola 19). Zpřístupňuje garant nebo lékař v týmu:

1. V panelu **Vlastní telefon pacienta** klikněte na **Zpřístupnit pacientovi v jeho telefonu**.
2. Zadejte **mobil pacienta**. Kód půjde použít jen s tímto číslem.
3. **Poslat odkaz SMS** – pacientovi přijde odkaz; nebo **Zobrazit QR kód (v ordinaci)** – pacient ho načte fotoaparátem.

![Zpřístupnění průkazu v telefonu pacienta](/napoveda/img/c-pacientovi.png)

- Kód platí **3 dny a jen jednou**. Na novém telefonu vydejte nový kód – předchozí telefon pacienta tím přestane dostávat data.
- Pacient vidí plán, kontakty a tým. **Deník týmu, PINy ani kód lékaře do jeho telefonu nechodí** a do deníku z něj nikdo nezapisuje.
- **Ukončit přístup** – data od lékaře se v telefonu pacienta přestanou aktualizovat. Co už pacient má, je jeho kopie a smazat ji nelze.
- Zapůjčený telefon pro krizi to nenahrazuje: vlastní telefon je zamčený a záchranka se do něj nedostane.

## 9. Údaje, dokumenty a uzavření průkazu

![Údaje pacienta](/napoveda/img/c-udaje.png)

- **Údaje**: identifikace pacienta a **Telefon s kartou**. Upravuje garant nebo lékař (**Uložit údaje**). Identifikační údaje (jméno, RČ, adresa) zůstávají jen v centrální aplikaci; telefon dostane jméno a rok narození, AI nedostane nic z toho.
- **Informace pacientovi** – lékař tlačítkem **Potvrdit podpis** zaznamená, že pacient / zástupce dostal informace a podepsal je.
- **PéčeDoma** (panel vpravo): zda je pacient propojený s klientem PéčeDoma, kdy proběhla synchronizace, tlačítka **Otevřít PéčeDoma** (odkaz z nastavení), **Synchronizovat teď**, **Propojit s klientem PéčeDoma** / **Odpojit** (lékař nebo garant). Z PéčeDoma se přebírají **aktivní léky** a **nejbližší plánovaná návštěva**; automaticky každých 30 minut, pokud to správce zapnul. Léky se ukazují v záložce Plán péče jako **Léky podle PéčeDoma** – lékař je tlačítkem **Převzít léky do formuláře plánu** vloží do polí a uloží jako novou verzi plánu (plán se sám nikdy nemění).
- **Dokumenty**: dříve vyslovené přání, lékařské zprávy, informace pacientovi a jiné (PDF nebo foto do 8 MB). U každého **datum dokumentu**, **pracoviště, které ho vydalo**, a kde je originál – aby byl vždy znát původ. Vkládá garant nebo lékař, klik na dokument ho otevře.

![Dokumenty s datem a pracovištěm](/napoveda/img/c-dokumenty.png)
- **Přístupy** (garant a správce): kdo a kdy průkaz zobrazil nebo měnil.
- **Uzavřít průkaz** (garant): vyberete důvod (úmrtí, předání mimo síť, hospitalizace, na přání pacienta, jiný). Telefon se při příštím připojení vymaže a PINy přestanou platit. Předtím si pořiďte **výpis do dokumentace**.

## 10. Role na kartě – kdo co vidí a zapisuje

Role jsou stejné jako v ukázkové verzi. Každý po odemknutí karty vidí nahoře, kdo je přihlášený a co jeho role smí, a nabídnou se mu jen jeho typy zápisů.

| Role | Jak se dostane ke kartě | Co vidí | Co zapisuje do deníku |
|---|---|---|---|
| Lékař | osobní PIN (Lidé a týmy) nebo kód lékaře dne | celý záznam | návštěva lékaře, změna stavu, podán SOS lék, návštěva hospice, telefonát, zhoršení |
| Praktický lékař | osobní PIN nebo kód lékaře dne | celý záznam | návštěva lékaře, změna stavu, podán SOS lék, telefonát, zhoršení |
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
- **Propojení s PéčeDoma** (v Nastavení): **odkaz na portál PéčeDoma** vaší organizace (zobrazí se u pacienta), **server PéčeDoma** (jhn-apps), **token aplikace** (stejný, kterým portál PéčeDoma volá svůj server – do prohlížeče se zpět neposílá) a zatržítko **Synchronizovat automaticky**. Po uložení se v průvodci Nový pacient objeví **Vybrat klienta z PéčeDoma** a u pacientů panel PéčeDoma (kapitola 9).

![Správa organizace – Nastavení – Propojení s PéčeDoma](/napoveda/img/c-nastaveni-pecedoma.png)

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

Pod krizovou kartou jsou tři tlačítka podle toho, kdo kartu otevírá:

- **Přístup rodina** → PIN, který rodině vydal garant u pacienta.
- **Přístup tým** → osobní PIN z agendy Lidé a týmy: sestra domova, hospic, praktický lékař, lékař. Po 5 chybných pokusech se okno zavře.
- **Lékař bez PINu** → kód lékaře pro dnešní den z centrální aplikace nebo z PéčeDoma (kapitola 8) a jméno lékaře.
- **Záchranná služba** nic nezadává – krizovou kartu vidí bez odemknutí a výjezd zapíše níže.
- Po odemknutí je nahoře vidět, kdo je přihlášený a co jeho role smí (kapitola 10).
- Karta se sama zamkne po 2 minutách bez dotyku; ručně tlačítkem s rolí vpravo nahoře.

![Telefon – odemčená karta pro pečující](/napoveda/img/k-odemceno.png)

![Telefon – nejbližší návštěva z PéčeDoma na Kartě](/napoveda/img/k-navsteva.png)

Po odemknutí jsou dlaždice **Karta, Plán, Deník, Zhoršení, Kontakty, Tým**. U pacienta propojeného s PéčeDoma je na Kartě panel **Nejbližší návštěva** (kdy a kdo přijde) a v Plánu **Léky podle PéčeDoma** – aktuální seznam léků z PéčeDoma vedle léků z plánu; závazný je plán péče, rozdíly řeší lékař.

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
- Telefon: data v telefonu jsou šifrovaná klíčem, který nejde z telefonu vyexportovat; v databázi je jen otisk tokenu telefonu. Zablokovaný nebo uzavřený průkaz se ze zapůjčeného telefonu při připojení vymaže.
- **Můj průkaz** (vlastní telefon pacienta): data jsou šifrovaná dvakrát – PINem pacienta a klíčem telefonu. Vlastní přání, léky a poznámky pacienta jsou jen v jeho telefonu; provozovatel ani tým je nevidí, dokud je pacient sám nepošle (výběr → náhled → potvrzení).
- **AI jen anonymně**: rozbor propouštěcí zprávy i chat nápovědy dostávají text až po anonymizaci (jména, rodná čísla, data, adresy, telefony, e-maily → značky). Když v textu zůstane něco jako identifikátor, dotaz se neodešle.
- Deník, historie garance, verze plánu a log přístupů nejde mazat ani přepisovat.

## 18. Časté otázky

**Po přidání karty na plochu iPhonu se aplikace ptá znovu na kódy.** Aplikace na ploše má vlastní úložiště. V centrální aplikaci klikněte znovu na Spárovat telefon (kód platí jen jednou) a v aplikaci na ploše klepněte na Načíst QR kód fotoaparátem (kapitola 13).

**Telefon hlásí „určená pro jiné číslo telefonu“.** Zadané číslo neodpovídá poli Telefon s kartou u pacienta. Opravte číslo v Údajích, nebo zadejte číslo telefonu, který držíte.

**V Týmu a garanci se nenabízí žádné pracoviště.** V organizaci zatím není další pracoviště. Založte ho ve Správa organizace → Pracoviště (kapitola 12).

**Nejde poslat SMS.** Okno Spárovat telefon napíše důvod. Spárujte QR kódem; nastavení SMS na serveru řeší provozovatel.

**Plán je po platnosti.** Lékař v záložce Krizová karta klikne na Potvrdit revizi plánu, nebo plán upraví a uloží novou verzi.

**Ztratil se telefon.** V záložce Telefon a PINy telefon zablokujte – při připojení se vymaže. Pak spárujte nový.

**Lékař na pohotovosti nemá PIN.** Kód lékaře pro dnešek najde v PéčeDoma v Datech klienta (🪪 Kód lékaře na kartu) nebo mu ho nadiktuje lékař z týmu z centrální aplikace. Na telefonu zvolí Lékař bez PINu (kapitola 8).

**Pečující zapomněl PIN.** PIN nejde zobrazit znovu. Člověku z Lidí a týmů vydejte **Nový PIN** (platí pak u všech jeho pacientů), rodinný PIN u pacienta zrušte a vydejte nový.

**Musím každou sestru domova zapisovat ke každému pacientovi?** Ne. Domov (nebo správce) své sestry zapíše jednou v Lidech a týmech, rozdělí do oddělení a k pacientovi přiřadíte celé oddělení jedním zaškrtnutím.

**Jak se do karty dostane záchranka?** Bez PINu – krizovou kartu vidí každý. Jméno a posádku zapíše až u zápisu výjezdu.

**Zapsal jsem do deníku chybu.** Zápisy nejde mazat. Napište nový zápis s opravou.

**Pacient chce průkaz ve svém telefonu.** V Telefon a PINy klikněte na Zpřístupnit pacientovi v jeho telefonu (kapitola 8, pro pacienta kapitola 19).

**Pacient zapomněl PIN do Můj průkaz.** PIN nikdo neobnoví. Pacient v aplikaci zvolí Zapomněl(a) jsem PIN → Smazat vše a začít znovu a vy mu vydáte nový kód. Jeho vlastní záznamy, které předtím neposlal ani nevytiskl, jsou ztracené.

**Je to, co pacient napíše do Můj průkaz, dříve vyslovené přání?** Ne. Je to jeho osobní záznam. Platné DVP vyžaduje písemné poučení lékařem a úředně ověřený podpis (nebo zápis při přijetí do péče) – evidujte ho v plánu péče a v dokumentech.

**Data na telefonu jsou stará.** Připojte telefon k internetu a klepněte na pruh s časem aktualizace (synchronizovat). Karta se synchronizuje i sama při každém otevření a každých 5 minut.

## 19. Můj průkaz – průkaz ve vlastním telefonu pacienta

Aplikace **Můj průkaz** (`/pacient/`) je pro soběstačné pacienty, kteří chtějí mít svůj průkaz u sebe a připravit se na rozhovor s lékařem. Na rozdíl od zapůjčeného telefonu (kapitola 13) běží ve vlastním telefonu pacienta vedle jiných aplikací a otevírá ji jen pacient svým PINem.

### Propojení

1. Lékař průkaz zpřístupní (kapitola 8) – přijde SMS s odkazem, nebo lékař ukáže QR kód.
2. Otevřete odkaz v telefonu (nebo `/pacient/` → **Načíst QR kód fotoaparátem**), zadejte **číslo svého telefonu** a **Propojit**.
3. Nastavte si **PIN** (6–12 číslic, dvakrát). Tímto PINem budete Můj průkaz otevírat a jím jsou data v telefonu zašifrovaná.

![Propojení s průkazem](/napoveda/img/p-propojeni.png)
![Nastavení PINu](/napoveda/img/p-pin.png)

> Na iPhonu nejdřív přidejte Můj průkaz na plochu (Sdílet → Přidat na plochu) a propojte ho až v aplikaci na ploše.

### Co v aplikaci najdete

![Můj průkaz – přehled s krizovou kartou](/napoveda/img/p-prehled.png)

- **Průkaz** – krizová karta tak, jak ji vede váš lékař, a přehled vašich záznamů.
- **Od lékaře** – plán péče, doklad k limitacím, SOS léky, léky podle lékaře, kontakty a tým. Vše je **jen ke čtení** a s původem (kdo a kdy plán stanovil). Mění to jen lékař.
- **Přání** – vaše hodnoty a přání: co je pro vás důležité, čeho se obáváte, co mají lékaři zohlednit, koho chcete mít u rozhodování. U záznamu vyberte, **odkud je**: vlastní příprava, jak si pamatujete rozhovor se zdravotníkem (s kým, kdy), nebo opsáno ze záznamu zdravotníka.
- **Léky** – léky, které **skutečně** užíváte, s dávkou a datem aktualizace. Pro srovnání pod nimi léky podle lékaře.
- **Poznámky** – otázky pro lékaře a poznámky, jak se máte.
- **Sdílet** – souhrn k tisku nebo k předání (níže).
- **Nouzové info** – text do Zdravotního ID na zamčené obrazovce.
- **Nastavení** – změna PINu, smazání všeho z telefonu.

![Moje hodnoty a přání](/napoveda/img/p-prani.png)
![Léky, které skutečně užívám](/napoveda/img/p-leky.png)

> **Přání v aplikaci není dříve vyslovené přání podle zákona.** Platné DVP se sepisuje písemně s poučením od lékaře a s úředně ověřeným podpisem (nebo při přijetí do péče u konkrétního poskytovatele). Poraďte se se svým lékařem.

### Sdílení a tisk

1. V oddílu **Sdílet** zaškrtněte, co chcete předat (u každé položky je, zda je *od lékaře*, nebo *údaj pacienta*, a kdy byla aktualizovaná).
2. **Zobrazit náhled** – uvidíte přesně to, co předáte, s datem vytvoření a původem každé položky.
3. Vyberte: **Vytisknout / PDF**, **Poslat svému týmu** (do centrální aplikace – jen vaše vlastní údaje, údaje od lékaře tým už má), nebo **Poslat jinam** (e-mail, zpráva).

![Výběr, co předat](/napoveda/img/p-sdilet.png)
![Náhled souhrnu](/napoveda/img/p-nahled.png)

Po předání už nejde zaručit, že příjemce kopii smaže; u zdravotníků se může stát součástí zdravotnické dokumentace.

### Nouzové info – Zdravotní ID

Do zamčeného telefonu se záchranka nedostane. Telefon ale umí ukázat **Zdravotní ID** na zamčené obrazovce. V oddílu **Nouzové info** je připravený text (máte paliativní průkaz, koho volat, alergie; diagnózu a limitace přidáte jen když chcete) – **Zkopírovat text** a vložit podle návodu pro iPhone (aplikace Zdraví → Zdravotní ID) nebo Android (Nastavení → Bezpečnost a nouzové situace). Vytiskněte si i krizovou kartu.

![Nouzové info pro Zdravotní ID](/napoveda/img/p-nouze.png)

### Zamykání a PIN

![Zamčený Můj průkaz](/napoveda/img/p-zamek.png)

- Můj průkaz se zamkne po 5 minutách nečinnosti, při odchodu z aplikace na déle než minutu a tlačítkem **zamknout**.
- Po 5 špatných pokusech je nutné chvíli počkat.
- **Zapomenutý PIN nikdo neobnoví** – ani lékař, ani provozovatel. Zvolte **Zapomněl(a) jsem PIN → Smazat vše a začít znovu** a požádejte lékaře o nový kód. Údaje od lékaře se vrátí, vaše vlastní záznamy ne – proto je občas vytiskněte nebo pošlete týmu.
- Když lékař ukončí přístup, údaje od lékaře se přestanou aktualizovat; vše, co v telefonu máte, zůstává.
