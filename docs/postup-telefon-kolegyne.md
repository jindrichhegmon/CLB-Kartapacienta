# Nový telefon pro Kartu pacienta – postup krok za krokem

Platí pro telefony **Aligator S6600**. Potřebujete: telefon, datový kabel USB, Mac s připraveným QR kódem
(soubor `provisioning-qr.html`, otevřený v prohlížeči) a Terminál. Trvá to asi 8 minut na telefon.

## 1. Tovární reset telefonu

- Telefon vypnout. Držet zároveň **zeslabení hlasitosti + zapínací tlačítko**, dokud se neobjeví nabídka.
- Tlačítky hlasitosti vybrat **Wipe data / factory reset**, potvrdit zapínacím tlačítkem, potvrdit **Factory data reset**, pak **Reboot system now**.
- (Jde to i z nastavení telefonu: Nastavení → Systém → Resetovat → Vymazat všechna data.)

## 2. QR kód

- Po restartu je na displeji uvítací obrazovka (volba jazyka). **Nic nevyplňovat.**
- Klepnout **6× rychle za sebou** na prázdné místo obrazovky. Spustí se skener.
- Namířit **zadní** kameru na QR kód na obrazovce Macu (20–30 cm, kód zvětšit přes celou obrazovku). Telefon se sám připojí k Wi‑Fi, stáhne aplikaci a ukáže „Nastavování zařízení“.
- Počkat, až skončí. **Vrátí se zpět na skener – to je u tohoto telefonu normální**, aplikace už je uvnitř. Nic dalšího neskenovat.

## 3. Kabel – potvrdit na obou stranách

- Připojit telefon kabelem k Macu (datový kabel, ne jen nabíjecí; bez redukce).
- **Na Macu** se objeví dotaz „Povolit připojení příslušenství?“ → **Povolit**.
- **Na telefonu** se objeví dotaz „Povolit ladění USB?“ → zaškrtnout **Vždy povolit z tohoto počítače** a klepnout **Povolit**.
  Když se dotaz neukáže, kabel odpojit a znovu připojit.

## 4. Dokončení na Macu Jindřicha Hegmona (zatím)

**Kdo to dělá:** tento krok dělá až do odvolání Jindřich Hegmon na svém Macu (je tam Android Studio, repozitář i QR kód).
Časem přejde na některého z kolegů; návod dostáváte e-mailem už teď, aby postup neznal jen Jindřich a Claude.

Na Macu otevřít Terminál, vložit a potvrdit Enterem:

```
cd ~/Documents/Claude/Projects/CLB-Kartapacienta && ./android/dokoncit-telefon.sh
```

Skript sám počká na telefon, a když něco chybí, napíše, co potvrdit (dotaz na telefonu, kabel). Na konci napíše
**„Hotovo – telefon se restartuje“**.

## 5. Zapnutí kiosku

- Po restartu naběhne plocha telefonu. Klepnout na ikonu **Karta pacienta**.
- Aplikace se zamkne do kiosku: zmizí tlačítka Domů a Přehled, ukáže se okno **Spárovat telefon s průkazem**. Hotovo.
- Od té chvíle telefon po každém zapnutí startuje rovnou do karty.

## 6. Při předání pacientovi

- V centrální aplikaci u pacienta: **Telefon a PINy → Spárovat telefon** → na telefonu **Načíst QR kód fotoaparátem** (nebo opsat kódy).
- V servisním menu telefonu (5× klepnout do levého horního rohu, servisní PIN) nastavit **Zhasínání displeje**.

## Když se něco nedaří

| Co se děje | Co udělat |
|---|---|
| Po 6 klepnutích se skener neobjeví | Klepat rychleji na jedno místo; funguje jen na úplně první obrazovce po resetu |
| Telefon nečte QR | Zvětšit kód na obrazovce, zadní kamera, 20–30 cm, chvíli podržet |
| „Telefon není vidět“ ve skriptu | Jiný kabel / port; na Macu povolit příslušenství; odpojit a připojit |
| Skript hlásí „čeká na potvrzení“ | Na telefonu potvrdit dotaz „Povolit ladění USB?“ |
| „NENÍ správcem zařízení“ | Zavedení neproběhlo: reset a QR znovu (krok 1 a 2) |
| Po klepnutí na ikonu není kiosk | Napsat Jindřichovi, pošle výpis z telefonu |
