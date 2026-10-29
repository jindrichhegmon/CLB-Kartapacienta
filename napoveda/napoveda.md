# Nápověda – Karta pacienta

Karta pacienta (paliativní průkaz) je krizový plán péče, který má pacient vždy u sebe v telefonu. Garant (hospic, paliativní ambulance, praktický lékař nebo dočasně nemocnice) plán vede v centrální aplikaci, telefon u lůžka ho ukazuje i bez signálu a posádka záchranky vidí krizovou kartu bez přihlášení. Obrázky v návodu jsou ukázkové, se smyšlenými jmény.

## 1. Co je Karta pacienta

Aplikace má čtyři části, všechny na jedné adrese:

| Část | Adresa | Pro koho |
|---|---|---|
| Centrální aplikace | `/centrala/` | garant a tým kolem pacienta – lékaři, sestry, správce organizace |
| Karta na telefonu | `/karta/` | zapůjčený telefon u lůžka pacienta (jen karta) – pečující (rodina, sestry), lékař na místě, posádka ZZS |
| Můj průkaz | `/pacient/` | vlastní telefon pacienta a rodiny – plán od lékaře, záznam podání léků, vlastní přání a poznámky (kapitola 19) |
| Správa tenantů | `/tenanti/` | provozovatel platformy – zakládá organizace |

Jak to funguje v kostce:

1. Lékař v centrální aplikaci založí pacienta – údaje načte ze souboru z portálu PéčeDoma, z propouštěcí zprávy (anonymní rozbor) nebo je vyplní ručně – a stanoví **cíl péče a limitace**.
2. U pacienta je uvedené **číslo telefonu s kartou**. Kartu jde nahrát jen do telefonu s tímto číslem: odkazem z SMS nebo naskenováním QR kódu.
3. Každé pracoviště – garant i partneři (domov, praktický lékař…) – si své **lidi a týmy** zapíše jednou (ručně, ze souboru CSV nebo z PéčeDoma). K pacientovi se pak lidé jen **přiřadí** – celý tým jedním zaškrtnutím.
4. Telefon ukazuje **krizovou kartu** (bez přihlášení – stačí záchranné službě). Přiřazení lidé se odemknou svým **osobním PINem**, rodina PINem od garanta, lékař na místě **kódem lékaře**. Co kdo vidí a zapíše, určuje jeho **role** (lékař, praktický lékař, hospic, sestra DPS, rodina, ZZS). Vše funguje i bez signálu a sesynchronizuje se při nejbližším připojení.
5. Plán péče mění jen lékař v centrální aplikaci. Každá změna je nová verze s podpisem, telefon plán nikdy nepřepíše.

> Karta je vždy jen v jednom zapůjčeném telefonu. Nový telefon zablokuje předchozí a zablokovaný telefon se při připojení sám vymaže. Vedle toho může mít pacient průkaz i ve vlastním telefonu v aplikaci **Můj průkaz** (kapitola 19).

## 2. Přihlášení a můj účet

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
| správce | spravuje pracoviště, uživatele a nastavení organizace; vidí všechny pacienty |

## 3. Přehled pacientů

Menu **Pacienti** ukazuje pacienty, u kterých je vaše pracoviště v týmu (správce vidí všechny).

![Přehled pacientů s upozorněními](/napoveda/img/c-pacienti.png)

- Nahoře je panel **Upozornění**: plán po platnosti nebo blížící se revize, probíhající zhoršení stavu, telefon se dlouho nepřipojil nebo má slabou baterii, průkaz ještě není v žádném telefonu, čekající předání garance, nemocnice garantem déle než 30 dní, pacient bez garanta. Klik na upozornění otevře pacienta. Panel se klepnutím na záhlaví **sbalí a rozbalí** – při více než třech upozorněních je zavřený a v záhlaví ukazuje jen souhrn (např. „1× probíhá zhoršení stavu · 13× průkaz zatím není v žádném telefonu“); prohlížeč si pamatuje, jak jste ho nechali.
- Políčko **Hledat** nad seznamem filtruje řádky podle čehokoli, co je v nich vidět: jméno, kód průkazu, adresa, garant, cíl péče. Více slov = všechna musí sedět, diakritika nehraje roli. Stejné hledání je v Lidech a týmech (lidé i týmy), u Pracovišť, Uživatelů, Telefonů a v Logu přístupů.
- V seznamu je u každého pacienta kód průkazu (`P-0001`), **adresa** (a pod ní pobyt, když se liší), garant, platnost plánu a stav telefonu (zelená tečka = připojil se v posledních 12 hodinách).
- Pacient v **domově seniorů** nebo jiné pobytové službě má u adresy zelenomodrý štítek **🏠 domov seniorů · název domova** a barevný pruh u řádku; stejný štítek je v záhlaví detailu. Aplikace to pozná podle pracoviště typu „Domov / pobytová služba“ v týmu kolem pacienta, případně podle slova domov v pobytu.
- **🏷 Štítky na telefony** vytiskne samolepky na zadní stranu telefonů u pacientů najednou (kapitola 8).
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
3. **Zapsat pacienta ručně** (vlastní panel, tlačítko **Zapsat ručně**) – rovnou krok 2 s prázdným formulářem bez PéčeDoma a bez zprávy. Tlačítko **Pokračovat bez rozboru** pod propouštěcí zprávou udělá totéž, jen si text zprávy ponechá k ručnímu opsání.

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
- **Cíl péče a limitace**: potvrzuje lékař. Cíl péče je symptomatická, omezená, nebo plná léčba; limitace (KPR, ventilace, hospitalizace…) jsou to, co se neprovádí. Vyplňte doklad – dříve vyslovené přání (DVP) a kde je jeho originál, nebo lékařskou zprávu / zápis o rozhovoru.
- **Kontakty** a **Garant a tým**: kdo rozhoduje, koho informovat, kdo pečuje; které pracoviště je garantem a která jsou v týmu.
- Vpravo je panel, co ze souboru bylo převzato a co je potřeba zkontrolovat.

Tlačítkem **Uložit** vznikne pacient s kódem `P-xxxx` a první verze plánu a otevře se jeho průkaz – pak telefon spárujte (kapitola 8). Tlačítko **Uložit a další** průkaz založí a hned otevře prázdný formulář pro dalšího pacienta (garant a tým zůstanou předvybrané) – hodí se při ručním zápisu více pacientů najednou.

## 5. Krizová karta a plán péče

### Diagnóza – první záložka

Záložky detailu jdou v pořadí **Krizová karta, Diagnóza, Plán péče, Léky, Deník, …**. Záložka **Diagnóza** ukazuje diagnózy, obvyklý funkční stav a alergie. Lékař je vpravo může upravit (**Uložit** vytvoří novou verzi plánu péče s jeho podpisem).

![Detail pacienta – Diagnóza](/napoveda/img/c-dg.png)

### Léky – jedna agenda

Záložka **Léky** je jediné místo, kde se léky vedou. U pacienta **propojeného s PéčeDoma** jsou léky jedny pro portál i Kartu: Karta je čte přímo z PéčeDoma (Data klienta → Léky) a tým je tady může i měnit – **Přidat lék**, **Upravit**, **Vyřadit** (lék se v PéčeDoma zneaktivní, historie zůstává). Totéž hned vidí sestry v PéčeDoma, krizová karta, telefon u pacienta i Můj průkaz (telefony při nejbližší synchronizaci). U pacienta bez propojení jsou léky součástí plánu péče a mění je lékař (**Uložit** = nová verze plánu).

Léky jsou ve čtyřech skupinách stejně jako v PéčeDoma: **SOS léky** (záchranné), **Opioidy** (silná analgetika podávaná pravidelně – morfin, fentanyl, buprenorfin, oxykodon…), **Pravidelná medikace** (ostatní léky) a **Parenterálně** (injekce a infuze sestry). Skupinu vybíráte v poli **Typ** při přidání nebo úpravě léku; opioidy jsou v krizové kartě zvlášť pod SOS léky, aby je posádka ZZS i lékař viděli na první pohled.

![Léky – jedna agenda s PéčeDoma](/napoveda/img/c-leky.png)

![Přidání léku z Karty do PéčeDoma](/napoveda/img/c-leky-pridat.png)

### Krizová karta

Vpravo pod telefonem u pacienta je panel **Výjezdy záchranné služby** – posledních 10 zápisů posádek (nejnovější nahoře), starší jsou v Deníku. Stejné zápisy vidí posádka na zamčené kartě.

V detailu pacienta jsou vysvětlující poznámky sbalené na konci každé záložky v bloku **ⓘ Vysvětlivky** (rozbalí se klepnutím), aby záložky ukazovaly jen údaje a tlačítka.

![Detail pacienta – krizová karta](/napoveda/img/c-karta.png)

Záložka **Krizová karta** ukazuje přesně to, co vidí posádka ZZS na telefonu bez přihlášení: nahoře **diagnózu** a funkční stav, pak cíl péče, limitace s dokladem, SOS léky, alergie, telefon na garanta a lékaře, kontakty. Limitace je pro posádku závazná jen s doloženým dříve vysloveným přáním nebo rozhodnutím lékaře – karta proto vždy uvádí doklad.

Tlačítka: **Potvrdit revizi plánu** (lékař), **Výpis do dokumentace** (text celého průkazu pro zdravotnickou dokumentaci, ke zkopírování nebo stažení), **Tisk karty**. Panel **Telefon u pacienta** ukáže číslo připojeného telefonu s kartou týmu (klepnutím se volá), poslední spojení, baterii a jestli má telefon aktuální verzi plánu; stejné číslo je i v hlavičce detailu („karta týmu: +420 …“) a ve sloupci Telefon v přehledu pacientů (od 0.11.59).

U pacienta propojeného s PéčeDoma má krizová karta zelený oddíl **PŘÍŠTÍ NÁVŠTĚVA · PéčeDoma** – nejbližší plánovaná návštěva z kalendáře FK (kdy a kdo: lékař, sestra). Je přímo v kartě a v tisku karty; na telefonu u pacienta se ukáže až po odemknutí lékařem nebo členem týmu (zamčená karta pro záchranku, rodina ani Můj průkaz ji neukazují – termín rodině sděluje tým); když v kalendáři nic není, karta to napíše. Vedle karty je panel **PéčeDoma** s posledními dvěma zprávami a tlačítkem **💬 Chat PéčeDoma s klientem**: stejné vlákno zpráv jako v PéčeDoma (Data klienta → Zprávy) – klient ho vidí ve své aplikaci PéčeDoma, rodina a tým v telefonu s kartou. Píšete jako Tým PéčeDoma se značkou [Karta · vaše jméno]; zprávy označené SMS odešly z PéčeDoma i textovou zprávou.

![Chat PéčeDoma s klientem z Karty pacienta](/napoveda/img/c-chat-pecedoma.png)

Panel **Od pacienta** ukazuje, co pacient vede v aplikaci Můj průkaz – hodnoty a přání, poznámky a otázky, záznam podání léků (od verze 0.11.26 se přenášejí **automaticky** při každé změně v jeho telefonu; dřív jen po ručním odeslání v oddílu Sdílet). U každé položky je původ (např. „jak si pamatuji rozhovor se zdravotníkem“) a datum aktualizace. Jsou to údaje pacienta, ne lékařský záznam ani dříve vyslovené přání; v deníku je o tom zápis **Sdíleno pacientem**.

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
- Zápisy **nelze mazat ani měnit**, jen doplňovat.
- Zápisy z telefonu mají čas, kdy byly pořízeny, i když se odeslaly později. Zápis posádky ZZS je označený jako neověřený.

### Důležité kontakty

![Důležité kontakty pacienta](/napoveda/img/c-kontakty.png)

Záložka **Důležité kontakty** ukazuje jeden seznam **v pořadí, jak se kontakty zobrazují** v krizové kartě a na telefonu; vedle něj je formulář, takže při zapisování nového kontaktu vidíte, kdo už tam je. Každý kontakt má skupinu, jméno a vztah, telefon a poznámku (např. „volat jako první“). Tři skupiny: **Rozhoduje** (zástupce, opatrovník, určená osoba – tuto skupinu přiděluje jen lékař na základě dokladu), **Informovat** (rodina a blízcí) a **Pečuje** (hospic, lékaři, nemocnice).

- **Přidat kontakt** zařadí nový kontakt na konec seznamu; šipkami **↑ ↓** u řádku pořadí změníte (přeřazení se nezapisuje do deníku).
- **Upravit** načte kontakt do formuláře vpravo (řádek se podbarví), **Uložit změny** ho přepíše, **Zrušit** úpravu opustí. **Odebrat** kontakt skryje, v databázi zůstává.

![Úprava kontaktu přímo ve formuláři vedle seznamu](/napoveda/img/c-kontakty-upravit.png)
- Krizová karta v oddílu KOHO VOLAT bere **Nejdřív volat** ze skupiny Pečuje (přednostně hospic), pak lékaře plánu a potom **všechny ostatní kontakty** v pořadí ze seznamu (Rozhoduje první) se štítkem skupiny a poznámkou. Každé číslo je na telefonu v rámečku na samostatném řádku s ikonou sluchátka – klepnutím se rovnou volá (stejně v dlaždicích Kontakty a Tým i v Mém průkazu). Kontakty upravuje celý tým kolem pacienta.

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

**Videohovor na telefon** (záložka Krizová karta, od 0.11.45): tlačítko rozezvoní všechny telefony pacienta – kartu u lůžka i Můj průkaz, i zamčené (od 0.11.55; stačí, aby byla aplikace na obrazovce) – a hovor se otevře v okně přímo v centrále (povolte fotoaparát a mikrofon). **Zavřít okno** nechá hovor běžet na pozadí (znovu ho otevřete tlačítkem Připojit se), **Ukončit hovor** ho ukončí i pro telefon – stejně jako zavěšení červeným sluchátkem uvnitř hovoru. U probíhajícího hovoru je i **Zavolat na telefon znovu** (starý hovor ukončí a telefon rozezvoní). Když naopak zavolá rodina nebo sestra z telefonu, u pacienta se objeví červený pruh *Z telefonu u pacienta volá…* s tlačítkem **Připojit se** a v přehledu pacientů upozornění; zvonící nebo probíhající hovor je vidět **v každé agendě** jako pruh pod hlavičkou (s tlačítky Připojit se, Odmítnout a Otevřít pacienta) a centrála na něj zazvoní; stav se obnovuje každých 15 sekund. Funguje jen s nastaveným serverem videohovorů (správce, `KP_JITSI_URL`).

![Centrála – z telefonu u pacienta volá sestra](/napoveda/img/c-video.png)

![Centrála – zvonící hovor je vidět v každé agendě](/napoveda/img/c-video-pruh.png)

V panelu **Lidé, kteří odemknou kartu** je u každého člověka tlačítko **Zobrazit PIN** – ukáže jeho platný osobní PIN (zapíše se do logu přístupů); u PINu vydaného před verzí 0.11.6 nabídne vydání nového.

### Spárování telefonu

Karta pacienta je vždy jen v jednom telefonu – s číslem uvedeným u pacienta (pole **Telefon s kartou** v Detailu pacienta). Jeden telefon ale může nést průkazy **více pacientů** (typicky domov seniorů s jedním telefonem na oddělení): u každého pacienta uvedete stejné číslo a telefon spárujete pro každého zvlášť; okno Spárovat telefon ukáže, čí průkazy už na tom čísle jsou. Párovat smí garant nebo lékař v týmu.

1. Klikněte na **Poslat odkaz SMS na +420…** – pacientovi přijde SMS s odkazem, nebo na **Spárovat telefon** – otevře se okno s QR kódem a kódy.
2. Na telefonu otevřete odkaz z SMS, nebo v aplikaci karty klepněte na **Načíst QR kód fotoaparátem** a namiřte na obrazovku (kapitola 13).
3. Telefon zadá **své číslo**. Server kartu nahraje jen tehdy, když se číslo shoduje s číslem u pacienta; jiné číslo odmítne.

![Okno Spárovat telefon – QR kód, kódy a SMS](/napoveda/img/c-parovani.png)

- Párovací kód platí **30 minut**. Dokud platí ještě aspoň 10 minut, ukáže další kliknutí na Spárovat telefon i Poslat odkaz SMS **tentýž kód** – QR kód na obrazovce a odkaz v SMS jsou stejné a nové kliknutí předchozí kód neruší. Po celou dobu platnosti ho jde použít znovu **ve stejném telefonu** (stejné číslo) – typicky když kartu po spárování v Safari přidáte na plochu iPhonu: aplikace na ploše má vlastní úložiště, spárujte ji stejným kódem a kopie v Safari skončí. Jiné číslo kód nepřijme. Po vypršení klikněte znovu na Spárovat telefon.
- Po spárování se případný předchozí telefon pacienta zablokuje.
- Když SMS nejde odeslat, okno napíše proč a spárujete QR kódem.
- **Zablokovat** – ztracený telefon; při nejbližším připojení se data z něj vymažou. **Vráceno** – zablokovaný telefon, který se vrátil.
- Změna čísla v Detailu pacienta zablokuje telefon na předchozím čísle.

### Štítek na telefon

Tlačítko **🏷 Štítek na telefon** (u pacienta v záložce Telefon a PINy) nebo **🏷 Štítky na telefony** (v přehledu Pacienti, pro víc pacientů najednou) vytiskne samolepky na zadní stranu zapůjčeného telefonu. Na štítku je **komu telefon patří** (garant pacienta, např. Centrum pro léčbu bolesti; jde přepsat jedním textem pro všechny), **jméno pacienta a kód průkazu** (lze vypnout) a velkým písmem **kam volat** při nálezu nebo potížích (telefon 24/7 garanta, jinak zadané číslo). Formát: samolepky **70 × 37 mm, 3 vedle sebe a 8 pod sebou na archu A4** (Rayfilm / Avery 70 × 37, 24 kusů). V okně vyberete pacienty (předvybraní jsou ti s telefonem), počet štítků na pacienta a **první volný štítek** na načatém archu; tiskněte v měřítku 100 %.

### Kód lékaře

Tlačítko **Kód lékaře na dnešek** (jen lékař, když je telefon spárovaný) ukáže šestimístný kód pro lékaře, který k pacientovi není přiřazený (pohotovost, zástup). Kód platí **celý kalendářní den** a je pořád stejný – o půlnoci se změní. Lékař na místě ho zadá v telefonu tlačítkem **Lékař bez PINu** spolu se svým jménem; telefon ho ověří i bez signálu (přijme i včerejší kód) a odemknutí se zapíše se jménem. Stejný kód lékař najde i v **PéčeDoma** v Datech klienta (tlačítko 🪪 Kód lékaře na kartu). Každé zobrazení kódu je v logu přístupů.

### Lidé, kteří odemknou kartu

Lékaři, sestry, pečovatelé hospice i domova se **nezapisují ke každému pacientovi znovu**. Jsou jednou zapsaní v agendě **Lidé a týmy** (kapitola 11), rozdělení do týmů a mají osobní PIN. U pacienta se vybírá **celý tým** v záložce **Tým a garance → Týmy u pacienta** (kapitola 7); panel **Lidé, kteří odemknou kartu** v záložce Telefon a PINy je jen přehled – ukazuje členy vybraných týmů, kteří nejsou u pacienta deaktivovaní. Co uvidí a zapíší, určuje jejich role (kapitola 10). Když pracoviště odejde z týmu kolem pacienta, jeho týmy a lidé ztratí přístup sami.

### Rodina a jednorázové PINy

Rodině vydejte PIN přímo u pacienta: **jméno držitele**, role **rodina** a **Vydat PIN**. Šestimístný PIN předejte držiteli; když ho zapomene, tlačítko **Zobrazit PIN** u jeho řádku ukáže platný PIN (u PINů vydaných od verze 0.11.31; zobrazení se zapisuje do logu přístupů) a **Nový PIN** vydá stejnému držiteli jiný – starý přestane platit při nejbližší synchronizaci telefonu. Stejně jde vydat jednorázový PIN i komukoli, kdo není v Lidech a týmech. **Zrušit** PIN zneplatní hned.

**Záchranná služba** žádný PIN ani seznam lidí nepotřebuje – krizovou kartu vidí bez přihlášení a jméno a posádku zapíše až u zápisu výjezdu.

### Vlastní telefony pacienta a rodiny (Můj průkaz)

Pacient i jeho blízcí mohou mít průkaz ve svých telefonech – v aplikaci **Můj průkaz** (kapitola 19), **ve více telefonech najednou** (např. pacient, dcera, syn; nejvýš 6). Zpřístupňuje garant nebo lékař v týmu:

1. V panelu **Vlastní telefony pacienta a rodiny** klikněte na **Zpřístupnit pacientovi v jeho telefonu** (nebo **Zpřístupnit v dalším telefonu**).
2. Zadejte **mobil** a **komu** telefon patří (např. „dcera Jana“) – štítek se ukáže v přehledu. Kód půjde použít jen s tímto číslem.
3. **Poslat SMS** – pacientovi přijde odkaz; **text SMS vidíte v okně a můžete ho upravit nebo doplnit** (např. jméno lékaře, co má pacient udělat), značka `{odkaz}` se nahradí odkazem pro jeho telefon; aplikace ukazuje délku a počet SMS a upravený text si pamatuje pro příště (tlačítko Původní text ho vrátí). Nebo **Zobrazit QR kód (v ordinaci)** – pacient ho načte fotoaparátem.

![Zpřístupnění průkazu v telefonu pacienta](/napoveda/img/c-pacientovi.png)

- Kód platí **3 dny** a ve stejném telefonu (stejné číslo) jde během platnosti použít znovu – třeba po přidání aplikace na plochu iPhonu. Nový kód pro stejné číslo nahradí jen kopii v tom telefonu, ostatní telefony běží dál.
- **Přehled**: panel ukazuje každý telefon – komu patří, číslo, stav (**čeká** = odkaz poslán, ale ještě neotevřen, s datem odeslání a platností kódu; **zpřístupněno** s časem posledního spojení; **ukončeno**). U čekajícího odkazu jsou tlačítka **Poslat znovu** (stejný kód, znovu SMS nebo QR) a **Zrušit** (kód přestane platit).
- Pacient vidí plán, kontakty a tým. **Deník týmu, PINy ani kód lékaře do jeho telefonu nechodí** a do deníku z něj nikdo nezapisuje.
- **Ukončit přístup** (u zpřístupněného telefonu) – data od lékaře se v tom telefonu přestanou aktualizovat; ostatní telefony to neovlivní. Co už pacient má, je jeho kopie a smazat ji nelze. Ukončený záznam odeberete ze seznamu tlačítkem **Odebrat**.
- Zapůjčený telefon pro krizi to nenahrazuje: vlastní telefon je zamčený a záchranka se do něj nedostane.

## 9. Detail pacienta, dokumenty a uzavření průkazu

V záložce **Detail pacienta** (dříve Údaje) jsou identifikační údaje pacienta: jméno, rodné číslo, datum narození, pojišťovna, adresa, kde pobývá, **telefon s kartou** a od verze 0.11.4 i **e-mail pacienta** (informativní údaj, do telefonu u lůžka se neposílá; při založení z PéčeDoma se převezme).

![Detail pacienta](/napoveda/img/c-udaje.png)

- **Detail pacienta**: identifikace pacienta a **Telefon s kartou**. Upravuje garant nebo lékař (**Uložit údaje**). Identifikační údaje (jméno, RČ, adresa) zůstávají jen v centrální aplikaci; telefon dostane jméno a rok narození, AI nedostane nic z toho.
- **Informace pacientovi** – lékař tlačítkem **Potvrdit podpis** zaznamená, že pacient / zástupce dostal informace a podepsal je.
- **PéčeDoma** (panel vpravo): zda je pacient propojený s klientem PéčeDoma, kdy proběhla synchronizace, tlačítka **Otevřít PéčeDoma** (odkaz z nastavení), **Synchronizovat teď**, **Propojit s klientem PéčeDoma** / **Odpojit** (lékař nebo garant). Z PéčeDoma se přebírají **aktivní léky** (záložka Léky – jedna agenda pro portál i Kartu) a **nejbližší plánovaná návštěva**; automaticky každých 30 minut, pokud to správce zapnul. Tlačítko **💬 Chat PéčeDoma s klientem** otevře zprávy portálu (kapitola 5). Přání, poznámky a otázky, které pacient zapíše v Mém průkazu, Karta u propojeného pacienta předá i do PéčeDoma (Data klienta → **🪪 Z Karty pacienta**), takže je lékař vidí i tam.
- **Dokumenty**: dříve vyslovené přání, lékařské zprávy, informace pacientovi a jiné (PDF nebo foto do 8 MB). U každého **datum dokumentu**, **pracoviště, které ho vydalo**, a kde je originál – aby byl vždy znát původ. Vkládá garant nebo lékař, klik na dokument ho otevře.

![Dokumenty s datem a pracovištěm](/napoveda/img/c-dokumenty.png)
- **Přístupy** (garant a správce): kdo a kdy průkaz zobrazil nebo měnil.
- **Uzavřít průkaz** (garant): vyberete důvod (úmrtí, předání mimo síť, hospitalizace, na přání pacienta, jiný). Telefon se při příštím připojení vymaže a PINy přestanou platit. Předtím si pořiďte **výpis do dokumentace**.

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

Změna členů se hned promítne ke všem pacientům, kteří tým mají (kapitola 7, Týmy u pacienta): nový člen dostane přístup, odebraný ho ztratí; pracoviště nového člena se u těchto pacientů přidá do týmu kolem pacienta s rolí péče. Koho u konkrétního pacienta lékař deaktivoval, ten se změnou týmu nevrátí.

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

- **Pracoviště**: **+ Pracoviště** – název, typ (nemocnice, hospic, ambulance, praktický lékař, domov, ZZS, jiný), telefon 24/7 (toto číslo je na krizové kartě u Lékaře plánu – osobní číslo lékaře se na kartu nikdy nedává), IČO / IČP, adresa. Garantem může být jen nemocnice, hospic, ambulance nebo PL. Každý partner, který má s pacienty pracovat, musí být pracovištěm v této organizaci. Klik na řádek pracoviště upraví nebo vypne.
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

Pod hlavičkou je v každém telefonu tmavomodrý pruh **KARTA TÝMU · telefon u pacienta** – tenhle telefon odemyká tým a rodina PINem a lékař v něm mění léky. Fialový pruh **KARTA PACIENTA A RODINY · vlastní telefon pacienta** má aplikace Můj průkaz (kapitola 19), kde léky nikdo nepřidává – pacient a rodina jen zaznamenávají podání. Po odemknutí ukazuje pruh karty týmu i roli a jméno, kdo ji odemkl.

![Telefon – spárování karty](/napoveda/img/k-parovani.png)

1. Na telefonu u pacienta otevřete adresu karty (`…/karta/`) nebo odkaz z SMS.
2. **iPhone**: chcete-li kartu jako aplikaci na ploše, nejdřív ji přidejte na plochu (Sdílet → **Přidat na plochu**), otevřete ji z plochy a **spárujte až tam**. Aplikace na ploše má vlastní úložiště – co se spáruje v Safari, na ploše nebude. **Android**: v Chromu menu ⋮ → Přidat na plochu / Nainstalovat aplikaci, nebo klepněte na tlačítko **Přidat kartu na plochu telefonu** na obrazovce párování (ukáže se, když to prohlížeč nabízí).
3. Klepněte na **Načíst QR kód fotoaparátem** a namiřte na QR kód v okně Spárovat telefon v centrální aplikaci (nebo kódy opište ručně, nebo otevřete odkaz z SMS – kódy se vyplní samy). Po načtení kódu se předvyplní i číslo telefonu, pro které byl kód vydán – stačí ho potvrdit tlačítkem **Potvrdit a spárovat** (jiné číslo lze přepsat).
4. Zadejte **číslo tohoto telefonu** a klepněte na **Spárovat**. Karta se nahraje jen tehdy, když číslo odpovídá číslu u pacienta.

![Telefon – načtení QR kódu fotoaparátem](/napoveda/img/k-qr.png)

- Telefon poprvé požádá o přístup k fotoaparátu – povolte ho. Když ho omylem zakážete, povolte ho v nastavení telefonu, nebo kódy opište.
- Data jsou v telefonu **šifrovaná**. Telefon může nést průkazy více pacientů – každý má vlastní kartu, deník a PINy.

### Více pacientů v jednom telefonu

![Telefon – výběr pacienta při více průkazech](/napoveda/img/k-vyber.png)

Když je v telefonu víc průkazů (např. jeden telefon pro celé oddělení domova), ukáže se po spuštění a po každém zamknutí **výběr pacienta**: jméno, kód průkazu, pobyt a upozornění (probíhá zhoršení, zápisy čekající na odeslání, stará data). Klepnutím na pacienta se otevře jeho zamčená krizová karta a dál vše funguje jako s jedním průkazem; šipka zpět v hlavičce vrátí na výběr. **Přidat další průkaz do tohoto telefonu** otevře spárování – stávající průkazy zůstanou. Všechny průkazy se synchronizují samy; průkaz z telefonu odebere centrální aplikace (zablokování telefonu u pacienta nebo uzavření průkazu), ostatní zůstanou.
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

![Telefon – lékař upravuje léky](/napoveda/img/k-leky-lekar.png) U pacienta propojeného s PéčeDoma má krizová karta po odemknutí lékařem nebo členem týmu zelený oddíl **PŘÍŠTÍ NÁVŠTĚVA · PéčeDoma** (kdy a kdo přijde; zamčená karta a rodina ho nevidí) a SOS léky v kartě jsou ty z PéčeDoma. Po odemknutí je na Kartě i panel **PéčeDoma** s posledními dvěma zprávami (vidět rovnou, bez rozklikávání) a tlačítkem **💬 Napsat týmu PéčeDoma**; celé vlákno – všechno, co pacient a rodina napsali z Mého průkazu nebo z aplikace PéčeDoma, a odpovědi týmu – má od 0.11.34 vlastní dlaždici **Zprávy** s tlačítkem **💬 Odpovědět**. Lékař (i praktický) zprávy na telefonu **jen čte** – z telefonu se píše za stranu pacienta, lékař odpovídá z portálu PéčeDoma (Data klienta → Zprávy) nebo z centrály Karty, kde zpráva jde za Tým PéčeDoma: rodina nebo tým u pacienta napíše sestrám a lékaři, zpráva se objeví v PéčeDoma u klienta (Data klienta → Zprávy) i v aplikaci PéčeDoma klienta a odpověď přijde sem. Zprávy jsou barevně podle autora: **modře** píše poskytovatel (lékař, sestry, tým PéčeDoma), **fialově** strana klienta (pacient, rodina, karta u lůžka) – stejně v centrální aplikaci i v Mém průkazu. Píše se pod jménem a rolí odemknutí (např. „rodina Jana Zkušební“), chat potřebuje připojení k internetu.

![Telefon – chat s týmem PéčeDoma](/napoveda/img/k-chat.png)
![Telefon – dlaždice Zprávy s celým vláknem](/napoveda/img/k-zpravy.png)

- **Interní poznámky** (deník týmu) – jen pro tým (lékař, hospic, sestra, praktický lékař); rodina tuto dlaždici nemá (od 0.11.33). Vyberete typ zápisu (nabízí se jen to, co vaše role smí) a napíšete text; zápis se uloží pod vaším jménem. Funguje i bez signálu, odešle se při nejbližším připojení (číslo na dlaždici = kolik zápisů čeká na odeslání).

![Telefon – zápis do deníku](/napoveda/img/k-denik.png)

- **Poznámky pacienta** – přání a hodnoty, poznámky, otázky pro lékaře a záznam podání léků z aplikace Můj průkaz. Přenášejí se **automaticky** při každé změně v telefonu pacienta (je-li připojený); karta ukazuje poslední verzi každého druhu, jen ke čtení. Totéž vidí tým v centrální aplikaci v panelu Od pacienta.

![Telefon – Poznámky pacienta ze sdílení](/napoveda/img/k-od-pacienta.png)

- **Zhoršení** – průvodce: co pozoruji (dušnost, bolest, neklid…), co jsem udělal(a) (podán SOS lék, poloha…), komu jsem volal(a). **Zapsat zhoršení a zobrazit na kartě** – zhoršení se ukáže na kartě i v centrální aplikaci; po zlepšení klepněte na **Stav stabilizován**. Tlačítko **Volat** vytočí první pečující kontakt.

![Telefon – průvodce zhoršením stavu](/napoveda/img/k-zhorseni.png)

- **Plán** – cíl péče, limitace, doklad, kdo plán stanovil a do kdy platí (léky jsou na dlaždici **Léky**: SOS léky, Opioidy, Pravidelná medikace). Plán mění jen lékař v centrální aplikaci.
- **Kontakty** a **Tým** – kontakty po skupinách, garant, tým a údaje o tomto telefonu (kdy byl spárován, poslední spojení, co čeká na odeslání).

### Videohovor

![Telefon – dlaždice Videohovor](/napoveda/img/k-video.png)

Po odemknutí PINem (rodina i tým) je na kartě dlaždice **Videohovor**. Nahoře je tlačítko **Spustit videokonferenci**, pod ním **seznam členů týmu u pacienta** – u každého jde rovnou **zavolat** nebo **poslat SMS s výzvou k připojení** (text se jménem pacienta a vaším jménem se předvyplní v aplikaci SMS telefonu, stačí odeslat). Nejdříve kolegu informujte, že s ním chcete hovořit přes videokonferenci, pak klepněte na Spustit videokonferenci – otevře hovor přes celou obrazovku; lékař nebo sestra ho vidí v centrální aplikaci u pacienta (červený pruh *Z telefonu u pacienta volá…*) a klepnutím **Připojit se** se přidá. Na konci klepněte na **Ukončit**. Hovor vede server videohovorů Jitsi, který provozuje vaše organizace (nastavuje správce, `deploy/vps-jitsi.sh`); nikam se nenahrává, do deníku jde jen zápis *Videohovor zahájen / ukončen (x min)*.

![Telefon – příchozí videohovor z centrály](/napoveda/img/k-video-zvoni.png)

Když lékař zavolá z centrály (u pacienta tlačítko **Videohovor na telefon**), zazvoní **všechny telefony pacienta** – karta u lůžka i Můj průkaz (kapitola 19) – **v jakémkoli stavu**: zamčená karta, i výběr pacienta, je-li v telefonu více průkazů (telefon si pacienta sám otevře). Uprostřed obrazovky se otevře okno **Příchozí videohovor** se jménem volajícího a tlačítky **Přijmout** a **Odmítnout**; telefon zvoní a vibruje, dokud někdo hovor nevezme (nebo lékař nezavěsí). Přijmout může kdokoli u lůžka bez PINu. Hovor ukončíte tlačítkem **Ukončit** nahoře, nebo červeným sluchátkem uvnitř hovoru – obojí ho ukončí i pro centrálu. Jediná podmínka: aplikace je na obrazovce (v kiosku je vždy) – upozornění mimo aplikaci se neposílá. V kiosku na Androidu (aplikace 0.1.8 a novější) telefon při hovoru z centrály **sám probudí zhasnutý displej** a karta zazvoní; během zvonění a hovoru displej nezhasne. Nepřijatý hovor po 15 minutách skončí sám. Dlaždice se neukáže, dokud správce server videohovorů nenastaví.

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
- **Můj průkaz** (vlastní telefon pacienta): data jsou šifrovaná dvakrát – PINem pacienta a klíčem telefonu. Vlastní přání, poznámky a záznamy podání léků jsou jen v jeho telefonu; provozovatel ani tým je nevidí, dokud je pacient sám nepošle (výběr → náhled → potvrzení).
- **AI jen anonymně**: rozbor propouštěcí zprávy i chat nápovědy dostávají text až po anonymizaci (jména, rodná čísla, data, adresy, telefony, e-maily → značky). Když v textu zůstane něco jako identifikátor, dotaz se neodešle.
- Deník, historie garance, verze plánu a log přístupů nejde mazat ani přepisovat.

## 18. Časté otázky

**Telefon hlásí „Kód je neplatný nebo vypršel“.** Obrazovka párování se po této hlášce vrátí k tlačítku **Načíst QR kód fotoaparátem** a polím pro opsání kódů, takže nový kód načtete hned; prošlý odkaz z adresy zmizí a při dalším spuštění už se nenabízí. Tlačítko **Mám jiný kód** je i u načteného kódu. Nejčastěji byl kód mezitím nahrazen novým (každé další Spárovat telefon nebo Poslat SMS po vypršení vydá nový kód) nebo uběhlo 30 minut. Otevřete v centrální aplikaci Spárovat telefon znovu a použijte kód, který je na obrazovce teď; v kioskové aplikaci bez fotoaparátu ho opište ručně i s kódem organizace. Kiosková aplikace nesmí při nečinnosti mazat data webu (cache, úložiště), jinak se karta z telefonu ztratí a bude chtít spárovat znovu.

**Po přidání karty na plochu iPhonu se aplikace ptá znovu na kódy / hlásí neplatný kód.** Aplikace na ploše má vlastní úložiště, co se spárovalo v Safari, na ploše není. Od verze 0.11.10 použijte v aplikaci na ploše **stejný kód** (odkaz z SMS nebo Načíst QR kód fotoaparátem, kapitola 13) – kód platí 30 minut (Můj průkaz 3 dny) i po prvním spárování; kopie v Safari tím skončí. Po vypršení vydejte v centrální aplikaci nový kód.

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

**Pacient zapomněl PIN do Můj průkaz.** PIN nikdo neobnoví. Pacient v aplikaci zvolí Zapomněl(a) jsem PIN → Smazat vše a začít znovu a vy mu vydáte nový kód. Jeho vlastní záznamy, které předtím neposlal ani nevytiskl, jsou ztracené.

**Je to, co pacient napíše do Můj průkaz, dříve vyslovené přání?** Ne. Je to jeho osobní záznam. Platné DVP vyžaduje písemné poučení lékařem a úředně ověřený podpis (nebo zápis při přijetí do péče) – evidujte ho v plánu péče a v dokumentech.

**Data na telefonu jsou stará.** Připojte telefon k internetu a klepněte na pruh s časem aktualizace (synchronizovat). Karta se synchronizuje i sama při každém otevření a každých 5 minut.

## 19. Můj průkaz – průkaz ve vlastním telefonu pacienta

Aplikace **Můj průkaz** (`/pacient/`) je pro soběstačné pacienty, kteří chtějí mít svůj průkaz u sebe a připravit se na rozhovor s lékařem. Na rozdíl od zapůjčeného telefonu (kapitola 13) běží ve vlastním telefonu pacienta vedle jiných aplikací a otevírá ji jen pacient svým PINem.

### Propojení

1. Lékař průkaz zpřístupní (kapitola 8) – přijde SMS s odkazem, nebo lékař ukáže QR kód.
2. Otevřete odkaz v telefonu (nebo `/pacient/` → **Načíst QR kód fotoaparátem**). Číslo vašeho telefonu je po načtení kódu předvyplněné – stačí klepnout na **Potvrdit a propojit** (kód byl vydán právě pro vaše číslo; jiné číslo lze přepsat).
3. Nastavte si **PIN** (6–12 číslic, dvakrát). Tímto PINem budete Můj průkaz otevírat a jím jsou data v telefonu zašifrovaná.

![Propojení s průkazem](/napoveda/img/p-propojeni.png)
![Nastavení PINu](/napoveda/img/p-pin.png)

> Na iPhonu nejdřív přidejte Můj průkaz na plochu (Sdílet → Přidat na plochu) a propojte ho až v aplikaci na ploše.

Je-li pacient propojený s PéčeDoma, je na hlavní stránce Průkaz hned pod krizovou kartou panel **Zprávy pro a od lékaře** – poslední dvě zprávy jsou vidět rovnou bez rozklikávání (načítají se na pozadí, naposledy načtené zůstanou i bez připojení), tlačítko otevře celé vlákno a odpověď; stejné zprávy jako v aplikaci PéčeDoma; lékař a sestry je vidí u klienta v portálu a odpoví sem. Ve vlákně je pacient označený „Vy“, druhá strana „Lékař a tým“.

![Můj průkaz – Zprávy pro a od lékaře](/napoveda/img/p-zpravy-chat.png)

### Co v aplikaci najdete

Vysvětlující texty nejsou mezi údaji: obrazovka ukazuje jen důležité informace a tlačítka, všechny vysvětlivky jsou až dole v bloku **ⓘ Vysvětlivky**, který se rozbalí klepnutím.

![Můj průkaz – přehled s krizovou kartou](/napoveda/img/p-prehled.png)

- **Průkaz** – krizová karta tak, jak ji vede váš lékař, a přehled vašich záznamů.
- **Od lékaře** – plán péče, doklad k limitacím, SOS léky, léky podle lékaře, kontakty a tým. Vše je **jen ke čtení** a s původem (kdo a kdy plán stanovil). Mění to jen lékař.
- **Přání** – vaše hodnoty a přání: co je pro vás důležité, čeho se obáváte, co mají lékaři zohlednit, koho chcete mít u rozhodování. U záznamu vyberte, **odkud je**: vlastní příprava, jak si pamatujete rozhovor se zdravotníkem (s kým, kdy), nebo opsáno ze záznamu zdravotníka.
- **Léky** – **Předepsané léky** od lékaře, rozdělené jako v centrální aplikaci na SOS léky, opioidy a pravidelnou medikaci. Léky předepisuje a mění jen lékař, v telefonu je nejde přidat ani upravit. U každého léku klepnete na **Podán**, když ho vezmete (u SOS léků i vícekrát za den), nebo **Nepodán**, když jste ho vynechali; u léku je hned vidět, kdy byl podán naposled a co bylo dnes, **Historie** ukáže všechny dny. Záznamy zůstávají v telefonu a nejde je měnit ani mazat; týmu je pošlete v oddílu Sdílet.
- **Poznámky pacienta** – otázky pro lékaře a poznámky, jak se máte. Přání, poznámky, otázky i záznam podání léků vidí **tým automaticky** – v centrální aplikaci (panel Od pacienta) i na kartě u lůžka (dlaždice Poznámky pacienta); u přání a poznámek je zelený pruh s časem posledního odeslání, bez připojení se změna pošle při nejbližší synchronizaci. Oddíl **Sdílet** slouží k tisku a poslání jinam; prázdné položky jsou v něm šedě s radou, kde je vyplnit. U pacienta propojeného s PéčeDoma jdou přání, poznámky a otázky automaticky i lékaři do portálu PéčeDoma (Data klienta → záložka **🪪 Z Karty pacienta**). Termín příští návštěvy se v Mém průkazu neukazuje – pacient ho má od týmu.
- **Sdílet** – souhrn k tisku nebo k předání (níže).
- **Nouzové info** – text do Zdravotního ID na zamčené obrazovce.
- **Nastavení** – změna PINu, smazání všeho z telefonu.

![Moje hodnoty a přání](/napoveda/img/p-prani.png)
![Předepsané léky s denním záznamem podání](/napoveda/img/p-leky.png)

> **Přání v aplikaci není dříve vyslovené přání podle zákona.** Platné DVP se sepisuje písemně s poučením od lékaře a s úředně ověřeným podpisem (nebo při přijetí do péče u konkrétního poskytovatele). Poraďte se se svým lékařem.

### Sdílení a tisk

1. V oddílu **Sdílet** zaškrtněte, co chcete předat (u každé položky je, zda je *od lékaře*, nebo *údaj pacienta*, a kdy byla aktualizovaná).
2. **Zobrazit náhled** – uvidíte přesně to, co předáte, s datem vytvoření a původem každé položky.
3. Vyberte: **Vytisknout / PDF**, **Poslat svému týmu** (ruční odeslání se zápisem do deníku týmu – vaše záznamy tým vidí i tak automaticky, tohle se hodí, když chcete výslovně upozornit), nebo **Poslat jinam** (e-mail, zpráva).

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

### Videohovor od lékaře

![Zamčený Můj průkaz – volá lékař](/napoveda/img/p-video-zvoni.png)

Když vám lékař zavolá z centrální aplikace (u pacienta tlačítko **Videohovor na telefon**), Můj průkaz **zazvoní i zamčený** – uprostřed obrazovky se otevře okno **Příchozí videohovor** se jménem lékaře a tlačítky **Přijmout** a **Odmítnout**; zvoní a vibruje, dokud hovor nevezmete nebo lékař nezavěsí. Přijmout jde bez PINu; hovor se otevře přes celou obrazovku a na konci klepněte na **Ukončit** nahoře (nebo na červené sluchátko uvnitř hovoru – obojí hovor ukončí i pro lékaře). Během hovoru se průkaz nezamyká. Podmínka je jediná: **Můj průkaz musí být na obrazovce** (aplikace otevřená, telefon odemčený) – za to odpovídá majitel telefonu; upozornění mimo aplikaci se neposílá. Nepřijatý hovor po 15 minutách skončí sám. Zvonění zařizuje zvláštní klíč jen pro hovory, který je v telefonu uložený bez PINu – k údajům průkazu s ním nikdo nepřistoupí. Z Mého průkazu hovor zahájit nejde, jen přijmout.

## 20. Průkaz pro plán péče – prototyp pacientem řízené karty

Samostatná aplikace na adrese `/prukaz/` podle zadání MUDr. Kabelky (Dialogus, verze 0.1, říjen 2026). Na rozdíl od Mého průkazu (kapitola 19) **nemá žádný server ani garanta**: kartu si pacient založí sám, všechno zůstává jen v jeho telefonu, šifrované PINem, a o každém sdílení rozhoduje pacient. Je to prototyp k diskusi, ne součást ostré sítě Karty pacienta.

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
