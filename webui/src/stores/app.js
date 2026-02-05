import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 示例应用数据
const demoApps = [
  { packageName: 'com.example.demo', appLabel: '演示应用', versionName: '1.0.0', versionCode: 1, isSystem: false, uid: 10123, userId: 0 },
  { packageName: 'com.tencent.mm', appLabel: '微信', versionName: '8.0.0', versionCode: 800, isSystem: false, uid: 10124, userId: 0 },
  { packageName: 'com.tencent.mm', appLabel: '微信', versionName: '8.0.0', versionCode: 800, isSystem: false, uid: 10124, userId: 10 },
  { packageName: 'com.android.settings', appLabel: '设置', versionName: '12.0', versionCode: 1200, isSystem: true, uid: 1000, userId: 0 },
  { packageName: 'com.google.android.apps.photos', appLabel: 'Google 相册', versionName: '6.0', versionCode: 600, isSystem: false, uid: 10125, userId: 0 },
  { packageName: 'com.taobao.taobao', appLabel: '淘宝', versionName: '10.0', versionCode: 1000, isSystem: false, uid: 10126, userId: 0 },
  { packageName: 'com.sina.weibo', appLabel: '微博', versionName: '12.0', versionCode: 1200, isSystem: false, uid: 10127, userId: 0 },
  { packageName: 'com.baidu.netdisk', appLabel: '百度网盘', versionName: '11.0', versionCode: 1100, isSystem: false, uid: 10128, userId: 0 },
  { packageName: 'com.android.chrome', appLabel: 'Chrome', versionName: '100.0', versionCode: 10000, isSystem: true, uid: 10129, userId: 0 }
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

// KernelSU API 封装 - 参考示例实现
// ksu 是 KernelSU 自动注入的全局对象，直接使用 ksu.xxx()

let execCallbackId = 0

const ksuApi = {
  // 执行命令 - 使用回调机制
  exec: (command, options = {}) => {
    return new Promise((resolve, reject) => {
      const callbackId = `exec_callback_${Date.now()}_${execCallbackId++}`

      window[callbackId] = (errno, stdout, stderr) => {
        resolve({ errno, stdout, stderr })
        delete window[callbackId]
      }

      try {
        // 直接使用全局 ksu 对象
        if (typeof ksu?.exec === 'function') {
          ksu.exec(command, JSON.stringify(options || {}), callbackId)
        } else {
          throw new Error('KernelSU exec not available')
        }
      } catch (e) {
        delete window[callbackId]
        reject(e)
      }
    })
  },

  // 获取应用列表 - 同步调用，直接返回数组（不是 JSON 字符串！）
  listPackages: (type = 'all') => {
    try {
      // 直接使用全局 ksu 对象
      console.log('[ksuApi] listPackages called with type:', type)
      console.log('[ksuApi] typeof ksu:', typeof ksu)
      console.log('[ksuApi] typeof ksu?.listPackages:', typeof ksu?.listPackages)

      if (typeof ksu?.listPackages === 'function') {
        const result = ksu.listPackages(type)
        console.log('[ksuApi] listPackages raw result:', result)
        console.log('[ksuApi] listPackages result type:', typeof result)
        console.log('[ksuApi] listPackages is array:', Array.isArray(result))
        // 官方 API 直接返回数组，不是 JSON 字符串
        return result
      }
      throw new Error('KernelSU listPackages not available')
    } catch (e) {
      console.error('[ksuApi] listPackages error:', e)
      throw e
    }
  },

  // 获取应用信息 - 同步调用，直接返回数组（不是 JSON 字符串！）
  getPackagesInfo: (packages) => {
    try {
      // 直接使用全局 ksu 对象
      console.log('[ksuApi] getPackagesInfo called')
      console.log('[ksuApi] packages param:', packages)
      console.log('[ksuApi] packages is array:', Array.isArray(packages))

      if (!Array.isArray(packages)) {
        console.error('[ksuApi] packages is not an array!')
        return []
      }

      console.log('[ksuApi] packages count:', packages.length)

      if (typeof ksu?.getPackagesInfo === 'function') {
        // 官方 API 直接传入数组，返回的也是数组，不是 JSON 字符串
        const result = ksu.getPackagesInfo(packages)
        console.log('[ksuApi] getPackagesInfo raw result:', result)
        console.log('[ksuApi] getPackagesInfo result type:', typeof result)
        console.log('[ksuApi] getPackagesInfo is array:', Array.isArray(result))
        return result
      }
      throw new Error('KernelSU getPackagesInfo not available')
    } catch (e) {
      console.error('[ksuApi] getPackagesInfo error:', e)
      throw e
    }
  },

  // 显示 Toast
  toast: (message) => {
    try {
      // 直接使用全局 ksu 对象
      if (typeof ksu?.toast === 'function') {
        ksu.toast(message)
      } else {
        console.log('[Toast]', message)
      }
    } catch (e) {
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
      const { errno, stdout, stderr } = await ksuApi.exec(command)
      if (errno === 0) {
        const result = JSON.parse(stdout)
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

  // 加载应用列表 - 参考示例实现，分别获取用户应用和系统应用
  const loadApps = async (type = 'all') => {
    loading.value = true
    loadError.value = null

    try {
      console.log('[store] Loading apps...')
      console.log('[store] typeof ksu:', typeof ksu)
      console.log('[store] ksu object:', ksu)
      console.log('[store] typeof ksu?.listPackages:', typeof ksu?.listPackages)

      // 检查 KernelSU API 是否可用 - 使用全局 ksu 对象
      if (typeof ksu?.listPackages !== 'function') {
        console.error('[store] ksu.listPackages is not available')
        throw new Error('KernelSU API 不可用，请在 KernelSU 管理器中打开 WebUI')
      }

      let allPackages = []

      // 根据类型获取应用包名列表 - 参考示例代码实现
      // 注意：官方 API 直接返回数组，不是 JSON 字符串！
      if (type === 'all' || type === 'user') {
        // 获取用户应用
        try {
          console.log('[store] Calling ksuApi.listPackages("user")...')
          const userPackages = ksuApi.listPackages('user')
          console.log('[store] User packages result:', userPackages)
          console.log('[store] User packages is array:', Array.isArray(userPackages))

          if (Array.isArray(userPackages) && userPackages.length > 0) {
            allPackages = allPackages.concat(userPackages)
          }
        } catch (e) {
          console.error('[store] Failed to load user packages:', e)
        }
      }

      if (type === 'all' || type === 'system') {
        // 获取系统应用
        try {
          console.log('[store] Calling ksuApi.listPackages("system")...')
          const systemPackages = ksuApi.listPackages('system')
          console.log('[store] System packages result:', systemPackages)
          console.log('[store] System packages is array:', Array.isArray(systemPackages))

          if (Array.isArray(systemPackages) && systemPackages.length > 0) {
            allPackages = allPackages.concat(systemPackages)
          }
        } catch (e) {
          console.error('[store] Failed to load system packages:', e)
        }
      }

      // 去重 - 确保 allPackages 是数组
      if (!Array.isArray(allPackages)) {
        console.error('[store] allPackages is not an array:', allPackages)
        allPackages = []
      }
      allPackages = [...new Set(allPackages)]
      console.log('[store] Total unique packages:', allPackages.length)

      if (allPackages.length === 0) {
        throw new Error('获取应用列表为空')
      }

      // getPackagesInfo 直接传入数组，返回的也是数组（不是 JSON 字符串！）
      console.log('[store] Calling ksuApi.getPackagesInfo...')
      const info = ksuApi.getPackagesInfo(allPackages)
      console.log('[store] Info result:', info)
      console.log('[store] Info is array:', Array.isArray(info))

      if (!Array.isArray(info)) {
        throw new Error('获取应用信息返回的不是数组')
      }

      console.log('[store] Info count:', info.length)

      // 确保 info 是数组
      if (!Array.isArray(info)) {
        console.error('[store] info is not an array:', info)
        throw new Error('获取应用信息返回的不是数组')
      }

      apps.value = info.map(p => ({
        packageName: p.packageName,
        appLabel: p.appLabel,
        versionName: p.versionName,
        versionCode: p.versionCode,
        isSystem: p.isSystem,
        uid: p.uid,
        userId: p.userId || 0
      }))

      console.log('[store] Loaded apps:', apps.value.length)
      return true
    } catch (e) {
      console.error('[store] Failed to load apps:', e)
      loadError.value = e.message || '未知错误'
      return false
    } finally {
      loading.value = false
    }
  }

  // 加载演示数据
  const loadDemoData = () => {
    isDemoMode.value = true
    loadError.value = null
    loading.value = false
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
    ksuApi.toast('已加载演示数据')
  }

  // 配置文件路径
  const CONFIG_PATH = '/data/adb/modules/StorageRedirect/config/config.json'

  // 直接读取配置文件（备用方案）
  const readConfigFile = async () => {
    try {
      const result = await ksuApi.exec(`cat ${CONFIG_PATH} 2>/dev/null || echo '{"version":1,"global":{},"apps":{}}'`)
      if (result && result.stdout) {
        return JSON.parse(result.stdout)
      }
    } catch (e) {
      console.error('Failed to read config file:', e)
    }
    return { version: 1, global: {}, apps: {} }
  }

  // 直接写入配置文件（备用方案）
  const writeConfigFile = async (config) => {
    try {
      const configJson = JSON.stringify(config, null, 2)
      const result = await ksuApi.exec(`echo '${configJson.replace(/'/g, "'\\''")}' > ${CONFIG_PATH}`)
      if (result && result.errno === 0) {
        return true
      }
    } catch (e) {
      console.error('Failed to write config file:', e)
    }
    return false
  }

  // 加载应用配置列表
  const loadAppConfigs = async () => {
    if (isDemoMode.value) {
      appConfigs.value = demoConfigs
      return
    }

    try {
      // 首先尝试通过 daemon 获取
      const result = await callDaemon('app list')
      if (result && result.ok && result.apps) {
        const configs = {}
        result.apps.forEach(app => {
          configs[app.pkg] = app
        })
        appConfigs.value = configs
        return
      }
    } catch (e) {
      console.log('Daemon app list failed, trying direct file read:', e)
    }

    // 备用方案：直接读取配置文件
    try {
      const config = await readConfigFile()
      if (config && config.apps) {
        appConfigs.value = config.apps
      }
    } catch (e) {
      console.error('Failed to load app configs:', e)
    }
  }

  // 加载全局配置
  const loadGlobalConfig = async () => {
    if (isDemoMode.value) return

    try {
      // 首先尝试通过 daemon 获取
      const result = await callDaemon('global get')
      if (result && result.ok && result.global) {
        globalConfig.value = result.global
        return
      }
    } catch (e) {
      console.log('Daemon global get failed, trying direct file read:', e)
    }

    // 备用方案：直接读取配置文件
    try {
      const config = await readConfigFile()
      if (config && config.global) {
        globalConfig.value = config.global
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
      // 首先尝试通过 daemon 获取
      const result = await callDaemon('app get', { pkg })
      if (result && result.ok && result.app) {
        appConfigs.value[pkg] = result.app
        return result.app
      }
    } catch (e) {
      console.log('Daemon app get failed, trying direct file read:', e)
    }

    // 备用方案：直接读取配置文件
    try {
      const config = await readConfigFile()
      if (config && config.apps && config.apps[pkg]) {
        appConfigs.value[pkg] = config.apps[pkg]
        return config.apps[pkg]
      }
    } catch (e) {
      console.error('Failed to get app config:', e)
    }
    return null
  }

  // 保存应用配置
  const saveAppConfig = async (pkg, appConfig) => {
    if (isDemoMode.value) {
      demoConfigs[pkg] = appConfig
      appConfigs.value[pkg] = appConfig
      ksuApi.toast('保存成功（演示模式）')
      return true
    }

    try {
      // 首先尝试通过 daemon 保存
      const result = await callDaemon('app set', {
        pkg,
        json: appConfig
      })
      if (result && result.ok) {
        appConfigs.value[pkg] = appConfig
        ksuApi.toast('保存成功')
        return true
      }
    } catch (e) {
      console.log('Daemon app set failed, trying direct file write:', e)
    }

    // 备用方案：直接写入配置文件
    try {
      const config = await readConfigFile()
      if (!config.apps) {
        config.apps = {}
      }
      config.apps[pkg] = appConfig
      const success = await writeConfigFile(config)
      if (success) {
        appConfigs.value[pkg] = appConfig
        ksuApi.toast('保存成功')
        return true
      }
    } catch (e) {
      console.error('Failed to save app config:', e)
      ksuApi.toast('保存失败: ' + e.message)
    }
    return false
  }

  // 保存全局配置
  const saveGlobalConfig = async (newConfig) => {
    if (isDemoMode.value) {
      globalConfig.value = newConfig
      ksuApi.toast('保存成功（演示模式）')
      return true
    }

    try {
      // 首先尝试通过 daemon 保存
      const result = await callDaemon('global set', { json: newConfig })
      if (result && result.ok) {
        globalConfig.value = newConfig
        ksuApi.toast('保存成功')
        return true
      }
    } catch (e) {
      console.log('Daemon global set failed, trying direct file write:', e)
    }

    // 备用方案：直接写入配置文件
    try {
      const config = await readConfigFile()
      config.global = newConfig
      const success = await writeConfigFile(config)
      if (success) {
        globalConfig.value = newConfig
        ksuApi.toast('保存成功')
        return true
      }
    } catch (e) {
      console.error('Failed to save global config:', e)
      ksuApi.toast('保存失败: ' + e.message)
    }
    return false
  }

  // 日志目录路径
  const LOG_DIR = '/data/adb/modules/StorageRedirect/logs'

  // 获取应用日志
  const getAppLogs = async (pkg, n = 20) => {
    if (isDemoMode.value) {
      return demoLogs.filter(l => l.pkg === pkg)
    }

    try {
      // 首先尝试通过 daemon 获取
      const result = await callDaemon('log tail', { pkg, n })
      if (result && result.ok && result.entries) {
        return result.entries
      }
    } catch (e) {
      console.log('Daemon log tail failed, trying direct file read:', e)
    }

    // 备用方案：直接读取日志文件
    try {
      const logFile = `${LOG_DIR}/${pkg}.log`
      const result = await ksuApi.exec(`cat ${logFile} 2>/dev/null || echo '[]'`)
      if (result && result.stdout) {
        const logs = JSON.parse(result.stdout)
        if (Array.isArray(logs)) {
          return logs.slice(-n)
        }
      }
    } catch (e) {
      console.error('Failed to get logs from file:', e)
    }
    return []
  }

  // 清空应用日志
  const clearAppLogs = async (pkg) => {
    if (isDemoMode.value) {
      ksuApi.toast('日志已清空（演示模式）')
      return true
    }

    try {
      // 首先尝试通过 daemon 清空
      const result = await callDaemon('log clear', { pkg })
      if (result && result.ok) {
        ksuApi.toast('日志已清空')
        return true
      }
    } catch (e) {
      console.log('Daemon log clear failed, trying direct file delete:', e)
    }

    // 备用方案：直接删除日志文件
    try {
      const logFile = `${LOG_DIR}/${pkg}.log`
      await ksuApi.exec(`rm -f ${logFile}`)
      ksuApi.toast('日志已清空')
      return true
    } catch (e) {
      console.error('Failed to clear logs:', e)
      ksuApi.toast('清空失败')
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

  // 直接执行命令
  const exec = async (command, options = {}) => {
    return ksuApi.exec(command, options)
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
    getAppIconUrl,
    exec,
    readConfigFile,
    writeConfigFile
  }
})
