const DEFAULT_MODEL = 'doubao-seed-2-0-lite-260215'
const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
const DEFAULT_PROMPT = `你是一个微信自动回复助手。你会收到一张微信/企业微信的聊天窗口截图。

## 你的任务
分析截图中的聊天内容，生成合适的回复。

## 规则
1. 只输出回复文字，不要解释、不要添加多余内容
2. 防自我循环：仔细观察截图。聊天窗口中，右侧的气泡是"我"发送的。如果最后一条消息是右侧气泡，必须输出 [SKIP]
3. 如果最新消息是系统消息、群公告、红包、转账等非对话消息，输出 [SKIP]
4. 如果无法判断是否需要回复，输出 [SKIP]
5. 回复要自然、口语化，像真人对话`

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
      yield {
        type: 'thinking',
        content: memorySection
          ? `正在分析聊天内容（已加载 ${input.memoryCards.length} 条团队经验）...`
          : '正在分析聊天内容...'
      }

      try {
        const isTextMode = !!input.extractedText
        let basePrompt = providerConfig.systemPrompt || DEFAULT_PROMPT
        if (isTextMode) {
          basePrompt = basePrompt
            .replace(/你会收到一张微信\/企业微信的聊天窗口截图。/, '你会收到对方发送的聊天内容文本。')
            .replace(/分析截图中的聊天内容/, '分析聊天内容')
            .replace(/仔细观察截图。聊天窗口中，右侧的气泡是"我"发送的。如果最后一条消息是右侧气泡，必须输出 \[SKIP\]/, '如果最后一条消息是"我"发送的（文本中标注为"我："或"自己："），必须输出 [SKIP]')
            .replace(/截图/g, '聊天内容')
        }
        const reply = await requestReply({
          screenshot: input.screenshot,
          extractedText: input.extractedText,
          apiKey,
          model: providerConfig.model || DEFAULT_MODEL,
          baseURL: providerConfig.baseURL || DEFAULT_BASE_URL,
          systemPrompt: basePrompt + memorySection,
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
  return json && json.choices && json.choices[0] && json.choices[0].message
    ? json.choices[0].message.content || ''
    : ''
}

// 工作记忆注入：把运行时下发的经验卡片拼成 system prompt 附加段
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
