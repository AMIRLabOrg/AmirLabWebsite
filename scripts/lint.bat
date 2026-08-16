@echo off
echo Linting backend...
call pnpm --dir backend run lint
if %errorlevel% neq 0 exit /b %errorlevel%
echo Linting frontend...
call pnpm --dir frontend run lint
if %errorlevel% neq 0 exit /b %errorlevel%
