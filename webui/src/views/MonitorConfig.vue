<template>
  <div class="monitor-config">
    <h2 class="page-title">监控配置</h2>
    
    <div class="config-card">
      <h3>全局设置</h3>
      
      <div class="form-group">
        <label class="switch-label">
          <span>启用监控</span>
          <label class="switch">
            <input type="checkbox" v-model="config.monitorEnabled" @change="saveConfig">
            <span class="slider"></span>
          </label>
        </label>
        <p class="hint">开启后将记录应用的文件访问操作</p>
      </div>

      <div class="form-group">
        <label>日志级别</label>
        <select v-model="config.logLevel" @change="saveConfig" class="form-select">
          <option value="debug">调试 (Debug)</option>
          <option value="info">信息 (Info)</option>
          <option value="warn">警告 (Warn)</option>
          <option value="error">错误 (Error)</option>
        </select>
      </div>

      <div class="form-group">
        <label>最大日志大小 (MB)</label>
        <input 
          v-model.number="config.maxLogSizeMB" 
          type="number" 
          min="8" 
          max="1024"
          class="form-input"
          @blur="saveConfig"
        />
        <p class="hint">日志总大小超过此限制将自动清理最旧的日志</p>
      </div>
    </div>

    <div class="config-card">
      <h3>动态更新</h3>
      
      <div class="form-group">
        <label>轮询间隔 (毫秒)</label>
        <input 
          v-model.number="config.update.pollIntervalMs" 
          type="number" 
          min="1000" 
          max="60000"
          class="form-input"
          @blur="saveConfig"
        />
        <p class="hint">应用检查配置更新的时间间隔</p>
      </div>

      <div class="form-group">
        <label>操作检查间隔</label>
        <input 
          v-model.number="config.update.opCheckInterval" 
          type="number" 
          min="1" 
          max="1000"
          class="form-input"
          @blur="saveConfig"
        />
        <p class="hint">每 N 次文件操作检查一次配置更新</p>
      </div>
    </div>

    <div class="config-card">
      <h3>进程归属</h3>
      
      <div class="form-group">
        <label>模式</label>
        <select v-model="config.processAttribution.mode" @change="saveConfig" class="form-select">
          <option value="strict">严格 (防侧漏优先)</option>
          <option value="balanced">平衡</option>
          <option value="relaxed">宽松 (兼容性优先)</option>
        </select>
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input 
            type="checkbox" 
            v-model="config.processAttribution.inheritToAllSameUid"
            @change="saveConfig"
          />
          <span>同 UID 进程共享规则</span>
        </label>
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input 
            type="checkbox" 
            v-model="config.processAttribution.inheritToIsolated"
            @change="saveConfig"
          />
          <span>Isolated 进程继承规则</span>
        </label>
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input 
            type="checkbox" 
            v-model="config.processAttribution.inheritToChildProcess"
            @change="saveConfig"
          />
          <span>子进程继承规则</span>
        </label>
      </div>

      <div class="form-group">
        <label>未知归属回退策略</label>
        <select v-model="config.processAttribution.fallbackUnknownPolicy" @change="saveConfig" class="form-select">
          <option value="denyWriteOnMatchedPaths">拒绝写入受控路径</option>
          <option value="monitorOnly">仅监控</option>
          <option value="allow">允许</option>
        </select>
      </div>
    </div>

    <div class="config-card">
      <h3>URI 处理</h3>
      
      <div class="form-group">
        <label class="switch-label">
          <span>启用 URI 重定向</span>
          <label class="switch">
            <input type="checkbox" v-model="config.uri.redirectEnabled" @change="saveConfig">
            <span class="slider"></span>
          </label>
        </label>
      </div>

      <div class="form-group">
        <label>映射失败处理</label>
        <select v-model="config.uri.onMappingFailed" @change="saveConfig" class="form-select">
          <option value="enforceReadonlyAndMonitor">强制只读并监控</option>
          <option value="monitorOnly">仅监控</option>
          <option value="allow">允许</option>
        </select>
      </div>
    </div>

    <div class="config-card stats-card">
      <h3>日志统计</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-value">{{ formatBytes(logStats.totalSizeBytes) }}</span>
          <span class="stat-label">总大小</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ formatBytes(logStats.maxSizeBytes) }}</span>
          <span class="stat-label">上限</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ logStats.appCount || 0 }}</span>
          <span class="stat-label">应用数</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAppStore } from '../stores/app'

const appStore = useAppStore()

const config = ref({
  monitorEnabled: true,
  logLevel: 'info',
  maxLogSizeMB: 64,
  update: {
    pollIntervalMs: 3000,
    opCheckInterval: 50
  },
  processAttribution: {
    mode: 'strict',
    inheritToAllSameUid: true,
    inheritToIsolated: true,
    inheritToChildProcess: true,
    fallbackUnknownPolicy: 'denyWriteOnMatchedPaths'
  },
  uri: {
    redirectEnabled: true,
    onMappingFailed: 'enforceReadonlyAndMonitor'
  }
})

const logStats = ref({
  totalSizeBytes: 0,
  maxSizeBytes: 64 * 1024 * 1024,
  appCount: 0
})

const saveConfig = async () => {
  await appStore.saveGlobalConfig(config.value)
}

const loadStats = async () => {
  try {
    const result = await appStore.callDaemon('log stats')
    if (result) {
      logStats.value = result
    }
  } catch (e) {
    console.error('Failed to load stats:', e)
  }
}

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

onMounted(async () => {
  await appStore.loadGlobalConfig()
  if (appStore.globalConfig) {
    config.value = { ...config.value, ...appStore.globalConfig }
  }
  await loadStats()
})
</script>

<style scoped>
.monitor-config {
  padding-bottom: 80px;
  background: #f5f6fa;
  min-height: 100vh;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 20px;
  color: #1a1a2e;
}

.config-card {
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.config-card h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #1a1a2e;
}

.form-group {
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group > label {
  display: block;
  font-size: 14px;
  color: #1a1a2e;
  margin-bottom: 8px;
}

.form-input, .form-select {
  width: 100%;
  padding: 12px 16px;
  background: #f5f6fa;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  color: #1a1a2e;
  font-size: 14px;
  outline: none;
  transition: all 0.3s;
}

.form-input:focus, .form-select:focus {
  border-color: #8b5cf6;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.form-select option {
  background: #ffffff;
  color: #1a1a2e;
}

.hint {
  font-size: 12px;
  color: #666;
  margin-top: 6px;
}

.switch-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.switch-label span {
  font-size: 14px;
  color: #1a1a2e;
}

.switch {
  position: relative;
  display: inline-block;
  width: 52px;
  height: 28px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #d1d5db;
  transition: 0.3s;
  border-radius: 28px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 22px;
  width: 22px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background: #8b5cf6;
}

input:checked + .slider:before {
  transform: translateX(24px);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 14px;
  color: #1a1a2e;
}

.checkbox-label input {
  width: 18px;
  height: 18px;
  accent-color: #8b5cf6;
}

.stats-card {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.04) 100%);
  border: 1px solid rgba(139, 92, 246, 0.15);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: #8b5cf6;
}

.stat-label {
  font-size: 12px;
  color: #666;
}
</style>
