package main

import (
	"context"
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
	configManager *ConfigManager
	configDir     string
	logDir        string
	socketPath    string
	server        *Server
	logger        *Logger
	ctx           context.Context
	cancel        context.CancelFunc
}

func NewDaemon() (*Daemon, error) {
	ctx, cancel := context.WithCancel(context.Background())

	// 获取环境变量或使用默认值
	modDir := os.Getenv("SR_MODDIR")
	if modDir == "" {
		modDir = "/data/adb/modules/StorageRedirect"
	}

	configDir := os.Getenv("SR_CONFIG_DIR")
	if configDir == "" {
		configDir = filepath.Join(modDir, "config")
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

	// 初始化配置管理器
	configManager, err := NewConfigManager(configDir)
	if err != nil {
		logger.Printf("Warning: failed to init config manager: %v, using default", err)
		configManager, err = NewConfigManager(configDir)
		if err != nil {
			return nil, fmt.Errorf("failed to create config manager: %w", err)
		}
	}

	d := &Daemon{
		configManager: configManager,
		configDir:     configDir,
		logDir:        logDir,
		socketPath:    socketPath,
		logger:        logger,
		ctx:           ctx,
		cancel:        cancel,
	}

	// 创建服务器
	d.server = NewServer(socketPath, d)

	return d, nil
}

func (d *Daemon) Run() error {
	d.logger.Printf("StorageRedirect Daemon v%s starting...", Version)
	d.logger.Printf("Config directory: %s", d.configDir)

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
