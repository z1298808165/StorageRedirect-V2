# PRD — 存储重定向与审计模块（KernelSU + Zygisk，Android 12–16）

### 1.1 需求背景

用户希望在不改应用代码的前提下：
- 审计：知道“哪个应用/哪个进程在什么时间对哪些路径做了什么操作（读/写/创建/删除/重命名等）”。
- 控制：对指定路径对某些应用强制只读。
- 重定向：对某应用把 `src` 视为 `dst`，同时支持多条规则优先级、支持 `src == dst` 显式直通。
- 统一在 KernelSU WebUI 管理，并且规则变更无需重启手机/应用即可生效。

### 1.2 目标（必须满足）
**G1. 支持 Android 12–16**
- 在 Android 12–16 可运行。
- ABI：arm64-v8a 为 P0；armeabi-v7a 作为 P2（可选）。

**G2. 规则按应用维度存储与生效**

- 以 `packageName` 为主键区分规则。
- 规则类型：`redirectRules`、`readOnlyRules`、`monitorPaths`。

**G3. 监控**
- 每个应用支持配置多个监控路径，并可配置监控操作类型（open/read/write/rename/unlink/mkdir…）。
- 日志必须记录：包名、进程名、uid、pid、tid、时间、操作类型、原始 path/URI、映射后的 path（如有）、决策、结果与 errno。

**G4. 重定向**
- 支持多条重定向规则。
- **优先级**：先添加的规则优先（first-match-wins）。
- 支持 `src == dst` 表示显式直通（也可用于覆盖更上层目录规则）。
- 子路径拼接：访问 `src/child/file` 映射到 `dst/child/file`。

**G5. 只读**
- 命中只读路径：禁止写入/创建/删除/重命名/截断等产生写效果的操作；允许读取与列举（在系统权限允许范围内）。

**G6. URI 场景重定向（已确认：尝试映射）**
- 当应用通过 `content://` URI 读写时：
  - 尝试将 URI 映射为文件系统路径或等价目标（例如通过可解析的 documentId、MediaStore data/relative_path、fd 指向等“可证明”的映射链路）。
  - 若映射成功：执行与 path 一致的“规则匹配→重定向/只读/监控”。
  - 若映射失败：至少执行 **只读（写模式拒绝）** 与 **监控**，并记录映射失败原因字段（便于排查）。

**G7. WebUI（KernelSU WebUI）**
- 必须提供：
  - 应用列表：支持筛选（用户/系统/全部）、搜索（名称/包名）
  - 已配置规则的应用置顶
  - 列表卡片显示重定向规则数与只读规则数
  - 显示“已生效/已挂载”标识（由 daemon 返回运行时状态）
  - Tabs：应用 / 监控配置 / 关于
  - 现代化卡片 + 毛玻璃风格

**G8. 动态生效**
- WebUI 保存规则后，无需重启系统/应用即可在可配置窗口内生效。

**G9. GitHub Actions 自动构建**
- 自动构建并产出 **可直接刷入的模块 zip**（不嵌套压缩包）。

### 1.3 非目标（明确边界）
- 不保证覆盖所有 OEM 私有文件框架的全部边缘行为（允许通过开关回退）。
- 不保证对所有应用做到绝对不可检测（稳定性优先）。
- 不记录文件内容，仅记录元数据。

---

## 2. 用户故事（User Stories）
- **US-1**：为某应用添加/排序重定向规则，使其访问 `src` 时等价访问 `dst`。
- **US-2**：为某应用设置只读路径，使其无法写入该路径，并且写失败会被记录。
- **US-3**：为某应用配置监控路径与操作类型，并在 WebUI 查询/导出日志。
- **US-4**：在 WebUI 快速搜索应用、查看规则数量与生效标识并进入配置页。
- **US-5**：保存规则后，无需重启即可生效（动态更新）。
- **US-6**：URI 保存/写入同样受重定向与只读约束（能映射则映射；不能则拒写并记录原因）。

---

## 3. 功能需求（FR）与验收标准（AC）

> 采用 Given / When / Then 描述验收。P0 为必须通过；P1/P2 为增强。

### 3.1 WebUI

#### FR-APP-01 WebUI 应用列表（P0）
**需求**
- 列出所有应用（系统/用户/全部筛选）。
- 搜索：支持按应用名称与包名匹配。
- 显示图标（通过 KernelSU API）。
- 显示规则计数：redirect 数、readonly 数（monitor 数可选显示）。
- 显示“已生效/已挂载”标识（runtime 状态）。
- 有规则的应用置顶排序。

**AC**
- Given 选择筛选 = 用户应用  
  When 列表加载完成  
  Then 仅显示用户应用。
- Given 输入搜索词 `com.android`  
  When 输入完成  
  Then 只显示名称或包名匹配的应用。
- Given A 应用配置了规则  
  When 显示列表  
  Then A 应用排在无规则应用之前，并显示规则计数。
- Given daemon 未运行/不可达  
  When 打开列表  
  Then 顶部显示告警提示，同时“已生效”标识降级为未知，不阻塞 UI 使用。

---

### 3.2 重定向

#### FR-RDR-01 重定向规则优先级（P0）
**AC**
- Given 规则：
  1) `/storage/emulated/0/Download/` → `/storage/emulated/0/Download/Third/`
  2) `/storage/emulated/0/` → `/storage/emulated/0/Android/data/p/files/`
- When 应用访问 `/storage/emulated/0/Download/a.txt`
- Then 命中规则 #1，忽略规则 #2（first-match-wins）。

#### FR-RDR-02 子路径拼接（P0）
**AC**
- Given 规则：`/A/` → `/B/`
- When 应用访问 `/A/x/y.txt`
- Then 映射路径为 `/B/x/y.txt`。

#### FR-RDR-03 `src == dst` 显式直通（P0）
**AC**
- Given 规则：
  1) `/storage/emulated/0/Download/` → `/storage/emulated/0/Download/`（直通）
  2) `/storage/emulated/0/` → `/storage/emulated/0/Android/data/p/files/`
- When 应用访问 `/storage/emulated/0/Download/abc`
- Then 实际访问仍在原 Download 下（规则 #1 覆盖规则 #2）。

#### FR-RDR-04 路径规范化（P0）
**AC**
- Given 用户新增 src=`/storage/emulated/0/Download`（无尾斜杠）  
  When 保存  
  Then daemon 按约定规范化（例如目录规则统一为 `/storage/emulated/0/Download/`），并在 UI 中展示规范化结果。

---

### 3.3 只读

#### FR-RO-01 只读拒绝写操作（P0）
**AC**
- Given 只读路径 `/storage/emulated/0/DCIM/`
- When 应用尝试在该目录创建/写入/删除/重命名/截断  
- Then 操作失败（权限类错误），并写入一条日志 `decision=DENY_RO`，包含命中规则信息。

#### FR-RO-02 只读允许读与列举（P0）
**AC**
- Given 只读路径 `/storage/emulated/0/DCIM/`
- When 应用读取已存在文件或列举目录
- Then 允许（前提系统权限允许）。

---

### 3.4 监控

#### FR-MON-01 监控记录（P0）
**AC**
- Given 监控路径 `/storage/emulated/0/` 且 ops 包含 `open, write`
- When 应用写入 `/storage/emulated/0/Download/a.txt`
- Then 日志至少包含字段：ts/pkg/proc/uid/pid/tid/op/path/mapped(如有)/decision/result/errno(如失败)。

#### FR-MON-02 关闭监控（P0）
**AC**
- Given 全局监控开关 `monitorEnabled=false`
- When 应用进行 I/O
- Then 不生成监控日志（可选：保留最小健康指标，需文档声明）。

---

### 3.5 URI（content:// / SAF / MediaStore）

#### FR-URI-01 尝试映射并重定向（P0/P1 混合）
**需求**
- 对 `content://` 打开/创建/写入尝试映射到“等价路径”或“等价目标”：
  - 映射成功：按 path 规则执行 PASS/REDIRECT/DENY_RO 与监控记录。
  - 映射失败：至少对“写模式”执行只读拒绝（若命中只读或全局策略要求），并监控记录映射失败原因。

**AC（P0）**
- Given 应用通过 URI 以写模式打开目标  
  When 模块无法映射该 URI  
  Then：
  - 至少记录一条日志 `op=open_uri`，包含 `uri` 与 `map.status=FAILED`、失败原因
  - 若策略要求只读或命中只读，则拒绝写入并记录 `decision=DENY_RO` 或 `DENY_POLICY`（如定义）

**AC（P1）**
- Given 模块可将某类 URI 稳定映射到真实路径  
  When 应用写入  
  Then 映射后路径参与重定向与只读判断，并记录 `mapped`。

> 备注：URI 映射链路在不同 ROM/版本差异大，本 PRD 要求“尽力映射 + 可观测失败原因 + 可配置策略”。

---

### 3.6 动态更新

#### FR-DYN-01 动态更新无需重启（P0）
**AC**
- Given 应用正在运行并持续 I/O  
  When WebUI 保存新规则  
  Then 在可配置窗口内（默认目标 ≤5s 或 ≤N 次 I/O 检查后）新规则生效。

#### FR-DYN-02 校验失败回退（P0）
**AC**
- Given 用户保存了非法配置  
  When daemon 校验失败  
  Then：
  - daemon 返回结构化错误（code/message/field）
  - 旧配置保持生效
  - WebUI 显示错误提示

---

## 4. 进程归属模型（防侧漏策略开关）

> 目的：尽量避免“某些相关进程绕过规则进行文件创建/写入”（侧漏）。  
> 约束：Android 多进程/isolated/插件框架复杂，采用可配置策略，并提供诊断工具可观测归属原因。

### 4.1 策略开关（global）
在 `global.processAttribution` 中提供：

```json
{
  "mode": "strict",
  "inheritToAllSameUid": true,
  "inheritToIsolated": true,
  "inheritToChildProcess": true,
  "fallbackUnknownPolicy": "denyWriteOnMatchedPaths",
  "diagnosticTagUnknown": true
}
```



#### 字段说明

- `mode`：`strict` | `balanced` | `relaxed`
  - `strict`（默认，防侧漏优先）：更激进地将相关进程归属到宿主规则；对“未知归属但疑似相关”的写操作采取更强约束（见 fallback）。
  - `balanced`：减少误伤，优先保证兼容性。
  - `relaxed`：最少归属推断，适合排障/兼容性回退。
- `inheritToAllSameUid`：同 uid 的多进程共享规则（默认 true）。
- `inheritToIsolated`：isolated 进程尝试继承宿主规则（默认 true）。
- `inheritToChildProcess`：子进程（fork/zygote 派生链）尝试继承（默认 true）。
- `fallbackUnknownPolicy`（关键，防侧漏核心开关）：
  - `allow`：未知归属默认放行（风险高）
  - `monitorOnly`：只记录不拦截
  - `denyWriteOnMatchedPaths`（默认）：若操作命中“受控路径集合”（重定向/只读/监控路径），对**写类**操作执行拒绝或强制落入安全路径策略（按实现定义），并记录原因
- `diagnosticTagUnknown`：对未知归属进程的日志打标签，便于定位侧漏来源。

### 4.2 运行时可观测性要求（P0）

- daemon 必须提供诊断命令 `diag whoami`，输出：
  - resolved packageName（可能为空）
  - 是否 isolated
  - resolutionReason（归属理由枚举）
  - 当前 ruleSetVersion
- 日志中建议记录 `attribution` 字段（可选），用于事后分析侧漏原因。

------

## 5. 数据模型

### 5.1 配置文件路径

- `/data/adb/modules/<modid>/config/config.json`

### 5.2 配置 Schema（概要）

JSON



```
{
  "version": 12,
  "global": {
    "monitorEnabled": true,
    "logLevel": "info",
    "maxLogSizeMB": 64,
    "update": {
      "pollIntervalMs": 3000,
      "opCheckInterval": 50
    },
    "processAttribution": {
      "mode": "strict",
      "inheritToAllSameUid": true,
      "inheritToIsolated": true,
      "inheritToChildProcess": true,
      "fallbackUnknownPolicy": "denyWriteOnMatchedPaths",
      "diagnosticTagUnknown": true
    },
    "uri": {
      "redirectEnabled": true,
      "mappingMode": "bestEffort",
      "onMappingFailed": "enforceReadonlyAndMonitor",
      "logMappingDetails": true
    }
  },
  "apps": {
    "com.example.app": {
      "enabled": true,
      "redirectRules": [
        { "src": "/storage/emulated/0/Download/", "dst": "/storage/emulated/0/Download/Third/" }
      ],
      "readOnlyRules": [
        { "path": "/storage/emulated/0/DCIM/" }
      ],
      "monitorPaths": [
        { "path": "/storage/emulated/0/", "ops": ["open","read","write","rename","unlink","mkdir"] }
      ]
    }
  }
}
```

------

## 6. 接口规范（daemonctl CLI）

### 6.1 CLI 入口与输出约定

- CLI：`/data/adb/modules/<modid>/bin/daemonctl`
- 成功：stdout 输出 JSON，且 `ok=true`，退出码 0。
- 失败：stdout 输出 JSON，且 `ok=false`，退出码非 0（见 §7）。

------

## 6.2 命令清单与返回示例（JSON）

### 6.2.1 `daemonctl ping`

**成功（exit 0）**

JSON



```
{
  "ok": true,
  "daemon": { "version": "1.0.0", "pid": 1234, "uptimeMs": 543210 },
  "configVersion": 12
}
```

### 6.2.2 `daemonctl status`

**成功**

JSON



```
{
  "ok": true,
  "daemon": {
    "pid": 1234,
    "startedAt": 1738051200123,
    "uptimeMs": 600000,
    "build": { "git": "abc1234", "date": "2026-02-04" }
  },
  "config": {
    "path": "/data/adb/modules/<modid>/config/config.json",
    "version": 12,
    "lastLoadedAt": 1738051800000
  },
  "runtime": {
    "connectedProcesses": 8,
    "appsActive": 3,
    "socket": {
      "path": "/data/adb/modules/<modid>/run/ipc.sock",
      "listening": true
    }
  },
  "logs": {
    "baseDir": "/data/adb/modules/<modid>/logs",
    "totalSizeBytes": 1048576,
    "maxSizeBytes": 67108864,
    "rotation": { "mode": "daily", "compressAfterDays": 0 },
    "cleanup": { "policy": "globalCapDeleteOldest" }
  }
}
```

### 6.2.3 `daemonctl global get`

JSON



```
{
  "ok": true,
  "global": {
    "monitorEnabled": true,
    "logLevel": "info",
    "maxLogSizeMB": 64,
    "update": { "pollIntervalMs": 3000, "opCheckInterval": 50 },
    "processAttribution": {
      "mode": "strict",
      "inheritToAllSameUid": true,
      "inheritToIsolated": true,
      "inheritToChildProcess": true,
      "fallbackUnknownPolicy": "denyWriteOnMatchedPaths",
      "diagnosticTagUnknown": true
    },
    "uri": {
      "redirectEnabled": true,
      "mappingMode": "bestEffort",
      "onMappingFailed": "enforceReadonlyAndMonitor",
      "logMappingDetails": true
    }
  },
  "configVersion": 12
}
```

### 6.2.4 `daemonctl global set --json '<json>'`

**成功**

JSON



```
{ "ok": true, "configVersion": 13 }
```

**校验失败**

JSON



```
{
  "ok": false,
  "error": {
    "code": "E_CFG_VALIDATION",
    "message": "maxLogSizeMB 必须在 8~1024 之间",
    "field": "global.maxLogSizeMB"
  }
}
```

### 6.2.5 `daemonctl app get --pkg com.example.app`

**成功**

JSON



```
{
  "ok": true,
  "pkg": "com.example.app",
  "app": {
    "enabled": true,
    "redirectRules": [
      { "src": "/storage/emulated/0/Download/", "dst": "/storage/emulated/0/Download/Third/" }
    ],
    "readOnlyRules": [
      { "path": "/storage/emulated/0/DCIM/" }
    ],
    "monitorPaths": [
      { "path": "/storage/emulated/0/", "ops": ["open","write"] }
    ]
  },
  "counts": { "redirect": 1, "readOnly": 1, "monitor": 1 },
  "runtime": {
    "applied": true,
    "ruleSetVersion": 13,
    "processes": [
      { "pid": 2222, "proc": "com.example.app", "uid": 10123, "lastSeenAt": 1738051900000 },
      { "pid": 3333, "proc": "com.example.app:remote", "uid": 10123, "lastSeenAt": 1738051900500 }
    ]
  },
  "configVersion": 13
}
```

### 6.2.6 `daemonctl app set --pkg com.example.app --json '<json>'`

**成功**

JSON



```
{ "ok": true, "configVersion": 14 }
```

**校验失败（示例：非绝对路径）**

JSON



```
{
  "ok": false,
  "error": {
    "code": "E_CFG_VALIDATION",
    "message": "redirectRules[0].src 必须是绝对路径",
    "field": "apps.com.example.app.redirectRules[0].src"
  }
}
```

### 6.2.7 `daemonctl app list-rule-apps`

**成功**

JSON



```
{
  "ok": true,
  "apps": [
    { "pkg": "com.example.app", "counts": { "redirect": 2, "readOnly": 1 }, "enabled": true, "applied": true },
    { "pkg": "com.other.app", "counts": { "redirect": 0, "readOnly": 3 }, "enabled": true, "applied": false }
  ],
  "configVersion": 15
}
```

### 6.2.8 `daemonctl log tail --pkg com.example.app --n 3`

JSON



```
{
  "ok": true,
  "pkg": "com.example.app",
  "entries": [
    {
      "ts": 1738051999001,
      "pkg": "com.example.app",
      "proc": "com.example.app",
      "pid": 2222,
      "tid": 2250,
      "uid": 10123,
      "op": "open",
      "path": "/storage/emulated/0/Download/a.txt",
      "uri": null,
      "mapped": "/storage/emulated/0/Download/Third/a.txt",
      "decision": "REDIRECT",
      "rule": { "type": "redirect", "index": 0, "src": "/storage/emulated/0/Download/", "dst": "/storage/emulated/0/Download/Third/" },
      "result": "OK",
      "errno": null,
      "extra": { "flags": 577, "mode": 420 }
    },
    {
      "ts": 1738051999050,
      "pkg": "com.example.app",
      "proc": "com.example.app:remote",
      "pid": 3333,
      "tid": 3333,
      "uid": 10123,
      "op": "unlink",
      "path": "/storage/emulated/0/DCIM/x.jpg",
      "uri": null,
      "mapped": null,
      "decision": "DENY_RO",
      "rule": { "type": "readonly", "index": 0, "path": "/storage/emulated/0/DCIM/" },
      "result": "FAIL",
      "errno": 13,
      "extra": {}
    }
  ]
}
```

### 6.2.9 `daemonctl log query ...`

JSON



```
{
  "ok": true,
  "pkg": "com.example.app",
  "query": {
    "from": 1738050000000,
    "to": 1738060000000,
    "ops": ["open", "unlink"],
    "contains": "DCIM",
    "limit": 200,
    "offset": 0
  },
  "entries": [],
  "nextOffset": null
}
```

### 6.2.10 `daemonctl log clear --pkg com.example.app`

JSON



```
{ "ok": true }
```

### 6.2.11 诊断：`daemonctl diag whoami --pid 3333`

JSON



```
{
  "ok": true,
  "pid": 3333,
  "uid": 10123,
  "proc": "com.example.app:remote",
  "resolved": {
    "packageName": "com.example.app",
    "isIsolated": false,
    "resolutionReason": "BY_UID_PRIMARY",
    "ruleSetVersion": 15
  }
}
```

------

## 7. 错误码与退出码约定

### 7.1 CLI 退出码（Exit Code）

- `0`：成功
- `1`：未知/通用失败（未分类异常）
- `2`：CLI 参数错误（解析失败、缺参数）
- `3`：配置校验错误（schema、范围、路径规范不合法）
- `4`：资源不存在（包名不存在、日志不存在等）
- `5`：权限/环境错误（文件权限、SELinux、目录不可写等）
- `10`：daemon 不可达（socket 不存在/daemon 未启动）
- `11`：IPC 协议错误或超时

### 7.2 失败输出 JSON 格式

JSON



```
{
  "ok": false,
  "error": {
    "code": "E_DAEMON_UNREACHABLE",
    "message": "无法连接 daemon（socket 不可达）",
    "hint": "检查模块 service 是否运行，或执行 daemonctl status"
  }
}
```

### 7.3 规范错误码列表（`error.code`）

- `E_ARG`：命令行参数错误
- `E_DAEMON_UNREACHABLE`：daemon 不可达
- `E_IPC_TIMEOUT`：IPC 超时
- `E_IPC_PROTOCOL`：IPC 协议不匹配/数据损坏
- `E_CFG_READ`：读取配置失败
- `E_CFG_PARSE`：配置 JSON 解析失败
- `E_CFG_VALIDATION`：配置校验失败（字段/范围/路径）
- `E_CFG_WRITE`：写入配置失败
- `E_NOT_FOUND`：资源不存在（pkg/log）
- `E_LOG_IO`：日志读写失败
- `E_INTERNAL`：内部错误

------

## 8. 日志规范（JSONL）、轮转与清理策略（全局上限）

### 8.1 日志目录

- 基础目录：`/data/adb/modules/<modid>/logs/`

### 8.2 文件布局（按应用、按天）

text



```
/data/adb/modules/<modid>/logs/
  com.example.app/
    2026-02-04.jsonl
    2026-02-05.jsonl
    index.json              （可选：统计/索引缓存）
  com.other.app/
    2026-02-04.jsonl
```

### 8.3 JSONL Schema（稳定字段）

每行一个 JSON 对象：

JSON



```
{
  "ts": 1738051999001,
  "pkg": "com.example.app",
  "proc": "com.example.app:remote",
  "pid": 3333,
  "tid": 3333,
  "uid": 10123,

  "op": "open_uri",
  "path": null,
  "uri": "content://media/external/file/123",
  "mapped": "/storage/emulated/0/Download/Third/a.txt",

  "decision": "REDIRECT",
  "rule": { "type": "redirect", "index": 0, "src": "/storage/emulated/0/Download/", "dst": "/storage/emulated/0/Download/Third/" },

  "result": "OK",
  "errno": null,

  "map": {
    "status": "OK",
    "method": "MediaStore",
    "detail": "resolved via relative_path+display_name"
  },

  "extra": { "mode": "rw" }
}
```

### 8.4 `decision` 枚举

- `PASS`：允许直通（未映射）
- `REDIRECT`：命中重定向并发生映射
- `DENY_RO`：命中只读规则并拒绝
- `DENY_POLICY`：因归属未知/全局策略拒绝（用于防侧漏 fallback）
- `MONITOR_ONLY`：仅监控不干预（如存在）

### 8.5 URI 映射字段 `map`

- `status`：`OK` | `FAILED` | `SKIPPED`
- `method`：映射方法标识（如 `DocumentFile`/`MediaStore`/`FdInspect`/`Unknown`，具体实现自定，但必须稳定）
- `detail`：可读字符串，便于排查（注意不要泄露敏感信息）

### 8.6 轮转策略

- 轮转粒度：按天
- 文件名：`YYYY-MM-DD.jsonl`
- 写入方式：append-only
- 容错：允许最后一行不完整，读取端需跳过尾部损坏行

### 8.7 清理策略（全局上限，已确认）

- 上限：`global.maxLogSizeMB`（默认 64MB）
- 超限清理策略（P0）：
  1. 计算 `logs/` 总占用
  2. 若超限，收集所有 `*.jsonl`（以及可选的 `*.jsonl.gz`）文件
  3. 按“日期/mtime 从旧到新”排序
  4. 依次删除最旧文件直到占用 ≤ 上限
- 可选压缩（P2）：
  - 超过 N 天的日志压缩为 `.jsonl.gz`，以降低占用

------

## 9. 性能与功耗（非功能需求）

- 默认只对“配置过规则的应用”启用完整逻辑。
- 监控仅对命中 monitorPaths 的事件记录；支持节流/采样（可选）。
- 日志批量写入（缓冲 + 定时 flush），降低频繁 I/O。
- 动态更新采用低频轮询或按操作计数触发检查，避免每次 I/O 都 IPC。

------

## 10. WebUI 需求要点

- Tab1：应用列表（搜索/筛选/规则数/生效标识）
- Tab2：监控配置（全局开关、日志上限、查询工具）
- Tab3：关于（版本、说明、排错）
- 使用 KernelSU WebUI API：
  - 应用列表：`listPackages(type)` + `getPackagesInfo(packages)`
  - 图标：`ksu://icon/<packageName>`
  - 调用 daemonctl：`exec/spawn`

------

## 11. CI/CD（GitHub Actions）

- 构建：native（zygisk、daemon）+ webui 静态资源
- 打包：模块根目录直接 zip 成可刷包（不嵌套）
- 命名：`ModuleName-<SemVer>-<gitsha>.zip`

------

## 12. P0 测试计划（最小验收集）

- 系统版本：Android 12/13/14/15/16
- 用例：
  - 重定向优先级（Download 覆盖上层）
  - `src == dst` 直通覆盖
  - 只读拒绝创建/删除/重命名
  - URI 写入：映射成功时参与重定向；映射失败时至少记录失败并按策略拒写
  - 监控日志字段完整性
  - 动态更新无需重启
- 压力测试：
  - 高频 I/O + 监控开启（窄路径），观察 CPU/电量/卡顿