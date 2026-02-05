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
        <button class="add-btn" @click="addRedirectRule">
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
              <button class="icon-btn delete" @click="removeRedirectRule(index)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="rule-body">
            <div class="input-group">
              <label>源路径</label>
              <input 
                v-model="rule.src" 
                type="text" 
                placeholder="/storage/emulated/0/Source/"
                @blur="saveConfig"
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
                v-model="rule.dst" 
                type="text" 
                placeholder="/storage/emulated/0/Target/"
                @blur="saveConfig"
              />
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
        <button class="add-btn" @click="addReadOnlyRule">
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
          <div class="input-group">
            <label>只读路径</label>
            <input 
              v-model="rule.path" 
              type="text" 
              placeholder="/storage/emulated/0/DCIM/"
              @blur="saveConfig"
            />
          </div>
          <button class="icon-btn delete" @click="removeReadOnlyRule(index)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
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

const tabs = [
  { id: 'redirect', name: '重定向' },
  { id: 'readonly', name: '只读' },
  { id: 'logs', name: '日志' }
]

const availableOps = ['open', 'read', 'write', 'rename', 'unlink', 'mkdir', 'rmdir']

const config = ref({
  enabled: false,
  redirectRules: [],
  readOnlyRules: [],
  monitorPaths: []
})

const getAppIconUrl = (pkg) => {
  return appStore.getAppIconUrl(pkg)
}

const getTabCount = (tabId) => {
  switch (tabId) {
    case 'redirect': return config.value.redirectRules?.length || 0
    case 'readonly': return config.value.readOnlyRules?.length || 0
    case 'logs': return logs.value.length
    default: return 0
  }
}

const goBack = () => {
  router.back()
}

const addRedirectRule = () => {
  config.value.redirectRules.push({
    src: '',
    dst: ''
  })
  saveConfig()
}

const removeRedirectRule = (index) => {
  config.value.redirectRules.splice(index, 1)
  saveConfig()
}

const addReadOnlyRule = () => {
  config.value.readOnlyRules.push({
    path: ''
  })
  saveConfig()
}

const removeReadOnlyRule = (index) => {
  config.value.readOnlyRules.splice(index, 1)
  saveConfig()
}

const toggleOp = (mp, op) => {
  if (!mp.ops) mp.ops = []
  const idx = mp.ops.indexOf(op)
  if (idx > -1) {
    mp.ops.splice(idx, 1)
  } else {
    mp.ops.push(op)
  }
  saveConfig()
}

const moveRule = (type, index, direction) => {
  const rules = type === 'redirect' ? config.value.redirectRules : []
  const newIndex = index + direction
  if (newIndex >= 0 && newIndex < rules.length) {
    const temp = rules[index]
    rules[index] = rules[newIndex]
    rules[newIndex] = temp
    saveConfig()
  }
}

const saveConfig = async () => {
  await appStore.saveAppConfig(props.pkg, config.value)
}

const loadLogs = async () => {
  logs.value = await appStore.getAppLogs(props.pkg, 50)
}

const clearLogs = async () => {
  if (await appStore.clearAppLogs(props.pkg)) {
    logs.value = []
  }
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
  const apps = await appStore.loadApps('all')
  appInfo.value = appStore.apps.find(a => a.packageName === props.pkg)
  
  // 加载配置
  const savedConfig = await appStore.getAppConfig(props.pkg)
  if (savedConfig) {
    config.value = {
      enabled: savedConfig.enabled || false,
      redirectRules: savedConfig.redirectRules || [],
      readOnlyRules: savedConfig.readOnlyRules || [],
      monitorPaths: savedConfig.monitorPaths || []
    }
  }
  
  // 加载日志
  await loadLogs()
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
}

.app-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
}

.app-text h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #1a1a2e;
}

.app-text p {
  font-size: 12px;
  color: #9ca3af;
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

.icon-btn.delete:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.icon-btn svg {
  width: 16px;
  height: 16px;
}

.input-group {
  margin-bottom: 12px;
}

.input-group label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 6px;
}

.input-group input {
  width: 100%;
  padding: 10px 12px;
  background: #f5f6fa;
  border: none;
  border-radius: 10px;
  color: #1a1a2e;
  font-size: 14px;
  outline: none;
  transition: all 0.3s;
}

.input-group input:focus {
  background: #eef0f5;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
}

.arrow-down {
  display: flex;
  justify-content: center;
  margin: 8px 0;
}

.arrow-down svg {
  width: 20px;
  height: 20px;
  color: #8b5cf6;
}

.rule-tip {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 8px;
}

.readonly-card, .monitor-card {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.readonly-card .input-group, .monitor-card .input-group {
  flex: 1;
  margin-bottom: 0;
}

.ops-select {
  margin-top: 12px;
}

.ops-select label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
}

.ops-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.op-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #f5f6fa;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  color: #1a1a2e;
  transition: all 0.3s;
}

.op-checkbox:hover {
  background: #eef0f5;
}

.op-checkbox input {
  accent-color: #8b5cf6;
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
</style>
