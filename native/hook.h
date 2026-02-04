#pragma once

#include <jni.h>
#include <string>
#include <vector>
#include <memory>

namespace StorageRedirect {

// 决策类型
enum class Decision {
    PASS,           // 允许通过
    REDIRECT,       // 重定向
    DENY_RO,        // 只读拒绝
    DENY_POLICY,    // 策略拒绝
    MONITOR_ONLY    // 仅监控
};

// 操作类型
enum class Operation {
    OPEN,
    READ,
    WRITE,
    RENAME,
    UNLINK,
    MKDIR,
    RMDIR,
    ACCESS,
    STAT
};

// 规则匹配结果
struct MatchResult {
    Decision decision;
    std::string mappedPath;
    int ruleIndex = -1;
    std::string ruleType;
};

// Hook 管理器
class HookManager {
public:
    static HookManager* getInstance();
    
    void init(JNIEnv *env, const std::string &processName, int uid);
    void installHooks();
    
    // 路径处理
    MatchResult processPath(const char *path, Operation op, int flags = 0);
    
    // 日志记录
    void logOperation(Operation op, const char *path, const MatchResult &result, int errno_val = 0);
    
private:
    HookManager() = default;
    ~HookManager() = default;
    
    JNIEnv *m_env = nullptr;
    std::string m_processName;
    int m_uid = -1;
    bool m_initialized = false;
    
    // 检查配置更新
    void checkConfigUpdate();
    
    // Native Hook
    void installNativeHooks();
    
    // Java Hook
    void installJavaHooks();
};

} // namespace StorageRedirect
