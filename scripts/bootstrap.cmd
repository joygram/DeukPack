@echo off
REM DeukPack 클론 후 초기화 한 번에 실행 (Node 있으면 setup, 없으면 winget으로 Node 설치 후 setup)
REM 사용: 프로젝트 루트에서  scripts\bootstrap.cmd
REM 주의: >nul / 2>nul 사용 금지 (nul 파일 생성 방지)

cd /d "%~dp0\.."

where node >con 2>&1
if %errorlevel% equ 0 (
  node -e "var v=process.version.slice(1).split('.'); var n=parseInt(v[0],10); process.exit(n>=16?0:1);"
  if %errorlevel% equ 0 (
    echo [bootstrap] Node found. Running setup...
    node scripts\setup.js %*
    exit /b %errorlevel%
  )
)

echo [bootstrap] Installing Node.js via winget...
winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
if %errorlevel% neq 0 (
  echo [bootstrap] winget failed. Install Node from https://nodejs.org/
  exit /b 1
)

set "NODE_PATH=%ProgramFiles%\nodejs\node.exe"
if exist "%NODE_PATH%" (
  echo [bootstrap] Running setup with newly installed Node...
  "%NODE_PATH%" scripts\setup.js %*
  exit /b %errorlevel%
)
set "NODE_PATH=%LocalAppData%\Programs\node\node.exe"
if exist "%NODE_PATH%" (
  "%NODE_PATH%" scripts\setup.js %*
  exit /b %errorlevel%
)

echo [bootstrap] Node installed. Open a NEW terminal and run: node scripts\setup.js
exit /b 0
