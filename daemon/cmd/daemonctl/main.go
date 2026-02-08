package main

import (
	"bufio"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

const (
	DefaultSocket = "/data/adb/modules/StorageRedirect/run/ipc.sock"
)

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

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(2)
	}

	cmd := os.Args[1]

	// 获取 socket 路径
	socketPath := os.Getenv("SR_SOCKET")
	if socketPath == "" {
		socketPath = DefaultSocket
	}

	// 检查 daemon 是否运行
	if cmd != "ping" {
		if _, err := os.Stat(socketPath); os.IsNotExist(err) {
			printError("E_DAEMON_UNREACHABLE", "无法连接 daemon（socket 不可达）", "", "检查模块 service 是否运行，或执行 daemonctl ping")
			os.Exit(10)
		}
	}

	var resp *Response
	var err error

	switch cmd {
	case "ping":
		resp, err = sendCommand(socketPath, "ping", nil)
	case "status":
		resp, err = sendCommand(socketPath, "status", nil)
	case "global", "g":
		resp, err = handleGlobalCmd(socketPath, os.Args[2:])
	case "monitor", "m":
		resp, err = handleMonitorCmd(socketPath, os.Args[2:])
	case "app", "a":
		resp, err = handleAppCmd(socketPath, os.Args[2:])
	case "log", "l":
		resp, err = handleLogCmd(socketPath, os.Args[2:])
	case "diag", "d":
		resp, err = handleDiagCmd(socketPath, os.Args[2:])
	default:
		fmt.Fprintf(os.Stderr, "未知命令: %s\n", cmd)
		printUsage()
		os.Exit(2)
	}

	if err != nil {
		printError("E_INTERNAL", err.Error(), "", "")
		os.Exit(1)
	}

	if resp.Error != nil {
		printError(resp.Error.Code, resp.Error.Message, resp.Error.Field, resp.Error.Hint)
		os.Exit(getExitCode(resp.Error.Code))
	}

	// 输出结果 - 输出完整的响应对象，包含 ok 和 data 字段
	output, _ := json.MarshalIndent(resp, "", "  ")
	fmt.Println(string(output))
}

func handleMonitorCmd(socketPath string, args []string) (*Response, error) {
	if len(args) < 1 {
		fmt.Fprintf(os.Stderr, "用法: daemonctl monitor <get|set> [--json '<json>'] [--json-base64 '<base64>']\n")
		os.Exit(2)
	}

	subCmd := args[0]
	params := make(map[string]interface{})

	// 解析参数
	for i := 1; i < len(args); i++ {
		switch args[i] {
		case "--json", "-j":
			if i+1 < len(args) {
				var monitor map[string]interface{}
				if err := json.Unmarshal([]byte(args[i+1]), &monitor); err != nil {
					return nil, fmt.Errorf("invalid JSON: %w", err)
				}
				params["monitor"] = monitor
				i++
			}
		case "--json-base64":
			if i+1 < len(args) {
				jsonBytes, err := base64.StdEncoding.DecodeString(args[i+1])
				if err != nil {
					return nil, fmt.Errorf("invalid base64: %w", err)
				}
				var monitor map[string]interface{}
				if err := json.Unmarshal(jsonBytes, &monitor); err != nil {
					return nil, fmt.Errorf("invalid JSON: %w", err)
				}
				params["monitor"] = monitor
				i++
			}
		}
	}

	switch subCmd {
	case "get":
		return sendCommand(socketPath, "monitor.get", nil)
	case "set":
		if params["monitor"] == nil {
			fmt.Fprintf(os.Stderr, "缺少 --json 或 --json-base64 参数\n")
			os.Exit(2)
		}
		return sendCommand(socketPath, "monitor.set", params)
	default:
		fmt.Fprintf(os.Stderr, "未知子命令: %s\n", subCmd)
		os.Exit(2)
	}
	return nil, nil
}

func handleGlobalCmd(socketPath string, args []string) (*Response, error) {
	if len(args) < 1 {
		fmt.Fprintf(os.Stderr, "用法: daemonctl global <get|set> [--json '<json>'] [--json-base64 '<base64>']\n")
		os.Exit(2)
	}

	subCmd := args[0]
	params := make(map[string]interface{})

	// 解析参数
	for i := 1; i < len(args); i++ {
		switch args[i] {
		case "--json", "-j":
			if i+1 < len(args) {
				var global map[string]interface{}
				if err := json.Unmarshal([]byte(args[i+1]), &global); err != nil {
					return nil, fmt.Errorf("invalid JSON: %w", err)
				}
				params["global"] = global
				i++
			}
		case "--json-base64":
			if i+1 < len(args) {
				jsonBytes, err := base64.StdEncoding.DecodeString(args[i+1])
				if err != nil {
					return nil, fmt.Errorf("invalid base64: %w", err)
				}
				var global map[string]interface{}
				if err := json.Unmarshal(jsonBytes, &global); err != nil {
					return nil, fmt.Errorf("invalid JSON: %w", err)
				}
				params["global"] = global
				i++
			}
		}
	}

	switch subCmd {
	case "get":
		return sendCommand(socketPath, "global.get", nil)
	case "set":
		if params["global"] == nil {
			fmt.Fprintf(os.Stderr, "缺少 --json 或 --json-base64 参数\n")
			os.Exit(2)
		}
		return sendCommand(socketPath, "global.set", params)
	default:
		fmt.Fprintf(os.Stderr, "未知子命令: %s\n", subCmd)
		os.Exit(2)
	}
	return nil, nil
}

func handleAppCmd(socketPath string, args []string) (*Response, error) {
	if len(args) < 1 {
		fmt.Fprintf(os.Stderr, "用法: daemonctl app <get|set|list|delete> [--pkg <package>] [--json '<json>'] [--json-base64 '<base64>']\n")
		os.Exit(2)
	}

	subCmd := args[0]
	params := make(map[string]interface{})

	// 解析参数
	for i := 1; i < len(args); i++ {
		switch args[i] {
		case "--pkg", "-p":
			if i+1 < len(args) {
				params["pkg"] = args[i+1]
				i++
			}
		case "--json", "-j":
			if i+1 < len(args) {
				var app map[string]interface{}
				if err := json.Unmarshal([]byte(args[i+1]), &app); err != nil {
					return nil, fmt.Errorf("invalid JSON: %w", err)
				}
				params["app"] = app
				i++
			}
		case "--json-base64":
			if i+1 < len(args) {
				jsonBytes, err := base64.StdEncoding.DecodeString(args[i+1])
				if err != nil {
					return nil, fmt.Errorf("invalid base64: %w", err)
				}
				var app map[string]interface{}
				if err := json.Unmarshal(jsonBytes, &app); err != nil {
					return nil, fmt.Errorf("invalid JSON: %w", err)
				}
				params["app"] = app
				i++
			}
		}
	}

	switch subCmd {
	case "get":
		if params["pkg"] == nil {
			fmt.Fprintf(os.Stderr, "缺少 --pkg 参数\n")
			os.Exit(2)
		}
		return sendCommand(socketPath, "app.get", params)
	case "set":
		if params["pkg"] == nil {
			fmt.Fprintf(os.Stderr, "缺少 --pkg 参数\n")
			os.Exit(2)
		}
		if params["app"] == nil {
			fmt.Fprintf(os.Stderr, "缺少 --json 参数\n")
			os.Exit(2)
		}
		return sendCommand(socketPath, "app.set", params)
	case "list":
		return sendCommand(socketPath, "app.list", nil)
	case "delete":
		if params["pkg"] == nil {
			fmt.Fprintf(os.Stderr, "缺少 --pkg 参数\n")
			os.Exit(2)
		}
		return sendCommand(socketPath, "app.delete", params)
	default:
		fmt.Fprintf(os.Stderr, "未知子命令: %s\n", subCmd)
		os.Exit(2)
	}
	return nil, nil
}

func handleLogCmd(socketPath string, args []string) (*Response, error) {
	if len(args) < 1 {
		fmt.Fprintf(os.Stderr, "用法: daemonctl log <tail|query|clear|stats> [--pkg <package>] [options]\n")
		os.Exit(2)
	}

	subCmd := args[0]
	params := make(map[string]interface{})

	// 解析参数
	for i := 1; i < len(args); i++ {
		switch args[i] {
		case "--pkg", "-p":
			if i+1 < len(args) {
				params["pkg"] = args[i+1]
				i++
			}
		case "--n":
			if i+1 < len(args) {
				n, _ := strconv.Atoi(args[i+1])
				params["n"] = n
				i++
			}
		case "--from":
			if i+1 < len(args) {
				t, _ := strconv.ParseInt(args[i+1], 10, 64)
				params["from"] = t
				i++
			}
		case "--to":
			if i+1 < len(args) {
				t, _ := strconv.ParseInt(args[i+1], 10, 64)
				params["to"] = t
				i++
			}
		case "--limit":
			if i+1 < len(args) {
				n, _ := strconv.Atoi(args[i+1])
				params["limit"] = n
				i++
			}
		case "--offset":
			if i+1 < len(args) {
				n, _ := strconv.Atoi(args[i+1])
				params["offset"] = n
				i++
			}
		case "--ops":
			if i+1 < len(args) {
				params["ops"] = []string{args[i+1]}
				i++
			}
		case "--contains":
			if i+1 < len(args) {
				params["contains"] = args[i+1]
				i++
			}
		}
	}

	switch subCmd {
	case "tail":
		if params["pkg"] == nil {
			fmt.Fprintf(os.Stderr, "缺少 --pkg 参数\n")
			os.Exit(2)
		}
		if params["n"] == nil {
			params["n"] = 10
		}
		return sendCommand(socketPath, "log.tail", params)
	case "query":
		if params["pkg"] == nil {
			fmt.Fprintf(os.Stderr, "缺少 --pkg 参数\n")
			os.Exit(2)
		}
		if params["limit"] == nil {
			params["limit"] = 100
		}
		return sendCommand(socketPath, "log.query", params)
	case "clear":
		if params["pkg"] == nil {
			fmt.Fprintf(os.Stderr, "缺少 --pkg 参数\n")
			os.Exit(2)
		}
		return sendCommand(socketPath, "log.clear", params)
	case "stats":
		return sendCommand(socketPath, "log.stats", nil)
	default:
		fmt.Fprintf(os.Stderr, "未知子命令: %s\n", subCmd)
		os.Exit(2)
	}
	return nil, nil
}

func handleDiagCmd(socketPath string, args []string) (*Response, error) {
	if len(args) < 1 {
		fmt.Fprintf(os.Stderr, "用法: daemonctl diag <whoami> [--pid <pid>]\n")
		os.Exit(2)
	}

	subCmd := args[0]
	params := make(map[string]interface{})

	for i := 1; i < len(args); i++ {
		switch args[i] {
		case "--pid":
			if i+1 < len(args) {
				pid, _ := strconv.Atoi(args[i+1])
				params["pid"] = pid
				i++
			}
		}
	}

	switch subCmd {
	case "whoami":
		return sendCommand(socketPath, "diag.whoami", params)
	default:
		fmt.Fprintf(os.Stderr, "未知子命令: %s\n", subCmd)
		os.Exit(2)
	}
	return nil, nil
}

func sendCommand(socketPath, cmd string, params map[string]interface{}) (*Response, error) {
	// 构建请求
	req := map[string]interface{}{
		"cmd": cmd,
	}
	if params != nil {
		req["params"] = params
	}

	reqData, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	// 连接 socket
	conn, err := net.Dial("unix", socketPath)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	// 设置超时
	conn.SetDeadline(time.Now().Add(10 * time.Second))

	// 发送请求
	writer := bufio.NewWriter(conn)
	writer.Write(reqData)
	writer.WriteByte('\n')
	writer.Flush()

	// 读取响应
	reader := bufio.NewReader(conn)
	respData, err := reader.ReadString('\n')
	if err != nil {
		return nil, err
	}

	var resp Response
	if err := json.Unmarshal([]byte(respData), &resp); err != nil {
		return nil, err
	}

	return &resp, nil
}

func printUsage() {
	fmt.Println("StorageRedirect Daemon Control")
	fmt.Println()
	fmt.Println("用法: daemonctl <command> [options]")
	fmt.Println()
	fmt.Println("命令:")
	fmt.Println("  ping                    检查 daemon 状态")
	fmt.Println("  status                  获取详细状态")
	fmt.Println("  global <get|set>        全局配置管理")
	fmt.Println("  monitor <get|set>       监控路径配置管理")
	fmt.Println("  app <get|set|list|delete> [--pkg <pkg>] [--json '<json>']  应用配置管理")
	fmt.Println("  log <tail|query|clear|stats> [--pkg <pkg>]  日志管理")
	fmt.Println("  diag whoami [--pid <pid>]  诊断工具")
	fmt.Println()
	fmt.Println("示例:")
	fmt.Println("  daemonctl ping")
	fmt.Println("  daemonctl app get --pkg com.example.app")
	fmt.Println("  daemonctl app set --pkg com.example.app --json '{\"enabled\":true,\"redirectRules\":[]}'")
	fmt.Println("  daemonctl monitor get")
	fmt.Println("  daemonctl log tail --pkg com.example.app --n 20")
}

func printError(code, message, field, hint string) {
	err := map[string]interface{}{
		"ok": false,
		"error": map[string]string{
			"code":    code,
			"message": message,
			"field":   field,
			"hint":    hint,
		},
	}
	data, _ := json.MarshalIndent(err, "", "  ")
	fmt.Fprintln(os.Stderr, string(data))
}

func getExitCode(code string) int {
	switch code {
	case "E_ARG":
		return 2
	case "E_CFG_VALIDATION":
		return 3
	case "E_NOT_FOUND":
		return 4
	case "E_CFG_WRITE", "E_LOG_IO":
		return 5
	case "E_DAEMON_UNREACHABLE":
		return 10
	case "E_IPC_TIMEOUT":
		return 11
	case "E_IPC_PROTOCOL":
		return 11
	default:
		return 1
	}
}

// getModDir 获取模块目录
func getModDir() string {
	modDir := os.Getenv("SR_MODDIR")
	if modDir != "" {
		return modDir
	}
	return "/data/adb/modules/StorageRedirect"
}

// getSocketPath 获取 socket 路径
func getSocketPath() string {
	socket := os.Getenv("SR_SOCKET")
	if socket != "" {
		return socket
	}
	return filepath.Join(getModDir(), "run", "ipc.sock")
}
