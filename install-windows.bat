@echo off
REM YUESHI MEDIA CORE (YSMediaCore) - installs for the current user and allows unsigned panels.
set DEST=%APPDATA%\Adobe\CEP\extensions\YSMediaCore
REM remove the earlier "Media Scrub" version so only one panel is listed
if exist "%APPDATA%\Adobe\CEP\extensions\MediaScrub" rmdir /S /Q "%APPDATA%\Adobe\CEP\extensions\MediaScrub"
xcopy /E /I /Y "%~dp0" "%DEST%" >nul
for %%V in (9 10 11 12) do reg add HKCU\Software\Adobe\CSXS.%%V /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
echo Installed to %DEST%
echo Restart After Effects, then open Window ^> Extensions ^> YSMediaCore
pause
