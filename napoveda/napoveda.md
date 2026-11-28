# Nápověda – Karta pacienta

Karta pacienta (paliativní průkaz) je krizový plán péče, který má pacient vždy u sebe v telefonu. Garant (hospic, paliativní ambulance, praktický lékař nebo dočasně nemocnice) plán vede v centrální aplikaci, telefon u lůžka ho ukazuje i bez signálu a posádka záchranky vidí krizovou kartu bez přihlášení. Obrázky v návodu jsou ukázkové, se smyšlenými jmény.

## 1. Co je Karta pacienta

Aplikace má čtyři části, všechny na jedné adrese:

| Část | Adresa | Pro koho |
|---|---|---|
| Centrální aplikace | `/centrala/` | garant a tým kolem pacienta – lékaři, sestry, správce organizace |
| Karta na telefonu | `/karta/` | zapůjčený telefon u lůžka pacienta (jen karta) – pečující (rodina, sestry), lékař na místě, posádka ZZS |
| Průkaz pacienta | samostatná aplikace (DialogusPrukaz) | vlastní telefon pacienta a rodiny – údaje od lékaře si pacient zkopíruje do svého telefonu (kapitola 19); dřívější Můj průkaz (`/pacient/`) je od 0.11.111 zrušený |
| Správa tenantů | `/tenanti/` | provozovatel platformy – zakládá organizace |

Jak to funguje v kostce:

1. Lékař v centrální aplikaci založí pacienta – údaje načte ze souboru z portálu PéčeDoma, z propouštěcí zprávy (anonymní rozbor) nebo je vyplní ručně – a stanoví **cíl péče a limitace**.
2. U pacienta je uvedené **číslo telefonu s kartou**. Kartu jde nahrát jen do telefonu s tímto číslem: odkazem z SMS nebo naskenováním QR kódu.
3. Každé pracoviště – garant i partneři (domov, praktický lékař…) – si své **lidi a týmy** zapíše jednou (ručně, ze souboru CSV nebo z PéčeDoma). K pacientovi se pak lidé jen **přiřadí** – celý tým jedním zaškrtnutím.
4. Telefon ukazuje **krizovou kartu** (bez přihlášení – stačí záchranné službě). Přiřazení lidé se odemknou svým **osobním PINem**, rodina PINem od garanta, lékař na místě **kódem lékaře**. Co kdo vidí a zapíše, určuje jeho **role** (lékař, praktický lékař, hospic, sestra DPS, rodina, ZZS). Vše funguje i bez signálu a sesynchronizuje se při nejbližším připojení.
5. Plán péče mění jen lékař v centrální aplikaci. Každá změna je nová verze s podpisem, telefon plán nikdy nepřepíše.

> Karta je vždy jen v jednom zapůjčeném telefonu. Nový telefon zablokuje předchozí a zablokovaný telefon se při připojení sám vymaže. Vedle toho může mít pacient průkaz i ve vlastním telefonu v aplikaci **Můj průkaz** (kapitola 19).

## 2. Přihlášení a můj účet

Vedle pole s heslem je tlačítko 👁 (od 0.11.74): zadané heslo zobrazí nebo zase skryje – hodí se na telefonu. Je i při změně hesla.

Centrální aplikace funguje i na mobilu (od 0.11.46): hlavička je kompaktní, záložky pacienta jsou ve dvou řadách a tlačítka se zalamují. Tabulky (pacienti, kontakty, týmy, lidé, správa) se na mobilu skládají do karet pod sebou s popisky sloupců, takže nic nepřetéká přes okraj a není třeba posouvat do strany (od 0.11.58). Videohovor na telefon u pacienta jde zahájit i z mobilu – otevře se přes celou obrazovku.

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
| správce | spravuje pracoviště, uživatele a nastavení organizace; vidí všechny pacienty; **jednoduchý režim se ho netýká** – má vždy plnou Kartu |

**Přepnout roli** (od 0.11.112, jen správce): klepněte v hlavičce na své role (např. *správce, lékař ▾*) a vyberte, v jaké roli chcete pracovat – **Lékař** (jen je-li správce lékařem), **Sestra** nebo **Jen čtení**. Centrála pak ukáže a server pustí přesně to, co tato role (u organizace v jednoduchém režimu i jednoduchou Kartu), v hlavičce je *· přepnuto*. Zpět tlačítkem **Správce (moje role)**. Přepnout jde jen na stejná nebo nižší práva, platí jen v tomto okně prohlížeče a zapíše se do logu přístupů.

![Přepnout roli](/napoveda/img/c-prepnout-roli.png)

## 3. Přehled pacientů

Menu **Pacienti** ukazuje pacienty, u kterých je vaše pracoviště v týmu (správce vidí všechny). Začíná **přehledem (dashboardem)**, nad ním je tlačítko **📋 Agenda pacientů** se seznamem, hledáním a filtry.

![Přehled pacientů – dlaždice a sloupcové přehledy](/napoveda/img/c-dashboard.png)

- **Dlaždice:** pacienti s průkazem (kolik je propojeno s PéčeDoma), **probíhá zhoršení**, **plán k revizi** (po platnosti a do 14 dní), **telefony k řešení** (nepřipojené přes 12 h, slabá baterie), **bez telefonu** a **zápisy za 24 h**. Barevný proužek a ikona ukazují stav (červená naléhavé, oranžová zkontrolovat, zelená v pořádku); číslo a text platí vždy.
- **Sloupcové přehledy:** **kde jsou pacienti** (Doma, DS B, DS C, Hospitalizace…), **cíl péče**, **telefony s kartou** (kolik pacientů je v kterém telefonu) a **garant průkazu**. Najetím myší se ukáže počet a podíl.
- **Vyžaduje pozornost** (upozornění) a **Poslední zápisy** – klepnutím se otevře pacient.
- Klepnutí na dlaždici nebo sloupec otevře **Agendu pacientů** s odpovídajícím filtrem (např. sloupec DS C zapne filtr DS, dlaždice Probíhá zhoršení vyhledá pacienty se zhoršením). Z agendy se vrátíte tlačítkem **← Přehled pacientů** nebo menu **Pacienti**.

**Agenda pacientů:**

![Přehled pacientů s upozorněními](/napoveda/img/c-pacienti.png)

- **Kde je pacient:** ve sloupci Adresa má každý pacient štítek **🏠 Doma**, **🏢 DS …** (domov pro seniory) nebo **🏥 Hospitalizace**. U pacienta propojeného s PéčeDoma platí jen místo z PéčeDoma (volba „Kde se pacient nachází“ v adresáři, převezme se při každé synchronizaci) – dokud se nenačte, je u něj štítek **místo neověřeno**; pobyt „doma“, který se dřív zapsal automaticky při importu, synchronizace nahradí skutečným místem (do deníku se zapíše „Místo pobytu převzato z PéčeDoma“); u ostatních podle pracoviště typu Domov v týmu nebo podle místa pobytu v Údajích. Nad tabulkou je řada **Kde je:** – **Vše**, **🏠 Doma**, **🏢 DS**, **🏥 Hospitalizace** a **neuvedeno** (u každého počet pacientů); zvolený filtr si prohlížeč pamatuje a kombinuje se s hledáním. Tlačítko **↻ Načíst z PéčeDoma** (lékař, správce) hned načte léky, nejbližší návštěvu a místo u všech propojených pacientů – hodí se po prvním nasazení nebo když organizace nemá zapnutou automatickou synchronizaci.

- Nahoře je panel **Upozornění**: plán po platnosti nebo blížící se revize, probíhající zhoršení stavu, telefon se dlouho nepřipojil nebo má slabou baterii, průkaz ještě není v žádném telefonu, čekající předání garance, nemocnice garantem déle než 30 dní, pacient bez garanta. Klik na upozornění otevře pacienta. Panel se klepnutím na záhlaví **sbalí a rozbalí** – při více než třech upozorněních je zavřený a v záhlaví ukazuje jen souhrn (např. „1× probíhá zhoršení stavu · 13× průkaz zatím není v žádném telefonu“); prohlížeč si pamatuje, jak jste ho nechali.
- Políčko **Hledat** nad seznamem filtruje řádky podle čehokoli, co je v nich vidět: jméno, kód průkazu, adresa, garant, cíl péče. Více slov = všechna musí sedět, diakritika nehraje roli. Stejné hledání je v Lidech a týmech (lidé i týmy), u Pracovišť, Uživatelů, Telefonů a v Logu přístupů.
- V seznamu je u každého pacienta kód průkazu (`P-0001`), **adresa** (a pod ní pobyt, když se liší), garant, platnost plánu a stav telefonu (zelená tečka = připojil se v posledních 12 hodinách).
- Pacient v **domově seniorů** nebo jiné pobytové službě má u adresy zelenomodrý štítek **🏠 domov seniorů · název domova** a barevný pruh u řádku; stejný štítek je v záhlaví detailu. Aplikace to pozná podle pracoviště typu „Domov / pobytová služba“ v týmu kolem pacienta, případně podle slova domov v pobytu.
- **🏷 Štítky na telefony** vytiskne samolepky na zadní stranu telefonů u pacientů najednou (kapitola 8).
- **Seznam: Vše · PéčeDoma · Ambulance** (od 0.11.131, když organizace používá PéčeDoma): přepínač nad seznamem ukáže všechny pacienty, jen klienty propojené s PéčeDoma, nebo jen pacienty **ambulance** – ty, kteří v PéčeDoma nejsou a jsou zapsaní kvůli Průkazu pacienta (typicky založení z dekurzu, kapitola 4). Pacienti ambulance jsou v seznamu **lékařsky zeleně podbarvení** – zelený pruh, zelený řádek a štítek **Ambulance**; místo stavu zapůjčeného telefonu u nich vidíte, zda je **Průkaz v telefonu pacienta**. V režimu Ambulance se skryje filtr *Kde je* (místo se bere z PéčeDoma). Do režimu PéčeDoma pacient přejde sám, jakmile ho s PéčeDoma propojíte (Detail pacienta → PéčeDoma). Volbu si prohlížeč pamatuje.
- Přepínačem nahoře zobrazíte **uzavřené průkazy**.
- Klik na pacienta otevře jeho detail se záložkami (kapitoly 5–9).


**Vybitý telefon** (od 0.11.117): když telefon s kartou u pacienta hlásí baterii **pod 15 %**, je to naléhavé upozornění – v *Vyžaduje pozornost* nahoře, **výrazně červeně orámované** (stejně dlaždice Telefony k řešení, řádek pacienta v agendě a baterie u pacienta). Vybitý telefon by ZZS kartu neukázal – připojte nabíječku. Baterie 15–19 % je oranžová (zkontrolovat).
## 4. Nový pacient

Menu **+ Nový pacient** (jen lékař). Průvodce má dva kroky.

### Krok 1 – odkud vzít údaje

![Nový pacient – načtení z PéčeDoma nebo z propouštěcí zprávy](/napoveda/img/c-novy-1.png)

![Výběr klienta z PéčeDoma – skupiny hospic / 720 / LPP a hledání](/napoveda/img/c-novy-pecedoma.png)

**Více klientů z PéčeDoma najednou:** v okně výběru zatrhněte klienty (klepnutím na řádek nebo na zatržítko na začátku řádku – okno přitom zůstane otevřené; označení zůstává, i když změníte hledání nebo skupiny – „Označit všechny v seznamu“ zatrhne celý vyfiltrovaný seznam) a stiskněte **Založit vybrané (N)**. Karta je postupně načte z PéčeDoma a otevře **náhled hromadného založení** (stejný jako u CSV níže): u každého je vidět, že se **propojí s PéčeDoma**, a kde se nachází. Chybějící **telefon s kartou** doplníte přímo v tabulce – řádek se pak sám zatrhne. Nahoře zvolte garanta a další pracoviště v týmu a stiskněte **Založit vybrané**. Klient, který už průkaz má (stejné rodné číslo), se nezaloží podruhé – u řádku se ukáže chyba. Jednoho klienta k úpravě (cíl péče, limitace, kontakty před založením) otevře tlačítko **Otevřít** v jeho řádku.

![Hromadné založení klientů z PéčeDoma – náhled s doplněním telefonu](/napoveda/img/c-novy-pecedoma-hromadne.png)

![Nový pacient ze zprávy – předvyplněný formulář ke kontrole](/napoveda/img/c-novy-zprava.png)

Čtyři možnosti:

1. **Založit z dekurzu nebo lékařské zprávy** (od 0.11.129, panel nahoře): přetáhněte myší nebo vyberte **dekurz z Medistaru** uložený do PDF (Dekurz → Tisk dekurzu → Uložit PDF) – **doporučeno**, má v hlavičce jméno, rodné číslo, adresu a telefon. Jde i lékařská zpráva, sken nebo fotka: diagnózy a léky Karta načte z obou, ale lékařská zpráva jméno pacienta nemá – Karta na to upozorní a jméno, příjmení a datum narození doplníte ručně. Karta zprávu přečte (10–15 s) a otevře **stejný formulář jako při ručním zápisu**, jen předvyplněný: jméno, příjmení, rodné číslo, datum narození, pohlaví, pojišťovnu, adresu a telefon vezme server z hlavičky zprávy (do AI nejdou), diagnózy, opioidy, SOS léky, další léky, funkční stav a kontakty z rozboru. Vpravo je přehled **Ze zprávy načteno** (co se našlo a co ve zprávě není) a upozornění z rozboru. Všechno jde upravit; cíl péče a limitace doplní lékař. Po **Uložit** se zpráva uloží k pacientovi do Dokumentů (jde vypnout nebo přejmenovat) a podle zaškrtnutí se předá pacientovi do Průkazu. Když už pacient se stejným rodným číslem v Kartě je, Karta na to upozorní a nabídne ho otevřít. Stejná zóna **Načíst údaje ze zprávy…** je i u prázdného formuláře v kroku 2.
2. **Načíst klienta z PéčeDoma** (nejrychlejší): když správce nastavil propojení s PéčeDoma (kapitola 12), klikněte na **Vybrat klienty z PéčeDoma**, napište část jména nebo rodné číslo, stiskněte **Hledat** a klienta vyberte. Nad seznamem jsou stejná tlačítka skupin jako v PéčeDoma v Klientech – **🏥 Pacienti hospic (926)**, **🩺 Pacienti odbornost 720** a **📞 Linka paliativní podpory** (u tlačítka je počet klientů ve skupině); zapnuté tlačítko omezí seznam na skupinu, víc tlačítek najednou ukáže kohokoli z nich a klient má štítky skupin i v seznamu. Na začátku řádku je štítek, **kde se pacient nachází** (🏠 Doma, 🏢 DS B / DS C / DS jiný, 🏥 Hospitalizace – stejná volba jako „Kde se pacient nachází“ v PéčeDoma); hledat jde i podle něj, např. „DS C“. Pod tlačítky skupin je řada **Kde je:** **🏠 Doma**, **🏢 DS (domov pro seniory)** a **🏥 Hospitalizace** (s počtem klientů); místo se se skupinou kombinuje – např. 🩺 720 + 🏢 DS ukáže pacienty odbornosti 720 v domově pro seniory – údaje, diagnózy, léky, funkční stav a kontakty se načtou rovnou. Pacient zůstane s klientem PéčeDoma **propojený** (léky a návštěvy se pak přebírají dál, kapitola 9). Bez propojení: v portálu PéčeDoma v Datech klienta uložte **Export pro Kartu pacienta** (soubor JSON) a tady ho načtěte tlačítkem **Načíst soubor JSON**. Vyplní se údaje pacienta, diagnózy, léky, funkční stav a kontakty; číslo telefonu s kartou se předvyplní telefonem klienta.
3. **Propouštěcí zpráva** (text): vložte text, nahrajte textový soubor nebo vyfoťte zprávu (fotka se převede na text přímo v prohlížeči) a klikněte na **Anonymní rozbor zprávy**. Text projde anonymizační bránou – jména, rodná čísla, data, adresy a telefony se nahradí značkami – a teprve pak ho rozebere AI. Když by v textu zůstal identifikátor, dotaz se neodešle.
4. **Zapsat pacienta ručně** (vlastní panel, tlačítko **Zapsat ručně**) – rovnou krok 2 s prázdným formulářem bez PéčeDoma a bez zprávy. Tlačítko **Pokračovat bez rozboru** pod propouštěcí zprávou udělá totéž, jen si text zprávy ponechá k ručnímu opsání.

**Přepis ze zprávy – ke kontrole** (od 0.11.139): rozbor zprávy (AI i lokální) jen **opisuje údaje, které zpráva výslovně uvádí** – nic neodvozuje, nehodnotí a nedoporučuje. **Cíl péče** a **limitace** se předvyplní jen tehdy, když je zpráva výslovně uvádí (např. „pacient si nepřeje resuscitaci“); věta ze zprávy je vidět jako citace. Jinak zůstane cíl péče prázdný (**— zvolte cíl péče —**) a pacienta nejde uložit, dokud cíl nezvolíte – o cíli rozhoduje lékař. Seznam **Zpráva neuvádí (doplňte)** jen vyjmenuje pole, ke kterým zpráva nic neříká.

### Více pacientů najednou (CSV / JSON) a export

Panel **Více pacientů ze souboru · export** v kroku 1:

- **Načíst CSV s pacienty** – soubor např. z Excelu (oddělovač středník, čárka nebo tabulátor; názvy sloupců jako v šabloně, pořadí libovolné, diakritika nevadí). **Načíst JSON s pacienty** – export z Karty pacienta nebo soubor z PéčeDoma. Otevře se **náhled**: každý řádek s rodným číslem, narozením, telefonem s kartou, cílem péče a počtem kontaktů; řádky s chybou (chybí jméno, telefon s kartou nebo rok narození) jsou odškrtnuté a u stavu je napsáno proč. Nahoře vyberete garanta a pracoviště v týmu, tlačítkem **Založit vybrané** se pacienti založí jeden po druhém – u každého se ukáže kód průkazu nebo chyba (např. duplicitní rodné číslo). Cíl péče a limitace pak lékař potvrdí v průkazu jako u ručního zápisu.
- **Stáhnout šablonu CSV** a **Stáhnout vzorový JSON** – soubor s jedním smyšleným pacientem a všemi sloupci (jméno, příjmení, rodné číslo, narození, pohlaví, pojišťovna, pobyt, adresa, telefon s kartou, e-mail, cíl péče, limitace, diagnózy, funkční stav, alergie, SOS léky, opioidy, medikace, doklad, platnost plánu, až tři kontakty). Seznamy v CSV oddělujte svislítkem `|`.
![Náhled načteného CSV před založením](/napoveda/img/c-novy-csv.png)

- **Exportovat všechny pacienty do CSV / JSON** – všichni aktivní pacienti, které vidíte, ve stejných sloupcích (lékař nebo správce; export se zapisuje do logu přístupů). Export jde upravit a načíst zpět; při načtení vznikají noví pacienti, kód průkazu se nepřenáší.

### Krok 2 – kontrola a doplnění

![Nový pacient – kontrola údajů po načtení z PéčeDoma](/napoveda/img/c-novy-2.png)

- **Identifikace pacienta**: jméno, rodné číslo, datum a rok narození, pojišťovna, kde pobývá, adresa.
- **Telefon s kartou \*** (povinné): číslo telefonu u pacienta, na kterém bude karta. Na žádném jiném telefonu ji nahrát nepůjde.
- **Cíl péče a limitace**: potvrzuje lékař. Cíl péče je symptomatická, omezená, nebo plná léčba. **Limitace péče** má od verze 0.11.92 dvě možnosti podle toho, jestli má pacient podepsané dříve vyslovené přání: **KPR neuvedeno** (nic podepsaného nemá – karta ukáže „KPR: neuvedeno“), nebo **Dříve vyslovené přání (living will)** – pak zatrhnete, co si pacient nepřeje (KPR, ventilace, hospitalizace…), datum DVP, kde je originál a jak bylo ověřeno. Plány uložené dřív zůstávají, jak byly, dokud lékař neuloží novou verzi.
- **Kontakty** a **Garant a tým**: kdo rozhoduje, koho informovat, kdo pečuje; které pracoviště je garantem a která jsou v týmu.
- Vpravo je panel, co ze souboru bylo převzato a co je potřeba zkontrolovat.

Tlačítkem **Uložit** vznikne pacient s kódem `P-xxxx` a první verze plánu a otevře se jeho průkaz – pak telefon spárujte (kapitola 8). Tlačítko **Uložit a další** průkaz založí a hned otevře prázdný formulář pro dalšího pacienta (garant a tým zůstanou předvybrané) – hodí se při ručním zápisu více pacientů najednou.

## 5. Krizová karta a plán péče

### Diagnóza – první záložka

Záložky detailu jdou v pořadí **Krizová karta, Diagnóza, Plán péče, Léky, Deník, …**. Záložka **Diagnóza** ukazuje diagnózy, obvyklý funkční stav a alergie. Lékař je vpravo může upravit (**Uložit** vytvoří novou verzi plánu péče s jeho podpisem).

**Odkud údaj je** (od 0.11.123): pod každou diagnózou, funkčním stavem a alergiemi je štítek původu – modrý **ze zprávy „název dokumentu“** (doplněno rozborem zprávy, viz kap. 9), **z propouštěcí zprávy při založení**, zelený **zapsáno v PéčeDoma** / **z PéčeDoma při založení**, nebo šedý **zapsáno ručně**, vždy s verzí plánu, časem a kdo ho uložil. Karta to pozná z historie verzí plánu, takže platí i pro dřívější údaje. Když diagnózu ze zprávy později ručně upravíte (třeba C50.9 → C50), štítek se změní na *zapsáno ručně*.

![Detail pacienta – Diagnóza](/napoveda/img/c-dg.png)

### Léky – jedna agenda

Záložka **Léky** je jediné místo, kde se léky vedou. U pacienta **propojeného s PéčeDoma** jsou léky jedny pro portál i Kartu: Karta je čte přímo z PéčeDoma (Data klienta → Léky) a tým je tady může i měnit – **Přidat lék**, **Upravit**, **Vyřadit** (lék se v PéčeDoma zneaktivní, historie zůstává). Totéž hned vidí sestry v PéčeDoma, krizová karta a telefon u pacienta (při nejbližší synchronizaci). U pacienta bez propojení jsou léky součástí plánu péče a mění je lékař (**Uložit** = nová verze plánu).

Léky jsou ve čtyřech skupinách stejně jako v PéčeDoma: **SOS léky** (záchranné), **Opioidy** (silná analgetika podávaná pravidelně – morfin, fentanyl, buprenorfin, oxykodon…), **Paliativní terapie** (ostatní léky paliativní péče – chronická terapie se od 0.11.92 nezadává) a **Parenterálně** (injekce a infuze sestry). Na krizové kartě je dlaždice **Medikace** vždy s **opioidy** a **SOS medikací**; **paliativní terapii** ukáže jen tehdy, když je u pacienta zatržené **Na krizové kartě ukazovat i paliativní terapii** (záložka Léky nebo plán péče – uložení je nová verze plánu). Skupinu vybíráte v poli **Typ** při přidání nebo úpravě léku; opioidy jsou v krizové kartě zvlášť pod SOS léky, aby je posádka ZZS i lékař viděli na první pohled.

**Název léku ze seznamu SÚKL** (od 0.11.124): při přidání nebo úpravě léku stačí začít psát název – nabídnou se léky ze seznamu léčiv SÚKL (stejná databáze, jakou používá Průkaz pacienta; obnovuje se jednou měsíčně z otevřených dat SÚKL). Po výběru je pod polem *✓ v seznamu SÚKL (kód …)*; dávkování dopíšete. Lék, který v seznamu není, jde napsat i vlastním textem.

**Našeptávač SÚKL v polích léků** (od 0.11.136, jako v Průkazu pacienta): všude, kde se léky píšou textem (řádek = lék) – v **Upravit léky** u pacienta ambulance a ve **3. kroku Nového pacienta** (Parenterálně, SOS léky, Opioidy, Paliativní terapie) – stačí na novém řádku začít psát název. Od třetího písmena se pod polem nabídnou léky ze seznamu SÚKL; vyberete klepnutím, nebo šipkami a **Enter** (**Esc** nabídku zavře). Rozepsaný řádek se nahradí názvem a silou léku a za něj dopíšete dávkování (např. *1 tbl při bolesti, nejvýš po 6 h*). Během psaní dávkování ani na řádku s lékem už vybraným se nic nenabízí.

**Pacient ambulance (bez PéčeDoma)** – od 0.11.131 má záložka Léky stejné barevné skupiny jako u PéčeDoma, jen v pořadí **Parenterálně, SOS léky, Opioidy, Paliativní terapie**. Léky se zapisují textem vpravo v **Upravit léky** (řádek = lék; při psaní názvu se nabízí seznam SÚKL, viz výše); **Uložit** vytvoří novou verzi plánu péče. V hlavičce pacienta je zelený štítek **Ambulance**. Do **Průkazu pacienta** jdou od 0.11.132 všechny čtyři skupiny včetně **Parenterálně** (v Průkazu pacienta od verze 0.26.1; změna parenterálních léků nabídne pacientovi aktualizaci jako každá jiná změna). Na krizové kartě zůstávají SOS léky a opioidy, paliativní terapie podle zaškrtnutí. U pacienta propojeného s PéčeDoma se parenterální léky do Průkazu zatím nepřenášejí.

![Léky pacienta ambulance – stejné skupiny, zápis textem](/napoveda/img/c-leky-ambulance.png)

U každého léku je také štítek původu: u propojeného pacienta **zapsáno ručně v Kartě** (kdo a kdy lék v Kartě přidal nebo naposledy upravil) nebo **zapsáno v PéčeDoma** (lék zapsaný v portálu, s datem platnosti od); u nepropojeného pacienta stejně jako u diagnóz – **ze zprávy**, **zapsáno ručně** atd.

**Ověřeno zprávou** (od 0.11.125): když lék, který někdo zapsal ručně nebo v PéčeDoma, potvrdí rozbor zprávy, přibude k němu zelený štítek **ověřeno zprávou „název dokumentu“** s časem a jménem toho, kdo rozbor uložil – původní štítek (kdo lék zapsal) zůstává. U propojeného pacienta je v záložce Léky vpravo panel **Ověřit podle zprávy** s tlačítkem **Rozebrat** u každé uložené zprávy (PDF, sken, fotka): otevře stejné okno jako v Dokumentech; v části *Léky do PéčeDoma* nechte zaškrtnuté řádky *v PéčeDoma stejně* a uložte.

![Léky – jedna agenda s PéčeDoma](/napoveda/img/c-leky.png)

![Přidání léku z Karty do PéčeDoma](/napoveda/img/c-leky-pridat.png)

### Krizová karta

Vpravo pod telefonem u pacienta je panel **Výjezdy záchranné služby** – posledních 10 zápisů posádek (nejnovější nahoře), starší jsou v Deníku. Stejné zápisy vidí posádka na zamčené kartě.

V detailu pacienta jsou vysvětlující poznámky sbalené na konci každé záložky v bloku **ⓘ Vysvětlivky** (rozbalí se klepnutím), aby záložky ukazovaly jen údaje a tlačítka.

![Detail pacienta – krizová karta](/napoveda/img/c-karta.png)

Záložka **Krizová karta** ukazuje přesně to, co vidí posádka ZZS na telefonu bez přihlášení: nahoře **diagnózu** (ke kódům diagnóz se doplní **popis z číselníku** – např. C50 – Zhoubný novotvar prsu) a funkční stav, pak limitace péče (KPR neuvedeno, nebo dříve vyslovené přání s tím, co si pacient nepřeje) a cíl péče, dlaždice **Alergie**, dlaždice **Medikace** (opioidy, SOS medikace a případně paliativní terapie), koho volat a kontakty.

**📱 Náhled v telefonu / Živý náhled karty** (od 0.11.92; tlačítko u Krizové karty, v plánu péče, v Diagnóze i v Lécích) otevře v pravém sloupci telefon (v rámečku iPhonu, při posouvání stránky zůstává nahoře) s kartou přesně tak, jak ji vidí telefon u lůžka. Při úpravě plánu, diagnóz, limitací a léků se náhled **mění hned při psaní**, ještě před uložením. Tlačítky **Jako: zamčeno / ZZS, rodina, sestra, lékař** přepnete, jak kartu vidí záchranka bez přihlášení nebo kdo ji odemkl PINem; v telefonu jde i odemknout tlačítky na kartě (PIN se v náhledu neověřuje) a vyzkoušet zápisy – **náhled nic nezapisuje ani neodesílá**.

![Živý náhled karty v telefonu vedle plánu péče](/napoveda/img/c-nahled-karty.png) Limitace je pro posádku závazná jen s doloženým dříve vysloveným přáním nebo rozhodnutím lékaře – karta proto vždy uvádí doklad.

Tlačítka: **Potvrdit revizi plánu** (lékař), **Výpis do dokumentace** (text celého průkazu pro zdravotnickou dokumentaci, ke zkopírování nebo stažení), **Tisk karty**. Panel **Telefon u pacienta** ukáže číslo připojeného telefonu s kartou týmu (klepnutím se volá), poslední spojení, baterii a jestli má telefon aktuální verzi plánu; stejné číslo je i v hlavičce detailu („karta týmu: +420 …“) a ve sloupci Telefon v přehledu pacientů (od 0.11.59).

Příští návštěva se od verze 0.11.92 na kartě ani v centrále **neukazuje** – při změnách v programu sester se na ni pacienti nemohli spolehnout. Vedle karty je panel **PéčeDoma** s posledními dvěma zprávami a tlačítkem **💬 Chat PéčeDoma s klientem**: stejné vlákno zpráv jako v PéčeDoma (Data klienta → Zprávy) – klient ho vidí ve své aplikaci PéčeDoma, rodina a tým v telefonu s kartou. Píšete jako Tým PéčeDoma se značkou [Karta · vaše jméno]; zprávy označené SMS odešly z PéčeDoma i textovou zprávou.

![Chat PéčeDoma s klientem z Karty pacienta](/napoveda/img/c-chat-pecedoma.png)

Panel **Od pacienta** ukazuje, co pacient dříve poslal z aplikace Můj průkaz (zrušená v 0.11.111) – hodnoty a přání, poznámky a otázky, záznam podání léků. Nové záznamy už nepřibývají: Průkaz pacienta do Karty nic neposílá. U každé položky je původ a datum aktualizace. Jsou to údaje pacienta, ne lékařský záznam.

![Panel Od pacienta v záložce Krizová karta](/napoveda/img/c-od-pacienta.png)

### Plán péče

![Plán péče s verzemi](/napoveda/img/c-plan.png)

- Plán upravuje jen **lékař** pracoviště, které je garant nebo lékař v týmu. Ostatní ho vidí jen ke čtení. Plán péče obsahuje cíl péče, limitace a doklad; diagnózy a léky mají vlastní záložky (**Diagnóza**, **Léky**), i když jsou technicky součástí verze plánu.
- **Uložit jako novou verzi** – každá změna je nová verze s podpisem lékaře, starší verze zůstávají (seznam **Verze plánu** vpravo, klik zobrazí starou verzi).
- **Platnost plánu do** – po datu platnosti se v přehledu i u pacienta objeví upozornění a lékař udělá **revizi**: potvrdí, že plán platí beze změny, a nastaví novou platnost. Výchozí interval revize nastavuje správce (kapitola 12).
- Sestra ani rodina cíl péče a limitace vyplnit nemohou.

**Doklad k limitacím.** Aplikace jen eviduje, jaký doklad existuje – vyplnění v aplikaci samo dříve vyslovené přání (DVP) nevytváří. U DVP vyplňte datum, kde je originál a:

- **Písemné poučení lékařem** a **Podpis pacienta – úředně ověřený**: když je obojí doloženo, karta ukáže zelené *poučení lékařem a ověřený podpis*; jinak žluté upozornění, ať posádka ověří originál.
- **DVP sepsané při přijetí u poskytovatele**: vyplňte jen tehdy, když bylo přání sepsáno při přijetí do péče nebo při hospitalizaci. Takové přání platí jen u tohoto poskytovatele – karta pro ZZS to tak i napíše.
- Bez DVP karta uvádí **rozhodnutí lékaře** a odkaz na zprávu nebo zápis o rozhovoru.

## 6. Deník a důležité kontakty

Deník je primárně o pacientovi: zápisy týmu, rodiny a záchranky. Systémové záznamy (spárování telefonu, propojení s PéčeDoma, změna čísla, úprava identifikačních údajů…) jsou sbalené na konci v bloku **Systémové záznamy** a rozbalí se klepnutím – v centrále i na telefonu.

### Deník

![Deník pacienta](/napoveda/img/c-denik.png)

- Do deníku zapisuje tým kolem pacienta (role péče, lékař, garant). Zápisy **Zhoršení stavu** (a Výjezd ZZS) jsou v seznamu červeně, **Stav stabilizován** zeleně, aby byly epizody zhoršení vidět na první pohled. U pacienta propojeného s PéčeDoma jde každé zhoršení i stabilizace automaticky také do portálu (Data klienta → 🪪 Z Karty pacienta, historie zhoršení). Vyberete **typ** (změna stavu, podán SOS lék, návštěva lékaře, návštěva hospice, telefonát, pozorování rodiny, zhoršení stavu, stav stabilizován) a napíšete text.
- **Návrat z nemocnice** (od 0.11.144, v centrále i na telefonu u pacienta – lékař, sestra, hospic, praktický lékař i rodina): po výběru typu se ukážou pole **Z které nemocnice / oddělení**, **Kdy se vrátil(a)**, **Kam** (domů, do domova pro seniory, do hospice, jinam), **Převoz** (dopravní zdravotní služba – sanitka, záchranná služba, rodina, jinak) a zatržítko **přivezl(a) propouštěcí zprávu**; text je pak jen poznámka. Zápis je v deníku zeleně a **uzavírá probíhající zhoršení** (stejně jako Stav stabilizován) – červený pruh na kartě i upozornění v přehledu zmizí. Odjezd do nemocnice zapisuje posádka ZZS jako **Výjezd ZZS → transport do nemocnice**. Propouštěcí zprávu pak nahrajte do Dokumentů a rozeberte (kapitola 22) – léky a diagnózy se doplní samy.
- Zápisy **nelze mazat ani měnit**, jen doplňovat.
- Zápisy z telefonu mají čas, kdy byly pořízeny, i když se odeslaly později. Zápis posádky ZZS je označený jako neověřený.

### Důležité kontakty

![Důležité kontakty pacienta](/napoveda/img/c-kontakty.png)

Záložka **Důležité kontakty** ukazuje jeden seznam **v pořadí, jak se kontakty zobrazují** v krizové kartě a na telefonu; vedle něj je formulář, takže při zapisování nového kontaktu vidíte, kdo už tam je. Každý kontakt má skupinu, jméno a vztah, telefon a poznámku (např. „volat jako první“). Tři skupiny: **Rozhoduje** (zástupce, opatrovník, určená osoba – tuto skupinu přiděluje jen lékař na základě dokladu), **Informovat** (rodina a blízcí) a **Pečuje** (hospic, lékaři, nemocnice).

- **Přidat kontakt** zařadí nový kontakt na konec seznamu; šipkami **↑ ↓** u řádku pořadí změníte (přeřazení se nezapisuje do deníku).
- **Upravit** načte kontakt do formuláře vpravo (řádek se podbarví), **Uložit změny** ho přepíše, **Zrušit** úpravu opustí. **Odebrat** kontakt skryje, v databázi zůstává.

![Úprava kontaktu přímo ve formuláři vedle seznamu](/napoveda/img/c-kontakty-upravit.png)

#### Výchozí kontakty organizace (od 0.11.75)

![Výchozí kontakty organizace – u klienta se jen zatrhnou](/napoveda/img/c-kontakty-vychozi.png)

Kontakty, které má mít většina klientů (např. **Linka paliativní podpory**, **Sloužící sestra**, **Ambulance**), se nezapisují ke každému klientovi zvlášť. Jsou jednou pro celou organizaci v panelu **Výchozí kontakty organizace** pod formulářem a u klienta se jen **zatrhnou**.

- **Zatržení** kontakt přidá k tomuto klientovi (na konec seznamu, šipkami ho pak posunete), **odškrtnutí** nebo **Odebrat** u řádku ho odebere jen u tohoto klienta. U výchozího kontaktu v seznamu je štítek **výchozí**; u sady je napsáno, u kolika klientů se používá.
- **Úprava**: u kteréhokoli klienta klikněte u výchozího kontaktu na **Upravit**, opravte např. telefon a **Uložit u všech klientů** – změna se propíše **všem klientům, kteří ho mají zatržený**, do jejich krizových karet, telefonů (při další synchronizaci) i deníku.
- **Nový výchozí kontakt**: při přidání kontaktu zaškrtněte **Uložit jako výchozí kontakt organizace**, nebo u existujícího kontaktu klienta klikněte na **Upravit** a pak **Udělat výchozím kontaktem organizace** – kontakt zůstane u klienta a půjde zatrhnout u dalších.
- **Zrušit** u sady výchozí kontakt odebere **všem** klientům (aplikace se předem zeptá a uvede počet).
- Výchozí kontakty zakládá, upravuje a ruší **správce organizace a lékař**; zatrhnout nebo odebrat je u klienta smí celý tým. Mohou být jen ve skupině **Pečuje** nebo **Informovat** – **Rozhoduje** je vždy konkrétní osoba u konkrétního pacienta.

- Krizová karta v oddílu KOHO VOLAT bere **Nejdřív volat** ze skupiny Pečuje (přednostně hospic), pak lékaře plánu (odborného zástupce pracoviště garanta, je-li vyplněný) a potom **všechny ostatní kontakty** v pořadí ze seznamu (Rozhoduje první) se štítkem skupiny a poznámkou. Každé číslo je na telefonu v rámečku na samostatném řádku s ikonou sluchátka – klepnutím se rovnou volá (stejně v dlaždicích Kontakty a Tým i v Mém průkazu). Kontakty upravuje celý tým kolem pacienta.

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

### Týmy u pacienta

Panel **Týmy u pacienta** (nahoře v záložce Tým a garance) říká, **kdo z lidí** kartu u tohoto pacienta odemkne. Lidé se k pacientovi nepřidávají jednotlivě – vybere se **celý tým** založený v agendě Lidé a týmy (kapitola 11):

1. V poli **Přidat tým** vyberte tým (u názvu je, kdo ho založil, a počet členů) a klikněte na **Přidat tým**. Pracoviště členů, která ještě nejsou v týmu kolem pacienta (např. domov seniorů sestry z týmu), tím garant zároveň přidá s rolí péče – nabídka to u týmu uvádí.
2. Členové týmu se vypíší pod názvem týmu. Kdo z nich u tohoto pacienta kartu odemykat nemá, toho **deaktivujete** (řádek zešedne, stav „deaktivován u pacienta“); **Aktivovat** ho vrátí. Nikoho tu přidat nejde – nového člověka zapíšete do týmu v agendě Lidé a týmy a u všech pacientů s tímto týmem dostane přístup sám.
3. **Odebrat tým** – členové týmu už kartu neodemknou (při nejbližší synchronizaci telefonu).

Týmy u pacienta vybírá garant nebo lékař v týmu pro všechna pracoviště; ostatní členové týmu jen týmy svého pracoviště.

## 8. Telefon a PINy

![Telefon u pacienta a PINy pro pečující](/napoveda/img/c-telefon.png)

**Videohovor na telefon** (záložka Krizová karta, od 0.11.45): tlačítko rozezvoní telefony pacienta s kartou u lůžka, i zamčené (od 0.11.55; stačí, aby byla aplikace na obrazovce) – a hovor se otevře v okně přímo v centrále (povolte fotoaparát a mikrofon). **Zavřít okno** nechá hovor běžet na pozadí (znovu ho otevřete tlačítkem Připojit se), **Ukončit hovor** ho ukončí i pro telefon – stejně jako zavěšení červeným sluchátkem uvnitř hovoru. U probíhajícího hovoru je i **Zavolat na telefon znovu** (starý hovor ukončí a telefon rozezvoní). Když naopak zavolá rodina nebo sestra z telefonu, u pacienta se objeví červený pruh *Z telefonu u pacienta volá…* s tlačítkem **Připojit se** a v přehledu pacientů upozornění; zvonící nebo probíhající hovor je vidět **v každé agendě** jako pruh pod hlavičkou (s tlačítky Připojit se, Odmítnout a Otevřít pacienta) a centrála na něj zazvoní; stav se obnovuje každých 15 sekund. Funguje jen s nastaveným serverem videohovorů (správce, `KP_JITSI_URL`).

![Centrála – z telefonu u pacienta volá sestra](/napoveda/img/c-video.png)

![Centrála – zvonící hovor je vidět v každé agendě](/napoveda/img/c-video-pruh.png)

V panelu **Lidé, kteří odemknou kartu** je u každého člověka tlačítko **Zobrazit PIN** – ukáže jeho platný osobní PIN (zapíše se do logu přístupů); u PINu vydaného před verzí 0.11.6 nabídne vydání nového.

### Spárování telefonu

Karta pacienta je vždy jen v jednom telefonu – s číslem uvedeným u pacienta (pole **Telefon s kartou** v Detailu pacienta). Jeden telefon ale může nést průkazy **více pacientů** (typicky domov seniorů s jedním telefonem na oddělení): u každého pacienta uvedete stejné číslo a telefon spárujete pro každého zvlášť; okno Spárovat telefon ukáže, čí průkazy už na tom čísle jsou. Párovat smí garant nebo lékař v týmu.

1. Klikněte na **Poslat odkaz SMS na +420…** – pacientovi přijde SMS s odkazem, nebo na **Spárovat telefon** – otevře se okno s QR kódem a kódy.
2. Na telefonu otevřete odkaz z SMS, nebo v aplikaci karty klepněte na **Načíst QR kód fotoaparátem** a namiřte na obrazovku (kapitola 13).
3. Telefon zadá **své číslo**. Server kartu nahraje jen tehdy, když se číslo shoduje s číslem u pacienta; jiné číslo odmítne.

![Okno Spárovat telefon – QR kód, kódy a SMS](/napoveda/img/c-parovani.png)

**Párování v terénu (vytištěné):** v okně Spárovat telefon zvolte **Platnost kódu** (30 minut, 24 hodin, 3 dny nebo 7 dní) a stiskněte **🖨 Vytisknout párování**. Vytiskne se A4 s logem, jménem pacienta a kódem průkazu, **číslem telefonu**, do kterého karta smí, velkým **QR kódem**, kódem organizace a párovacím kódem pro ruční zadání, datem platnosti a postupem pro sestru (zapnout telefon, naskenovat QR kód nebo v kiosku Přidat dalšího pacienta, potvrdit číslo, Spárovat). Sestra pak spáruje telefon u pacienta bez centrální aplikace. Kód funguje jen v telefonu s uvedeným číslem; po spárování list **skartujte**. Delší platnost se zapíše do logu přístupů; odeslaná SMS uvádí, do kdy odkaz platí.

![Vytištěné párování telefonu – QR kód a postup pro sestru](/napoveda/img/c-parovani-tisk.png)

- Párovací kód platí **30 minut**. Dokud platí ještě aspoň 10 minut, ukáže další kliknutí na Spárovat telefon i Poslat odkaz SMS **tentýž kód** – QR kód na obrazovce a odkaz v SMS jsou stejné a nové kliknutí předchozí kód neruší. Po celou dobu platnosti ho jde použít znovu **ve stejném telefonu** (stejné číslo) – typicky když kartu po spárování v Safari přidáte na plochu iPhonu: aplikace na ploše má vlastní úložiště, spárujte ji stejným kódem a kopie v Safari skončí. Jiné číslo kód nepřijme. Po vypršení klikněte znovu na Spárovat telefon.
- Po spárování se případný předchozí telefon pacienta zablokuje.
- Když SMS nejde odeslat, okno napíše proč a spárujete QR kódem.
- **Zablokovat** – ztracený telefon; při nejbližším připojení se data z něj vymažou. **Vráceno** – zablokovaný telefon, který se vrátil.
- Změna čísla v Detailu pacienta zablokuje telefon na předchozím čísle.

### Štítek na telefon

Tlačítko **🏷 Štítek na telefon** (u pacienta v záložce Telefon a PINy) nebo **🏷 Štítky na telefony** (v přehledu Pacienti, pro víc pacientů najednou) vytiskne samolepky na zadní stranu zapůjčeného telefonu. Na štítku je **komu telefon patří** (garant pacienta, např. Centrum pro léčbu bolesti; jde přepsat jedním textem pro všechny), **jméno pacienta a kód průkazu** (lze vypnout) a velkým písmem **kam volat** při nálezu nebo potížích (telefon 24/7 garanta, jinak zadané číslo). Formát: samolepky **70 × 70 mm, 3 vedle sebe a 4 pod sebou na archu A4** (12 kusů). V okně vyberete pacienty (předvybraní jsou ti s telefonem), počet štítků na pacienta a **první volný štítek** na načatém archu; tiskněte v měřítku 100 %.

**Štítek pro telefon s více pacienty** (tlačítko ve stejném okně): jeden štítek **na telefon**, ne na pacienta, a **bez jmen pacientů a kódů průkazů** – hodí se pro telefon v domově pro seniory, který nese průkazy několika pacientů. Telefony se seskupí podle čísla telefonu s kartou; předzatržené jsou ty s více průkazy. U každého vyplníte **Zapůjčeno komu** (předvyplní se místem pacientů, je-li u všech stejné, např. DS C – doplňte oddělení nebo domov) a **datum zápůjčky** (předvyplní se dnem prvního spárování průkazu v telefonu). Na štítku je komu telefon patří, komu je zapůjčený a od kdy, v rámečku **číslo telefonu, na který se štítek lepí** (Tento telefon: …), a velkým písmem kam volat. Číslo telefonu s kartou je od verze 0.11.84 i na štítku pacienta.

![Štítek pro telefon s více pacienty – zapůjčeno komu a od kdy](/napoveda/img/c-stitky-telefon.png)

**Vzhled štítku** (od 0.11.102): štítek má rozměr **70 × 70 mm** (3 × 4 = 12 štítků na arch A4, tisk v měřítku 100 % bez přizpůsobení stránce) a je v **modrém rámečku**. Nahoře je **logo hospice** – výchozí je logo **Most k domovu**, tlačítkem **Nahrát logo** dáte jiné (PNG nebo JPG). Dole je na každém štítku věta **„Tento telefon i jeho provoz hradí …“** – do pole **Kdo telefon a jeho provoz hradí** napíšete jen název (prázdné = komu telefon patří); vedle může být **logo firmy** (Nahrát logo firmy). Písmo se při tisku samo zmenší, aby se vešel i dlouhý název, a rámeček je odsazený od kraje, aby ho tiskárna neořízla. Vzhled je v okně štítků v panelu **Vzhled štítku** a uloží se **pro celou organizaci** – příště se předvyplní. **Výška záhlaví v mm** (od 0.11.143): volné místo nahoře na archu – o tolik se posune první řádek štítků (a s ním všechny). Výchozí je 8,5 mm; když tisk na vaší tiskárně sedí moc vysoko nebo nízko, zvětšete či zmenšete ji (0–17 mm). Uloží se pro celou organizaci spolu s logem a textem.

![Vzhled štítku – logo hospice, text a logo firmy](/napoveda/img/c-stitky-vzhled.png)

![Vytištěný štítek 70 × 70 mm – modrý rámeček, logo hospice, číslo telefonu a text s logem firmy](/napoveda/img/c-stitky-tisk.png)

### Kód lékaře

Tlačítko **Kód lékaře na dnešek** (jen lékař, když je telefon spárovaný) ukáže šestimístný kód pro lékaře, který k pacientovi není přiřazený (pohotovost, zástup). Kód platí **celý kalendářní den** a je pořád stejný – o půlnoci se změní. Lékař na místě ho zadá v telefonu tlačítkem **Lékař bez PINu** spolu se svým jménem; telefon ho ověří i bez signálu (přijme i včerejší kód) a odemknutí se zapíše se jménem. Stejný kód lékař najde i v **PéčeDoma** v Datech klienta (tlačítko 🪪 Kód lékaře na kartu). Každé zobrazení kódu je v logu přístupů.

### Linka paliativní podpory

Panel **📞 Linka paliativní podpory** v záložce Telefon a PINy ukazuje všechna čísla přidělená kartě – **telefon s kartou** (z Detailu pacienta), zapůjčené telefony a vlastní telefony pacienta a rodiny (Průkaz pacienta) – a u každého, zda je **registrován k lince** ambulance. Registrované číslo se na linku dovolá, neregistrované ne.

- **Aktivovat** zaregistruje číslo k lince, **Deaktivovat** registraci zruší (obojí s potvrzením). Mění lékař nebo garant, ostatní v týmu stav jen vidí.
- Registrace se zapisuje do **PéčeDoma** – je to stejný seznam, jaký ukazuje filtr 📞 Linka v Klientech a zelený pruh „registrován k lince ✓“ v Datech klienta. Číslo registrované už z PéčeDoma má poznámku „z PéčeDoma“.
- Každá změna se zapíše do deníku pacienta (Systém) a do logu přístupů.
- Linka je jen v PéčeDoma Centra LB; v organizaci napojené na PéčeDoma Plus je panel jen informativní.

### Lidé, kteří odemknou kartu

Lékaři, sestry, pečovatelé hospice i domova se **nezapisují ke každému pacientovi znovu**. Jsou jednou zapsaní v agendě **Lidé a týmy** (kapitola 11), rozdělení do týmů a mají osobní PIN. U pacienta se vybírá **celý tým** v záložce **Tým a garance → Týmy u pacienta** (kapitola 7); panel **Lidé, kteří odemknou kartu** v záložce Telefon a PINy je jen přehled – ukazuje členy vybraných týmů, kteří nejsou u pacienta deaktivovaní. Co uvidí a zapíší, určuje jejich role (kapitola 10). Když pracoviště odejde z týmu kolem pacienta, jeho týmy a lidé ztratí přístup sami.

### Rodina a jednorázové PINy

Rodině vydejte PIN přímo u pacienta: **jméno držitele**, role **rodina** a **Vydat PIN**. Šestimístný PIN předejte držiteli; když ho zapomene, tlačítko **Zobrazit PIN** u jeho řádku ukáže platný PIN (u PINů vydaných od verze 0.11.31; zobrazení se zapisuje do logu přístupů) a **Nový PIN** vydá stejnému držiteli jiný – starý přestane platit při nejbližší synchronizaci telefonu. Stejně jde vydat jednorázový PIN i komukoli, kdo není v Lidech a týmech. **Zrušit** PIN zneplatní hned.

**Záchranná služba** žádný PIN ani seznam lidí nepotřebuje – krizovou kartu vidí bez přihlášení a jméno a posádku zapíše až u zápisu výjezdu.

### Předání do Průkazu pacienta (vlastní telefon pacienta a rodiny)

Pacient i jeho blízcí si údaje od lékaře zkopírují do vlastního telefonu v aplikaci **Průkaz pacienta** (kapitola 19), **do více telefonů najednou** (např. pacient, dcera, syn; nejvýš 6). Předává garant nebo lékař v týmu, v jednoduchém režimu (kapitola 21) i sestra:

1. V panelu **Průkaz pacienta v telefonu pacienta** klikněte na **Předat pacientovi do Průkazu** (nebo **Předat do dalšího telefonu**). V jednoduchém režimu je stejné tlačítko i na **Krizové kartě**.
2. Zadejte **mobil** a **komu** telefon patří (např. „dcera Jana“). Kód půjde použít jen s tímto číslem.
3. **Poslat SMS** – přijde odkaz na Průkaz pacienta a 6místné číslo; text SMS vidíte v okně a můžete ho upravit (`{odkaz}` = odkaz na Průkaz, `{cislo}` = 6místné číslo). Nebo **Zobrazit QR kód (v ordinaci)**.

![Předání do Průkazu pacienta](/napoveda/img/c-pacientovi.png)

- **6místné číslo** (od 0.11.110): okno ukazuje vedle QR kódu velké číslo (např. *730 194*). Pacient v Průkazu pacienta klepne na **Propojit s Kartou pacienta**, zadá číslo a své číslo telefonu – nic dlouhého se neopisuje. Číslo platí jen pro tento telefon, nejdéle 24 hodin (po aktualizaci serveru okno otevřete znovu).
- Po propojení si pacient **sám, na svůj pokyn** zkopíruje diagnózy, léky, alergie, kontakty a plán – zkontroluje je a uloží. Nic se nesynchronizuje samo a **z Průkazu se do Karty nic neposílá**. Deník týmu, PINy ani kód lékaře do jeho telefonu nechodí.
- **Přehled**: panel ukazuje každý telefon – komu patří, číslo, stav (**čeká** s platností kódu; **propojeno** s časem posledního načtení; **ukončeno**). U čekajícího **Poslat znovu** a **Zrušit**, u propojeného **Ukončit přístup** (další načtení z Karty už nepůjde; co si pacient zkopíroval, je jeho).
- Zapůjčený telefon pro krizi to nenahrazuje: vlastní telefon je zamčený a záchranka se do něj nedostane.
- **Obnovit v Průkazu** (od 0.11.114): u propojeného telefonu je vidět, zda má pacient v Průkazu **aktuální údaje**, nebo zda se údaje v Kartě od posledního předání **změnily** (nová verze plánu, léky, kontakty…). Tlačítko **Obnovit v Průkazu** pošle pacientovi výzvu – Průkaz pacienta mu ukáže upozornění a tlačítkem **Načíst z Karty pacienta** si stáhne aktuální stav; volitelně i SMS. Údaje neodcházejí samy, stáhne si je pacient. Výzva i načtení se zapíšou do historie předání.

![Obnovit údaje v Průkazu pacienta](/napoveda/img/c-obnovit-prukaz.png)

- **Historie předání** (od 0.11.112): pod seznamem telefonů je rozbalovací řádek **Historie předání** – klepnutím se rozbalí tabulka všeho, co se s předáním dělo: kdy byl vydán kód (QR, 6místné číslo), odeslána SMS, kdy pacient Průkaz propojil a **pokaždé, když si údaje do Průkazu načetl** (s verzí plánu), i ukončení přístupu. Kdo to udělal a pro který telefon. U propojení a každého načtení je řádek **Co bylo předáno** – klepnutím se ukáže přesně to, co odešlo do Průkazu: verze plánu, cíl péče, limitace a DVP, diagnózy, alergie, léky (SOS, opioidy, paliativní terapie – z PéčeDoma, nebo z plánu), kontakty, tým a garant (od 0.11.113; u dřívějších předání dovozeno z verze plánu platné v tu chvíli). Historie je jen pro doplňování – nejde upravit ani smazat.

  **Hledání v historii** (od 0.11.115): pole nad tabulkou hledá ve všem – datum (např. *16.11.2026*), telefon, kdo, co se stalo, i v tom, **co bylo předáno** (diagnóza, lék, alergie, kontakt). Víc slov = musí platit všechna, na diakritice a velkých písmenech nezáleží. Když slovo najde jen v obsahu předání, ten se u nalezeného řádku sám rozbalí.

![Hledání v historii předání](/napoveda/img/c-historie-hledani.png)

![Historie předání do Průkazu pacienta](/napoveda/img/c-historie-predani.png)

- Dřívější aplikace **Můj průkaz** (`/pacient/`) je od 0.11.111 zrušená; její odkaz otevře stránku s odkazem na Průkaz pacienta.

## 9. Detail pacienta, dokumenty a uzavření průkazu

V záložce **Detail pacienta** (dříve Údaje) jsou identifikační údaje pacienta: jméno, rodné číslo, datum narození, pojišťovna, adresa, kde pobývá, **telefon s kartou** a od verze 0.11.4 i **e-mail pacienta** (informativní údaj, do telefonu u lůžka se neposílá; při založení z PéčeDoma se převezme).

![Detail pacienta](/napoveda/img/c-udaje.png)

- **Detail pacienta**: identifikace pacienta a **Telefon s kartou**. Upravuje garant nebo lékař (**Uložit údaje**). Identifikační údaje (jméno, RČ, adresa) zůstávají jen v centrální aplikaci; telefon dostane jméno a rok narození, AI nedostane nic z toho.
- **Informace pacientovi** – lékař tlačítkem **Potvrdit podpis** zaznamená, že pacient / zástupce dostal informace a podepsal je.
- **PéčeDoma** (panel vpravo): zda je pacient propojený s klientem PéčeDoma, kdy proběhla synchronizace, tlačítka **Otevřít PéčeDoma** (odkaz z nastavení), **Synchronizovat teď**, **Propojit s klientem PéčeDoma** / **Odpojit** (lékař nebo garant). Z PéčeDoma se přebírají **aktivní léky** (záložka Léky – jedna agenda pro portál i Kartu) a **nejbližší plánovaná návštěva**; automaticky každých 30 minut, pokud to správce zapnul. Tlačítko **💬 Chat PéčeDoma s klientem** otevře zprávy portálu (kapitola 5). Přání, poznámky a otázky, které pacient dříve poslal z Mého průkazu (zrušeného v 0.11.111), Karta u propojeného pacienta předala i do PéčeDoma (Data klienta → **🪪 Z Karty pacienta**), takže je lékař vidí i tam.
- **Propojení a odpojení nic nemaže** (od 0.11.142): při **Propojit s klientem PéčeDoma** se léky zapsané v Kartě (plán péče, např. u pacienta ambulance) doplní do PéčeDoma – jen ty, které tam ještě nejsou (porovnává se léčivo, takže *MATRIFEN* a *TTS fentanyl* se nezdvojí); léky, které už v PéčeDoma jsou, zůstávají. Pak se obě strany synchronizují a v deníku je seznam přenesených léků. Při **Odpojit** se naopak léky z PéčeDoma uloží do plánu péče v Kartě (nová verze) a v PéčeDoma zůstávají. U pacienta propojeného dřív ukáže záložka **Léky** žlutý panel *V Kartě jsou zapsané léky, které v PéčeDoma chybí* s tlačítkem **Doplnit do PéčeDoma**; lék, který někdo v PéčeDoma vyřadil, se znovu nenabízí.
- **Diagnózy obousměrně s PéčeDoma** (od 0.11.143, PéčeDoma 3.37): diagnózy v plánu péče a v PéčeDoma (Data klienta → Diagnóza a Info) se při každé synchronizaci sloučí – při propojení, tlačítkem Synchronizovat teď, automaticky každých 30 minut a hned po uložení plánu nebo diagnózy v Kartě. Řádek = jedna diagnóza; řádky se stejným kódem MKN (např. *C61 …*) jsou stejná diagnóza a nezdvojí se. Při prvním propojení se oba texty jen sjednotí, nic se nemaže. Potom co přibude nebo ubude na jedné straně, přibude či ubude i na druhé; změnu z PéčeDoma uloží Karta jako novou verzi plánu podepsanou *PéčeDoma: jméno* (štítek původu *z PéčeDoma*), změnu z Karty poznáte v PéčeDoma podle *Karta pacienta: jméno* u Upravil. Úplně vymazaný text na jedné straně se za smazání všech diagnóz nepovažuje.
- **Dokumenty**: dříve vyslovené přání, lékařské zprávy, informace pacientovi a jiné (PDF nebo foto do 8 MB). U každého **datum dokumentu**, **pracoviště, které ho vydalo**, a kde je originál – aby byl vždy znát původ. Vkládá garant nebo lékař, klik na dokument ho otevře.

![Dokumenty s datem a pracovištěm](/napoveda/img/c-dokumenty.png)
- **Přístupy** (garant a správce): kdo a kdy průkaz zobrazil nebo měnil. Nahoře je počet záznamů a od kdy log sahá; **Načíst starší** přidá dalších 100, pole **Hledat v celém logu** prohledá všechny záznamy pacienta (jméno, akce, lék, datum – např. *16. 11.* nebo *2026-11-16*) a **Skrýt pouhá zobrazení** schová řádky *zobrazení průkazu* a *chat zobrazen*, aby byly vidět změny.

![Deník přístupů – hledání a Načíst starší](/napoveda/img/c-pristupy.png)

- **Uzavřít průkaz** (garant): vyberete důvod (úmrtí, předání mimo síť, hospitalizace, na přání pacienta, jiný). Telefon se při příštím připojení vymaže a PINy přestanou platit. Předtím si pořiďte **výpis do dokumentace**.


### Zprávy pro pacienta do Průkazu (od 0.11.118)

Zprávu pacienta (např. z **Medistaru** uloženou jako PDF) můžete předat pacientovi do aplikace Průkaz pacienta:

1. U pacienta otevřete záložku **Dokumenty** a soubor **přetáhněte myší na seznam dokumentů**, nebo ve formuláři Vložit dokument klikněte na **Vybrat soubor z počítače…** a vyberte ho ve složce. Vybraný soubor se ukáže v zeleném rámečku (název, typ, velikost; **Vybrat jiný** / **Odebrat**). Vyplní se název podle souboru a dnešní datum, PDF se nastaví jako *lékařská zpráva*.
2. Nechte zaškrtnuté **Předat pacientovi do Průkazu pacienta** (u zprávy je zaškrtnuté samo) a klikněte **Vložit**. Předat jde PDF, JPEG nebo PNG do 8 MB.
3. Pacient s propojeným Průkazem uvidí „Lékař aktualizoval vaše údaje“, tlačítkem **Načíst z Karty pacienta** si zprávu stáhne a Průkaz z ní nabídne diagnózy a léky ke kontrole.

**Rozbor zprávy a doplnění údajů** (od 0.11.120): u zprávy v PDF (např. z Medistaru) nebo fotky zprávy nechte zaškrtnuté **Rozebrat zprávu (AI) a doplnit údaje pacienta** (u zprávy je zaškrtnuté samo), nebo u uloženého dokumentu klikněte **Rozebrat (AI)**. Karta přečte text z PDF, odstraní z něj identitu pacienta (jméno, rodné číslo, datum narození, adresu, telefony, jména blízkých) a nechá ho rozebrat AI (bez zapnuté AI na serveru jen lokálním rozborem). Ukáže **Doplnit údaje ze zprávy**: u diagnóz, alergií, funkčního stavu a léků vidíte, co je v Kartě teď a co bude po doplnění – nové diagnózy (podle kódu MKN) a léky se přidají k dosavadním, text jde upravit a každou část zaškrtnout nebo vynechat. **Uložit jako novou verzi plánu** (lékař, v jednoduchém režimu i sestra) – předchozí verze zůstává v historii a pacientovi se v Průkazu ukáže, že jsou nové údaje. U pacienta propojeného s PéčeDoma (od 0.11.124) jsou v okně **Léky do PéčeDoma**: každý lék ze zprávy je porovnaný s léky v PéčeDoma – **nový** (přidá se), **v PéčeDoma stejně** (jen se označí štítkem *ze zprávy*), **v jiné skupině** (např. opioid zapsaný jako paliativní terapie – přesune se) nebo **s jinou dávkou** (přepíše se jen, když ho zaškrtnete). Skupinu, název i dávkování jde před uložením upravit. Léky se zapíšou rovnou do PéčeDoma (Data klienta → Léky) a v Kartě dostanou štítek **ze zprávy „název dokumentu“**; zapsat je může i sestra z týmu. Od 0.11.122 jde rozebrat i PDF bez textové vrstvy – dekurz z Medistaru vytištěný přes **Microsoft Print to PDF**, sken – a fotka zprávy (JPG, PNG): server text nejdřív **rozpozná z obrázku** (OCR, asi 3–4 s na stranu, nejvýš 8 stran) přímo u sebe, nic se nikam neposílá. V návrhu je pak poznámka *text rozpoznán z obrázku* – čísla a dávky zkontrolujte zvlášť pečlivě. Z dekurzu Medistaru Karta převezme diagnózy (Dg. i Diagnóza slovy), opioidy (Opioidy, Analgetická terapie), léky z Chronické terapie, SOS medikaci a funkční stav z PPS (Pohyblivost, Soběstačnost).

![Doplnit údaje ze zprávy](/napoveda/img/c-rozbor-zpravy.png)

![Léky ze zprávy do PéčeDoma](/napoveda/img/c-rozbor-leky.png)

U dokumentu je štítek **pro pacienta** a po stažení **v Průkazu od …**. Předání jde u každého dokumentu se souborem zapnout (**Předat pacientovi**) i zrušit (**Zrušit předání** – co si pacient už stáhl, zůstává jeho). Starší dokumenty se pacientovi samy neposílají. Dokumenty vkládá kdokoli z týmu, kdo zapisuje (i sestra). Stažení se zapíše do historie předání (kapitola 8) i do logu přístupů.

![Zpráva předaná pacientovi do Průkazu](/napoveda/img/c-dokument-pro-pacienta.png)
## 10. Role na kartě – kdo co vidí a zapisuje

Role jsou stejné jako v ukázkové verzi. Každý po odemknutí karty vidí nahoře, kdo je přihlášený a co jeho role smí, a nabídnou se mu jen jeho typy zápisů.

| Role | Jak se dostane ke kartě | Co vidí | Co zapisuje do deníku |
|---|---|---|---|
| Lékař a spec. sestra | osobní PIN (Lidé a týmy) nebo kód lékaře dne | celý záznam | návštěva lékaře, změna stavu, podán SOS lék, návštěva hospice, telefonát, zhoršení |
| Praktický lékař | osobní PIN nebo kód lékaře dne | celý záznam | návštěva lékaře, změna stavu, podán SOS lék, telefonát, zhoršení |
| Hospic | osobní PIN | celý záznam, je prvním kontaktem při zhoršení | návštěva hospice, změna stavu, podán SOS lék, návštěva lékaře, telefonát, zhoršení |
| Sestra DPS | osobní PIN | celý záznam | změna stavu, podán SOS lék, návštěva lékaře, telefonát, pozorování, zhoršení |
| Rodina | PIN od garanta u pacienta | karta, plán, léky, kontakty, poznámky pacienta – **bez Interních poznámek** | zhoršení a stabilizace (průvodce v dlaždici Zhoršení) |
| ZZS | bez PINu | jen krizovou kartu | jen výjezd – jméno a posádku zapíše až u výjezdu |

![Telefon – po odemknutí je vidět jméno, role a co role smí](/napoveda/img/k-odemceno.png)

- **Plán péče** (cíl péče, limitace, léky) mění jen lékař v centrální aplikaci. Telefon ho všem rolím jen zobrazuje.
- Typy zápisů hlídá i server: zápis, který role nesmí, se do deníku nepřijme.
- Role člověka nastavíte v agendě Lidé a týmy (kapitola 11), roli rodinného PINu při jeho vydání (kapitola 8).

## 11. Lidé a týmy

Menu **Lidé a týmy** (všichni kromě role jen čtení). Každé pracoviště – garant i partneři, např. domov pro seniory nebo praktický lékař – si tu své lidi zapíše **jednou** a rozdělí je do týmů. Správce organizace spravuje lidi všech pracovišť, ostatní lidi svého pracoviště.

![Lidé a týmy – lidé pracovišť po týmech](/napoveda/img/c-lide.png)

### Týmy

Nahoře je přehled **Týmů**: název, popis, které pracoviště ho založilo (zpravidla garant), počet členů a u kolika aktivních pacientů tým je. **+ Tým** založí nový tým: pracoviště, kterému tým patří, název (např. „Tým Zlín“, „Oddělení A“), popis a **členové** – zaškrtnete lidi **kteréhokoli pracoviště organizace**, tedy i třetích stran: sestru domova, praktického lékaře, pečovatelku agentury. Člověk může být ve více týmech. **Upravit** u týmu mění název, popis, členy a zaškrtnutí **aktivní**; zrušený tým už k pacientovi nejde přidat a jeho členové u pacientů kartu neodemknou. **Vytisknout kartičky s PINem** (v okně Upravit) ukáže platné osobní PINy všech aktivních členů týmu a vytiskne je jako kartičky – pro každého člena jednu, se jménem, rolí, pracovištěm a názvem týmu; členům, jejichž PIN byl vydán před verzí 0.11.6 (nejde znovu zobrazit), aplikace nabídne vydat nový. Každý tisk se zapíše do logu přístupů. **Smazat tým** (v okně Upravit) tým odstraní úplně – zmizí z přehledu i z nabídky u pacientů, u pacientů, kde byl přidělený, ztratí jeho členové přístup (kdo je tam i přes jiný tým, zůstane); lidé zůstávají zapsaní a tým jde založit znovu. Tým u konkrétního pacienta odeberete a znovu přidáte v záložce Tým a garance → Týmy u pacienta.

![Tým a jeho členové](/napoveda/img/c-tym-okno.png)

**Telefony s kartou** v okně týmu (od 0.11.85): seznam zapůjčených telefonů s kartou – u každého číslo a **pacienti, jejichž průkaz je v telefonu** (jméno a kód průkazu; pacienty, které vaše pracoviště nevidí, jen počtem). Zatržený telefon přiřadí tým **všem pacientům v tomto telefonu** hned po uložení a **každému dalšímu pacientovi**, který se do telefonu spáruje (hodí se pro telefon na oddělení domova a tým sester domova – sestry pak kartu odemknou svým PINem u všech pacientů oddělení). Tým přiřazený přes telefon od pacienta **sám odejde**, když pacient v telefonu přestane být (nové číslo telefonu s kartou, zablokování nebo vrácení telefonu, odebrání průkazu z telefonu) nebo když telefon u týmu odtrhnete – do deníku se zapíše proč. Týmy přidané u pacienta ručně a týmy „přiřazen vždy“ se tím nemění. V seznamu týmů je u takového týmu štítek **📱 N telefonů**.

**🖨 Leták k telefonu** (tlačítko v řádku týmu se zatrženým telefonem, od 0.11.86) vytiskne leták A4 k položení vedle telefonu: logo, číslo telefonu, komu patří a kam volat při potížích, **k čemu telefon slouží**, **jak ho použít** (5 kroků), ukázku **vzorové krizové karty** v telefonu a **seznam pacientů, jejichž karta je v telefonu** (jméno, rok narození, kód průkazu – při víc než 12 pacientech ve dvou sloupcích; 20 pacientů se vejde na jednu stranu A4). Zdravotní údaje na letáku nejsou; pacienty mimo vaše pracoviště uvede jen počtem. Má-li tým víc telefonů, nejdřív vyberete, ke kterému. Když se pacienti v telefonu změní, vytiskněte leták znovu.

![Leták k telefonu oddělení se seznamem pacientů](/napoveda/img/c-letak-telefon.png)

Zatržítko **Přiřadit vždy** v okně týmu (od 0.11.66) tým automaticky přiřadí ke každé kartě pacienta, u kterého je pracoviště týmu **garantem** – ke všem stávajícím hned po uložení a ke každé nově založené (po předání garance jinam se u pacienta přiřadí týmy nového garanta); u pacienta ho pak nejde odebrat (místo tlačítka Odebrat tým je štítek *přiřazen vždy*), jen deaktivovat jednotlivé členy. Hodí se pro vlastní tým organizace, který má být u všech pacientů. Změna členů se hned promítne ke všem pacientům, kteří tým mají (kapitola 7, Týmy u pacienta): nový člen dostane přístup, odebraný ho ztratí; pracoviště nového člena se u těchto pacientů přidá do týmu kolem pacienta s rolí péče. Koho u konkrétního pacienta lékař deaktivoval, ten se změnou týmu nevrátí.

### Přidání člověka

**+ Člověk**: pracoviště, jméno, **role na kartě** (lékař a spec. sestra, praktický lékař, hospic, sestra DPS), telefon, e-mail. Po uložení se zobrazí **osobní PIN** – jen jednou. Když je zaškrtnuté **poslat osobní PIN SMS**, přijde mu PIN na telefon.

![Úprava člověka – role na kartě a nový PIN](/napoveda/img/c-osoba.png)

- Klik na řádek člověka ho upraví (okno **Upravit – člen týmu**). **Zobrazit PIN** znovu ukáže platný osobní PIN (každé zobrazení se zapíše do logu přístupů); PINy vydané před verzí 0.11.6 zobrazit nejdou – aplikace nabídne vydat nový. **Nový PIN** – dosavadní PIN přestane platit na všech telefonech.
- Zrušené zaškrtnutí **aktivní** člověka vyřadí: kartu už neodemkne u žádného pacienta (vyřazené ukáže zaškrtnutí **i vyřazení**).
- Sloupec **Pacientů** ukazuje, u kolika aktivních pacientů je člověk přiřazený.

### Načtení z PéčeDoma

**Načíst z PéčeDoma** nabídne uživatele portálu PéčeDoma vaší organizace (stejná databáze). Role se navrhne podle role v PéčeDoma a typu pracoviště (lékař → lékař, u praktika praktický lékař; sestra → hospic, v domově sestra DPS). Správci a monitor bez další role a lidé, kteří už načtení jsou, nejsou předvybraní. Před načtením jde u každého upravit roli a tým.

![Načtení týmu z PéčeDoma](/napoveda/img/c-lide-import.png)

**Aktualizovat z PéčeDoma** (tlačítko v liště pro vybrané pracoviště, nebo v okně člověka) převezme **telefon** a propojení podle uživatelů portálu PéčeDoma (párování přes identifikátor z PéčeDoma, jinak podle shodného jména). PéčeDoma e-mail nevede – ten vyplníte u člověka ručně. Osobní PIN se tím nemění: člověk má **jeden PIN pro všechny pacienty**, u kterých je v týmu. Výsledek ukáže, co se změnilo, kdo v PéčeDoma telefon nemá a koho se nepodařilo spárovat.

### Načtení ze souboru CSV

**Načíst CSV** – soubor z Excelu (uložit jako CSV, oddělovač středník nebo čárka, kódování UTF-8 i Windows-1250). Sloupce: **jméno; role; telefon; e-mail; tým** – první řádek může být záhlaví. Role stačí napsat slovy (lékař, praktický lékař, sestra, pečovatelka, hospic, sestra DPS). Tlačítko **Vzor CSV** stáhne ukázkový soubor.

Kdo už v pracovišti je (stejné jméno), se jen aktualizuje a PIN mu zůstane. Novým lidem se vydá osobní PIN.

### Osobní PINy

Tlačítko **Zobrazit PIN** je u člena všude, kde ho vidíte: v seznamu lidí (sloupec PIN; kdo PIN nemá, má tam **Vydat PIN**), v okně člověka, u pacienta v záložce Tým a garance → Týmy u pacienta i v Telefon a PINy → Lidé, kteří odemknou kartu. Každé zobrazení se zapíše do logu přístupů.

Po načtení se zobrazí seznam nových lidí s PINy. **Vytisknout kartičky** připraví kartičky k rozstříhání (jméno, role, PIN); nebo je pošlete SMS. PINy se zobrazují jen jednou.

![Vydané osobní PINy – tisk kartiček](/napoveda/img/c-piny.png)

K pacientovi lidi přiřadíte v detailu pacienta → **Telefon a PINy** → **+ Přiřadit lidi z týmů** (kapitola 8).

## 12. Správa organizace

Menu **Správa organizace** (jen správce) má záložky:

![Správa organizace – pracoviště](/napoveda/img/c-pracoviste.png)

- **Pracoviště**: **+ Pracoviště** – název, typ (nemocnice, hospic, ambulance, praktický lékař, domov, ZZS, jiný), telefon 24/7 (toto číslo je na krizové kartě u Lékaře plánu – osobní číslo lékaře se na kartu nikdy nedává), IČO / IČP, adresa a **Odborný zástupce** (od 0.11.87, jméno s titulem): u pacientů, jejichž garantem je pracoviště, ho krizová karta v oddílu Koho volat ukáže jako **Odborný zástupce** místo jména toho, kdo plán péče uložil (bez vyplnění zůstává jako dřív lékař plánu); v panelu Plán péče je pak **Odborný zástupce** a **Uložil** (kdo verzi plánu uložil – ten je dál i v historii verzí). Garantem může být jen nemocnice, hospic, ambulance nebo PL. Každý partner, který má s pacienty pracovat, musí být pracovištěm v této organizaci. Klik na řádek pracoviště upraví nebo vypne.
- **Uživatelé** (přihlášení do centrální aplikace – lidé s PINem pro telefon jsou v agendě Lidé a týmy): **+ Uživatel** – jméno, přihlašovací jméno, pracoviště, role (lékař, sestra, jen čtení, správce), telefon, e-mail, číslo ČLK. Po uložení se zobrazí **první heslo**, které uživateli předáte; dokud si ho nezmění, vidíte ho v seznamu. Tlačítko pro nové heslo slouží i při zapomenutém hesle.

![Správa organizace – uživatelé](/napoveda/img/c-uzivatele.png)

- **Telefony**: všechny telefony u pacientů – stav, poslední spojení, baterie, verze aplikace a plánu. Klik otevře pacienta.
- **Log přístupů a AI**: neměnný záznam, kdo co zobrazil a změnil, a dotazy na AI (jen délka a počet anonymizovaných údajů, bez obsahu).
- **Nastavení**: **Název sítě** (zobrazuje se v hlavičce), výchozí **interval revize plánu** v měsících a **odkaz pro přihlášení** uživatelů, který rozešlete.
- **Propojení s PéčeDoma** (v Nastavení): **odkaz na portál PéčeDoma** vaší organizace (zobrazí se u pacienta), **server PéčeDoma** (jhn-apps), **token aplikace** (stejný, kterým portál PéčeDoma volá svůj server – do prohlížeče se zpět neposílá) a zatržítko **Synchronizovat automaticky**. Po uložení se v průvodci Nový pacient objeví **Vybrat klienta z PéčeDoma** a u pacientů panel PéčeDoma (kapitola 9).

![Správa organizace – Nastavení – Propojení s PéčeDoma](/napoveda/img/c-nastaveni-pecedoma.png)

### Karta pacienta uvnitř PéčeDoma

![Karta pacienta otevřená z PéčeDoma – pasivní karta a plán péče](/napoveda/img/pd-karta.png)

Od 0.11.65 jde Kartu pacienta otevřít i přímo z portálu PéčeDoma: v **Datech klienta** je u klienta, který má v Kartě aktivní průkaz, tlačítko **Karta pacienta**. Otevře se okno s **pasivní kartou** – přesně tím, co vidí kdokoli u zamčeného telefonu u pacienta (krizová karta, bez PINů). Lékař (v PéčeDoma role Lékař) má vedle karty i **formulář plánu péče** a tlačítka **Uložit jako novou verzi** a **Potvrdit revizi beze změny**; nová verze se podepíše „PéčeDoma: jméno“, telefon u pacienta i centrála Karty ji převezmou při nejbližší synchronizaci a v centrále je vidět ve verzích plánu i v deníku. Sestra, case manager a správce PéčeDoma kartu jen vidí. Léky se do Karty berou z PéčeDoma automaticky, v tomto okně se nezapisují. Otevření i zápis se zapisují do logu přístupů pacienta. Okno platí 30 minut, pak je třeba ho otevřít znovu; klient bez aktivního průkazu v Kartě tlačítko nemá co otevřít (portál to oznámí).

## 13. Karta na telefonu – instalace a spárování

Pod hlavičkou je v každém telefonu tmavomodrý pruh **KARTA TÝMU · telefon u pacienta** – tenhle telefon odemyká tým a rodina PINem a lékař v něm mění léky. Fialový pruh **KARTA PACIENTA A RODINY · vlastní telefon pacienta** měla dřívější aplikace Můj průkaz (zrušená v 0.11.111, kapitola 19), kde léky nikdo nepřidával – pacient a rodina jen zaznamenávali podání. Po odemknutí ukazuje pruh karty týmu i roli a jméno, kdo ji odemkl.

![Telefon – spárování karty](/napoveda/img/k-parovani.png)

1. Na telefonu u pacienta otevřete adresu karty (`…/karta/`) nebo odkaz z SMS.
2. **iPhone**: chcete-li kartu jako aplikaci na ploše, nejdřív ji přidejte na plochu (Sdílet → **Přidat na plochu**), otevřete ji z plochy a **spárujte až tam**. Aplikace na ploše má vlastní úložiště – co se spáruje v Safari, na ploše nebude. **Android**: v Chromu menu ⋮ → Přidat na plochu / Nainstalovat aplikaci, nebo klepněte na tlačítko **Přidat kartu na plochu telefonu** na obrazovce párování (ukáže se, když to prohlížeč nabízí).
3. Klepněte na **Načíst QR kód fotoaparátem** a namiřte na QR kód v okně Spárovat telefon v centrální aplikaci (nebo kódy opište ručně, nebo otevřete odkaz z SMS – kódy se vyplní samy). Po načtení kódu se předvyplní i číslo telefonu, pro které byl kód vydán – stačí ho potvrdit tlačítkem **Potvrdit a spárovat** (jiné číslo lze přepsat). **Nejjednodušší bez kamery** (od 0.11.110): okno Spárovat telefon v centrále ukazuje velké **6místné číslo** – v telefonu ho zadejte do pole **6místné číslo z centrální aplikace**, vyplňte číslo telefonu a stiskněte **Spárovat**.
4. Zadejte **číslo tohoto telefonu** a klepněte na **Spárovat**. Karta se nahraje jen tehdy, když číslo odpovídá číslu u pacienta.

![Telefon – načtení QR kódu fotoaparátem](/napoveda/img/k-qr.png)

- Telefon poprvé požádá o přístup k fotoaparátu – povolte ho. Když ho omylem zakážete, povolte ho v nastavení telefonu, nebo kódy opište.
- Data jsou v telefonu **šifrovaná**. Telefon může nést průkazy více pacientů – každý má vlastní kartu, deník a PINy.

### Více pacientů v jednom telefonu

![Telefon – výběr pacienta při více průkazech](/napoveda/img/k-vyber.png)

Když je v telefonu víc průkazů (např. jeden telefon pro celé oddělení domova), ukáže se po spuštění a po každém zamknutí **výběr pacienta**: jméno, kód průkazu, pobyt a upozornění (probíhá zhoršení, zápisy čekající na odeslání, stará data). Klepnutím na pacienta se otevře jeho zamčená krizová karta a dál vše funguje jako s jedním průkazem; šipka zpět v hlavičce vrátí na výběr. **Přidat další průkaz do tohoto telefonu** otevře spárování – stávající průkazy zůstanou. Všechny průkazy se synchronizují samy.

- **Přidat dalšího pacienta do telefonu:** tlačítko je přímo na kartě (pod zamčenou krizovou kartou v panelu **Průkazy v tomto telefonu**), ve výběru pacienta a po odemknutí v dlaždici **Tým**. Otevře spárování QR kódem nebo kódem z centrální aplikace (u nového pacienta Telefon a PINy); stávající průkazy zůstanou. Po přidání se telefon vrátí na **výběr pacienta**, takže jsou vidět všichni.
- **Odvolat jedno párování:** otevřete pacienta, odemkněte ho PINem týmu nebo kódem lékaře (ne rodina) a v dlaždici **Tým** stiskněte **Odebrat průkaz z tohoto telefonu**. Z telefonu se vymaže jen tento pacient, v centrální aplikaci se jeho telefon označí jako vrácený a do deníku se zapíše, kdo průkaz odebral; ostatní průkazy zůstanou. Odebrat jde jen s připojením. Stejně funguje zablokování telefonu u pacienta v centrální aplikaci nebo uzavření průkazu.
- Když telefon průkaz odebere sám (telefon byl u pacienta zablokován, vrácen nebo spárován v jiném telefonu), ukáže okno **Průkaz byl z telefonu odebrán** se jménem pacienta – pokud má průkaz zůstat, spárujte ho znovu.
**Nahrát více pacientů do jednoho telefonu najednou** (od 0.11.99) – typicky telefon na oddělení domova seniorů:

1. V centrále **Pacienti → Agenda pacientů** zapněte filtr **Kde je** (např. DS C), případně hledání.
2. Klikněte na **📱 Nahrát více karet do telefonu**. Okno ukáže pacienty z agendy. Pole **Hledat pacienta nebo umístění** hledá v jménu, kódu průkazu, umístění (např. *DS B*), adrese i telefonu – bez ohledu na diakritiku; tlačítka **Umístění** zúží seznam jedním klepnutím. Zatrhněte pacienty (klepnutím na řádek nebo **Vybrat zobrazené**; na začátku není vybraný nikdo) a zadejte **číslo telefonu**.
3. **Vytvořit QR kód** – centrála vybraným pacientům nastaví *Telefon s kartou* na toto číslo a ukáže jeden QR kód (platí 30 minut, jde použít jen jednou).
4. Na telefonu, na kterém svítí stránka **Spárovat telefon**, stiskněte **Načíst QR kód fotoaparátem**, namiřte na obrazovku centrály, zkontrolujte číslo a stiskněte **Převzít průkazy**. Telefon nahraje všechny vybrané pacienty najednou a centrála ukáže **Hotovo**.

Kdo už měl průkaz v jiném telefonu, tomu ho nový telefon nahradí (dřívější se zablokuje – stejně jako při novém spárování). Týmy zatržené u tohoto telefonu (Lidé a týmy → tým → Telefony s kartou) se pacientům přiřadí samy. Nakonec vytiskněte štítek na telefon a leták k telefonu.

![Nahrát pacienty do telefonu](/napoveda/img/c-nahrat-telefon.png)

**Telefon nenačte QR kód – 6místné číslo** (od 0.11.110): okna **Spárovat telefon**, **📱 Nahrát více karet do telefonu** i **Výměna telefonu** ukazují vedle QR kódu velké 6místné číslo. Na telefonu na stránce Spárovat telefon ho zadejte do pole **6místné číslo z centrální aplikace**, doplňte číslo telefonu a stiskněte **Spárovat** – telefon převezme průkazy stejně jako po QR kódu. Číslo platí jen pro telefon s číslem uvedeným v okně.

**Opačně – kód z obrazovky telefonu** (od 0.11.104): na stránce **Spárovat telefon** stiskněte **📟 Bez kamery – kód na obrazovce**, zadejte číslo tohoto telefonu a **Zobrazit kód** – telefon ukáže 6místný kód. V centrální aplikaci v okně s QR kódem (**Spárovat telefon** u pacienta, **📱 Nahrát více karet do telefonu** i **Výměna telefonu**) ho opište do pole **Telefon nenačte QR kód?** a stiskněte **Potvrdit telefon**. (U jednoho pacienta jde na telefonu také opsat kód organizace a párovací kód z okna Spárovat telefon.) Telefon si průkazy převezme sám; kód platí 15 minut a funguje jen pro číslo telefonu zadané v centrále.

![Telefon bez kamery – kód na obrazovce](/napoveda/img/k-bez-kamery.png)

**Výměna telefonu – přenos všech průkazů do nového telefonu.** Když se telefon u lůžka mění (porucha, nový telefon, jiné číslo), nemusí se každý pacient párovat znovu. **Nejjednodušší je celé to udělat z centrální aplikace** (od 0.11.96):

1. V centrále otevřete kteréhokoli pacienta z telefonu → **Telefon a PINy** → **📱 Výměna / deaktivace telefonu** (nebo **Lidé a týmy** → u týmu **📱 Výměna telefonu**). Okno ukáže, kteří pacienti v telefonu jsou.
2. Zadejte **číslo nového telefonu** (přendáváte-li SIM kartu, nechte stejné) a stiskněte **Vytvořit QR kód pro nový telefon**. Kód platí 30 minut a jde použít jen jednou.
3. Na **novém telefonu** svítí stránka **Spárovat telefon** (v kiosku hned po spuštění; je-li v telefonu už nějaký pacient, stiskněte **Přidat dalšího pacienta do telefonu**). Stiskněte **Načíst QR kód fotoaparátem**, namiřte na obrazovku centrály, zkontrolujte číslo a stiskněte **Převzít průkazy**.
4. Centrála ukáže **Hotovo**: nový telefon má všechny průkazy. **Starý telefon zůstává funkční**, dokud ho nedeaktivujete – nejdřív si ověřte, že nový telefon ukazuje pacienty.
5. **Deaktivace starého telefonu – až na váš pokyn:** v okně Hotovo **Deaktivovat starý telefon**, nebo kdykoli později u pacienta **Telefon a PINy → 📱 Výměna / deaktivace telefonu → Deaktivovat starý telefon**. Do té doby je u starého telefonu štítek *starý – po výměně, čeká na deaktivaci*. Po deaktivaci se ze starého telefonu při příštím připojení průkazy vymažou; nový telefon (i se stejným číslem) zůstává.

![Výměna telefonu v centrále](/napoveda/img/c-vymena-telefonu.png)
![QR kód pro nový telefon](/napoveda/img/c-vymena-qr.png)
![Hotovo – starý telefon deaktivujete až na pokyn](/napoveda/img/c-vymena-hotovo.png)

**Deaktivovat bez výměny** (telefon se ztratil nebo se vrací bez náhrady): ve stejném okně **Deaktivovat telefon (ztráta, vrácení)** – zablokuje průkazy všech pacientů v telefonu najednou.

Výměnu jde spustit i **ze starého telefonu** (od 0.11.95):

1. **Starý telefon:** otevřete kteréhokoli pacienta, odemkněte ho **PINem týmu** nebo kódem lékaře (ne rodina), v dlaždici **Tým** stiskněte **Výměna telefonu – předat průkazy do nového** a potvrďte. Telefon nejdřív odešle čekající zápisy a pak ukáže **QR kód** a kód ve tvaru XXXX-XXXX-XXXX. Kód platí **10 minut** a jde použít jen jednou. (Výhoda: neodeslané zápisy se nejdřív odešlou.)
2. **Nový telefon:** otevřete Kartu pacienta (v kiosku se otevře sama) → **Výměna telefonu – převzít průkazy ze starého telefonu** → **Načíst QR kód ze starého telefonu** (nebo kód opište).
3. Zkontrolujte **číslo nového telefonu** – předvyplní se číslo starého. Má-li nový telefon **jiné číslo**, přepište ho: u pacientů se změní *Telefon s kartou* a u týmů (*Lidé a týmy → Telefony s kartou*) se starý telefon nahradí novým, takže týmy i jejich PINy zůstanou.
4. Stiskněte **Převzít průkazy**. Nový telefon dostane všechny průkazy najednou (každý s novým, vlastním přístupem), starý telefon ukáže **Hotovo** a zůstává funkční, dokud ho garant v centrále nedeaktivuje (viz bod 5 výše). V deníku každého pacienta je zápis o výměně telefonu.

![Starý telefon ukazuje QR kód výměny](/napoveda/img/k-vymena-stary.png)
![Nový telefon převezme průkazy](/napoveda/img/k-vymena-novy.png)

Přenášejí se jen zapůjčené telefony (Karta pacienta). **Průkaz pacienta** ve vlastním telefonu pacienta se nepřenáší – je to pacientova aplikace s vlastními daty. Když se nové číslo liší, **vytiskněte znovu štítek** na telefon (Lidé a týmy → tým → Telefony s kartou). Kód vypršel nebo se použil? Na starém telefonu stiskněte Výměna telefonu znovu.

- Hláška „Karta tohoto pacienta je určená pro jiné číslo telefonu“ znamená, že číslo neodpovídá – zkontrolujte ho v centrální aplikaci (Detail pacienta → Telefon s kartou).

## 14. Karta na telefonu – každodenní používání

### Zamčená karta – pro každého, i pro záchranku

![Telefon – zamčená krizová karta](/napoveda/img/k-zamceno.png)

Každé okno (PIN, kód lékaře, potvrzení, čtení QR) jde zavřít křížkem vpravo nahoře. Systémové tlačítko **Zpět** na Androidu kartu nezavře: zavře otevřené okno, jinak vrátí na dlaždici Karta. Z aplikace se odchází jen tlačítkem Domů. Když chcete, aby telefon u lůžka zůstal jen v Kartě, zapněte v Androidu **Připnutí obrazovky** (Nastavení → Zabezpečení → Připnout aplikaci, s PINem před odepnutím) a Kartu připněte přes tlačítko Nedávné aplikace.

Bez přihlášení je vidět **krizová karta**, která začíná oddílem **DIAGNÓZA** (diagnózy a funkční stav): cíl péče, limitace s dokladem, SOS léky, alergie, kontakty a telefon na garanta. **Záchranná služba** nepotřebuje PIN ani žádný seznam lidí: bez přihlášení zapíše **výjezd** – výsledek zásahu, **své jméno a posádku** (povinné) a poznámku. V deníku je výjezd označený jako neověřený. Pod formulářem je panel **Předchozí výjezdy ZZS** – posádka bez přihlášení vidí, s čím se u pacienta minule vyjíždělo a jak zásah skončil (posledních 5, starší rozbalí). Ostatní zápisy deníku vidí jen tým po odemknutí.

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

Vysvětlující texty nejsou mezi údaji: obrazovka ukazuje jen důležité informace a tlačítka, všechny vysvětlivky jsou až dole v bloku **ⓘ Vysvětlivky**, který se rozbalí klepnutím.

![Telefon – odemčená karta pro pečující](/napoveda/img/k-odemceno.png)

![Telefon – nejbližší návštěva z PéčeDoma na Kartě](/napoveda/img/k-navsteva.png)

Po odemknutí jsou dlaždice **Karta, Diagnóza, Plán, Léky, Interní poznámky, Poznámky pacienta, Zprávy** (u pacienta propojeného s PéčeDoma)**, Zhoršení, Kontakty, Tým**; diagnóza je prvním oddílem krizové karty, takže je vidět už na zamčené první stránce. **Léky** jsou jedny: u pacienta propojeného s PéčeDoma přímo z PéčeDoma, jinak z plánu péče. **Lékař** (odemčení kódem lékaře nebo PINem lékaře) vidí na dlaždici Léky u propojeného pacienta rovnou jeden upravitelný seznam po skupinách (SOS léky, Opioidy, Pravidelná medikace, Parenterálně) s tlačítky **Upravit**, **Vyřadit** a **Přidat lék** – stejně jako v PéčeDoma; zápis jde do PéčeDoma a potřebuje připojení. Ostatní role vidí léky jen ke čtení (SOS léky, Opioidy, Pravidelná medikace).

![Telefon – lékař upravuje léky](/napoveda/img/k-leky-lekar.png) U pacienta propojeného s PéčeDoma má krizová karta po odemknutí lékařem nebo členem týmu zelený oddíl **PŘÍŠTÍ NÁVŠTĚVA · PéčeDoma** (kdy a kdo přijde; zamčená karta a rodina ho nevidí) a SOS léky v kartě jsou ty z PéčeDoma. Po odemknutí je na Kartě i panel **PéčeDoma** s posledními dvěma zprávami (vidět rovnou, bez rozklikávání) a tlačítkem **💬 Napsat týmu PéčeDoma**; celé vlákno – všechno, co pacient a rodina napsali z aplikace PéčeDoma (dříve i z Mého průkazu), a odpovědi týmu – má od 0.11.34 vlastní dlaždici **Zprávy** s tlačítkem **💬 Odpovědět**. Lékař (i praktický) zprávy na telefonu **jen čte** – z telefonu se píše za stranu pacienta, lékař odpovídá z portálu PéčeDoma (Data klienta → Zprávy) nebo z centrály Karty, kde zpráva jde za Tým PéčeDoma: rodina nebo tým u pacienta napíše sestrám a lékaři, zpráva se objeví v PéčeDoma u klienta (Data klienta → Zprávy) i v aplikaci PéčeDoma klienta a odpověď přijde sem. Zprávy jsou barevně podle autora: **modře** píše poskytovatel (lékař, sestry, tým PéčeDoma), **fialově** strana klienta (pacient, rodina, karta u lůžka) – stejně v centrální aplikaci. Píše se pod jménem a rolí odemknutí (např. „rodina Jana Zkušební“), chat potřebuje připojení k internetu.

![Telefon – chat s týmem PéčeDoma](/napoveda/img/k-chat.png)
![Telefon – dlaždice Zprávy s celým vláknem](/napoveda/img/k-zpravy.png)

- **Interní poznámky** (deník týmu) – jen pro tým (lékař, hospic, sestra, praktický lékař); rodina tuto dlaždici nemá (od 0.11.33). Vyberete typ zápisu (nabízí se jen to, co vaše role smí) a napíšete text; zápis se uloží pod vaším jménem. Funguje i bez signálu, odešle se při nejbližším připojení (číslo na dlaždici = kolik zápisů čeká na odeslání).

![Telefon – zápis do deníku](/napoveda/img/k-denik.png)

**Návrat z nemocnice** (od 0.11.144): v deníku vyberte typ **Návrat z nemocnice**, vyplňte nemocnici a oddělení, kdy a kam se pacient vrátil, čím byl převezen a zda přivezl propouštěcí zprávu; poznámka je volitelná. Zápis uzavře probíhající zhoršení.

![Telefon – zápis návratu z nemocnice](/napoveda/img/k-navrat.png)

**Návrat z nemocnice na zamčeném telefonu** (od 0.11.145): pod zápisem výjezdu ZZS je **sbalený** panel **Návrat z nemocnice – zápis** (od 0.11.146 se rozbalí klepnutím, používá se výjimečně) – pro toho, kdo pacienta přivezl nebo převzal a PIN nemá (rodina, řidič sanitky, sestra). Vyplní stejná pole a navíc své jméno a kdo je. V deníku je zápis označený jako *neověřený* (role „bez přihlášení“), stejně jako výjezd ZZS. U pacienta propojeného s PéčeDoma se návrat z nemocnice (zapsaný kdekoli) přenese i do PéčeDoma – Data klienta → 🪪 Z Karty pacienta, historie zhoršení a návratů (PéčeDoma 3.43).

![Zamčený telefon – zápis návratu z nemocnice bez PINu](/napoveda/img/k-navrat-zamceno.png)

- **Poznámky pacienta** – přání a hodnoty, poznámky a otázky, které pacient dříve poslal z aplikace Můj průkaz (zrušená v 0.11.111); jen ke čtení.

![Telefon – Poznámky pacienta ze sdílení](/napoveda/img/k-od-pacienta.png)

- **Zhoršení** – průvodce: co pozoruji (dušnost, bolest, neklid…), co jsem udělal(a) (podán SOS lék, poloha…), komu jsem volal(a). **Zapsat zhoršení a zobrazit na kartě** – zhoršení se ukáže na kartě i v centrální aplikaci; po zlepšení klepněte na **Stav stabilizován**. Tlačítko **Volat** vytočí první pečující kontakt.

![Telefon – průvodce zhoršením stavu](/napoveda/img/k-zhorseni.png)

- **Plán** – cíl péče, limitace, doklad, kdo plán stanovil a do kdy platí (léky jsou na dlaždici **Léky**: Opioidy, SOS medikace, Paliativná medikace). Plán mění jen lékař v centrální aplikaci.
- **Kontakty** a **Tým** – kontakty po skupinách, garant, tým a údaje o tomto telefonu (kdy byl spárován, poslední spojení, co čeká na odeslání).

### Videohovor

![Telefon – dlaždice Videohovor](/napoveda/img/k-video.png)

Po odemknutí PINem (rodina i tým) je na kartě dlaždice **Videohovor**. Nahoře je tlačítko **Spustit videokonferenci**, pod ním **seznam členů týmu u pacienta** – u každého jde rovnou **zavolat** nebo **poslat SMS s výzvou k připojení** (text se jménem pacienta a vaším jménem se předvyplní v aplikaci SMS telefonu, stačí odeslat). Nejdříve kolegu informujte, že s ním chcete hovořit přes videokonferenci, pak klepněte na Spustit videokonferenci – otevře hovor přes celou obrazovku; lékař nebo sestra ho vidí v centrální aplikaci u pacienta (červený pruh *Z telefonu u pacienta volá…*) a klepnutím **Připojit se** se přidá. Na konci klepněte na **Ukončit**. Hovor vede server videohovorů Jitsi, který provozuje vaše organizace (nastavuje správce, `deploy/vps-jitsi.sh`); nikam se nenahrává, do deníku jde jen zápis *Videohovor zahájen / ukončen (x min)*.

![Telefon – příchozí videohovor z centrály](/napoveda/img/k-video-zvoni.png)

Když lékař zavolá z centrály (u pacienta tlačítko **Videohovor na telefon**), zazvoní **telefon s kartou u lůžka** – **v jakémkoli stavu**: zamčená karta, i výběr pacienta, je-li v telefonu více průkazů (telefon si pacienta sám otevře). Uprostřed obrazovky se otevře okno **Příchozí videohovor** se jménem volajícího a tlačítky **Přijmout** a **Odmítnout**; telefon zvoní a vibruje, dokud někdo hovor nevezme (nebo lékař nezavěsí). Přijmout může kdokoli u lůžka bez PINu. Hovor ukončíte tlačítkem **Ukončit** nahoře, nebo červeným sluchátkem uvnitř hovoru – obojí ho ukončí i pro centrálu. Jediná podmínka: aplikace je na obrazovce (v kiosku je vždy) – upozornění mimo aplikaci se neposílá. V kiosku na Androidu (aplikace 0.1.8 a novější) telefon při hovoru z centrály **sám probudí zhasnutý displej** a karta zazvoní; během zvonění a hovoru displej nezhasne. Nepřijatý hovor po 15 minutách skončí sám. Dlaždice se neukáže, dokud správce server videohovorů nenastaví.

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

Karta pacienta má od verze 0.9.4 stejný vzhled jako portál PéčeDoma: modrou hlavičku s přechodem, stejnou paletu, velikost tlačítek, výšku řádků i štítky, takže přechod mezi oběma aplikacemi nepůsobí rušivě. Tlačítko **🎨** v hlavičce (na telefonu v okně nápovědy) otevře výběr barevného schématu: Karta modrá (výchozí, v noci tmavá podle systému), PéčeDoma Plus zelená, Datec modrá, Veselá, Konzervativní, Letní, Zimní, Podzimní, Jarní a Tmavá. Volba platí jen na tomto zařízení a v tomto prohlížeči. Barvy stavů (červená, oranžová, zelená) zůstávají stejné.

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
- **Průkaz pacienta** (vlastní telefon pacienta): data má jen pacientův telefon, šifrovaná jeho PINem. Údaje od lékaře si zkopíruje jednosměrně na svůj pokyn; z Průkazu se do Karty ani týmu nic neposílá.
- **AI jen anonymně**: rozbor propouštěcí zprávy i chat nápovědy dostávají text až po anonymizaci (jména, rodná čísla, data, adresy, telefony, e-maily → značky). Když v textu zůstane něco jako identifikátor, dotaz se neodešle.
- Deník, historie garance, verze plánu a log přístupů nejde mazat ani přepisovat.

## 18. Časté otázky

**Telefon hlásí „Kód je neplatný nebo vypršel“.** Obrazovka párování se po této hlášce vrátí k tlačítku **Načíst QR kód fotoaparátem** a polím pro opsání kódů, takže nový kód načtete hned; prošlý odkaz z adresy zmizí a při dalším spuštění už se nenabízí. Tlačítko **Mám jiný kód** je i u načteného kódu. Nejčastěji byl kód mezitím nahrazen novým (každé další Spárovat telefon nebo Poslat SMS po vypršení vydá nový kód) nebo uběhlo 30 minut. Otevřete v centrální aplikaci Spárovat telefon znovu a použijte kód, který je na obrazovce teď; v kioskové aplikaci bez fotoaparátu ho opište ručně i s kódem organizace. Kiosková aplikace nesmí při nečinnosti mazat data webu (cache, úložiště), jinak se karta z telefonu ztratí a bude chtít spárovat znovu.

**Po přidání karty na plochu iPhonu se aplikace ptá znovu na kódy / hlásí neplatný kód.** Aplikace na ploše má vlastní úložiště, co se spárovalo v Safari, na ploše není. Od verze 0.11.10 použijte v aplikaci na ploše **stejný kód** (odkaz z SMS nebo Načíst QR kód fotoaparátem, kapitola 13) – kód platí 30 minut i po prvním spárování; kopie v Safari tím skončí. Po vypršení vydejte v centrální aplikaci nový kód.

**Telefon hlásí „určená pro jiné číslo telefonu“.** Zadané číslo neodpovídá poli Telefon s kartou u pacienta. Opravte číslo v Detailu pacienta, nebo zadejte číslo telefonu, který držíte.

**V Týmu a garanci se nenabízí žádné pracoviště.** V organizaci zatím není další pracoviště. Založte ho ve Správa organizace → Pracoviště (kapitola 12).

**Nejde poslat SMS.** Okno Spárovat telefon napíše důvod. Spárujte QR kódem; nastavení SMS na serveru řeší provozovatel.

**Plán je po platnosti.** Lékař v záložce Krizová karta klikne na Potvrdit revizi plánu, nebo plán upraví a uloží novou verzi.

**Ztratil se telefon.** V záložce Telefon a PINy telefon zablokujte – při připojení se vymaže. Pak spárujte nový.

**Lékař na pohotovosti nemá PIN.** Kód lékaře pro dnešek najde v PéčeDoma v Datech klienta (🪪 Kód lékaře na kartu) nebo mu ho nadiktuje lékař z týmu z centrální aplikace. Na telefonu zvolí Lékař bez PINu (kapitola 8).

**Pečující zapomněl PIN.** Člověku z Lidí a týmů ukáže **Zobrazit PIN** platný PIN (u PINů vydaných od verze 0.11.6), jinak mu vydejte **Nový PIN** (platí pak u všech jeho pacientů); u pacienta v Telefon a PINy je **Zobrazit PIN** i u každého člověka v panelu Lidé, kteří odemknou kartu (od 0.11.32); PIN rodiny ukáže **Zobrazit PIN** v panelu Rodina a jednorázové PINy (od 0.11.31), jinak tam vydejte **Nový PIN**; celému týmu jdou kartičky s PINem vytisknout najednou. Rodinný PIN u pacienta zrušte a vydejte nový.

**Musím každou sestru domova zapisovat ke každému pacientovi?** Ne. Domov (nebo správce) své sestry zapíše jednou v Lidech a týmech, rozdělí do oddělení a k pacientovi přiřadíte celé oddělení jedním zaškrtnutím.

**Jak se do karty dostane záchranka?** Bez PINu – krizovou kartu vidí každý. Jméno a posádku zapíše až u zápisu výjezdu.

**Zapsal jsem do deníku chybu.** Zápisy nejde mazat. Napište nový zápis s opravou.

**Pacient chce průkaz ve svém telefonu.** V Telefon a PINy klikněte na Zpřístupnit pacientovi v jeho telefonu (kapitola 8, pro pacienta kapitola 19).

**Pacient zapomněl PIN do Průkazu pacienta.** PIN nikdo neobnoví – pomůže jen jeho vlastní záloha. Údaje od lékaře mu znovu předáte tlačítkem **Předat pacientovi do Průkazu**.

**Je to, co pacient napíše do Průkazu pacienta, dříve vyslovené přání?** Ne. Je to jeho osobní záznam. Platné DVP vyžaduje písemné poučení lékařem a úředně ověřený podpis (nebo zápis při přijetí do péče) – evidujte ho v plánu péče a v dokumentech.

**Data na telefonu jsou stará.** Připojte telefon k internetu a klepněte na pruh s časem aktualizace (synchronizovat). Karta se synchronizuje i sama při každém otevření a každých 5 minut.

## 19. Průkaz pacienta – údaje ve vlastním telefonu pacienta

**Průkaz pacienta** je samostatná aplikace pacienta (projekt DialogusPrukaz, https://dialogusprukaz.netlify.app/prukaz/, i jako aplikace pro Android a iPhone). Pacient si v ní vede vlastní zdravotní kartu – data má **jen ve svém telefonu**, šifrovaná PINem. Karta pacienta je pro něj jen jeden ze zdrojů: údaje od lékaře si z ní **jednosměrně zkopíruje na svůj pokyn**. Do Karty ani týmu se z Průkazu nic neposílá.

Postup:

1. Pacient si nainstaluje Průkaz pacienta a založí si kartu (PIN).
2. V Kartě pacienta tým klikne u pacienta na **Předat pacientovi do Průkazu** (kapitola 8 – Předání do Průkazu pacienta) a zadá mobil pacienta.
3. Pacient v Průkazu klepne na **Propojit s Kartou pacienta** a zadá **6místné číslo** a své číslo telefonu (nebo načte QR kód, nebo vloží odkaz z SMS).
4. Průkaz nabídne diagnózy, léky, alergie, kontakty a plán ke kontrole; pacient je uloží do své karty. Kdykoli později si může načíst aktuální stav znovu.

Rodina se ke kartě pacienta dostane buď **PINem na telefonu u lůžka** (kapitola 14), nebo si sama nainstaluje Průkaz pacienta a tým jí předá údaje do jejího telefonu.

> Dřívější aplikace **Můj průkaz** (`/pacient/`, karta pro pacienta a rodinu) je od verze 0.11.111 zrušená. Starý odkaz z SMS otevře stránku s odkazem na Průkaz pacienta; záznamy, které z ní pacient dříve poslal, zůstávají v centrále v panelu Od pacienta.

### Zpráva do Průkazu – zpráva rovnou do telefonu pacienta (od 0.11.148)

Když pacient v Kartě pacienta není (nebo ho tam zakládat nechcete) a jen mu chcete předat zprávu, použijte malou aplikaci **Zpráva do Průkazu** – https://zprava-do-prukazu.netlify.app (funguje na počítači i tabletu, nic se neinstaluje).

1. Přihlaste se **stejným účtem jako do Karty pacienta** (kód organizace je v odkazu …/centrala/?t=KÓD – můžete vložit i celý odkaz). Smí lékař; v jednoduchém režimu i sestra.
2. Nahrajte **dekurz nebo zprávu** (PDF i naskenované, nebo fotku). Server zprávu přečte a rozebere – **AI dostane jen text bez jména, rodného čísla, adresy a telefonů**.
3. Zkontrolujte, že jde o správného pacienta (jméno ze zprávy), opravte diagnózy, léky a alergie a nechte zaškrtnuté **Přiložit i samotnou zprávu**.
4. Klepněte na **Vytvořit QR kód pro pacienta**. Pacient v Průkazu pacienta dá **Zdraví a dokumenty → Rychle doplnit → Zpráva od lékaře (QR kód)** a QR kód načte. Aplikace ukáže, až si zprávu převzal.

Údaje se v prohlížeči **zašifrují** – klíč je jen v QR kódu, server zprávu přečíst neumí. Zašifrovaná zpráva čeká na serveru **nejvýš 30 minut a vydá se jen jednou**, pak se smaže; do databáze Karty se nic neukládá (jen záznam v logu přístupů, bez obsahu). Pacient údaje v Průkazu zkontroluje a uloží jako ověřené lékařem; zpráva se mu uloží do Dokumentů.

## 20. Průkaz pro plán péče – prototyp pacientem řízené karty

Samostatná aplikace na adrese `/prukaz/` podle zadání MUDr. Kabelky (Dialogus, verze 0.1, říjen 2026). Na rozdíl od zapůjčené karty **nemá žádný server ani garanta**: kartu si pacient založí sám, všechno zůstává jen v jeho telefonu, šifrované PINem, a o každém sdílení rozhoduje pacient. Je to prototyp k diskusi, ne součást ostré sítě Karty pacienta.

**Od listopadu 2026 se Průkaz vyvíjí samostatně** (projekt DialogusPrukaz) na adrese **https://dialogusprukaz.netlify.app/prukaz/**, s aplikací *Průkaz pacienta* pro Android a iPhone. Stránka `/prukaz/` na serveru Karty zůstává jako původní prototyp. Nová verze se umí **propojit s Kartou pacienta** kódem, který tým vydá tlačítkem Předat pacientovi do Průkazu (kapitola 19): v Přehledu *Propojit s Kartou pacienta* → QR kód, odkaz z SMS nebo opsané kódy. Údaje od lékaře (diagnózy, léky, plán péče, kontakty a tým) se pak doplní se štítkem *z Karty pacienta* a mění je jen lékař; z Průkazu se do Karty nic neposílá (kapitola 19).

![Průkaz pro plán péče – úvod](/napoveda/img/q-uvod.png)

- **Úvod**: Vytvořit moji kartu (zvolíte PIN), Obnovit ze zálohy (soubor .prukaz + heslo), Otevřít ukázku (smyšlená data, nic se neukládá).
- **Přehled**: údaje, stav karty (kolik údajů je bez ověření, dokumenty po platnosti, zda existuje DVP), hlavní kontakty.
- **Zdraví a dokumenty**: diagnózy, alergie, léky a kontakty; u každého údaje **odkud je** (zapsal jsem, od lékaře, opsáno ze zprávy, rodina), **datum** a **ověřeno / neověřeno** (tlačítko Lékař potvrdil). Dokumenty s typem (zpráva, lékařský krizový plán, DVP, záznam rozhovoru, moje přání, jiný), vydavatelem, datem, platností, stavem podpisu a místem originálu; k dokumentu jde přiložit fotka nebo PDF (do 4 MB), zůstává jen v telefonu. Dokument po platnosti je viditelně označený.

![Průkaz – zdraví a dokumenty](/napoveda/img/q-zdravi.png)

- **Co je pro mě důležité**: krátké otázky (důležité, obavy, přijatelná zátěž léčby, co zohlednit, koho chci u rozhodování), kteroukoli lze přeskočit. Jsou to osobní preference, ne lékařský pokyn.
- **Rozhovor s lékařem**: před návštěvou otázky, po ní možnosti, přínosy a rizika, na čem jsme se domluvili, kdo byl přítomen a kdy to přehodnotit.
- **Budoucí péče**: čtyři oddělené záznamy – **moje přání** (osobní), **záznam rozhovoru o péči (ACP)**, **dříve vyslovené přání** (jen evidence, že existuje, s datem, stavem podpisu a místem originálu) a **lékařský krizový plán** (cíl péče, limitace, pokyny – opsané ze zprávy, označené ověřeno / neověřeno).

![Průkaz – budoucí péče](/napoveda/img/q-budouci.png)

- **Krizová karta**: pacient zaškrtne, co bude vidět bez PINu. Ve výchozím stavu jen jméno, rok, kontakty a lékař; diagnózy, limitace a DVP jsou označené jako citlivé a vypnuté. Neověřené údaje jsou na kartě vždy označené. Dole je náhled zamčené obrazovky.

![Průkaz – krizová karta](/napoveda/img/q-krize.png) ![Průkaz – zamčená obrazovka](/napoveda/img/q-zamek.png)

- **Sdílet a exportovat**: výběr oddílů (citlivé označené), **náhled přesně toho, co odejde**, upozornění na citlivost, potvrzení zaškrtnutím, pak **Uložit jako PDF / tisk** (tisk telefonu) nebo **Sdílet jako soubor** (systémové sdílení, jinak stažení). Každé sdílení se zapíše do historie v telefonu (rozsah, čas, způsob).

![Průkaz – náhled před sdílením](/napoveda/img/q-sdilet.png)

- **Bezpečnost a obnova**: změna PINu, **šifrovaná záloha** do souboru .prukaz s vlastním heslem (bez centrální kopie), obnova na jiném telefonu, smazání všeho. Karta se sama zamkne po 5 minutách nečinnosti.

![Průkaz – bezpečnost a obnova](/napoveda/img/q-bezpecnost.png)

Co prototyp zatím neumí a je k rozhodnutí: biometrie místo PINu, zobrazení na zamčené obrazovce iPhonu a Androidu (webová aplikace tam nemůže – zůstává Zdravotní ID systému telefonu nebo tištěná karta), pomoc pověřené blízké osoby v rozsahu oprávnění, předání ověřeného dokumentu od zdravotníka přímo do karty (QR nebo soubor s podpisem) a jakékoli propojení s poskytovatelským systémem (Karta pacienta, PéčeDoma) – to je podle zadání až pozdější etapa a musí mít nové posouzení.

## 21. Jednoduchý režim

Pro malou ordinaci nebo ambulanci, která Kartu pacienta používá jen k **přípravě údajů pro pacienta do aplikace Průkaz pacienta**. Zapíná ho správce organizace ve **Správě organizace → Nastavení → Jednoduchý režim** (nebo provozovatel už při založení organizace ve správě tenantů). Ostatní uživatelé ho uvidí po novém načtení stránky.

![Nastavení – jednoduchý režim](/napoveda/img/c-jednoduchy-nastaveni.png)

**Co zůstane:** Pacienti, Nový pacient, Můj účet, Správa organizace (jen správce: Uživatelé a Nastavení). U pacienta Krizová karta, Diagnóza, Plán péče, Léky, Důležité kontakty, **Předání do Průkazu**, **Dokumenty** (zprávy pro pacienta, od 0.11.118) a Detail pacienta.

Jednoduchý režim platí pro lékaře, sestry a jen čtení – **správce má vždy plnou Kartu**. Jak ji vidí ostatní, vyzkouší přepnutím role v hlavičce (kapitola 2, Přepnout roli).

**Náhled v telefonu** (karta tak, jak ji vidí telefon – zamčená i po odemknutí) zůstává pro všechny role i v jednoduchém režimu.

**Co se skryje:** Lidé a týmy, Deník, Tým a garance, Přístupy, zapůjčené telefony a PINy, videohovor, propojení s PéčeDoma, ve Správě Pracoviště, Telefony a Log přístupů. **Skrývá se jen obrazovka** – data ani oprávnění se nemažou a log přístupů se zapisuje dál. Po vypnutí režimu je vidět plná Karta se všemi dříve zapsanými údaji.

![Pacient v jednoduchém režimu – Krizová karta s tlačítkem Předat pacientovi do Průkazu](/napoveda/img/c-jednoduchy-karta.png)

- **Nový pacient** je zkrácený: rovnou formulář (načtení ze zprávy nebo ze souboru zůstává pod tlačítkem), bez rodného čísla, telefonu s kartou a e-mailu, bez výběru garanta a týmu. **Garantem je vždy vaše pracoviště** a garance platí hned.
- **Sestra smí totéž co lékař**: založit pacienta, zapsat diagnózy, léky, alergie, plán péče a kontakty a předat pacientovi do Průkazu. Plán zůstává verzovaný – u verze, kterou uložila sestra, je jméno s „(sestra)“. Uživatel s rolí *jen čtení* dál jen čte.
- **Předání do Průkazu**: tlačítko **Předat pacientovi do Průkazu** na Krizové kartě i v záložce Předání do Průkazu – SMS, QR kód nebo 6místné číslo (kapitola 8).


## 22. Zpráva z Medistaru – nejsnadnější cesta do Karty, PéčeDoma a Průkazu

Jeden soubor PDF z Medistaru stačí: Karta z něj vyčte diagnózy, léky a funkční stav, po vaší kontrole je zapíše do plánu péče, léky do PéčeDoma a zprávu i údaje předá pacientovi do Průkazu pacienta.

![Schéma: zpráva z Medistaru do Karty pacienta, PéčeDoma a Průkazu pacienta](/napoveda/img/schema-zprava-medistar.svg)

Karta pacienta je v centru: diagnózy a léky zapisujte **primárně v Kartě**. S PéčeDoma je vazba **obousměrná** – v PéčeDoma se vybírá, který klient Kartu dostane (Data klienta → Karta pacienta, kapitola 4), a diagnózy i léky jde zapsat i tam; propíší se do Karty. PéčeDoma slouží hlavně k registraci aktivit týmu (návštěvy, výkony, převazy). Zprávy z Medistaru ale zpracovává jen Karta – jen tam vzniká návrh ze zprávy, štítek *ověřeno zprávou* a předání do Průkazu.

Pacient ještě v Kartě není? Stejným PDF ho rovnou **založíte**: **+ Nový pacient → Založit z dekurzu nebo lékařské zprávy** (kapitola 4) – formulář se předvyplní z hlavičky a z rozboru.

**Dekurz, nebo lékařská zpráva?** Léky a diagnózy Karta přečte z obou – z dekurzu (Opioidy, SOS medikace, *Ter.: Chronická medikace* nebo *Chronická terapie*) i z lékařské zprávy (Dg., Medikace, Alergie). **Upřednostňujte dekurz**: má v hlavičce jméno, rodné číslo, adresu a telefon pacienta, navíc funkční stav (PPS). Lékařská zpráva jméno pacienta nemá – u už založeného pacienta to nevadí, při zakládání nového je potřeba jméno doplnit ručně.

### Krok 1 – Medistar: Dekurz → Tisk dekurzu → Uložit PDF

1. V Medistaru otevřete **Dekurz** pacienta → **Tisk dekurzu** → **Uložit PDF**.
2. Soubor uložte, např. `Dekurz_Novak.pdf` na Plochu.

Když je PDF jen obrázek textu (např. tisk přes *Microsoft Print to PDF*), nevadí to – Karta text rozpozná sama (asi 3–4 s na stranu). Sken nebo fotka zprávy (JPG, PNG) funguje stejně.

### Krok 2 – Karta pacienta: vložit a potvrdit

1. V centrále otevřete pacienta → záložka **Dokumenty**.
2. **Přetáhněte PDF myší** do seznamu dokumentů (nebo **Vybrat soubor z počítače**). Typ se nastaví na **Zpráva** a jsou zaškrtnuté obě volby – **Rozebrat zprávu (AI) a doplnit údaje pacienta** i **Předat pacientovi do Průkazu pacienta**.
3. Klikněte **Vložit**. Karta zprávu přečte (10–15 s, ukazuje *Čtu zprávu…*). K rozboru jde jen text bez jména, rodného čísla, adresy a telefonů (kapitola 17).
4. Otevře se okno **Doplnit údaje ze zprávy**. **Diagnózy, alergie, funkční stav**: vlevo, co je v Kartě teď, vpravo po doplnění ze zprávy; nové diagnózy se přidají k dosavadním.
   **Léky**: u pacienta propojeného s PéčeDoma část **Léky do PéčeDoma**: *nový* (přidá se), *v PéčeDoma stejně* (jen se označí *ověřeno zprávou*), *v jiné skupině* (např. opioid zapsaný jako paliativní terapie – přesune se), *s jinou dávkou* (přepíše se jen po zaškrtnutí). U nepropojeného pacienta se léky doplní do plánu péče.
5. **Zkontrolujte čísla a dávky** (u textu rozpoznaného z obrázku zvlášť pečlivě – ve zprávě z Medistaru bývají léky dvakrát, v Medikaci a v Chronické terapii; Karta bere Chronickou terapii) a klikněte **Uložit**.

Ukládá lékař z týmu; v jednoduchém režimu (kapitola 21) i sestra. Léky do PéčeDoma může zapsat i sestra z týmu.

Už vloženou zprávu jde rozebrat kdykoli znovu: **Dokumenty → Rozebrat (AI)** nebo **Léky → Ověřit podle zprávy → Rozebrat „…“**.

### Krok 3 – kam se údaje dostanou

| Kam | Co tam bude | Jak to poznáte |
|---|---|---|
| **Karta pacienta** | diagnózy, funkční stav, alergie jako **nová verze plánu péče**; krizová karta a zapůjčený telefon u pacienta při nejbližší synchronizaci | v záložce Diagnóza štítek **ze zprávy „název dokumentu“** (kapitola 5) |
| **PéčeDoma** | léky v **Data klienta → Léky** – nové přidané, skupina opravená, shodné ověřené | v Kartě u léku **ověřeno zprávou** nebo **ze zprávy**; v PéčeDoma *Historie změn léků* – zapsáno Kartou pacienta |
| **Průkaz pacienta** | zpráva v PDF a aktuální údaje (plán, léky, kontakty) | pacient v Průkazu klepne **Načíst z Karty pacienta**; tým ho může vyzvat tlačítkem **Obnovit** (SMS) v záložce Telefon a PINy – v jednoduchém režimu Předání do Průkazu (kapitola 8). U zprávy v Dokumentech je pak *v Průkazu od …* |

### Co se samo nestane

- **Lék, který ve zprávě není, se z PéčeDoma nevyřadí** – vyřaďte ho ručně tlačítkem **Vyřadit** v záložce Léky.
- **Průkaz si údaje nestáhne sám** – pacient je načte, až klepne *Načíst z Karty pacienta* (nebo po výzvě Obnovit).
- **Cíl péče a limitace** (KPR, hospitalizace) se ze zprávy nepřebírají – stanovuje je lékař v záložce Plán péče.

Když rozbor nevyjde, zůstane okno **Rozbor zprávy se nepovedl** s popisem chyby a tlačítkem **Zkusit znovu**; zpráva zůstává uložená v Dokumentech.
