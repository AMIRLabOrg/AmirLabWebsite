@echo off
echo Formatting backend (if applicable)...
call pnpm --dir backend run --if-present format
if %errorlevel% neq 0 exit /b %errorlevel%
echo Formatting frontend (if applicable)...
call pnpm --dir frontend run --if-present format
if %errorlevel% neq 0 exit /b %errorlevel%
