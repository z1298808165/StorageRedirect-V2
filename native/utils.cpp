#include "utils.h"
#include <unistd.h>
#include <fcntl.h>
#include <sys/time.h>

namespace StorageRedirect {

std::string Utils::getProcessName() {
    char path[256];
    char cmdline[256];
    
    snprintf(path, sizeof(path), "/proc/%d/cmdline", getpid());
    
    int fd = open(path, O_RDONLY);
    if (fd < 0) {
        return "";
    }
    
    ssize_t n = read(fd, cmdline, sizeof(cmdline) - 1);
    close(fd);
    
    if (n <= 0) {
        return "";
    }
    
    cmdline[n] = '\0';
    
    // cmdline 中的参数以 \0 分隔，我们只取第一个
    return std::string(cmdline);
}

std::string Utils::getPackageName(const std::string &processName) {
    // 进程名通常是包名或包名:进程名
    size_t pos = processName.find(':');
    if (pos != std::string::npos) {
        return processName.substr(0, pos);
    }
    return processName;
}

bool Utils::isSystemApp(int uid) {
    // Android UID 范围：
    // 0-9999: 系统应用
    // 10000+: 普通应用
    return uid < 10000;
}

bool Utils::isIsolatedProcess(int uid) {
    // Isolated 进程 UID 范围：90000-99999
    return uid >= 90000 && uid <= 99999;
}

long long Utils::getTimestamp() {
    struct timeval tv;
    gettimeofday(&tv, nullptr);
    return (long long)tv.tv_sec * 1000 + tv.tv_usec / 1000;
}

} // namespace StorageRedirect
