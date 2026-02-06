package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// LogEntry 日志条目
type LogEntry struct {
	Ts       int64                  `json:"ts"`
	Pkg      string                 `json:"pkg"`
	Proc     string                 `json:"proc"`
	Pid      int                    `json:"pid"`
	Tid      int                    `json:"tid"`
	Uid      int                    `json:"uid"`
	Op       string                 `json:"op"`
	Path     string                 `json:"path"`
	URI      string                 `json:"uri,omitempty"`
	Mapped   string                 `json:"mapped,omitempty"`
	Decision string                 `json:"decision"`
	Rule     map[string]interface{} `json:"rule,omitempty"`
	Result   string                 `json:"result"`
	Errno    *int                   `json:"errno,omitempty"`
	Map      *MapInfo               `json:"map,omitempty"`
	Extra    map[string]interface{} `json:"extra,omitempty"`
}

// MapInfo URI映射信息
type MapInfo struct {
	Status string `json:"status"`
	Method string `json:"method,omitempty"`
	Detail string `json:"detail,omitempty"`
}

// Logger 日志管理器
type Logger struct {
	baseDir      string
	logFile      string
	maxSizeBytes int64
	mu           sync.Mutex
	buffer       []LogEntry
	lastFlush    time.Time
}

// NewLogger 创建日志管理器
func NewLogger(baseDir string) (*Logger, error) {
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, err
	}

	// 统一日志文件路径
	logFile := filepath.Join(baseDir, "access.log")

	return &Logger{
		baseDir:      baseDir,
		logFile:      logFile,
		maxSizeBytes: 64 * 1024 * 1024, // 默认64MB
		buffer:       make([]LogEntry, 0, 100),
		lastFlush:    time.Now(),
	}, nil
}

// SetMaxSize 设置最大日志大小
func (l *Logger) SetMaxSize(mb int) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.maxSizeBytes = int64(mb) * 1024 * 1024
}

// Write 写入日志条目
func (l *Logger) Write(entry *LogEntry) error {
	if entry.Ts == 0 {
		entry.Ts = time.Now().UnixMilli()
	}

	l.mu.Lock()
	l.buffer = append(l.buffer, *entry)
	shouldFlush := len(l.buffer) >= 100 || time.Since(l.lastFlush) > 5*time.Second
	l.mu.Unlock()

	if shouldFlush {
		return l.Flush()
	}

	return nil
}

// Flush 刷新日志到文件
func (l *Logger) Flush() error {
	l.mu.Lock()
	if len(l.buffer) == 0 {
		l.mu.Unlock()
		return nil
	}

	entries := make([]LogEntry, len(l.buffer))
	copy(entries, l.buffer)
	l.buffer = l.buffer[:0]
	l.lastFlush = time.Now()
	l.mu.Unlock()

	return l.writeToFile(entries)
}

// FlushAll 刷新所有日志（兼容旧接口）
func (l *Logger) FlushAll() error {
	return l.Flush()
}

func (l *Logger) writeToFile(entries []LogEntry) error {
	f, err := os.OpenFile(l.logFile, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	w := bufio.NewWriter(f)
	for _, entry := range entries {
		data, err := json.Marshal(entry)
		if err != nil {
			continue
		}
		w.Write(data)
		w.WriteByte('\n')
	}

	return w.Flush()
}

// Query 查询日志
func (l *Logger) Query(pkg string, from, to int64, ops []string, contains string, limit, offset int) ([]LogEntry, int, error) {
	// 先刷新缓冲区
	l.Flush()

	var allEntries []LogEntry

	// 读取统一日志文件
	if _, err := os.Stat(l.logFile); !os.IsNotExist(err) {
		entries, err := l.readLogFile(l.logFile)
		if err != nil {
			return nil, 0, err
		}
		allEntries = append(allEntries, entries...)
	}

	// 过滤
	var filtered []LogEntry
	for _, entry := range allEntries {
		// 包名过滤
		if pkg != "" && entry.Pkg != pkg {
			continue
		}

		// 时间过滤
		if from > 0 && entry.Ts < from {
			continue
		}
		if to > 0 && entry.Ts > to {
			continue
		}

		// 操作类型过滤
		if len(ops) > 0 {
			found := false
			for _, op := range ops {
				if entry.Op == op {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		// 内容过滤
		if contains != "" {
			data, _ := json.Marshal(entry)
			if !strings.Contains(string(data), contains) {
				continue
			}
		}

		filtered = append(filtered, entry)
	}

	// 按时间排序（降序）
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].Ts > filtered[j].Ts
	})

	total := len(filtered)

	// 分页
	if offset >= total {
		return []LogEntry{}, total, nil
	}

	end := offset + limit
	if end > total {
		end = total
	}

	return filtered[offset:end], total, nil
}

func (l *Logger) readLogFile(path string) ([]LogEntry, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var entries []LogEntry
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		var entry LogEntry
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			continue // 跳过损坏的行
		}
		entries = append(entries, entry)
	}

	return entries, scanner.Err()
}

// Tail 获取最近的日志
func (l *Logger) Tail(pkg string, n int) ([]LogEntry, error) {
	// 先刷新缓冲区
	l.Flush()

	// 读取统一日志文件
	if _, err := os.Stat(l.logFile); os.IsNotExist(err) {
		return []LogEntry{}, nil
	}

	entries, err := l.readLogFile(l.logFile)
	if err != nil {
		return nil, err
	}

	// 如果指定了包名，进行过滤
	if pkg != "" {
		var filtered []LogEntry
		for _, entry := range entries {
			if entry.Pkg == pkg {
				filtered = append(filtered, entry)
			}
		}
		entries = filtered
	}

	// 按时间降序排序
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Ts > entries[j].Ts
	})

	if len(entries) > n {
		entries = entries[:n]
	}

	return entries, nil
}

// Clear 清空日志
func (l *Logger) Clear(pkg string) error {
	l.mu.Lock()
	// 清空缓冲区
	if pkg == "" {
		// 清空所有
		l.buffer = l.buffer[:0]
	} else {
		// 只保留其他包的日志
		var newBuffer []LogEntry
		for _, entry := range l.buffer {
			if entry.Pkg != pkg {
				newBuffer = append(newBuffer, entry)
			}
		}
		l.buffer = newBuffer
	}
	l.mu.Unlock()

	// 清空文件
	if pkg == "" {
		// 清空所有日志
		return os.RemoveAll(l.logFile)
	}

	// 读取并过滤，然后写回
	entries, err := l.readLogFile(l.logFile)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	var filtered []LogEntry
	for _, entry := range entries {
		if entry.Pkg != pkg {
			filtered = append(filtered, entry)
		}
	}

	// 写回文件
	tmpFile := l.logFile + ".tmp"
	f, err := os.OpenFile(tmpFile, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}

	w := bufio.NewWriter(f)
	for _, entry := range filtered {
		data, err := json.Marshal(entry)
		if err != nil {
			continue
		}
		w.Write(data)
		w.WriteByte('\n')
	}
	w.Flush()
	f.Close()

	return os.Rename(tmpFile, l.logFile)
}

// Cleanup 清理超过大小限制的日志
func (l *Logger) Cleanup() error {
	// 先刷新所有日志
	l.Flush()

	// 获取文件信息
	info, err := os.Stat(l.logFile)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	if info.Size() <= l.maxSizeBytes {
		return nil
	}

	// 读取所有日志
	entries, err := l.readLogFile(l.logFile)
	if err != nil {
		return err
	}

	// 按时间排序
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Ts < entries[j].Ts
	})

	// 删除最旧的日志直到满足限制（保留最新的 80%）
	keepCount := int(float64(len(entries)) * 0.8)
	if keepCount < 100 {
		keepCount = 100
	}
	entries = entries[len(entries)-keepCount:]

	// 写回文件
	tmpFile := l.logFile + ".tmp"
	f, err := os.OpenFile(tmpFile, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}

	w := bufio.NewWriter(f)
	for _, entry := range entries {
		data, err := json.Marshal(entry)
		if err != nil {
			continue
		}
		w.Write(data)
		w.WriteByte('\n')
	}
	w.Flush()
	f.Close()

	return os.Rename(tmpFile, l.logFile)
}

// GetStats 获取日志统计
func (l *Logger) GetStats() map[string]interface{} {
	l.Flush()

	info, err := os.Stat(l.logFile)
	if err != nil {
		return map[string]interface{}{
			"totalSizeBytes": 0,
			"maxSizeBytes":   l.maxSizeBytes,
			"appCount":       0,
		}
	}

	// 统计应用数量
	entries, _ := l.readLogFile(l.logFile)
	appCount := make(map[string]bool)
	for _, entry := range entries {
		appCount[entry.Pkg] = true
	}

	return map[string]interface{}{
		"totalSizeBytes": info.Size(),
		"maxSizeBytes":   l.maxSizeBytes,
		"appCount":       len(appCount),
	}
}

// Close 关闭日志管理器
func (l *Logger) Close() error {
	return l.Flush()
}

// Printf 打印日志（用于daemon自身日志）
func (l *Logger) Printf(format string, v ...interface{}) {
	fmt.Fprintf(os.Stderr, "[%s] %s\n", time.Now().Format("2006-01-02 15:04:05"), fmt.Sprintf(format, v...))
}
