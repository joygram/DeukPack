import re

files = [
    "d:/workspace/i/DeukPack/README.ko.md",
    "d:/workspace/i/DeukPack/README.md"
]

for f in files:
    try:
        with open(f, "r", encoding="utf-8") as file:
            content = file.read()
            
        # Remove the broken table leftover lines
        # In KO: 
        # --- | --- | --- | --- |
        # | **C# (.NET 10)** ...
        # | **Node.js (V8)** ...
        
        content = re.sub(r"---\s*\|\s*---\s*\|\s*---\s*\|\s*---\s*\|\n(?:\|.*?\n)+", "", content, flags=re.MULTILINE)
        
        with open(f, "w", encoding="utf-8") as file:
            file.write(content)
    except FileNotFoundError:
        pass

print("Broken table removed.")
