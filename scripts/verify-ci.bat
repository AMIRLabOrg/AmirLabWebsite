@echo off
echo Running CI Verification...
call scripts\lint.bat
if %errorlevel% neq 0 exit /b %errorlevel%
call scripts\typecheck.bat
if %errorlevel% neq 0 exit /b %errorlevel%
call pnpm run verify:production
if %errorlevel% neq 0 exit /b %errorlevel%
echo All CI checks passed!
