cmake_minimum_required(VERSION 3.22.1)
project("storage-redirect")

set(CMAKE_CXX_STANDARD 20)

# 添加 Zygisk 模块
add_library(${CMAKE_PROJECT_NAME} SHARED
    main.cpp
    hook.cpp
    config.cpp
    ipc.cpp
    utils.cpp
)

target_link_libraries(${CMAKE_PROJECT_NAME}
    log
    dl
)
