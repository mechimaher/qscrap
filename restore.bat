@echo off
REM QScrap Restore Script
REM Usage: restore.bat [backup_folder_name]

echo ========================================
echo QScrap Backup Restore Utility
echo ========================================
echo.

if "%1"=="" (
    echo ERROR: Please provide backup folder name
    echo Usage: restore.bat backup_20241218_140230
    echo.
    echo Available backups:
    dir /b /ad backup_*
    exit /b 1
)

set BACKUP_DIR=%1

if not exist "%BACKUP_DIR%" (
    echo ERROR: Backup directory '%BACKUP_DIR%' does not exist
    exit /b 1
)

echo WARNING: This will restore files from %BACKUP_DIR%
echo Press Ctrl+C to cancel, or
pause

echo.
echo Restoring public directory...
xcopy /E /I /Y "%BACKUP_DIR%\public" "public"

echo.
echo Restoring src directory...
xcopy /E /I /Y "%BACKUP_DIR%\src" "src"

echo.
echo ========================================
echo Restore complete!
echo ========================================
echo.
echo Please rebuild the application:
echo   npm run build
echo   npm run dev
echo.
