cmake_minimum_required(VERSION 3.22.1)
project("storage-redirect")

set(CMAKE_CXX_STANDARD 20)

# 添加 jsoncpp（源码方式）
include(FetchContent)
FetchContent_Declare(
    jsoncpp
    GIT_REPOSITORY https://github.com/open-source-parsers/jsoncpp.git
    GIT_TAG 1.9.5
)
# 禁用 jsoncpp 的测试和示例
set(JSONCPP_WITH_TESTS OFF CACHE BOOL "" FORCE)
set(JSONCPP_WITH_POST_BUILD_UNITTEST OFF CACHE BOOL "" FORCE)
set(JSONCPP_WITH_EXAMPLE OFF CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(jsoncpp)

# 添加 Zygisk 模块
add_library(${CMAKE_PROJECT_NAME} SHARED
    main.cpp
    hook.cpp
    config.cpp
    ipc.cpp
    utils.cpp
)

target_include_directories(${CMAKE_PROJECT_NAME} PRIVATE
    ${jsoncpp_SOURCE_DIR}/include
)

target_link_libraries(${CMAKE_PROJECT_NAME}
    log
    dl
    jsoncpp_static
)

# 编译选项
target_compile_options(${CMAKE_PROJECT_NAME} PRIVATE
    -O2
    -fvisibility=hidden
    -fvisibility-inlines-hidden
)
