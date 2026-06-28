// src/main/overlay-window.ts
// 框选向导的主进程协调层。
//
// 职责：
//   1. 在用户触发框选时，按"目标显示器"创建一块全屏透明 BrowserWindow；
//   2. 通过 IPC 把"要画哪几步"告诉 renderer-overlay；
//   3. 收到 renderer 提交的最终矩形后，组装成 BoxRegions 返回给调用方（startEngineCore）。
//
// 不持久化状态：调用方收到结果后自行写 settings。窗口是一次性的，向导结束（完成 / 取消）就 destroy。
//
// 坐标系：renderer 在挂载时已经把 display.bounds.x/y 加回到 event.clientX/Y，因此从 renderer
// 收到的所有 ScreenRect 都是逻辑像素的"绝对屏幕坐标"。
//
// 端口：以 `wizardId` 串联多次开窗，避免迟到的 IPC 错配到下一次会话。

import { BrowserWindow, screen, ipcMain, type Display } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { AppType, BoxRegions, ScreenRect } from '../core/rpa/types'

// 'unreadIndicator' 步骤已下线 —— 见 OverlayApp.tsx 的注释。BoxSelectDevice
// 的 unreadIndicator 字段保留以便未来扩展，但 wizard 不再让用户框这一步。
export type WizardStepKey = 'contactList' | 'chatMain' | 'inputBox'

export interface WizardOpenOptions {
  appType: AppType
  // 哪些步骤要走向导。默认全部 4 步。已经存在的区域会作为 prefill 透传给 renderer 让它高亮提示。
  steps?: WizardStepKey[]
  prefill?: Partial<BoxRegions> | null
}

export interface WizardResult {
  ok: boolean
  reason?: 'cancelled' | 'closed' | 'error'
  regions?: BoxRegions
}

interface ActiveWizard {
  id: string
  window: BrowserWindow
  resolve: (result: WizardResult) => void
  finished: boolean
}

let active: ActiveWizard | null = null
let listenersBound = false
let nextId = 1

function genWizardId(): string {
  return `wizard-${Date.now()}-${nextId++}`
}

function pickWizardDisplay(): Display {
  const cursor = screen.getCursorScreenPoint()
  return screen.getDisplayNearestPoint(cursor)
}

function bindIpcOnce(): void {
  if (listenersBound) return
  listenersBound = true

  ipcMain.on('overlay-wizard:complete', (_evt, payload: { id: string; regions: BoxRegions }) => {
    if (!active || active.finished || active.id !== payload?.id) return
    active.finished = true
    active.resolve({ ok: true, regions: payload.regions })
    closeActive()
  })

  ipcMain.on('overlay-wizard:cancel', (_evt, payload: { id: string }) => {
    if (!active || active.finished || active.id !== payload?.id) return
    active.finished = true
    active.resolve({ ok: false, reason: 'cancelled' })
    closeActive()
  })
}

function closeActive(): void {
  if (!active) return
  try {
    if (!active.window.isDestroyed()) active.window.destroy()
  } catch {
    /* ignore */
  }
  active = null
}

export function isWizardOpen(): boolean {
  return active !== null && !active.finished
}

export async function runBoxSelectWizard(opts: WizardOpenOptions): Promise<WizardResult> {
  if (active && !active.finished) {
    return { ok: false, reason: 'error' }
  }

  bindIpcOnce()

  const display = pickWizardDisplay()
  const wizardId = genWizardId()

  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    focusable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // renderer ready 后注入参数；主进程在 did-finish-load 时再读一次 contentBounds，
  // 确保拿到的是系统让位（macOS 菜单栏 / Linux 装饰）之后的真实 client area。
  // 用 contentOriginAbs 而不是 display.bounds 作为 event.clientX/Y → 屏幕绝对坐标
  // 的偏移：mac 上 frameless + transparent 的 alwaysOnTop window 即使 bounds 设到
  // (0, 0)，client 区域也会被菜单栏推下 ~24-37px；当年用 display.bounds 当偏移
  // 会让所有 y 坐标整体偏小，反映到点击就是"输入框点到了上边缘"。
  const sendInit = (): void => {
    if (win.isDestroyed()) return
    const cb = win.getContentBounds()
    win.webContents.send('overlay-wizard:init', {
      id: wizardId,
      appType: opts.appType,
      steps: opts.steps ?? (['contactList', 'chatMain', 'inputBox'] as WizardStepKey[]),
      prefill: opts.prefill ?? null,
      display: {
        id: display.id,
        bounds: display.bounds,
        scaleFactor: display.scaleFactor
      },
      contentOriginAbs: { x: cb.x, y: cb.y }
    })
  }
  win.webContents.once('did-finish-load', sendInit)
  ipcMain.once(`overlay-wizard:request-init:${wizardId}`, sendInit)

  // overlay 是独立 renderer entry。dev 走 ELECTRON_RENDERER_URL/overlay.html，prod 走 file:。
  const overlayHtml = 'overlay.html'
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/${overlayHtml}`)
  } else {
    win.loadFile(join(__dirname, '../renderer', overlayHtml))
  }

  return await new Promise<WizardResult>((resolve) => {
    active = { id: wizardId, window: win, resolve, finished: false }

    win.on('closed', () => {
      if (active?.id === wizardId && !active.finished) {
        active.finished = true
        resolve({ ok: false, reason: 'closed' })
        active = null
      }
    })
  })
}

// 主进程内部辅助：根据 ScreenRect 数组的 displayId 一致性做基础校验。
// renderer 已经强制了"所有矩形落在同一显示器"，这里再次保险。
export function validateRegionsOnSameDisplay(regions: BoxRegions): {
  ok: boolean
  reason?: string
} {
  const rects: ScreenRect[] = [
    regions.contactList,
    regions.chatMain,
    regions.inputBox,
    ...(regions.unreadIndicator ? [regions.unreadIndicator] : [])
  ]
  const displayIds = new Set(
    rects.map(
      (r) =>
        screen.getDisplayMatching({
          ...r,
          width: Math.max(1, r.width),
          height: Math.max(1, r.height)
        }).id
    )
  )
  if (displayIds.size > 1) {
    return { ok: false, reason: '所有框选区域必须落在同一显示器' }
  }
  return { ok: true }
}
