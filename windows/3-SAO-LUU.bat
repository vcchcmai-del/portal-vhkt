@echo off
chcp 65001 >nul
title Sao luu du lieu
cd /d "%~dp0"

set "DATA_DIR=%~dp0..\data"
set "STAMP=%date:~-4%-%date:~3,2%-%date:~0,2%_%time:~0,2%%time:~3,2%"
set "STAMP=%STAMP: =0%"

if not exist "%DATA_DIR%\portal.db" (
  echo Khong tim thay du lieu tai %DATA_DIR%\portal.db
  pause
  exit /b 1
)

copy "%DATA_DIR%\portal.db" "%DATA_DIR%\backups\portal-%STAMP%.db" >nul
echo.
echo   Da sao luu: %DATA_DIR%\backups\portal-%STAMP%.db
echo.
echo   Nen chep them ban nay ra USB hoac Google Drive.
echo.
pause
