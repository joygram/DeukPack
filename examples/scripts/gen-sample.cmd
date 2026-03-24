@echo off
setlocal
cd /d "%~dp0..\.."
node scripts/build_deukpack.js examples\sample_idl\sample.thrift examples\out --csharp --cpp --js --protocol tbinary --allow-multi-namespace
if errorlevel 1 exit /b 1
echo [OK] Sample codegen (thrift) -^> examples\out\
echo      Protobuf: ... sample_idl\sample.proto examples\out --csharp --cpp --js --protocol tbinary
