<template>
  <div class="app-list">
    <!-- 搜索和筛选 -->
    <div class="filter-bar">
      <div class="search-box">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索应用名称或包名..."
          class="search-input"
        />
      </div>
      <div class="filter-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          :class="['tab-btn', { active: currentTab === tab.value }]"
          @click="currentTab = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- 可视区域检测容器 -->
    <div ref="scrollContainer" class="scroll-container" @scroll="handleScroll">

    <!-- 加载状态 -->
    <div v-if="appStore.loading" class="loading">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- 错误状态和演示数据按钮 -->
    <div v-else-if="appStore.loadError || appStore.apps.length === 0" class="error-state">
      <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p v-if="appStore.loadError">{{ appStore.loadError }}</p>
      <p v-else>无法加载应用列表</p>
      <p class="hint">当前不在 KernelSU 环境中或 API 不可用</p>
      <button class="demo-btn" @click="loadDemoData">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        加载示例数据
      </button>
    </div>

    <!-- 应用列表 -->
    <div v-else class="apps-container">
      <!-- 演示模式提示 -->
      <div v-if="appStore.isDemoMode" class="demo-banner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <span>演示模式 - 所有数据为模拟数据</span>
      </div>

      <!-- 有规则的应用 -->
      <div v-if="filteredAppsWithRules.length > 0" class="app-section">
        <h3 class="section-title">
          已配置规则
          <span class="count">({{ filteredAppsWithRules.length }})</span>
        </h3>
        <div class="app-grid">
          <div
            v-for="app in displayedAppsWithRules"
            :key="app.packageName + '-' + (app.userId || 0)"
            :data-package="app.packageName"
            class="app-card"
            @click="goToDetail(app.packageName)"
          >
            <div class="app-icon">
              <LazyAppIcon
                :src="getAppIconUrl(app.packageName)"
                :alt="app.appLabel"
                :package-name="app.packageName"
                :size="52"
              />
            </div>
            <div class="app-info">
              <div class="app-name">
                {{ app.appLabel }}
                <span v-if="app.isSystem" class="system-badge">系统</span>
                <span v-if="app.userId > 0" class="clone-badge">分身</span>
              </div>
              <div class="app-package">{{ app.packageName }}</div>
              <div class="rule-badges">
                <span v-if="getRuleCount(app).redirect > 0" class="badge redirect">
                  重定向 {{ getRuleCount(app).redirect }}
                </span>
                <span v-if="getRuleCount(app).readOnly > 0" class="badge readonly">
                  只读 {{ getRuleCount(app).readOnly }}
                </span>
              </div>
            </div>
            <div class="app-status" :class="getAppStatusClass(app)">
              <span class="status-indicator"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- 加载更多提示 -->
      <div v-if="hasMoreWithRules || hasMoreWithoutRules" class="load-more">
        <div v-if="isLoadingMore" class="loading-spinner">
          <div class="spinner small"></div>
        </div>
      </div>

      <!-- 其他应用 -->
      <div v-if="filteredAppsWithoutRules.length > 0 && currentTab !== 'configured'" class="app-section" :style="{ marginBottom: '100px' }">
        <h3 class="section-title">
          其他应用
          <span class="count">({{ filteredAppsWithoutRules.length }})</span>
        </h3>
        <div class="app-grid">
          <div
            v-for="app in displayedAppsWithoutRules"
            :key="app.packageName + '-' + (app.userId || 0)"
            :data-package="app.packageName"
            class="app-card"
            @click="goToDetail(app.packageName)"
          >
            <div class="app-icon">
              <LazyAppIcon
                :src="getAppIconUrl(app.packageName)"
                :alt="app.appLabel"
                :package-name="app.packageName"
                :size="52"
              />
            </div>
            <div class="app-info">
              <div class="app-name">
                {{ app.appLabel }}
                <span v-if="app.isSystem" class="system-badge">系统</span>
                <span v-if="app.userId > 0" class="clone-badge">分身</span>
              </div>
              <div class="app-package">{{ app.packageName }}</div>
            </div>
            <div class="app-status" :class="getAppStatusClass(app)">
              <span class="status-indicator"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="filteredApps.length === 0" class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
        </svg>
        <p>没有找到匹配的应用</p>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import LazyAppIcon from '../components/LazyAppIcon.vue'

const router = useRouter()
const appStore = useAppStore()

const searchQuery = ref('')
const currentTab = ref('all')
const scrollContainer = ref(null)
const visibleApps = ref(new Set())
let observer = null

// 懒加载相关
const BATCH_SIZE = 30 // 每批加载的应用数量
const displayedCountWithRules = ref(BATCH_SIZE)
const displayedCountWithoutRules = ref(BATCH_SIZE)
const isLoadingMore = ref(false)

const tabs = [
  { label: '全部', value: 'all' },
  { label: '用户应用', value: 'user' },
  { label: '系统应用', value: 'system' },
  { label: '已配置', value: 'configured' }
]

// 注意：不要解构 ref，直接使用 appStore.xxx 保持响应性
// 在模板中 Vue 会自动解包 ref，不需要 .value

const filteredApps = computed(() => {
  let result = []

  // 从所有应用开始筛选 - 确保 apps 是数组
  // Pinia store 中的 ref 会被自动解包，直接访问即可
  const appsList = appStore.apps || []
  result = [...appsList]

  // 先按用户/系统筛选
  if (currentTab.value === 'user') {
    result = result.filter(a => !a.isSystem)
  } else if (currentTab.value === 'system') {
    result = result.filter(a => a.isSystem)
  } else if (currentTab.value === 'configured') {
    // 已配置标签：只显示有规则的应用
    result = result.filter(app => {
      const configs = appStore.appConfigs
      const config = configs?.[app.packageName]
      return config && (config.enabled === true ||
        (Array.isArray(config.redirectRules) && config.redirectRules.length > 0) ||
        (Array.isArray(config.readOnlyRules) && config.readOnlyRules.length > 0))
    })
  }

  // 搜索筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(app =>
      app.appLabel.toLowerCase().includes(query) ||
      app.packageName.toLowerCase().includes(query)
    )
  }

  return result
})

const filteredAppsWithRules = computed(() => {
  // 从已过滤的应用列表中筛选出有规则的应用
  if (currentTab.value === 'configured') {
    // 已配置标签页：所有显示的应用都有规则
    return filteredApps.value
  }
  return filteredApps.value.filter(app => {
    // appConfigs 是 ref，但在 store 中使用时直接访问即可
    const configs = appStore.appConfigs
    const config = configs?.[app.packageName]
    const hasRules = config && (config.enabled === true ||
      (Array.isArray(config.redirectRules) && config.redirectRules.length > 0) ||
      (Array.isArray(config.readOnlyRules) && config.readOnlyRules.length > 0))
    return hasRules
  })
})

const filteredAppsWithoutRules = computed(() => {
  if (currentTab.value === 'configured') return []
  // 从已过滤的应用列表中筛选出无规则的应用
  return filteredApps.value.filter(app => {
    const configs = appStore.appConfigs
    const config = configs?.[app.packageName]
    const noRules = !config || (config.enabled !== true &&
      (!Array.isArray(config.redirectRules) || config.redirectRules.length === 0) &&
      (!Array.isArray(config.readOnlyRules) || config.readOnlyRules.length === 0))
    return noRules
  })
})

// 懒加载：限制显示数量
const displayedAppsWithRules = computed(() => {
  return filteredAppsWithRules.value.slice(0, displayedCountWithRules.value)
})

const displayedAppsWithoutRules = computed(() => {
  return filteredAppsWithoutRules.value.slice(0, displayedCountWithoutRules.value)
})

// 是否还有更多应用可加载
const hasMoreWithRules = computed(() => {
  return displayedAppsWithRules.value.length < filteredAppsWithRules.value.length
})

const hasMoreWithoutRules = computed(() => {
  return displayedAppsWithoutRules.value.length < filteredAppsWithoutRules.value.length
})

const getAppIconUrl = (pkg) => {
  return appStore.getAppIconUrl(pkg)
}

const getRuleCount = (app) => {
  const configs = appStore.appConfigs
  const config = configs?.[app.packageName]
  if (!config) return { redirect: 0, readOnly: 0 }
  return {
    redirect: (Array.isArray(config.redirectRules) ? config.redirectRules.length : 0),
    readOnly: (Array.isArray(config.readOnlyRules) ? config.readOnlyRules.length : 0)
  }
}

const isEnabled = (app) => {
  const config = appStore.appConfigs?.value?.[app.packageName]
  return config?.enabled || false
}

// 获取应用状态样式类
// 无点: 没有配置规则
// 灰色点: 已配置规则但应用未运行（enabled=false）
// 绿色点: 已配置规则且应用处于运行状态（enabled=true）
// 红色点: 已配置规则且应用处于运行状态但规则挂载失败
const getAppStatusClass = (app) => {
  const configs = appStore.appConfigs
  const config = configs?.[app.packageName]

  // 检查是否有规则配置
  const hasRedirectRules = config && Array.isArray(config.redirectRules) && config.redirectRules.length > 0
  const hasReadOnlyRules = config && Array.isArray(config.readOnlyRules) && config.readOnlyRules.length > 0
  const hasRules = hasRedirectRules || hasReadOnlyRules

  // 没有配置规则，不显示状态点
  if (!hasRules) {
    return ''
  }

  // 有规则但应用未启用（enabled=false），显示灰色
  if (!config || config.enabled !== true) {
    return 'stopped'
  }

  // 有规则且启用，检查是否有挂载错误
  if (config.mountError || config.error) {
    return 'error'
  }

  // 有规则且启用且无错误，显示绿色（运行中）
  return 'running'
}

const goToDetail = (pkg) => {
  router.push(`/app/${pkg}`)
}

const loadDemoData = () => {
  appStore.loadDemoData()
}

// 等待 KernelSU API 可用
const waitForKsuApi = async (maxRetries = 20, interval = 500) => {
  let retries = 0
  while (retries < maxRetries) {
    retries++
    console.log(`[AppList] Checking ksu API (attempt ${retries}/${maxRetries})...`)

    // 尝试初始化 API
    try {
      const initSuccess = await appStore.ksuApi.init()
      console.log('[AppList] ksuApi.init() result:', initSuccess)
      const available = await appStore.ksuApi.isAvailable()
      console.log('[AppList] ksuApi.isAvailable():', available)

      if (available) {
        console.log('[AppList] KernelSU API is available!')
        return true
      }
    } catch (e) {
      console.error('[AppList] Error initializing ksuApi:', e)
    }

    await new Promise(resolve => setTimeout(resolve, interval))
  }

  console.log('[AppList] KernelSU API not available after max retries')
  return false
}

onMounted(async () => {
  console.log('[AppList] Component mounted')
  console.log('[AppList] Initial apps count:', appStore.apps.length)

  // 等待 KernelSU API 注入完成
  console.log('[AppList] Waiting for KernelSU API...')
  const apiAvailable = await waitForKsuApi()

  if (!apiAvailable) {
    console.log('[AppList] KernelSU API not available, auto loading demo data')
    // API 不可用，自动加载演示数据
    if (appStore.apps.length === 0) {
      appStore.loadDemoData()
    }
    return
  }

  // API 可用，尝试加载真实数据
  console.log('[AppList] KernelSU API available, loading real apps...')
  try {
    // 无论是否已加载，都重新加载应用列表和配置
    const success = await appStore.loadApps('all')
    console.log('[AppList] loadApps result:', success)
    if (success) {
      console.log('[AppList] Real apps loaded successfully')
      await appStore.loadAppConfigs()
      console.log('[AppList] App configs loaded, count:', Object.keys(appStore.appConfigs?.value || {}).length)
    } else if (appStore.apps.length === 0) {
      console.log('[AppList] Failed to load real apps, loading demo data')
      appStore.loadDemoData()
    }
  } catch (e) {
    console.error('[AppList] Failed to load real apps:', e)
    if (appStore.apps.length === 0) {
      appStore.loadDemoData()
    }
  }

  // 初始化 Intersection Observer
  nextTick(() => {
    initIntersectionObserver()
  })
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
    observer = null
  }
})

// 监听应用列表变化，重新初始化 observer
watch([filteredAppsWithRules, filteredAppsWithoutRules], () => {
  nextTick(() => {
    initIntersectionObserver()
  })
})

// 加载更多应用
const loadMore = (type) => {
  if (isLoadingMore.value) return
  isLoadingMore.value = true
  
  // 模拟异步加载
  setTimeout(() => {
    if (type === 'withRules') {
      displayedCountWithRules.value += BATCH_SIZE
    } else {
      displayedCountWithoutRules.value += BATCH_SIZE
    }
    isLoadingMore.value = false
  }, 100)
}

// 滚动到底部检测
const handleScroll = (e) => {
  const target = e.target
  const scrollBottom = target.scrollTop + target.clientHeight
  const scrollHeight = target.scrollHeight
  
  // 距离底部 200px 时加载更多
  if (scrollHeight - scrollBottom < 200) {
    if (hasMoreWithRules.value) {
      loadMore('withRules')
    } else if (hasMoreWithoutRules.value) {
      loadMore('withoutRules')
    }
  }
}

// 初始化 Intersection Observer
const initIntersectionObserver = () => {
  if (observer) {
    observer.disconnect()
  }

  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const pkg = entry.target.getAttribute('data-package')
      if (entry.isIntersecting && pkg) {
        visibleApps.value.add(pkg)
      }
    })
  }, {
    root: scrollContainer.value,
    rootMargin: '100px', // 提前 100px 开始加载
    threshold: 0.1
  })

  // 观察所有应用卡片
  const cards = document.querySelectorAll('.app-card[data-package]')
  cards.forEach(card => {
    observer.observe(card)
  })
}

// 重置懒加载计数器
const resetLazyLoad = () => {
  displayedCountWithRules.value = BATCH_SIZE
  displayedCountWithoutRules.value = BATCH_SIZE
}

// 监听标签页和搜索变化，重置懒加载
watch([currentTab, searchQuery], () => {
  resetLazyLoad()
})
</script>

<style scoped>
.app-list {
  padding-bottom: 80px;
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden;
}

.scroll-container {
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  height: calc(100vh - 140px); /* 减去搜索栏和底部空间 */
  width: 100%;
}

.apps-container {
  width: 100%;
  padding: 0 16px;
  box-sizing: border-box;
}

.app-section {
  width: 100%;
}

.app-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

/* 应用卡片加载动画 */
.app-card {
  animation: fadeInUp 0.3s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.filter-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  padding: 16px;
  border-radius: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.search-box {
  position: relative;
  margin-bottom: 12px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  color: #9ca3af;
}

.search-input {
  width: 100%;
  padding: 12px 16px 12px 44px;
  background: #f5f6fa;
  border: none;
  border-radius: 12px;
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

.filter-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.filter-tabs::-webkit-scrollbar {
  display: none;
}

.tab-btn {
  padding: 8px 16px;
  background: #f5f6fa;
  border: none;
  border-radius: 20px;
  color: #6b7280;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
}

.tab-btn.active {
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #9ca3af;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(139, 92, 246, 0.3);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #6b7280;
  text-align: center;
}

.error-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.error-state p {
  margin-bottom: 8px;
}

.error-state .hint {
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 20px;
}

.demo-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.demo-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
}

.demo-btn svg {
  width: 18px;
  height: 18px;
}

.demo-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 12px;
  margin-bottom: 16px;
  color: #f59e0b;
  font-size: 13px;
}

.demo-banner svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.app-section {
  margin-bottom: 24px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 12px;
  padding: 0 4px;
}

.section-title .count {
  font-weight: 400;
  color: #9ca3af;
}

.app-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.app-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #fff;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.04);
  width: 100%;
  box-sizing: border-box;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

.app-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.app-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  overflow: hidden;
  background: #f5f6fa;
  flex-shrink: 0;
}

.app-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.app-info {
  flex: 1;
  min-width: 0;
}

.app-name {
  font-size: 15px;
  font-weight: 500;
  color: #1a1a2e;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 6px;
}

.system-badge {
  display: inline-block;
  padding: 2px 6px;
  background: #f5f6fa;
  border-radius: 4px;
  font-size: 10px;
  color: #9ca3af;
  font-weight: 500;
  flex-shrink: 0;
}

.app-package {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.version {
  font-size: 11px;
  color: #9ca3af;
}

.rule-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.badge {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.badge.redirect {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.badge.readonly {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.app-status {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #e5e7eb;
  transition: all 0.3s;
}

/* 没有配置规则 - 隐藏状态指示器 */
.app-status:empty .status-indicator,
.app-status:not(.running):not(.stopped):not(.error) .status-indicator {
  display: none;
}

/* 运行中 - 绿色 */
.app-status.running .status-indicator {
  background: #4ade80;
  box-shadow: 0 0 12px #4ade80;
}

/* 未运行 - 灰色 */
.app-status.stopped .status-indicator {
  background: #9ca3af;
  box-shadow: none;
}

/* 挂载失败 - 红色 */
.app-status.error .status-indicator {
  background: #ef4444;
  box-shadow: 0 0 12px #ef4444;
}

/* 分身应用标记 */
.clone-badge {
  display: inline-block;
  padding: 2px 6px;
  background: rgba(139, 92, 246, 0.1);
  border-radius: 4px;
  font-size: 10px;
  color: #8b5cf6;
  font-weight: 500;
  flex-shrink: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #9ca3af;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  font-size: 14px;
}

/* 加载更多 */
.load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #9ca3af;
  font-size: 13px;
}

.loading-spinner {
  display: flex;
  align-items: center;
  gap: 8px;
}

.spinner.small {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

.load-more-hint {
  opacity: 0.7;
}
</style>
