@echo off
rem Karta pacienta - nahrani / aktualizace kioskove aplikace kabelem (Windows). Postup: CTI-ME-Windows.txt
rem Bez parametru stahne aktualni APK ze serveru Karty; s parametrem nahraje zadany soubor:
rem   nahrat-telefon.cmd C:\cesta\kartapacienta.apk
rem Novy telefon (bez uctu) nastavi jako spravce zarizeni = kiosk; telefonu, ktery uz kiosk je, jen aktualizuje aplikaci.
setlocal EnableDelayedExpansion
set "BALIK=cz.centrumlb.kartapacienta"
set "URL=https://kartapacienta.95-216-201-2.sslip.io/android/kartapacienta.apk"
rem Nastroje (adb) a stazena aplikace se ukladaji mimo Dropbox do C:\KartaPacienta - skript jde spustit primo z Dropboxu.
set "NASTROJE=C:\KartaPacienta"
if not exist "%NASTROJE%" mkdir "%NASTROJE%" >nul 2>&1
if not exist "%NASTROJE%" set "NASTROJE=%LOCALAPPDATA%\KartaPacienta"
if not exist "%NASTROJE%" mkdir "%NASTROJE%" >nul 2>&1
cd /d "%NASTROJE%"
set "ADB=%~dp0platform-tools\adb.exe"
if exist "%ADB%" goto mamadb
set "ADB=%NASTROJE%\platform-tools\adb.exe"
if exist "%ADB%" goto mamadb
set "ADB=adb"
call "%ADB%" version >nul 2>&1
if not errorlevel 1 goto mamadb
echo Stahuji nastroj adb od Googlu - jen poprve, asi 10 MB...
curl.exe -fsSL -o "%NASTROJE%\platform-tools.zip" "https://dl.google.com/android/repository/platform-tools-latest-windows.zip"
if errorlevel 1 goto chybiadb
tar.exe -xf "%NASTROJE%\platform-tools.zip" -C "%NASTROJE%"
if errorlevel 1 goto chybiadb
del "%NASTROJE%\platform-tools.zip" >nul 2>&1
set "ADB=%NASTROJE%\platform-tools\adb.exe"
if not exist "%ADB%" goto chybiadb
echo   - adb ulozen v %NASTROJE%\platform-tools
:mamadb
call "%ADB%" version >nul 2>&1
if errorlevel 1 goto chybiadb
call "%ADB%" start-server >nul 2>&1

set "APK=%~1"
if not "%APK%"=="" goto mamapk
set "APK=%NASTROJE%\kartapacienta-release.apk"
echo Stahuji aktualni aplikaci ze serveru Karty...
curl.exe -fsSL -o "%APK%.novy" "%URL%"
if errorlevel 1 goto stazeniselhalo
move /y "%APK%.novy" "%APK%" >nul
goto mamapk
:stazeniselhalo
del "%APK%.novy" >nul 2>&1
if not exist "%APK%" goto chybiapk
echo   - stazeni se nepovedlo, pouziji drive stazeny soubor
:mamapk
if not exist "%APK%" goto chybiapk

echo Cekam na telefon - kabel do PC, na telefonu potvrdit dotaz "Povolit ladeni USB?" a zaskrtnout Vzdy povolit.
set /a POKUS=0
:cekej
set "STAV="
for /f "skip=1 tokens=2" %%s in ('call "%ADB%" devices 2^>nul') do if not defined STAV set "STAV=%%s"
if "!STAV!"=="device" goto pripojen
if "!STAV!"=="unauthorized" echo   - na telefonu potvrdte dotaz "Povolit ladeni USB?" - zaskrtnout Vzdy povolit z tohoto pocitace
if not defined STAV echo   - telefon neni videt: datovy kabel, odpojit a pripojit; na telefonu zapnute ladeni USB; ovladac viz CTI-ME-Windows.txt
set /a POKUS+=1
if !POKUS! GEQ 60 goto nepripojen
timeout /t 3 /nobreak >nul
goto cekej

:pripojen
echo Telefon pripojen. Nahravam aplikaci...
call "%ADB%" install -r "%APK%" > "%TEMP%\kp-install.txt" 2>&1
type "%TEMP%\kp-install.txt"
findstr /c:"Success" "%TEMP%\kp-install.txt" >nul
if errorlevel 1 goto instalaceselhala

call "%ADB%" shell dumpsys device_policy | findstr /c:"%BALIK%" >nul
if not errorlevel 1 goto jespravce
echo Nastavuji spravce zarizeni - kiosk...
call "%ADB%" shell dpm set-device-owner %BALIK%/.AdminReceiver > "%TEMP%\kp-dpm.txt" 2>&1
type "%TEMP%\kp-dpm.txt"
findstr /c:"Success" "%TEMP%\kp-dpm.txt" >nul
if errorlevel 1 goto spravceselhal
goto spustit
:jespravce
echo Spravce zarizeni uz je nastaven - kiosk.

:spustit
call "%ADB%" shell am force-stop %BALIK% >nul 2>&1
call "%ADB%" shell am start --user 0 -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n %BALIK%/.MainActivity >nul 2>&1
set "VERZE=?"
for /f "tokens=2 delims==" %%v in ('call "%ADB%" shell dumpsys package %BALIK% ^| findstr /c:"versionName"') do set "VERZE=%%v"
echo.
echo HOTOVO - aplikace verze %VERZE% je v telefonu a karta je spustena.
echo Na telefonu zkontrolujte kiosk - bez tlacitka Domu - a v servisnim menu verzi.
pause
exit /b 0

:instalaceselhala
echo.
findstr /c:"UPDATE_INCOMPATIBLE" "%TEMP%\kp-install.txt" >nul
if errorlevel 1 goto konecchyba
echo V telefonu je aplikace s jinym podpisem - ladici verze. Telefon resetujte a zavedte QR kodem,
echo nebo ji nejdriv odeberte: platform-tools\adb shell dpm remove-active-admin %BALIK%/.AdminReceiver
echo a potom: platform-tools\adb uninstall %BALIK%
goto konecchyba

:spravceselhal
echo.
findstr /c:"accounts" "%TEMP%\kp-dpm.txt" >nul
if not errorlevel 1 echo V telefonu je ucet - Google apod. Odeberte ho v Nastaveni - Ucty a spustte skript znovu.
findstr /c:"owner is already set" "%TEMP%\kp-dpm.txt" >nul
if not errorlevel 1 echo Telefon spravuje jina aplikace - pomuze jen tovarni reset.
goto konecchyba

:nepripojen
echo.
echo Telefon se nepripojil. Zkuste jiny kabel nebo port, pripadne ovladac - viz CTI-ME-Windows.txt
goto konecchyba

:chybiapk
echo.
echo Neni k dispozici soubor aplikace a stazeni ze serveru se nepovedlo - zkontrolujte internet.
goto konecchyba

:chybiadb
echo.
echo Chybi nastroj adb. Stahnete Platform-Tools pro Windows:
echo   https://dl.google.com/android/repository/platform-tools-latest-windows.zip
echo a rozbalte ho do C:\KartaPacienta - vznikne C:\KartaPacienta\platform-tools\adb.exe.
echo Automaticke stazeni se nepovedlo - zkontrolujte internet. Pak skript spustte znovu.

:konecchyba
pause
exit /b 1
