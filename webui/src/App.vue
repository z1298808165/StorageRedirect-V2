<template>
  <div class="app">
    <header class="header">
      <h1>StorageRedirect</h1>
      <div class="daemon-status" :class="{ online: daemonOnline }">
        <span class="status-dot"></span>
        <span class="status-text">{{ daemonOnline ? '服务正常' : '服务离线' }}</span>
      </div>
    </header>

    <main class="main-content">
      <router-view />
    </main>

    <nav class="bottom-nav">
      <router-link to="/apps" class="nav-item" active-class="active">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
        </svg>
        <span>应用</span>
      </router-link>
      <router-link to="/monitor" class="nav-item" active-class="active">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 20v-6M6 20V10M18 20V4"/>
        </svg>
        <span>监控</span>
      </router-link>
      <router-link to="/about" class="nav-item" active-class="active">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
        <span>关于</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from './stores/app'

const appStore = useAppStore()
const daemonOnline = ref(false)
let checkInterval

const checkDaemon = async () => {
  try {
    const result = await appStore.checkDaemon()
    daemonOnline.value = result
  } catch (e) {
    daemonOnline.value = false
  }
}

onMounted(() => {
  checkDaemon()
  // 减少检查频率到 30 秒，减少控制台输出
  checkInterval = setInterval(checkDaemon, 30000)
})

onUnmounted(() => {
  clearInterval(checkInterval)
})
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #f8f9fc 0%, #f0f2f8 100%);
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 16px 20px;
  padding-top: max(16px, env(safe-area-inset-top));
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h1 {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a2e;
}

.daemon-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #9ca3af;
  transition: color 0.3s;
}

.daemon-status.online {
  color: #4ade80;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  transition: background 0.3s;
}

.daemon-status.online .status-dot {
  background: #4ade80;
  box-shadow: 0 0 8px #4ade80;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.bottom-nav {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  gap: 8px;
  padding: 8px;
  z-index: 100;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 24px;
  color: #9ca3af;
  text-decoration: none;
  font-size: 11px;
  transition: all 0.3s;
  border-radius: 16px;
  position: relative;
}

.nav-item.active {
  color: #fff;
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  transform: scale(1.05);
}

.nav-item .icon {
  width: 24px;
  height: 24px;
}
</style>
