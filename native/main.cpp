#include <android/log.h>
#include <sys/system_properties.h>
#include <unistd.h>
#include <dlfcn.h>
#include <string.h>
#include <stdlib.h>

#include "zygisk.hpp"
#include "hook.h"
#include "config.h"

#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, "StorageRedirect", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "StorageRedirect", __VA_ARGS__)

using zygisk::Api;
using zygisk::AppSpecializeArgs;
using zygisk::ServerSpecializeArgs;

class StorageRedirectModule : public zygisk::ModuleBase {
public:
    void onLoad(Api *api, JNIEnv *env) override {
        this->api = api;
        this->env = env;
        
        LOGD("Module loaded");
        
        // 初始化配置系统
        Config::getInstance()->init();
    }

    void preAppSpecialize(AppSpecializeArgs *args) override {
        // 获取应用信息
        jstring niceName = args->nice_name;
        if (!niceName) return;
        
        const char *name = env->GetStringUTFChars(niceName, nullptr);
        if (!name) return;
        
        processName = name;
        env->ReleaseStringUTFChars(niceName, name);
        
        // 获取 UID
        uid = args->uid;
        
        LOGD("preAppSpecialize: %s, uid=%d", processName.c_str(), uid);
        
        // 检查是否需要处理此应用
        shouldHook = Config::getInstance()->shouldHookApp(processName, uid);
        
        if (shouldHook) {
            // 从 Zygote 中排除，我们需要在应用进程中运行
            api->setOption(zygisk::Option::DLCLOSE_MODULE_LIBRARY);
        }
    }

    void postAppSpecialize(const AppSpecializeArgs *args) override {
        if (!shouldHook) return;
        
        LOGD("postAppSpecialize: %s, uid=%d", processName.c_str(), uid);
        
        // 在应用进程中初始化 Hook
        HookManager::getInstance()->init(env, processName, uid);
        HookManager::getInstance()->installHooks();
    }

    void preServerSpecialize(ServerSpecializeArgs *args) override {
        // 系统服务器，不需要处理
        api->setOption(zygisk::Option::DLCLOSE_MODULE_LIBRARY);
    }

private:
    Api *api;
    JNIEnv *env;
    std::string processName;
    int uid = -1;
    bool shouldHook = false;
};

REGISTER_ZYGISK_MODULE(StorageRedirectModule)
