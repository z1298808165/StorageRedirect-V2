import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { listPackages, getPackagesInfo, exec, toast } from 'kernelsu'

// KernelSU API 引用
const ksuApis = {
  listPackages,
  getPackagesInfo,
  exec,
  toast
}
let ksuModuleLoaded = true

// 初始化 KernelSU API
const initKsuApi = async () => {
  return true
}

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

// KernelSU API 封装
const ksuApi = {
  // 初始化 API
  init: initKsuApi,

  // 检查 API 是否可用
  isAvailable: async () => {
    // 实际调用 listPackages 来测试 API 是否真正可用
    try {
      const testResult = await listPackages('user')
      return Array.isArray(testResult)
    } catch (e) {
      return false
    }
  },

  // 执行命令 - 使用导入的 exec 函数
  exec: async (command, options = {}) => {
    // 确保 API 已初始化
    if (!ksuModuleLoaded) {
      await initKsuApi()
    }
    
    if (!ksuApis.exec) {
      // 返回模拟的失败结果，而不是抛出错误
      return { errno: -1, stdout: '', stderr: 'exec API not available' }
    }
    try {
      const result = await ksuApis.exec(command, options)
      return result
    } catch (e) {
      console.error('[ksuApi] exec error:', e)
      throw e
    }
  },

  // 获取应用列表 - 使用 listPackages API 或 pm 命令作为替代
  listPackages: async (type = 'all') => {
    // 确保 API 已初始化
    if (!ksuModuleLoaded) {
      await initKsuApi()
    }
    
    // 如果 listPackages API 可用，直接使用
    if (ksuApis.listPackages) {
      try {
        const result = await ksuApis.listPackages(type)
        
        // 确保返回数组
        if (!result || !Array.isArray(result)) {
          return []
        }
        return result
      } catch (e) {
        console.error('[ksuApi] listPackages error:', e)
        throw e
      }
    }
    
    // 如果 API 不可用，使用 pm 命令作为替代
    if (!ksuApis.exec) {
      throw new Error('Neither listPackages API nor exec API is available')
    }
    
    try {
      let cmd = ''
      if (type === 'user') {
        cmd = 'pm list packages -3'
      } else if (type === 'system') {
        cmd = 'pm list packages -s'
      } else {
        cmd = 'pm list packages'
      }
      
      const { errno, stdout, stderr } = await ksuApis.exec(cmd)
      
      if (errno !== 0) {
        throw new Error(`pm command failed: ${stderr}`)
      }
      
      // 解析输出，提取包名
      const packages = stdout
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('package:'))
        .map(line => line.replace('package:', ''))
      
      return packages
    } catch (e) {
      console.error('[ksuApi] Fallback listPackages error:', e)
      throw e
    }
  },

  // 获取应用信息 - 使用 getPackagesInfo API 或 pm 命令作为替代
  getPackagesInfo: async (packages) => {
    // 确保 API 已初始化
    if (!ksuModuleLoaded) {
      await initKsuApi()
    }
    
    if (!Array.isArray(packages)) {
      return []
    }
    
    // 如果 getPackagesInfo API 可用，直接使用
    if (ksuApis.getPackagesInfo) {
      try {
        const result = await ksuApis.getPackagesInfo(packages)
        
        // 确保返回数组
        if (!result || !Array.isArray(result)) {
          return []
        }
        return result
      } catch (e) {
        console.error('[ksuApi] getPackagesInfo error:', e)
        throw e
      }
    }
    
    // 如果 API 不可用，使用 pm 命令作为替代
    if (!ksuApis.exec) {
      throw new Error('Neither getPackagesInfo API nor exec API is available')
    }
    
    try {
      // 为每个包名获取基本信息
      const results = []
      
      for (const pkg of packages) {
        try {
          // 使用 pm dump 获取应用信息
          const { errno, stdout } = await ksuApis.exec(`pm dump ${pkg} | grep -E "(Package|versionName|versionCode|ApplicationLabel)" | head -20`)
          
          if (errno === 0 && stdout) {
            // 解析基本信息
            const info = {
              packageName: pkg,
              appLabel: pkg, // 默认使用包名
              versionName: '',
              versionCode: 0,
              isSystem: false,
              uid: 0,
              userId: 0
            }
            
            // 尝试从输出中提取信息
            const versionMatch = stdout.match(/versionName=([^\s]+)/)
            if (versionMatch) info.versionName = versionMatch[1]
            
            const codeMatch = stdout.match(/versionCode=(\d+)/)
            if (codeMatch) info.versionCode = parseInt(codeMatch[1])
            
            results.push(info)
          }
        } catch (e) {
          console.warn(`[ksuApi] Failed to get info for ${pkg}:`, e)
        }
      }
      
      return results
    } catch (e) {
      console.error('[ksuApi] Fallback getPackagesInfo error:', e)
      throw e
    }
  },

  // 显示 Toast - 使用导入的 toast 函数
  toast: (message) => {
    if (!ksuApis.toast) {
      console.log('[Toast]', message)
      return
    }
    try {
      console.log('[ksuApi] toast:', message)
      ksuApis.toast(message)
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
  const runningApps = ref(new Set())
  
  // 保存队列，防止并发保存导致数据丢失
  const saveQueue = ref([])
  const isSaving = ref(false)

  // Getters
  const appsWithRules = computed(() => {
    if (!apps.value || !appConfigs.value) return []
    return apps.value.filter(app => {
      const config = appConfigs.value[app.packageName]
      const hasRules = config && (config.enabled === true ||
        (Array.isArray(config.redirectRules) && config.redirectRules.length > 0) ||
        (Array.isArray(config.readOnlyRules) && config.readOnlyRules.length > 0))
      return hasRules
    })
  })

  const appsWithoutRules = computed(() => {
    if (!apps.value || !appConfigs.value) return []
    return apps.value.filter(app => {
      const config = appConfigs.value[app.packageName]
      const noRules = !config || (config.enabled !== true &&
        (!Array.isArray(config.redirectRules) || config.redirectRules.length === 0) &&
        (!Array.isArray(config.readOnlyRules) || config.readOnlyRules.length === 0))
      return noRules
    })
  })

  // Unicode 安全的 base64 编码
  const utf8ToBase64 = (str) => {
    const utf8Bytes = new TextEncoder().encode(str)
    let binary = ''
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i])
    }
    return btoa(binary)
  }

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
        // 使用 base64 编码避免 shell 转义问题（支持 Unicode）
        {
          const jsonStr = JSON.stringify(params.app)
          const base64Json = utf8ToBase64(jsonStr)
          command += ` app set --pkg "${params.pkg}" --json-base64 "${base64Json}"`
        }
        break
      case 'app delete':
        command += ` app delete --pkg "${params.pkg}"`
        break
      case 'global get':
        command += ' global get'
        break
      case 'global set':
        // 使用 base64 编码避免 shell 转义问题（支持 Unicode）
        {
          const jsonStr = JSON.stringify(params.global)
          const base64Json = utf8ToBase64(jsonStr)
          command += ` global set --json-base64 "${base64Json}"`
        }
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
      case 'monitor get':
        command += ' monitor get'
        break
      case 'monitor set':
        // 使用 base64 编码避免 shell 转义问题（支持 Unicode）
        {
          const jsonStr = JSON.stringify(params.monitor)
          const base64Json = utf8ToBase64(jsonStr)
          command += ` monitor set --json-base64 "${base64Json}"`
        }
        break
      default:
        throw new Error(`Unknown command: ${cmd}`)
    }

    try {
      const { errno, stdout, stderr } = await ksuApi.exec(command)
      if (errno === 0) {
        const result = JSON.parse(stdout)
        return result
      }
      // 命令执行失败，尝试解析错误输出
      try {
        const errorResult = JSON.parse(stdout)
        return errorResult
      } catch (parseError) {
        // 不是 JSON 格式，返回错误
        return { ok: false, error: { code: 'E_EXEC', message: stderr || stdout } }
      }
    } catch (e) {
      console.error('Daemon call failed:', e)
      return { ok: false, error: { code: 'E_EXCEPTION', message: e.message } }
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

  // 检测 KernelSU API 是否可用
  // 通过尝试初始化来判断是否在 KernelSU WebView 环境中
  const checkKsuApiAvailable = async () => {
    try {
      const result = await initKsuApi()
      return result
    } catch (e) {
      console.error('[store] KernelSU API check failed:', e)
      return false
    }
  }

  // 加载应用列表 - 参考示例实现，分别获取用户应用和系统应用
  const loadApps = async (type = 'all') => {
    loading.value = true
    loadError.value = null

    try {
      let allPackages = []

      // 根据类型获取应用包名列表
      if (type === 'all' || type === 'user') {
        // 获取用户应用
        try {
          const userPackages = await listPackages('user')
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
          const systemPackages = await listPackages('system')
          if (Array.isArray(systemPackages) && systemPackages.length > 0) {
            allPackages = allPackages.concat(systemPackages)
          }
        } catch (e) {
          console.error('[store] Failed to load system packages:', e)
        }
      }

      // 去重
      allPackages = [...new Set(allPackages)]

      if (allPackages.length === 0) {
        throw new Error('获取应用列表为空')
      }

      // 获取应用详细信息
      const info = await getPackagesInfo(allPackages)

      if (!Array.isArray(info)) {
        throw new Error('获取应用信息返回的不是数组')
      }

      // 过滤掉无效的应用数据
      apps.value = info
        .filter(p => p && typeof p === 'object' && p.packageName)
        .map(p => ({
          packageName: p.packageName,
          appLabel: p.appLabel || p.packageName,
          versionName: p.versionName || '',
          versionCode: p.versionCode || 0,
          isSystem: p.isSystem || false,
          uid: p.uid || 0,
          userId: p.userId || 0
        }))

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

  // 配置文件路径 - 新的分散式配置结构
  const CONFIG_DIR = '/data/adb/modules/StorageRedirect/config'
  const APPS_CONFIG_DIR = `${CONFIG_DIR}/apps`
  const GLOBAL_CONFIG_PATH = `${CONFIG_DIR}/global.json`
  const MONITOR_CONFIG_PATH = `${CONFIG_DIR}/monitor_paths.json`

  // 读取全局配置
  const readGlobalConfigFile = async () => {
    console.log('【readGlobalConfigFile】开始读取全局配置:', GLOBAL_CONFIG_PATH)
    try {
      const result = await ksuApi.exec(`cat ${GLOBAL_CONFIG_PATH} 2>/dev/null || echo '{}'`)
      if (result && result.stdout) {
        const parsed = JSON.parse(result.stdout)
        console.log('【readGlobalConfigFile】解析后的配置:', JSON.stringify(parsed, null, 2))
        return parsed
      }
    } catch (e) {
      console.error('【readGlobalConfigFile】读取失败:', e)
    }
    return {}
  }

  // 写入全局配置
  const writeGlobalConfigFile = async (config) => {
    try {
      const configJson = JSON.stringify(config, null, 2)
      const base64Json = utf8ToBase64(configJson)

      // 创建配置目录
      const mkdirResult = await ksuApi.exec(`mkdir -p ${CONFIG_DIR}`)
      if (!mkdirResult || mkdirResult.errno !== 0) {
        console.error('writeGlobalConfigFile: mkdir failed:', mkdirResult?.stderr)
        return false
      }

      // 使用 base64 编码写入文件
      const tempFile = '/tmp/sr_global_config_base64.tmp'
      const escapedBase64 = base64Json.replace(/\$/g, '\\$').replace(/`/g, '\\`')
      const writeCmd = `echo -n "${escapedBase64}" > ${tempFile}`
      const writeTempResult = await ksuApi.exec(writeCmd)

      if (!writeTempResult || writeTempResult.errno !== 0) {
        return false
      }

      const decodeResult = await ksuApi.exec(`base64 -d ${tempFile} > ${GLOBAL_CONFIG_PATH}`)
      await ksuApi.exec(`rm -f ${tempFile}`)

      return decodeResult && decodeResult.errno === 0
    } catch (e) {
      console.error('writeGlobalConfigFile: exception:', e)
      return false
    }
  }

  // 读取监控路径配置
  const readMonitorConfigFile = async () => {
    console.log('【readMonitorConfigFile】开始读取监控配置:', MONITOR_CONFIG_PATH)
    try {
      const result = await ksuApi.exec(`cat ${MONITOR_CONFIG_PATH} 2>/dev/null || echo '{"paths":[]}'`)
      if (result && result.stdout) {
        const parsed = JSON.parse(result.stdout)
        console.log('【readMonitorConfigFile】解析后的配置:', JSON.stringify(parsed, null, 2))
        return parsed
      }
    } catch (e) {
      console.error('【readMonitorConfigFile】读取失败:', e)
    }
    return { paths: [] }
  }

  // 写入监控路径配置
  const writeMonitorConfigFile = async (config) => {
    try {
      const configJson = JSON.stringify(config, null, 2)
      const base64Json = utf8ToBase64(configJson)

      const mkdirResult = await ksuApi.exec(`mkdir -p ${CONFIG_DIR}`)
      if (!mkdirResult || mkdirResult.errno !== 0) {
        return false
      }

      const tempFile = '/tmp/sr_monitor_config_base64.tmp'
      const escapedBase64 = base64Json.replace(/\$/g, '\\$').replace(/`/g, '\\`')
      const writeCmd = `echo -n "${escapedBase64}" > ${tempFile}`
      const writeTempResult = await ksuApi.exec(writeCmd)

      if (!writeTempResult || writeTempResult.errno !== 0) {
        return false
      }

      const decodeResult = await ksuApi.exec(`base64 -d ${tempFile} > ${MONITOR_CONFIG_PATH}`)
      await ksuApi.exec(`rm -f ${tempFile}`)

      return decodeResult && decodeResult.errno === 0
    } catch (e) {
      console.error('writeMonitorConfigFile: exception:', e)
      return false
    }
  }

  // 读取单个应用配置
  const readAppConfigFile = async (pkg) => {
    const appConfigPath = `${APPS_CONFIG_DIR}/${pkg}.json`
    console.log('【readAppConfigFile】开始读取应用配置:', appConfigPath)
    try {
      const result = await ksuApi.exec(`cat ${appConfigPath} 2>/dev/null || echo '{}'`)
      if (result && result.stdout && result.stdout.trim() !== '{}') {
        const parsed = JSON.parse(result.stdout)
        console.log('【readAppConfigFile】解析后的配置:', JSON.stringify(parsed, null, 2))
        return parsed
      }
    } catch (e) {
      console.error('【readAppConfigFile】读取失败:', e)
    }
    return null
  }

  // 写入单个应用配置
  const writeAppConfigFile = async (pkg, config) => {
    try {
      const configJson = JSON.stringify(config, null, 2)
      const base64Json = utf8ToBase64(configJson)

      // 创建应用配置目录
      const mkdirResult = await ksuApi.exec(`mkdir -p ${APPS_CONFIG_DIR}`)
      if (!mkdirResult || mkdirResult.errno !== 0) {
        return false
      }

      const appConfigPath = `${APPS_CONFIG_DIR}/${pkg}.json`
      const tempFile = '/tmp/sr_app_config_base64.tmp'
      const escapedBase64 = base64Json.replace(/\$/g, '\\$').replace(/`/g, '\\`')
      const writeCmd = `echo -n "${escapedBase64}" > ${tempFile}`
      const writeTempResult = await ksuApi.exec(writeCmd)

      if (!writeTempResult || writeTempResult.errno !== 0) {
        return false
      }

      const decodeResult = await ksuApi.exec(`base64 -d ${tempFile} > ${appConfigPath}`)
      await ksuApi.exec(`rm -f ${tempFile}`)

      return decodeResult && decodeResult.errno === 0
    } catch (e) {
      console.error('writeAppConfigFile: exception:', e)
      return false
    }
  }

  // 删除应用配置
  const deleteAppConfigFile = async (pkg) => {
    try {
      const appConfigPath = `${APPS_CONFIG_DIR}/${pkg}.json`
      const result = await ksuApi.exec(`rm -f ${appConfigPath}`)
      return result && result.errno === 0
    } catch (e) {
      console.error('deleteAppConfigFile: exception:', e)
      return false
    }
  }

  // 获取所有应用配置列表（扫描目录）
  const listAppConfigs = async () => {
    console.log('【listAppConfigs】扫描应用配置目录:', APPS_CONFIG_DIR)
    try {
      const result = await ksuApi.exec(`ls ${APPS_CONFIG_DIR}/*.json 2>/dev/null || echo ''`)
      if (result && result.stdout) {
        const files = result.stdout.trim().split('\n').filter(f => f.endsWith('.json'))
        const configs = {}
        for (const file of files) {
          const pkg = file.split('/').pop().replace('.json', '')
          const config = await readAppConfigFile(pkg)
          if (config) {
            configs[pkg] = {
              ...config,
              enabled: config.enabled === true,
              redirectRules: Array.isArray(config.redirectRules) ? config.redirectRules : [],
              readOnlyRules: Array.isArray(config.readOnlyRules) ? config.readOnlyRules : []
            }
          }
        }
        console.log('【listAppConfigs】找到应用配置数量:', Object.keys(configs).length)
        return configs
      }
    } catch (e) {
      console.error('【listAppConfigs】失败:', e)
    }
    return {}
  }

  // 兼容旧代码：readConfigFile 读取合并后的配置
  const readConfigFile = async () => {
    console.log('【readConfigFile】读取分散式配置并合并')
    try {
      const [global, monitor, apps] = await Promise.all([
        readGlobalConfigFile(),
        readMonitorConfigFile(),
        listAppConfigs()
      ])
      return {
        version: 1,
        global: {
          ...global,
          monitorPaths: monitor.paths || []
        },
        apps
      }
    } catch (e) {
      console.error('【readConfigFile】失败:', e)
      return { version: 1, global: {}, apps: {} }
    }
  }

  // 兼容旧代码：writeConfigFile 写入分散式配置
  const writeConfigFile = async (config) => {
    try {
      const results = await Promise.all([
        writeGlobalConfigFile(config.global || {}),
        writeMonitorConfigFile({ paths: config.global?.monitorPaths || [] }),
        // 应用配置单独写入
        ...(Object.entries(config.apps || {}).map(([pkg, appConfig]) => 
          writeAppConfigFile(pkg, appConfig)
        ))
      ])
      return results.every(r => r)
    } catch (e) {
      console.error('writeConfigFile: exception:', e)
      return false
    }
  }

  // 加载应用配置列表
  const loadAppConfigs = async () => {
    if (isDemoMode.value) {
      appConfigs.value = demoConfigs
      return
    }

    // 优先使用新的分散式配置读取
    try {
      const configs = await listAppConfigs()
      appConfigs.value = configs
      console.log('loadAppConfigs: loaded from new config structure, apps count:', Object.keys(configs).length)
      return
    } catch (e) {
      console.log('New config read failed, trying daemon:', e)
    }

    // 尝试通过 daemon 获取
    try {
      const result = await callDaemon('app list')
      if (result && result.ok && result.apps) {
        const configs = {}
        for (const app of result.apps) {
          // daemon 返回的是简化版配置，需要获取完整配置
          const fullConfig = await callDaemon('app get', { pkg: app.pkg })
          if (fullConfig && fullConfig.ok && fullConfig.app) {
            configs[app.pkg] = {
              ...fullConfig.app,
              enabled: fullConfig.app.enabled === true,
              redirectRules: Array.isArray(fullConfig.app.redirectRules) ? fullConfig.app.redirectRules : [],
              readOnlyRules: Array.isArray(fullConfig.app.readOnlyRules) ? fullConfig.app.readOnlyRules : []
            }
          }
        }
        appConfigs.value = configs
        console.log('loadAppConfigs: loaded from daemon, apps count:', Object.keys(configs).length)
        return
      }
    } catch (e) {
      console.log('Daemon app list failed:', e)
    }

    console.error('Failed to load app configs from all sources')
  }

  // 加载全局配置
  const loadGlobalConfig = async () => {
    console.log('========== loadGlobalConfig 开始 ==========')
    
    if (isDemoMode.value) {
      console.log('【loadGlobalConfig】演示模式，跳过加载')
      console.log('========== loadGlobalConfig 完成（演示模式）==========')
      return
    }

    try {
      // 首先尝试通过 daemon 获取
      console.log('【loadGlobalConfig】尝试通过 daemon 获取全局配置...')
      const result = await callDaemon('global get')
      console.log('【loadGlobalConfig】daemon 返回结果:', JSON.stringify(result, null, 2))
      
      if (result && result.ok && result.global) {
        globalConfig.value = result.global
        console.log('【loadGlobalConfig】从 daemon 加载成功:', JSON.stringify(globalConfig.value, null, 2))
        console.log('========== loadGlobalConfig 完成（daemon）==========')
        return
      }
      console.log('【loadGlobalConfig】daemon 返回无效结果')
    } catch (e) {
      console.log('【loadGlobalConfig】daemon 获取失败:', e)
    }

    // 备用方案：直接读取分散式配置文件
    console.log('【loadGlobalConfig】使用备用方案：直接读取配置文件...')
    try {
      const [global, monitor] = await Promise.all([
        readGlobalConfigFile(),
        readMonitorConfigFile()
      ])
      
      // 合并全局配置和监控路径
      globalConfig.value = {
        ...global,
        monitorPaths: monitor.paths || []
      }
      
      console.log('【loadGlobalConfig】从文件加载成功:', JSON.stringify(globalConfig.value, null, 2))
      console.log('========== loadGlobalConfig 完成（文件）==========')
    } catch (e) {
      console.error('【loadGlobalConfig】读取文件失败:', e)
      console.log('========== loadGlobalConfig 失败 ==========')
    }
  }

  // 获取单个应用配置
  const getAppConfig = async (pkg) => {
    if (isDemoMode.value) {
      return demoConfigs[pkg] || null
    }

    // 优先使用新的分散式配置读取
    try {
      const config = await readAppConfigFile(pkg)
      if (config) {
        // 规范化配置结构
        const normalizedConfig = {
          ...config,
          enabled: config.enabled === true,
          redirectRules: Array.isArray(config.redirectRules) ? config.redirectRules : [],
          readOnlyRules: Array.isArray(config.readOnlyRules) ? config.readOnlyRules : []
        }
        appConfigs.value[pkg] = normalizedConfig
        return normalizedConfig
      }
    } catch (e) {
      console.log('New config read failed, trying daemon:', e)
    }

    // 尝试通过 daemon 获取
    const result = await callDaemon('app get', { pkg })
    if (result && result.ok && result.app) {
      const rawConfig = result.app
      // 规范化配置结构
      const normalizedConfig = {
        ...rawConfig,
        enabled: rawConfig.enabled === true,
        redirectRules: Array.isArray(rawConfig.redirectRules) ? rawConfig.redirectRules : [],
        readOnlyRules: Array.isArray(rawConfig.readOnlyRules) ? rawConfig.readOnlyRules : []
      }
      appConfigs.value[pkg] = normalizedConfig
      return normalizedConfig
    }

    console.log('Failed to get app config from all sources:', result?.error)
    return null
  }

  // 实际执行保存操作
  const doSaveAppConfig = async (pkg, appConfig) => {
    if (isDemoMode.value) {
      demoConfigs[pkg] = JSON.parse(JSON.stringify(appConfig))
      appConfigs.value[pkg] = JSON.parse(JSON.stringify(appConfig))
      ksuApi.toast('保存成功（演示模式）')
      return true
    }

    // 确保配置对象是可序列化的（只保留应用配置相关字段）
    const configToSave = JSON.parse(JSON.stringify(appConfig))
    // 删除监控路径字段（现在存储在单独文件中）
    delete configToSave.monitorPaths

    // 首先尝试通过 daemon 保存
    const result = await callDaemon('app set', {
      pkg,
      app: configToSave
    })
    console.log('Daemon app set result:', JSON.stringify(result))
    if (result && result.ok === true) {
      // 合并到现有配置，而不是替换
      const existingConfig = appConfigs.value[pkg] || {}
      appConfigs.value[pkg] = { ...existingConfig, ...configToSave }
      ksuApi.toast('保存成功')
      return true
    }

    // daemon 保存失败，使用备用方案：直接写入单独的应用配置文件
    console.log('Daemon app set failed, trying direct file write. Result:', result)
    try {
      // 获取内存中的配置
      const memoryConfig = appConfigs.value[pkg] || {}
      console.log('saveAppConfig: memory config for', pkg, ':', JSON.stringify(memoryConfig).substring(0, 200))

      // 合并配置：内存配置 + 新配置
      const mergedConfig = {
        ...memoryConfig,
        ...configToSave
      }

      // 确保所有数组字段都是数组类型（防止 null 值）
      mergedConfig.redirectRules = Array.isArray(mergedConfig.redirectRules) ? mergedConfig.redirectRules : []
      mergedConfig.readOnlyRules = Array.isArray(mergedConfig.readOnlyRules) ? mergedConfig.readOnlyRules : []
      // 删除监控路径（存储在单独文件中）
      delete mergedConfig.monitorPaths

      console.log('saveAppConfig: merged config:', JSON.stringify(mergedConfig).substring(0, 200))

      const success = await writeAppConfigFile(pkg, mergedConfig)
      if (success) {
        // 同时更新内存中的配置
        appConfigs.value[pkg] = mergedConfig
        ksuApi.toast('保存成功')
        return true
      } else {
        ksuApi.toast('保存失败：无法写入配置文件')
        return false
      }
    } catch (e) {
      console.error('Failed to save app config:', e)
      ksuApi.toast('保存失败: ' + e.message)
      return false
    }
  }

  // 处理保存队列
  const processSaveQueue = async () => {
    if (isSaving.value || saveQueue.value.length === 0) return
    
    isSaving.value = true
    
    while (saveQueue.value.length > 0) {
      const { pkg, appConfig, resolve } = saveQueue.value.shift()
      const result = await doSaveAppConfig(pkg, appConfig)
      resolve(result)
    }
    
    isSaving.value = false
  }

  // 保存应用配置（使用队列确保顺序执行）
  const saveAppConfig = async (pkg, appConfig) => {
    return new Promise((resolve) => {
      saveQueue.value.push({ pkg, appConfig, resolve })
      processSaveQueue()
    })
  }

  // 保存全局配置
  const saveGlobalConfig = async (newConfig) => {
    console.log('========== saveGlobalConfig 开始 ==========')
    console.log('【saveGlobalConfig】传入的配置:', JSON.stringify(newConfig, null, 2))
    
    // 确保配置对象是可序列化的
    const configToSave = JSON.parse(JSON.stringify(newConfig))
    console.log('【saveGlobalConfig】序列化后的配置:', JSON.stringify(configToSave, null, 2))

    if (isDemoMode.value) {
      console.log('【saveGlobalConfig】演示模式，直接保存到内存')
      globalConfig.value = configToSave
      ksuApi.toast('保存成功（演示模式）')
      console.log('========== saveGlobalConfig 完成（演示模式）==========')
      return true
    }

    // 首先尝试通过 daemon 保存
    console.log('【saveGlobalConfig】尝试通过 daemon 保存...')
    const result = await callDaemon('global set', { global: configToSave })
    console.log('【saveGlobalConfig】daemon 返回结果:', JSON.stringify(result, null, 2))
    
    if (result && result.ok) {
      console.log('【saveGlobalConfig】daemon 保存成功')
      globalConfig.value = configToSave
      ksuApi.toast('保存成功')
      console.log('========== saveGlobalConfig 完成（daemon）==========')
      return true
    }

    // daemon 保存失败，使用备用方案：直接写入全局配置文件
    console.log('【saveGlobalConfig】daemon 保存失败，使用备用方案:', result?.error)
    try {
      // 提取监控路径（存储在单独文件中）
      const monitorPaths = configToSave.monitorPaths
      const globalWithoutMonitor = { ...configToSave }
      delete globalWithoutMonitor.monitorPaths
      
      console.log('【saveGlobalConfig】保存全局配置（不含监控路径）...')
      const globalSuccess = await writeGlobalConfigFile(globalWithoutMonitor)
      
      // 保存监控路径到单独文件
      let monitorSuccess = true
      if (monitorPaths !== undefined) {
        console.log('【saveGlobalConfig】保存监控路径配置...')
        monitorSuccess = await writeMonitorConfigFile({ paths: monitorPaths })
      }
      
      if (globalSuccess && monitorSuccess) {
        globalConfig.value = configToSave
        ksuApi.toast('保存成功')
        console.log('========== saveGlobalConfig 完成（备用方案）==========')
        return true
      } else {
        ksuApi.toast('保存失败：无法写入配置文件')
        console.log('========== saveGlobalConfig 失败（写入失败）==========')
        return false
      }
    } catch (e) {
      console.error('【saveGlobalConfig】异常:', e)
      ksuApi.toast('保存失败: ' + e.message)
      console.log('========== saveGlobalConfig 失败（异常）==========')
      return false
    }
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
      if (result && result.ok && Array.isArray(result.entries)) {
        return result.entries
      }
    } catch (e) {
      console.log('Daemon log tail failed, trying direct file read:', e)
    }

    // 备用方案：直接读取统一日志文件
    try {
      const logFile = `${LOG_DIR}/access.log`
      // 先检查文件是否存在
      const checkResult = await ksuApi.exec(`[ -f "${logFile}" ] && echo "exists" || echo "not found"`)
      if (checkResult.stdout.trim() !== 'exists') {
        console.log('Log file does not exist:', logFile)
        return []
      }

      const result = await ksuApi.exec(`cat "${logFile}" 2>/dev/null`)
      if (result && result.stdout) {
        // 解析 .jsonl 格式（每行一个 JSON 对象）
        const lines = result.stdout.trim().split('\n').filter(line => line)
        const entries = []
        for (const line of lines) {
          try {
            const entry = JSON.parse(line)
            // 如果指定了包名，进行过滤
            if (!pkg || entry.pkg === pkg) {
              entries.push(entry)
            }
          } catch (e) {
            // 跳过损坏的行
          }
        }
        // 按时间排序并返回最新的 n 条
        entries.sort((a, b) => (b.ts || 0) - (a.ts || 0))
        return entries.slice(0, n)
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

    // 参数验证
    if (!pkg || typeof pkg !== 'string') {
      console.error('Invalid package name for clearAppLogs:', pkg)
      ksuApi.toast('清空失败: 无效的应用包名')
      return false
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

    // 备用方案：直接操作统一日志文件
    try {
      const logFile = `${LOG_DIR}/access.log`

      // 先检查文件是否存在
      const checkResult = await ksuApi.exec(`[ -f "${logFile}" ] && echo "exists" || echo "not found"`)
      if (checkResult.stdout.trim() !== 'exists') {
        // 文件不存在，视为成功
        return true
      }

      // 读取并过滤掉指定包的日志
      const catResult = await ksuApi.exec(`cat "${logFile}" 2>/dev/null`)
      if (catResult && catResult.stdout) {
        const lines = catResult.stdout.trim().split('\n').filter(line => line)
        const remainingLines = []
        for (const line of lines) {
          try {
            const entry = JSON.parse(line)
            if (entry.pkg !== pkg) {
              remainingLines.push(line)
            }
          } catch (e) {
            // 保留无法解析的行
            remainingLines.push(line)
          }
        }

        // 如果没有日志需要保留，直接删除文件
        if (remainingLines.length === 0) {
          const rmResult = await ksuApi.exec(`rm -f "${logFile}"`)
          if (rmResult && rmResult.errno === 0) {
            ksuApi.toast('日志已清空')
            return true
          }
        } else {
          // 写回文件 - 使用 base64 编码避免特殊字符问题
          const newContent = remainingLines.join('\n')
          const base64Content = utf8ToBase64(newContent)
          const tempFile = '/tmp/sr_logs_base64.tmp'
          const escapedBase64 = base64Content.replace(/\$/g, '\\$').replace(/`/g, '\\`')
          const writeResult = await ksuApi.exec(`echo -n "${escapedBase64}" > ${tempFile}`)
          if (writeResult && writeResult.errno === 0) {
            const decodeResult = await ksuApi.exec(`base64 -d ${tempFile} > "${logFile}"`)
            await ksuApi.exec(`rm -f ${tempFile}`)
            if (decodeResult && decodeResult.errno === 0) {
              ksuApi.toast('日志已清空')
              return true
            }
          }
        }
      } else {
        // 文件为空，视为成功
        return true
      }
    } catch (e) {
      console.error('Failed to clear logs:', e)
      ksuApi.toast('清空失败')
    }
    return false
  }

  // 检查 Daemon 状态
  const checkDaemon = async () => {
    console.log('【checkDaemon】开始检查 daemon 状态...')
    
    // 如果已经在演示模式，直接返回
    if (isDemoMode.value) {
      console.log('【checkDaemon】当前处于演示模式')
      daemonStatus.value = { online: true, version: '1.0.0-demo' }
      return true
    }
    
    try {
      // 直接尝试 ping daemon
      console.log('【checkDaemon】尝试 ping daemon...')
      const result = await callDaemon('ping')
      console.log('【checkDaemon】ping 结果:', JSON.stringify(result))
      
      if (result && result.ok) {
        console.log('【checkDaemon】daemon 在线，版本:', result.version)
        daemonStatus.value = {
          online: true,
          version: result?.version || ''
        }
        // 确保退出演示模式
        isDemoMode.value = false
        return true
      } else {
        console.log('【checkDaemon】daemon 返回错误:', result?.error)
      }
    } catch (e) {
      console.error('【checkDaemon】ping 异常:', e)
    }
    
    // ping 失败，检查是否是因为 API 不可用
    console.log('【checkDaemon】检查 KernelSU API 是否可用...')
    const apiAvailable = await checkKsuApiAvailable()
    console.log('【checkDaemon】API 可用性:', apiAvailable)
    
    if (!apiAvailable) {
      // API 不可用，切换到演示模式
      console.log('【checkDaemon】API 不可用，切换到演示模式')
      isDemoMode.value = true
      daemonStatus.value = { online: true, version: '1.0.0-demo' }
      return true
    }
    
    // API 可用但 daemon 不可用
    console.log('【checkDaemon】API 可用但 daemon 不在线')
    daemonStatus.value = { online: false, version: '' }
    return false
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

  // 获取运行中的应用列表
  const getRunningApps = async () => {
    if (isDemoMode.value) {
      runningApps.value = new Set(['com.example.demo', 'com.tencent.mm'])
      return runningApps.value
    }

    try {
      const result = await ksuApi.exec('pm list packages -3 2>/dev/null')
      if (result && result.errno === 0 && result.stdout) {
        const allPackages = result.stdout
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('package:'))
          .map(line => line.replace('package:', ''))

        const running = new Set()
        for (const pkg of allPackages) {
          try {
            const pidResult = await ksuApi.exec(`pidof ${pkg} 2>/dev/null`)
            if (pidResult && pidResult.stdout && pidResult.stdout.trim() !== '') {
              running.add(pkg)
            }
          } catch (e) {
            // 忽略错误
          }
        }
        runningApps.value = running
        return running
      }
    } catch (e) {
      console.error('Failed to get running apps:', e)
    }
    runningApps.value = new Set()
    return runningApps.value
  }

  // 检查单个应用是否在运行
  const isAppRunning = (pkg) => {
    return runningApps.value.has(pkg)
  }

  return {
    apps,
    appConfigs,
    globalConfig,
    loading,
    daemonStatus,
    isDemoMode,
    loadError,
    runningApps,
    appsWithRules,
    appsWithoutRules,
    ksuApi,
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
    writeConfigFile,
    getRunningApps,
    isAppRunning
  }
})
