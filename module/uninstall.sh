#!/system/bin/sh
# StorageRedirect 模块卸载脚本

MODDIR=${0%/*}

ui_print "*******************************"
ui_print "   正在卸载存储重定向与审计模块"
ui_print "*******************************"
ui_print ""

# 停止 daemon
if [ -f "$MODDIR/run/daemon.pid" ]; then
    DAEMON_PID=$(cat "$MODDIR/run/daemon.pid")
    if kill -0 $DAEMON_PID 2>/dev/null; then
        ui_print "- 停止 Daemon (PID: $DAEMON_PID)..."
        kill $DAEMON_PID
        sleep 1
    fi
fi

# 清理运行目录
ui_print "- 清理运行文件..."
rm -rf "$MODDIR/run"

# 清理日志（可选，保留以便用户查看）
# rm -rf "$MODDIR/logs"

# 清理配置（可选，保留以便重新安装后恢复）
# rm -rf "$MODDIR/config"

ui_print ""
ui_print "- 卸载完成"
ui_print "- 日志文件保留在: $MODDIR/logs/"
ui_print "*******************************"
