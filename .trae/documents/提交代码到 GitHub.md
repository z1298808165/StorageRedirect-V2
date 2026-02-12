## 提交计划

### 1. 添加更改到暂存区
```bash
git add -A
```

### 2. 创建提交
```bash
git commit -m "fix(webui): 修复 KernelSU API 获取应用列表失败的问题

- 优先使用命名导出方式导入 kernelsu 模块
- 添加关键 API 可用性检查
- 改进 exec 函数的错误处理，避免应用崩溃
- 添加详细的调试日志"
```

### 3. 推送到 GitHub
```bash
git push origin main
```

### 更改的文件说明
- `webui/src/stores/app.js`: 修复 API 导入和错误处理
- `module/webroot/`: 重新构建的 WebUI 资源文件