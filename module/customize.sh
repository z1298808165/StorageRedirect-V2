#!/system/bin/sh
# StorageRedirect 模块安装脚本

SKIPUNZIP=0

ui_print "*******************************"
ui_print "     存储重定向与审计模块"
ui_print "*******************************"
ui_print ""

# 检查架构
ui_print "- 设备架构: $ARCH"
case $ARCH in
    arm64)
        ui_print "- 支持 arm64-v8a"
        ;;
    arm)
        ui_print "- 支持 armeabi-v7a"
        ;;
    *)
        ui_print "! 警告: 未测试的架构 $ARCH"
        ;;
esac

ui_print "- Android API: $API"

# 创建必要目录
ui_print "- 创建模块目录..."
mkdir -p "$MODPATH/config"
mkdir -p "$MODPATH/config/apps"
mkdir -p "$MODPATH/logs"
mkdir -p "$MODPATH/bin"
mkdir -p "$MODPATH/run"
mkdir -p "$MODPATH/zygisk"

# 设置权限
ui_print "- 设置权限..."
set_perm_recursive "$MODPATH/bin" 0 0 0755 0755
set_perm_recursive "$MODPATH/zygisk" 0 0 0755 0755
set_perm_recursive "$MODPATH/webroot" 0 0 0755 0644

# 创建默认配置文件（仅在不存在时创建，保留用户配置）
if [ ! -f "$MODPATH/config/global.json" ]; then
    ui_print "- 创建默认全局配置..."
    cat > "$MODPATH/config/global.json" << 'EOF'
{
  "monitorEnabled": true,
  "logLevel": "info",
  "maxLogSizeMB": 64,
  "update": {
    "pollIntervalMs": 3000,
    "opCheckInterval": 50
  },
  "processAttribution": {
    "mode": "strict",
    "inheritToAllSameUid": true,
    "inheritToIsolated": true,
    "inheritToChildProcess": true,
    "fallbackUnknownPolicy": "denyWriteOnMatchedPaths",
    "diagnosticTagUnknown": true
  },
  "uri": {
    "redirectEnabled": true,
    "mappingMode": "bestEffort",
    "onMappingFailed": "enforceReadonlyAndMonitor",
    "logMappingDetails": true
  }
}
EOF
    set_perm "$MODPATH/config/global.json" 0 0 0644
else
    ui_print "- 保留现有全局配置"
fi

# 创建默认监控路径配置（仅在不存在时创建）
if [ ! -f "$MODPATH/config/monitor_paths.json" ]; then
    ui_print "- 创建默认监控路径配置..."
    cat > "$MODPATH/config/monitor_paths.json" << 'EOF'
{
  "paths": []
}
EOF
    set_perm "$MODPATH/config/monitor_paths.json" 0 0 0644
else
    ui_print "- 保留现有监控路径配置"
fi

# 保留应用配置目录（不覆盖）
if [ -d "$MODPATH/config/apps" ]; then
    ui_print "- 保留现有应用配置"
fi

ui_print ""
ui_print "- 安装完成！"
ui_print "- 请重启设备以激活模块"
ui_print "*******************************"
