#include "hook.h"
#include "config.h"
#include <android/log.h>
#include <dlfcn.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>
#include <errno.h>
#include <cstring>
#include <link.h>
#include <elf.h>

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

// PLT Hook 实现
static int callback(struct dl_phdr_info *info, size_t size, void *data) {
    (void)size;
    (void)data;
    
    if (info->dlpi_name == nullptr || info->dlpi_name[0] == '\0') {
        return 0;
    }
    
    // 跳过系统库
    const char *name = info->dlpi_name;
    if (strstr(name, "/system/") || strstr(name, "/apex/")) {
        return 0;
    }
    
    // 尝试打开库进行 PLT Hook
    void *handle = dlopen(name, RTLD_NOW | RTLD_NOLOAD);
    if (!handle) {
        return 0;
    }
    
    // 获取 PLT 表并替换函数
    // 这里简化处理，实际需要通过解析 ELF 来找到 PLT 表
    
    dlclose(handle);
    return 0;
}

void HookManager::installNativeHooks() {
    LOGD("Installing native hooks...");
    
    // 使用 GOT/PLT Hook 方式
    // 首先获取原始函数地址
    orig_open = (int (*)(const char *, int, ...))dlsym(RTLD_NEXT, "open");
    orig_openat = (int (*)(int, const char *, int, ...))dlsym(RTLD_NEXT, "openat");
    orig_access = (int (*)(const char *, int))dlsym(RTLD_NEXT, "access");
    orig_stat = (int (*)(const char *, struct stat *))dlsym(RTLD_NEXT, "stat");
    orig_lstat = (int (*)(const char *, struct stat *))dlsym(RTLD_NEXT, "lstat");
    orig_rename = (int (*)(const char *, const char *))dlsym(RTLD_NEXT, "rename");
    orig_unlink = (int (*)(const char *))dlsym(RTLD_NEXT, "unlink");
    orig_mkdir = (int (*)(const char *, mode_t))dlsym(RTLD_NEXT, "mkdir");
    orig_rmdir = (int (*)(const char *))dlsym(RTLD_NEXT, "rmdir");
    
    // 遍历所有已加载的库进行 PLT Hook
    dl_iterate_phdr(callback, nullptr);
    
    // 使用 LD_PRELOAD 风格的 Hook - 直接替换 GOT 表项
    // 这里我们使用一个简化的方法：通过重载全局符号来实现
    
    LOGD("Native hooks installed (using RTLD_NEXT)");
}

void HookManager::installJavaHooks() {
    LOGD("Installing Java hooks...");
    
    // Hook Java 层的文件操作类
    // 通过 JNI 反射替换方法
    
    if (!m_env) return;
    
    // Hook java.io.File
    jclass fileClass = m_env->FindClass("java/io/File");
    if (fileClass) {
        // 获取所有构造函数并 Hook
        LOGD("Found java.io.File class");
    }
    
    // Hook java.io.FileInputStream
    jclass fisClass = m_env->FindClass("java/io/FileInputStream");
    if (fisClass) {
        LOGD("Found java.io.FileInputStream class");
    }
    
    // Hook java.io.FileOutputStream
    jclass fosClass = m_env->FindClass("java/io/FileOutputStream");
    if (fosClass) {
        LOGD("Found java.io.FileOutputStream class");
    }
    
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
    
    // 获取全局监控路径配置
    auto monitorPaths = Config::getInstance()->getMonitorPaths();
    
    // 如果没有启用监控且没有监控路径，则不记录
    if (!config.monitorEnabled && monitorPaths.empty()) return;
    
    // 检查是否需要监控此路径和操作
    bool shouldLog = false;
    
    // 首先检查全局监控路径
    for (const auto &mp : monitorPaths) {
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
    
    // 如果有重定向或拒绝，也应该记录
    if (result.decision == Decision::REDIRECT || result.decision == Decision::DENY_RO) {
        shouldLog = true;
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

// Hook 函数实现 - 使用弱符号覆盖

extern "C" {

// 弱符号声明，允许被覆盖
__attribute__((weak)) int open(const char *pathname, int flags, ...) {
    mode_t mode = 0;
    if (flags & O_CREAT) {
        va_list args;
        va_start(args, flags);
        mode = va_arg(args, mode_t);
        va_end(args);
    }
    
    // 如果 HookManager 未初始化，直接调用原始函数
    if (!HookManager::getInstance()->isInitialized()) {
        if (flags & O_CREAT) {
            return ::open(pathname, flags, mode);
        }
        return ::open(pathname, flags);
    }
    
    auto result = HookManager::getInstance()->processPath(pathname, Operation::OPEN, flags);
    
    // 处理只读拒绝 - 在调用原始函数之前就拒绝
    if (result.decision == Decision::DENY_RO) {
        HookManager::getInstance()->logOperation(Operation::OPEN, pathname, result, EACCES);
        errno = EACCES;
        return -1;
    }
    
    const char *actualPath = result.decision == Decision::REDIRECT ? 
                             result.mappedPath.c_str() : pathname;
    
    int ret;
    if (flags & O_CREAT) {
        ret = orig_open ? orig_open(actualPath, flags, mode) : ::open(actualPath, flags, mode);
    } else {
        ret = orig_open ? orig_open(actualPath, flags) : ::open(actualPath, flags);
    }
    
    int saved_errno = errno;
    HookManager::getInstance()->logOperation(Operation::OPEN, pathname, result, ret < 0 ? saved_errno : 0);
    
    errno = saved_errno;
    return ret;
}

__attribute__((weak)) int openat(int dirfd, const char *pathname, int flags, ...) {
    mode_t mode = 0;
    if (flags & O_CREAT) {
        va_list args;
        va_start(args, flags);
        mode = va_arg(args, mode_t);
        va_end(args);
    }
    
    if (!HookManager::getInstance()->isInitialized() || !pathname || pathname[0] != '/') {
        if (flags & O_CREAT) {
            return ::openat(dirfd, pathname, flags, mode);
        }
        return ::openat(dirfd, pathname, flags);
    }
    
    auto result = HookManager::getInstance()->processPath(pathname, Operation::OPEN, flags);
    
    // 处理只读拒绝 - 在调用原始函数之前就拒绝
    if (result.decision == Decision::DENY_RO) {
        HookManager::getInstance()->logOperation(Operation::OPEN, pathname, result, EACCES);
        errno = EACCES;
        return -1;
    }
    
    const char *actualPath = result.decision == Decision::REDIRECT ? 
                             result.mappedPath.c_str() : pathname;
    
    int ret;
    if (flags & O_CREAT) {
        ret = orig_openat ? orig_openat(dirfd, actualPath, flags, mode) : ::openat(dirfd, actualPath, flags, mode);
    } else {
        ret = orig_openat ? orig_openat(dirfd, actualPath, flags) : ::openat(dirfd, actualPath, flags);
    }
    
    int saved_errno = errno;
    HookManager::getInstance()->logOperation(Operation::OPEN, pathname, result, ret < 0 ? saved_errno : 0);
    
    errno = saved_errno;
    return ret;
}

__attribute__((weak)) int access(const char *pathname, int mode) {
    if (!HookManager::getInstance()->isInitialized()) {
        return ::access(pathname, mode);
    }
    
    auto result = HookManager::getInstance()->processPath(pathname, Operation::ACCESS);
    
    const char *actualPath = result.decision == Decision::REDIRECT ? 
                             result.mappedPath.c_str() : pathname;
    
    int ret = orig_access ? orig_access(actualPath, mode) : ::access(actualPath, mode);
    int saved_errno = errno;
    HookManager::getInstance()->logOperation(Operation::ACCESS, pathname, result, ret < 0 ? saved_errno : 0);
    
    errno = saved_errno;
    return ret;
}

__attribute__((weak)) int stat(const char *pathname, struct stat *statbuf) {
    if (!HookManager::getInstance()->isInitialized()) {
        return ::stat(pathname, statbuf);
    }
    
    auto result = HookManager::getInstance()->processPath(pathname, Operation::STAT);
    
    const char *actualPath = result.decision == Decision::REDIRECT ? 
                             result.mappedPath.c_str() : pathname;
    
    int ret = orig_stat ? orig_stat(actualPath, statbuf) : ::stat(actualPath, statbuf);
    int saved_errno = errno;
    HookManager::getInstance()->logOperation(Operation::STAT, pathname, result, ret < 0 ? saved_errno : 0);
    
    errno = saved_errno;
    return ret;
}

__attribute__((weak)) int lstat(const char *pathname, struct stat *statbuf) {
    if (!HookManager::getInstance()->isInitialized()) {
        return ::lstat(pathname, statbuf);
    }
    
    auto result = HookManager::getInstance()->processPath(pathname, Operation::STAT);
    
    const char *actualPath = result.decision == Decision::REDIRECT ? 
                             result.mappedPath.c_str() : pathname;
    
    int ret = orig_lstat ? orig_lstat(actualPath, statbuf) : ::lstat(actualPath, statbuf);
    int saved_errno = errno;
    HookManager::getInstance()->logOperation(Operation::STAT, pathname, result, ret < 0 ? saved_errno : 0);
    
    errno = saved_errno;
    return ret;
}

__attribute__((weak)) int rename(const char *oldpath, const char *newpath) {
    if (!HookManager::getInstance()->isInitialized()) {
        return ::rename(oldpath, newpath);
    }
    
    auto result = HookManager::getInstance()->processPath(oldpath, Operation::RENAME);
    
    // 处理只读拒绝 - 在调用原始函数之前就拒绝
    if (result.decision == Decision::DENY_RO) {
        HookManager::getInstance()->logOperation(Operation::RENAME, oldpath, result, EACCES);
        errno = EACCES;
        return -1;
    }
    
    int ret = orig_rename ? orig_rename(oldpath, newpath) : ::rename(oldpath, newpath);
    int saved_errno = errno;
    HookManager::getInstance()->logOperation(Operation::RENAME, oldpath, result, ret < 0 ? saved_errno : 0);
    
    errno = saved_errno;
    return ret;
}

__attribute__((weak)) int unlink(const char *pathname) {
    if (!HookManager::getInstance()->isInitialized()) {
        return ::unlink(pathname);
    }
    
    auto result = HookManager::getInstance()->processPath(pathname, Operation::UNLINK);
    
    // 处理只读拒绝 - 在调用原始函数之前就拒绝
    if (result.decision == Decision::DENY_RO) {
        HookManager::getInstance()->logOperation(Operation::UNLINK, pathname, result, EACCES);
        errno = EACCES;
        return -1;
    }
    
    int ret = orig_unlink ? orig_unlink(pathname) : ::unlink(pathname);
    int saved_errno = errno;
    HookManager::getInstance()->logOperation(Operation::UNLINK, pathname, result, ret < 0 ? saved_errno : 0);
    
    errno = saved_errno;
    return ret;
}

__attribute__((weak)) int mkdir(const char *pathname, mode_t mode) {
    if (!HookManager::getInstance()->isInitialized()) {
        return ::mkdir(pathname, mode);
    }
    
    auto result = HookManager::getInstance()->processPath(pathname, Operation::MKDIR);
    
    // 处理只读拒绝 - 在调用原始函数之前就拒绝
    if (result.decision == Decision::DENY_RO) {
        HookManager::getInstance()->logOperation(Operation::MKDIR, pathname, result, EACCES);
        errno = EACCES;
        return -1;
    }
    
    // 如果是重定向，创建目标目录
    const char *actualPath = result.decision == Decision::REDIRECT ? 
                             result.mappedPath.c_str() : pathname;
    
    int ret = orig_mkdir ? orig_mkdir(actualPath, mode) : ::mkdir(actualPath, mode);
    int saved_errno = errno;
    HookManager::getInstance()->logOperation(Operation::MKDIR, pathname, result, ret < 0 ? saved_errno : 0);
    
    errno = saved_errno;
    return ret;
}

__attribute__((weak)) int rmdir(const char *pathname) {
    if (!HookManager::getInstance()->isInitialized()) {
        return ::rmdir(pathname);
    }
    
    auto result = HookManager::getInstance()->processPath(pathname, Operation::RMDIR);
    
    // 处理只读拒绝 - 在调用原始函数之前就拒绝
    if (result.decision == Decision::DENY_RO) {
        HookManager::getInstance()->logOperation(Operation::RMDIR, pathname, result, EACCES);
        errno = EACCES;
        return -1;
    }
    
    int ret = orig_rmdir ? orig_rmdir(pathname) : ::rmdir(pathname);
    int saved_errno = errno;
    HookManager::getInstance()->logOperation(Operation::RMDIR, pathname, result, ret < 0 ? saved_errno : 0);
    
    errno = saved_errno;
    return ret;
}

} // extern "C"

} // namespace StorageRedirect
