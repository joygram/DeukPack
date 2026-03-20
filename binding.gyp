{
  "targets": [
    {
      "target_name": "deukpack_wire_engine",
      "sources": [
        "native/cpp/src/wire_engine.cpp",
        "native/cpp/src/binary_writer.cpp",
        "native/cpp/src/binary_reader.cpp",
        "native/cpp/src/compact_writer.cpp",
        "native/cpp/src/compact_reader.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "native/cpp/include"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.7"
      },
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1
        }
      },
      "conditions": [
        ["OS=='win'", {
          "defines": [
            "WIN32_LEAN_AND_MEAN",
            "NOMINMAX"
          ]
        }]
      ]
    }
  ]
}
