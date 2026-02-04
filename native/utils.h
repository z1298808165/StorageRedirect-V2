#pragma once

#include <string>

namespace StorageRedirect {

// 工具函数
class Utils {
public:
    // 获取进程名
    static std::string getProcessName();
    
    // 获取包名（从进程名）
    static std::string getPackageName(const std::string &processName);
    
    // 检查是否为系统应用
    static bool isSystemApp(int uid);
    
    // 检查是否为 isolated 进程
    static bool isIsolatedProcess(int uid);
    
    // 获取当前时间戳（毫秒）
    static long long getTimestamp();
};

} // namespace StorageRedirect
