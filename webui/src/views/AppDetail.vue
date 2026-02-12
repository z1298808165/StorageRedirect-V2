<template>
  <div class="app-detail">
    <!-- 应用头部 -->
    <div class="app-header">
      <button class="back-btn" @click="goBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <div class="app-info">
        <img :src="getAppIconUrl(pkg)" class="app-icon" />
        <div class="app-text">
          <h2>{{ appInfo?.appLabel || pkg }}</h2>
          <p>{{ pkg }}</p>
        </div>
      </div>
      <label class="switch">
        <input type="checkbox" v-model="config.enabled" @change="saveConfig">
        <span class="slider"></span>
      </label>
    </div>

    <!-- 标签页 -->
    <div class="tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        :class="['tab-btn', { active: currentTab === tab.id }]"
        @click="currentTab = tab.id"
      >
        {{ tab.name }}
        <span v-if="getTabCount(tab.id) > 0" class="tab-count">{{ getTabCount(tab.id) }}</span>
      </button>
    </div>

    <!-- 重定向规则 -->
    <div v-if="currentTab === 'redirect'" class="tab-content">
      <div class="section-header">
        <h3>重定向规则</h3>
        <button class="add-btn" @click="openRedirectModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          添加
        </button>
      </div>
      
      <div class="rules-list">
        <div 
          v-for="(rule, index) in config.redirectRules" 
          :key="index"
          class="rule-card"
        >
          <div class="rule-header">
            <span class="rule-index">#{{ index + 1 }}</span>
            <div class="rule-actions">
              <button 
                class="icon-btn" 
                :disabled="index === 0"
                @click="moveRule('redirect', index, -1)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 15l-6-6-6 6"/>
                </svg>
              </button>
              <button 
                class="icon-btn" 
                :disabled="index === config.redirectRules.length - 1"
                @click="moveRule('redirect', index, 1)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>
              <button class="icon-btn edit" @click="openRedirectModal(index)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="icon-btn delete" @click="confirmDeleteRedirect(index)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="rule-body">
            <div class="path-display">
              <div class="path-box source">
                <div class="path-label">源路径</div>
                <div class="path-value">{{ rule.src }}</div>
              </div>
              <div class="arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
              <div class="path-box target">
                <div class="path-label">目标路径</div>
                <div class="path-value">{{ rule.dst }}</div>
              </div>
            </div>
          </div>
          <div class="rule-tip">
            优先级: {{ index + 1 }} (先匹配先应用)
          </div>
        </div>
      </div>

      <div v-if="config.redirectRules.length === 0" class="empty-rules">
        <p>暂无重定向规则</p>
        <p class="hint">添加规则将应用访问的源路径重定向到目标路径</p>
      </div>
    </div>

    <!-- 只读规则 -->
    <div v-if="currentTab === 'readonly'" class="tab-content">
      <div class="section-header">
        <h3>只读规则</h3>
        <button class="add-btn" @click="openReadonlyModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          添加
        </button>
      </div>

      <div class="rules-list">
        <div 
          v-for="(rule, index) in config.readOnlyRules" 
          :key="index"
          class="rule-card readonly-card"
        >
          <div class="path-box readonly">
            <div class="path-label">只读路径</div>
            <div class="path-value">{{ rule.path }}</div>
          </div>
          <div class="rule-actions">
            <button class="icon-btn edit" @click="openReadonlyModal(index)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="icon-btn delete" @click="confirmDeleteReadonly(index)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div v-if="config.readOnlyRules.length === 0" class="empty-rules">
        <p>暂无只读规则</p>
        <p class="hint">添加规则将禁止应用写入指定路径</p>
      </div>
    </div>

    <!-- 日志 -->
    <div v-if="currentTab === 'logs'" class="tab-content">
      <div class="section-header">
        <h3>访问日志</h3>
        <button class="add-btn secondary" @click="clearLogs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          清空
        </button>
      </div>

      <div v-if="logs.length > 0" class="logs-list">
        <div 
          v-for="log in logs" 
          :key="log.ts"
          class="log-entry"
          :class="log.decision.toLowerCase()"
        >
          <div class="log-header">
            <span class="log-time">{{ formatTime(log.ts) }}</span>
            <span class="log-op">{{ log.op }}</span>
            <span class="log-decision" :class="log.decision.toLowerCase()">
              {{ formatDecision(log.decision) }}
            </span>
          </div>
          <div class="log-path">{{ log.path }}</div>
          <div v-if="log.mapped" class="log-mapped">
            → {{ log.mapped }}
          </div>
        </div>
      </div>

      <div v-else class="empty-rules">
        <p>暂无日志记录</p>
        <p class="hint">开启监控后将记录文件访问操作</p>
      </div>
    </div>

    <!-- 错误日志 -->
    <div v-if="currentTab === 'errors'" class="tab-content">
      <div class="section-header">
        <h3>错误日志</h3>
        <button v-if="errorLogs.length > 0" class="add-btn secondary" @click="clearErrorLogs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          清空
        </button>
      </div>

      <div v-if="errorLogs.length > 0" class="logs-list">
        <div
          v-for="(log, index) in errorLogs"
          :key="index"
          class="log-entry error-log"
        >
          <div class="log-header">
            <span class="log-time">{{ log.time }}</span>
            <span class="log-type error">{{ log.type }}</span>
          </div>
          <div class="log-message error-message">{{ log.message }}</div>
          <div v-if="log.details" class="log-details">{{ log.details }}</div>
        </div>
      </div>

      <div v-else class="empty-rules">
        <p>暂无错误记录</p>
        <p class="hint">规则挂载失败时将记录错误信息</p>
      </div>
    </div>

    <!-- 重定向规则弹窗 -->
    <div v-if="showRedirectModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <button class="back-btn" @click="closeRedirectModal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h3>{{ editingRedirectIndex !== null ? '编辑重定向规则' : '添加重定向规则' }}</h3>
          <button class="save-btn" @click="saveRedirectRule">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="input-group">
            <label>源路径</label>
            <input 
              v-model="redirectForm.src" 
              type="text" 
              placeholder="例如: /storage/emulated/0/Download"
            />
          </div>
          <div class="arrow-down">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M19 12l-7 7-7-7"/>
            </svg>
          </div>
          <div class="input-group">
            <label>目标路径</label>
            <input 
              v-model="redirectForm.dst" 
              type="text" 
              placeholder="例如: /storage/emulated/0/Download/MyApp"
            />
          </div>
          <div class="tip-box">
            <h4>规则说明</h4>
            <p>当应用访问源路径时，会自动重定向到目标路径。</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 只读规则弹窗 -->
    <div v-if="showReadonlyModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <button class="back-btn" @click="closeReadonlyModal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h3>{{ editingReadonlyIndex !== null ? '编辑只读规则' : '添加只读规则' }}</h3>
          <button class="save-btn readonly" @click="saveReadonlyRule">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="input-group">
            <label>只读路径</label>
            <input 
              v-model="readonlyForm.path" 
              type="text" 
              placeholder="例如: /storage/emulated/0/DCIM"
            />
          </div>
          <div class="tip-box readonly">
            <h4>规则说明</h4>
            <p>设置只读路径后，应用将无法对该路径下的文件进行写入、删除或修改操作。</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeDeleteModal">
      <div class="modal-content confirm-modal">
        <div class="confirm-icon">⚠️</div>
        <h3>确认删除</h3>
        <p>{{ deleteMessage }}</p>
        <div class="confirm-actions">
          <button class="btn-secondary" @click="closeDeleteModal">取消</button>
          <button class="btn-danger" @click="executeDelete">删除</button>
        </div>
      </div>
    </div>

    <!-- 清空日志确认弹窗 -->
    <div v-if="showClearLogsModal" class="modal-overlay" @click.self="closeClearLogsModal">
      <div class="modal-content confirm-modal">
        <div class="confirm-icon">🗑️</div>
        <h3>确认清空日志</h3>
        <p>确定要清空该应用的访问日志吗？此操作不可恢复。</p>
        <div class="confirm-actions">
          <button class="btn-secondary" @click="closeClearLogsModal">取消</button>
          <button class="btn-danger" @click="executeClearLogs">清空</button>
        </div>
      </div>
    </div>

    <!-- 清空错误日志确认弹窗 -->
    <div v-if="showClearErrorLogsModal" class="modal-overlay" @click.self="closeClearErrorLogsModal">
      <div class="modal-content confirm-modal">
        <div class="confirm-icon">🗑️</div>
        <h3>确认清空错误日志</h3>
        <p>确定要清空该应用的错误日志吗？此操作不可恢复。</p>
        <div class="confirm-actions">
          <button class="btn-secondary" @click="closeClearErrorLogsModal">取消</button>
          <button class="btn-danger" @click="executeClearErrorLogs">清空</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'

const props = defineProps({
  pkg: String
})

const router = useRouter()
const appStore = useAppStore()

const currentTab = ref('redirect')
const appInfo = ref(null)
const logs = ref([])
const errorLogs = ref([])

const tabs = [
  { id: 'redirect', name: '重定向' },
  { id: 'readonly', name: '只读' },
  { id: 'logs', name: '日志' },
  { id: 'errors', name: '错误' }
]

const config = ref({
  enabled: false,
  redirectRules: [],
  readOnlyRules: [],
  monitorPaths: []
})

// 确保配置对象有正确的结构（只在初始化时调用，不要覆盖已有数据）
const ensureConfigStructure = () => {
  if (!config.value) {
    config.value = {
      enabled: false,
      redirectRules: [],
      readOnlyRules: [],
      monitorPaths: []
    }
  }
  // 只在字段不存在时初始化，不要覆盖已有数据
  if (config.value.redirectRules === undefined || config.value.redirectRules === null) {
    config.value.redirectRules = []
  }
  if (config.value.readOnlyRules === undefined || config.value.readOnlyRules === null) {
    config.value.readOnlyRules = []
  }
  if (config.value.monitorPaths === undefined || config.value.monitorPaths === null) {
    config.value.monitorPaths = []
  }
}

// 弹窗状态
const showRedirectModal = ref(false)
const showReadonlyModal = ref(false)
const showDeleteModal = ref(false)
const editingRedirectIndex = ref(null)
const editingReadonlyIndex = ref(null)
const deleteType = ref('')
const deleteIndex = ref(null)
const deleteMessage = ref('')

// 表单数据
const redirectForm = ref({ src: '', dst: '' })
const readonlyForm = ref({ path: '' })

const getAppIconUrl = (pkg) => {
  return appStore.getAppIconUrl(pkg)
}

const getTabCount = (tabId) => {
  switch (tabId) {
    case 'redirect': return config.value.redirectRules?.length || 0
    case 'readonly': return config.value.readOnlyRules?.length || 0
    case 'logs': return logs.value.length
    case 'errors': return errorLogs.value.length
    default: return 0
  }
}

const goBack = () => {
  router.back()
}

// 重定向规则
const openRedirectModal = (index = null) => {
  ensureConfigStructure()
  editingRedirectIndex.value = index
  if (index !== null && config.value.redirectRules[index]) {
    const rule = config.value.redirectRules[index]
    redirectForm.value = { src: rule.src || '', dst: rule.dst || '' }
  } else {
    redirectForm.value = { src: '', dst: '' }
  }
  showRedirectModal.value = true
}

const closeRedirectModal = () => {
  showRedirectModal.value = false
  editingRedirectIndex.value = null
  redirectForm.value = { src: '', dst: '' }
}

const isValidPath = (path) => {
  if (!path || !path.startsWith('/')) return false
  const invalidChars = /[<>:"|?*\x00-\x1f]/
  if (invalidChars.test(path)) return false
  return true
}

const saveRedirectRule = async () => {
  const src = redirectForm.value.src.trim()
  const dst = redirectForm.value.dst.trim()

  console.log('saveRedirectRule: src from form:', JSON.stringify(src), 'dst from form:', JSON.stringify(dst))

  if (!src || !dst) {
    alert('请填写源路径和目标路径')
    return
  }

  if (!isValidPath(src)) {
    alert('源路径格式不正确，路径必须以 / 开头，不能包含特殊字符')
    return
  }

  if (!isValidPath(dst)) {
    alert('目标路径格式不正确，路径必须以 / 开头，不能包含特殊字符')
    return
  }

  console.log('saveRedirectRule: before update, config.value:', JSON.stringify(config.value))
  console.log('saveRedirectRule: current redirectRules:', JSON.stringify(config.value.redirectRules))
  console.log('saveRedirectRule: editingRedirectIndex:', editingRedirectIndex.value)

  // 创建新的规则数组以确保响应式更新
  const currentRules = config.value.redirectRules || []
  console.log('saveRedirectRule: currentRules type:', typeof currentRules, 'isArray:', Array.isArray(currentRules))

  let newRules
  // 检查 editingRedirectIndex 是否为数字（防止事件对象传入）
  const isEditing = typeof editingRedirectIndex.value === 'number'
  if (isEditing) {
    // 编辑现有规则
    newRules = currentRules.map((rule, index) =>
      index === editingRedirectIndex.value ? { src, dst } : rule
    )
    console.log('saveRedirectRule: updated existing rule at index', editingRedirectIndex.value)
  } else {
    // 添加新规则
    newRules = [...currentRules, { src, dst }]
    console.log('saveRedirectRule: added new rule:', { src, dst })
  }

  console.log('saveRedirectRule: newRules:', JSON.stringify(newRules))

  // 直接替换整个 config.value 对象以确保响应式
  // 添加规则时自动启用应用
  config.value = {
    ...config.value,
    enabled: true,
    redirectRules: newRules
  }

  console.log('saveRedirectRule: after update, config.value:', JSON.stringify(config.value))

  // 同时更新 store 中的配置，确保 saveAppConfig 能获取到最新的内存配置
  const appStore = useAppStore()
  if (!appStore.appConfigs[props.pkg]) {
    appStore.appConfigs[props.pkg] = {}
  }
  appStore.appConfigs[props.pkg] = {
    ...appStore.appConfigs[props.pkg],
    enabled: true,
    redirectRules: newRules
  }
  console.log('saveRedirectRule: updated appStore.appConfigs:', JSON.stringify(appStore.appConfigs[props.pkg]))

  closeRedirectModal()

  // 等待响应式更新完成后再保存
  await nextTick()
  console.log('saveRedirectRule: after nextTick, config.value.redirectRules:', JSON.stringify(config.value.redirectRules))

  // 保存完整配置（包括 enabled 和 redirectRules）
  await saveConfig()
}

const confirmDeleteRedirect = (index) => {
  deleteType.value = 'redirect'
  deleteIndex.value = index
  deleteMessage.value = '确定要删除这条重定向规则吗？此操作不可恢复。'
  showDeleteModal.value = true
}

// 只读规则
const openReadonlyModal = (index = null) => {
  ensureConfigStructure()
  editingReadonlyIndex.value = index
  if (index !== null && config.value.readOnlyRules[index]) {
    const rule = config.value.readOnlyRules[index]
    readonlyForm.value = { path: rule.path || '' }
  } else {
    readonlyForm.value = { path: '' }
  }
  showReadonlyModal.value = true
}

const closeReadonlyModal = () => {
  showReadonlyModal.value = false
  editingReadonlyIndex.value = null
  readonlyForm.value = { path: '' }
}

const saveReadonlyRule = async () => {
  const path = readonlyForm.value.path.trim()

  console.log('saveReadonlyRule: path from form:', JSON.stringify(path))

  if (!path) {
    alert('请填写只读路径')
    return
  }

  if (!isValidPath(path)) {
    alert('路径格式不正确，路径必须以 / 开头，不能包含特殊字符')
    return
  }

  console.log('saveReadonlyRule: before update, config.value:', JSON.stringify(config.value))
  console.log('saveReadonlyRule: current readOnlyRules:', JSON.stringify(config.value.readOnlyRules))
  console.log('saveReadonlyRule: editingReadonlyIndex:', editingReadonlyIndex.value)

  // 创建新的规则数组以确保响应式更新
  // 使用 slice() 创建浅拷贝，然后添加新规则
  const currentRules = config.value.readOnlyRules || []
  console.log('saveReadonlyRule: currentRules type:', typeof currentRules, 'isArray:', Array.isArray(currentRules))

  let newRules
  // 检查 editingReadonlyIndex 是否为数字（防止事件对象传入）
  const isEditing = typeof editingReadonlyIndex.value === 'number'
  if (isEditing) {
    // 编辑现有规则
    newRules = currentRules.map((rule, index) =>
      index === editingReadonlyIndex.value ? { path } : rule
    )
    console.log('saveReadonlyRule: updated existing rule at index', editingReadonlyIndex.value)
  } else {
    // 添加新规则
    newRules = [...currentRules, { path }]
    console.log('saveReadonlyRule: added new rule:', { path })
  }

  console.log('saveReadonlyRule: newRules:', JSON.stringify(newRules))

  // 直接替换整个 config.value 对象以确保响应式
  // 添加规则时自动启用应用
  config.value = {
    ...config.value,
    enabled: true,
    readOnlyRules: newRules
  }

  console.log('saveReadonlyRule: after update, config.value:', JSON.stringify(config.value))

  // 同时更新 store 中的配置，确保 saveAppConfig 能获取到最新的内存配置
  const appStore = useAppStore()
  if (!appStore.appConfigs[props.pkg]) {
    appStore.appConfigs[props.pkg] = {}
  }
  appStore.appConfigs[props.pkg] = {
    ...appStore.appConfigs[props.pkg],
    enabled: true,
    readOnlyRules: newRules
  }
  console.log('saveReadonlyRule: updated appStore.appConfigs:', JSON.stringify(appStore.appConfigs[props.pkg]))

  closeReadonlyModal()

  // 等待响应式更新完成后再保存
  await nextTick()
  console.log('saveReadonlyRule: after nextTick, config.value.readOnlyRules:', JSON.stringify(config.value.readOnlyRules))

  // 保存完整配置（包括 enabled 和 readOnlyRules）
  await saveConfig()
}

const confirmDeleteReadonly = (index) => {
  deleteType.value = 'readonly'
  deleteIndex.value = index
  deleteMessage.value = '确定要删除这条只读规则吗？此操作不可恢复。'
  showDeleteModal.value = true
}

// 删除确认
const closeDeleteModal = () => {
  showDeleteModal.value = false
  deleteType.value = ''
  deleteIndex.value = null
  deleteMessage.value = ''
}

const executeDelete = async () => {
  if (deleteType.value === 'redirect') {
    const newRules = [...config.value.redirectRules]
    newRules.splice(deleteIndex.value, 1)
    config.value.redirectRules = newRules
  } else if (deleteType.value === 'readonly') {
    const newRules = [...config.value.readOnlyRules]
    newRules.splice(deleteIndex.value, 1)
    config.value.readOnlyRules = newRules
  }
  closeDeleteModal()
  // 保存完整配置
  await saveConfig()
}

const moveRule = (type, index, direction) => {
  const rules = type === 'redirect' ? [...config.value.redirectRules] : [...config.value.readOnlyRules]
  const newIndex = index + direction
  if (newIndex >= 0 && newIndex < rules.length) {
    const temp = rules[index]
    rules[index] = rules[newIndex]
    rules[newIndex] = temp
    if (type === 'redirect') {
      config.value.redirectRules = rules
    } else {
      config.value.readOnlyRules = rules
    }
    // 保存完整配置
    saveConfig()
  }
}

const saveConfig = async () => {
  try {
    console.log('saveConfig: START - config.value:', JSON.stringify(config.value))

    // 确保配置结构正确
    ensureConfigStructure()

    console.log('saveConfig: after ensureConfigStructure - config.value:', JSON.stringify(config.value))

    // 总是保存完整的配置对象，防止后端配置丢失
    // 确保所有字段都有默认值
    const redirectRules = config.value.redirectRules || []
    const readOnlyRules = config.value.readOnlyRules || []
    const monitorPaths = config.value.monitorPaths || []

    const configToSave = {
      enabled: config.value.enabled === true,
      redirectRules: JSON.parse(JSON.stringify(redirectRules)),
      readOnlyRules: JSON.parse(JSON.stringify(readOnlyRules)),
      monitorPaths: JSON.parse(JSON.stringify(monitorPaths))
    }

    console.log('saveConfig: saving all config:', JSON.stringify(configToSave))

    const success = await appStore.saveAppConfig(props.pkg, configToSave)
    if (success) {
      console.log('saveConfig: save successful')
      // 同时更新 store 中的配置，确保内存中的配置是最新的
      if (!appStore.appConfigs[props.pkg]) {
        appStore.appConfigs[props.pkg] = {}
      }
      Object.assign(appStore.appConfigs[props.pkg], configToSave)
      console.log('saveConfig: updated appStore.appConfigs:', JSON.stringify(appStore.appConfigs[props.pkg]).substring(0, 200))
    } else {
      console.error('saveConfig: save failed')
      alert('保存失败')
    }
  } catch (e) {
    console.error('Save config failed:', e)
    alert('保存失败: ' + e.message)
  }
}

const loadLogs = async () => {
  // 如果处于演示模式，显示空日志而不是错误
  if (appStore.isDemoMode) {
    logs.value = []
    return
  }

  try {
    console.log('Loading logs for package:', props.pkg)
    const appLogs = await appStore.getAppLogs(props.pkg, 50)
    console.log('Loaded logs:', appLogs.length, 'entries')
    if (Array.isArray(appLogs)) {
      logs.value = appLogs.map(log => ({
        ts: log.ts || log.Ts || Date.now(),
        pkg: log.pkg || log.Pkg || props.pkg,
        proc: log.proc || log.Proc || props.pkg,
        pid: log.pid || log.Pid || 0,
        tid: log.tid || log.Tid || 0,
        uid: log.uid || log.Uid || 0,
        op: log.op || log.Op || 'open',
        path: log.path || log.Path || '',
        mapped: log.mapped || log.Mapped || '',
        decision: log.decision || log.Decision || 'PASS',
        result: log.result || log.Result || 'OK',
        errno: log.errno || log.Errno || 0
      }))
    } else {
      logs.value = []
    }
  } catch (e) {
    console.error('Failed to load logs:', e)
    logs.value = []
  }
}

const showClearLogsModal = ref(false)
const showClearErrorLogsModal = ref(false)

const clearLogs = () => {
  showClearLogsModal.value = true
}

const executeClearLogs = async () => {
  try {
    const success = await appStore.clearAppLogs(props.pkg)
    if (success) {
      logs.value = []
      console.log('Logs cleared successfully')
    } else {
      console.error('Failed to clear logs')
      alert('清空日志失败')
    }
  } catch (e) {
    console.error('Error clearing logs:', e)
    alert('清空日志失败: ' + e.message)
  }
  showClearLogsModal.value = false
}

const closeClearLogsModal = () => {
  showClearLogsModal.value = false
}

const loadErrorLogs = async () => {
  // 从配置中加载错误日志
  const savedConfig = await appStore.getAppConfig(props.pkg)
  if (savedConfig && savedConfig.errorLogs) {
    errorLogs.value = savedConfig.errorLogs
  } else {
    errorLogs.value = []
  }
}

// 日志自动刷新
let logsRefreshInterval = null

const startLogsRefresh = () => {
  // 每3秒刷新一次日志
  logsRefreshInterval = setInterval(() => {
    if (currentTab.value === 'logs') {
      loadLogs()
    }
  }, 3000)
}

const stopLogsRefresh = () => {
  if (logsRefreshInterval) {
    clearInterval(logsRefreshInterval)
    logsRefreshInterval = null
  }
}

const clearErrorLogs = () => {
  showClearErrorLogsModal.value = true
}

const executeClearErrorLogs = async () => {
  errorLogs.value = []
  // 保存到配置
  const savedConfig = await appStore.getAppConfig(props.pkg)
  if (savedConfig) {
    savedConfig.errorLogs = []
    await appStore.saveAppConfig(props.pkg, savedConfig)
  }
  showClearErrorLogsModal.value = false
}

const closeClearErrorLogsModal = () => {
  showClearErrorLogsModal.value = false
}

const formatTime = (ts) => {
  const date = new Date(ts)
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatDecision = (decision) => {
  const map = {
    'PASS': '通过',
    'REDIRECT': '重定向',
    'DENY_RO': '只读拒绝',
    'DENY_POLICY': '策略拒绝',
    'MONITOR_ONLY': '仅监控'
  }
  return map[decision] || decision
}

onMounted(async () => {
  // 加载应用信息
  await appStore.loadApps('all')
  appInfo.value = appStore.apps.find(a => a.packageName === props.pkg)

  // 加载配置
  const savedConfig = await appStore.getAppConfig(props.pkg)
  console.log('onMounted: loaded savedConfig:', JSON.stringify(savedConfig))

  if (savedConfig) {
    // 使用 Object.assign 保持响应式，而不是替换整个对象
    config.value.enabled = savedConfig.enabled === true
    config.value.redirectRules = Array.isArray(savedConfig.redirectRules) ? [...savedConfig.redirectRules] : []
    config.value.readOnlyRules = Array.isArray(savedConfig.readOnlyRules) ? [...savedConfig.readOnlyRules] : []
    config.value.monitorPaths = Array.isArray(savedConfig.monitorPaths) ? [...savedConfig.monitorPaths] : []
  } else {
    // 如果没有保存的配置，确保结构正确
    ensureConfigStructure()
  }

  console.log('onMounted: final config.value:', JSON.stringify(config.value))

  // 加载日志
  await loadLogs()

  // 加载错误日志
  await loadErrorLogs()

  // 启动日志自动刷新
  startLogsRefresh()
})

import { onUnmounted } from 'vue'

onUnmounted(() => {
  // 停止日志自动刷新
  stopLogsRefresh()
})
</script>

<style scoped>
.app-detail {
  padding-bottom: 80px;
  background: linear-gradient(180deg, #f8f9fc 0%, #f0f2f8 100%);
  min-height: 100vh;
  color: #1a1a2e;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  min-width: 0;
  overflow: hidden;
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

.app-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  overflow: hidden;
}

.app-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
}

.app-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.app-text h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #1a1a2e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-text p {
  font-size: 12px;
  color: #9ca3af;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.switch {
  position: relative;
  display: inline-block;
  width: 52px;
  height: 28px;
  flex-shrink: 0;
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
  background-color: #e5e7eb;
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
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

input:checked + .slider {
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
}

input:checked + .slider:before {
  transform: translateX(24px);
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  overflow-x: auto;
  scrollbar-width: none;
}

.tabs::-webkit-scrollbar {
  display: none;
}

.tab-btn {
  padding: 10px 20px;
  background: #f5f6fa;
  border: none;
  border-radius: 24px;
  color: #6b7280;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-btn.active {
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.tab-count {
  font-size: 11px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
}

.tab-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.add-btn.secondary {
  background: #f5f6fa;
  color: #6b7280;
  box-shadow: none;
}

.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
}

.add-btn.secondary:hover {
  background: #eef0f5;
  box-shadow: none;
}

.add-btn svg {
  width: 16px;
  height: 16px;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rule-card {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.3s;
}

.rule-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.rule-index {
  font-size: 12px;
  color: #8b5cf6;
  font-weight: 600;
}

.rule-actions {
  display: flex;
  gap: 4px;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f6fa;
  border: none;
  border-radius: 8px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.3s;
}

.icon-btn:hover:not(:disabled) {
  background: #eef0f5;
  color: #1a1a2e;
}

.icon-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.icon-btn.edit:hover {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.icon-btn.delete:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.icon-btn svg {
  width: 16px;
  height: 16px;
}

.path-display {
  display: flex;
  align-items: center;
  gap: 12px;
}

.path-box {
  flex: 1;
  background: #f5f6fa;
  padding: 12px;
  border-radius: 12px;
}

.path-box.target {
  background: rgba(139, 92, 246, 0.08);
  border: 1px solid rgba(139, 92, 246, 0.15);
}

.path-box.readonly {
  flex: 1;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.15);
}

.path-label {
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 4px;
}

.path-box.target .path-label {
  color: #8b5cf6;
}

.path-box.readonly .path-label {
  color: #f59e0b;
}

.path-value {
  font-size: 13px;
  color: #1a1a2e;
  word-break: break-all;
  font-weight: 500;
}

.arrow {
  color: #8b5cf6;
}

.arrow svg {
  width: 20px;
  height: 20px;
}

.rule-tip {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 8px;
}

.readonly-card {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.readonly-card .rule-actions {
  flex-shrink: 0;
  margin-top: 4px;
}

.empty-rules {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;
}

.empty-rules .hint {
  font-size: 12px;
  margin-top: 8px;
  color: #6b7280;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-entry {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 12px;
  padding: 12px;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.log-entry.redirect {
  border-left: 3px solid #8b5cf6;
}

.log-entry.deny_ro, .log-entry.deny_policy {
  border-left: 3px solid #ef4444;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.log-time {
  color: #9ca3af;
  font-size: 11px;
}

.log-op {
  padding: 2px 8px;
  background: #f5f6fa;
  border-radius: 4px;
  font-size: 11px;
  color: #6b7280;
}

.log-decision {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.log-decision.redirect {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.log-decision.deny_ro, .log-decision.deny_policy {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.log-decision.pass {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.log-path {
  color: #1a1a2e;
  word-break: break-all;
}

.log-mapped {
  color: #8b5cf6;
  margin-top: 4px;
  font-size: 12px;
}

/* Error Log Styles */
.log-entry.error-log {
  border-left: 3px solid #ef4444;
  background: rgba(239, 68, 68, 0.02);
}

.log-type.error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.log-message.error-message {
  color: #ef4444;
  font-weight: 500;
}

.log-details {
  margin-top: 8px;
  padding: 8px 12px;
  background: #f5f6fa;
  border-radius: 8px;
  font-size: 12px;
  color: #6b7280;
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
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
  align-items: flex-end;
  justify-content: center;
}

.modal-content {
  background: linear-gradient(180deg, #f8f9fc 0%, #f0f2f8 100%);
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 24px 24px 0 0;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  position: sticky;
  top: 0;
  z-index: 10;
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
}

.save-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  border: none;
  border-radius: 50%;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  transition: all 0.3s;
}

.save-btn.readonly {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.save-btn:hover {
  transform: scale(1.05);
}

.save-btn svg {
  width: 20px;
  height: 20px;
}

.modal-body {
  padding: 16px;
}

.input-group {
  margin-bottom: 16px;
}

.input-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 8px;
}

.input-group input {
  width: 100%;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  color: #1a1a2e;
  font-size: 15px;
  outline: none;
  transition: all 0.3s;
}

.input-group input:focus {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.arrow-down {
  display: flex;
  justify-content: center;
  margin: 8px 0;
  color: #8b5cf6;
}

.arrow-down svg {
  width: 24px;
  height: 24px;
}

.tip-box {
  background: rgba(139, 92, 246, 0.05);
  border: 1px solid rgba(139, 92, 246, 0.1);
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
}

.tip-box.readonly {
  background: rgba(245, 158, 11, 0.05);
  border-color: rgba(245, 158, 11, 0.1);
}

.tip-box h4 {
  font-size: 14px;
  font-weight: 600;
  color: #8b5cf6;
  margin-bottom: 8px;
}

.tip-box.readonly h4 {
  color: #f59e0b;
}

.tip-box p {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.6;
  margin: 0;
}

/* Confirm Modal */
.confirm-modal {
  max-width: 360px;
  margin: auto 16px;
  border-radius: 24px;
  background: #fff;
  padding: 28px;
  text-align: center;
  animation: scaleIn 0.2s ease;
}

@keyframes scaleIn {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.confirm-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.confirm-modal h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 8px;
}

.confirm-modal p {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 24px;
}

.confirm-actions {
  display: flex;
  gap: 12px;
}

.btn-secondary, .btn-danger {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
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
