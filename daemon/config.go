package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// Config 模块配置结构
type Config struct {
	Version int                   `json:"version"`
	Global  GlobalConfig          `json:"global"`
	Apps    map[string]*AppConfig `json:"apps"`
	mu      sync.RWMutex
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

// AppConfig 单个应用配置
type AppConfig struct {
	Enabled       bool            `json:"enabled"`
	RedirectRules []RedirectRule  `json:"redirectRules"`
	ReadOnlyRules []ReadOnlyRule  `json:"readOnlyRules"`
	MonitorPaths  []MonitorPath   `json:"monitorPaths"`
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

// MonitorPath 监控路径配置
type MonitorPath struct {
	Path string   `json:"path"`
	Ops  []string `json:"ops"`
}

// DefaultConfig 返回默认配置
func DefaultConfig() *Config {
	return &Config{
		Version: 1,
		Global: GlobalConfig{
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
		},
		Apps: make(map[string]*AppConfig),
	}
}

// GetConfig 获取配置副本
func (c *Config) GetConfig() Config {
	c.mu.RLock()
	defer c.mu.RUnlock()

	// 深拷贝
	data, _ := json.Marshal(c)
	var copy Config
	json.Unmarshal(data, &copy)
	return copy
}

// GetAppConfig 获取应用配置
func (c *Config) GetAppConfig(pkg string) (*AppConfig, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	app, ok := c.Apps[pkg]
	if !ok || app == nil {
		return nil, false
	}

	// 返回副本
	data, _ := json.Marshal(app)
	var copy AppConfig
	json.Unmarshal(data, &copy)
	return &copy, true
}

// SetAppConfig 设置应用配置
func (c *Config) SetAppConfig(pkg string, app *AppConfig) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// 验证配置
	if err := validateAppConfig(app); err != nil {
		return err
	}

	c.Apps[pkg] = app
	c.Version++
	return nil
}

// DeleteAppConfig 删除应用配置
func (c *Config) DeleteAppConfig(pkg string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	delete(c.Apps, pkg)
	c.Version++
}

// UpdateGlobal 更新全局配置
func (c *Config) UpdateGlobal(global *GlobalConfig) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// 验证
	if err := validateGlobalConfig(global); err != nil {
		return err
	}

	c.Global = *global
	c.Version++
	return nil
}

// GetVersion 获取配置版本
func (c *Config) GetVersion() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.Version
}

// ListAppsWithRules 返回有规则的应用列表
func (c *Config) ListAppsWithRules() []map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var result []map[string]interface{}
	for pkg, app := range c.Apps {
		if !app.Enabled && len(app.RedirectRules) == 0 && len(app.ReadOnlyRules) == 0 && len(app.MonitorPaths) == 0 {
			continue
		}

		result = append(result, map[string]interface{}{
			"pkg":     pkg,
			"enabled": app.Enabled,
			"counts": map[string]int{
				"redirect": len(app.RedirectRules),
				"readOnly": len(app.ReadOnlyRules),
				"monitor":  len(app.MonitorPaths),
			},
		})
	}
	return result
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

	// 验证监控路径
	for i, mp := range app.MonitorPaths {
		if !isAbsolutePath(mp.Path) {
			return fmt.Errorf("monitorPaths[%d].path must be absolute path", i)
		}
		app.MonitorPaths[i].Path = normalizePath(mp.Path)
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

// SaveToFile 保存配置到文件
func (c *Config) SaveToFile(path string) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}

	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return err
	}

	return os.Rename(tmpPath, path)
}

// LoadFromFile 从文件加载配置
func LoadFromFile(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	config.Apps = make(map[string]*AppConfig)
	// 重新解析以填充 Apps
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}

	if appsData, ok := raw["apps"]; ok {
		var apps map[string]*AppConfig
		if err := json.Unmarshal(appsData, &apps); err != nil {
			return nil, err
		}
		config.Apps = apps
	}

	return &config, nil
}
