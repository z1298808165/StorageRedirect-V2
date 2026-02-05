#include <android/log.h>
#include <jni.h>

#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, "StorageRedirect", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "StorageRedirect", __VA_ARGS__)

// 简单的 Zygisk 模块入口
extern "C" {

JNIEXPORT jint JNI_OnLoad(JavaVM *vm, void *reserved) {
    LOGD("StorageRedirect module loaded");
    return JNI_VERSION_1_6;
}

} // extern "C"
