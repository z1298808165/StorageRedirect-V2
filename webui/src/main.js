import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { createPinia } from 'pinia'
import VConsole from 'vconsole'
import App from './App.vue'
import AppList from './views/AppList.vue'
import AppDetail from './views/AppDetail.vue'
import MonitorConfig from './views/MonitorConfig.vue'
import MonitorLogs from './views/MonitorLogs.vue'
import About from './views/About.vue'

// 初始化 vConsole 用于调试
const vConsole = new VConsole()
console.log('[StorageRedirect] vConsole initialized')

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
