# Karta pacienta pro domácnost – podklady pro Google Play

Texty a obrázky pro záznam v obchodě Google Play (aplikace `cz.centrumlb.mujprukaz`, sestavení viz `prukaz-android/README.md`).
Limity znaků jsou limity Play Console.

## Obrázky

- Ikona 512×512: `public/icons/icon-512.png`
- Grafika záhlaví 1024×500: `docs/play/grafika-1024x500.png`
- Snímky obrazovky telefonu (1170×2340, smyšlená data z napodobeného API): `docs/play/snimky/1-propojeni.png` … `6-zamek.png`
  (Play chce 2–8 snímků, poměr stran nejvýš 2:1)

## Název aplikace (max 30 znaků)

```
Karta pacienta pro domácnost
```

## Krátký popis (max 80 znaků)

```
Paliativní průkaz ve vlastním telefonu: plán péče, přání, léky, zprávy s týmem
```

## Úplný popis (max 4000 znaků)

```
Karta pacienta pro domácnost (v aplikaci „Můj průkaz“) je paliativní průkaz pacienta v domácí péči – pro pacienta a jeho blízké, ve vlastním telefonu. Průkaz zakládá pečující tým poskytovatele domácí paliativní péče a aplikace ho s týmem propojuje.

CO V APLIKACI NAJDETE

• Průkaz pacienta – cíl péče a jeho limity, plán péče od lékaře, koho volat a kdy; vše i bez signálu.
• Přání a hodnoty – co je pro pacienta důležité, čeho se obává, jak chce rozhodovat; tým to vidí hned.
• Léky – předepsané léky a záchranná medikace od lékaře, záznam podání jedním klepnutím.
• Poznámky a otázky pro lékaře – co se v noci stalo, na co se zeptat při návštěvě.
• Zprávy s týmem – jedno vlákno s pečujícím týmem, odpověď přijde zpět do aplikace.
• Videohovor – tým může zavolat přímo do aplikace, stačí přijmout.
• Nouze – co dělat, komu volat, jaký doklad ukázat záchranné službě.

JAK ZAČÍT

Aplikaci spárujete kódem průkazu, který vydá váš pečující tým (ukáže ho telefon u pacienta nebo centrála poskytovatele). Bez kódu aplikace nic neukazuje. Průkaz si zamknete vlastním PINem.

BEZPEČNOST A SOUKROMÍ

• Průkaz je v telefonu uložený šifrovaně, odemyká ho PIN.
• Údaje se předávají jen pečujícímu týmu poskytovatele, nikomu jinému; žádná reklama, žádná analytika.
• Do telefonu pacienta nikdy nepřicházejí interní záznamy týmu ani přístupové kódy zdravotníků.
• Fotoaparát slouží jen k načtení kódu průkazu, mikrofon a kamera k videohovoru – vždy jen s vaším souhlasem.
• Údaje z telefonu smažete volbou Odebrat průkaz.

PRO KOHO JE APLIKACE

Pro pacienty v domácí paliativní péči a jejich rodiny u poskytovatelů, kteří používají Kartu pacienta on-line (Centrum pro léčbu bolesti a paliativní medicínu s.r.o., Zlín a jeho partneři). Zásady ochrany soukromí: https://kartapacienta.95-216-201-2.sslip.io/ochrana-soukromi.html
```

## Nastavení aplikace (úkoly v Play Console)

- **Zásady ochrany soukromí:** https://kartapacienta.95-216-201-2.sslip.io/ochrana-soukromi.html
- **Přístup k aplikaci:** „Všechny funkce vyžadují spárování kódem průkazu od poskytovatele.“ Pro kontrolu Googlu připravte
  **zkušební průkaz** u zkušebního pacienta (v centrále Karty: Nový pacient se smyšlenými údaji → telefon pacienta → kód
  průkazu) a do formuláře napište kód a postup: Otevřít aplikaci → zadat kód → zvolit PIN. Kód platí, dokud průkaz
  neuzavřete; po schválení zkušebního pacienta uzavřete.
- **Reklamy:** ne. **Hodnocení obsahu:** dotazník (lékařské informace, bez násilí, bez nákupů). **Cílová skupina:** 18+.
- **Bezpečnost údajů:** shromažďuje osobní údaje (jméno) a zdravotní údaje (informace o zdraví); sdílí je jen s poskytovatelem péče
  (správce údajů); přenos šifrovaný; uživatel může požádat o smazání (Odebrat průkaz, poskytovatel uzavře průkaz); data se
  nepoužívají k reklamě ani analytice.
- **Zdravotní aplikace (deklarace):** lékařské informace pro pacienty / správa péče; není zdravotnický prostředek, neposkytuje diagnózu.
- **Kategorie:** Zdravotnictví. **Kontakt:** jindrich.hegmon@centrumlb.cz.

## Poznámky k verzi (první vydání)

```
První vydání aplikace Karta pacienta pro domácnost: průkaz pacienta, přání a hodnoty, léky a záznam podání, poznámky a otázky pro lékaře, zprávy a videohovor s týmem, nouzový postup.
```
