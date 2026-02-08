#include <android/log.h>
#include <jni.h>
#include "zygisk.hpp"
#include "hook.h"
#include "config.h"

#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, "StorageRedirect", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "StorageRedirect", __VA_ARGS__)

using namespace zygisk;
using namespace StorageRedirect;

class StorageRedirectModule : public ModuleBase {
public:
    void onLoad(Api *api, JNIEnv *env) override {
        this->api = api;
        this->env = env;
        LOGD("StorageRedirect module loaded");
    }

    void preAppSpecialize(AppSpecializeArgs *args) override {
        // 获取应用信息
        auto *appData = args->app_data;
        if (!appData) return;

        const char *processName = env->GetStringUTFChars(appData->nice_name, nullptr);
        int uid = appData->uid;

        LOGD("preAppSpecialize: process=%s, uid=%d", processName, uid);

        // 检查是否需要 Hook 此应用
        Config::getInstance()->init();
        if (Config::getInstance()->shouldHookApp(processName, uid)) {
            LOGD("Should hook app: %s", processName);
            
            // 初始化 Hook 管理器
            HookManager::getInstance()->init(env, processName, uid);
            
            // 标记需要 Hook
            shouldHook = true;
        }

        env->ReleaseStringUTFChars(appData->nice_name, processName);
    }

    void postAppSpecialize(const AppSpecializeArgs *args) override {
        if (shouldHook) {
            LOGD("Installing hooks for app");
            HookManager::getInstance()->installHooks();
        }
    }

    void preServerSpecialize(ServerSpecializeArgs *args) override {
        // 系统服务不需要 Hook
    }

private:
    Api *api = nullptr;
    JNIEnv *env = nullptr;
    bool shouldHook = false;
};

REGISTER_ZYGISK_MODULE(StorageRedirectModule)

extern "C" {

JNIEXPORT jint JNI_OnLoad(JavaVM *vm, void *reserved) {
    LOGD("StorageRedirect JNI_OnLoad called");
    return JNI_VERSION_1_6;
}

} // extern "C"
