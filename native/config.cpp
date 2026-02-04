#include "config.h"
#include <android/log.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>
#include <fcntl.h>
#include <json/json.h>
#include <fstream>

#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, "StorageRedirect/Config", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "StorageRedirect/Config", __VA_ARGS__)

namespace StorageRedirect {

static const char *CONFIG_PATH = "/data/adb/modules/StorageRedirect/config/config.json";
static const char *SOCKET_PATH = "/data/adb/modules/StorageRedirect/run/ipc.sock";

Config* Config::getInstance() {
    static Config instance;
    return &instance;
}

void Config::init() {
    LOGD("Config initialized");
    loadConfig();
}

void Config::loadConfig() {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    // 尝试从文件加载配置
    std::ifstream file(CONFIG_PATH);
    if (!file.is_open()) {
        LOGE("Failed to open config file: %s", CONFIG_PATH);
        return;
    }
    
    try {
        Json::Value root;
        Json::CharReaderBuilder builder;
        std::string errors;
        
        if (!Json::parseFromStream(builder, file, &root, &errors)) {
            LOGE("Failed to parse config: %s", errors.c_str());
            return;
        }
        
        m_configVersion = root.get("version", 0).asInt();
        m_lastCheckedVersion = m_configVersion;
        
        // 解析应用列表
        const Json::Value &apps = root["apps"];
        m_hookedApps.clear();
        for (const auto &member : apps.getMemberNames()) {
            const Json::Value &app = apps[member];
            if (app.get("enabled", false).asBool()) {
                m_hookedApps.push_back(member);
            }
        }
        
        LOGD("Config loaded, version=%d, hooked apps=%zu", 
             m_configVersion.load(), m_hookedApps.size());
    } catch (const std::exception &e) {
        LOGE("Exception loading config: %s", e.what());
    }
}

bool Config::shouldHookApp(const std::string &processName, int uid) {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    // 检查是否在配置列表中
    for (const auto &app : m_hookedApps) {
        if (processName.find(app) != std::string::npos || app.find(processName) != std::string::npos) {
            return true;
        }
    }
    
    return false;
}

AppConfig Config::getAppConfig(const std::string &processName) {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    AppConfig config;
    
    // 尝试从文件加载
    std::ifstream file(CONFIG_PATH);
    if (!file.is_open()) {
        return config;
    }
    
    try {
        Json::Value root;
        Json::CharReaderBuilder builder;
        std::string errors;
        
        if (!Json::parseFromStream(builder, file, &root, &errors)) {
            return config;
        }
        
        // 查找应用配置
        const Json::Value &apps = root["apps"];
        std::string pkgName;
        
        // 尝试匹配进程名到包名
        for (const auto &member : apps.getMemberNames()) {
            if (processName.find(member) != std::string::npos || member.find(processName) != std::string::npos) {
                pkgName = member;
                break;
            }
        }
        
        if (pkgName.empty()) {
            return config;
        }
        
        const Json::Value &app = apps[pkgName];
        config.enabled = app.get("enabled", false).asBool();
        
        // 解析重定向规则
        const Json::Value &redirectRules = app["redirectRules"];
        for (const auto &rule : redirectRules) {
            RedirectRule r;
            r.src = rule.get("src", "").asString();
            r.dst = rule.get("dst", "").asString();
            if (!r.src.empty() && !r.dst.empty()) {
                config.redirectRules.push_back(r);
            }
        }
        
        // 解析只读规则
        const Json::Value &readOnlyRules = app["readOnlyRules"];
        for (const auto &rule : readOnlyRules) {
            ReadOnlyRule r;
            r.path = rule.get("path", "").asString();
            if (!r.path.empty()) {
                config.readOnlyRules.push_back(r);
            }
        }
        
        // 解析监控路径
        const Json::Value &monitorPaths = app["monitorPaths"];
        for (const auto &mp : monitorPaths) {
            MonitorPath m;
            m.path = mp.get("path", "").asString();
            const Json::Value &ops = mp["ops"];
            for (const auto &op : ops) {
                m.ops.push_back(op.asString());
            }
            if (!m.path.empty()) {
                config.monitorPaths.push_back(m);
            }
        }
        
        // 全局监控开关
        const Json::Value &global = root["global"];
        config.monitorEnabled = global.get("monitorEnabled", false).asBool();
        
    } catch (const std::exception &e) {
        LOGE("Exception getting app config: %s", e.what());
    }
    
    return config;
}

void Config::checkUpdate() {
    // 简化处理：直接从文件重新加载
    // 实际应该通过 IPC 查询 daemon 的版本号
    loadConfig();
}

std::string Config::normalizePath(const std::string &path) {
    if (path.empty()) return path;
    
    std::string result = path;
    
    // 移除多余的斜杠
    size_t pos = 0;
    while ((pos = result.find("//", pos)) != std::string::npos) {
        result.erase(pos, 1);
    }
    
    // 处理 . 和 ..
    std::vector<std::string> components;
    std::stringstream ss(result);
    std::string component;
    
    while (std::getline(ss, component, '/')) {
        if (component == "" || component == ".") {
            continue;
        } else if (component == "..") {
            if (!components.empty()) {
                components.pop_back();
            }
        } else {
            components.push_back(component);
        }
    }
    
    result = "/";
    for (size_t i = 0; i < components.size(); i++) {
        if (i > 0) result += "/";
        result += components[i];
    }
    
    // 确保目录以 / 结尾
    if (path.back() == '/' && result.back() != '/' && result != "/") {
        result += "/";
    }
    
    return result;
}

bool Config::pathMatches(const std::string &path, const std::string &pattern) {
    std::string normPath = normalizePath(path);
    std::string normPattern = normalizePath(pattern);
    
    // 确保 pattern 以 / 结尾表示目录匹配
    if (normPattern.back() != '/') {
        normPattern += "/";
    }
    
    // 检查 path 是否以 pattern 开头
    if (normPath.length() < normPattern.length()) {
        return false;
    }
    
    return normPath.compare(0, normPattern.length(), normPattern) == 0;
}

} // namespace StorageRedirect
