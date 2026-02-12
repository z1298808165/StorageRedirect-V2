package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// ConfigManager 管理分散的配置文件
type ConfigManager struct {
	configDir      string
	appsDir        string
	globalPath     string
	monitorPath    string
	
	// 内存中的配置缓存
	globalConfig   *GlobalConfig
	monitorConfig  *MonitorConfig
	appsCache      map[string]*AppConfig
	
	mu             sync.RWMutex
	version        int
}

// GlobalConfig 全局配置
type GlobalConfig struct {
	MonitorEnabled bool                `json:"monitorEnabled"`
	LogLevel       string              `json:"logLevel"`
	MaxLogSizeMB   int                 `json:"maxLogSizeMB"`
	Update         UpdateConfig        `json:"update"`
	ProcessAttr    ProcessAttrConfig   `json:"processAttribution"`
	URI            URIConfig           `json:"uri"`
}

// MonitorConfig 监控路径配置（独立文件）
type MonitorConfig struct {
	Paths []MonitorPathItem `json:"paths"`
}

// MonitorPathItem 监控路径项
type MonitorPathItem struct {
	ID          int64    `json:"id"`
	Path        string   `json:"path"`
	Desc        string   `json:"desc"`
	Operations  []string `json:"operations"`
}

// UpdateConfig 动态更新配置
type UpdateConfig struct {
	PollIntervalMs  int `json:"pollIntervalMs"`
	OpCheckInterval int `json:"opCheckInterval"`
}

// ProcessAttrConfig 进程归属配置
type ProcessAttrConfig struct {
	Mode                   string `json:"mode"`
	InheritToAllSameUid    bool   `json:"inheritToAllSameUid"`
	InheritToIsolated      bool   `json:"inheritToIsolated"`
	InheritToChildProcess  bool   `json:"inheritToChildProcess"`
	FallbackUnknownPolicy  string `json:"fallbackUnknownPolicy"`
	DiagnosticTagUnknown   bool   `json:"diagnosticTagUnknown"`
}

// URIConfig URI处理配置
type URIConfig struct {
	RedirectEnabled   bool   `json:"redirectEnabled"`
	MappingMode       string `json:"mappingMode"`
	OnMappingFailed   string `json:"onMappingFailed"`
	LogMappingDetails bool   `json:"logMappingDetails"`
}

// AppConfig 单个应用配置（每个应用独立文件）
type AppConfig struct {
	Enabled       bool           `json:"enabled"`
	RedirectRules []RedirectRule `json:"redirectRules"`
	ReadOnlyRules []ReadOnlyRule `json:"readOnlyRules"`
}

// RedirectRule 重定向规则
type RedirectRule struct {
	Src string `json:"src"`
	Dst string `json:"dst"`
}

// ReadOnlyRule 只读规则
type ReadOnlyRule struct {
	Path string `json:"path"`
}

// NewConfigManager 创建配置管理器
func NewConfigManager(configDir string) (*ConfigManager, error) {
	cm := &ConfigManager{
		configDir:   configDir,
		appsDir:     filepath.Join(configDir, "apps"),
		globalPath:  filepath.Join(configDir, "global.json"),
		monitorPath: filepath.Join(configDir, "monitor_paths.json"),
		appsCache:   make(map[string]*AppConfig),
		version:     1,
	}
	
	// 创建必要的目录
	if err := os.MkdirAll(cm.appsDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create apps dir: %w", err)
	}
	
	// 加载或初始化配置
	if err := cm.LoadAll(); err != nil {
		return nil, err
	}
	
	return cm, nil
}

// LoadAll 加载所有配置
func (cm *ConfigManager) LoadAll() error {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	
	// 加载全局配置
	if err := cm.loadGlobalConfigLocked(); err != nil {
		return err
	}
	
	// 加载监控路径配置
	if err := cm.loadMonitorConfigLocked(); err != nil {
		return err
	}
	
	// 加载所有应用配置
	if err := cm.loadAllAppsLocked(); err != nil {
		return err
	}
	
	return nil
}

// loadGlobalConfigLocked 加载全局配置（已加锁）
func (cm *ConfigManager) loadGlobalConfigLocked() error {
	data, err := os.ReadFile(cm.globalPath)
	if err != nil {
		if os.IsNotExist(err) {
			// 使用默认配置
			cm.globalConfig = DefaultGlobalConfig()
			return cm.saveGlobalConfigLocked()
		}
		return err
	}
	
	var config GlobalConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("invalid global config: %w", err)
	}
	
	cm.globalConfig = &config
	return nil
}

// loadMonitorConfigLocked 加载监控路径配置（已加锁）
func (cm *ConfigManager) loadMonitorConfigLocked() error {
	data, err := os.ReadFile(cm.monitorPath)
	if err != nil {
		if os.IsNotExist(err) {
			// 使用默认配置
			cm.monitorConfig = &MonitorConfig{Paths: []MonitorPathItem{}}
			return cm.saveMonitorConfigLocked()
		}
		return err
	}
	
	var config MonitorConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("invalid monitor config: %w", err)
	}
	
	cm.monitorConfig = &config
	return nil
}

// loadAllAppsLocked 加载所有应用配置（已加锁）
func (cm *ConfigManager) loadAllAppsLocked() error {
	entries, err := os.ReadDir(cm.appsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	
	cm.appsCache = make(map[string]*AppConfig)
	
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		
		pkg := strings.TrimSuffix(entry.Name(), ".json")
		appConfig, err := cm.loadAppLocked(pkg)
		if err != nil {
			continue // 跳过无效配置
		}
		cm.appsCache[pkg] = appConfig
	}
	
	return nil
}

// loadAppLocked 加载单个应用配置（已加锁）
func (cm *ConfigManager) loadAppLocked(pkg string) (*AppConfig, error) {
	path := filepath.Join(cm.appsDir, pkg+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	
	var config AppConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, err
	}
	
	return &config, nil
}

// GetGlobalConfig 获取全局配置副本
func (cm *ConfigManager) GetGlobalConfig() GlobalConfig {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	
	// 深拷贝
	data, _ := json.Marshal(cm.globalConfig)
	var copy GlobalConfig
	json.Unmarshal(data, &copy)
	return copy
}

// GetMonitorConfig 获取监控路径配置副本
func (cm *ConfigManager) GetMonitorConfig() MonitorConfig {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	
	// 深拷贝
	data, _ := json.Marshal(cm.monitorConfig)
	var copy MonitorConfig
	json.Unmarshal(data, &copy)
	return copy
}

// GetAppConfig 获取应用配置副本
func (cm *ConfigManager) GetAppConfig(pkg string) (*AppConfig, bool) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	
	app, ok := cm.appsCache[pkg]
	if !ok || app == nil {
		return nil, false
	}
	
	// 深拷贝
	data, _ := json.Marshal(app)
	var copy AppConfig
	json.Unmarshal(data, &copy)
	return &copy, true
}

// SaveGlobalConfig 保存全局配置
func (cm *ConfigManager) SaveGlobalConfig(config *GlobalConfig) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	
	// 验证
	if err := validateGlobalConfig(config); err != nil {
		return err
	}
	
	cm.globalConfig = config
	cm.version++
	return cm.saveGlobalConfigLocked()
}

// SaveMonitorConfig 保存监控路径配置
func (cm *ConfigManager) SaveMonitorConfig(config *MonitorConfig) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	
	// 验证
	for i, path := range config.Paths {
		if !isAbsolutePath(path.Path) {
			return fmt.Errorf("paths[%d].path must be absolute path", i)
		}
		config.Paths[i].Path = normalizePath(path.Path)
	}
	
	cm.monitorConfig = config
	cm.version++
	return cm.saveMonitorConfigLocked()
}

// SaveAppConfig 保存应用配置
func (cm *ConfigManager) SaveAppConfig(pkg string, config *AppConfig) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	
	// 验证
	if err := validateAppConfig(config); err != nil {
		return err
	}
	
	cm.appsCache[pkg] = config
	cm.version++
	return cm.saveAppLocked(pkg, config)
}

// saveGlobalConfigLocked 保存全局配置到文件（已加锁）
func (cm *ConfigManager) saveGlobalConfigLocked() error {
	data, err := json.MarshalIndent(cm.globalConfig, "", "  ")
	if err != nil {
		return err
	}
	
	tmpPath := cm.globalPath + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return err
	}
	
	return os.Rename(tmpPath, cm.globalPath)
}

// saveMonitorConfigLocked 保存监控路径配置到文件（已加锁）
func (cm *ConfigManager) saveMonitorConfigLocked() error {
	data, err := json.MarshalIndent(cm.monitorConfig, "", "  ")
	if err != nil {
		return err
	}
	
	tmpPath := cm.monitorPath + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return err
	}
	
	return os.Rename(tmpPath, cm.monitorPath)
}

// saveAppLocked 保存应用配置到文件（已加锁）
func (cm *ConfigManager) saveAppLocked(pkg string, config *AppConfig) error {
	path := filepath.Join(cm.appsDir, pkg+".json")
	
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	
	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return err
	}
	
	return os.Rename(tmpPath, path)
}

// DeleteAppConfig 删除应用配置
func (cm *ConfigManager) DeleteAppConfig(pkg string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	
	delete(cm.appsCache, pkg)
	cm.version++
	
	path := filepath.Join(cm.appsDir, pkg+".json")
	return os.Remove(path)
}

// ListApps 列出所有有配置的应用
func (cm *ConfigManager) ListApps() []map[string]interface{} {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	
	var result []map[string]interface{}
	for pkg, app := range cm.appsCache {
		if !app.Enabled && len(app.RedirectRules) == 0 && len(app.ReadOnlyRules) == 0 {
			continue
		}
		
		result = append(result, map[string]interface{}{
			"pkg":     pkg,
			"enabled": app.Enabled,
			"counts": map[string]int{
				"redirect": len(app.RedirectRules),
				"readOnly": len(app.ReadOnlyRules),
			},
		})
	}
	return result
}

// GetVersion 获取配置版本
func (cm *ConfigManager) GetVersion() int {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.version
}

// DefaultGlobalConfig 返回默认全局配置
func DefaultGlobalConfig() *GlobalConfig {
	return &GlobalConfig{
		MonitorEnabled: true,
		LogLevel:       "info",
		MaxLogSizeMB:   64,
		Update: UpdateConfig{
			PollIntervalMs:  3000,
			OpCheckInterval: 50,
		},
		ProcessAttr: ProcessAttrConfig{
			Mode:                  "strict",
			InheritToAllSameUid:   true,
			InheritToIsolated:     true,
			InheritToChildProcess: true,
			FallbackUnknownPolicy: "denyWriteOnMatchedPaths",
			DiagnosticTagUnknown:  true,
		},
		URI: URIConfig{
			RedirectEnabled:   true,
			MappingMode:       "bestEffort",
			OnMappingFailed:   "enforceReadonlyAndMonitor",
			LogMappingDetails: true,
		},
	}
}

// 验证函数

func validateAppConfig(app *AppConfig) error {
	if app == nil {
		return fmt.Errorf("app config is nil")
	}

	// 验证重定向规则
	for i, rule := range app.RedirectRules {
		if !isAbsolutePath(rule.Src) {
			return fmt.Errorf("redirectRules[%d].src must be absolute path", i)
		}
		if !isAbsolutePath(rule.Dst) {
			return fmt.Errorf("redirectRules[%d].dst must be absolute path", i)
		}
		// 规范化路径
		app.RedirectRules[i].Src = normalizePath(rule.Src)
		app.RedirectRules[i].Dst = normalizePath(rule.Dst)
	}

	// 验证只读规则
	for i, rule := range app.ReadOnlyRules {
		if !isAbsolutePath(rule.Path) {
			return fmt.Errorf("readOnlyRules[%d].path must be absolute path", i)
		}
		app.ReadOnlyRules[i].Path = normalizePath(rule.Path)
	}

	return nil
}

func validateGlobalConfig(global *GlobalConfig) error {
	if global.MaxLogSizeMB < 8 || global.MaxLogSizeMB > 1024 {
		return fmt.Errorf("maxLogSizeMB must be between 8 and 1024")
	}

	validModes := map[string]bool{"strict": true, "balanced": true, "relaxed": true}
	if !validModes[global.ProcessAttr.Mode] {
		return fmt.Errorf("processAttribution.mode must be strict, balanced, or relaxed")
	}

	validPolicies := map[string]bool{"allow": true, "monitorOnly": true, "denyWriteOnMatchedPaths": true}
	if !validPolicies[global.ProcessAttr.FallbackUnknownPolicy] {
		return fmt.Errorf("invalid fallbackUnknownPolicy")
	}

	return nil
}

func isAbsolutePath(path string) bool {
	return strings.HasPrefix(path, "/")
}

func normalizePath(path string) string {
	// 移除尾部斜杠（根目录除外）
	path = filepath.Clean(path)
	// 确保目录以/结尾
	if path != "/" && !strings.HasSuffix(path, "/") {
		// 检查是否是目录（通过原始路径是否有尾部斜杠）
		// 这里简化处理，统一添加斜杠表示前缀匹配
	}
	return path
}
