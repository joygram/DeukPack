# Standalone C++ wire tests (no Node/N-API).
# Run from repo: cmake -S native/cpp -B native/cpp/build && cmake --build native/cpp/build && ctest --test-dir native/cpp/build --output-on-failure
cmake_minimum_required(VERSION 3.16)
project(deukpack_native_cpp LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(DEUKPACK_CPP_ROOT "${CMAKE_CURRENT_SOURCE_DIR}")

# --- Platform detection ---
if(WIN32)
  add_compile_definitions(DEUKPACK_PLATFORM_WINDOWS)
  if(MSVC)
    add_compile_options(/W4 /WX /permissive-)
  else()
    add_compile_options(-Wall -Wextra -Werror -pedantic)
  endif()
elseif(APPLE)
  add_compile_definitions(DEUKPACK_PLATFORM_MACOS)
  add_compile_options(-Wall -Wextra -Werror -pedantic)
else()
  add_compile_definitions(DEUKPACK_PLATFORM_LINUX)
  add_compile_options(-Wall -Wextra -Werror -pedantic)
endif()

set(WIRE_CORE_SOURCES
  "${DEUKPACK_CPP_ROOT}/src/binary_writer.cpp"
  "${DEUKPACK_CPP_ROOT}/src/binary_reader.cpp"
  "${DEUKPACK_CPP_ROOT}/src/compact_writer.cpp"
  "${DEUKPACK_CPP_ROOT}/src/compact_reader.cpp"
)

add_library(deukpack_wire_core STATIC ${WIRE_CORE_SOURCES})
target_include_directories(deukpack_wire_core PUBLIC "${DEUKPACK_CPP_ROOT}/include")

add_executable(wire_roundtrip_test "${DEUKPACK_CPP_ROOT}/tests/wire_roundtrip_test.cpp")
target_link_libraries(wire_roundtrip_test PRIVATE deukpack_wire_core)

enable_testing()
add_test(NAME wire_roundtrip COMMAND wire_roundtrip_test)
