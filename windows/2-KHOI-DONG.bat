@echo off
chcp 65001 >nul
title Cong thong tin noi bo - Dang chay
cd /d "%~dp0.."

set "DATA_DIR=%~dp0..\data"
set "PORT=8000"
set "DATABASE_URL=sqlite:///%DATA_DIR:\=/%/portal.db"

if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

REM Sinh khoa bi mat lan dau, luu lai de token dang nhap khong bi mat hieu luc
if not exist "%DATA_DIR%\secret.key" (
  python -c "import secrets;open(r'%DATA_DIR%\secret.key','w').write(secrets.token_hex(32))"
)
for /f "tokens=*" %%k in ('type "%DATA_DIR%\secret.key"') do set "SECRET_KEY=%%k"

echo.
echo   ================================================================
echo    CONG THONG TIN NOI BO - CHI NHANH CONG TRINH VIETTEL
echo   ================================================================
echo.
echo    Du lieu:  %DATA_DIR%\portal.db
echo.
echo    Mo tren may nay:        http://localhost:%PORT%
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=1" %%j in ("%%i") do echo    May khac trong mang:    http://%%j:%PORT%
)
echo.
echo    Tai khoan:  admin / viettel@2026
echo.
echo    DE TAT: dong cua so nay hoac bam Ctrl + C
echo   ================================================================
echo.

start "" http://localhost:%PORT%
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port %PORT%

echo.
echo   May chu da dung.
pause
