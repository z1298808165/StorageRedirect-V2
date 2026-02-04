package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
)

const (
	Version     = "1.0.0"
	DefaultSock = "/data/adb/modules/StorageRedirect/run/ipc.sock"
)

type Daemon struct {
	config     *Config
	configPath string
	logDir     string
	socketPath string
	server     *Server
	logger     *Logger
	ctx        context.Context
	cancel     context.CancelFunc
}

func NewDaemon() (*Daemon, error) {
	ctx, cancel := context.WithCancel(context.Background())

	// 获取环境变量或使用默认值
	modDir := os.Getenv("SR_MODDIR")
	if modDir == "" {
		modDir = "/data/adb/modules/StorageRedirect"
	}

	configPath := os.Getenv("SR_CONFIG")
	if configPath == "" {
		configPath = filepath.Join(modDir, "config", "config.json")
	}

	logDir := os.Getenv("SR_LOGDIR")
	if logDir == "" {
		logDir = filepath.Join(modDir, "logs")
	}

	socketPath := os.Getenv("SR_SOCKET")
	if socketPath == "" {
		socketPath = filepath.Join(modDir, "run", "ipc.sock")
	}

	// 创建日志目录
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create log dir: %w", err)
	}

	// 创建运行目录
	runDir := filepath.Dir(socketPath)
	if err := os.MkdirAll(runDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create run dir: %w", err)
	}

	// 初始化日志系统
	logger, err := NewLogger(logDir)
	if err != nil {
		return nil, fmt.Errorf("failed to init logger: %w", err)
	}

	d := &Daemon{
		configPath: configPath,
		logDir:     logDir,
		socketPath: socketPath,
		logger:     logger,
		ctx:        ctx,
		cancel:     cancel,
	}

	// 加载配置
	if err := d.loadConfig(); err != nil {
		logger.Printf("Warning: failed to load config: %v, using default", err)
		d.config = DefaultConfig()
	}

	// 创建服务器
	d.server = NewServer(socketPath, d)

	return d, nil
}

func (d *Daemon) loadConfig() error {
	data, err := os.ReadFile(d.configPath)
	if err != nil {
		if os.IsNotExist(err) {
			d.config = DefaultConfig()
			return d.saveConfig()
		}
		return err
	}

	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("invalid config: %w", err)
	}

	d.config = &config
	return nil
}

func (d *Daemon) saveConfig() error {
	data, err := json.MarshalIndent(d.config, "", "  ")
	if err != nil {
		return err
	}

	// 写入临时文件后重命名，保证原子性
	tmpPath := d.configPath + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return err
	}

	return os.Rename(tmpPath, d.configPath)
}

func (d *Daemon) Run() error {
	d.logger.Printf("StorageRedirect Daemon v%s starting...", Version)

	// 启动服务器
	go func() {
		if err := d.server.Start(); err != nil {
			d.logger.Printf("Server error: %v", err)
		}
	}()

	// 等待信号
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-sigCh:
		d.logger.Printf("Received signal: %v", sig)
	case <-d.ctx.Done():
	}

	return d.Shutdown()
}

func (d *Daemon) Shutdown() error {
	d.logger.Printf("Shutting down...")
	d.cancel()

	if d.server != nil {
		d.server.Stop()
	}

	if d.logger != nil {
		d.logger.Close()
	}

	return nil
}

func main() {
	daemon, err := NewDaemon()
	if err != nil {
		log.Fatalf("Failed to create daemon: %v", err)
	}

	if err := daemon.Run(); err != nil {
		log.Fatalf("Daemon error: %v", err)
	}
}
