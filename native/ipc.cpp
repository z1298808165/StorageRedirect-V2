#include "ipc.h"
#include <android/log.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>

#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, "StorageRedirect/IPC", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "StorageRedirect/IPC", __VA_ARGS__)

namespace StorageRedirect {

static const char *SOCKET_PATH = "/data/adb/modules/StorageRedirect/run/ipc.sock";

IPCClient* IPCClient::getInstance() {
    static IPCClient instance;
    return &instance;
}

bool IPCClient::connect() {
    if (m_socket >= 0) {
        return true; // 已连接
    }
    
    m_socket = socket(AF_UNIX, SOCK_STREAM, 0);
    if (m_socket < 0) {
        LOGE("Failed to create socket: %s", strerror(errno));
        return false;
    }
    
    struct sockaddr_un addr;
    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, SOCKET_PATH, sizeof(addr.sun_path) - 1);
    
    if (::connect(m_socket, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        LOGE("Failed to connect to daemon: %s", strerror(errno));
        close(m_socket);
        m_socket = -1;
        return false;
    }
    
    // 设置非阻塞
    int flags = fcntl(m_socket, F_GETFL, 0);
    fcntl(m_socket, F_SETFL, flags | O_NONBLOCK);
    
    LOGD("Connected to daemon");
    return true;
}

void IPCClient::disconnect() {
    if (m_socket >= 0) {
        close(m_socket);
        m_socket = -1;
    }
}

std::string IPCClient::sendCommand(const std::string &cmd) {
    if (!connect()) {
        return "";
    }
    
    // 发送命令
    std::string request = cmd + "\n";
    if (send(m_socket, request.c_str(), request.length(), 0) < 0) {
        LOGE("Failed to send command: %s", strerror(errno));
        disconnect();
        return "";
    }
    
    // 接收响应
    char buffer[4096];
    std::string response;
    
    fd_set fds;
    FD_ZERO(&fds);
    FD_SET(m_socket, &fds);
    
    struct timeval tv;
    tv.tv_sec = 5;
    tv.tv_usec = 0;
    
    int ret = select(m_socket + 1, &fds, nullptr, nullptr, &tv);
    if (ret <= 0) {
        LOGE("Timeout or error waiting for response");
        return "";
    }
    
    ssize_t n = recv(m_socket, buffer, sizeof(buffer) - 1, 0);
    if (n > 0) {
        buffer[n] = '\0';
        response = buffer;
    }
    
    return response;
}

bool IPCClient::logEvent(const std::string &json) {
    // 构建日志命令
    std::string cmd = R"({"cmd":"log.append","params":{"entry":)" + json + "}}";
    
    std::string response = sendCommand(cmd);
    return !response.empty();
}

} // namespace StorageRedirect
