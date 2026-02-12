#!/system/bin/sh
# StorageRedirect 服务脚本 - 在 late_start 服务模式运行

MODDIR=${0%/*}

# 等待系统启动完成
until [ -d /sdcard/Android ]; do
    sleep 1
done

# 日志函数
log_info() {
    echo "[StorageRedirect] $1" >> /dev/kmsg
    log -p i -t StorageRedirect "$1"
}

log_error() {
    echo "[StorageRedirect] ERROR: $1" >> /dev/kmsg
    log -p e -t StorageRedirect "$1"
}

log_info "服务脚本启动"

# 创建运行目录和配置目录
mkdir -p "$MODDIR/run"
mkdir -p "$MODDIR/config/apps"
mkdir -p "$MODDIR/logs"
chmod 755 "$MODDIR/run"
chmod 755 "$MODDIR/config"
chmod 755 "$MODDIR/config/apps"
chmod 755 "$MODDIR/logs"

# 迁移旧配置（如果存在）
if [ -f "$MODDIR/config/config.json" ]; then
    log_info "检测到旧版配置文件，需要迁移"
    # 迁移脚本会在 daemon 启动时自动执行
fi

# 启动 daemon
if [ -f "$MODDIR/bin/sr-daemon" ]; then
    log_info "启动 StorageRedirect Daemon..."
    
    # 设置环境变量
    export SR_MODDIR="$MODDIR"
    export SR_CONFIG_DIR="$MODDIR/config"
    export SR_LOGDIR="$MODDIR/logs"
    export SR_SOCKET="$MODDIR/run/ipc.sock"
    
    # 启动 daemon
    nohup "$MODDIR/bin/sr-daemon" > /dev/null 2>&1 &
    DAEMON_PID=$!
    
    # 等待 daemon 启动
    sleep 2
    
    if kill -0 $DAEMON_PID 2>/dev/null; then
        log_info "Daemon 启动成功 (PID: $DAEMON_PID)"
        echo $DAEMON_PID > "$MODDIR/run/daemon.pid"
        
        # 检查 socket 是否创建
        if [ -S "$MODDIR/run/ipc.sock" ]; then
            log_info "Socket 创建成功"
            chmod 666 "$MODDIR/run/ipc.sock"
        else
            log_error "Socket 未创建"
        fi
    else
        log_error "Daemon 启动失败"
    fi
else
    log_error "Daemon 二进制文件不存在"
fi

log_info "服务脚本执行完毕"
