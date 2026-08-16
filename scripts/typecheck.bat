@echo off
echo Typechecking backend...
call pnpm --dir backend run typecheck
if %errorlevel% neq 0 exit /b %errorlevel%
echo Typechecking frontend...
call pnpm --dir frontend run typecheck
if %errorlevel% neq 0 exit /b %errorlevel%
