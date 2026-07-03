# 打包版本修改教程

本教程说明如何修改打包程序的版本号及相关信息，适用于每次发布新版本时手动操作。

---

## 一、需要修改的文件及位置

### 1. `package.json`（应用版本号）

```json
{
  "name": "autoreply-desktop-agent",
  "version": "X.Y.Z",          // ← 修改此处版本号
  "description": "...",
  ...
}
```

- `version` 字段：应用的语义化版本号（如 `1.0.1`、`1.1.0`）
- 这是 `npm` 包的版本，也是 Electron 应用内部显示的版本号

### 2. `electron-builder.yml`（安装包信息）

```yaml
appId: com.autoreply.desktop
productName: AutoReply - 智能回复助手   # ← 一般不需要改
executableName: AutoReply                # ← 一般不需要改
```

| 字段 | 说明 | 是否常需修改 |
|------|------|-------------|
| `appId` | 安装包唯一标识符 | 否 |
| `productName` | 安装后显示的产品名称 | 否 |
| `executableName` | 可执行文件名 | 否 |

### 3. `src/renderer/src/i18n.ts`（UI 显示版本）

```typescript
zh: {
    'app.version': 'v0.1.0',   // ← 可选：更新 UI 显示的版本字符串
    ...
},
en: {
    'app.version': 'v0.1.0',
    ...
}
```

> 注意：此字段仅用于界面显示，与实际版本号无强制绑定。

---

## 二、完整发布新版本的步骤

### Step 1：修改版本号

编辑上述文件中的版本号。假设从 `v1.0.0` 升级到 `v1.0.1`：

**`package.json`**：
```diff
- "version": "1.0.0"
+ "version": "1.0.1"
```

### Step 2：构建验证

```bash
npm run build
npm run dev        # 开发模式测试
```

确认功能正常后再进行下一步。

### Step 3：创建 Git Tag 并推送

```bash
git add -A
git commit -m "release: bump version to v1.0.1"

git tag -a v1.0.1 -m "AutoReply v1.0.1"
git push origin main --tags
```

### Step 4：构建安装包

```bash
# Windows
npm run build:win

# macOS (如需)
npm run build:mac

# Linux (如需)
npm run build:linux
```

构建产物位于：
- Windows: `dist/` 目录下的 `.exe` 安装包和 `.exe` 便携版
- macOS: `dist/` 目录下的 `.dmg`
- Linux: `dist/` 目录下的 `.AppImage` / `.deb` / `.rpm`

### Step 5：创建 GitHub Release

打开 https://github.com/DreDabe/auto-reply/releases/new ，选择 tag `v1.0.1`，填写 release description（参考 `docs/release_description.md`），上传构建产物。

---

## 三、注意事项

1. **版本号格式**：遵循 [SemVer](https://semver.org/lang/zh-CN/) 规范（主版本.次版本.修订号）
2. **Tag 命名规范**：统一使用 `v` + 版本号格式（如 `v1.0.1`、`v2.0.0-beta`）
3. **Git Tag 与 package.json version 保持一致**
4. **构建前务必先运行 `npm run build` 验证通过**
5. **如果修改了 `package-lock.json` 中的 name 字段**（项目重命名场景），需先删除 `node_modules` 后重新 `npm install` 再构建
