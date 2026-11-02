@echo off
rem Karta pacienta - dokonceni noveho telefonu po QR kodu (Windows). Postup: CTI-ME-Windows.txt
rem Aligator S6600: pruvodce Androidu po nastaveni spravce zarizeni spadne a vrati se na skener QR kodu.
rem Spravce i aplikace uz jsou v telefonu - skript jen oznami pruvodci, ze nastaveni je hotove, a telefon restartuje.
rem Texty bez diakritiky zamerne (cmd.exe s cestinou v UTF-8 nespolehlive).
setlocal EnableDelayedExpansion
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

echo Cekam na telefon - kabel do PC, na telefonu potvrdit dotaz "Povolit ladeni USB?" a zaskrtnout Vzdy povolit.
set /a POKUS=0
:cekej
set "STAV="
for /f "skip=1 tokens=2" %%s in ('call "%ADB%" devices 2^>nul') do if not defined STAV set "STAV=%%s"
if "!STAV!"=="device" goto pripojen
if "!STAV!"=="unauthorized" echo   - na telefonu potvrdte dotaz "Povolit ladeni USB?" - zaskrtnout Vzdy povolit z tohoto pocitace
if not defined STAV echo   - telefon neni videt: datovy kabel bez redukce, odpojit a pripojit; ovladac viz CTI-ME-Windows.txt
set /a POKUS+=1
if !POKUS! GEQ 60 goto nepripojen
timeout /t 3 /nobreak >nul
goto cekej

:pripojen
echo Telefon pripojen. Kontroluji spravce zarizeni...
call "%ADB%" shell dumpsys device_policy | findstr /c:"cz.centrumlb.kartapacienta" >nul
if errorlevel 1 goto nenispravce
call "%ADB%" shell settings put global device_provisioned 1
call "%ADB%" shell settings put secure user_setup_complete 1
echo.
echo HOTOVO - telefon se restartuje. Po startu klepnete na ikonu Karta pacienta:
echo zapne se kiosk a ukaze se okno Sparovat telefon s prukazem.
call "%ADB%" reboot
echo.
pause
exit /b 0

:nenispravce
echo.
echo Aplikace Karta pacienta NENI spravcem zarizeni - zavedeni QR kodem neprobehlo cele.
echo Telefon resetujte a naskenujte QR kod znovu, pak spustte tento skript.
pause
exit /b 1

:nepripojen
echo.
echo Telefon se nepripojil. Zkuste jiny kabel nebo port, pripadne ovladac - viz CTI-ME-Windows.txt
pause
exit /b 1

:chybiadb
echo.
echo Chybi nastroj adb. Stahnete Platform-Tools pro Windows:
echo   https://dl.google.com/android/repository/platform-tools-latest-windows.zip
echo a rozbalte ho do C:\KartaPacienta - vznikne C:\KartaPacienta\platform-tools\adb.exe.
echo Automaticke stazeni se nepovedlo - zkontrolujte internet. Pak skript spustte znovu.
pause
exit /b 1
