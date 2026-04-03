@echo off
setlocal
cd /d "%~dp0..\.."
node scripts/build_deukpack.js examples\sample_idl\sample.deuk examples\generated --csharp --cpp --js --protocol tbinary --allow-multi-namespace
if errorlevel 1 exit /b 1
echo [OK] Sample codegen (.deuk) -^> examples\generated\
echo      Protobuf: ... sample_idl\sample.proto examples\generated --csharp --cpp --js --protocol tbinary
