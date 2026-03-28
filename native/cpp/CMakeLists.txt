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
    add_compile_options(/W4 /WX /permissive- /utf-8)
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


  find_package(Threads REQUIRED)

  find_package(Protobuf CONFIG QUIET)
  if(NOT Protobuf_FOUND)
    find_package(Protobuf QUIET)
  endif()

  if(NOT Protobuf_PROTOC_EXECUTABLE AND DEFINED VCPKG_INSTALLED_DIR AND DEFINED VCPKG_TARGET_TRIPLET)
    find_program(Protobuf_PROTOC_EXECUTABLE NAMES protoc protoc.exe
      PATHS "${VCPKG_INSTALLED_DIR}/${VCPKG_TARGET_TRIPLET}/tools/protobuf"
      NO_DEFAULT_PATH)
  endif()
  if(NOT Protobuf_PROTOC_EXECUTABLE)
    find_program(Protobuf_PROTOC_EXECUTABLE NAMES protoc protoc.exe)
  endif()

  if(NOT THRIFT_COMPILER AND DEFINED VCPKG_INSTALLED_DIR AND DEFINED VCPKG_TARGET_TRIPLET)
    find_program(THRIFT_COMPILER NAMES thrift thrift.exe
      PATHS "${VCPKG_INSTALLED_DIR}/${VCPKG_TARGET_TRIPLET}/tools/thrift"
      NO_DEFAULT_PATH)
  endif()
  if(NOT THRIFT_COMPILER)
    find_program(THRIFT_COMPILER NAMES thrift thrift.exe DOC "Apache Thrift compiler")
  endif()

  find_package(PkgConfig QUIET)
  set(_iso_thrift_pc_ok FALSE)
  if(PkgConfig_FOUND)
    pkg_check_modules(THRIFT_PC QUIET thrift)
    if(THRIFT_PC_FOUND)
      set(_iso_thrift_pc_ok TRUE)
    else()
      pkg_check_modules(THRIFT_PC QUIET libthrift)
      if(THRIFT_PC_FOUND)
        set(_iso_thrift_pc_ok TRUE)
      endif()
    endif()
  endif()

  set(_iso_thrift_cmake_ok FALSE)
  if(NOT _iso_thrift_pc_ok)
    find_package(thrift CONFIG QUIET)
    if(thrift_FOUND)
      set(_iso_thrift_cmake_ok TRUE)
    endif()
  endif()

  set(_iso_thrift_ok FALSE)
  if(_iso_thrift_pc_ok OR _iso_thrift_cmake_ok)
    set(_iso_thrift_ok TRUE)
  endif()

  if(NOT Protobuf_FOUND OR NOT _iso_thrift_ok OR NOT THRIFT_COMPILER OR NOT Protobuf_PROTOC_EXECUTABLE)
  else()
    get_filename_component(_DEUKPACK_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../.." ABSOLUTE)
    set(ISO_GEN_DIR "${CMAKE_CURRENT_BINARY_DIR}/generated_iso_wire")
    file(MAKE_DIRECTORY "${ISO_GEN_DIR}")

    add_custom_command(
      OUTPUT
        "${ISO_GEN_DIR}/schema.pb.cc"
        "${ISO_GEN_DIR}/schema.pb.h"
      COMMAND "${CMAKE_COMMAND}" -E make_directory "${ISO_GEN_DIR}"
      COMMAND "${Protobuf_PROTOC_EXECUTABLE}"
        --cpp_out=${ISO_GEN_DIR}
        "-I${ISO_SCHEMA_DIR}"
        "${ISO_SCHEMA_DIR}/schema.proto"
      DEPENDS "${ISO_SCHEMA_DIR}/schema.proto"
      VERBATIM
    )

    add_custom_command(
      OUTPUT
        "${ISO_GEN_DIR}/schema_types.cpp"
        "${ISO_GEN_DIR}/schema_types.h"
      COMMAND "${CMAKE_COMMAND}" -E make_directory "${ISO_GEN_DIR}"
      COMMAND "${THRIFT_COMPILER}" --gen cpp -out ${ISO_GEN_DIR} "${ISO_SCHEMA_DIR}/schema.thrift"
      DEPENDS "${ISO_SCHEMA_DIR}/schema.thrift"
      VERBATIM
    )

      "${ISO_GEN_DIR}/schema.pb.cc"
      "${ISO_GEN_DIR}/schema_types.cpp"
    )
      protobuf::libprotobuf
      Threads::Threads
    )
    if(_iso_thrift_pc_ok)
    elseif(TARGET thriftz::thriftz)
    else()
    endif()
    if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    elseif(MSVC)
    endif()
  endif()
endif()
