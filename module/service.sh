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

# 创建运行目录
mkdir -p "$MODDIR/run"
chmod 755 "$MODDIR/run"

# 启动 daemon
if [ -f "$MODDIR/bin/sr-daemon" ]; then
    log_info "启动 StorageRedirect Daemon..."
    
    # 设置环境变量
    export SR_MODDIR="$MODDIR"
    export SR_CONFIG="$MODDIR/config/config.json"
    export SR_LOGDIR="$MODDIR/logs"
    export SR_SOCKET="$MODDIR/run/ipc.sock"
    
    # 启动 daemon
    nohup "$MODDIR/bin/sr-daemon" > /dev/null 2>&1 &
    DAEMON_PID=$!
    
    # 等待 daemon 启动
    sleep 1
    
    if kill -0 $DAEMON_PID 2>/dev/null; then
        log_info "Daemon 启动成功 (PID: $DAEMON_PID)"
        echo $DAEMON_PID > "$MODDIR/run/daemon.pid"
    else
        log_error "Daemon 启动失败"
    fi
else
    log_error "Daemon 二进制文件不存在"
fi

log_info "服务脚本执行完毕"
