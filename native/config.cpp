#include "config.h"
#include <android/log.h>
#include <fstream>
#include <dirent.h>
#include <sys/stat.h>

#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, "StorageRedirect/Config", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "StorageRedirect/Config", __VA_ARGS__)

namespace StorageRedirect {

static const char *APPS_CONFIG_DIR = "/data/adb/modules/StorageRedirect/config/apps";
static const char *MONITOR_CONFIG_PATH = "/data/adb/modules/StorageRedirect/config/monitor_paths.json";
static const char *GLOBAL_CONFIG_PATH = "/data/adb/modules/StorageRedirect/config/global.json";

Config* Config::getInstance() {
    static Config instance;
    return &instance;
}

void Config::init() {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    if (m_initialized) return;
    
    LOGD("Initializing config...");
    
    // 加载全局配置
    loadGlobalConfig();
    
    // 加载监控路径配置
    loadMonitorConfig();
    
    // 加载所有应用配置
    loadAllAppConfigs();
    
    m_initialized = true;
    LOGD("Config initialized, loaded %zu apps", m_appConfigs.size());
}

void Config::loadGlobalConfig() {
    std::ifstream file(GLOBAL_CONFIG_PATH);
    if (!file.is_open()) {
        LOGD("Global config not found, using defaults");
        m_globalConfig = getDefaultGlobalConfig();
        return;
    }
    
    try {
        Json::Value root;
        file >> root;
        
        m_globalConfig.monitorEnabled = root.get("monitorEnabled", true).asBool();
        m_globalConfig.logLevel = root.get("logLevel", "info").asString();
        m_globalConfig.maxLogSizeMB = root.get("maxLogSizeMB", 64).asInt();
        
        // 解析 update 配置
        if (root.isMember("update")) {
            const auto &update = root["update"];
            m_globalConfig.update.pollIntervalMs = update.get("pollIntervalMs", 3000).asInt();
            m_globalConfig.update.opCheckInterval = update.get("opCheckInterval", 50).asInt();
        }
        
        // 解析 processAttribution 配置
        if (root.isMember("processAttribution")) {
            const auto &pa = root["processAttribution"];
            m_globalConfig.processAttr.mode = pa.get("mode", "strict").asString();
            m_globalConfig.processAttr.inheritToAllSameUid = pa.get("inheritToAllSameUid", true).asBool();
            m_globalConfig.processAttr.inheritToIsolated = pa.get("inheritToIsolated", true).asBool();
            m_globalConfig.processAttr.inheritToChildProcess = pa.get("inheritToChildProcess", true).asBool();
            m_globalConfig.processAttr.fallbackUnknownPolicy = pa.get("fallbackUnknownPolicy", "denyWriteOnMatchedPaths").asString();
            m_globalConfig.processAttr.diagnosticTagUnknown = pa.get("diagnosticTagUnknown", true).asBool();
        }
        
        // 解析 URI 配置
        if (root.isMember("uri")) {
            const auto &uri = root["uri"];
            m_globalConfig.uri.redirectEnabled = uri.get("redirectEnabled", true).asBool();
            m_globalConfig.uri.mappingMode = uri.get("mappingMode", "bestEffort").asString();
            m_globalConfig.uri.onMappingFailed = uri.get("onMappingFailed", "enforceReadonlyAndMonitor").asString();
            m_globalConfig.uri.logMappingDetails = uri.get("logMappingDetails", true).asBool();
        }
        
        LOGD("Global config loaded");
    } catch (const std::exception &e) {
        LOGE("Failed to parse global config: %s", e.what());
        m_globalConfig = getDefaultGlobalConfig();
    }
}

void Config::loadMonitorConfig() {
    std::ifstream file(MONITOR_CONFIG_PATH);
    if (!file.is_open()) {
        LOGD("Monitor config not found, using empty");
        m_monitorPaths.clear();
        return;
    }
    
    try {
        Json::Value root;
        file >> root;
        
        m_monitorPaths.clear();
        
        if (root.isMember("paths") && root["paths"].isArray()) {
            const auto &paths = root["paths"];
            for (const auto &path : paths) {
                MonitorPath mp;
                mp.id = path.get("id", 0).asInt64();
                mp.path = path.get("path", "").asString();
                mp.desc = path.get("desc", "").asString();
                
                if (path.isMember("operations") && path["operations"].isArray()) {
                    const auto &ops = path["operations"];
                    for (const auto &op : ops) {
                        mp.ops.push_back(op.asString());
                    }
                }
                
                m_monitorPaths.push_back(mp);
            }
        }
        
        LOGD("Monitor config loaded, %zu paths", m_monitorPaths.size());
    } catch (const std::exception &e) {
        LOGE("Failed to parse monitor config: %s", e.what());
        m_monitorPaths.clear();
    }
}

void Config::loadAllAppConfigs() {
    m_appConfigs.clear();
    
    DIR *dir = opendir(APPS_CONFIG_DIR);
    if (!dir) {
        LOGD("Apps config dir not found: %s", APPS_CONFIG_DIR);
        return;
    }
    
    struct dirent *entry;
    while ((entry = readdir(dir)) != nullptr) {
        std::string filename = entry->d_name;
        
        // 检查是否是 .json 文件
        if (filename.length() < 5 || 
            filename.substr(filename.length() - 5) != ".json") {
            continue;
        }
        
        // 提取包名
        std::string pkg = filename.substr(0, filename.length() - 5);
        
        AppConfig config;
        if (loadAppConfig(pkg, config)) {
            // 合并监控路径到应用配置（用于兼容）
            config.monitorPaths = m_monitorPaths;
            config.monitorEnabled = m_globalConfig.monitorEnabled;
            
            m_appConfigs[pkg] = config;
            LOGD("Loaded config for %s: enabled=%d, redirects=%zu, readonly=%zu",
                 pkg.c_str(), config.enabled, 
                 config.redirectRules.size(), 
                 config.readOnlyRules.size());
        }
    }
    
    closedir(dir);
}

bool Config::loadAppConfig(const std::string &pkg, AppConfig &config) {
    std::string path = std::string(APPS_CONFIG_DIR) + "/" + pkg + ".json";
    std::ifstream file(path);
    
    if (!file.is_open()) {
        return false;
    }
    
    try {
        Json::Value root;
        file >> root;
        
        config.enabled = root.get("enabled", false).asBool();
        
        // 解析重定向规则
        config.redirectRules.clear();
        if (root.isMember("redirectRules") && root["redirectRules"].isArray()) {
            const auto &rules = root["redirectRules"];
            for (const auto &rule : rules) {
                RedirectRule r;
                r.src = rule.get("src", "").asString();
                r.dst = rule.get("dst", "").asString();
                if (!r.src.empty() && !r.dst.empty()) {
                    config.redirectRules.push_back(r);
                }
            }
        }
        
        // 解析只读规则
        config.readOnlyRules.clear();
        if (root.isMember("readOnlyRules") && root["readOnlyRules"].isArray()) {
            const auto &rules = root["readOnlyRules"];
            for (const auto &rule : rules) {
                ReadOnlyRule r;
                r.path = rule.get("path", "").asString();
                if (!r.path.empty()) {
                    config.readOnlyRules.push_back(r);
                }
            }
        }
        
        return true;
    } catch (const std::exception &e) {
        LOGE("Failed to parse app config for %s: %s", pkg.c_str(), e.what());
        return false;
    }
}

AppConfig Config::getAppConfig(const std::string &pkg) {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    auto it = m_appConfigs.find(pkg);
    if (it != m_appConfigs.end()) {
        return it->second;
    }
    
    // 返回默认配置
    AppConfig config;
    config.enabled = false;
    config.monitorPaths = m_monitorPaths;
    config.monitorEnabled = m_globalConfig.monitorEnabled;
    return config;
}

bool Config::shouldHookApp(const std::string &processName, int uid) {
    // 只 Hook 普通应用进程（uid >= 10000）
    if (uid < 10000) {
        return false;
    }
    
    // 检查是否有此应用的配置
    auto config = getAppConfig(processName);
    
    // 如果启用了或有规则，则 Hook
    return config.enabled || 
           !config.redirectRules.empty() || 
           !config.readOnlyRules.empty();
}

void Config::checkUpdate() {
    // 简化处理：检查配置文件修改时间或版本号
    // 实际应该通过 IPC 从 daemon 获取最新版本号
    
    // 这里仅作示例，实际实现需要与 daemon 通信
    static int lastCheckTime = 0;
    int currentTime = time(nullptr);
    
    if (currentTime - lastCheckTime < 5) {
        return; // 5秒内不重复检查
    }
    lastCheckTime = currentTime;
    
    // TODO: 通过 IPC 获取 daemon 配置版本，如有更新则重新加载
}

std::string Config::normalizePath(const std::string &path) {
    if (path.empty()) return path;
    
    std::string result = path;
    
    // 移除多余的斜杠
    size_t pos = 0;
    while ((pos = result.find("//", pos)) != std::string::npos) {
        result.erase(pos, 1);
    }
    
    // 确保目录以 / 结尾（用于前缀匹配）
    struct stat st;
    if (stat(result.c_str(), &st) == 0 && S_ISDIR(st.st_mode)) {
        if (result.back() != '/') {
            result += '/';
        }
    }
    
    return result;
}

bool Config::pathMatches(const std::string &path, const std::string &pattern) {
    // 简单的前缀匹配
    // pattern 应该以 / 结尾表示目录前缀匹配
    
    std::string normalizedPath = normalizePath(path);
    std::string normalizedPattern = normalizePath(pattern);
    
    // 确保 pattern 以 / 结尾（前缀匹配）
    if (normalizedPattern.back() != '/') {
        normalizedPattern += '/';
    }
    
    // 检查 path 是否以 pattern 开头
    if (normalizedPath.length() < normalizedPattern.length()) {
        return false;
    }
    
    return normalizedPath.compare(0, normalizedPattern.length(), normalizedPattern) == 0;
}

GlobalConfig Config::getDefaultGlobalConfig() {
    GlobalConfig config;
    config.monitorEnabled = true;
    config.logLevel = "info";
    config.maxLogSizeMB = 64;
    config.update.pollIntervalMs = 3000;
    config.update.opCheckInterval = 50;
    config.processAttr.mode = "strict";
    config.processAttr.inheritToAllSameUid = true;
    config.processAttr.inheritToIsolated = true;
    config.processAttr.inheritToChildProcess = true;
    config.processAttr.fallbackUnknownPolicy = "denyWriteOnMatchedPaths";
    config.processAttr.diagnosticTagUnknown = true;
    config.uri.redirectEnabled = true;
    config.uri.mappingMode = "bestEffort";
    config.uri.onMappingFailed = "enforceReadonlyAndMonitor";
    config.uri.logMappingDetails = true;
    return config;
}

} // namespace StorageRedirect
