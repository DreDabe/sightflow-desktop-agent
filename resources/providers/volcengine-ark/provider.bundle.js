const DEFAULT_MODEL = 'doubao-seed-2-0-lite-260215'
const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
const DEFAULT_PROMPT = `你是一个微信/企业微信自动回复助手，输入为聊天窗口截图识别后的对话文本内容。

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

export const manifest = {
  id: 'volcengine-ark',
  apiVersion: 1
}

export function createProvider(context) {
  const providerConfig = context && context.providerConfig ? context.providerConfig : {}

  return {
    async *run(input) {
      if (!input || !input.screenshot) {
        yield { type: 'skip' }
        return
      }

      const apiKey = providerConfig.apiKey
      if (!apiKey) {
        yield { type: 'error', error: '聊天服务缺少接口密钥' }
        return
      }

      const memorySection = buildMemorySection(input.memoryCards)
      const sentimentSection = buildSentimentSection(input.sentimentResult)
      const contextSection = buildContextSection({
        objectRelation: input.objectRelation,
        objectTitle: input.objectTitle,
        userInput: input.userInput
      })
      yield {
        type: 'thinking',
        content: memorySection
          ? `正在分析聊天内容（已加载 ${input.memoryCards.length} 条团队经验）...`
          : '正在分析聊天内容...'
      }

      try {
        const isTextMode = !!input.extractedText
        let basePrompt = providerConfig.systemPrompt || DEFAULT_PROMPT
        const modeRuleSection = input.customPrompt ? `\n\n## 回复模式专属规则\n${input.customPrompt}` : ''
        if (isTextMode) {
          basePrompt = basePrompt
            .replace(/输入为聊天窗口截图识别后的对话文本内容。/, '你会收到对方发送的聊天内容文本。')
            .replace(/识别对话最新消息发送方、消息类型，结合配套回复模式规则生成符合场景的真人回复文本。/, '分析聊天内容，结合配套回复模式规则生成符合场景的真人回复文本。')
            .replace(/区分消息归属，右侧气泡为我方发送内容。若对话最后一条消息为我方发出，直接输出固定标识 \[SKIP\]/, '如果最后一条消息是"我"发送的（文本中标注为"我："或"自己："），必须输出 [SKIP]')
        }
        const systemPrompt = basePrompt + modeRuleSection + memorySection + contextSection
        const reply = await requestReply({
          screenshot: input.screenshot,
          extractedText: input.extractedText,
          apiKey,
          model: providerConfig.model || DEFAULT_MODEL,
          baseURL: providerConfig.baseURL || DEFAULT_BASE_URL,
          systemPrompt,
          sentimentSection
        })

        if (!reply || reply.trim() === '[SKIP]') {
          yield { type: 'skip' }
          return
        }

        yield { type: 'reply_text', content: reply.trim() }
      } catch (error) {
        const message = error && error.message ? error.message : String(error)
        if (context && context.host && typeof context.host.log === 'function') {
          context.host.log(`provider error: ${message}`)
        }
        yield { type: 'error', error: message || '聊天服务调用失败' }
      }
    }
  }
}

async function requestReply({ screenshot, extractedText, apiKey, model, baseURL, systemPrompt, sentimentSection }) {
  const effectiveBaseURL = baseURL || DEFAULT_BASE_URL
  let userContent
  if (extractedText) {
    userContent = [
      { type: 'text', text: `以下是对方发送的聊天内容：\n${extractedText}\n\n请根据以上聊天内容进行回复。${sentimentSection || ''}` }
    ]
  } else {
    userContent = [
      { type: 'image_url', image_url: { url: normalizeImageUrl(screenshot) } },
      { type: 'text', text: '请根据截图中微信聊天窗口的最新消息进行回复。' + (sentimentSection || '') }
    ]
  }
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ],
    thinking: { type: 'disabled' },
    stream: false
  }

  const response = await fetch(`${effectiveBaseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    let hint = ''
    if (response.status === 401) {
      hint = '（API Key 无效或与目标端点不匹配，请检查模型配置中的 API Key 和 Base URL 是否对应同一供应商）'
    } else if (response.status === 400 && errorBody.includes('image_url')) {
      hint = '（当前模型不支持图片输入，请更换为支持视觉能力的模型）'
    }
    throw new Error(`API request failed: ${response.status} ${response.statusText}${hint ? ' ' + hint : ''} - ${errorBody.slice(0, 200)}`)
  }

  const json = await response.json()
  const raw = json && json.choices && json.choices[0] && json.choices[0].message
    ? json.choices[0].message.content || ''
    : ''
  return stripReasoningTags(raw)
}

function stripReasoningTags(text) {
  let result = text
  result = result.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
  result = result.replace(/<reflection>[\s\S]*?<\/reflection>/gi, '')
  result = result.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
  const thinkBlockRegex = /^[\s\S]*?<\/think>\s*/
  if (thinkBlockRegex.test(result)) {
    result = result.replace(thinkBlockRegex, '')
  }
  return result.trim()
}

function buildMemorySection(memoryCards) {
  if (!Array.isArray(memoryCards) || memoryCards.length === 0) {
    return ''
  }
  const lines = memoryCards.map((card, index) => {
    const rationale = card.rationale ? `（原因：${card.rationale}）` : ''
    return `${index + 1}. 【${card.scenario}】${card.guidance}${rationale}`
  })
  return `\n\n## 团队经验（来自工作记忆，优先遵循）\n${lines.join('\n')}`
}

function buildContextSection(options) {
  const parts = []
  if (options.objectRelation && options.objectRelation.trim()) {
    const val = options.objectRelation.trim()
    parts.push(`## 对话双方关系（必须遵守）
对话双方关系：${val}
规则：回复中必须体现双方"${val}"的关系特征，站在己方角度给出回复，语气和措辞需符合该关系。`)
  }
  if (options.objectTitle && options.objectTitle.trim()) {
    const val = options.objectTitle.trim()
    parts.push(`## 对对方标准称呼（必须遵守）
对对方标准称呼：${val}
规则：回复中必须使用"${val}"统一称呼对方，不可替换为其他称呼、不可省略。`)
  }
  if (options.userInput && options.userInput.trim()) {
    const val = options.userInput.trim()
    parts.push(`## 我方基础原始回复（最高优先级，必须遵守）
我方基础原始回复内容：${val}
规则：
1. 必须以上述"我方基础原始回复内容"为核心文本进行修饰和完善，不可偏离其原意；
2. 仅在基础文本上做语气、措辞的风格修饰（由回复模式专属规则决定），禁止自行发挥或另起回复；
3. 基础文本的核心语义和信息不可删减、替换或改写，只能润色表达方式。`)
  }
  if (parts.length === 0) return ''
  return '\n\n' + parts.join('\n\n')
}

function normalizeImageUrl(screenshot) {
  const rawBase64 = stripBase64Prefix(screenshot)
  if (rawBase64.startsWith('http')) {
    return rawBase64
  }
  return `data:image/png;base64,${rawBase64}`
}

function stripBase64Prefix(base64) {
  const idx = String(base64).indexOf('base64,')
  return idx !== -1 ? String(base64).slice(idx + 'base64,'.length) : String(base64)
}

function buildSentimentSection(result) {
  if (!result || result.classIndex === 0) return ''

  const CARE_INSTRUCTIONS = {
    1: '对方可能情绪低落，请在回复中适当给予鼓励和温暖，语气轻松自然。',
    2: '对方情绪较为低落，请在回复中积极倾听、表达理解和支持，避免敷衍。',
    3: '对方情绪严重低落，请在回复中深度共情，避免说教和空洞安慰，可温和建议寻求专业帮助。',
    4: '对方情绪极度低落，请在回复中极度谨慎，以陪伴和倾听为主，不要追问原因，强烈建议对方寻求专业心理援助。'
  }

  const instruction = CARE_INSTRUCTIONS[result.classIndex] || ''
  const maxProb = Math.max(...(result.probabilities || []))
  return `\n\n## 对话者情感状态\n对方当前情绪状态：${result.className}（置信度 ${(maxProb * 100).toFixed(1)}%）\n${instruction}`
}
