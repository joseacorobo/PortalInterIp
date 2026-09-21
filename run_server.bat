@echo off
echo ========================================================
echo     Iniciando Portal Operaciones IP (FastAPI)
echo ========================================================
echo.
echo Presiona CTRL+C para detener el servidor.
echo.

:: Usar uv local o de sistema para manejar dependencias y version de Python automaticamente
if exist "uv.exe" (
    uv.exe run --python 3.12 --with "fastapi[standard]" --with uvicorn --with jinja2 --with python-multipart --with openpyxl fastapi dev app/main.py --host 0.0.0.0 --port 8000
) else (
    uv run --python 3.12 --with "fastapi[standard]" --with uvicorn --with jinja2 --with python-multipart --with openpyxl fastapi dev app/main.py --host 0.0.0.0 --port 8000
)

pause
