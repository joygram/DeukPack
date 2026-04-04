import re

def process_ko(filename):
    with open(filename, "r", encoding="utf-8") as f:
        text = f.read()

    old_pattern = r"## ⚡ 성능 및 벤치마크 안내.*?기다립니다\.\n\n"
    
    new_block = """## ⚡ 성능 및 벤치마크

DeukPack의 객관적인 성능 측정을 위해 `BenchmarkDotNet`, `mitata`, `pytest-benchmark` 등 산업 표준 벤치마크를 전면 도입하였습니다.

- [👉 DeukPack 종합 성능 매트릭스 백서](docs/DEUKPACK_GC_PERFORMANCE_MATRIX.ko.md)

> **💡 피드백 안내**
> 실제 성능은 서비스 환경과 객체 구조에 따라 달라질 수 있습니다. 
> 혹시 제가 구성한 시나리오 테스트 코드나 비교 결과에 오류를 발견하시면 언제든 편하게 알려주세요. 직접 사용해보시고 주하시는 피드백도 언제나 환영합니다.

"""
    text = re.sub(old_pattern, new_block, text, flags=re.DOTALL)
    with open(filename, "w", encoding="utf-8") as f:
        f.write(text)

def process_en(filename):
    with open(filename, "r", encoding="utf-8") as f:
        text = f.read()

    old_pattern = r"## ⚡ Performance & Benchmarks.*?with us\.\n\n"
    
    new_block = """## ⚡ Performance & Benchmarks

To ensure objective performance testing, we have adopted industry-standard benchmarks such as `BenchmarkDotNet`, `mitata`, and `pytest-benchmark`.

- [👉 DeukPack Comprehensive Performance Matrix](docs/DEUKPACK_GC_PERFORMANCE_MATRIX.md)

> **💡 Feedback**
> Real-world performance may vary depending on your specific environment and payload structure. 
> If you find any errors in the scenario test codes I constructed, please feel free to let me know! Your feedback after trying it out is always welcome.

"""
    text = re.sub(old_pattern, new_block, text, flags=re.DOTALL)
    with open(filename, "w", encoding="utf-8") as f:
        f.write(text)

process_ko("d:/workspace/i/DeukPack/README.ko.md")
process_en("d:/workspace/i/DeukPack/README.md")
print("Done.")
