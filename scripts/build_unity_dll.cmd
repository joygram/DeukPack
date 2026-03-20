@echo off
echo Building Unity-Compatible DeukPack DLL...

REM Unity 호환 DLL 빌드
set UNITY_PATH="C:\Program Files\Unity\Hub\Editor\2022.3.0f1\Editor\Data\Managed\UnityEngine.dll"
set OUTPUT_DIR=output\unity
set DLL_NAME=DeukPack.Unity.dll

REM 출력 디렉토리 생성
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

REM C# 컴파일러로 Unity 호환 DLL 빌드
csc /target:library /out:"%OUTPUT_DIR%\%DLL_NAME%" /reference:"%UNITY_PATH%" /reference:"System.dll" /reference:"System.Core.dll" /reference:"System.Runtime.Serialization.dll" src\codegen\UnityCompatibleGenerator.cs

if %ERRORLEVEL% EQU 0 (
    echo ✅ Unity DLL built successfully: %OUTPUT_DIR%\%DLL_NAME%
) else (
    echo ❌ Unity DLL build failed
    exit /b 1
)

echo Unity DLL build completed!
