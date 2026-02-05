import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { createPinia } from 'pinia'
import VConsole from 'vconsole'
import { listPackages, getPackagesInfo, exec, toast } from 'kernelsu'
import App from './App.vue'
import AppList from './views/AppList.vue'
import AppDetail from './views/AppDetail.vue'
import MonitorConfig from './views/MonitorConfig.vue'
import MonitorLogs from './views/MonitorLogs.vue'
import About from './views/About.vue'

// 初始化 vConsole 用于调试
const vConsole = new VConsole()
console.log('[StorageRedirect] vConsole initialized')

// 检查导入的 kernelsu API
console.log('[StorageRedirect] Checking kernelsu imports...')
console.log('[StorageRedirect] typeof listPackages:', typeof listPackages)
console.log('[StorageRedirect] typeof getPackagesInfo:', typeof getPackagesInfo)
console.log('[StorageRedirect] typeof exec:', typeof exec)
console.log('[StorageRedirect] typeof toast:', typeof toast)

const routes = [
  { path: '/', redirect: '/apps' },
  { path: '/apps', component: AppList },
  { path: '/app/:pkg', component: AppDetail, props: true },
  { path: '/monitor', component: MonitorConfig },
  { path: '/monitor-logs', component: MonitorLogs },
  { path: '/about', component: About }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
