export interface ModelConfig {
  id: string
  name: string
  provider: string
  modelName: string
  apiKey: string
  baseURL: string
  createdAt: number
}

export interface ReplyMode {
  id: string
  name: string
  source: 'system' | 'custom'
  prompt: string
  sentimentEnabled: boolean
  unifiedPrefix: string
  enabled: boolean
  running: boolean
  specificObjects: SpecificObject[]
  autoReply: boolean
  createdAt: number
  updatedAt: number
}

export interface SpecificObject {
  id: string
  name: string
  title: string
  relationship: string
  modeId: string
  autoReply: boolean | null
}

export const PROVIDER_PRESETS = [
  {
    id: 'volcengine-ark',
    name: '火山方舟 (Volcengine Ark)',
    defaultBaseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-seed-2-0-lite-260215'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    defaultBaseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultBaseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat'
  },
  {
    id: 'custom',
    name: '自定义',
    defaultBaseURL: '',
    defaultModel: ''
  }
]
