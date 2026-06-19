@echo off
setlocal

set REPO_ROOT=%~dp0
set AI=%REPO_ROOT%ai-service

where python >nul 2>nul
if errorlevel 1 (
  echo !! python is not on PATH.
  exit /b 1
)

set VENV=%AI%\.venv
set VENV_PY=%VENV%\Scripts\python.exe
set VENV_PIP=%VENV%\Scripts\pip.exe

echo ==^> Repo root: %REPO_ROOT%
python --version

if not exist "%VENV_PY%" (
  echo ==^> Creating venv at %VENV%
  python -m venv "%VENV%"
)

echo ==^> Upgrading pip
"%VENV_PY%" -m pip install --upgrade pip wheel setuptools >nul

echo ==^> Installing requirements
"%VENV_PY%" -m pip install -r "%AI%\requirements.txt"

if not exist "%AI%\.env" (
  echo ==^> Creating .env from .env.example
  copy "%AI%\.env.example" "%AI%\.env" >nul
  echo     Add a real GROQ_API_KEYS to "%AI%\.env" before running heavy workloads.
)

REM Boot Qdrant briefly so we can initialise collections.
curl -fsS http://127.0.0.1:6333/collections >nul 2>nul
if not errorlevel 1 (
  echo ==^> Qdrant already running on :6333
) else (
  set QBIN=
  if exist "%AI%\data\qdrant\bin\qdrant.exe" set QBIN=%AI%\data\qdrant\bin\qdrant.exe
  if "%QBIN%"=="" (
    echo !! Could not find qdrant.exe at "%AI%\data\qdrant\bin\qdrant.exe"
    exit /b 1
  )
  echo ==^> Starting Qdrant: %QBIN%
  start "" /B "%QBIN%" --config-path "%AI%\data\qdrant\config\config.yaml" ^> "%AI%\qdrant.out" 2^>^> "%AI%\qdrant.err"
  for /L %%i in (1,1,60) do (
    curl -fsS http://127.0.0.1:6333/collections >nul 2>nul && goto :qd_up
    ping -n 1 127.0.0.1 >nul
  )
  echo !! Qdrant did not come up in 30s. See "%AI%\qdrant.err"
  exit /b 1
)
:qd_up

echo ==^> Initialising Qdrant collections
"%VENV_PY%" "%AI%\scripts\init_qdrant.py"

if exist "%AI%\data\models\BAAI__bge-small-en-v1.5\config.json" (
  echo ==^> Embedding model already present
) else (
  echo ==^> Downloading BAAI/bge-small-en-v1.5
  "%VENV_PY%" "%AI%\scripts\download_models.py"
)

echo ==^> Verifying imports
"%VENV_PY%" -c "import fastapi, qdrant_client, groq, sentence_transformers, trafilatura, pymupdf, docx, tiktoken; print('    all imports OK')"

echo.
echo Install complete. Run: start.bat
endlocal
