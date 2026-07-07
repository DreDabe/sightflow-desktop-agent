import { useState, useCallback, useRef, useEffect, useMemo, createContext, useContext } from 'react'
import logoUrl from './assets/logo.png'
import logoBlackUrl from './assets/logo_black.png'
import MemoryWindow from './MemoryWindow'
import './index.css'

type Locale = 'zh' | 'en'

const translations: Record<Locale, Record<string, string>> = {
  zh: {
    'settings.title': '设置',
    'settings.base': '基础配置',
    'settings.model': '模型配置',
    'settings.training': '模型训练',
    'settings.agent': '智能体',
    'settings.mode': '模式管理',
    'settings.base.desc': '维护桌面端运行所需的基础参数。',
    'settings.basic': '基础设置',
    'settings.appearance': '外观',
    'settings.appearance.dark': '深色主题',
    'settings.appearance.light': '浅色主题',
    'settings.language': '语言',
    'settings.language.zh': '中文',
    'settings.language.en': 'English',
    'settings.globalModel': '全局模型选择',
    'settings.globalModel.hint': '选择用于视觉检测和回复生成的模型。如需添加新模型，请前往"模型配置"页面。',
    'settings.visionModel': '全局视觉模型',
    'settings.visionModel.hint': '用于 VLM 布局检测、红点检测、对象识别',
    'settings.replyModel': '全局回复模型',
    'settings.replyModel.hint': '用于 AI 回复生成',
    'settings.selectVisionModel': '请选择视觉模型',
    'settings.selectReplyModel': '请选择回复模型',
    'settings.testConnection': '测试连接',
    'mode.start': '启动',
    'mode.stop': '停止',
    'mode.starting': '启动中',
    'mode.running': '运行中',
    'mode.stopped': '已停止',
    'mode.targetApp': '目标应用',
    'mode.autoReply': '自动回复',
    'mode.sentiment': '情感分析',
    'mode.unifiedPrefix': '统一开头',
    'mode.add': '添加模式',
    'mode.addTitle': '添加自定义模式',
    'mode.name': '模式名称',
    'mode.name.required': '模式名称不能为空',
    'mode.prompt': '回复规则 (Prompt)',
    'mode.prompt.required': '回复规则不能为空',
    'mode.prompt.placeholder': 'AI 回复的引导提示词',
    'mode.sentiment.hint': '开启后该模式运行时使用情感分析',
    'mode.unifiedPrefix.hint': '回复内容前自动添加的文字',
    'mode.unifiedPrefix.placeholder': '例如：【机器客服自动回复】',
    'object.specific': '特定对象',
    'object.search': '搜索对象',
    'object.searchBtn': '搜索',
    'object.add': '+添加对象',
    'object.addTitle': '添加特定对象',
    'object.name': '名称',
    'object.name.required': '对象名称不能为空',
    'object.name.hint': '用于 VLM 匹配识别',
    'object.name.placeholder': '对方在聊天软件中的名称',
    'object.title': '称呼',
    'object.title.label': '特定称呼',
    'object.title.placeholder': '例如：老张、王总',
    'object.relationship': '关系',
    'object.relationship.placeholder': '例如：姐姐、老板',
    'object.autoReply': '自动回复',
    'object.autoReply.follow': '跟随模式设置',
    'object.autoReply.on': '开启',
    'object.autoReply.off': '关闭',
    'object.empty': '暂无特定对象',
    'object.delete': '删除',
    'object.delete.fail': '删除失败',
    'object.added': '特定对象已添加',
    'object.add.fail': '添加失败',
    'object.editTitle': '编辑特定对象',
    'object.updated': '对象已更新',
    'object.update.fail': '更新失败',
    'log.title': '运行日志',
    'log.empty': '暂无日志',
    'log.expand': '展开日志',
    'log.collapse': '收起日志',
    'log.type.thinking': '思考',
    'log.type.reply': '回复',
    'log.type.skip': '跳过',
    'log.type.error': '错误',
    'reply.recommended': '推荐回复',
    'reply.placeholder': 'AI 生成的推荐回复将显示在这里',
    'reply.paste': '一键粘贴',
    'reply.send': '一键回复',
    'reply.skip': '一键跳过',
    'reply.skip.toast': '已跳过本次推荐回复',
    'reply.pending': '待处理',
    'reply.standby': '待机中',
    'userInput.title': '用户输入',
    'userInput.placeholder': '输入你希望 AI 参考的内容，为空则按原逻辑回复',
    'userInput.clear': '清除',
    'sidebar.expand': '展开菜单',
    'sidebar.collapse': '收起菜单',
    'sidebar.settings': '设置',
    'sidebar.memory': '工作记忆',
    'sidebar.empty': '请从左侧选择一个模式，或添加新的自定义模式',
    'btn.cancel': '取消',
    'btn.add': '添加',
    'btn.save': '保存',
    'toast.configVision': '请先配置视觉模型',
    'toast.modeStarted': '模式已启动',
    'toast.modeStartFail': '启动失败',
    'toast.modeStopped': '模式已停止',
    'toast.modeStopFail': '停止失败',
    'toast.modeAdded': '模式已添加',
    'toast.addFail': '添加失败',
    'toast.connectionOk': '连接测试成功',
    'toast.connectionFail': '连接测试失败',
    'app.wechat': '微信',
    'app.wework': '企业微信',
    'app.dingtalk': '钉钉',
    'app.lark': '飞书 / Lark',
    'app.slack': 'Slack',
    'app.telegram': 'Telegram',
    'app.generic': '其他桌面应用'
  },
  en: {
    'settings.title': 'Settings',
    'settings.base': 'General',
    'settings.model': 'Models',
    'settings.training': 'Training',
    'settings.agent': 'Agents',
    'settings.mode': 'Modes',
    'settings.base.desc': 'Manage basic parameters for the desktop client.',
    'settings.basic': 'Basic Settings',
    'settings.appearance': 'Appearance',
    'settings.appearance.dark': 'Dark Theme',
    'settings.appearance.light': 'Light Theme',
    'settings.language': 'Language',
    'settings.language.zh': '中文',
    'settings.language.en': 'English',
    'settings.globalModel': 'Global Model Selection',
    'settings.globalModel.hint': 'Select models for vision detection and reply generation. Add new models in the "Models" page.',
    'settings.visionModel': 'Global Vision Model',
    'settings.visionModel.hint': 'For VLM layout detection, unread indicators, object recognition',
    'settings.replyModel': 'Global Reply Model',
    'settings.replyModel.hint': 'For AI reply generation',
    'settings.selectVisionModel': 'Select vision model',
    'settings.selectReplyModel': 'Select reply model',
    'settings.testConnection': 'Test Connection',
    'mode.start': 'Start',
    'mode.stop': 'Stop',
    'mode.starting': 'Starting',
    'mode.running': 'Running',
    'mode.stopped': 'Stopped',
    'mode.targetApp': 'Target App',
    'mode.autoReply': 'Auto Reply',
    'mode.sentiment': 'Sentiment',
    'mode.unifiedPrefix': 'Prefix',
    'mode.add': 'Add Mode',
    'mode.addTitle': 'Add Custom Mode',
    'mode.name': 'Mode Name',
    'mode.name.required': 'Mode name is required',
    'mode.prompt': 'Reply Rule (Prompt)',
    'mode.prompt.required': 'Reply rule is required',
    'mode.prompt.placeholder': 'Prompt for AI reply generation',
    'mode.sentiment.hint': 'Enable sentiment analysis when this mode is running',
    'mode.unifiedPrefix.hint': 'Text automatically prepended to replies',
    'mode.unifiedPrefix.placeholder': 'e.g. [Auto Reply]',
    'object.specific': 'Specific Objects',
    'object.search': 'Search objects',
    'object.searchBtn': 'Search',
    'object.add': '+ Add Object',
    'object.addTitle': 'Add Specific Object',
    'object.name': 'Name',
    'object.name.required': 'Object name is required',
    'object.name.hint': 'For VLM matching',
    'object.name.placeholder': 'Contact name in chat app',
    'object.title': 'Title',
    'object.title.label': 'Specific Title',
    'object.title.placeholder': 'e.g. Boss Zhang',
    'object.relationship': 'Relationship',
    'object.relationship.placeholder': 'e.g. Sister, Boss',
    'object.autoReply': 'Auto Reply',
    'object.autoReply.follow': 'Follow mode setting',
    'object.autoReply.on': 'On',
    'object.autoReply.off': 'Off',
    'object.empty': 'No specific objects',
    'object.delete': 'Delete',
    'object.delete.fail': 'Delete failed',
    'object.added': 'Object added',
    'object.add.fail': 'Add failed',
    'object.editTitle': 'Edit Specific Object',
    'object.updated': 'Object updated',
    'object.update.fail': 'Update failed',
    'log.title': 'Runtime Log',
    'log.empty': 'No logs yet',
    'log.expand': 'Expand Log',
    'log.collapse': 'Collapse Log',
    'log.type.thinking': 'Think',
    'log.type.reply': 'Reply',
    'log.type.skip': 'Skip',
    'log.type.error': 'Error',
    'reply.recommended': 'Recommended Reply',
    'reply.placeholder': 'AI-generated recommended reply will appear here',
    'reply.paste': 'Paste',
    'reply.send': 'Send',
    'reply.skip': 'Skip',
    'reply.skip.toast': 'Skipped this recommended reply',
    'reply.pending': 'Pending',
    'reply.standby': 'Standby',
    'userInput.title': 'User Input',
    'userInput.placeholder': 'Enter content for AI to reference; leave empty for default logic',
    'userInput.clear': 'Clear',
    'sidebar.expand': 'Expand',
    'sidebar.collapse': 'Collapse',
    'sidebar.settings': 'Settings',
    'sidebar.memory': 'Working Memory',
    'sidebar.empty': 'Select a mode from the sidebar, or add a new custom mode',
    'btn.cancel': 'Cancel',
    'btn.add': 'Add',
    'btn.save': 'Save',
    'toast.configVision': 'Please configure a vision model first',
    'toast.modeStarted': 'Mode started',
    'toast.modeStartFail': 'Start failed',
    'toast.modeStopped': 'Mode stopped',
    'toast.modeStopFail': 'Stop failed',
    'toast.modeAdded': 'Mode added',
    'toast.addFail': 'Add failed',
    'toast.connectionOk': 'Connection test successful',
    'toast.connectionFail': 'Connection test failed',
    'app.wechat': 'WeChat',
    'app.wework': 'WeCom',
    'app.dingtalk': 'DingTalk',
    'app.lark': 'Lark',
    'app.slack': 'Slack',
    'app.telegram': 'Telegram',
    'app.generic': 'Other Desktop App'
  }
}

interface I18nContextValue {
  t: (key: string) => string
  locale: Locale
  setLocale: (l: Locale) => void
}

const I18nContext = createContext<I18nContextValue>({
  t: (key: string) => key,
  locale: 'zh',
  setLocale: () => {}
})

function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}

interface LogEntry {
  time: string
  type: 'thinking' | 'reply' | 'skip' | 'error'
  content: string
}

type SettingsSection = 'base' | 'model' | 'training' | 'mode' | 'agent'
type AppType = 'wechat' | 'wework' | 'dingtalk' | 'lark' | 'slack' | 'telegram' | 'generic'

type CaptureStrategy = 'auto' | 'vlm' | 'box-select'

interface ScreenRect {
  x: number
  y: number
  width: number
  height: number
}

interface BoxRegions {
  contactList: ScreenRect
  chatMain: ScreenRect
  inputBox: ScreenRect
  unreadIndicator: ScreenRect | null
  displayId?: number
  scaleFactor?: number
  capturedAt: number
}

const APP_TYPE_LABELS: Record<AppType, string> = {
  wechat: '微信',
  wework: '企业微信',
  dingtalk: '钉钉',
  lark: '飞书 / Lark',
  slack: 'Slack',
  telegram: 'Telegram',
  generic: '其他桌面应用'
}

interface InstalledProviderInfo {
  id: string
  name: string
  version: string
  entryFile: string
  installedAt: string
}

type ProviderConfigFieldType = 'text' | 'password' | 'url' | 'select' | 'textarea'

interface ProviderConfigField {
  key: string
  label: string
  type: ProviderConfigFieldType
  required?: boolean
  readonly?: boolean
  placeholder?: string
  hint?: string
  defaultValue?: string
  options?: Array<{ label: string; value: string }>
}

interface ProviderCatalogItem {
  id: string
  name: string
  description?: string
  version: string
  manifestUrl: string
  capabilities?: string[]
  configSchema: {
    fields: ProviderConfigField[]
  }
}

interface ProviderHubCache {
  sourceUrl: string
  fetchedAt: string
  providers: ProviderCatalogItem[]
}

interface ProviderHubResult {
  success: boolean
  error?: string
  catalog?: ProviderHubCache | null
}

interface PerAppCapture {
  strategy: CaptureStrategy
  regions: BoxRegions | null
}

interface AppSettings {
  locale: 'zh' | 'en'
  theme: 'dark' | 'light'
  appType: AppType
  vision: {
    apiKey: string
    model: string
    baseURL: string
  }
  chatProvider: {
    manifestUrl: string
    installed: InstalledProviderInfo | null
    config: Record<string, any>
  }
  defaultCaptureStrategy: CaptureStrategy
  capture: Partial<Record<AppType, PerAppCapture>>
  models: ModelConfig[]
  globalVisionModelId: string
  globalReplyModelId: string
  modes: ReplyMode[]
  globalDefaultModeId: string
  globalAutoReply: boolean
}

interface SpecificObject {
  id: string
  name: string
  title: string
  relationship: string
  modeId: string
  autoReply: boolean | null
}

interface ReplyMode {
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

type ModelCapability = 'text' | 'vision' | 'audio'

interface ModelConfig {
  id: string
  name: string
  provider: string
  modelName: string
  apiKey: string
  baseURL: string
  capabilities: ModelCapability[]
  createdAt: number
}

const PROVIDER_PRESETS = [
  { id: 'volcengine-ark', name: '火山方舟 (Volcengine Ark)', defaultBaseURL: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: 'doubao-seed-2-0-lite-260215', defaultCapabilities: ['text', 'vision'] as ModelCapability[] },
  { id: 'aliyun-bailian', name: '阿里云百炼 (DashScope)', defaultBaseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-vl-plus', defaultCapabilities: ['text', 'vision'] as ModelCapability[] },
  { id: 'openai', name: 'OpenAI', defaultBaseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', defaultCapabilities: ['text', 'vision'] as ModelCapability[] },
  { id: 'deepseek', name: 'DeepSeek', defaultBaseURL: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat', defaultCapabilities: ['text'] as ModelCapability[] },
  { id: 'custom', name: '自定义', defaultBaseURL: '', defaultModel: '', defaultCapabilities: ['text'] as ModelCapability[] }
]

const BUILTIN_PROVIDER_CATALOG: ProviderCatalogItem[] = [
  {
    id: 'doubao',
    name: '豆包 Seed',
    description: '本地内置聊天 Provider，使用基础配置中的火山方舟密钥。',
    version: '1.0.0',
    manifestUrl: 'builtin://doubao',
    capabilities: ['chat'],
    configSchema: {
      fields: [
        {
          key: 'apiKey',
          label: 'API Key',
          type: 'password',
          required: true,
          placeholder: '输入火山方舟 API Key'
        },
        {
          key: 'model',
          label: '模型',
          type: 'text',
          required: true,
          readonly: true,
          defaultValue: 'doubao-seed-2-0-lite-260428'
        },
        {
          key: 'baseURL',
          label: 'Base URL',
          type: 'url',
          placeholder: 'https://ark.cn-beijing.volces.com/api/v3'
        },
        {
          key: 'systemPrompt',
          label: '系统提示词',
          type: 'textarea',
          placeholder: '你是一个微信自动回复助手。根据截图中的聊天内容，生成合适的回复...'
        }
      ]
    }
  }
]

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
    <path d="M8 5.14v14l11-7-11-7z" />
  </svg>
)

const StopIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
)

const GearIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

// 工作记忆 — 时钟+轨迹点图标
const MemoryIcon = (): React.JSX.Element => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
    <path d="M12 7v5l3 3" />
  </svg>
)

const RefreshIcon = (): React.JSX.Element => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 0 1-15.1 6.6" />
    <path d="M3 12A9 9 0 0 1 18.1 5.4" />
    <path d="M18 2v4h-4" />
    <path d="M6 22v-4h4" />
  </svg>
)

interface ModeState {
  logs: LogEntry[]
  recommendedReply: string
  modeRunning: boolean
  modeStarting: boolean
}

function App() {
  const windowKind = new URLSearchParams(window.location.search).get('window')
  const [modes, setModes] = useState<ReplyMode[]>([])
  const [activeModeId, setActiveModeId] = useState<string>('')
  const [showAddModeModal, setShowAddModeModal] = useState(false)
  const [runningModeIds, setRunningModeIds] = useState<Set<string>>(new Set())
  const [modeStates, setModeStates] = useState<Map<string, ModeState>>(new Map())
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [standbyModeIds, setStandbyModeIds] = useState<Set<string>>(new Set())
  const [pendingModeIds, setPendingModeIds] = useState<Set<string>>(new Set())
  const [locale, setLocaleState] = useState<Locale>('zh')
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark')
  const [modeUserInputs, setModeUserInputs] = useState<Map<string, string>>(new Map())

  const t = useCallback((key: string): string => {
    return translations[locale]?.[key] ?? translations.zh[key] ?? key
  }, [locale])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    void window.electron?.invoke('settings:set', { locale: l })
  }, [])

  const setTheme = useCallback((th: 'dark' | 'light') => {
    setThemeState(th)
    document.documentElement.setAttribute('data-theme', th)
    void window.electron?.invoke('settings:set', { theme: th })
  }, [])

  useEffect(() => {
    const load = async () => {
      const settings = (await window.electron?.invoke('settings:getAll')) as AppSettings | undefined
      if (settings) {
        setLocaleState(settings.locale || 'zh')
        setThemeState(settings.theme || 'dark')
        document.documentElement.setAttribute('data-theme', settings.theme || 'dark')
      }
    }
    void load()
  }, [])

  useEffect(() => {
    const cleanup = window.electron?.on('settings:changed', (data: { theme?: string; locale?: string }) => {
      if (data.theme === 'light' || data.theme === 'dark') {
        setThemeState(data.theme)
        document.documentElement.setAttribute('data-theme', data.theme)
      }
      if (data.locale === 'zh' || data.locale === 'en') {
        setLocaleState(data.locale)
      }
    })
    return cleanup ?? (() => {})
  }, [])

  const i18nValue = useMemo(() => ({ t, locale, setLocale }), [t, locale, setLocale])

  const getModeState = useCallback((modeId: string): ModeState => {
    return modeStates.get(modeId) || { logs: [], recommendedReply: '', modeRunning: false, modeStarting: false }
  }, [modeStates])

  const updateModeState = useCallback((modeId: string, patch: Partial<ModeState>) => {
    setModeStates((prev) => {
      const next = new Map(prev)
      const current = next.get(modeId) || { logs: [], recommendedReply: '', modeRunning: false, modeStarting: false }
      next.set(modeId, { ...current, ...patch })
      return next
    })
  }, [])

  const addLogToMode = useCallback((modeId: string, type: LogEntry['type'], content: string) => {
    setModeStates((prev) => {
      const next = new Map(prev)
      const current = next.get(modeId) || { logs: [], recommendedReply: '', modeRunning: false, modeStarting: false }
      const time = new Date().toLocaleTimeString('en-US', { hour12: false })
      next.set(modeId, { ...current, logs: [...current.logs.slice(-99), { time, type, content }] })
      return next
    })
  }, [])

  useEffect(() => {
    const cleanup = window.electron?.on('engine:state', () => {})
    return cleanup
  }, [])

  useEffect(() => {
    const cleanup = window.electron?.on('mode:runningChanged', (data: { modeId: string; running: boolean }) => {
      setRunningModeIds((prev) => {
        const next = new Set(prev)
        if (data.running) next.add(data.modeId)
        else next.delete(data.modeId)
        return next
      })
      updateModeState(data.modeId, {
        modeRunning: data.running,
        modeStarting: data.running ? false : undefined as any
      })
    })
    return cleanup
  }, [updateModeState])

  useEffect(() => {
    const cleanup = window.electron?.on('engine:log', (data: { type: string; content: string; modeId?: string }) => {
      const targetModeId = data.modeId || activeModeId
      if (!targetModeId) return
      const ms = modeStates.get(targetModeId)
      if (!ms || (!ms.modeRunning && !ms.modeStarting)) return
      addLogToMode(targetModeId, data.type as LogEntry['type'], data.content)
    })
    return cleanup
  }, [activeModeId, modeStates, addLogToMode])

  useEffect(() => {
    const cleanup = window.electron?.on('engine:recommendReply', (data: { text: string; modeId?: string }) => {
      const targetModeId = data.modeId || activeModeId
      if (!targetModeId) return
      updateModeState(targetModeId, { recommendedReply: '' })
      setTimeout(() => {
        updateModeState(targetModeId, { recommendedReply: data.text })
      }, 50)
    })
    return cleanup
  }, [activeModeId, updateModeState])

  useEffect(() => {
    const cleanup = window.electron?.on('engine:standbyChanged', (data: { modeId: string; standby: boolean }) => {
      setStandbyModeIds(prev => {
        const next = new Set(prev)
        if (data.standby) {
          next.add(data.modeId)
        } else {
          next.delete(data.modeId)
        }
        return next
      })
    })
    return cleanup
  }, [])

  useEffect(() => {
    const cleanup = window.electron?.on('engine:pendingChanged', (data: { modeId: string; pending: boolean }) => {
      setPendingModeIds(prev => {
        const next = new Set(prev)
        if (data.pending) {
          next.add(data.modeId)
        } else {
          next.delete(data.modeId)
        }
        return next
      })
    })
    return cleanup
  }, [])

  const loadModes = useCallback(async () => {
    const list = (await window.electron?.invoke('mode:list')) as ReplyMode[]
    setModes(list || [])
    setActiveModeId((prev) => {
      if (prev && list?.some((m) => m.id === prev && m.enabled)) return prev
      const firstEnabled = list?.find((m) => m.enabled)
      return firstEnabled?.id || ''
    })
  }, [])

  useEffect(() => {
    void loadModes()
  }, [loadModes])

  useEffect(() => {
    const cleanup = window.electron?.on('mode:changed', () => {
      void loadModes()
    })
    return cleanup
  }, [loadModes])

  if (windowKind === 'settings') {
    return (
      <I18nContext.Provider value={i18nValue}>
        <div className="app settings-window">
          <SettingsWindow theme={theme} setTheme={setTheme} />
          <Toast />
        </div>
      </I18nContext.Provider>
    )
  }

  if (windowKind === 'memory') {
    return (
      <I18nContext.Provider value={i18nValue}>
        <div className="app settings-window">
          <MemoryWindow />
          <Toast />
        </div>
      </I18nContext.Provider>
    )
  }

  const enabledModes = modes.filter((m) => m.enabled)
  const activeMode = modes.find((m) => m.id === activeModeId)

  return (
    <I18nContext.Provider value={i18nValue}>
      <div className="app main-shell">
        <aside className={`main-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="main-sidebar-brand">
            <img src={theme === 'light' ? logoBlackUrl : logoUrl} alt="AutoReply" className="app-logo" />
          </div>
          <button
            className="main-sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          >
            {sidebarCollapsed ? '▶' : '◀'}
          </button>
          <div className="main-sidebar-modes">
            {enabledModes.map((mode) => (
              <button
                key={mode.id}
                className={`main-sidebar-item ${mode.id === activeModeId ? 'active' : ''}`}
                onClick={() => setActiveModeId(mode.id)}
                title={mode.name}
              >
                <span className={`mode-status-dot ${pendingModeIds.has(mode.id) ? 'pending' : standbyModeIds.has(mode.id) ? 'standby' : runningModeIds.has(mode.id) ? 'running' : 'idle'}`} />
                {!sidebarCollapsed && <span className="main-sidebar-item-name">{mode.name}</span>}
                {!sidebarCollapsed && pendingModeIds.has(mode.id) && <span style={{ color: '#f87171', fontSize: 10, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{t('reply.pending')}</span>}
                {!sidebarCollapsed && !pendingModeIds.has(mode.id) && standbyModeIds.has(mode.id) && <span style={{ color: '#f59e0b', fontSize: 10, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{t('reply.standby')}</span>}
              </button>
            ))}
          </div>
          <div className="main-sidebar-divider" />
          <button
            className="main-sidebar-item main-sidebar-item-add"
            onClick={() => setShowAddModeModal(true)}
            title={t('mode.add')}
          >
            {!sidebarCollapsed ? `+ ${t('mode.add')}` : '+'}
          </button>
          <div className="main-sidebar-divider" />
          <div className="main-sidebar-bottom">
            <button
              className="main-sidebar-item main-sidebar-bottom-btn"
              onClick={() => window.electron?.invoke('settings:open')}
              title={t('sidebar.settings')}
            >
              <GearIcon />
            </button>
            <button
              className="main-sidebar-item main-sidebar-bottom-btn"
              onClick={() => window.electron?.invoke('memory:open')}
              title={t('sidebar.memory')}
            >
              <MemoryIcon />
            </button>
          </div>
        </aside>

        <main className="main-content">
          {activeMode ? (
            <ModeSubInterface key={activeMode.id} mode={activeMode} modeState={getModeState(activeMode.id)} updateModeState={(patch) => updateModeState(activeMode.id, patch)} onModesChanged={loadModes} standbyModeIds={standbyModeIds} pendingModeIds={pendingModeIds} userInput={modeUserInputs.get(activeMode.id) || ''} onUserInputChange={(val) => setModeUserInputs((prev) => { const next = new Map(prev); next.set(activeMode.id, val); return next })} />
          ) : (
            <div className="main-content-empty">
              <p>{t('sidebar.empty')}</p>
            </div>
          )}
        </main>

        {showAddModeModal && (
          <AddModeModal
            onClose={() => setShowAddModeModal(false)}
            onSaved={() => { loadModes(); setShowAddModeModal(false) }}
          />
        )}

        <Toast />
      </div>
    </I18nContext.Provider>
  )
}

function ModeSubInterface({
  mode,
  modeState,
  updateModeState,
  onModesChanged,
  standbyModeIds,
  pendingModeIds,
  userInput,
  onUserInputChange
}: {
  mode: ReplyMode
  modeState: ModeState
  updateModeState: (patch: Partial<ModeState>) => void
  onModesChanged: () => void
  standbyModeIds: Set<string>
  pendingModeIds: Set<string>
  userInput: string
  onUserInputChange: (val: string) => void
}): React.JSX.Element {
  const { t } = useI18n()
  const [modeData, setModeData] = useState(mode)
  const [appType, setAppType] = useState<AppType>('wechat')
  const [showAddObjectModal, setShowAddObjectModal] = useState(false)
  const [editingObject, setEditingObject] = useState<SpecificObject | null>(null)
  const [objectSearch, setObjectSearch] = useState('')
  const [logExpanded, setLogExpanded] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)

  const logs = modeState.logs
  const recommendedReply = modeState.recommendedReply
  const modeRunning = modeState.modeRunning
  const modeStarting = modeState.modeStarting

  useEffect(() => {
    const load = async () => {
      const settings = (await window.electron?.invoke('settings:getAll')) as AppSettings | undefined
      if (settings) setAppType(settings.appType || 'wechat')
    }
    void load()
  }, [])

  useEffect(() => {
    setModeData(mode)
  }, [mode])

  useEffect(() => {
    void window.electron?.invoke('engine:setUserInput', modeData.id, userInput)
  }, [userInput, modeData.id, modeRunning])

  useEffect(() => {
    const el = logRef.current
    if (!el) return
    if (!userScrolledRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [logs])

  const handleLogScroll = useCallback(() => {
    const el = logRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30
    userScrolledRef.current = !atBottom
  }, [])

  const handleStart = useCallback(async () => {
    const settings = (await window.electron?.invoke('settings:getAll')) as AppSettings | undefined
    const visionModel = settings?.models?.find((m) => m.id === settings.globalVisionModelId)
    if (!visionModel && !settings?.vision?.apiKey) {
      showToast(t('toast.configVision'), 'error')
      return
    }
    updateModeState({ modeStarting: true })
    const result = await window.electron?.invoke('mode:start', mode.id)
    if (result?.success) {
      updateModeState({ modeRunning: true, modeStarting: false })
      showToast(t('toast.modeStarted'), 'success')
    } else {
      updateModeState({ modeStarting: false })
      if (result?.reason === 'default_mode_not_running') {
        showToast(result.message, 'error', 5000)
      } else {
        showToast(result?.error || t('toast.modeStartFail'), 'error')
      }
    }
  }, [mode.id, updateModeState, t])

  const handleStop = useCallback(async () => {
    const result = await window.electron?.invoke('mode:stop', mode.id)
    if (result?.success) {
      updateModeState({ modeRunning: false })
      showToast(t('toast.modeStopped'), 'success')
    } else {
      showToast(result?.error || t('toast.modeStopFail'), 'error')
    }
  }, [mode.id, updateModeState, t])

  const handleToggleAutoReply = useCallback(async () => {
    const next = !modeData.autoReply
    const result = await window.electron?.invoke('mode:update', modeData.id, { autoReply: next })
    if (result?.success) {
      setModeData((prev) => ({ ...prev, autoReply: next }))
      onModesChanged()
      await window.electron?.invoke('mode:setAutoReply', modeData.id, next)
    }
  }, [modeData, onModesChanged])

  const handleDeleteObject = useCallback(async (objectId: string) => {
    const result = await window.electron?.invoke('object:delete', modeData.id, objectId)
    if (result?.success) {
      setModeData((prev) => ({
        ...prev,
        specificObjects: prev.specificObjects.filter((o) => o.id !== objectId)
      }))
      onModesChanged()
    } else {
      showToast(result?.error || t('object.delete.fail'), 'error')
    }
  }, [modeData, onModesChanged, t])

  const handleSend = useCallback(async () => {
    if (!recommendedReply) return
    await window.electron?.invoke('reply:send', recommendedReply)
    await window.electron?.invoke('engine:exitStandby', mode.id)
  }, [recommendedReply, mode.id])

  const handlePaste = useCallback(async () => {
    if (!recommendedReply) return
    await window.electron?.invoke('reply:paste', recommendedReply)
    await window.electron?.invoke('engine:exitStandby', mode.id)
  }, [recommendedReply, mode.id])

  const handleSkip = useCallback(async () => {
    await window.electron?.invoke('engine:exitStandby', mode.id)
    showToast(t('reply.skip.toast'), 'success')
  }, [mode.id, t])

  const running = modeRunning
  const starting = modeStarting
  const statusLabel = running ? t('mode.running') : starting ? t('mode.starting') : t('mode.stopped')
  const appTypeKey = `app.${appType}` as string
  const appTypeLabel = t(appTypeKey) || APP_TYPE_LABELS[appType] || appType

  const filteredObjects = modeData.specificObjects.filter((obj) => {
    if (!objectSearch.trim()) return true
    const q = objectSearch.trim()
    if (obj.name === q) return true
    try {
      return new RegExp(q, 'i').test(obj.name)
    } catch {
      return obj.name.includes(q)
    }
  })

  return (
    <div className="mode-subinterface fade-in">
      <div className="mode-header">
        <div className="mode-header-left">
          <h2 className="mode-name">{modeData.name}</h2>
          <span className={`mode-status ${running ? 'running' : starting ? 'starting' : 'stopped'}`}>
            <span className={`status-dot ${running ? 'running' : starting ? 'starting' : 'idle'}`} />
            {statusLabel}
          </span>
        </div>
        <div className="mode-header-right">
          {running ? (
            <button className="btn btn-stop" onClick={handleStop}>
              <StopIcon /> {t('mode.stop')}
            </button>
          ) : starting ? (
            <button className="btn btn-starting" disabled>
              <PlayIcon /> {t('mode.starting')}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleStart} style={{ minWidth: 100, height: 28 }}>
              <PlayIcon /> {t('mode.start')}
            </button>
          )}
        </div>
      </div>

      <div className="mode-info-row">
        <div className="mode-info-item">
          <span className="mode-info-label">{t('mode.targetApp')}</span>
          <span className="mode-info-value">{appTypeLabel}</span>
        </div>
        <div className="mode-info-item">
          <span className="mode-info-label">{t('mode.autoReply')}</span>
          <label className="toggle-switch">
            <input type="checkbox" checked={modeData.autoReply} onChange={handleToggleAutoReply} />
            <span className="toggle-slider" />
          </label>
        </div>
        {modeData.sentimentEnabled && (
          <div className="mode-info-item">
            <span className="mode-info-badge">{t('mode.sentiment')}</span>
          </div>
        )}
        {modeData.unifiedPrefix && (
          <div className="mode-info-item">
            <span className="mode-info-badge">{t('mode.unifiedPrefix')}: {modeData.unifiedPrefix}</span>
          </div>
        )}
      </div>

      <div className="card card-fixed-154">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{t('object.specific')}</span>
          <div className="object-search-wrapper">
            <svg className="object-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className="form-input object-search-input"
              type="text"
              placeholder={t('object.search')}
              value={objectSearch}
              onChange={(e) => setObjectSearch(e.target.value)}
            />
            <button className="btn btn-secondary btn-sm object-search-btn">{t('object.searchBtn')}</button>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAddObjectModal(true)} style={{ marginLeft: 'auto', flexShrink: 0 }}>{t('object.add')}</button>
        </div>
        {filteredObjects.length === 0 ? (
          <div className="object-list-empty">{t('object.empty')}</div>
        ) : (
          <div className="object-list">
            <table className="object-table">
              <thead>
                <tr>
                  <th>{t('object.name')}</th>
                  <th>{t('object.title')}</th>
                  <th>{t('object.relationship')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredObjects.map((obj) => (
                  <tr key={obj.id} onClick={() => setEditingObject(obj)} style={{ cursor: 'pointer' }}>
                    <td>{obj.name}</td>
                    <td>{obj.title || ''}</td>
                    <td>{obj.relationship || ''}</td>
                    <td className="object-action-cell">
                      <button className="btn btn-secondary btn-sm" style={{ color: '#ef4444' }} onClick={(e) => { e.stopPropagation(); handleDeleteObject(obj.id) }}>{t('object.delete')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{t('userInput.title')}</span>
          <button
            className="btn btn-secondary btn-sm user-input-clear-btn"
            onClick={() => onUserInputChange('')}
            disabled={!userInput}
          >
            {t('userInput.clear')}
          </button>
        </div>
        <textarea
          className="form-input user-input-textarea"
          value={userInput}
          onChange={(e) => onUserInputChange(e.target.value)}
          placeholder={t('userInput.placeholder')}
          rows={2}
        />
      </div>

      <div className="card">
        <div className="card-title">{t('reply.recommended')}</div>
        <textarea
          className="form-input recommended-reply"
          value={recommendedReply}
          onChange={(e) => updateModeState({ recommendedReply: e.target.value })}
          placeholder={t('reply.placeholder')}
          rows={3}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center' }}>
          <button className="btn btn-secondary" disabled={!recommendedReply} onClick={handlePaste}>{t('reply.paste')}</button>
          <button className="btn btn-primary" disabled={!recommendedReply} onClick={handleSend}>{t('reply.send')}</button>
          <button className="btn btn-secondary" disabled={!recommendedReply} onClick={handleSkip}>{t('reply.skip')}</button>
        </div>
        {pendingModeIds.has(modeData.id) && (
          <div style={{ textAlign: 'center', color: '#f87171', fontSize: 11, marginTop: 4 }}>{t('reply.pending')}</div>
        )}
        {!pendingModeIds.has(modeData.id) && standbyModeIds.has(modeData.id) && (
          <div style={{ textAlign: 'center', color: '#f59e0b', fontSize: 11, marginTop: 4 }}>{t('reply.standby')}</div>
        )}
      </div>

      <div className={`card ${logExpanded ? 'card-log-expanded' : 'card-fixed-194'}`}>
        <div className="card-title">{t('log.title')}</div>
        <div
          className={`message-log ${logExpanded ? 'message-log-expanded' : 'message-log-fixed-160'}`}
          ref={logRef}
          onScroll={handleLogScroll}
        >
          {logs.length === 0 ? (
            <div className="message-log-empty">{t('log.empty')}</div>
          ) : (
            logs.map((entry, i) => (
              <div className="log-entry" key={i}>
                <span className="log-time">{entry.time}</span>
                <span className={`log-type ${entry.type}`}>{t(`log.type.${entry.type}`)}</span>
                <span>{entry.content}</span>
              </div>
            ))
          )}
        </div>
        <button
          className={`log-expand-btn ${logExpanded ? 'expanded' : ''}`}
          onClick={() => setLogExpanded(!logExpanded)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
          {logExpanded ? t('log.collapse') : t('log.expand')}
        </button>
      </div>

      {showAddObjectModal && (
        <AddObjectModal
          modeId={modeData.id}
          onClose={() => setShowAddObjectModal(false)}
          onSaved={(newObj) => {
            setModeData((prev) => ({
              ...prev,
              specificObjects: [...(prev.specificObjects || []), newObj]
            }))
            onModesChanged()
            setShowAddObjectModal(false)
          }}
        />
      )}

      {editingObject && (
        <EditObjectModal
          modeId={modeData.id}
          object={editingObject}
          onClose={() => setEditingObject(null)}
          onSaved={(updatedObj) => {
            setModeData((prev) => ({
              ...prev,
              specificObjects: (prev.specificObjects || []).map((o) => o.id === updatedObj.id ? updatedObj : o)
            }))
            onModesChanged()
            setEditingObject(null)
          }}
        />
      )}
    </div>
  )
}

function EditObjectModal({
  modeId,
  object,
  onClose,
  onSaved
}: {
  modeId: string
  object: SpecificObject
  onClose: () => void
  onSaved: (obj: SpecificObject) => void
}): React.JSX.Element {
  const { t } = useI18n()
  const [name, setName] = useState(object.name)
  const [title, setTitle] = useState(object.title || '')
  const [relationship, setRelationship] = useState(object.relationship || '')
  const [autoReply, setAutoReply] = useState<boolean | null>(object.autoReply)

  const handleSave = useCallback(async () => {
    if (!name.trim()) { showToast(t('object.name.required'), 'error'); return }
    const result = await window.electron?.invoke('object:update', modeId, object.id, {
      name: name.trim(),
      title: title.trim(),
      relationship: relationship.trim(),
      autoReply
    })
    if (result?.success) {
      showToast(t('object.updated') || '对象已更新', 'success')
      onSaved(result.object)
    } else {
      showToast(result?.error || t('object.update.fail') || '更新失败', 'error')
    }
  }, [name, title, relationship, autoReply, modeId, object.id, onSaved, t])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>{t('object.editTitle') || '编辑特定对象'}</h2>
        <div className="form-group">
          <label className="form-label">{t('object.name')} <span className="required-mark">*</span></label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('object.name.placeholder')} />
          <div className="form-hint">{t('object.name.hint')}</div>
        </div>
        <div className="form-group">
          <label className="form-label">{t('object.title.label')}</label>
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('object.title.placeholder')} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('object.relationship')}</label>
          <input className="form-input" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder={t('object.relationship.placeholder')} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('object.autoReply')}</label>
          <select className="form-input" value={autoReply === null ? '' : autoReply ? 'true' : 'false'} onChange={(e) => {
            if (e.target.value === '') setAutoReply(null)
            else setAutoReply(e.target.value === 'true')
          }}>
            <option value="">{t('object.autoReply.follow')}</option>
            <option value="true">{t('object.autoReply.on')}</option>
            <option value="false">{t('object.autoReply.off')}</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose}>{t('btn.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave}>{t('btn.save')}</button>
        </div>
      </div>
    </div>
  )
}

function AddModeModal({
  onClose,
  onSaved
}: {
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [sentimentEnabled, setSentimentEnabled] = useState(false)
  const [unifiedPrefix, setUnifiedPrefix] = useState('')

  const handleSave = useCallback(async () => {
    if (!name.trim()) { showToast(t('mode.name.required'), 'error'); return }
    if (!prompt.trim()) { showToast(t('mode.prompt.required'), 'error'); return }

    const result = await window.electron?.invoke('mode:create', {
      name: name.trim(),
      prompt: prompt.trim(),
      sentimentEnabled,
      unifiedPrefix
    })
    if (result?.success) {
      showToast(t('toast.modeAdded'), 'success')
      onSaved()
    } else {
      showToast(result?.error || t('toast.addFail'), 'error')
    }
  }, [name, prompt, sentimentEnabled, unifiedPrefix, onSaved, t])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>{t('mode.addTitle')}</h2>
        <div className="form-group">
          <label className="form-label">{t('mode.name')} <span className="required-mark">*</span></label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('mode.name')} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('mode.prompt')} <span className="required-mark">*</span></label>
          <textarea className="form-input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t('mode.prompt.placeholder')} rows={4} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('mode.sentiment')}</label>
          <label className="toggle-switch">
            <input type="checkbox" checked={sentimentEnabled} onChange={(e) => setSentimentEnabled(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
          <div className="form-hint">{t('mode.sentiment.hint')}</div>
        </div>
        <div className="form-group">
          <label className="form-label">{t('mode.unifiedPrefix')}</label>
          <input className="form-input" value={unifiedPrefix} onChange={(e) => setUnifiedPrefix(e.target.value)} placeholder={t('mode.unifiedPrefix.placeholder')} />
          <div className="form-hint">{t('mode.unifiedPrefix.hint')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose}>{t('btn.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave}>{t('btn.add')}</button>
        </div>
      </div>
    </div>
  )
}

function AddObjectModal({
  modeId,
  onClose,
  onSaved
}: {
  modeId: string
  modes?: ReplyMode[]
  onClose: () => void
  onSaved: (obj: SpecificObject) => void
}): React.JSX.Element {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [relationship, setRelationship] = useState('')
  const [targetModeId] = useState(modeId)
  const [autoReply, setAutoReply] = useState<boolean | null>(null)

  const handleSave = useCallback(async () => {
    if (!name.trim()) { showToast(t('object.name.required'), 'error'); return }
    const result = await window.electron?.invoke('object:create', modeId, {
      name: name.trim(),
      title: title.trim(),
      relationship: relationship.trim(),
      modeId: targetModeId,
      autoReply
    })
    if (result?.success) {
      showToast(t('object.added'), 'success')
      onSaved(result.object)
    } else {
      showToast(result?.error || t('object.add.fail'), 'error')
    }
  }, [name, title, relationship, targetModeId, autoReply, modeId, onSaved, t])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>{t('object.addTitle')}</h2>
        <div className="form-group">
          <label className="form-label">{t('object.name')} <span className="required-mark">*</span></label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('object.name.placeholder')} />
          <div className="form-hint">{t('object.name.hint')}</div>
        </div>
        <div className="form-group">
          <label className="form-label">{t('object.title.label')}</label>
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('object.title.placeholder')} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('object.relationship')}</label>
          <input className="form-input" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder={t('object.relationship.placeholder')} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('object.autoReply')}</label>
          <select className="form-input" value={autoReply === null ? '' : autoReply ? 'true' : 'false'} onChange={(e) => {
            if (e.target.value === '') setAutoReply(null)
            else setAutoReply(e.target.value === 'true')
          }}>
            <option value="">{t('object.autoReply.follow')}</option>
            <option value="true">{t('object.autoReply.on')}</option>
            <option value="false">{t('object.autoReply.off')}</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose}>{t('btn.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave}>{t('btn.add')}</button>
        </div>
      </div>
    </div>
  )
}

function SettingsWindow({ theme, setTheme }: { theme: 'dark' | 'light'; setTheme: (th: 'dark' | 'light') => void }): React.JSX.Element {
  const { t, locale, setLocale } = useI18n()
  const [section, setSection] = useState<SettingsSection>('base')

  return (
    <div className="settings-shell">
      <aside className="settings-sidebar">
        <div className="settings-sidebar-brand">
          <img src={theme === 'light' ? logoBlackUrl : logoUrl} alt="AutoReply" className="app-logo" />
          <span>{t('settings.title')}</span>
        </div>
        <button
          className={`settings-nav-item ${section === 'base' ? 'active' : ''}`}
          onClick={() => setSection('base')}
        >
          {t('settings.base')}
        </button>
        <button
          className={`settings-nav-item ${section === 'model' ? 'active' : ''}`}
          onClick={() => setSection('model')}
        >
          {t('settings.model')}
        </button>
        <button
          className={`settings-nav-item ${section === 'training' ? 'active' : ''}`}
          onClick={() => setSection('training')}
        >
          {t('settings.training')}
        </button>
        <button
          className={`settings-nav-item ${section === 'mode' ? 'active' : ''}`}
          onClick={() => setSection('mode')}
        >
          {t('settings.mode')}
        </button>
        <button
          className={`settings-nav-item ${section === 'agent' ? 'active' : ''}`}
          onClick={() => setSection('agent')}
        >
          {t('settings.agent')}
        </button>
      </aside>

      <main className="settings-main">
        {section === 'base' ? <SettingsPanel theme={theme} setTheme={setTheme} locale={locale} setLocale={setLocale} /> : section === 'model' ? <ModelConfigPanel /> : section === 'training' ? <TrainingPanel /> : section === 'mode' ? <ModeManagePanel /> : <AgentPanel />}
      </main>
    </div>
  )
}

function SettingsPanel({ theme, setTheme, locale, setLocale }: { theme: 'dark' | 'light'; setTheme: (th: 'dark' | 'light') => void; locale: Locale; setLocale: (l: Locale) => void }) {
  const { t } = useI18n()
  const [models, setModels] = useState<ModelConfig[]>([])
  const [globalVisionModelId, setGlobalVisionModelId] = useState('')
  const [globalReplyModelId, setGlobalReplyModelId] = useState('')

  useEffect(() => {
    const load = async () => {
      const settings = (await window.electron?.invoke('settings:getAll')) as AppSettings | undefined
      if (settings) {
        setModels(settings.models || [])
        setGlobalVisionModelId(settings.globalVisionModelId || '')
        setGlobalReplyModelId(settings.globalReplyModelId || '')
      }
    }

    void load()
  }, [])

  const handleTestConnection = useCallback(async (modelId: string) => {
    if (!modelId) return
    try {
      const result = await window.electron?.invoke('model:testConnection', modelId)
      if (result?.success) {
        showToast(t('toast.connectionOk'), 'success')
      } else {
        showToast(`${t('toast.connectionFail')}: ${result?.error || ''}`, 'error')
      }
    } catch (e: any) {
      showToast(`${t('toast.connectionFail')}: ${e.message}`, 'error')
    }
  }, [t])

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <div>
          <h1>{t('settings.base')}</h1>
          <p>{t('settings.base.desc')}</p>
        </div>
      </div>

      <div className="card base-settings-card">
        <div className="card-title">{t('settings.basic')}</div>
        <div className="settings-inline-row">
          <span className="settings-inline-label">{t('settings.appearance')}</span>
          <select
            className="form-input settings-inline-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'dark' | 'light')}
          >
            <option value="dark">{t('settings.appearance.dark')}</option>
            <option value="light">{t('settings.appearance.light')}</option>
          </select>
        </div>
        <div className="settings-inline-row">
          <span className="settings-inline-label">{t('settings.language')}</span>
          <select
            className="form-input settings-inline-select"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
          >
            <option value="zh">{t('settings.language.zh')}</option>
            <option value="en">{t('settings.language.en')}</option>
          </select>
        </div>
      </div>

      <div className="card base-settings-card">
        <div className="card-title">{t('settings.globalModel')}</div>
        <div className="form-hint" style={{ marginBottom: 12 }}>
          {t('settings.globalModel.hint')}
        </div>

        <div className="form-group">
          <label className="form-label">{t('settings.visionModel')}</label>
          <select
            className="form-input"
            value={globalVisionModelId}
            onChange={async (e) => {
              const id = e.target.value
              setGlobalVisionModelId(id)
              await window.electron?.invoke('settings:set', { globalVisionModelId: id })
            }}
          >
            <option value="">{t('settings.selectVisionModel')}</option>
            {models.filter((m) => (m.capabilities || []).includes('vision')).map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.modelName})</option>
            ))}
          </select>
          <div className="form-hint">{t('settings.visionModel.hint')}</div>
        </div>

        <div className="form-group">
          <label className="form-label">{t('settings.replyModel')}</label>
          <select
            className="form-input"
            value={globalReplyModelId}
            onChange={async (e) => {
              const id = e.target.value
              setGlobalReplyModelId(id)
              await window.electron?.invoke('settings:set', { globalReplyModelId: id })
            }}
          >
            <option value="">{t('settings.selectReplyModel')}</option>
            {models.filter((m) => (m.capabilities || []).includes('text')).map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.modelName})</option>
            ))}
          </select>
          <div className="form-hint">{t('settings.replyModel.hint')}</div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={() => handleTestConnection(globalVisionModelId)}
            disabled={!globalVisionModelId}
          >
            {t('settings.testConnection')}
          </button>
        </div>
      </div>
    </div>
  )
}

function TrainingPanel(): React.JSX.Element {
  const [training, setTraining] = useState(false)
  const [trainLog, setTrainLog] = useState<{ time: string; message: string }[]>([])
  const trainLogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (data: any) => {
      const msg = data?.message || JSON.stringify(data)
      const time = new Date().toLocaleTimeString('en-US', { hour12: false })
      setTrainLog((prev) => [...prev, { time, message: msg }])
      if (data?.type === 'exited' || data?.type === 'completed' || data?.type === 'error') {
        setTraining(false)
      }
    }
    const cleanup = window.electron?.on('train:event', handler)
    return () => { cleanup?.() }
  }, [])

  useEffect(() => {
    if (trainLogRef.current) {
      trainLogRef.current.scrollTop = trainLogRef.current.scrollHeight
    }
  }, [trainLog])

  useEffect(() => {
    const check = async () => {
      const status = await window.electron?.invoke('train:status')
      if (status?.running) setTraining(true)
    }
    void check()
  }, [])

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <div>
          <h1>模型训练</h1>
          <p>训练和管理 AI 模型。</p>
        </div>
      </div>

      <div className="card base-settings-card">
        <div className="card-title">情感模型训练</div>
        <div className="form-hint" style={{ marginBottom: 12 }}>
          训练基于 BERT 的抑郁倾向分类模型。训练数据来自 Kaggle 中文抑郁数据集，训练完成后自动保存为 best.pt。
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            className="btn btn-primary"
            disabled={training}
            onClick={async () => {
              setTrainLog([])
              setTraining(true)
              const result = await window.electron?.invoke('train:start')
              if (!result?.ok) {
                setTraining(false)
                showToast(result?.error || '启动训练失败', 'error')
              }
            }}
          >
            {training ? '训练中...' : '开始训练'}
          </button>
          {training && (
            <button
              className="btn btn-secondary"
              onClick={async () => {
                await window.electron?.invoke('train:stop')
                setTraining(false)
              }}
            >
              停止训练
            </button>
          )}
        </div>
        <div className="message-log" ref={trainLogRef}>
          {trainLog.length > 0
            ? trainLog.map((entry, i) => (
                <div key={i} className="log-entry">
                  <span className="log-time">{entry.time}</span>
                  <span className="log-type train">TRAIN</span>
                  <span>{entry.message}</span>
                </div>
              ))
            : <div className="message-log-empty">暂无训练日志</div>}
        </div>
      </div>
    </div>
  )
}

function ModelConfigPanel(): React.JSX.Element {
  const [models, setModels] = useState<ModelConfig[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null)
  const [filterProvider, setFilterProvider] = useState('')
  const [testingId, setTestingId] = useState<string | null>(null)

  const loadModels = useCallback(async () => {
    const list = (await window.electron?.invoke('model:list')) as ModelConfig[]
    setModels(list || [])
  }, [])

  useEffect(() => {
    void loadModels()
  }, [loadModels])

  const handleDelete = useCallback(async (id: string) => {
    const result = await window.electron?.invoke('model:delete', id)
    if (result?.success) {
      setModels((prev) => prev.filter((m) => m.id !== id))
      showToast('模型已删除', 'success')
    } else {
      showToast(result?.error || '删除失败', 'error')
    }
  }, [])

  const handleTest = useCallback(async (id: string) => {
    setTestingId(id)
    try {
      const result = await window.electron?.invoke('model:testConnection', id)
      if (result?.success) {
        showToast('连接测试成功', 'success')
      } else {
        showToast(`连接测试失败: ${result?.error || ''}`, 'error')
      }
    } catch (e: any) {
      showToast(`连接测试失败: ${e.message}`, 'error')
    } finally {
      setTestingId(null)
    }
  }, [])

  const filteredModels = filterProvider
    ? models.filter((m) => m.provider === filterProvider)
    : models

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <div>
          <h1>模型配置</h1>
          <p>管理不同供应商的 AI 模型，配置 API Key 和连接参数。</p>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <select
            className="form-input"
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
            style={{ maxWidth: 200 }}
          >
            <option value="">全部供应商</option>
            {PROVIDER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={() => { setEditingModel(null); setShowAddModal(true) }}
          >
            + 添加模型
          </button>
        </div>

        {filteredModels.length === 0 ? (
          <div className="message-log-empty">
            {models.length === 0 ? '暂无模型配置，点击"添加模型"开始' : '当前筛选条件下无模型'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredModels.map((model) => {
              const preset = PROVIDER_PRESETS.find((p) => p.id === model.provider)
              return (
                <div key={model.id} className="provider-card" style={{ cursor: 'default' }}>
                  <div className="provider-card-top">
                    <span className="provider-name">
                      {model.name}
                      {(model.capabilities || []).map((cap) => {
                        const capMeta: Record<string, { label: string; color: string }> = {
                          text: { label: '文本', color: '#3b82f6' },
                          vision: { label: '视觉', color: '#10b981' },
                          audio: { label: '语音', color: '#f59e0b' }
                        }
                        const meta = capMeta[cap]
                        if (!meta) return null
                        return (
                          <span
                            key={cap}
                            style={{
                              display: 'inline-block',
                              marginLeft: 6,
                              padding: '1px 6px',
                              borderRadius: 8,
                              fontSize: 10,
                              background: meta.color + '22',
                              color: meta.color,
                              border: `1px solid ${meta.color}44`,
                              verticalAlign: 'middle'
                            }}
                          >
                            {meta.label}
                          </span>
                        )
                      })}
                    </span>
                    <span className="provider-version" style={{ color: '#94a3b8' }}>
                      {preset?.name || model.provider}
                    </span>
                  </div>
                  <div className="provider-desc">
                    {model.modelName} · {model.baseURL || '默认端点'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => { setEditingModel(model); setShowAddModal(true) }}
                    >
                      编辑
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      disabled={testingId === model.id}
                      onClick={() => handleTest(model.id)}
                    >
                      {testingId === model.id ? '测试中...' : '测试连接'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12, padding: '4px 10px', color: '#ef4444' }}
                      onClick={() => handleDelete(model.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAddModal && (
        <ModelEditModal
          model={editingModel}
          onClose={() => { setShowAddModal(false); setEditingModel(null) }}
          onSaved={() => { loadModels(); setShowAddModal(false); setEditingModel(null) }}
        />
      )}
    </div>
  )
}

function ModelEditModal({
  model,
  onClose,
  onSaved
}: {
  model: ModelConfig | null
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const isEdit = model !== null
  const [name, setName] = useState(model?.name || '')
  const [provider, setProvider] = useState(model?.provider || 'volcengine-ark')
  const [modelName, setModelName] = useState(model?.modelName || '')
  const [apiKey, setApiKey] = useState(model?.apiKey || '')
  const [baseURL, setBaseURL] = useState(model?.baseURL || '')
  const [capabilities, setCapabilities] = useState<ModelCapability[]>(model?.capabilities || ['text'])

  useEffect(() => {
    if (!isEdit) {
      const preset = PROVIDER_PRESETS.find((p) => p.id === provider)
      if (preset) {
        setModelName(preset.defaultModel)
        setBaseURL(preset.defaultBaseURL)
        setCapabilities([...preset.defaultCapabilities])
      }
    }
  }, [provider, isEdit])

  const handleSave = useCallback(async () => {
    if (!modelName.trim()) { showToast('模型标识不能为空', 'error'); return }
    if (!apiKey.trim()) { showToast('API Key 不能为空', 'error'); return }

    const displayName = name.trim() || modelName.trim()
    const input = { name: displayName, provider, modelName: modelName.trim(), apiKey, baseURL, capabilities }
    const result = isEdit
      ? await window.electron?.invoke('model:update', model!.id, input)
      : await window.electron?.invoke('model:create', input)

    if (result?.success) {
      showToast(isEdit ? '模型已更新' : '模型已添加', 'success')
      onSaved()
    } else {
      showToast(result?.error || '操作失败', 'error')
    }
  }, [name, provider, modelName, apiKey, baseURL, capabilities, isEdit, model, onSaved])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>{isEdit ? '编辑模型' : '添加模型'}</h2>

        <div className="form-group">
          <label className="form-label">供应商 <span className="required-mark">*</span></label>
          <select className="form-input" value={provider} onChange={(e) => {
            const p = e.target.value
            setProvider(p)
            if (!isEdit) {
              const preset = PROVIDER_PRESETS.find((pr) => pr.id === p)
              if (preset) {
                if (!baseURL) setBaseURL(preset.defaultBaseURL)
                if (!modelName) setModelName(preset.defaultModel)
              }
            }
          }} disabled={isEdit}>
            {PROVIDER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">模型名称</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：我的豆包模型（可选）" />
          <div className="form-hint">用于在界面中识别此模型配置，留空则使用模型标识</div>
        </div>

        <div className="form-group">
          <label className="form-label">模型标识 <span className="required-mark">*</span></label>
          <input className="form-input" value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="例如：doubao-seed-2-0-lite-260215" />
          <div className="form-hint">API 调用时使用的模型 ID</div>
        </div>

        <div className="form-group">
          <label className="form-label">API Key <span className="required-mark">*</span></label>
          <input className="form-input" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="输入 API Key" autoComplete="off" />
        </div>

        <div className="form-group">
          <label className="form-label">Base URL</label>
          <input className="form-input" value={baseURL} onChange={(e) => setBaseURL(e.target.value)} placeholder="https://ark.cn-beijing.volces.com/api/v3" />
          <div className="form-hint">API 端点地址，选择供应商后会自动填充</div>
        </div>

        <div className="form-group">
          <label className="form-label">模型能力</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {([
              { key: 'text' as ModelCapability, label: '文本', color: '#3b82f6' },
              { key: 'vision' as ModelCapability, label: '视觉', color: '#10b981' },
              { key: 'audio' as ModelCapability, label: '语音', color: '#f59e0b' }
            ]).map((cap) => {
              const active = capabilities.includes(cap.key)
              return (
                <button
                  key={cap.key}
                  type="button"
                  onClick={() => {
                    setCapabilities((prev) =>
                      prev.includes(cap.key)
                        ? prev.filter((c) => c !== cap.key)
                        : [...prev, cap.key]
                    )
                  }}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 12,
                    fontSize: 12,
                    border: `1.5px solid ${active ? cap.color : '#475569'}`,
                    background: active ? cap.color : 'transparent',
                    color: active ? '#fff' : '#94a3b8',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {cap.label}
                </button>
              )
            })}
          </div>
          <div className="form-hint">点击选择该模型支持的能力，至少选择"文本"</div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave}>{isEdit ? '保存' : '添加'}</button>
        </div>
      </div>
    </div>
  )
}

function ModeManagePanel(): React.JSX.Element {
  const [modes, setModes] = useState<ReplyMode[]>([])
  const [globalDefaultModeId, setGlobalDefaultModeId] = useState('')
  const [globalAutoReply, setGlobalAutoReply] = useState(false)
  const [editingMode, setEditingMode] = useState<ReplyMode | null>(null)

  const loadModes = useCallback(async () => {
    const list = (await window.electron?.invoke('mode:list')) as ReplyMode[]
    setModes(list || [])
    const settings = (await window.electron?.invoke('settings:getAll')) as AppSettings | undefined
    setGlobalDefaultModeId(settings?.globalDefaultModeId || '')
    setGlobalAutoReply(!!settings?.globalAutoReply)
  }, [])

  useEffect(() => {
    void loadModes()
  }, [loadModes])

  const handleToggleEnabled = useCallback(async (id: string, enabled: boolean) => {
    const result = await window.electron?.invoke('mode:toggleEnabled', id, enabled)
    if (result?.success) {
      setModes((prev) => prev.map((m) => (m.id === id ? { ...m, enabled } : m)))
      window.electron?.send('mode:changed')
    } else {
      showToast(result?.error || '操作失败', 'error')
    }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    const result = await window.electron?.invoke('mode:delete', id)
    if (result?.success) {
      setModes((prev) => prev.filter((m) => m.id !== id))
      showToast('模式已删除', 'success')
      window.electron?.send('mode:changed')
    } else {
      showToast(result?.error || '删除失败', 'error')
    }
  }, [])

  const handleSetDefault = useCallback(async (id: string) => {
    setGlobalDefaultModeId(id)
    await window.electron?.invoke('settings:set', { globalDefaultModeId: id })
  }, [])

  const handleSetGlobalAutoReply = useCallback(async (val: boolean) => {
    setGlobalAutoReply(val)
    await window.electron?.invoke('settings:set', { globalAutoReply: val })
  }, [])

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <div>
          <h1>模式管理</h1>
          <p>管理回复模式，配置全局默认模式和自动回复设置。</p>
        </div>
      </div>

      <div className="card">
        <div className="card-title">全局设置</div>
        <div className="form-group">
          <label className="form-label">全局默认模式</label>
          <select className="form-input" value={globalDefaultModeId} onChange={(e) => handleSetDefault(e.target.value)}>
            {modes.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <div className="form-hint">未匹配特定对象时使用的模式</div>
        </div>
        <div className="form-group">
          <label className="form-label">全局自动回复</label>
          <label className="toggle-switch">
            <input type="checkbox" checked={globalAutoReply} onChange={(e) => handleSetGlobalAutoReply(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
          <div className="form-hint">非特定对象的默认自动回复设置</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">模式列表</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {modes.map((mode) => (
            <div key={mode.id} className="provider-card" style={{ cursor: 'pointer', height: 'auto' }} onClick={() => setEditingMode(mode)}>
              <div className="provider-card-top">
                <span className="provider-name">{mode.name}</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {mode.source === 'system' && <span className="mode-info-badge mode-badge-system">系统</span>}
                  <span className={`mode-status ${mode.enabled ? 'running' : 'stopped'}`} style={{ fontSize: 11 }}>
                    {mode.enabled ? '已启用' : '已禁用'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 7 }} onClick={(e) => e.stopPropagation()}>
                <div className="provider-desc" style={{ flex: 1, maxHeight: 40, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {mode.prompt.slice(0, 80)}{mode.prompt.length > 80 ? '...' : ''}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleToggleEnabled(mode.id, !mode.enabled)}
                  >
                    {mode.enabled ? '禁用' : '启用'}
                  </button>
                  {mode.source === 'custom' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ color: '#ef4444' }}
                      onClick={() => handleDelete(mode.id)}
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
              {mode.specificObjects.length > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  {mode.specificObjects.length} 个特定对象
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {editingMode && (
        <ModeDetailModal
          mode={editingMode}
          onClose={() => setEditingMode(null)}
          onSaved={() => { loadModes(); setEditingMode(null); window.electron?.send('mode:changed') }}
        />
      )}
    </div>
  )
}

function ModeDetailModal({
  mode,
  onClose,
  onSaved
}: {
  mode: ReplyMode
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [name, setName] = useState(mode.name)
  const [prompt, setPrompt] = useState(mode.prompt)
  const [sentimentEnabled, setSentimentEnabled] = useState(mode.sentimentEnabled)
  const [unifiedPrefix, setUnifiedPrefix] = useState(mode.unifiedPrefix)
  const [autoReply, setAutoReply] = useState(mode.autoReply)

  const handleSave = useCallback(async () => {
    if (!name.trim()) { showToast('模式名称不能为空', 'error'); return }
    if (!prompt.trim()) { showToast('回复规则不能为空', 'error'); return }

    const result = await window.electron?.invoke('mode:update', mode.id, {
      name: name.trim(),
      prompt: prompt.trim(),
      sentimentEnabled,
      unifiedPrefix,
      autoReply
    })
    if (result?.success) {
      showToast('模式已更新', 'success')
      onSaved()
    } else {
      showToast(result?.error || '更新失败', 'error')
    }
  }, [mode.id, name, prompt, sentimentEnabled, unifiedPrefix, autoReply, onSaved])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>模式详情 - {mode.name}</h2>
        <div className="form-group">
          <label className="form-label">模式名称</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">回复规则 (Prompt)</label>
          <textarea className="form-input" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} />
        </div>
        <div className="form-group">
          <label className="form-label">情感分析</label>
          <label className="toggle-switch">
            <input type="checkbox" checked={sentimentEnabled} onChange={(e) => setSentimentEnabled(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>
        <div className="form-group">
          <label className="form-label">统一开头</label>
          <input className="form-input" value={unifiedPrefix} onChange={(e) => setUnifiedPrefix(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">自动回复</label>
          <label className="toggle-switch">
            <input type="checkbox" checked={autoReply} onChange={(e) => setAutoReply(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>
        {mode.specificObjects.length > 0 && (
          <div className="form-group">
            <label className="form-label">特定对象 ({mode.specificObjects.length})</label>
            <div className="object-list">
              {mode.specificObjects.map((obj) => (
                <div key={obj.id} className="object-item">
                  <div className="object-item-info">
                    <span className="object-item-name">{obj.name}</span>
                    {obj.title && <span className="object-item-detail">称呼: {obj.title}</span>}
                    {obj.relationship && <span className="object-item-detail">关系: {obj.relationship}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  )
}

function AgentPanel(): React.JSX.Element {
  const [catalog, setCatalog] = useState<ProviderCatalogItem[]>(BUILTIN_PROVIDER_CATALOG)
  const [selectedId, setSelectedId] = useState(BUILTIN_PROVIDER_CATALOG[0]?.id || '')
  const [activeId, setActiveId] = useState('doubao')
  const [providerDrafts, setProviderDrafts] = useState<Record<string, Record<string, string>>>({})
  const [currentSettings, setCurrentSettings] = useState<AppSettings | null>(null)
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [updatingCatalog, setUpdatingCatalog] = useState(false)
  const selectedProvider = catalog.find((provider) => provider.id === selectedId) || catalog[0]

  const loadSettingsAndCatalog = useCallback(async (forceUpdate: boolean) => {
    setLoadingCatalog(!forceUpdate)
    setUpdatingCatalog(forceUpdate)
    try {
      const [settings, result] = await Promise.all([
        window.electron?.invoke('settings:getAll') as Promise<AppSettings | undefined>,
        window.electron?.invoke(forceUpdate ? 'providerHub:update' : 'providerHub:getCatalog') as Promise<ProviderHubResult>
      ])

      const nextCatalog = mergeProviderCatalog(result?.catalog?.providers || [])
      const nextActiveId = settings?.chatProvider?.installed?.id || 'doubao'
      setCatalog(nextCatalog)
      setCurrentSettings(settings || null)
      setActiveId(nextActiveId)
      setSelectedId((current) => current || nextActiveId || BUILTIN_PROVIDER_CATALOG[0]?.id || nextCatalog[0]?.id || '')
      setProviderDrafts((prev) => ({
        ...prev,
        doubao: {
          ...getProviderDefaults(BUILTIN_PROVIDER_CATALOG[0]),
          ...(prev.doubao || {}),
          ...(!settings?.chatProvider?.installed ? settings?.chatProvider?.config || {} : {}),
          apiKey: prev.doubao?.apiKey || settings?.vision?.apiKey || ''
        },
        [nextActiveId]: {
          ...getProviderDefaults(nextCatalog.find((provider) => provider.id === nextActiveId)),
          ...(prev[nextActiveId] || {}),
          ...(settings?.chatProvider?.config || {})
        }
      }))

      if (result && !result.success) {
        showToast(`智能体列表加载失败: ${result.error || ''}`, 'error')
      } else if (forceUpdate) {
        showToast('智能体列表已更新', 'success')
      }
    } finally {
      setLoadingCatalog(false)
      setUpdatingCatalog(false)
    }
  }, [])

  useEffect(() => {
    void loadSettingsAndCatalog(false)
  }, [loadSettingsAndCatalog])

  const selectedValues = useMemo(
    () => getProviderValues(providerDrafts, selectedProvider, currentSettings),
    [currentSettings, providerDrafts, selectedProvider]
  )

  const setProviderValue = useCallback(
    (fieldKey: string, value: string) => {
      if (!selectedProvider) return
      setProviderDrafts((prev) => ({
        ...prev,
        [selectedProvider.id]: {
          ...getProviderValues(prev, selectedProvider, currentSettings),
          [fieldKey]: value
        }
      }))
    },
    [currentSettings, selectedProvider]
  )

  const persistProvider = useCallback(
    async (provider: ProviderCatalogItem, values: Record<string, string>) => {
      const missing = getMissingRequiredFields(provider, values)
      if (missing.length > 0) {
        showToast(`缺少必填项: ${missing.join('、')}`, 'error')
        return false
      }

      if (provider.id === 'doubao') {
        const { apiKey, ...providerConfig } = values
        await window.electron?.invoke('settings:set', {
          vision: { apiKey },
          chatProvider: {
            manifestUrl: '',
            installed: null,
            config: providerConfig
          }
        })
        const settings = (await window.electron?.invoke('settings:getAll')) as AppSettings
        await window.electron?.invoke('engine:updateConfig', settings)
        setCurrentSettings(settings)
        setActiveId('doubao')
        return true
      }

      const installResult = await window.electron?.invoke('provider:installFromUrl', provider.manifestUrl)
      if (!installResult?.success) {
        showToast(installResult?.error || '智能体安装失败', 'error')
        return false
      }

      await window.electron?.invoke('settings:set', {
        chatProvider: {
          manifestUrl: provider.manifestUrl,
          installed: installResult.installed,
          config: values
        }
      })
      const settings = (await window.electron?.invoke('settings:getAll')) as AppSettings
      await window.electron?.invoke('engine:updateConfig', settings)
      setCurrentSettings(settings)
      setActiveId(provider.id)
      return true
    },
    []
  )

  const handleSaveConfig = useCallback(async () => {
    if (!selectedProvider) return
    const ok = await persistProvider(selectedProvider, selectedValues)
    if (ok) showToast('智能体配置已保存', 'success')
  }, [persistProvider, selectedProvider, selectedValues])

  const handleActivate = useCallback(async () => {
    if (!selectedProvider) return
    const ok = await persistProvider(selectedProvider, selectedValues)
    if (ok) showToast('已切换当前智能体', 'success')
  }, [persistProvider, selectedProvider, selectedValues])

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <div>
          <div className="settings-title-row">
            <h1>智能体</h1>
            <button
              className="icon-action refresh-action"
              onClick={() => loadSettingsAndCatalog(true)}
              disabled={updatingCatalog}
              title={updatingCatalog ? '更新中...' : '更新列表'}
              aria-label={updatingCatalog ? '更新中' : '更新智能体列表'}
            >
              <span className={updatingCatalog ? 'refresh-icon spinning' : 'refresh-icon'}>
                <RefreshIcon />
              </span>
            </button>
            {updatingCatalog ? <span className="inline-status">更新中...</span> : null}
          </div>
          <p>选择负责聊天分析和内容生成的智能体，并维护各自配置。</p>
        </div>
      </div>

      {loadingCatalog ? (
        <div className="provider-hub-meta">
          <span className="spinner" />
          正在加载远端智能体列表
        </div>
      ) : null}

      <div className="provider-layout">
        <div className="provider-list">
          {!loadingCatalog && catalog.length === 0 ? (
            <div className="provider-empty">暂无可用智能体，请点击更新列表。</div>
          ) : null}
          {catalog.map((provider) => {
            const description = provider.description || provider.name
            const active = activeId === provider.id

            return (
              <button
                key={provider.id}
                className={`provider-card ${selectedId === provider.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(provider.id)}
              >
                <div className="provider-card-top">
                  <span className="provider-name">{provider.name}</span>
                  {active ? (
                    <span className="provider-status" title="当前启用" aria-label="当前启用">
                      <span className="provider-status-dot" />
                      启用中
                    </span>
                  ) : null}
                </div>
                <div className="provider-desc" title={description}>
                  {description}
                </div>
                <div className="provider-version">v{provider.version}</div>
              </button>
            )
          })}
        </div>

        <div className="card provider-config-card">
          {selectedProvider ? (
            <>
              <div className="provider-config-header">
                <div>
                  <div className="card-title">智能体配置</div>
                  <h2>{selectedProvider.name}</h2>
                </div>
                <span className="provider-version">v{selectedProvider.version}</span>
              </div>

              {selectedProvider.configSchema.fields.map((field) => (
                <ProviderFieldInput
                  key={field.key}
                  field={field}
                  value={selectedValues[field.key] || ''}
                  onChange={(value) => setProviderValue(field.key, value)}
                />
              ))}

              <div className="provider-actions">
                <button className="btn btn-secondary" onClick={handleSaveConfig}>
                  保存配置
                </button>
                <button className="btn btn-primary" onClick={handleActivate}>
                  启用此智能体
                </button>
              </div>
            </>
          ) : (
            <div className="provider-empty">没有选中的智能体。</div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProviderFieldInput({
  field,
  value,
  onChange
}: {
  field: ProviderConfigField
  value: string
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <div className="form-group">
      <label className="form-label">
        {field.label}
        {field.required ? <span className="required-mark"> *</span> : null}
      </label>
      {field.type === 'textarea' ? (
        <textarea
          className="form-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          rows={4}
          readOnly={field.readonly}
        />
      ) : field.type === 'select' ? (
        <select
          className="form-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={field.readonly}
        >
          {(field.options || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="form-input"
          type={field.type === 'password' ? 'password' : field.type === 'url' ? 'url' : 'text'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          autoComplete="off"
          readOnly={field.readonly}
        />
      )}
      {field.hint ? <div className="form-hint">{field.hint}</div> : null}
    </div>
  )
}

function mergeProviderCatalog(remoteProviders: ProviderCatalogItem[]): ProviderCatalogItem[] {
  const remoteOnly = remoteProviders.filter(
    (provider) => !BUILTIN_PROVIDER_CATALOG.some((builtin) => builtin.id === provider.id)
  )
  return [...BUILTIN_PROVIDER_CATALOG, ...remoteOnly]
}

function getProviderDefaults(provider: ProviderCatalogItem | undefined): Record<string, string> {
  if (!provider) return {}
  return provider.configSchema.fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.key] = field.defaultValue || ''
    return acc
  }, {})
}

function getProviderValues(
  drafts: Record<string, Record<string, string>>,
  provider: ProviderCatalogItem | undefined,
  settings: AppSettings | null
): Record<string, string> {
  if (!provider) return {}
  const defaults = getProviderDefaults(provider)
  if (provider.id === 'doubao') {
    return {
      ...defaults,
      ...(settings?.chatProvider.installed ? {} : settings?.chatProvider.config || {}),
      apiKey: drafts.doubao?.apiKey || settings?.vision.apiKey || '',
      ...(drafts.doubao || {})
    }
  }
  return {
    ...defaults,
    ...(settings?.chatProvider.installed?.id === provider.id ? settings.chatProvider.config : {}),
    ...(drafts[provider.id] || {})
  }
}

function getMissingRequiredFields(
  provider: ProviderCatalogItem,
  values: Record<string, string>
): string[] {
  return provider.configSchema.fields
    .filter((field) => field.required && !values[field.key]?.trim())
    .map((field) => field.label)
}

let _showToast: ((msg: string, type: 'success' | 'error', duration?: number) => void) | null = null

export function showToast(msg: string, type: 'success' | 'error', duration?: number) {
  _showToast?.(msg, type, duration)
}

function Toast() {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')
  const [type, setType] = useState<'success' | 'error'>('success')
  const timerRef = useRef<number | undefined>(undefined)

  _showToast = useCallback((msg: string, t: 'success' | 'error', duration?: number) => {
    setMessage(msg)
    setType(t)
    setVisible(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setVisible(false), duration ?? 2500)
  }, [])

  return <div className={`toast ${type} ${visible ? 'show' : ''}`}>{message}</div>
}

export default App
