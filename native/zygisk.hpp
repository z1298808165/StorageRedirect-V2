#pragma once

#include <jni.h>

namespace zygisk {

enum class Option : int {
    DLCLOSE_MODULE_LIBRARY = 0,
    KEEP_MODULE_LIBRARY = 1,
};

struct Api;

struct AppSpecializeArgs {
    jint &uid;
    jint &gid;
    jintArray &gids;
    jint &runtime_flags;
    jint &mount_external;
    jstring &se_info;
    jstring &nice_name;
    jstring &instruction_set;
    jstring &app_data_dir;
};

struct ServerSpecializeArgs {
    jint &uid;
    jint &gid;
    jintArray &gids;
    jint &runtime_flags;
    jlong &permitted_capabilities;
    jlong &effective_capabilities;
};

struct Api {
    void (*setOption)(Option opt) = nullptr;
    void (*setEntrypoint)(void *entry) = nullptr;
};

class ModuleBase {
public:
    virtual void onLoad(Api *api, JNIEnv *env) {}
    virtual void preAppSpecialize(AppSpecializeArgs *args) {}
    virtual void postAppSpecialize(const AppSpecializeArgs *args) {}
    virtual void preServerSpecialize(ServerSpecializeArgs *args) {}
    virtual void postServerSpecialize(const ServerSpecializeArgs *args) {}
};

#define REGISTER_ZYGISK_MODULE(className) \
    extern "C" void zygisk_module_entry(zygisk::Api *api, JNIEnv *env) { \
        static className module; \
        module.onLoad(api, env); \
    }

} // namespace zygisk
