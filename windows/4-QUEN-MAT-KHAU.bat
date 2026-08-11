@echo off
chcp 65001 >nul
title Dat lai mat khau quan tri
cd /d "%~dp0.."

set "DATA_DIR=%~dp0..\data"
set "DATABASE_URL=sqlite:///%DATA_DIR:\=/%/portal.db"

echo.
echo   ================================================================
echo    DAT LAI MAT KHAU QUAN TRI
echo   ================================================================
echo.

if not exist "%DATA_DIR%\portal.db" (
  echo   LOI: Khong tim thay du lieu tai %DATA_DIR%\portal.db
  echo   Neu ban doi o luu, sua dong DATA_DIR trong file nay.
  echo.
  pause
  exit /b 1
)

echo   Cac tai khoan dang co:
echo.
cd backend
python reset_password.py --list
cd ..

echo.
set /p USERNAME="  Nhap ten tai khoan can dat lai (vi du: admin): "
set /p NEWPASS="  Nhap mat khau moi (it nhat 8 ky tu): "

echo.
cd backend
python reset_password.py %USERNAME% %NEWPASS%
cd ..

echo.
pause
