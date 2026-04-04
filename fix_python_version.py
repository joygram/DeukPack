import re
import glob

# Files to process
files = [
    "d:/workspace/i/DeukPack/CHANGELOG.ko.md",
    "d:/workspace/i/DeukPack/CHANGELOG.md",
    "d:/workspace/i/DeukPack/CHANGELOG.release.ko.md",
    "d:/workspace/i/DeukPack/CHANGELOG.release.md",
    "d:/workspace/i/DeukPack/README.ko.md",
    "d:/workspace/i/DeukPack/README.md",
    "d:/workspace/i/DeukPack/docs/DEUKPACK_GC_PERFORMANCE_MATRIX.ko.md",
    "d:/workspace/i/DeukPack/docs/DEUKPACK_GC_PERFORMANCE_MATRIX.md",
    "d:/workspace/i/DeukPack/docs/DEUKPACK_GC_FLAT_PERFORMANCE_MATRIX.ko.md",
    "d:/workspace/i/DeukPack/docs/DEUKPACK_GC_FLAT_PERFORMANCE_MATRIX.md",
    "d:/workspace/i/deukpack.app/docs/index.ko.md",
    "d:/workspace/i/deukpack.app/docs/index.md",
]

for f in files:
    try:
        with open(f, "r", encoding="utf-8") as file:
            content = file.read()
            
        # Replace Python 3.10 with Python 3.6
        # But be careful not to break non-Python context if any, though grep showed only Python context
        content = content.replace("3.10", "3.6")

        with open(f, "w", encoding="utf-8") as file:
            file.write(content)
    except FileNotFoundError:
        pass

# Also fix the gitignore
gitignore_path = "d:/workspace/i/DeukPack/.gitignore"
with open(gitignore_path, "a", encoding="utf-8") as ig:
    ig.write("\ntest_python_gen.ts\nbenchmarks/ultimate_matrix.py\n")

print("Version updated to 3.6 and gitignore hardened.")
