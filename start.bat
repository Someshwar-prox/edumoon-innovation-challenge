@echo off
setlocal

set REPO_ROOT=%~dp0
set AI=%REPO_ROOT%ai-service
set FRONTEND=%REPO_ROOT%frontend
set VENV_PY=%AI%\.venv\Scripts\python.exe
set PY_SYS=python

if not exist "%VENV_PY%" (
  echo !! %VENV_PY% not found. Run: install.bat
  exit /b 1
)

REM 1. Qdrant.
curl -fsS http://127.0.0.1:6333/collections >nul 2>nul
if not errorlevel 1 (
  echo ==^> Qdrant already on :6333
) else (
  set QBIN=
  if exist "%AI%\data\qdrant\bin\qdrant.exe" set QBIN=%AI%\data\qdrant\bin\qdrant.exe
  if "%QBIN%"=="" (
    echo !! qdrant.exe not found at "%AI%\data\qdrant\bin\qdrant.exe"
    exit /b 1
  )
  echo ==^> Starting Qdrant
  start "" /B "%QBIN%" --config-path "%AI%\data\qdrant\config\config.yaml" ^> "%AI%\qdrant.out" 2^>^> "%AI%\qdrant.err"
  for /L %%i in (1,1,60) do (
    curl -fsS http://127.0.0.1:6333/collections >nul 2>nul && goto :qd_up
    ping -n 1 127.0.0.1 >nul
  )
  echo !! Qdrant did not start. See "%AI%\qdrant.err"
  exit /b 1
)
:qd_up

REM 2. FastAPI.
echo ==^> Starting FastAPI on :8000
start "AIBridge-API" /B cmd /c "cd /d %AI% && %VENV_PY% -m uvicorn app.main:app --host 127.0.0.1 --port 8000 ^> %AI%\uvicorn.out 2^>^> %AI%\uvicorn.err"

REM 3. Frontend. Use python's --directory so the cwd is reliable.
echo ==^> Starting frontend on :5500
start "AIBridge-Frontend" /B cmd /c "cd /d %FRONTEND% && %PY_SYS% -m http.server 127.0.0.1 --directory %FRONTEND% 5500 ^> %FRONTEND%\frontend.out 2^>^> %FRONTEND%\frontend.err"

REM 4. Wait for /v1/health.
echo ==^> Waiting for /v1/health
for /L %%i in (1,1,60) do (
  curl -fsS http://127.0.0.1:8000/v1/health >nul 2>nul && goto :api_up
  ping -n 1 127.0.0.1 >nul
)
echo !! FastAPI did not become healthy. See "%AI%\uvicorn.err"
exit /b 1
:api_up

REM 5. Open browser.
echo ==^> Opening http://127.0.0.1:5500/
start "" "http://127.0.0.1:5500/"

echo.
echo AIBridge is running.
echo   Frontend : http://127.0.0.1:5500/
echo   API docs : http://127.0.0.1:8000/docs
echo   Health   : http://127.0.0.1:8000/v1/health
echo.
echo Close this window or press Ctrl+C in each child window to stop.
echo To stop from another terminal: taskkill /F /IM qdrant.exe ^& taskkill /F /IM python.exe /FI "WINDOWTITLE eq AIBridge*"
endlocal
