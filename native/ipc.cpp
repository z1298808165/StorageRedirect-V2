#include <android/log.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>
#include <cstring>
#include <string>

#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, "StorageRedirect/IPC", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "StorageRedirect/IPC", __VA_ARGS__)

namespace StorageRedirect {

static const char *SOCKET_PATH = "/data/adb/modules/StorageRedirect/run/ipc.sock";

// 简化版的 IPC 客户端，用于向 daemon 发送日志
// 实际实现需要完整的协议处理

bool sendLogToDaemon(const std::string &jsonLog) {
    int sock = socket(AF_UNIX, SOCK_STREAM, 0);
    if (sock < 0) {
        return false;
    }
    
    struct sockaddr_un addr;
    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, SOCKET_PATH, sizeof(addr.sun_path) - 1);
    
    if (connect(sock, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        close(sock);
        return false;
    }
    
    // 发送日志（简化处理）
    std::string message = jsonLog + "\n";
    ssize_t sent = send(sock, message.c_str(), message.length(), 0);
    
    close(sock);
    return sent == (ssize_t)message.length();
}

} // namespace StorageRedirect
