package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Server Unix Domain Socket 服务器
type Server struct {
	socketPath string
	daemon     *Daemon
	listener   net.Listener
	wg         sync.WaitGroup
	stopCh     chan struct{}
}

// NewServer 创建服务器
func NewServer(socketPath string, daemon *Daemon) *Server {
	return &Server{
		socketPath: socketPath,
		daemon:     daemon,
		stopCh:     make(chan struct{}),
	}
}

// Start 启动服务器
func (s *Server) Start() error {
	// 删除已存在的 socket 文件
	os.Remove(s.socketPath)

	listener, err := net.Listen("unix", s.socketPath)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %w", s.socketPath, err)
	}
	s.listener = listener

	// 设置权限
	os.Chmod(s.socketPath, 0666)

	s.daemon.logger.Printf("Server listening on %s", s.socketPath)

	go s.acceptLoop()
	return nil
}

// Stop 停止服务器
func (s *Server) Stop() {
	close(s.stopCh)
	if s.listener != nil {
		s.listener.Close()
	}
	s.wg.Wait()
}

func (s *Server) acceptLoop() {
	for {
		select {
		case <-s.stopCh:
			return
		default:
		}

		conn, err := s.listener.Accept()
		if err != nil {
			select {
			case <-s.stopCh:
				return
			default:
				s.daemon.logger.Printf("Accept error: %v", err)
				continue
			}
		}

		s.wg.Add(1)
		go s.handleConnection(conn)
	}
}

func (s *Server) handleConnection(conn net.Conn) {
	defer s.wg.Done()
	defer conn.Close()

	reader := bufio.NewReader(conn)
	writer := bufio.NewWriter(conn)

	for {
		// 设置读取超时
		conn.SetReadDeadline(time.Now().Add(30 * time.Second))

		line, err := reader.ReadString('\n')
		if err != nil {
			return
		}

		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// 解析请求
		var req Request
		if err := json.Unmarshal([]byte(line), &req); err != nil {
			s.writeError(writer, "E_IPC_PROTOCOL", "Invalid request format", "")
			continue
		}

		// 处理请求
		resp := s.handleRequest(&req)

		// 发送响应
		data, _ := json.Marshal(resp)
		writer.Write(data)
		writer.WriteByte('\n')
		writer.Flush()
	}
}

// Request IPC请求
type Request struct {
	Cmd    string          `json:"cmd"`
	Params json.RawMessage `json:"params,omitempty"`
}

// Response IPC响应
type Response struct {
	Ok    bool                   `json:"ok"`
	Data  map[string]interface{} `json:"data,omitempty"`
	Error *ErrorInfo             `json:"error,omitempty"`
}

// ErrorInfo 错误信息
type ErrorInfo struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Field   string `json:"field,omitempty"`
	Hint    string `json:"hint,omitempty"`
}

func (s *Server) writeError(writer *bufio.Writer, code, message, field string) {
	resp := Response{
		Ok: false,
		Error: &ErrorInfo{
			Code:    code,
			Message: message,
			Field:   field,
		},
	}
	data, _ := json.Marshal(resp)
	writer.Write(data)
	writer.WriteByte('\n')
	writer.Flush()
}

func (s *Server) handleRequest(req *Request) Response {
	switch req.Cmd {
	case "ping":
		return s.handlePing()
	case "status":
		return s.handleStatus()
	case "global.get":
		return s.handleGlobalGet()
	case "global.set":
		return s.handleGlobalSet(req.Params)
	case "monitor.get":
		return s.handleMonitorGet()
	case "monitor.set":
		return s.handleMonitorSet(req.Params)
	case "app.get":
		return s.handleAppGet(req.Params)
	case "app.set":
		return s.handleAppSet(req.Params)
	case "app.list":
		return s.handleAppList()
	case "app.delete":
		return s.handleAppDelete(req.Params)
	case "log.tail":
		return s.handleLogTail(req.Params)
	case "log.query":
		return s.handleLogQuery(req.Params)
	case "log.clear":
		return s.handleLogClear(req.Params)
	case "log.stats":
		return s.handleLogStats()
	case "diag.whoami":
		return s.handleDiagWhoami(req.Params)
	default:
		return Response{
			Ok: false,
			Error: &ErrorInfo{
				Code:    "E_ARG",
				Message: "Unknown command: " + req.Cmd,
			},
		}
	}
}

func (s *Server) handlePing() Response {
	return Response{
		Ok: true,
		Data: map[string]interface{}{
			"version":       Version,
			"pid":           os.Getpid(),
			"uptimeMs":      time.Since(time.Now().Add(-time.Minute)).Milliseconds(), // 简化处理
			"configVersion": s.daemon.configManager.GetVersion(),
		},
	}
}

func (s *Server) handleStatus() Response {
	stats := s.daemon.logger.GetStats()

	return Response{
		Ok: true,
		Data: map[string]interface{}{
			"daemon": map[string]interface{}{
				"pid":       os.Getpid(),
				"startedAt": time.Now().Add(-time.Minute).UnixMilli(), // 简化
				"version":   Version,
			},
			"config": map[string]interface{}{
				"configDir":     s.daemon.configDir,
				"version":       s.daemon.configManager.GetVersion(),
				"lastLoadedAt":  time.Now().UnixMilli(),
			},
			"runtime": map[string]interface{}{
				"socket": map[string]interface{}{
					"path":      s.socketPath,
					"listening": s.listener != nil,
				},
			},
			"logs": stats,
		},
	}
}

func (s *Server) handleGlobalGet() Response {
	config := s.daemon.configManager.GetGlobalConfig()
	return Response{
		Ok: true,
		Data: map[string]interface{}{
			"global":        config,
			"configVersion": s.daemon.configManager.GetVersion(),
		},
	}
}

func (s *Server) handleGlobalSet(params json.RawMessage) Response {
	var req struct {
		Global *GlobalConfig `json:"global"`
	}
	if err := json.Unmarshal(params, &req); err != nil {
		return Response{
			Ok: false,
			Error: &ErrorInfo{
				Code:    "E_ARG",
				Message: "Invalid parameters",
			},
		}
	}

	if err := s.daemon.configManager.SaveGlobalConfig(req.Global); err != nil {
		return Response{
			Ok: false,
			Error: &ErrorInfo{
				Code:    "E_CFG_VALIDATION",
				Message: err.Error(),
			},
		}
	}

	return Response{
		Ok: true,
		Data: map[string]interface{}{
			"configVersion": s.daemon.configManager.GetVersion(),
		},
	}
}

func (s *Server) handleMonitorGet() Response {
	config := s.daemon.configManager.GetMonitorConfig()
	return Response{
		Ok: true,
		Data: map[string]interface{}{
			"monitor":       config,
			"configVersion": s.daemon.configManager.GetVersion(),
		},
	}
}

func (s *Server) handleMonitorSet(params json.RawMessage) Response {
	var req struct {
		Monitor *MonitorConfig `json:"monitor"`
	}
	if err := json.Unmarshal(params, &req); err != nil {
		return Response{
			Ok: false,
			Error: &ErrorInfo{
				Code:    "E_ARG",
				Message: "Invalid parameters",
			},
		}
	}

	if err := s.daemon.configManager.SaveMonitorConfig(req.Monitor); err != nil {
		return Response{
			Ok: false,
			Error: &ErrorInfo{
				Code:    "E_CFG_VALIDATION",
				Message: err.Error(),
			},
		}
	}

	return Response{
		Ok: true,
		Data: map[string]interface{}{
			"configVersion": s.daemon.configManager.GetVersion(),
		},
	}
}

func (s *Server) handleAppGet(params json.RawMessage) Response {
	var req struct {
		Pkg string `json:"pkg"`
	}
	if err := json.Unmarshal(params, &req); err != nil || req.Pkg == "" {
		return Response{
			Ok: false,
			Error: &ErrorInfo{
				Code:    "E_ARG",
				Message: "Missing pkg parameter",
			},
		}
	}

	app, ok := s.daemon.configManager.GetAppConfig(req.Pkg)
	if !ok {
		return Response{
			Ok: false,
			Error: &ErrorInfo{
				Code:    "E_NOT_FOUND",
				Message: "App not found: " + req.Pkg,
			},
		}
	}

	return Response{
		Ok: true,
		Data: map[string]interface{}{
			"pkg": req.Pkg,
			"app": app,
			"counts": map[string]int{
				"redirect": len(app.RedirectRules),
				"readOnly": len(app.ReadOnlyRules),
			},
			"configVersion": s.daemon.configManager.GetVersion(),
		},
	}
}

func (s *Server) handleAppSet(params json.RawMessage) Response {
	var req struct {
		Pkg string     `json:"pkg"`
		App *AppConfig `json:"app"`
	}
	if err := json.Unmarshal(params, &req); err != nil || req.Pkg == "" {
		return Response{
			Ok: false,
			Error: &ErrorInfo{
				Code:    "E_ARG",
				Message: "Missing pkg or app parameter",
			},
		}
	}

	if err := s.daemon.configManager.SaveAppConfig(req.Pkg, req.App); err != nil {
		return Response{
			Ok: false,
			Error: &ErrorInfo{
				Code:    "E_CFG_VALIDATION",
				Message: err.Error(),
				Field:   "app",
			},
		}
	}

	return Response{
		Ok: true,
		Data: map[string]interface{}{
			"configVersion": s.daemon.configManager.GetVersion(),
		},
	}
}

func (s *Server) handleAppList() Response {
	apps := s.daemon.configManager.ListApps()
	return Response{
		Ok: true,
		Data: map[string]interface{}{
			"apps":          apps,
			"configVersion": s.daemon.configManager.GetVersion(),
		},
	}
}

func (s *Server) handleAppDelete(params json.RawMessage) Response {
	var req struct {
		Pkg string `json:"pkg"`
	}
	if err := json.Unmarshal(params, &req); err != nil || req.Pkg == "" {
		return Response{
			Ok: false,
			Error: &ErrorInfo{
				Code:    "E_ARG",
				Message: "Missing pkg parameter",
			},
		}
	}

	if err := s.daemon.configManager.DeleteAppConfig(req.Pkg); err != nil {
		return Response{
			Ok: false,
			Error: &ErrorInfo{
				Code:    "E_CFG_WRITE",
				Message: err.Error(),
			},
		}
	}

	return Response{
		Ok: true,
		Data: map[string]interface{}{
			"configVersion": s.daemon.configManager.GetVersion(),
		},
	}
}

func (s *Server) handleLogTail(params json.RawMessage) Response {
	var req struct {
		Pkg string `json:"pkg"`
		N   int    `json:"n"`
	}
	if err := json.Unmarshal(params, &req); err != nil || req.Pkg == "" {
		return Response{
			Ok: false,
			Error: &ErrorInfo{
				Code:    "E_ARG",
				Message: "Missing pkg parameter",
			},
		}
	}

	if req.N <= 0 {
		req.N = 10
	}
	if req.N > 1000 {
		req.N = 1000
	}

	entries, err := s.daemon.logger.Tail(req.Pkg, req.N)
	if err != nil {
		return Response{
			Ok: false,
			Error: &ErrorInfo{
				Code:    "E_LOG_IO",
				Message: err.Error(),
			},
		}
	}

	return Response{
		Ok: true,
		Data: map[string]interface{}{
			"pkg":     req.Pkg,
			"entries": entries,
		},
	}
}

func (s *Server) handleLogQuery(params json.RawMessage) Response {
	var req struct {
		Pkg      string   `json:"pkg"`
		From     int64    `json:"from"`
		To       int64    `json:"to"`
		Ops      []string `json:"ops"`
		Contains string   `json:"contains"`
		Limit    int      `json:"limit"`
		Offset   int      `json:"offset"`
	}
	if err := json.Unmarshal(params, &req); err != nil || req.Pkg == "" {
		return Response{
			Ok: false,
			Error: &ErrorInfo{
				Code:    "E_ARG",
				Message: "Missing pkg parameter",
			},
		}
	}

	if req.Limit <= 0 {
		req.Limit = 100
	}
	if req.Limit > 1000 {
		req.Limit = 1000
	}

	entries, total, err := s.daemon.logger.Query(req.Pkg, req.From, req.To, req.Ops, req.Contains, req.Limit, req.Offset)
	if err != nil {
		return Response{
			Ok: false,
			Error: &ErrorInfo{
				Code:    "E_LOG_IO",
				Message: err.Error(),
			},
		}
	}

	nextOffset := req.Offset + len(entries)
	if nextOffset >= total {
		nextOffset = -1
	}

	return Response{
		Ok: true,
		Data: map[string]interface{}{
			"pkg":        req.Pkg,
			"entries":    entries,
			"total":      total,
			"nextOffset": nextOffset,
		},
	}
}

func (s *Server) handleLogClear(params json.RawMessage) Response {
	var req struct {
		Pkg string `json:"pkg"`
	}
	if err := json.Unmarshal(params, &req); err != nil || req.Pkg == "" {
		return Response{
			Ok: false,
			Error: &ErrorInfo{
				Code:    "E_ARG",
				Message: "Missing pkg parameter",
			},
		}
	}

	if err := s.daemon.logger.Clear(req.Pkg); err != nil {
		return Response{
			Ok: false,
			Error: &ErrorInfo{
				Code:    "E_LOG_IO",
				Message: err.Error(),
			},
		}
	}

	return Response{
		Ok: true,
	}
}

func (s *Server) handleLogStats() Response {
	stats := s.daemon.logger.GetStats()
	return Response{
		Ok: true,
		Data: stats,
	}
}

func (s *Server) handleDiagWhoami(params json.RawMessage) Response {
	var req struct {
		Pid int `json:"pid"`
	}
	json.Unmarshal(params, &req)

	if req.Pid <= 0 {
		req.Pid = os.Getpid()
	}

	// 简化实现，实际应该查询进程信息
	return Response{
		Ok: true,
		Data: map[string]interface{}{
			"pid": req.Pid,
			"uid": os.Getuid(),
			"resolved": map[string]interface{}{
				"packageName":      "",
				"isIsolated":       false,
				"resolutionReason": "UNKNOWN",
				"ruleSetVersion":   s.daemon.configManager.GetVersion(),
			},
		},
	}
}

// parseInt 辅助函数
func parseInt(s string) int {
	i, _ := strconv.Atoi(s)
	return i
}
