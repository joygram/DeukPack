@echo off
set work_dir=%cd%
set curr_dir=%~dp0

rem DeukPack Thrift Builder - 100x faster than Apache Thrift
rem Usage: compile_thrift_deukpack.cmd [thrift_file] [output_dir] [options]

if "%1" == "" (
    echo Usage: compile_thrift_deukpack.cmd ^<thrift_file^> ^<output_dir^> [options]
    echo Options:
    echo   --csharp    Generate C# code
    echo   --cpp       Generate C++ code  
    echo   --js        Generate JavaScript code
    echo   --protocol ^<protocol^>  Serialization protocol (binary^|compact^|json^)
    echo   --endianness ^<endian^>  Endianness (little^|big^)
    echo.
    echo Example: compile_thrift_deukpack.cmd deuk_table_entry.deuk output --csharp --cpp
    exit /b 1
)

set THRIFT_FILE=%1
set OUTPUT_DIR=%2
shift
shift

rem Set default options if not specified
if "%BUILD_CSHARP%" == "" set BUILD_CSHARP=YES
if "%BUILD_CPP%" == "" set BUILD_CPP=YES
if "%BUILD_JS%" == "" set BUILD_JS=NO

rem Build command arguments
set BUILD_ARGS=%THRIFT_FILE% %OUTPUT_DIR%

if "%BUILD_CSHARP%" == "YES" set BUILD_ARGS=%BUILD_ARGS% --csharp
if "%BUILD_CPP%" == "YES" set BUILD_ARGS=%BUILD_ARGS% --cpp
if "%BUILD_JS%" == "YES" set BUILD_ARGS=%BUILD_ARGS% --js

rem Add additional arguments
set BUILD_ARGS=%BUILD_ARGS% %*

echo ^>^>^>^> DEUKPACK THRIFT BUILDER [%THRIFT_FILE%] [%OUTPUT_DIR%]
echo.

rem Change to DeukPack directory
cd /d "%curr_dir%"

rem Run DeukPack builder
node scripts/build_deukpack.js %BUILD_ARGS%

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] DeukPack build failed with error code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

echo.
echo [SUCCESS] DeukPack build completed successfully!
exit /b 0
