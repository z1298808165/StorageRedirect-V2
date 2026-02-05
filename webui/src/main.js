import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { createPinia } from 'pinia'
import App from './App.vue'
import AppList from './views/AppList.vue'
import AppDetail from './views/AppDetail.vue'
import MonitorConfig from './views/MonitorConfig.vue'
import About from './views/About.vue'

const routes = [
  { path: '/', redirect: '/apps' },
  { path: '/apps', component: AppList },
  { path: '/app/:pkg', component: AppDetail, props: true },
  { path: '/monitor', component: MonitorConfig },
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
