#pragma once

#include <string>
#include <vector>

namespace StorageRedirect {

// IPC 客户端
class IPCClient {
public:
    static IPCClient* getInstance();
    
    // 连接到 daemon
    bool connect();
    
    // 断开连接
    void disconnect();
    
    // 发送命令
    std::string sendCommand(const std::string &cmd);
    
    // 记录日志
    bool logEvent(const std::string &json);
    
private:
    IPCClient() = default;
    ~IPCClient() = default;
    
    int m_socket = -1;
};

} // namespace StorageRedirect
