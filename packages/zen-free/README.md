# Zen Free for Godwit

在 Godwit 中启用插件并允许声明的网络权限后，打开「模型服务」即可选择 Zen Free 模型，无需填写 API Key 或手建服务。需要包含 `models` 插件 API 的 Godwit 版本。

提示、邮件上下文、工具定义及工具结果会发送到 OpenCode 及其模型服务商。请阅读上游的数据使用条款。此插件依赖非官方公共接口；可用模型、限流和免费期限会变化，不保证配额或可用性。

模型来自当前 `/models` 列表，并结合上游目录或官方文档确认免费价格和协议。收费、退役、未知协议以及未经实际验证的判断模型不会被列出。目录失败时 Godwit 保留上次成功的列表；首次失败不会编造可用模型。元数据仅在当前插件实例内保留一小时。完整目录可能超过 Godwit 的 fetch 上限，此时使用当前文档中的价格和协议表，不扩大宿主限制。

插件支持 Chat Completions、Responses 和 Anthropic Messages 的请求适配；实际能选到哪些协议取决于当时上游的免费目录。Godwit 处理流、重试、工具执行和授权。插件补入的 bash/edit/glob/grep/read 占位定义明确不可调用，也不会获得执行权限。

## 构建与检查

源码无运行时依赖，Bun 仅用于构建和测试：

```sh
bun run --cwd packages/zen-free build
bun test ./packages/zen-free/test
```

安装 `packages/zen-free/dist`。它包含 `plugin.json` 和一份无外部 import 的 `index.js`。

源码从 npm 包 `@godwit/sdk` 导入类型，不要求相邻的 Godwit 仓库。首次安装及类型检查：

```sh
cd packages/zen-free
npm install
npm run typecheck
```

`@godwit/sdk@0.1.0` 首次发布前，可用主仓打出的真实 npm 包验证，不修改依赖声明：

```sh
# 在主仓 sdk/ 执行 npm pack --pack-destination /tmp
# 然后在 packages/zen-free/ 执行：
npm install --no-save --package-lock=false /tmp/godwit-sdk-0.1.0.tgz
npm run typecheck
```

SDK 发布之前，直接从 npm 安装会失败；应先合入并发布宿主 SDK，再合入本插件。运行真实 goja 沙箱测试时指定宿主工作树：

```sh
PATH=/path/to/go/bin:$PATH GODWIT_CHECKOUT=/path/to/godwit bun test ./packages/zen-free/test
```

可选的真实接口验收仅发送公共测试文字，工具只返回固定测试值：

```sh
GODWIT_ZEN_FREE_DIST=/absolute/path/to/plugins/packages/zen-free/dist \
GODWIT_ZEN_LIVE=1 go test ./core -run '^TestZenFreeLive$' -count=1 -v
```

应在 Godwit 工作树执行最后一条命令。它验证目录、文本、真实工具往返并探测明确免费的 Jev。未提供环境变量时网络测试跳过；单元测试本身不代表上游可用。

## 验收记录

2026-10-17，在包含新 models API 的 Godwit 隔离工作树中：

- 插件单元测试和真实 goja 加载检查：11 项通过，构建通过。
- 上游目录列出 9 个 Chat Completions 生成模型和 `jev-1.13-free` 判断模型。
- `big-pickle`（`openai-completions`）：公共文字生成、真实 `zen_echo` 工具往返通过。
- `jev-1.13-free`（`typesafe-systemone`）：在设置中选用后，公共文字的判断请求通过。
- 当时没有明确免费的 Responses / Anthropic Messages 生成模型，因此未做这两种协议的真实上游推理；三种生成协议均通过宿主的本地 TLS 集成测试。没有使用收费模型补足验收。

这些结果只说明该次验收可用，后续仍受上游目录和限流影响。本地模型的真实下载器、平台内存检查和 StartLux 加载由 Godwit #90 接入，不包含在此插件中。

## 来源

参考 [magpie-community/plugins 的 zen-free 0.1.10](https://github.com/magpie-community/plugins/tree/0b58032fa37b57e7a003ea5570d3674dc52fedea/packages/zen-free)，采用其公共凭据、OpenCode 兼容请求头与占位工具约定。保留原 MIT 许可和版权。未移植其 Node crypto、流解析或工具名修复逻辑。未修改 registry；发布后才能填入真实、不可变的 URL、大小和 SHA-256。
