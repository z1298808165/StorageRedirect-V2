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

    <!-- 监控路径配置 -->
    <div class="config-card">
      <div class="section-header">
        <h3>监控路径</h3>
        <button class="add-btn" @click="openAddPathModal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          添加路径
        </button>
      </div>
      <p class="hint">配置需要监控的文件路径，所有应用访问这些路径时都会被记录</p>
      
      <div class="monitor-paths-list">
        <div v-if="monitorPaths.length === 0" class="empty-state">
          <div class="empty-icon">📁</div>
          <p>暂无监控路径</p>
          <p class="empty-hint">点击上方按钮添加路径</p>
        </div>
        
        <div 
          v-for="(path, index) in monitorPaths" 
          :key="path.id"
          class="path-card"
          @click="editPath(path)"
        >
          <div class="path-header">
            <span class="path-index">#{{ index + 1 }}</span>
            <span class="path-text">{{ path.path }}</span>
            <button 
              class="delete-btn"
              @click.stop="confirmDeletePath(path)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
          <div v-if="path.desc" class="path-desc">{{ path.desc }}</div>
          <div class="path-ops">
            <span class="ops-label">监控操作:</span>
            <span class="ops-tags">
              <span v-for="op in path.operations" :key="op" class="op-tag">{{ opLabels[op] || op }}</span>
            </span>
          </div>
        </div>
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
          <span class="stat-value">{{ monitorPaths.length }}</span>
          <span class="stat-label">监控路径</span>
        </div>
      </div>
    </div>

    <!-- 查看日志按钮 -->
    <div class="config-card">
      <button class="view-logs-btn" @click="showMonitorLogs">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        查看访问日志
      </button>
      <p class="hint" style="text-align: center; margin-top: 12px; margin-bottom: 0;">
        按路径维度查看所有应用的文件访问记录
      </p>
    </div>

    <!-- 添加/编辑路径弹窗 -->
    <div v-if="showPathModal" class="modal-overlay" @click.self="closePathModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ editingPath ? '编辑监控路径' : '添加监控路径' }}</h3>
          <button class="close-btn" @click="closePathModal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>监控路径</label>
            <input 
              v-model="pathForm.path" 
              type="text" 
              class="form-input"
              placeholder="例如: /storage/emulated/0/Pictures"
            />
          </div>
          
          <div class="form-group">
            <label>描述（可选）</label>
            <input 
              v-model="pathForm.desc" 
              type="text" 
              class="form-input"
              placeholder="例如: 相册目录"
            />
          </div>
          
          <div class="form-group">
            <label>监控操作</label>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="pathForm.operations.open">
                <span>open - 文件打开/创建</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="pathForm.operations.write">
                <span>write - 文件写入</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="pathForm.operations.delete">
                <span>delete - 文件删除</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="pathForm.operations.mkdir">
                <span>mkdir - 创建目录</span>
              </label>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" @click="closePathModal">取消</button>
          <button class="btn-primary" @click="savePath">保存</button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeDeleteModal">
      <div class="modal-content confirm-modal">
        <div class="confirm-icon">⚠️</div>
        <h3>确认删除</h3>
        <p>确定要删除这条监控路径吗？</p>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeDeleteModal">取消</button>
          <button class="btn-danger" @click="deletePath">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'

const router = useRouter()
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

// 监控路径数据
const monitorPaths = ref([])

const opLabels = {
  'open': '打开',
  'write': '写入',
  'delete': '删除',
  'mkdir': '创建目录'
}

// 弹窗状态
const showPathModal = ref(false)
const showDeleteModal = ref(false)
const editingPath = ref(null)
const deletingPath = ref(null)

const pathForm = ref({
  path: '',
  desc: '',
  operations: {
    open: true,
    write: true,
    delete: true,
    mkdir: false
  }
})

const saveConfig = async () => {
  await appStore.saveGlobalConfig(config.value)
}

const loadStats = async () => {
  try {
    const result = await appStore.callDaemon('log stats')
    if (result && result.ok) {
      logStats.value = {
        totalSizeBytes: result.totalSizeBytes || 0,
        maxSizeBytes: result.maxSizeBytes || 64 * 1024 * 1024,
        appCount: result.appCount || 0
      }
    } else {
      // 如果 daemon 不可用，设置默认值
      logStats.value = {
        totalSizeBytes: 0,
        maxSizeBytes: 64 * 1024 * 1024,
        appCount: 0
      }
    }
  } catch (e) {
    console.error('Failed to load stats:', e)
    // 出错时设置默认值
    logStats.value = {
      totalSizeBytes: 0,
      maxSizeBytes: 64 * 1024 * 1024,
      appCount: 0
    }
  }
}

const formatBytes = (bytes) => {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 B'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 监控路径相关方法
const openAddPathModal = () => {
  editingPath.value = null
  pathForm.value = {
    path: '',
    desc: '',
    operations: {
      open: true,
      write: true,
      delete: true,
      mkdir: false
    }
  }
  showPathModal.value = true
}

const editPath = (path) => {
  editingPath.value = path
  pathForm.value = {
    path: path.path,
    desc: path.desc || '',
    operations: {
      open: path.operations.includes('open'),
      write: path.operations.includes('write'),
      delete: path.operations.includes('delete'),
      mkdir: path.operations.includes('mkdir')
    }
  }
  showPathModal.value = true
}

const closePathModal = () => {
  showPathModal.value = false
  editingPath.value = null
}

const savePath = () => {
  console.log('========== savePath 开始 ==========')
  console.log('【savePath】表单数据:', JSON.stringify(pathForm.value, null, 2))
  
  if (!pathForm.value.path.trim()) {
    alert('请输入监控路径')
    console.log('【savePath】失败：路径为空')
    return
  }

  const operations = []
  if (pathForm.value.operations.open) operations.push('open')
  if (pathForm.value.operations.write) operations.push('write')
  if (pathForm.value.operations.delete) operations.push('delete')
  if (pathForm.value.operations.mkdir) operations.push('mkdir')

  console.log('【savePath】选择的操作:', JSON.stringify(operations))

  if (operations.length === 0) {
    alert('请至少选择一个监控操作')
    console.log('【savePath】失败：未选择操作')
    return
  }

  if (editingPath.value) {
    // 更新现有路径
    console.log('【savePath】更新现有路径, ID:', editingPath.value.id)
    editingPath.value.path = pathForm.value.path.trim()
    editingPath.value.desc = pathForm.value.desc.trim()
    editingPath.value.operations = operations
    console.log('【savePath】更新后的路径数据:', JSON.stringify(editingPath.value, null, 2))
  } else {
    // 添加新路径
    const newPath = {
      id: Date.now(),
      path: pathForm.value.path.trim(),
      desc: pathForm.value.desc.trim(),
      operations: operations
    }
    monitorPaths.value.push(newPath)
    console.log('【savePath】添加新路径:', JSON.stringify(newPath, null, 2))
  }

  console.log('【savePath】当前所有监控路径:', JSON.stringify(monitorPaths.value, null, 2))

  // 保存到配置
  console.log('【savePath】调用 saveMonitorPaths...')
  saveMonitorPaths()
  closePathModal()
  console.log('========== savePath 完成 ==========')
}

const confirmDeletePath = (path) => {
  deletingPath.value = path
  showDeleteModal.value = true
}

const closeDeleteModal = () => {
  showDeleteModal.value = false
  deletingPath.value = null
}

const deletePath = () => {
  if (deletingPath.value) {
    const index = monitorPaths.value.findIndex(p => p.id === deletingPath.value.id)
    if (index > -1) {
      monitorPaths.value.splice(index, 1)
      saveMonitorPaths()
    }
  }
  closeDeleteModal()
}

const saveMonitorPaths = async () => {
  console.log('========== saveMonitorPaths 开始 ==========')
  
  // 将监控路径保存
  const pathsConfig = monitorPaths.value.map(p => ({
    id: p.id,
    path: p.path,
    desc: p.desc,
    operations: p.operations
  }))
  console.log('【步骤1】准备保存的监控路径数据:', JSON.stringify(pathsConfig, null, 2))

  // 使用新的 monitor API 保存监控路径
  console.log('【步骤2】调用 monitor set API 保存监控路径...')
  const result = await appStore.callDaemon('monitor set', { monitor: { paths: pathsConfig } })
  console.log('【步骤3】monitor set 返回结果:', JSON.stringify(result, null, 2))
  
  if (result && result.ok) {
    console.log('【步骤4】保存成功！')
    
    // 同时更新全局配置中的 monitorPaths（保持兼容性）
    await appStore.loadGlobalConfig()
    const currentGlobalConfig = appStore.globalConfig || {}
    const newConfig = {
      ...JSON.parse(JSON.stringify(currentGlobalConfig)),
      monitorPaths: pathsConfig
    }
    await appStore.saveGlobalConfig(newConfig)
    
    console.log('========== saveMonitorPaths 完成 ==========')
  } else {
    console.error('【步骤4】保存失败！')
    alert('保存失败，请重试')
    console.log('========== saveMonitorPaths 失败 ==========')
  }
}

const loadMonitorPaths = async () => {
  try {
    // 首先尝试使用新的 monitor API 获取监控路径
    const result = await appStore.callDaemon('monitor get')
    if (result && result.ok && result.monitor && result.monitor.paths) {
      monitorPaths.value = result.monitor.paths.map((p, index) => ({
        id: p.id || Date.now() + index,
        path: p.path,
        desc: p.desc || '',
        operations: p.operations || ['open', 'write', 'delete']
      }))
      console.log('Monitor paths loaded from monitor API:', monitorPaths.value.length)
      return
    }

    // 如果 monitor API 失败，尝试从全局配置中加载（兼容性）
    await appStore.loadGlobalConfig()
    if (appStore.globalConfig && appStore.globalConfig.monitorPaths) {
      monitorPaths.value = appStore.globalConfig.monitorPaths.map((p, index) => ({
        id: p.id || Date.now() + index,
        path: p.path,
        desc: p.desc || '',
        operations: p.operations || ['open', 'write', 'delete']
      }))
      console.log('Monitor paths loaded from global config:', monitorPaths.value.length)
      return
    }

    // 如果都没有，初始化为空数组
    monitorPaths.value = []
    console.log('No monitor paths found, initialized empty')
  } catch (e) {
    console.error('Failed to load monitor paths:', e)
    monitorPaths.value = []
  }
}

const showMonitorLogs = () => {
  router.push('/monitor-logs')
}

onMounted(async () => {
  console.log('========== MonitorConfig 页面加载开始 ==========')
  
  console.log('【页面加载-步骤1】加载全局配置...')
  await appStore.loadGlobalConfig()
  console.log('【页面加载-步骤2】加载到的全局配置:', JSON.stringify(appStore.globalConfig, null, 2))
  
  if (appStore.globalConfig) {
    config.value = { ...config.value, ...appStore.globalConfig }
    console.log('【页面加载-步骤3】合并后的本地配置:', JSON.stringify(config.value, null, 2))
  } else {
    console.log('【页面加载-步骤3】没有全局配置，使用默认配置:', JSON.stringify(config.value, null, 2))
  }
  
  console.log('【页面加载-步骤4】加载统计信息...')
  await loadStats()
  console.log('【页面加载-步骤5】统计信息:', JSON.stringify(logStats.value, null, 2))
  
  console.log('【页面加载-步骤6】加载监控路径...')
  await loadMonitorPaths()
  console.log('【页面加载-步骤7】加载到的监控路径:', JSON.stringify(monitorPaths.value, null, 2))
  
  console.log('========== MonitorConfig 页面加载完成 ==========')
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

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin-bottom: 0;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  transition: all 0.3s;
}

.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
}

.add-btn svg {
  width: 16px;
  height: 16px;
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

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

/* 监控路径列表 */
.monitor-paths-list {
  margin-top: 16px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #9ca3af;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-hint {
  font-size: 13px;
  margin-top: 8px;
}

.path-card {
  background: #f5f6fa;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.3s;
  border: 1px solid transparent;
}

.path-card:hover {
  background: #eef0f5;
  border-color: rgba(139, 92, 246, 0.2);
}

.path-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.path-index {
  color: #8b5cf6;
  font-weight: 600;
  font-size: 14px;
}

.path-text {
  flex: 1;
  font-weight: 500;
  color: #1a1a2e;
  word-break: break-all;
}

.delete-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.1);
  border: none;
  color: #ef4444;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}

.delete-btn svg {
  width: 16px;
  height: 16px;
}

.path-desc {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
}

.path-ops {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.ops-label {
  color: #9ca3af;
}

.ops-tags {
  display: flex;
  gap: 6px;
}

.op-tag {
  padding: 2px 8px;
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
  border-radius: 4px;
  font-size: 11px;
}

/* 查看日志按钮 */
.view-logs-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  border: none;
  border-radius: 16px;
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(139, 92, 246, 0.3);
  transition: all 0.3s;
}

.view-logs-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.4);
}

.view-logs-btn svg {
  width: 20px;
  height: 20px;
}

/* 弹窗样式 */
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

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e8e8e8;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #1a1a2e;
}

.close-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #f5f6fa;
  border: none;
  color: #6b7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.close-btn:hover {
  background: #eef0f5;
  color: #1a1a2e;
}

.close-btn svg {
  width: 20px;
  height: 20px;
}

.modal-body {
  padding: 24px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #e8e8e8;
}

.modal-footer button {
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

.btn-primary {
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
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
