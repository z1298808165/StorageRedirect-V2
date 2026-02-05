import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 示例应用数据
const demoApps = [
  { packageName: 'com.example.demo', appLabel: '演示应用', versionName: '1.0.0', versionCode: 1, isSystem: false, uid: 10123 },
  { packageName: 'com.tencent.mm', appLabel: '微信', versionName: '8.0.0', versionCode: 800, isSystem: false, uid: 10124 },
  { packageName: 'com.android.settings', appLabel: '设置', versionName: '12.0', versionCode: 1200, isSystem: true, uid: 1000 },
  { packageName: 'com.google.android.apps.photos', appLabel: 'Google 相册', versionName: '6.0', versionCode: 600, isSystem: false, uid: 10125 },
  { packageName: 'com.taobao.taobao', appLabel: '淘宝', versionName: '10.0', versionCode: 1000, isSystem: false, uid: 10126 },
  { packageName: 'com.sina.weibo', appLabel: '微博', versionName: '12.0', versionCode: 1200, isSystem: false, uid: 10127 },
  { packageName: 'com.baidu.netdisk', appLabel: '百度网盘', versionName: '11.0', versionCode: 1100, isSystem: false, uid: 10128 },
  { packageName: 'com.android.chrome', appLabel: 'Chrome', versionName: '100.0', versionCode: 10000, isSystem: true, uid: 10129 }
]

// 示例配置数据
const demoConfigs = {
  'com.example.demo': {
    enabled: true,
    redirectRules: [
      { src: '/storage/emulated/0/Download/', dst: '/storage/emulated/0/Download/Demo/' }
    ],
    readOnlyRules: [
      { path: '/storage/emulated/0/DCIM/' }
    ],
    monitorPaths: [
      { path: '/storage/emulated/0/', ops: ['open', 'write', 'delete'] }
    ]
  },
  'com.tencent.mm': {
    enabled: true,
    redirectRules: [
      { src: '/storage/emulated/0/Pictures/', dst: '/storage/emulated/0/Android/data/com.tencent.mm/files/Pictures/' }
    ],
    readOnlyRules: [],
    monitorPaths: [
      { path: '/storage/emulated/0/Download/', ops: ['open', 'write'] }
    ]
  }
}

// 示例日志数据
const demoLogs = [
  { ts: Date.now() - 10000, pkg: 'com.example.demo', proc: 'com.example.demo', pid: 1234, tid: 1234, uid: 10123, op: 'open', path: '/storage/emulated/0/Download/test.txt', mapped: '/storage/emulated/0/Download/Demo/test.txt', decision: 'REDIRECT', result: 'OK' },
  { ts: Date.now() - 5000, pkg: 'com.example.demo', proc: 'com.example.demo', pid: 1234, tid: 1234, uid: 10123, op: 'write', path: '/storage/emulated/0/DCIM/photo.jpg', decision: 'DENY_RO', result: 'FAIL', errno: 13 },
  { ts: Date.now() - 3000, pkg: 'com.example.demo', proc: 'com.example.demo', pid: 1234, tid: 1234, uid: 10123, op: 'mkdir', path: '/storage/emulated/0/Download/NewFolder', mapped: '/storage/emulated/0/Download/Demo/NewFolder', decision: 'REDIRECT', result: 'OK' }
]

// KernelSU API 封装
const ksu = {
  // 执行命令
  exec: async (command) => {
    if (typeof window.exec === 'function') {
      return window.exec(command)
    }
    throw new Error('KernelSU exec not available')
  },
  
  // 获取应用列表
  listPackages: async (type = 'all') => {
    if (typeof window.listPackages === 'function') {
      return window.listPackages(type)
    }
    throw new Error('KernelSU listPackages not available')
  },
  
  // 获取应用信息
  getPackagesInfo: async (packages) => {
    if (typeof window.getPackagesInfo === 'function') {
      return window.getPackagesInfo(packages)
    }
    throw new Error('KernelSU getPackagesInfo not available')
  },
  
  // 显示 Toast
  toast: (message) => {
    if (typeof window.toast === 'function') {
      window.toast(message)
    } else {
      console.log('[Toast]', message)
    }
  }
}

export const useAppStore = defineStore('app', () => {
  // State
  const apps = ref([])
  const appConfigs = ref({})
  const globalConfig = ref(null)
  const loading = ref(false)
  const daemonStatus = ref({ online: false, version: '' })
  const isDemoMode = ref(false)
  const loadError = ref(null)

  // Getters
  const appsWithRules = computed(() => {
    return apps.value.filter(app => {
      const config = appConfigs.value[app.packageName]
      return config && (config.enabled || 
        (config.redirectRules?.length > 0) ||
        (config.readOnlyRules?.length > 0))
    })
  })

  const appsWithoutRules = computed(() => {
    return apps.value.filter(app => {
      const config = appConfigs.value[app.packageName]
      return !config || (!config.enabled && 
        (!config.redirectRules || config.redirectRules.length === 0) &&
        (!config.readOnlyRules || config.readOnlyRules.length === 0))
    })
  })

  // 调用 Daemon（通过 daemonctl 命令）
  const callDaemon = async (cmd, params = null) => {
    if (isDemoMode.value) {
      return mockDaemonResponse(cmd, params)
    }

    const daemonctl = '/data/adb/modules/StorageRedirect/bin/daemonctl'
    
    // 构建命令行参数
    let command = daemonctl
    
    switch (cmd) {
      case 'ping':
        command += ' ping'
        break
      case 'status':
        command += ' status'
        break
      case 'app list':
        command += ' app list'
        break
      case 'app get':
        command += ` app get --pkg "${params.pkg}"`
        break
      case 'app set':
        command += ` app set --pkg "${params.pkg}" --json '${JSON.stringify(params.json)}'`
        break
      case 'app delete':
        command += ` app delete --pkg "${params.pkg}"`
        break
      case 'global get':
        command += ' global get'
        break
      case 'global set':
        command += ` global set '${JSON.stringify(params.json)}'`
        break
      case 'log tail':
        command += ` log tail --pkg "${params.pkg}" --n ${params.n || 20}`
        break
      case 'log clear':
        command += ` log clear --pkg "${params.pkg}"`
        break
      case 'log stats':
        command += ' log stats'
        break
      default:
        throw new Error(`Unknown command: ${cmd}`)
    }

    try {
      const { errno, stdout, stderr } = await ksu.exec(command)
      if (errno === 0) {
        const result = JSON.parse(stdout)
        // 转换 daemonctl 的输出格式为前端期望的格式
        return { ok: true, ...result }
      }
      throw new Error(`Command failed: ${stderr || stdout}`)
    } catch (e) {
      console.error('Daemon call failed:', e)
      throw e
    }
  }

  // 模拟 Daemon 响应（演示模式）
  const mockDaemonResponse = (cmd, params) => {
    switch (cmd) {
      case 'ping':
        return { ok: true, version: '1.0.0-demo', pid: 1234, configVersion: 1 }
      case 'status':
        return {
          ok: true,
          daemon: { pid: 1234, version: '1.0.0-demo' },
          config: { version: 1 },
          runtime: { connectedProcesses: 2, appsActive: 1 },
          logs: { totalSizeBytes: 1024, maxSizeBytes: 64 * 1024 * 1024 }
        }
      case 'app list':
        return {
          ok: true,
          apps: Object.entries(demoConfigs).map(([pkg, config]) => ({
            pkg,
            enabled: config.enabled,
            counts: {
              redirect: config.redirectRules?.length || 0,
              readOnly: config.readOnlyRules?.length || 0
            }
          }))
        }
      case 'app get':
        const appConfig = demoConfigs[params?.pkg]
        if (appConfig) {
          return {
            ok: true,
            pkg: params.pkg,
            app: appConfig,
            counts: {
              redirect: appConfig.redirectRules?.length || 0,
              readOnly: appConfig.readOnlyRules?.length || 0
            }
          }
        }
        return { ok: false, error: { code: 'E_NOT_FOUND', message: 'App not found' } }
      case 'global get':
        return {
          ok: true,
          global: globalConfig.value || {
            monitorEnabled: true,
            logLevel: 'info',
            maxLogSizeMB: 64,
            update: { pollIntervalMs: 3000, opCheckInterval: 50 },
            processAttribution: { mode: 'strict' },
            uri: { redirectEnabled: true }
          }
        }
      case 'log tail':
        return {
          ok: true,
          pkg: params?.pkg,
          entries: demoLogs.filter(l => l.pkg === params?.pkg)
        }
      case 'log stats':
        return {
          ok: true,
          totalSizeBytes: 1024,
          maxSizeBytes: 64 * 1024 * 1024,
          appCount: 2
        }
      default:
        return { ok: true }
    }
  }

  // 加载应用列表
  const loadApps = async (type = 'all') => {
    loading.value = true
    loadError.value = null
    
    try {
      const packages = await ksu.listPackages(type)
      const info = await ksu.getPackagesInfo(packages)
      apps.value = info.map(p => ({
        packageName: p.packageName,
        appLabel: p.appLabel,
        versionName: p.versionName,
        versionCode: p.versionCode,
        isSystem: p.isSystem,
        uid: p.uid
      }))
      return true
    } catch (e) {
      console.error('Failed to load apps:', e)
      loadError.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }

  // 加载演示数据
  const loadDemoData = () => {
    isDemoMode.value = true
    apps.value = demoApps
    appConfigs.value = demoConfigs
    globalConfig.value = {
      monitorEnabled: true,
      logLevel: 'info',
      maxLogSizeMB: 64,
      update: { pollIntervalMs: 3000, opCheckInterval: 50 },
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
    }
    daemonStatus.value = { online: true, version: '1.0.0-demo' }
    ksu.toast('已加载演示数据')
  }

  // 加载应用配置列表
  const loadAppConfigs = async () => {
    if (isDemoMode.value) {
      appConfigs.value = demoConfigs
      return
    }
    
    try {
      const result = await callDaemon('app list')
      if (result && result.ok && result.apps) {
        const configs = {}
        result.apps.forEach(app => {
          configs[app.pkg] = app
        })
        appConfigs.value = configs
      }
    } catch (e) {
      console.error('Failed to load app configs:', e)
    }
  }

  // 加载全局配置
  const loadGlobalConfig = async () => {
    if (isDemoMode.value) return
    
    try {
      const result = await callDaemon('global get')
      if (result && result.ok && result.global) {
        globalConfig.value = result.global
      }
    } catch (e) {
      console.error('Failed to load global config:', e)
    }
  }

  // 获取单个应用配置
  const getAppConfig = async (pkg) => {
    if (isDemoMode.value) {
      return demoConfigs[pkg] || null
    }
    
    try {
      const result = await callDaemon('app get', { pkg })
      if (result && result.ok && result.app) {
        appConfigs.value[pkg] = result.app
        return result.app
      }
    } catch (e) {
      console.error('Failed to get app config:', e)
    }
    return null
  }

  // 保存应用配置
  const saveAppConfig = async (pkg, config) => {
    if (isDemoMode.value) {
      demoConfigs[pkg] = config
      appConfigs.value[pkg] = config
      ksu.toast('保存成功（演示模式）')
      return true
    }
    
    try {
      const result = await callDaemon('app set', { 
        pkg, 
        json: config 
      })
      if (result && result.ok) {
        appConfigs.value[pkg] = config
        ksu.toast('保存成功')
        return true
      }
    } catch (e) {
      console.error('Failed to save app config:', e)
      ksu.toast('保存失败: ' + e.message)
    }
    return false
  }

  // 保存全局配置
  const saveGlobalConfig = async (config) => {
    if (isDemoMode.value) {
      globalConfig.value = config
      ksu.toast('保存成功（演示模式）')
      return true
    }
    
    try {
      const result = await callDaemon('global set', { json: config })
      if (result && result.ok) {
        globalConfig.value = config
        ksu.toast('保存成功')
        return true
      }
    } catch (e) {
      console.error('Failed to save global config:', e)
      ksu.toast('保存失败: ' + e.message)
    }
    return false
  }

  // 获取应用日志
  const getAppLogs = async (pkg, n = 20) => {
    if (isDemoMode.value) {
      return demoLogs.filter(l => l.pkg === pkg)
    }
    
    try {
      const result = await callDaemon('log tail', { pkg, n })
      if (result && result.ok && result.entries) {
        return result.entries
      }
    } catch (e) {
      console.error('Failed to get logs:', e)
    }
    return []
  }

  // 清空应用日志
  const clearAppLogs = async (pkg) => {
    if (isDemoMode.value) {
      ksu.toast('日志已清空（演示模式）')
      return true
    }
    
    try {
      const result = await callDaemon('log clear', { pkg })
      if (result && result.ok) {
        ksu.toast('日志已清空')
        return true
      }
    } catch (e) {
      console.error('Failed to clear logs:', e)
      ksu.toast('清空失败')
    }
    return false
  }

  // 检查 Daemon 状态
  const checkDaemon = async () => {
    if (isDemoMode.value) {
      daemonStatus.value = { online: true, version: '1.0.0-demo' }
      return true
    }
    
    try {
      const result = await callDaemon('ping')
      daemonStatus.value = {
        online: result && result.ok,
        version: result?.version || ''
      }
      return result && result.ok
    } catch (e) {
      daemonStatus.value = { online: false, version: '' }
      return false
    }
  }

  // 获取应用图标 URL
  const getAppIconUrl = (pkg) => {
    if (isDemoMode.value) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(pkg)}&background=8b5cf6&color=fff`
    }
    return `ksu://icon/${pkg}`
  }

  return {
    apps,
    appConfigs,
    globalConfig,
    loading,
    daemonStatus,
    isDemoMode,
    loadError,
    appsWithRules,
    appsWithoutRules,
    callDaemon,
    loadApps,
    loadDemoData,
    loadAppConfigs,
    loadGlobalConfig,
    getAppConfig,
    saveAppConfig,
    saveGlobalConfig,
    getAppLogs,
    clearAppLogs,
    checkDaemon,
    getAppIconUrl
  }
})
