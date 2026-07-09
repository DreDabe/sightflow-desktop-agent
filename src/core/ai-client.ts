// src/core/ai-client.ts
// AI 客户端 — 统一封装所有大模型调用
//
// 使用火山引擎 Ark OpenAI 兼容 /chat/completions 端点 + doubao-seed-2-0-lite
// 两种用途：
//   1. 聊天回复：截图 → AI 分析 → 回复文字
//   2. VLM 视觉检测：截图 → AI 分析 → bbox/point 坐标

import { MemoryCardBrief } from './trace/trace-types'

export interface AIClientConfig {
  apiKey: string
  model: string
  baseURL: string
  systemPrompt: string
}

/** 把经验卡片拼成 system prompt 附加段（与内置 provider bundle 的格式保持一致） */
export function buildMemorySection(memoryCards?: MemoryCardBrief[]): string {
  if (!memoryCards || memoryCards.length === 0) return ''
  const lines = memoryCards.map((card, index) => {
    const rationale = card.rationale ? `（原因：${card.rationale}）` : ''
    return `${index + 1}. 【${card.scenario}】${card.guidance}${rationale}`
  })
  return `\n\n## 团队经验（来自工作记忆，优先遵循）\n${lines.join('\n')}`
}

export interface ContextSectionOptions {
  objectRelation?: string
  objectTitle?: string
  userInput?: string
}

export function buildContextSection(options: ContextSectionOptions): string {
  const parts: string[] = []
  if (options.objectRelation?.trim()) {
    parts.push(`## 对话双方关系（必须遵守）
对话双方关系：${options.objectRelation.trim()}
规则：回复中必须体现双方"${options.objectRelation.trim()}"的关系特征，站在己方角度给出回复，语气和措辞需符合该关系。`)
  }
  if (options.objectTitle?.trim()) {
    parts.push(`## 对对方标准称呼（必须遵守）
对对方标准称呼：${options.objectTitle.trim()}
规则：回复中必须使用"${options.objectTitle.trim()}"统一称呼对方，不可替换为其他称呼、不可省略。`)
  }
  if (options.userInput?.trim()) {
    parts.push(`## 我方基础原始回复
我方基础原始回复内容：${options.userInput.trim()}
规则：
1. 请以上述"我方基础原始回复内容"为核心文本进行修饰和完善，不可偏离其原意；
2. 仅在基础文本上做语气、措辞的风格修饰（由回复模式专属规则决定），禁止自行发挥或另起回复；
3. 基础文本的核心语义和信息可进行恰当删减、替换或改写，对原句进行润色表达方式。`)
  }
  if (parts.length === 0) return ''
  return '\n\n' + parts.join('\n\n')
}

const DEFAULT_MODEL = 'doubao-seed-2-0-lite-260215'
const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

const REPLY_SYSTEM_PROMPT = `你是一个微信/企业微信自动回复助手，输入为聊天窗口截图识别后的对话文本内容。

## 核心任务
识别对话最新消息发送方、消息类型，结合配套回复模式规则生成符合场景的真人回复文本。

## 强制执行规则（优先级最高，所有回复模式必须遵守，不可覆盖）
1. 输出格式：只输出最终回复文字本身。禁止输出以下任何内容：分析过程、推理过程、解释说明、消息摘要、标签前缀（如【xxx回复】）、分段标注。正确示例："好的，明天见"；错误示例："收到对方消息，可以这样回复：好的，明天见"或"【高情商回复】好的，明天见"；
2. 防循环机制：区分消息归属，右侧气泡为我方发送内容。若对话最后一条消息为我方发出，直接输出固定标识 [SKIP]；
3. 无效消息拦截：最新消息为系统通知、群公告、红包、转账、撤回、文件自动提醒等非人工对话消息，直接输出 [SKIP]；
4. 模糊判定兜底：无法确认是否需要回复、对话上下文缺失、识别内容残缺时，统一输出 [SKIP]；
5. 话术基础要求：回复贴合日常微信口语，自然真实，避免生硬书面公文感；
6. 基础回复优先：当系统提示词中存在"我方基础原始回复"时，无论聊天内容为何，必须基于该基础回复输出修饰后的文本，禁止输出 [SKIP]。

## 补充说明
本系统会追加独立【回复模式专属规则】模块，所有回复生成逻辑以该模块规则为风格约束，本基础规则仅做底层拦截与输出限制。`

export class AIClient {
  private config: AIClientConfig

  constructor(config: Partial<AIClientConfig> & { apiKey: string }) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model || DEFAULT_MODEL,
      baseURL: config.baseURL || DEFAULT_BASE_URL,
      systemPrompt: config.systemPrompt || REPLY_SYSTEM_PROMPT
    }
  }

  /**
   * 发送截图给 AI，获取聊天回复
   * memoryCards: 运行时注入的经验卡片（工作记忆），拼入 system prompt
   */
  async getReply(screenshotBase64: string, memoryCards?: MemoryCardBrief[]): Promise<string | null> {
    const systemPrompt = this.config.systemPrompt + buildMemorySection(memoryCards)
    return this.getReplyWithPrompt(systemPrompt, screenshotBase64)
  }

  getSystemPrompt(): string {
    return this.config.systemPrompt
  }

  async getReplyWithPrompt(systemPrompt: string, screenshotBase64: string, extractedText?: string, userInput?: string): Promise<string | null> {
    const startTime = Date.now()
    try {
      console.log('[AIClient] getReply 开始...')
      let userPrompt = ''
      if (userInput?.trim()) {
        userPrompt = `【最高优先级指令】下方已提供"我方基础原始回复"，你必须直接输出该内容的修饰版本作为最终回复。禁止忽略、禁止自行生成其他回复内容。如果聊天内容与基础回复无关，仍以基础回复为准。\n\n我方基础原始回复：${userInput.trim()}\n\n---\n\n`
      }
      userPrompt += (extractedText
        ? `请根据以下聊天内容进行回复：\n${extractedText}`
        : '请根据截图中微信聊天窗口的最新消息进行回复。')
      const replyText = await this.callVision(
        systemPrompt,
        userPrompt,
        screenshotBase64
      )

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`[AIClient] getReply 完成 (${elapsed}s):`, replyText?.slice(0, 100))

      if (!replyText || replyText.trim() === '[SKIP]') {
        return null
      }

      return replyText.trim()
    } catch (error: any) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.error(`[AIClient] 聊天回复失败 (${elapsed}s):`, error?.message || error)
      throw error
    }
  }

  async getTextReply(systemPrompt: string, extractedText: string, userInput?: string): Promise<string | null> {
    const startTime = Date.now()
    try {
      console.log('[AIClient] getTextReply 开始...')
      let userPrompt = ''
      if (userInput?.trim()) {
        userPrompt = `【最高优先级指令】下方已提供"我方基础原始回复"，你必须直接输出该内容的修饰版本作为最终回复。禁止忽略、禁止自行生成其他回复内容。如果聊天内容与基础回复无关，仍以基础回复为准。\n\n我方基础原始回复：${userInput.trim()}\n\n---\n\n`
      }
      userPrompt += `请根据以下聊天内容进行回复：\n${extractedText}`
      const replyText = await this.callTextInternal(
        systemPrompt,
        userPrompt
      )

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`[AIClient] getTextReply 完成 (${elapsed}s):`, replyText?.slice(0, 100))

      if (!replyText || replyText.trim() === '[SKIP]') {
        return null
      }

      return replyText.trim()
    } catch (error: any) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.error(`[AIClient] 文本回复失败 (${elapsed}s):`, error?.message || error)
      throw error
    }
  }

  /**
   * 从聊天窗口截图中提取对方发送的所有可见消息文本
   * 用于情感分类，提取对方（左侧气泡）的所有可见消息
   */
  async extractChatText(screenshotBase64: string): Promise<string> {
    const EXTRACT_SYSTEM_PROMPT = '你是一个聊天内容提取专家，严格按照用户要求的格式输出。'
    const EXTRACT_USER_PROMPT = `你会收到一张微信/企业微信的聊天窗口截图。

## 你的任务
提取截图中对方（左侧气泡）发送的所有可见消息的纯文本内容。

## 规则
1. 按从新到旧的顺序提取对方的消息，每条消息用换行分隔
2. 只输出提取到的文字，不要添加任何解释、标注或序号
3. 忽略右侧气泡（"我"发送的消息）
4. 忽略系统消息、时间标签等非对话内容
5. 如果无法识别文字内容，输出空字符串
6. 如果对方消息很长，尽量完整提取`

    try {
      const result = await this.callVision(EXTRACT_SYSTEM_PROMPT, EXTRACT_USER_PROMPT, screenshotBase64)
      return result.trim()
    } catch (error: any) {
      console.error('[AIClient] 聊天文本提取失败:', error?.message || error)
      return ''
    }
  }

  /**
   * VLM 视觉检测 — 发送截图 + prompt，获取 bbox/point 文本
   * 供 vision-utils.ts 调用
   */
  async detectVision(prompt: string, screenshotBase64: string): Promise<string> {
    return await this.callVision(
      '你是一个视觉分析专家。请严格按照用户要求的格式输出检测结果。',
      prompt,
      screenshotBase64
    )
  }

  async detectContactName(screenshotBase64: string): Promise<string> {
    const DETECT_CONTACT_PROMPT = `你会收到一张微信/企业微信的聊天窗口截图。

## 你的任务
识别当前聊天窗口的对话对象名称（即顶部标题栏中的联系人名称）。

## 规则
1. 只输出联系人名称，不要添加任何解释或标注
2. 如果是群聊，输出群名称
3. 如果无法识别，输出空字符串
4. 名称要完整，不要截断`

    try {
      const result = await this.callVision(
        '你是一个聊天窗口分析专家。请严格按照用户要求的格式输出。',
        DETECT_CONTACT_PROMPT,
        screenshotBase64
      )
      return result.trim()
    } catch (error: any) {
      console.error('[AIClient] 联系人名称识别失败:', error?.message || error)
      return ''
    }
  }

  /**
   * 纯文本调用（不带图片）— 用于 testConnection 等
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.callTextInternal('你是一个测试助手', '你好，请回复"连接成功"。')
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) }
    }
  }

  updateConfig(config: Partial<AIClientConfig>): void {
    Object.assign(this.config, config)
  }

  getApiKey(): string {
    return this.config.apiKey
  }

  // ── 内部方法 ──

  /**
   * 视觉调用：system prompt + 用户文本 + 图片
   */
  private async callVision(
    systemPrompt: string,
    userText: string,
    imageBase64: string
  ): Promise<string> {
    const rawBase64 = this.stripBase64Prefix(imageBase64)
    const imageUrl = rawBase64.startsWith('http')
      ? rawBase64
      : `data:image/png;base64,${rawBase64}`

    try {
      const data = await this.callAPI([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: userText }
          ]
        }
      ])

      return this.extractText(data)
    } catch (error: any) {
      const msg = error?.message || ''
      if (msg.includes('image_url') || msg.includes('image') && msg.includes('variant')) {
        throw new Error(
          `当前模型 (${this.config.model}) 不支持图片输入，请更换为支持视觉能力的模型（如 doubao-seed-2-0-lite-260215、gpt-4o 等）。原始错误: ${msg}`
        )
      }
      throw error
    }
  }

  private async callTextInternal(
    systemPrompt: string,
    userText: string
  ): Promise<string> {
    const data = await this.callAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText }
    ])
    return this.extractText(data)
  }

  /**
   * 底层 HTTP 调用 — OpenAI 兼容 /chat/completions 端点
   * thinking 字段是火山方舟对标 OpenAI Responses API 的扩展参数，
   * 在非火山供应商上会被忽略，放在这里不影响兼容性
   */
  private async callAPI(messages: any[], timeoutMs?: number): Promise<any> {
    const url = `${this.config.baseURL}/chat/completions`
    const TIMEOUT_MS = timeoutMs ?? 60_000
    const callStart = Date.now()

    // 计算 payload 大小（粗略，不重复序列化）
    const bodyStr = JSON.stringify({
      model: this.config.model,
      messages,
      thinking: { type: 'disabled' },
      stream: false
    })

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: bodyStr,
        signal: controller.signal
      })

      const fetchElapsed = ((Date.now() - callStart) / 1000).toFixed(1)
      console.log(`[AIClient] 收到响应 status=${response.status} (${fetchElapsed}s)`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[AIClient] API 错误: ${response.status}`, errorText)
        throw new Error(`API request failed: ${response.status} - ${errorText.slice(0, 200)}`)
      }

      const json = await response.json()
      const totalElapsed = ((Date.now() - callStart) / 1000).toFixed(1)
      console.log(`[AIClient] 解析完成 (${totalElapsed}s)`)
      return json
    } catch (error: any) {
      const elapsed = ((Date.now() - callStart) / 1000).toFixed(1)
      if (error?.name === 'AbortError') {
        console.error(`[AIClient] ⏱ 超时！已等待 ${elapsed}s，上限 ${TIMEOUT_MS / 1000}s`)
        throw new Error(`AI API 请求超时 (${TIMEOUT_MS / 1000}s)`)
      }
      console.error(`[AIClient] 请求异常 (${elapsed}s):`, error?.message)
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * 从 OpenAI 兼容 /chat/completions 返回值中提取文本
   * 格式: { choices: [{ message: { role, content: string } }] }
   */
  private extractText(responseData: any): string {
    const content = responseData?.choices?.[0]?.message?.content
    if (typeof content === 'string' && content.length > 0) {
      return this.stripReasoningTags(content)
    }
    console.warn('[AIClient] 无法解析回复格式:', JSON.stringify(responseData).slice(0, 500))
    return ''
  }

  private stripReasoningTags(text: string): string {
    let result = text
    result = result.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    result = result.replace(/<reflection>[\s\S]*?<\/reflection>/gi, '')
    result = result.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    const thinkBlockRegex = /^[\s\S]*?<\/think>\s*/
    if (thinkBlockRegex.test(result)) {
      result = result.replace(thinkBlockRegex, '')
    }
    result = result.trim()
    return result
  }

  private stripBase64Prefix(base64: string): string {
    const idx = base64.indexOf('base64,')
    return idx !== -1 ? base64.slice(idx + 'base64,'.length) : base64
  }
}
