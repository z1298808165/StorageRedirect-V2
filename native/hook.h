#pragma once

#include <jni.h>
#include <string>
#include <vector>

namespace StorageRedirect {

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

// 决策类型
enum class Decision {
    PASS,       // 放行
    REDIRECT,   // 重定向
    DENY_RO     // 拒绝（只读保护）
};

// 匹配结果
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
    
    // 检查是否已初始化
    bool isInitialized() const { return m_initialized; }
    
    // 处理路径，返回决策
    MatchResult processPath(const char *path, Operation op, int flags = 0);
    
    // 记录操作日志
    void logOperation(Operation op, const char *path, const MatchResult &result, int errno_val);

private:
    HookManager() = default;
    ~HookManager() = default;
    HookManager(const HookManager&) = delete;
    HookManager& operator=(const HookManager&) = delete;
    
    void installNativeHooks();
    void installJavaHooks();
    void checkConfigUpdate();
    
    JNIEnv *m_env = nullptr;
    std::string m_processName;
    int m_uid = -1;
    bool m_initialized = false;
};

} // namespace StorageRedirect
