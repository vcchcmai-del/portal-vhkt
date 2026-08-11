@echo off
REM Sao luu tu dong, khong dung lai cho nguoi bam phim — dung cho Task Scheduler.
REM Ban muon sao luu bang tay, dung 3-SAO-LUU.bat thay cho file nay.
chcp 65001 >nul
cd /d "%~dp0"

set "DATA_DIR=%~dp0..\data"
set "STAMP=%date:~-4%-%date:~3,2%-%date:~0,2%_%time:~0,2%%time:~3,2%"
set "STAMP=%STAMP: =0%"

if not exist "%DATA_DIR%\backups" mkdir "%DATA_DIR%\backups"
if not exist "%DATA_DIR%\portal.db" exit /b 1

copy "%DATA_DIR%\portal.db" "%DATA_DIR%\backups\portal-%STAMP%.db" >nul

REM Chi giu 12 ban gan nhat (khoang 3 thang neu chay hang tuan), xoa bot ban cu de khoi day o.
for /f "skip=12 delims=" %%f in ('dir "%DATA_DIR%\backups\portal-*.db" /b /o-d 2^>nul') do del "%DATA_DIR%\backups\%%f"

exit /b 0
