#include "hook.h"
#include "config.h"
#include <android/log.h>
#include <dlfcn.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>
#include <errno.h>
#include <cstring>
#include <dobby.h>

#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, "StorageRedirect/Hook", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "StorageRedirect/Hook", __VA_ARGS__)

namespace StorageRedirect {

// 原始函数指针
static int (*orig_open)(const char *, int, ...) = nullptr;
static int (*orig_openat)(int, const char *, int, ...) = nullptr;
static int (*orig_access)(const char *, int) = nullptr;
static int (*orig_stat)(const char *, struct stat *) = nullptr;
static int (*orig_lstat)(const char *, struct stat *) = nullptr;
static int (*orig_rename)(const char *, const char *) = nullptr;
static int (*orig_unlink)(const char *) = nullptr;
static int (*orig_mkdir)(const char *, mode_t) = nullptr;
static int (*orig_rmdir)(const char *) = nullptr;

HookManager* HookManager::getInstance() {
    static HookManager instance;
    return &instance;
}

void HookManager::init(JNIEnv *env, const std::string &processName, int uid) {
    m_env = env;
    m_processName = processName;
    m_uid = uid;
    m_initialized = true;
    
    LOGD("HookManager initialized for %s (uid=%d)", processName.c_str(), uid);
}

void HookManager::installHooks() {
    if (!m_initialized) {
        LOGE("HookManager not initialized");
        return;
    }
    
    installNativeHooks();
    installJavaHooks();
}

void HookManager::installNativeHooks() {
    LOGD("Installing native hooks...");
    
    // 获取原始函数地址并安装 Hook
    void *target_open = dlsym(RTLD_NEXT, "open");
    void *target_openat = dlsym(RTLD_NEXT, "openat");
    void *target_access = dlsym(RTLD_NEXT, "access");
    void *target_stat = dlsym(RTLD_NEXT, "stat");
    void *target_lstat = dlsym(RTLD_NEXT, "lstat");
    void *target_rename = dlsym(RTLD_NEXT, "rename");
    void *target_unlink = dlsym(RTLD_NEXT, "unlink");
    void *target_mkdir = dlsym(RTLD_NEXT, "mkdir");
    void *target_rmdir = dlsym(RTLD_NEXT, "rmdir");
    
    // 使用 Dobby 安装 Hook
    if (target_open) {
        DobbyHook(target_open, (void *)hooked_open, (void **)&orig_open);
        LOGD("Hooked open");
    }
    
    if (target_openat) {
        DobbyHook(target_openat, (void *)hooked_openat, (void **)&orig_openat);
        LOGD("Hooked openat");
    }
    
    if (target_access) {
        DobbyHook(target_access, (void *)hooked_access, (void **)&orig_access);
        LOGD("Hooked access");
    }
    
    if (target_stat) {
        DobbyHook(target_stat, (void *)hooked_stat, (void **)&orig_stat);
        LOGD("Hooked stat");
    }
    
    if (target_lstat) {
        DobbyHook(target_lstat, (void *)hooked_lstat, (void **)&orig_lstat);
        LOGD("Hooked lstat");
    }
    
    if (target_rename) {
        DobbyHook(target_rename, (void *)hooked_rename, (void **)&orig_rename);
        LOGD("Hooked rename");
    }
    
    if (target_unlink) {
        DobbyHook(target_unlink, (void *)hooked_unlink, (void **)&orig_unlink);
        LOGD("Hooked unlink");
    }
    
    if (target_mkdir) {
        DobbyHook(target_mkdir, (void *)hooked_mkdir, (void **)&orig_mkdir);
        LOGD("Hooked mkdir");
    }
    
    if (target_rmdir) {
        DobbyHook(target_rmdir, (void *)hooked_rmdir, (void **)&orig_rmdir);
        LOGD("Hooked rmdir");
    }
    
    LOGD("Native hooks installed");
}

void HookManager::installJavaHooks() {
    LOGD("Installing Java hooks...");
    
    // Hook Java 层的文件操作类
    // 如 java.io.File, java.io.FileInputStream, java.io.FileOutputStream 等
    // 这里简化处理，实际需要通过 JNI Hook
    
    LOGD("Java hooks installed");
}

MatchResult HookManager::processPath(const char *path, Operation op, int flags) {
    if (!path || path[0] != '/') {
        return {Decision::PASS, path ? path : ""};
    }
    
    // 检查配置更新
    checkConfigUpdate();
    
    // 获取配置
    auto config = Config::getInstance()->getAppConfig(m_processName);
    if (!config.enabled) {
        return {Decision::PASS, path};
    }
    
    std::string normalizedPath = Config::normalizePath(path);
    
    // 1. 检查只读规则
    for (size_t i = 0; i < config.readOnlyRules.size(); i++) {
        const auto &rule = config.readOnlyRules[i];
        if (Config::pathMatches(normalizedPath, rule.path)) {
            // 检查是否是写操作
            bool isWriteOp = (op == Operation::WRITE) ||
                            (op == Operation::OPEN && (flags & (O_WRONLY | O_RDWR))) ||
                            (op == Operation::RENAME) ||
                            (op == Operation::UNLINK) ||
                            (op == Operation::MKDIR) ||
                            (op == Operation::RMDIR);
            
            if (isWriteOp) {
                MatchResult result;
                result.decision = Decision::DENY_RO;
                result.mappedPath = normalizedPath;
                result.ruleIndex = i;
                result.ruleType = "readonly";
                return result;
            }
        }
    }
    
    // 2. 检查重定向规则（按优先级）
    for (size_t i = 0; i < config.redirectRules.size(); i++) {
        const auto &rule = config.redirectRules[i];
        if (Config::pathMatches(normalizedPath, rule.src)) {
            // 计算相对路径
            std::string relativePath = normalizedPath.substr(rule.src.length());
            if (!relativePath.empty() && relativePath[0] == '/') {
                relativePath = relativePath.substr(1);
            }
            
            std::string mappedPath = rule.dst;
            if (!relativePath.empty()) {
                if (mappedPath.back() != '/') {
                    mappedPath += '/';
                }
                mappedPath += relativePath;
            }
            
            // src == dst 表示直通
            if (rule.src == rule.dst) {
                return {Decision::PASS, normalizedPath, (int)i, "redirect"};
            }
            
            MatchResult result;
            result.decision = Decision::REDIRECT;
            result.mappedPath = mappedPath;
            result.ruleIndex = i;
            result.ruleType = "redirect";
            return result;
        }
    }
    
    return {Decision::PASS, normalizedPath};
}

void HookManager::logOperation(Operation op, const char *path, const MatchResult &result, int errno_val) {
    auto config = Config::getInstance()->getAppConfig(m_processName);
    if (!config.monitorEnabled) return;
    
    // 检查是否需要监控此路径和操作
    bool shouldLog = false;
    for (const auto &mp : config.monitorPaths) {
        if (Config::pathMatches(path, mp.path)) {
            // 检查操作类型
            std::string opStr;
            switch (op) {
                case Operation::OPEN: opStr = "open"; break;
                case Operation::READ: opStr = "read"; break;
                case Operation::WRITE: opStr = "write"; break;
                case Operation::RENAME: opStr = "rename"; break;
                case Operation::UNLINK: opStr = "unlink"; break;
                case Operation::MKDIR: opStr = "mkdir"; break;
                case Operation::RMDIR: opStr = "rmdir"; break;
                case Operation::ACCESS: opStr = "access"; break;
                case Operation::STAT: opStr = "stat"; break;
            }
            
            for (const auto &monOp : mp.ops) {
                if (monOp == opStr) {
                    shouldLog = true;
                    break;
                }
            }
        }
        if (shouldLog) break;
    }
    
    if (!shouldLog) return;
    
    // 发送日志到 daemon
    // 这里简化处理，实际需要通过 IPC 发送
    LOGD("[LOG] op=%d, path=%s, decision=%d, mapped=%s", 
         (int)op, path, (int)result.decision, result.mappedPath.c_str());
}

void HookManager::checkConfigUpdate() {
    // 检查是否需要从 daemon 拉取新配置
    // 简化处理：每 N 次操作检查一次
    static int opCount = 0;
    if (++opCount % 50 == 0) {
        Config::getInstance()->checkUpdate();
    }
}

// Hook 函数实现

int hooked_open(const char *pathname, int flags, ...) {
    mode_t mode = 0;
    if (flags & O_CREAT) {
        va_list args;
        va_start(args, flags);
        mode = va_arg(args, mode_t);
        va_end(args);
    }
    
    auto *hook = HookManager::getInstance();
    auto result = hook->processPath(pathname, Operation::OPEN, flags);
    
    const char *actualPath = result.decision == Decision::REDIRECT ? 
                             result.mappedPath.c_str() : pathname;
    
    int ret;
    if (flags & O_CREAT) {
        ret = orig_open(actualPath, flags, mode);
    } else {
        ret = orig_open(actualPath, flags);
    }
    
    int saved_errno = errno;
    hook->logOperation(Operation::OPEN, pathname, result, ret < 0 ? saved_errno : 0);
    
    // 处理只读拒绝
    if (result.decision == Decision::DENY_RO) {
        errno = EACCES;
        return -1;
    }
    
    errno = saved_errno;
    return ret;
}

int hooked_openat(int dirfd, const char *pathname, int flags, ...) {
    mode_t mode = 0;
    if (flags & O_CREAT) {
        va_list args;
        va_start(args, flags);
        mode = va_arg(args, mode_t);
        va_end(args);
    }
    
    // 简化处理，实际应该解析相对路径
    if (pathname && pathname[0] == '/') {
        auto *hook = HookManager::getInstance();
        auto result = hook->processPath(pathname, Operation::OPEN, flags);
        
        const char *actualPath = result.decision == Decision::REDIRECT ? 
                                 result.mappedPath.c_str() : pathname;
        
        int ret;
        if (flags & O_CREAT) {
            ret = orig_openat(dirfd, actualPath, flags, mode);
        } else {
            ret = orig_openat(dirfd, actualPath, flags);
        }
        
        int saved_errno = errno;
        hook->logOperation(Operation::OPEN, pathname, result, ret < 0 ? saved_errno : 0);
        
        if (result.decision == Decision::DENY_RO) {
            errno = EACCES;
            return -1;
        }
        
        errno = saved_errno;
        return ret;
    }
    
    if (flags & O_CREAT) {
        return orig_openat(dirfd, pathname, flags, mode);
    }
    return orig_openat(dirfd, pathname, flags);
}

int hooked_access(const char *pathname, int mode) {
    auto *hook = HookManager::getInstance();
    auto result = hook->processPath(pathname, Operation::ACCESS);
    
    const char *actualPath = result.decision == Decision::REDIRECT ? 
                             result.mappedPath.c_str() : pathname;
    
    int ret = orig_access(actualPath, mode);
    int saved_errno = errno;
    hook->logOperation(Operation::ACCESS, pathname, result, ret < 0 ? saved_errno : 0);
    
    errno = saved_errno;
    return ret;
}

int hooked_stat(const char *pathname, struct stat *statbuf) {
    auto *hook = HookManager::getInstance();
    auto result = hook->processPath(pathname, Operation::STAT);
    
    const char *actualPath = result.decision == Decision::REDIRECT ? 
                             result.mappedPath.c_str() : pathname;
    
    int ret = orig_stat(actualPath, statbuf);
    int saved_errno = errno;
    hook->logOperation(Operation::STAT, pathname, result, ret < 0 ? saved_errno : 0);
    
    errno = saved_errno;
    return ret;
}

int hooked_lstat(const char *pathname, struct stat *statbuf) {
    auto *hook = HookManager::getInstance();
    auto result = hook->processPath(pathname, Operation::STAT);
    
    const char *actualPath = result.decision == Decision::REDIRECT ? 
                             result.mappedPath.c_str() : pathname;
    
    int ret = orig_lstat(actualPath, statbuf);
    int saved_errno = errno;
    hook->logOperation(Operation::STAT, pathname, result, ret < 0 ? saved_errno : 0);
    
    errno = saved_errno;
    return ret;
}

int hooked_rename(const char *oldpath, const char *newpath) {
    auto *hook = HookManager::getInstance();
    auto result = hook->processPath(oldpath, Operation::RENAME);
    
    int ret = orig_rename(oldpath, newpath);
    int saved_errno = errno;
    hook->logOperation(Operation::RENAME, oldpath, result, ret < 0 ? saved_errno : 0);
    
    if (result.decision == Decision::DENY_RO) {
        errno = EACCES;
        return -1;
    }
    
    errno = saved_errno;
    return ret;
}

int hooked_unlink(const char *pathname) {
    auto *hook = HookManager::getInstance();
    auto result = hook->processPath(pathname, Operation::UNLINK);
    
    int ret = orig_unlink(pathname);
    int saved_errno = errno;
    hook->logOperation(Operation::UNLINK, pathname, result, ret < 0 ? saved_errno : 0);
    
    if (result.decision == Decision::DENY_RO) {
        errno = EACCES;
        return -1;
    }
    
    errno = saved_errno;
    return ret;
}

int hooked_mkdir(const char *pathname, mode_t mode) {
    auto *hook = HookManager::getInstance();
    auto result = hook->processPath(pathname, Operation::MKDIR);
    
    int ret = orig_mkdir(pathname, mode);
    int saved_errno = errno;
    hook->logOperation(Operation::MKDIR, pathname, result, ret < 0 ? saved_errno : 0);
    
    if (result.decision == Decision::DENY_RO) {
        errno = EACCES;
        return -1;
    }
    
    errno = saved_errno;
    return ret;
}

int hooked_rmdir(const char *pathname) {
    auto *hook = HookManager::getInstance();
    auto result = hook->processPath(pathname, Operation::RMDIR);
    
    int ret = orig_rmdir(pathname);
    int saved_errno = errno;
    hook->logOperation(Operation::RMDIR, pathname, result, ret < 0 ? saved_errno : 0);
    
    if (result.decision == Decision::DENY_RO) {
        errno = EACCES;
        return -1;
    }
    
    errno = saved_errno;
    return ret;
}

} // namespace StorageRedirect
