@echo off
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat"
cd benchmarks\bindings\cpp
python setup.py build_ext --inplace
