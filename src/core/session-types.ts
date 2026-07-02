import { AppType } from './rpa/types'
import { SentimentResult } from './sentiment/types'
import { MemoryCardBrief, TraceStepInput } from './trace/trace-types'

export interface ProviderInput {
  screenshot: string
  appType: AppType
  currentContact?: string
  ocrText?: string
  /** 运行时注入的经验卡片（工作记忆）。Provider 可拼入 system prompt。 */
  memoryCards?: MemoryCardBrief[]
  /** 情感分类结果。Provider 可拼入 user prompt 实现情感关怀。 */
  sentimentResult?: SentimentResult
  /** 从截图中提取的聊天文本。当回复模型不支持视觉时，用此替代截图。 */
  extractedText?: string
}

export type ProviderEvent =
  | { type: 'thinking'; content: string }
  | { type: 'reply_text'; content: string }
  | { type: 'skip' }
  | { type: 'error'; error: string }

export type SessionEvent =
  | { type: 'bootstrap' }
  | { type: 'observe_chat' }
  | { type: 'provider.thinking'; content: string }
  | { type: 'provider.reply_text'; content: string }
  | { type: 'provider.skip' }
  | { type: 'provider.error'; error: string }
  | { type: 'check_unread' }
  | { type: 'wait_retry'; reason?: string; delayMs?: number }

export interface ProviderAdapter {
  run(input: ProviderInput): AsyncIterable<ProviderEvent>
}

export interface RuntimeHostControls {
  enqueue(event: SessionEvent): void
  schedule(event: SessionEvent, delayMs: number): void
  runProvider(input: ProviderInput): AsyncIterable<ProviderEvent>
  log(type: 'thinking' | 'reply' | 'skip' | 'error', content: string): void
  trace(step: TraceStepInput): void
  isRunning(): boolean
  stopSession(reason?: string): Promise<void>
  extractChatText?(screenshot: string): Promise<string>
  classifySentiment?(text: string): Promise<SentimentResult>
  getAutoReply(): boolean
  recommendReply(text: string): void
  identifyContact(screenshot: string): Promise<string>
  resolveMode(contactName: string): { modeId: string; modeName: string; prompt: string; autoReply: boolean; sentimentEnabled: boolean; unifiedPrefix: string } | null
  setAutoReply(autoReply: boolean): void
  notifyStandby?(standby: boolean): void
  exitStandby?(): void
}

export interface ChannelContext<TState> {
  appType: AppType
  state: TState
  host: RuntimeHostControls
}

export interface ChannelSession<TState> {
  onStart(ctx: ChannelContext<TState>): Promise<void>
  onStop(ctx: ChannelContext<TState>): Promise<void>
  onEvent(event: SessionEvent, ctx: ChannelContext<TState>): Promise<void>
}
