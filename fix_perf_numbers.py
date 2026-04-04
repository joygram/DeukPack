import re

files = [
    "d:/workspace/i/DeukPack/docs/DEUKPACK_GC_PERFORMANCE_MATRIX.ko.md",
    "d:/workspace/i/DeukPack/docs/DEUKPACK_GC_PERFORMANCE_MATRIX.md",
    "d:/workspace/i/DeukPack/docs/DEUKPACK_GC_FLAT_PERFORMANCE_MATRIX.ko.md",
    "d:/workspace/i/DeukPack/docs/DEUKPACK_GC_FLAT_PERFORMANCE_MATRIX.md"
]

for f in files:
    try:
        with open(f, "r", encoding="utf-8") as file:
            content = file.read()
            
        # Revert the accidental performance number replacements
        content = content.replace("~ 3.6 μs", "~ 3.10 μs")
        content = content.replace("~ 23.6 μs", "~ 23.10 μs")
        
        with open(f, "w", encoding="utf-8") as file:
            file.write(content)
    except FileNotFoundError:
        pass

print("Performance numbers reverted to 3.10.")
