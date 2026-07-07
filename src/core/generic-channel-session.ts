import { DesktopDevice } from './device'
import { ChannelContext, ChannelSession, ProviderEvent, SessionEvent } from './session-types'
import { SentimentResult } from './sentiment/types'

export interface ModeHandler {
  modeId: string
  modeName: string
  prompt: string
  autoReply: boolean
  sentimentEnabled: boolean
  unifiedPrefix: string
  replyModelHasVision: boolean
  userInput: string
  objectRelation: string
  objectTitle: string
  onRecommendReply: (text: string) => void
  onLog: (type: 'thinking' | 'reply' | 'skip' | 'error', content: string) => void
  onStandbyChange: (standby: boolean) => void
  onPendingChange: (pending: boolean) => void
}

export interface SystemChannelState {
  measuredAt: number | null
  latestChatBaseline: number | null
  currentContactName: string
  currentModeId: string | null
  standby: boolean
  standbySince: number | null
  standbyRetryCount: number
  lastExtractedText: string | null
  consecutiveNoChangeRounds: number
}

export function createInitialSystemChannelState(): SystemChannelState {
  return {
    measuredAt: null,
    latestChatBaseline: null,
    currentContactName: '',
    currentModeId: null,
    standby: false,
    standbySince: null,
    standbyRetryCount: 0,
    lastExtractedText: null,
    consecutiveNoChangeRounds: 0
  }
}

export class GenericChannelSession implements ChannelSession<SystemChannelState> {
  private readonly retryDelayMs = 5000
  private readonly standbyThreshold = 2
  private readonly maxStandbyDelayMs = 60000
  private consecutiveUnreadFailures = 0
  private readonly modeHandlers = new Map<string, ModeHandler>()
  private activeHandler: ModeHandler | null = null

  constructor(private readonly device: DesktopDevice) {}

  registerModeHandler(handler: ModeHandler): void {
    this.modeHandlers.set(handler.modeId, handler)
  }

  unregisterModeHandler(modeId: string): void {
    const handler = this.modeHandlers.get(modeId)
    if (handler) {
      handler.onStandbyChange(false)
      handler.onPendingChange(false)
    }
    this.modeHandlers.delete(modeId)
    if (this.activeHandler?.modeId === modeId) {
      this.activeHandler = null
    }
  }

  updateModeAutoReply(modeId: string, autoReply: boolean): void {
    const handler = this.modeHandlers.get(modeId)
    if (handler) {
      handler.autoReply = autoReply
    }
  }

  updateModeUserInput(modeId: string, userInput: string): void {
    const handler = this.modeHandlers.get(modeId)
    console.log(`[GenericChannelSession] updateModeUserInput: modeId=${modeId}, userInput="${userInput?.slice(0, 80) || ''}", handlerFound=${!!handler}`)
    if (handler) {
      handler.userInput = userInput
    }
  }

  getRunningModeIds(): string[] {
    return Array.from(this.modeHandlers.keys())
  }

  isModeRunning(modeId: string): boolean {
    return this.modeHandlers.has(modeId)
  }

  forceExitStandby(modeId: string): void {
    const ctx = this._context
    if (!ctx || !ctx.state.standby) return
    ctx.state.standby = false
    ctx.state.standbySince = null
    ctx.state.standbyRetryCount = 0
    ctx.state.consecutiveNoChangeRounds = 0
    for (const handler of this.modeHandlers.values()) {
      handler.onStandbyChange(false)
      handler.onPendingChange(false)
    }
    const handler = this.modeHandlers.get(modeId)
    handler?.onLog('thinking', '用户操作，退出待机状态')
    this.device.clearChatBaseline()
    ctx.state.latestChatBaseline = 0
    ctx.host.enqueue({ type: 'observe_chat' })
  }

  private _context: ChannelContext<SystemChannelState> | null = null

  async onStart(ctx: ChannelContext<SystemChannelState>): Promise<void> {
    this._context = ctx
    this.device.setAppType(ctx.appType)
    this.device.clearChatBaseline()
    this.consecutiveUnreadFailures = 0
    this.resetState(ctx.state)
    await this.device.onSessionStart?.()
    ctx.host.enqueue({ type: 'bootstrap' })
  }

  async onStop(ctx: ChannelContext<SystemChannelState>): Promise<void> {
    this._context = null
    this.device.clearChatBaseline()
    this.consecutiveUnreadFailures = 0
    for (const handler of this.modeHandlers.values()) {
      handler.onStandbyChange(false)
      handler.onPendingChange(false)
    }
    await this.device.onSessionStop?.()
    this.resetState(ctx.state)
  }

  async onEvent(event: SessionEvent, ctx: ChannelContext<SystemChannelState>): Promise<void> {
    this._context = ctx
    this.device.setAppType(ctx.appType)

    switch (event.type) {
      case 'bootstrap': {
        ctx.host.log('thinking', '正在识别聊天窗口布局...')
        const measureStart = Date.now()
        const result = await this.device.measureLayout()

        if (!result.success) {
          ctx.host.log('error', `${result.error || '界面识别失败'}，引擎无法启动`)
          ctx.host.trace({
            phase: 'observe',
            summary: '识别聊天窗口布局',
            action: { kind: 'measure' },
            outcome: {
              status: 'fail',
              detail: result.error || '界面识别失败',
              latencyMs: Date.now() - measureStart
            }
          })
          await ctx.host.stopSession('bootstrap_failed')
          return
        }

        ctx.state.measuredAt = Date.now()
        ctx.host.log('thinking', '聊天窗口识别完成')
        ctx.host.trace({
          phase: 'observe',
          summary: '识别聊天窗口布局',
          action: { kind: 'measure' },
          outcome: { status: 'ok', latencyMs: Date.now() - measureStart }
        })
        ctx.host.enqueue({ type: 'observe_chat' })
        break
      }

      case 'observe_chat': {
        const screenshot = await this.device.screenshot()
        ctx.host.trace({
          phase: 'observe',
          summary: '截取当前聊天窗口',
          screenshotBase64: screenshot
        })

        let contactName = ''
        try {
          contactName = await ctx.host.identifyContact(screenshot)
          if (contactName) {
            ctx.host.log('thinking', `识别到对话对象: ${contactName}`)
          }
        } catch {
          ctx.host.log('thinking', '对话对象识别失败，使用默认模式')
        }

        ctx.state.currentContactName = contactName
        const resolvedMode = contactName ? ctx.host.resolveMode(contactName) : null
        const targetHandler = this.resolveHandler(resolvedMode)

        if (!targetHandler) {
          ctx.host.log('skip', '无可用模式处理此对话，跳过')
          await this.device.setChatBaseline()
          ctx.state.latestChatBaseline = Date.now()
          ctx.host.enqueue({ type: 'check_unread' })
          break
        }

        this.clearPendingStates()
        this.activeHandler = targetHandler

        ctx.state.currentModeId = targetHandler.modeId
        ctx.host.log('thinking', `路由到模式: ${targetHandler.modeName}`)

        void this.forwardProviderEvents(screenshot, ctx, targetHandler)
        break
      }

      case 'provider.thinking':
        ctx.host.log('thinking', event.content)
        ctx.host.trace({
          phase: 'think',
          summary: event.content,
          reasoning: { content: event.content }
        })
        break

      case 'provider.reply_text': {
        const handler = this.activeHandler
        if (!handler) {
          ctx.host.enqueue({ type: 'check_unread' })
          break
        }

        let replyText = event.content
        if (handler.unifiedPrefix) {
          replyText = handler.unifiedPrefix + replyText
        }
        handler.onRecommendReply(replyText)
        handler.onPendingChange(false)

        if (handler.autoReply) {
          ctx.state.consecutiveNoChangeRounds = 0
          const sendStart = Date.now()
          await this.device.sendMessage(replyText)
          handler.onLog('reply', replyText)
          ctx.host.trace({
            phase: 'act',
            summary: '自动发送回复',
            action: { kind: 'send', payload: replyText },
            outcome: { status: 'ok', latencyMs: Date.now() - sendStart }
          })
          await this.device.setChatBaseline()
          ctx.state.latestChatBaseline = Date.now()
          ctx.host.enqueue({ type: 'check_unread' })
        } else {
          handler.onLog('reply', `[推荐回复] ${replyText}`)
          ctx.host.trace({
            phase: 'act',
            summary: '生成推荐回复（未自动发送）',
            action: { kind: 'send', payload: replyText },
            outcome: { status: 'skip', detail: 'autoReply off' }
          })
          await this.device.setChatBaseline()
          ctx.state.latestChatBaseline = Date.now()
          this.enterStandby(ctx)
          ctx.host.enqueue({ type: 'wait_retry', reason: 'standby', delayMs: this.retryDelayMs })
        }
        break
      }

      case 'provider.skip':
        ctx.host.log('skip', '本轮无需回复')
        ctx.host.trace({
          phase: 'think',
          summary: '判断本轮无需回复',
          outcome: { status: 'skip' }
        })
        if (this.activeHandler) {
          this.activeHandler.onPendingChange(false)
        }
        await this.device.setChatBaseline()
        ctx.state.latestChatBaseline = Date.now()
        ctx.host.enqueue({ type: 'check_unread' })
        break

      case 'provider.error':
        ctx.host.log('error', `回复服务异常：${event.error}`)
        ctx.host.trace({
          phase: 'think',
          summary: '回复服务异常',
          outcome: { status: 'fail', detail: event.error }
        })
        if (this.activeHandler) {
          this.activeHandler.onPendingChange(false)
        }
        ctx.host.enqueue({
          type: 'wait_retry',
          reason: 'provider_error',
          delayMs: this.retryDelayMs
        })
        break

      case 'check_unread': {
        const diffResult = await this.device.hasChatAreaChanged()

        if (ctx.state.standby) {
          if (diffResult.hasDiff) {
            if (ctx.host.extractChatText && ctx.state.lastExtractedText) {
              try {
                const screenshot = await this.device.screenshot()
                const currentText = await ctx.host.extractChatText(screenshot)
                if (currentText && currentText.trim() !== ctx.state.lastExtractedText.trim()) {
                  ctx.host.log('thinking', '检测到对话内容有变化，退出待机状态')
                  this.exitStandby(ctx)
                  ctx.host.enqueue({ type: 'observe_chat' })
                  break
                } else {
                  ctx.host.log('skip', '像素变化但对话内容未变，继续待机')
                }
              } catch {
                ctx.host.log('skip', '文本提取失败，继续待机')
              }
            } else {
              ctx.host.log('thinking', '检测到对话有变化，退出待机状态')
              this.exitStandby(ctx)
              ctx.host.enqueue({ type: 'observe_chat' })
              break
            }
          }
          ctx.state.standbyRetryCount += 1
          const delay = this.getStandbyDelay(ctx.state.standbyRetryCount)
          ctx.host.enqueue({ type: 'wait_retry', reason: 'standby', delayMs: delay })
          break
        }

        if (diffResult.hasDiff) {
          ctx.state.consecutiveNoChangeRounds = 0
          ctx.host.log('thinking', '检测到当前对话有新消息')
          ctx.host.trace({
            phase: 'verify',
            summary: '检测到当前对话有新消息',
            outcome: { status: 'ok' }
          })
          ctx.host.enqueue({ type: 'observe_chat' })
          break
        }

        ctx.state.consecutiveNoChangeRounds += 1

        const activeNeedsAttention = this.activeHandler && !this.activeHandler.autoReply
        if (activeNeedsAttention && ctx.state.consecutiveNoChangeRounds >= this.standbyThreshold) {
          this.enterStandby(ctx)
          ctx.host.enqueue({ type: 'wait_retry', reason: 'standby', delayMs: this.retryDelayMs })
          break
        }

        const unreadResult = await this.device.hasUnreadMessage()
        if (!unreadResult.hasUnread) {
          ctx.host.enqueue({
            type: 'wait_retry',
            reason: 'no_unread',
            delayMs: this.retryDelayMs
          })
          break
        }

        const chatEntranceCoords = unreadResult.chatEntranceArea?.coordinates
        if (!chatEntranceCoords) {
          ctx.host.log('error', '检测到未读消息，但未找到聊天入口位置')
          ctx.host.enqueue({
            type: 'wait_retry',
            reason: 'missing_chat_entrance',
            delayMs: this.retryDelayMs
          })
          break
        }

        ctx.host.log('thinking', '检测到未读消息，正在尝试打开会话')
        ctx.host.trace({
          phase: 'act',
          summary: '点击未读会话入口',
          action: { kind: 'click', target: chatEntranceCoords },
          outcome: { status: 'ok' }
        })
        await this.device.activeUnreadByClick(chatEntranceCoords)
        await this.sleep(150 + Math.random() * 100)

        const openResult = await this.tryOpenUnreadConversation(ctx)
        if (openResult === 'opened') {
          ctx.host.enqueue({ type: 'observe_chat' })
          break
        }

        ctx.host.enqueue({
          type: 'wait_retry',
          reason: openResult,
          delayMs: this.retryDelayMs
        })
        break
      }

      case 'wait_retry':
        ctx.host.log('skip', '等待下一轮未读检测')
        ctx.host.schedule(
          event.reason === 'provider_error' ? { type: 'observe_chat' } : { type: 'check_unread' },
          event.delayMs ?? this.retryDelayMs
        )
        break
    }
  }

  private resolveHandler(
    resolvedMode: { modeId: string; modeName: string; prompt: string; autoReply: boolean; sentimentEnabled: boolean; unifiedPrefix: string; objectRelation: string; objectTitle: string } | null
  ): ModeHandler | null {
    if (resolvedMode) {
      const handler = this.modeHandlers.get(resolvedMode.modeId)
      if (handler) {
        handler.prompt = resolvedMode.prompt
        handler.autoReply = resolvedMode.autoReply
        handler.sentimentEnabled = resolvedMode.sentimentEnabled
        handler.unifiedPrefix = resolvedMode.unifiedPrefix
        handler.objectRelation = resolvedMode.objectRelation
        handler.objectTitle = resolvedMode.objectTitle
        return handler
      }
    }

    if (this.modeHandlers.size > 0) {
      return this.modeHandlers.values().next().value!
    }

    return null
  }

  private clearPendingStates(): void {
    for (const handler of this.modeHandlers.values()) {
      handler.onPendingChange(false)
    }
  }

  private async forwardProviderEvents(
    screenshot: string,
    ctx: ChannelContext<SystemChannelState>,
    handler: ModeHandler
  ): Promise<void> {
    try {
      let sentimentResult: SentimentResult | undefined
      let extractedText: string | undefined

      const needExtractText = !handler.replyModelHasVision || handler.sentimentEnabled
      if (needExtractText && ctx.host.extractChatText) {
        try {
          handler.onLog('thinking', '正在提取聊天文本...')
          const text = await ctx.host.extractChatText(screenshot)
          if (text) {
            extractedText = text
            ctx.state.lastExtractedText = text
            if (handler.sentimentEnabled && ctx.host.classifySentiment) {
              handler.onLog('thinking', '正在进行情感分析...')
              sentimentResult = await ctx.host.classifySentiment(text)
              const maxProb = Math.max(...(sentimentResult.probabilities || []))
              if (sentimentResult.classIndex === 0) {
                handler.onLog('thinking', `情感分析结果：${sentimentResult.className}（${(maxProb * 100).toFixed(1)}%），无需情感关怀`)
              } else {
                handler.onLog('thinking', `情感分析结果：${sentimentResult.className}（${(maxProb * 100).toFixed(1)}%），将注入情感关怀指令`)
              }
            }
          } else {
            handler.onLog('thinking', '未提取到聊天文本')
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          handler.onLog('error', `文本提取/情感分析失败：${msg}`)
        }
      }

      for await (const event of ctx.host.runProvider({
        screenshot,
        appType: ctx.appType,
        currentContact: ctx.state.currentContactName || undefined,
        ...(handler.prompt ? { customPrompt: handler.prompt } : {}),
        ...(sentimentResult ? { sentimentResult } : {}),
        ...(extractedText ? { extractedText } : {}),
        ...(handler.userInput ? { userInput: handler.userInput } : {}),
        ...(handler.objectRelation ? { objectRelation: handler.objectRelation } : {}),
        ...(handler.objectTitle ? { objectTitle: handler.objectTitle } : {})
      })) {
        if (!ctx.host.isRunning()) break

        const sessionEvent = this.mapProviderEvent(event)
        if (sessionEvent) {
          ctx.host.enqueue(sessionEvent)
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      ctx.host.enqueue({ type: 'provider.error', error: message })
    }
  }

  private mapProviderEvent(event: ProviderEvent): SessionEvent | null {
    switch (event.type) {
      case 'thinking':
        return { type: 'provider.thinking', content: event.content }
      case 'reply_text':
        return { type: 'provider.reply_text', content: event.content }
      case 'skip':
        return { type: 'provider.skip' }
      case 'error':
        return { type: 'provider.error', error: event.error }
      default:
        return null
    }
  }

  private resetState(state: SystemChannelState): void {
    state.measuredAt = null
    state.latestChatBaseline = null
    state.currentContactName = ''
    state.currentModeId = null
    state.standby = false
    state.standbySince = null
    state.standbyRetryCount = 0
    state.lastExtractedText = null
    state.consecutiveNoChangeRounds = 0
  }

  private enterStandby(ctx: ChannelContext<SystemChannelState>): void {
    if (ctx.state.standby) return
    ctx.state.standby = true
    ctx.state.standbySince = Date.now()
    ctx.state.standbyRetryCount = 0
    ctx.host.log('skip', '已进入待机状态，等待用户操作或对话变化')
    for (const handler of this.modeHandlers.values()) {
      if (handler === this.activeHandler) {
        handler.onPendingChange(true)
      } else {
        handler.onStandbyChange(true)
      }
    }
  }

  private exitStandby(ctx: ChannelContext<SystemChannelState>): void {
    if (!ctx.state.standby) return
    ctx.state.standby = false
    ctx.state.standbySince = null
    ctx.state.standbyRetryCount = 0
    ctx.state.consecutiveNoChangeRounds = 0
    for (const handler of this.modeHandlers.values()) {
      handler.onStandbyChange(false)
      handler.onPendingChange(false)
    }
  }

  private getStandbyDelay(retryCount: number): number {
    if (retryCount <= 1) return 5000
    if (retryCount === 2) return 10000
    if (retryCount === 3) return 20000
    return this.maxStandbyDelayMs
  }

  private async tryOpenUnreadConversation(
    ctx: ChannelContext<SystemChannelState>
  ): Promise<'opened' | 'contact_not_ready'> {
    let contactResult = await this.device.isChatContactUnread()

    if (!contactResult.isUnread) {
      ctx.host.log('thinking', '当前会话没有新消息，正在重新检测...')
      await this.sleep(1000)

      const recheckResult = await this.device.hasUnreadMessage()
      const recheckCoords = recheckResult.chatEntranceArea?.coordinates

      if (!recheckResult.hasUnread || !recheckCoords) {
        ctx.host.log('skip', '重新检测后无未读消息，等待下一轮')
        return 'contact_not_ready'
      }

      ctx.host.log('thinking', '仍检测到未读消息，正在再次尝试打开会话')
      await this.device.activeUnreadByClick(recheckCoords)
      await this.sleep(500)
      contactResult = await this.device.isChatContactUnread()
    }

    if (!contactResult.isUnread) {
      this.consecutiveUnreadFailures += 1

      if (this.consecutiveUnreadFailures >= 3) {
        ctx.host.log(
          'thinking',
          `连续 ${this.consecutiveUnreadFailures} 次检测失败，正在重置未读识别状态`
        )
        this.device.clearUnreadCache()
        this.consecutiveUnreadFailures = 0
        await this.sleep(500)

        contactResult = await this.device.isChatContactUnread()
        if (!contactResult.isUnread) {
          ctx.host.log('thinking', '重置后仍未成功，正在再次尝试打开会话')
          const retryUnread = await this.device.hasUnreadMessage()
          const retryCoords = retryUnread.chatEntranceArea?.coordinates

          if (!retryUnread.hasUnread || !retryCoords) {
            ctx.host.log('skip', '重置后仍未找到可用会话入口，等待下一轮')
            return 'contact_not_ready'
          }

          await this.device.activeUnreadByClick(retryCoords)
          await this.sleep(500)
          contactResult = await this.device.isChatContactUnread()

          if (!contactResult.isUnread) {
            ctx.host.log('skip', '最终检测仍失败，放弃当前轮未读切换')
            return 'contact_not_ready'
          }
        }
      } else {
        ctx.host.log(
          'skip',
          `会话切换检测失败（第 ${this.consecutiveUnreadFailures} 次），等待下一轮`
        )
        return 'contact_not_ready'
      }
    }

    this.consecutiveUnreadFailures = 0

    if (!contactResult.firstContactCoords) {
      ctx.host.log('skip', '未找到联系人位置，等待下一轮')
      return 'contact_not_ready'
    }

    ctx.host.log('thinking', '正在打开未读会话')
    ctx.host.trace({
      phase: 'act',
      summary: '打开未读会话',
      action: { kind: 'click', target: contactResult.firstContactCoords },
      outcome: { status: 'ok' }
    })
    await this.device.clickUnreadContact(contactResult.firstContactCoords)
    await this.sleep(500 + Math.random() * 300)
    this.device.clearChatBaseline()
    ctx.state.latestChatBaseline = null
    return 'opened'
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
