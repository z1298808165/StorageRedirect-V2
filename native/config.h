#pragma once

#include <string>
#include <vector>
#include <mutex>
#include <atomic>

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

// 监控路径配置
struct MonitorPath {
    std::string path;
    std::vector<std::string> ops;
};

// 应用配置
struct AppConfig {
    bool enabled = false;
    bool monitorEnabled = false;
    std::vector<RedirectRule> redirectRules;
    std::vector<ReadOnlyRule> readOnlyRules;
    std::vector<MonitorPath> monitorPaths;
};

// 配置管理器
class Config {
public:
    static Config* getInstance();
    
    // 初始化
    void init();
    
    // 检查是否需要 Hook 此应用
    bool shouldHookApp(const std::string &processName, int uid);
    
    // 获取应用配置
    AppConfig getAppConfig(const std::string &processName);
    
    // 检查配置更新
    void checkUpdate();
    
    // 路径工具函数
    static std::string normalizePath(const std::string &path);
    static bool pathMatches(const std::string &path, const std::string &pattern);
    
private:
    Config() = default;
    ~Config() = default;
    
    // 加载配置
    void loadConfig();
    
    // 从 daemon 获取配置
    void fetchConfigFromDaemon();
    
    std::mutex m_mutex;
    std::atomic<int> m_configVersion{0};
    std::atomic<int> m_lastCheckedVersion{0};
    
    // 缓存的配置
    std::vector<std::string> m_hookedApps;
};

} // namespace StorageRedirect
