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
mkdir -p "$MODPATH/logs"
mkdir -p "$MODPATH/bin"
mkdir -p "$MODPATH/run"
mkdir -p "$MODPATH/zygisk"

# 设置权限
ui_print "- 设置权限..."
set_perm_recursive "$MODPATH/bin" 0 0 0755 0755
set_perm_recursive "$MODPATH/zygisk" 0 0 0755 0755
set_perm_recursive "$MODPATH/webroot" 0 0 0755 0644

# 创建默认配置文件
if [ ! -f "$MODPATH/config/config.json" ]; then
    ui_print "- 创建默认配置..."
    cat > "$MODPATH/config/config.json" << 'EOF'
{
  "version": 1,
  "global": {
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
  },
  "apps": {}
}
EOF
fi

# 设置配置文件权限
set_perm "$MODPATH/config/config.json" 0 0 0644

ui_print ""
ui_print "- 安装完成！"
ui_print "- 请重启设备以激活模块"
ui_print "*******************************"
