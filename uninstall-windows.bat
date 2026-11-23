@echo off
REM Removes YSMediaCore from After Effects.
set DEST=%APPDATA%\Adobe\CEP\extensions\YSMediaCore
if exist "%DEST%" (
  rmdir /S /Q "%DEST%"
  echo YSMediaCore was removed from %DEST%
) else (
  echo YSMediaCore is not installed.
)
echo.
set /p DBG=Also turn off "allow unsigned panels" (PlayerDebugMode)? Other panels may need it. [y/N]: 
if /I "%DBG%"=="y" (
  for %%V in (9 10 11 12) do reg delete HKCU\Software\Adobe\CSXS.%%V /v PlayerDebugMode /f >nul 2>&1
  echo PlayerDebugMode removed.
)
set /p CFG=Also delete your saved settings (%APPDATA%\YSMediaCore)? [y/N]: 
if /I "%CFG%"=="y" rmdir /S /Q "%APPDATA%\YSMediaCore"
echo Restart After Effects to finish.
pause
