@echo off
rem Karta pacienta - dokonceni noveho telefonu po QR kodu (Windows). Postup: CTI-ME-Windows.txt
rem Aligator S6600: pruvodce Androidu po nastaveni spravce zarizeni spadne a vrati se na skener QR kodu.
rem Spravce i aplikace uz jsou v telefonu - skript jen oznami pruvodci, ze nastaveni je hotove, a telefon restartuje.
rem Texty bez diakritiky zamerne (cmd.exe s cestinou v UTF-8 nespolehlive).
setlocal EnableDelayedExpansion
cd /d "%~dp0"
set "ADB=adb"
if exist "%~dp0platform-tools\adb.exe" set "ADB=%~dp0platform-tools\adb.exe"
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
echo a rozbalte ho do slozky se skriptem, napr. C:\KartaPacienta - vznikne podslozka platform-tools s adb.exe.
echo Pak skript spustte znovu. Do systemove slozky C:\Windows nic nekopirujte.
pause
exit /b 1
