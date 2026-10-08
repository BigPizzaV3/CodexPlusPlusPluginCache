@echo off
rem Shared scientific-viewer-platform launcher; regenerate plugin copies instead of editing them.
setlocal EnableExtensions DisableDelayedExpansion

if "%~1"=="" (
  echo Scientific viewer could not start: missing Node entrypoint. 1>&2
  exit /b 64
)

set "node_path="
set "node_candidate=%CODEX_MCP_NODE_PATH%"
call :select_node
if defined node_path goto launch

set "node_candidate=%CODEX_BROWSER_USE_NODE_PATH%"
call :select_node
if defined node_path goto launch

if defined CODEX_ELECTRON_RESOURCES_PATH (
  set "node_candidate=%CODEX_ELECTRON_RESOURCES_PATH%\cua_node\bin\node.exe"
  call :select_node
)
if defined node_path goto launch

set "node_candidate=%CODEX_CLI_PATH%"
call :is_absolute
if not errorlevel 1 (
  for %%I in ("%CODEX_CLI_PATH%") do set "node_candidate=%%~dpIcua_node\bin\node.exe"
  call :select_node
)
if defined node_path goto launch

if defined XDG_CACHE_HOME (
  set "node_candidate=%XDG_CACHE_HOME%\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  call :select_node
)
if defined node_path goto launch

if defined USERPROFILE (
  set "node_candidate=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  call :select_node
)
if defined node_path goto launch

rem Older Windows hosts relocate their bundled Node into this versioned cache.
set "node_candidate=%LOCALAPPDATA%"
call :is_absolute
if not errorlevel 1 (
  for /d %%D in ("%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node\*") do (
    set "node_candidate=%%~fD\bin\node.exe"
    call :select_node
    if defined node_path goto launch
  )
)

rem Search absolute PATH entries, without implicitly searching the working directory.
set "node_search_path=%PATH:"=%"
for %%D in ("%node_search_path:;=" "%") do (
  set "node_candidate=%%~D\node.exe"
  call :select_node
  if defined node_path goto launch
)

echo Scientific viewer could not find a Node runtime. Update Codex or install a supported Node version on PATH. 1>&2
exit /b 127

:launch
rem An updater may remove this batch file while Node runs. Do not read another line.
rem Bare exit preserves Node's current errorlevel without expanding it before launch.
"%node_path%" %* & exit

:select_node
call :is_absolute
if errorlevel 1 exit /b 1
if not exist "%node_candidate%" exit /b 1
if exist "%node_candidate%\" exit /b 1
set "node_path=%node_candidate%"
exit /b 0

:is_absolute
if not defined node_candidate exit /b 1
if "%node_candidate:~1,2%"==":\" exit /b 0
if "%node_candidate:~1,2%"==":/" exit /b 0
if "%node_candidate:~0,2%"=="\\" exit /b 0
if "%node_candidate:~0,2%"=="//" exit /b 0
exit /b 1
