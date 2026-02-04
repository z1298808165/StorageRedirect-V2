#include "hook.h"
#include "config.h"
#include <android/log.h>
#include <dlfcn.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>
#include <errno.h>
#include <cstring>

#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, "StorageRedirect/Hook", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "StorageRedirect/Hook", __VA_ARGS__)

namespace StorageRedirect {

// 原始函数指针
typedef int (*orig_open_func)(const char *, int, ...);
typedef int (*orig_openat_func)(int, const char *, int, ...);
typedef int (*orig_access_func)(const char *, int);
typedef int (*orig_stat_func)(const char *, struct stat *);
typedef int (*orig_lstat_func)(const char *, struct stat *);
typedef int (*orig_rename_func)(const char *, const char *);
typedef int (*orig_unlink_func)(const char *);
typedef int (*orig_mkdir_func)(const char *, mode_t);
typedef int (*orig_rmdir_func)(const char *);

static orig_open_func orig_open = nullptr;
static orig_openat_func orig_openat = nullptr;
static orig_access_func orig_access = nullptr;
static orig_stat_func orig_stat = nullptr;
static orig_lstat_func orig_lstat = nullptr;
static orig_rename_func orig_rename = nullptr;
static orig_unlink_func orig_unlink = nullptr;
static orig_mkdir_func orig_mkdir = nullptr;
static orig_rmdir_func orig_rmdir = nullptr;

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
    
    // 获取原始函数地址
    orig_open = (orig_open_func)dlsym(RTLD_NEXT, "open");
    orig_openat = (orig_openat_func)dlsym(RTLD_NEXT, "openat");
    orig_access = (orig_access_func)dlsym(RTLD_NEXT, "access");
    orig_stat = (orig_stat_func)dlsym(RTLD_NEXT, "stat");
    orig_lstat = (orig_lstat_func)dlsym(RTLD_NEXT, "lstat");
    orig_rename = (orig_rename_func)dlsym(RTLD_NEXT, "rename");
    orig_unlink = (orig_unlink_func)dlsym(RTLD_NEXT, "unlink");
    orig_mkdir = (orig_mkdir_func)dlsym(RTLD_NEXT, "mkdir");
    orig_rmdir = (orig_rmdir_func)dlsym(RTLD_NEXT, "rmdir");
    
    // 使用 PLT Hook 或 Inline Hook 替换函数
    // 这里简化处理，实际需要使用如 Dobby 等 Hook 框架
    LOGD("Native hooks installed");
}

void HookManager::installJavaHooks() {
    LOGD("Installing Java hooks...");
    
    // Hook Java 层的文件操作类
    // 如 java.io.File, java.io.FileInputStream, java.io.FileOutputStream 等
    
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

extern "C" int open(const char *pathname, int flags, ...) {
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

extern "C" int openat(int dirfd, const char *pathname, int flags, ...) {
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

extern "C" int rename(const char *oldpath, const char *newpath) {
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

extern "C" int unlink(const char *pathname) {
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

extern "C" int mkdir(const char *pathname, mode_t mode) {
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

extern "C" int rmdir(const char *pathname) {
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
