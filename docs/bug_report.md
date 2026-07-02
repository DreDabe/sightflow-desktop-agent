# Bug 报告记录

## 2026-07-02 多模式运行时共享资源冲突

### Bug 1: 停止一个模式导致另一个模式崩溃

**问题描述**: 启动两个模式后，停止其中一个模式，另一个模式也停止运行，运行日志出现 `Cannot read properties of null (reading 'toPNG')` 错误。

**根因**: `RPADevice.onSessionStop()` 调用 `clearLayoutCache(this.appType)` 清除了全局共享的 LayoutCache。LayoutCache 是按 appType 存储的模块级单例，所有同 appType 的模式共享同一份缓存。当模式 A 停止时清除了 LayoutCache，模式 B 的 `captureChatMainArea` 因 `getLayoutCache` 返回 null 而返回 null，导致后续 `toPNG()` 在 null 上调用报错。

**修复方法**:
1. `RPADevice.onSessionStop()` 不再清除 LayoutCache
2. `stopEngineCore` 中，仅当所有模式都停止后（`runtimeInstances.size === 0`）才清除 LayoutCache 和 chatBaseline

**涉及文件**: `src/core/rpa-device.ts`, `src/main/index.ts`

---

### Bug 2: 待机状态未触发

**问题描述**: 对话窗口没有变化、用户也没有操作，但系统始终未进入待机状态，无日志输出，无 UI 标识。

**根因**: `consecutiveNoChangeRounds` 只在 `provider.reply_text` 且 `autoReply === false` 时递增。在 `check_unread` 中，当 `hasDiff: false` 且无未读消息时，直接进入 `wait_retry`，不递增计数器，导致计数器始终为 0，待机条件永远不满足。

**修复方法**:
1. 在 `check_unread` 中，`hasDiff: true` 时重置 `consecutiveNoChangeRounds = 0`
2. `hasDiff: false` 时递增 `consecutiveNoChangeRounds += 1`
3. `provider.reply_text` 中非自动回复时不再递增（由 `check_unread` 统一管理）

**涉及文件**: `src/core/generic-channel-session.ts`

---

### Bug 3: 启动新模式后原有模式待机状态失效

**问题描述**: 模式 A 进入待机后，启动模式 B，模式 A 的待机状态失效，系统重新执行流程。最后只有模式 B 在运行。

**根因**: `image-compare.ts` 中的 `chatBaseline` 是模块级单例变量，所有模式共享同一个 baseline。当模式 B 启动时，`GenericChannelSession.onStart` 调用 `clearChatBaseline()` 清除了共享 baseline，模式 B 处理后设置新 baseline 覆盖了模式 A 的 baseline。模式 A 的 `hasChatAreaChanged` 对比的是模式 B 的 baseline，可能检测到差异而退出待机。

**修复方法**:
1. `image-compare.ts` 中将 `chatBaseline` 从单例变量改为 `Map<string, Electron.NativeImage>`，按 modeId 隔离
2. `setChatBaseline`、`checkChatAreaDiff`、`clearChatBaseline`、`hasChatBaseline` 均增加 `modeId` 参数
3. `RPADevice` 新增 `modeId` 字段和 `setModeId` 方法，baseline 操作传递 `this.modeId`
4. `DesktopDevice` 接口新增 `setModeId` 方法
5. `startEngineCore` 中调用 `device.setModeId(effectiveModeId)`

**涉及文件**: `src/core/rpa/image-compare.ts`, `src/core/device.ts`, `src/core/rpa-device.ts`, `src/core/box-select-device.ts`, `src/main/index.ts`

---

### Bug 4: 路由问题 — 系统将内容路由向最新启动的模式

**问题描述**: 设置了 A 模式为全局默认模式，但系统将检测到的内容路由向了最新启动的模式 B，而非全局默认模式 A。

**根因**: 所有运行中的模式独立运行各自的事件循环，都监测同一个聊天窗口。当检测到新消息时，每个模式都会尝试处理，没有检查当前模式是否是应该处理该消息的模式。`resolveMode` 返回了正确的目标模式，但当前模式即使不是目标模式也会继续处理。

**修复方法**:
1. `GenericChannelState` 新增 `hostModeId` 字段，标识当前模式自身的 ID
2. `observe_chat` 中，若 `resolveMode` 返回的 modeId 与 `hostModeId` 不匹配，跳过处理，直接进入 `check_unread`

**涉及文件**: `src/core/generic-channel-session.ts`, `src/main/index.ts`

---

### Bug 5: 停止模式后待机 UI 未消失

**问题描述**: 停止模式后，左侧菜单栏中的红色待机标识和推荐回复区域的"待机中"文字没有消失。

**根因**: `stopEngineCore` 停止模式时没有发送 `engine:standbyChanged` 事件通知渲染进程清除待机 UI。另外，`standbyModeId` 使用单值状态，不支持多模式同时待机。

**修复方法**:
1. `stopEngineCore` 中停止模式后发送 `engine:standbyChanged` 事件（`standby: false`）
2. 渲染进程 `standbyModeId` 从 `string | null` 改为 `Set<string>`，支持多模式同时待机
3. 左侧菜单栏模式项最右侧添加红色"待机中..."文字标识

**涉及文件**: `src/main/index.ts`, `src/renderer/src/App.tsx`
