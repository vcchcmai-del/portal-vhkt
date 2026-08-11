@echo off
chcp 65001 >nul
title Cong thong tin noi bo - Cai dat lan dau
cd /d "%~dp0.."

echo.
echo   ================================================================
echo    CONG THONG TIN NOI BO - CHI NHANH CONG TRINH VIETTEL
echo    Cai dat lan dau
echo   ================================================================
echo.

echo [1/4] Kiem tra Python...
python --version >nul 2>&1
if errorlevel 1 (
  echo.
  echo   LOI: Chua cai Python.
  echo   Tai tai: https://www.python.org/downloads/
  echo   Khi cai NHO TICH vao o "Add Python to PATH".
  echo.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('python --version') do echo       %%v

echo.
echo [2/4] Tao thu muc luu du lieu...
if not exist "%~dp0..\data" mkdir "%~dp0..\data"
if not exist "%~dp0..\data\backups" mkdir "%~dp0..\data\backups"
echo       Da tao: %~dp0..\data

echo.
echo [3/4] Cai thu vien can thiet (mat 1-3 phut)...
python -m pip install --quiet --upgrade pip
python -m pip install --quiet -r backend\requirements.txt
if errorlevel 1 (
  echo   LOI: Cai thu vien that bai. Kiem tra ket noi mang.
  pause
  exit /b 1
)
echo       Xong.

echo.
echo [4/4] Kiem tra giao dien web...
if not exist "backend\static\index.html" (
  echo   CANH BAO: Thieu thu muc backend\static.
  echo   Giao dien web se khong hien. Lien he nguoi ban giao.
) else (
  echo       Da co giao dien web.
)

echo.
echo   ================================================================
echo    CAI DAT XONG
echo.
echo    Tu lan sau chi can chay:  2-KHOI-DONG.bat
echo    Du lieu luu tai:          %~dp0..\data
echo   ================================================================
echo.
pause
