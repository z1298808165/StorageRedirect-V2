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
	maxSizeBytes int64
	mu           sync.Mutex
	buffers      map[string]*logBuffer
}

type logBuffer struct {
	pkg       string
	entries   []LogEntry
	lastFlush time.Time
	mu        sync.Mutex
}

// NewLogger 创建日志管理器
func NewLogger(baseDir string) (*Logger, error) {
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, err
	}

	return &Logger{
		baseDir:      baseDir,
		maxSizeBytes: 64 * 1024 * 1024, // 默认64MB
		buffers:      make(map[string]*logBuffer),
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

	pkg := entry.Pkg
	if pkg == "" {
		pkg = "unknown"
	}

	l.mu.Lock()
	buf, ok := l.buffers[pkg]
	if !ok {
		buf = &logBuffer{
			pkg:       pkg,
			entries:   make([]LogEntry, 0, 100),
			lastFlush: time.Now(),
		}
		l.buffers[pkg] = buf
	}
	l.mu.Unlock()

	buf.mu.Lock()
	buf.entries = append(buf.entries, *entry)
	shouldFlush := len(buf.entries) >= 100 || time.Since(buf.lastFlush) > 5*time.Second
	buf.mu.Unlock()

	if shouldFlush {
		return l.Flush(pkg)
	}

	return nil
}

// Flush 刷新指定包的日志
func (l *Logger) Flush(pkg string) error {
	l.mu.Lock()
	buf, ok := l.buffers[pkg]
	l.mu.Unlock()

	if !ok {
		return nil
	}

	buf.mu.Lock()
	if len(buf.entries) == 0 {
		buf.mu.Unlock()
		return nil
	}

	entries := make([]LogEntry, len(buf.entries))
	copy(entries, buf.entries)
	buf.entries = buf.entries[:0]
	buf.lastFlush = time.Now()
	buf.mu.Unlock()

	return l.writeToFile(pkg, entries)
}

// FlushAll 刷新所有日志
func (l *Logger) FlushAll() error {
	l.mu.Lock()
	pkgs := make([]string, 0, len(l.buffers))
	for pkg := range l.buffers {
		pkgs = append(pkgs, pkg)
	}
	l.mu.Unlock()

	for _, pkg := range pkgs {
		if err := l.Flush(pkg); err != nil {
			return err
		}
	}

	return nil
}

func (l *Logger) writeToFile(pkg string, entries []LogEntry) error {
	// 创建应用日志目录
	appDir := filepath.Join(l.baseDir, pkg)
	if err := os.MkdirAll(appDir, 0755); err != nil {
		return err
	}

	// 按日期命名文件
	dateStr := time.Now().Format("2006-01-02")
	filePath := filepath.Join(appDir, dateStr+".jsonl")

	f, err := os.OpenFile(filePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
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
	l.Flush(pkg)

	appDir := filepath.Join(l.baseDir, pkg)
	if _, err := os.Stat(appDir); os.IsNotExist(err) {
		return []LogEntry{}, 0, nil
	}

	var allEntries []LogEntry

	// 读取所有日志文件
	err := filepath.Walk(appDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() || !strings.HasSuffix(path, ".jsonl") {
			return nil
		}

		entries, err := l.readLogFile(path)
		if err != nil {
			return err
		}

		for _, entry := range entries {
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

			allEntries = append(allEntries, entry)
		}

		return nil
	})

	if err != nil {
		return nil, 0, err
	}

	// 按时间排序
	sort.Slice(allEntries, func(i, j int) bool {
		return allEntries[i].Ts > allEntries[j].Ts // 降序
	})

	total := len(allEntries)

	// 分页
	if offset >= total {
		return []LogEntry{}, total, nil
	}

	end := offset + limit
	if end > total {
		end = total
	}

	return allEntries[offset:end], total, nil
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
	l.Flush(pkg)

	appDir := filepath.Join(l.baseDir, pkg)
	if _, err := os.Stat(appDir); os.IsNotExist(err) {
		return []LogEntry{}, nil
	}

	// 获取所有日志文件并按名称排序（日期）
	files, err := os.ReadDir(appDir)
	if err != nil {
		return nil, err
	}

	var logFiles []string
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".jsonl") {
			logFiles = append(logFiles, filepath.Join(appDir, f.Name()))
		}
	}
	sort.Sort(sort.Reverse(sort.StringSlice(logFiles)))

	var entries []LogEntry
	for _, path := range logFiles {
		fileEntries, err := l.readLogFile(path)
		if err != nil {
			continue
		}

		// 按时间降序
		sort.Slice(fileEntries, func(i, j int) bool {
			return fileEntries[i].Ts > fileEntries[j].Ts
		})

		entries = append(entries, fileEntries...)

		if len(entries) >= n {
			break
		}
	}

	if len(entries) > n {
		entries = entries[:n]
	}

	return entries, nil
}

// Clear 清空应用日志
func (l *Logger) Clear(pkg string) error {
	// 清空缓冲区
	l.mu.Lock()
	if buf, ok := l.buffers[pkg]; ok {
		buf.mu.Lock()
		buf.entries = buf.entries[:0]
		buf.mu.Unlock()
	}
	l.mu.Unlock()

	// 删除日志文件
	appDir := filepath.Join(l.baseDir, pkg)
	if err := os.RemoveAll(appDir); err != nil {
		return err
	}

	return nil
}

// Cleanup 清理超过大小限制的日志
func (l *Logger) Cleanup() error {
	// 先刷新所有日志
	l.FlushAll()

	// 计算总大小
	var totalSize int64
	var files []os.FileInfo
	var paths []string

	err := filepath.Walk(l.baseDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && strings.HasSuffix(path, ".jsonl") {
			totalSize += info.Size()
			files = append(files, info)
			paths = append(paths, path)
		}
		return nil
	})

	if err != nil {
		return err
	}

	if totalSize <= l.maxSizeBytes {
		return nil
	}

	// 按修改时间排序
	type fileInfo struct {
		path string
		info os.FileInfo
	}
	var fileInfos []fileInfo
	for i, f := range files {
		fileInfos = append(fileInfos, fileInfo{path: paths[i], info: f})
	}
	sort.Slice(fileInfos, func(i, j int) bool {
		return fileInfos[i].info.ModTime().Before(fileInfos[j].info.ModTime())
	})

	// 删除最旧的文件直到满足限制
	for _, fi := range fileInfos {
		if totalSize <= l.maxSizeBytes {
			break
		}
		os.Remove(fi.path)
		totalSize -= fi.info.Size()
	}

	return nil
}

// GetStats 获取日志统计
func (l *Logger) GetStats() map[string]interface{} {
	l.FlushAll()

	var totalSize int64
	appCount := make(map[string]bool)

	filepath.Walk(l.baseDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() && strings.HasSuffix(path, ".jsonl") {
			totalSize += info.Size()
			// 获取应用名（父目录名）
			rel, _ := filepath.Rel(l.baseDir, path)
			parts := strings.Split(rel, string(filepath.Separator))
			if len(parts) > 0 {
				appCount[parts[0]] = true
			}
		}
		return nil
	})

	return map[string]interface{}{
		"totalSizeBytes": totalSize,
		"maxSizeBytes":   l.maxSizeBytes,
		"appCount":       len(appCount),
	}
}

// Close 关闭日志管理器
func (l *Logger) Close() error {
	return l.FlushAll()
}

// Printf 打印日志（用于daemon自身日志）
func (l *Logger) Printf(format string, v ...interface{}) {
	fmt.Fprintf(os.Stderr, "[%s] %s\n", time.Now().Format("2006-01-02 15:04:05"), fmt.Sprintf(format, v...))
}
