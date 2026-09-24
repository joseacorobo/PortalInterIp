@echo off
:: Cambiar al directorio exacto donde reside este archivo .bat
cd /d "C:\Users\josea\Desktop\PortalInterIp-main"

chcp 65001 > nul
color 09
cls

echo.
echo   ████   ███    ██  ██████  ██████  █████ 
echo    ██    ████   ██    ██    ██      ██   ██
echo    ██    ██ ██  ██    ██    █████   ██████
echo    ██    ██  ██ ██    ██    ██      ██   ██
echo    ██    ██   ████    ██    ██      ██   ██
echo   ████   ██    ███    ██    ██████  ██   ██
echo.
echo =======================================================
echo     PORTAL OPERACIONES IP - CORE NOC (FastAPI)
echo =======================================================
echo.
echo Presiona CTRL+C para detener el servidor.
echo.

if exist "uv.exe" (
    uv.exe run --python 3.12 --with "fastapi[standard]" --with uvicorn --with jinja2 --with openpyxl --with python-multipart uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
) else (
    where uv >nul 2>nul
    if %errorlevel% equ 0 (
        uv run --python 3.12 --with "fastapi[standard]" --with uvicorn --with jinja2 --with openpyxl --with python-multipart uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
    ) else if exist ".venv\Scripts\python.exe" (
        .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
    ) else (
        python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
    )
)

pause