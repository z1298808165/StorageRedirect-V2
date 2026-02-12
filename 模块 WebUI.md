# 模块 WebUI

KernelSU 的模块除了执行启动脚本和修改系统文件之外，还支持显示 UI 界面和与用户交互。

你可以通过任何 Web 技术编写 HTML + CSS + JavaScript 页面，KernelSU 的管理器将通过 WebView 显示这些页面。此外，KernelSU 还提供了一些用于与系统交互的 JavaScript API，例如执行 shell 命令。

## WebUI 根目录

Web 资源文件应放置在模块根目录的 `webroot` 子目录中，并且其中**必须**有一个名为`index.html`的文件，该文件是模块页面入口。包含 Web 界面的最简单的模块结构如下：



```
❯ tree .
.
|-- module.prop
`-- webroot
     `--index.html
```

WARNING

安装模块时，KernelSU 会自动设置 `webroot` 目录的权限和 SELinux context，如果您不知道自己在做什么，请不要自行设置该目录的权限！

如果您的页面包含 CSS 和 JavaScript，您也需要将其放入此目录中。

## JavaScript API

如果只是一个显示页面，那它和普通网页没有什么区别。更重要的是，KernelSU 提供了一系列的系统 API，可以让您实现模块特有的功能。

KernelSU 提供了一个 JavaScript 库并[在 npm 上发布](https://www.npmjs.com/package/kernelsu)，您可以在网页的 JavaScript 代码中使用它。

例如，您可以执行 shell 命令来获取特定配置或修改属性：



```
import { exec } from 'kernelsu';

const { errno, stdout } = await exec("getprop ro.product.model");
```

再比如，你可以让网页全屏显示，或者显示一个 Toast。

## [API 文档如下](https://www.npmjs.com/package/kernelsu)

# Library for KernelSU's module WebUI



## Install



```
yarn add kernelsu
```

## API



### exec



Spawns a **root** shell and runs a command within that shell, returning a Promise that resolves with the `stdout` and `stderr` outputs upon completion.

- `command` `<string>` The command to run, with space-separated arguments.
- `options` `<Object>`
  - `cwd` - Current working directory of the child process.
  - `env` - Environment key-value pairs.

```
import { exec } from 'kernelsu';

const { errno, stdout, stderr } = await exec('ls -l', { cwd: '/tmp' });
if (errno === 0) {
    // success
    console.log(stdout);
}
```

### spawn



Spawns a new process using the given `command` in **root** shell, with command-line arguments in `args`. If omitted, `args` defaults to an empty array.

Returns a `ChildProcess` instance. Instances of `ChildProcess` represent spawned child processes.

- `command` `<string>` The command to run.
- `args` `<string[]>` List of string arguments.
- `options` `<Object>`:
  - `cwd` `<string>` - Current working directory of the child process.
  - `env` `<Object>` - Environment key-value pairs.

Example of running `ls -lh /data`, capturing `stdout`, `stderr`, and the exit code:

```
import { spawn } from 'kernelsu';

const ls = spawn('ls', ['-lh', '/data']);

ls.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

ls.stderr.on('data', (data) => {
  console.log(`stderr: ${data}`);
});

ls.on('exit', (code) => {
  console.log(`child process exited with code ${code}`);
});
```

#### ChildProcess



##### Event 'exit'



- `code` `<number>` The exit code if the child process exited on its own.

The `'exit'` event is emitted when the child process ends. If the process exits, `code` contains the final exit code; otherwise, it is null.

##### Event 'error'



- `err` `<Error>` The error.

The `'error'` event is emitted whenever:

- The process could not be spawned.
- The process could not be killed.

##### `stdout`



A `Readable Stream` that represents the child process's `stdout`.

```
const subprocess = spawn('ls');

subprocess.stdout.on('data', (data) => {
  console.log(`Received chunk ${data}`);
});
```

#### `stderr`



A `Readable Stream` that represents the child process's `stderr`.

### fullScreen



Request the WebView enter/exit full screen.

```
import { fullScreen } from 'kernelsu';
fullScreen(true);
```

### enableInsets



Request the WebView to set padding to 0 or system bar insets

- tips: this is disabled by default but if you request resource from `internal/insets.css`, this will be enabled automatically.
- To get insets value and enable this automatically, you can
  - add `@import "https://mui.kernelsu.org/internal/insets.css";` in css OR
  - add `<link rel="stylesheet" type="text/css" href="/internal/insets.css" />` in html.

```
import { enableInsets } from 'kernelsu';
enableInsets(true);
```

### toast



Show a toast message.

```
import { toast } from 'kernelsu';
toast('Hello, world!');
```

### moduleInfo



Get module info.

```
import { moduleInfo } from 'kernelsu';
// print moduleId in console
console.log(moduleInfo());
```

### listPackages



List installed packages.

Returns an array of package names.

- `type` `<string>` The type of packages to list: "user", "system", or "all".

```
import { listPackages } from 'kernelsu';
// list user packages
const packages = listPackages("user");
```

- tips: when `listPackages` api is available, you can use ksu://icon/{packageName} to get app icon.

```
img.src = "ksu://icon/" + packageName;
```

### getPackagesInfo



Get information for a list of packages.

Returns an array of `PackagesInfo` objects.

- `packages` `<string[]>` The list of package names.

```
import { getPackagesInfo } from 'kernelsu';
const packages = getPackagesInfo(['com.android.settings', 'com.android.shell']);
```

#### PackagesInfo



An object contains:

- `packageName` `<string>` Package name of the application.
- `versionName` `<string>` Version of the application.
- `versionCode` `<number>` Version code of the application.
- `appLabel` `<string>` Display name of the application.
- `isSystem` `<boolean>` Whether the application is a system app.
- `uid` `<number>` UID of the application.