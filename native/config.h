#pragma once

#include <string>
#include <vector>
#include <map>
#include <mutex>
#include <json/json.h>

namespace StorageRedirect {

// 重定向规则
struct RedirectRule {
    std::string src;
    std::string dst;
};

// 只读规则
struct ReadOnlyRule {
    std::string path;
};

// 监控路径
struct MonitorPath {
    int64_t id;
    std::string path;
    std::string desc;
    std::vector<std::string> ops;
};

// 动态更新配置
struct UpdateConfig {
    int pollIntervalMs = 3000;
    int opCheckInterval = 50;
};

// 进程归属配置
struct ProcessAttrConfig {
    std::string mode = "strict";
    bool inheritToAllSameUid = true;
    bool inheritToIsolated = true;
    bool inheritToChildProcess = true;
    std::string fallbackUnknownPolicy = "denyWriteOnMatchedPaths";
    bool diagnosticTagUnknown = true;
};

// URI 配置
struct URIConfig {
    bool redirectEnabled = true;
    std::string mappingMode = "bestEffort";
    std::string onMappingFailed = "enforceReadonlyAndMonitor";
    bool logMappingDetails = true;
};

// 全局配置
struct GlobalConfig {
    bool monitorEnabled = true;
    std::string logLevel = "info";
    int maxLogSizeMB = 64;
    UpdateConfig update;
    ProcessAttrConfig processAttr;
    URIConfig uri;
};

// 应用配置
struct AppConfig {
    bool enabled = false;
    std::vector<RedirectRule> redirectRules;
    std::vector<ReadOnlyRule> readOnlyRules;
    std::vector<MonitorPath> monitorPaths;
    bool monitorEnabled = true;
};

// 配置管理器
class Config {
public:
    static Config* getInstance();
    
    void init();
    
    // 获取应用配置
    AppConfig getAppConfig(const std::string &pkg);
    
    // 检查是否应该 Hook 此应用
    bool shouldHookApp(const std::string &processName, int uid);
    
    // 检查配置更新
    void checkUpdate();
    
    // 工具函数
    static std::string normalizePath(const std::string &path);
    static bool pathMatches(const std::string &path, const std::string &pattern);

private:
    Config() = default;
    ~Config() = default;
    Config(const Config&) = delete;
    Config& operator=(const Config&) = delete;
    
    void loadGlobalConfig();
    void loadMonitorConfig();
    void loadAllAppConfigs();
    bool loadAppConfig(const std::string &pkg, AppConfig &config);
    
    GlobalConfig getDefaultGlobalConfig();
    
    std::mutex m_mutex;
    bool m_initialized = false;
    
    GlobalConfig m_globalConfig;
    std::vector<MonitorPath> m_monitorPaths;
    std::map<std::string, AppConfig> m_appConfigs;
};

} // namespace StorageRedirect
