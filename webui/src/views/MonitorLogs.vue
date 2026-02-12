<template>
  <div class="monitor-logs">
    <!-- Header -->
    <header class="header">
      <button class="back-btn" @click="goBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1>访问日志</h1>
      <div class="header-actions">
        <button class="clear-btn" @click="showClearConfirm" title="清空日志">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
        <div class="daemon-status">
          <span class="status-dot"></span>
          <span>{{ isDemoMode ? '演示模式' : '运行中' }}</span>
        </div>
      </div>
    </header>

    <div class="content">
      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="search-box">
          <input 
            type="text" 
            class="search-input" 
            v-model="searchQuery"
            placeholder="搜索路径、应用包名或文件名..."
          >
        </div>
        <div class="filter-row">
          <select v-model="pathFilter" class="filter-select">
            <option value="">所有路径</option>
            <option v-for="path in monitorPaths" :key="path.id" :value="path.path">
              {{ path.desc || path.path }}
            </option>
          </select>
          <select v-model="appFilter" class="filter-select">
            <option value="">所有应用</option>
            <option v-for="app in uniqueApps" :key="app.pkg" :value="app.pkg">
              {{ app.name }}
            </option>
          </select>
          <select v-model="actionFilter" class="filter-select">
            <option value="">所有操作</option>
            <option value="open">打开</option>
            <option value="write">写入</option>
            <option value="delete">删除</option>
            <option value="mkdir">创建目录</option>
          </select>
        </div>
      </div>

      <!-- Logs List -->
      <div class="logs-list" v-if="filteredLogs.length > 0">
        <div 
          v-for="log in filteredLogs" 
          :key="log.id"
          class="log-card"
          :class="log.type"
        >
          <div class="log-header">
            <span class="log-time">{{ log.timestamp }}</span>
            <span class="log-app">{{ log.appName || log.app }}</span>
            <span class="log-action" :class="log.action">{{ formatAction(log.action) }}</span>
            <span class="log-type-badge" :class="log.type">{{ formatType(log.type) }}</span>
          </div>
          <div class="log-path">
            <span class="path-label">路径:</span>
            <span class="path-value">{{ log.path }}</span>
          </div>
          <div class="log-file" v-if="log.file">
            <span class="file-label">文件:</span>
            <span class="file-value">{{ log.file }}</span>
          </div>
          <div class="log-redirect" v-if="log.redirectTo">
            <span class="redirect-label">重定向到:</span>
            <span class="redirect-value">{{ log.redirectTo }}</span>
          </div>
          <div class="log-message" v-if="log.message">
            <span class="message-text">{{ log.message }}</span>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div class="empty-state" v-else>
        <div class="empty-icon">📋</div>
        <p>暂无日志记录</p>
        <p class="hint">开启监控后将记录文件访问操作</p>
      </div>
    </div>

    <!-- 清空日志确认弹窗 -->
    <div v-if="showClearModal" class="modal-overlay" @click.self="closeClearModal">
      <div class="modal-content confirm-modal">
        <div class="confirm-icon">⚠️</div>
        <h3>确认清空日志</h3>
        <p>确定要清空所有访问日志吗？此操作不可恢复。</p>
        <div class="confirm-actions">
          <button class="btn-secondary" @click="closeClearModal">取消</button>
          <button class="btn-danger" @click="executeClear">清空</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'

const router = useRouter()
const appStore = useAppStore()

const isDemoMode = computed(() => appStore.isDemoMode)
const logs = ref([])
const monitorPaths = ref([])
const searchQuery = ref('')
const pathFilter = ref('')
const appFilter = ref('')
const actionFilter = ref('')

// Demo logs data
const demoLogs = [
  { id: 1, timestamp: '2024-01-15 10:23:45', app: 'com.tencent.mm', appName: '微信', path: '/storage/emulated/0/Pictures/WeChat', file: 'IMG_20240115_102345.jpg', action: 'write', type: 'monitor' },
  { id: 2, timestamp: '2024-01-15 10:23:46', app: 'com.tencent.mm', appName: '微信', path: '/storage/emulated/0/Pictures/WeChat', file: 'IMG_20240115_102346.jpg', action: 'write', type: 'monitor' },
  { id: 3, timestamp: '2024-01-15 10:24:12', app: 'com.example.demo', appName: '演示应用', path: '/storage/emulated/0/Download', file: 'test.txt', action: 'open', type: 'redirect', redirectTo: '/storage/emulated/0/Download/Demo/test.txt' },
  { id: 4, timestamp: '2024-01-15 10:24:15', app: 'com.example.demo', appName: '演示应用', path: '/storage/emulated/0/DCIM', file: 'photo.jpg', action: 'write', type: 'deny', message: '只读规则阻止写入' },
  { id: 5, timestamp: '2024-01-15 10:25:01', app: 'com.taobao.taobao', appName: '淘宝', path: '/storage/emulated/0/Pictures', file: 'screenshot_123.jpg', action: 'write', type: 'monitor' },
  { id: 6, timestamp: '2024-01-15 10:26:33', app: 'com.sina.weibo', appName: '微博', path: '/storage/emulated/0/Download', file: 'video.mp4', action: 'delete', type: 'monitor' },
  { id: 7, timestamp: '2024-01-15 10:27:18', app: 'com.baidu.netdisk', appName: '百度网盘', path: '/storage/emulated/0/Download', file: 'document.pdf', action: 'open', type: 'monitor' },
  { id: 8, timestamp: '2024-01-15 10:28:05', app: 'com.example.demo', appName: '演示应用', path: '/storage/emulated/0/Download', file: 'NewFolder', action: 'mkdir', type: 'redirect', redirectTo: '/storage/emulated/0/Download/Demo/NewFolder' }
]

// Demo monitor paths
const demoMonitorPaths = [
  { id: 1, path: '/storage/emulated/0/Pictures', desc: '相册目录', operations: ['open', 'write', 'delete'] },
  { id: 2, path: '/storage/emulated/0/Download', desc: '下载目录', operations: ['open', 'write'] }
]

const showClearModal = ref(false)

const uniqueApps = computed(() => {
  const apps = new Map()
  logs.value.forEach(log => {
    if (!apps.has(log.app)) {
      apps.set(log.app, { pkg: log.app, name: log.appName || log.app })
    }
  })
  return Array.from(apps.values())
})

const filteredLogs = computed(() => {
  return logs.value.filter(log => {
    // Search query filter
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      const matchSearch = 
        log.path.toLowerCase().includes(query) ||
        log.app.toLowerCase().includes(query) ||
        (log.file && log.file.toLowerCase().includes(query)) ||
        (log.appName && log.appName.toLowerCase().includes(query))
      if (!matchSearch) return false
    }
    
    // Path filter
    if (pathFilter.value && !log.path.startsWith(pathFilter.value)) {
      return false
    }
    
    // App filter
    if (appFilter.value && log.app !== appFilter.value) {
      return false
    }
    
    // Action filter
    if (actionFilter.value && log.action !== actionFilter.value) {
      return false
    }
    
    return true
  })
})

const goBack = () => {
  router.back()
}

const formatAction = (action) => {
  const map = {
    'open': '打开',
    'write': '写入',
    'delete': '删除',
    'mkdir': '创建目录',
    'read': '读取'
  }
  return map[action] || action
}

const formatType = (type) => {
  const map = {
    'monitor': '监控',
    'redirect': '重定向',
    'deny': '阻止'
  }
  return map[type] || type
}

const showClearConfirm = () => {
  showClearModal.value = true
}

const closeClearModal = () => {
  showClearModal.value = false
}

const executeClear = async () => {
  try {
    let cleared = false

    // 调用 daemon 清空所有日志
    try {
      const result = await appStore.callDaemon('log clear', { pkg: '' })
      if (result && result.ok) {
        cleared = true
      }
    } catch (e) {
      console.log('Daemon log clear failed:', e)
    }

    // 如果 daemon 失败，尝试直接清空日志文件
    if (!cleared) {
      try {
        // 清空所有日志文件内容而不是删除
        const result = await appStore.exec('for f in /data/adb/modules/StorageRedirect/logs/*.log; do echo "[]" > "$f" 2>/dev/null; done')
        if (result && result.errno === 0) {
          cleared = true
        }
      } catch (e) {
        console.error('Direct file clear failed:', e)
      }
    }

    if (cleared) {
      logs.value = []
      appStore.ksuApi.toast('日志已清空')
    } else {
      appStore.ksuApi.toast('清空日志失败')
    }
  } catch (e) {
    console.error('Failed to clear logs:', e)
    appStore.ksuApi.toast('清空日志失败')
  }
  closeClearModal()
}

const loadLogs = async () => {
  // 首先检查是否在演示模式
  if (appStore.isDemoMode) {
    logs.value = demoLogs
    return
  }

  try {
    // Try to load real logs from daemon
    const result = await appStore.callDaemon('log stats')
    if (result && result.ok) {
      // If daemon is available, try to load logs from all apps
      const allApps = appStore.apps
      let allLogs = []

      for (const app of allApps.slice(0, 10)) { // Limit to first 10 apps for performance
        try {
          const appLogs = await appStore.getAppLogs(app.packageName, 20)
          if (appLogs && appLogs.length > 0) {
            const formattedLogs = appLogs.map(log => ({
              id: `${app.packageName}-${log.ts}`,
              timestamp: formatTimestamp(log.ts),
              app: app.packageName,
              appName: app.appLabel,
              path: log.path || '',
              file: log.path ? log.path.split('/').pop() : '',
              action: log.op || 'open',
              type: log.decision === 'REDIRECT' ? 'redirect' : log.decision === 'DENY_RO' ? 'deny' : 'monitor',
              redirectTo: log.mapped || '',
              message: log.result === 'FAIL' ? (log.errno === 13 ? '只读规则阻止写入' : '操作被拒绝') : ''
            }))
            allLogs = allLogs.concat(formattedLogs)
          }
        } catch (e) {
          // Ignore errors for individual apps
        }
      }

      // Sort by timestamp desc
      allLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

      logs.value = allLogs
      return
    }
  } catch (e) {
    console.error('Failed to load logs from daemon:', e)
  }

  // Daemon 不可用，显示空日志（不是演示数据）
  logs.value = []
}

const formatTimestamp = (ts) => {
  const date = new Date(ts)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).replace(/\//g, '-')
}

const loadMonitorPaths = async () => {
  // 如果处于演示模式，使用演示数据
  if (appStore.isDemoMode) {
    monitorPaths.value = demoMonitorPaths
    return
  }

  try {
    // Try to load from store first
    await appStore.loadGlobalConfig()
    if (appStore.globalConfig && appStore.globalConfig.monitorPaths) {
      monitorPaths.value = appStore.globalConfig.monitorPaths.map((p, index) => ({
        id: p.id || index,
        path: p.path,
        desc: p.desc || '',
        operations: p.operations || ['open', 'write', 'delete']
      }))
      return
    }
  } catch (e) {
    console.error('Failed to load monitor paths from store:', e)
  }

  // Fallback: try to load from file
  try {
    const result = await appStore.exec('cat /data/adb/modules/StorageRedirect/config/monitor_paths.json 2>/dev/null || echo "[]"')
    if (result && result.stdout && result.stdout !== '[]') {
      try {
        const parsed = JSON.parse(result.stdout)
        if (Array.isArray(parsed) && parsed.length > 0) {
          monitorPaths.value = parsed
          return
        }
      } catch (e) {
        // Parse error
      }
    }
  } catch (e) {
    // Error loading from file
  }

  // 正式环境下显示空列表
  monitorPaths.value = []
}

onMounted(async () => {
  await loadLogs()
  await loadMonitorPaths()
})
</script>

<style scoped>
.monitor-logs {
  min-height: 100vh;
  background: linear-gradient(180deg, #f8f9fc 0%, #f0f2f8 100%);
  color: #1a1a2e;
  padding-bottom: 20px;
}

.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h1 {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.clear-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 68, 68, 0.1);
  border: none;
  border-radius: 50%;
  color: #ef4444;
  cursor: pointer;
  transition: all 0.3s;
}

.clear-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  transform: scale(1.05);
}

.clear-btn svg {
  width: 20px;
  height: 20px;
}

.back-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f6fa;
  border: none;
  border-radius: 50%;
  color: #1a1a2e;
  cursor: pointer;
  transition: all 0.3s;
}

.back-btn:hover {
  background: #eef0f5;
}

.back-btn svg {
  width: 20px;
  height: 20px;
}

.daemon-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
  padding: 6px 12px;
  border-radius: 20px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
}

.content {
  padding: 16px;
}

.filter-bar {
  background: #fff;
  padding: 16px;
  border-radius: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.search-box {
  margin-bottom: 12px;
}

.search-input {
  width: 100%;
  padding: 14px 16px;
  background: #f5f6fa;
  border: none;
  border-radius: 16px;
  color: #1a1a2e;
  font-size: 15px;
  outline: none;
  transition: all 0.3s;
}

.search-input:focus {
  background: #eef0f5;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
}

.search-input::placeholder {
  color: #9ca3af;
}

.filter-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-select {
  flex: 1;
  min-width: 100px;
  padding: 12px;
  background: #f5f6fa;
  border: none;
  border-radius: 12px;
  color: #1a1a2e;
  font-size: 14px;
  outline: none;
  cursor: pointer;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.log-card {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border-left: 4px solid #8b5cf6;
}

.log-card.monitor {
  border-left-color: #10b981;
}

.log-card.redirect {
  border-left-color: #8b5cf6;
}

.log-card.deny {
  border-left-color: #ef4444;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.log-time {
  font-size: 12px;
  color: #9ca3af;
}

.log-app {
  font-size: 13px;
  font-weight: 500;
  color: #1a1a2e;
}

.log-action {
  font-size: 11px;
  padding: 2px 8px;
  background: #f5f6fa;
  border-radius: 4px;
  color: #6b7280;
}

.log-action.write {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.log-action.delete {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.log-action.mkdir {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.log-type-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.log-type-badge.monitor {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.log-type-badge.redirect {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.log-type-badge.deny {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.log-path, .log-file, .log-redirect {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 13px;
}

.path-label, .file-label, .redirect-label {
  color: #9ca3af;
  flex-shrink: 0;
}

.path-value, .file-value {
  color: #1a1a2e;
  word-break: break-all;
}

.redirect-value {
  color: #8b5cf6;
  word-break: break-all;
}

.log-message {
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.05);
  border-radius: 8px;
}

.message-text {
  font-size: 12px;
  color: #ef4444;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state p {
  font-size: 16px;
  margin-bottom: 8px;
}

.empty-state .hint {
  font-size: 13px;
  color: #6b7280;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-content {
  background: #fff;
  border-radius: 24px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.confirm-modal {
  text-align: center;
  padding: 32px;
}

.confirm-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.confirm-modal h3 {
  margin-bottom: 8px;
  color: #1a1a2e;
}

.confirm-modal p {
  color: #6b7280;
  margin-bottom: 24px;
}

.confirm-actions {
  display: flex;
  gap: 12px;
}

.confirm-actions button {
  flex: 1;
  padding: 14px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  border: none;
}

.btn-secondary {
  background: #f5f6fa;
  color: #6b7280;
}

.btn-secondary:hover {
  background: #eef0f5;
}

.btn-danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.btn-danger:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
}
</style>
