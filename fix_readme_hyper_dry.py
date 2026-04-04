import re

def process_ko(filename):
    with open(filename, "r", encoding="utf-8") as f:
        text = f.read()

    # Search for the block to replace
    # "전면 " -> ""
    # "종합 " -> ""
    # "실제 성능은 서비스 환경과 객체 구조에 따라 달라질 수 있습니다. \n> " -> ""
    text = text.replace("산업 표준 벤치마크를 전면 도입하였습니다", "산업 표준 벤치마크를 도입하였습니다")
    text = text.replace("종합 성능", "성능")
    text = text.replace("> 실제 성능은 서비스 환경과 객체 구조에 따라 달라질 수 있습니다. \n> 혹시", "> 혹시")
    text = text.replace("직접 사용해보시고 주하시는", "직접 사용해보시고 주시는")

    with open(filename, "w", encoding="utf-8") as f:
        f.write(text)

def process_en(filename):
    with open(filename, "r", encoding="utf-8") as f:
        text = f.read()

    text = text.replace("Comprehensive Performance Matrix", "Performance Matrix")
    text = text.replace("> Real-world performance may vary depending on your specific environment and payload structure. \n> If", "> If")

    with open(filename, "w", encoding="utf-8") as f:
        f.write(text)

process_ko("d:/workspace/i/DeukPack/README.ko.md")
process_en("d:/workspace/i/DeukPack/README.md")
print("Text cleaned up.")
