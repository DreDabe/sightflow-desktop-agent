import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { t } from './i18n'
import logoUrl from './assets/logo.png'
import MemoryWindow from './MemoryWindow'
import './index.css'

interface LogEntry {
  time: string
  type: 'thinking' | 'reply' | 'skip' | 'error'
  content: string
}

type EngineStatus = 'idle' | 'running' | 'error'
type SettingsSection = 'base' | 'model' | 'agent'
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

const VLM_SUPPORTED_APPS: AppType[] = ['wechat', 'wework']

function isVlmSupported(appType: AppType): boolean {
  return VLM_SUPPORTED_APPS.includes(appType)
}

interface ProviderSchemaField {
  type: 'string' | 'password' | 'select' | 'boolean'
  title: string
  default?: string | boolean
  enum?: string[]
}

interface ProviderManifest {
  apiVersion: 1
  id: string
  name: string
  version: string
  entry: string
  capabilities: ['chat']
  configSchema: {
    type: 'object'
    properties: Record<string, ProviderSchemaField>
    required?: string[]
  }
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
}

interface ModelConfig {
  id: string
  name: string
  provider: string
  modelName: string
  apiKey: string
  baseURL: string
  createdAt: number
}

const PROVIDER_PRESETS = [
  { id: 'volcengine-ark', name: '火山方舟 (Volcengine Ark)', defaultBaseURL: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: 'doubao-seed-2-0-lite-260215' },
  { id: 'openai', name: 'OpenAI', defaultBaseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  { id: 'deepseek', name: 'DeepSeek', defaultBaseURL: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  { id: 'custom', name: '自定义', defaultBaseURL: '', defaultModel: '' }
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
  <svg viewBox="0 0 24 24" fill="currentColor">
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

function App() {
  const windowKind = new URLSearchParams(window.location.search).get('window')
  const [status, setStatus] = useState<EngineStatus>('idle')

  // Sync UI status with engine state changes triggered out-of-band
  // (e.g. remote OpenClaw start/pause via the local skill HTTP server).
  useEffect(() => {
    const cleanup = window.electron?.on('engine:state', (data: { status: 'running' | 'idle' }) => {
      setStatus(data.status === 'running' ? 'running' : 'idle')
    })
    return cleanup
  }, [])

  if (windowKind === 'settings') {
    return (
      <div className="app settings-window">
        <SettingsWindow />
        <Toast />
      </div>
    )
  }

  if (windowKind === 'memory') {
    return (
      <div className="app settings-window">
        <MemoryWindow />
        <Toast />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <img src={logoUrl} alt="SightFlow" className="app-logo" />
      </header>

      <div className="app-content">
        <ControlPanel status={status} setStatus={setStatus} />
      </div>

      <BottomBar status={status} setStatus={setStatus} />

      <Toast />
    </div>
  )
}

function ControlPanel({
  status,
  setStatus
}: {
  status: EngineStatus
  setStatus: (s: EngineStatus) => void
}) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  // 首屏目标应用 + 框选状态：直接读 / 写 settings，让用户上手第一步就能完成。
  const [appType, setAppType] = useState<AppType>('wechat')
  const [regions, setRegions] = useState<BoxRegions | null>(null)
  const [openingWizard, setOpeningWizard] = useState(false)

  const reloadRegionsForApp = useCallback(async (type: AppType) => {
    const r = (await window.electron?.invoke('capture:getRegions', type)) as BoxRegions | null
    setRegions(r ?? null)
  }, [])

  // 初次加载：读出当前 appType + 对应的框选区域
  useEffect(() => {
    void (async () => {
      const settings = (await window.electron?.invoke('settings:getAll')) as
        | AppSettings
        | undefined
      const initial = settings?.appType || 'wechat'
      setAppType(initial)
      await reloadRegionsForApp(initial)
    })()
  }, [reloadRegionsForApp])

  // 监听 main 进程的"区域已更新"事件——比如向导刚跑完
  useEffect(() => {
    const cleanup = window.electron?.on(
      'capture:regions-updated',
      (data: { appType: AppType; regions: BoxRegions | null }) => {
        if (data.appType === appType) setRegions(data.regions)
      }
    )
    return cleanup
  }, [appType])

  const handleAppTypeChange = useCallback(
    async (next: AppType) => {
      if (status === 'running') return
      setAppType(next)
      await window.electron?.invoke('settings:set', { appType: next })
      await window.electron?.invoke('engine:updateConfig', {
        ...((await window.electron?.invoke('settings:getAll')) as AppSettings),
        appType: next
      })
      await reloadRegionsForApp(next)
    },
    [reloadRegionsForApp, status]
  )

  const handleOpenWizard = useCallback(async () => {
    if (status === 'running') return
    setOpeningWizard(true)
    try {
      const result = (await window.electron?.invoke('capture:openSetupWizard', {
        appType
      })) as { success: boolean; reason?: string; regions?: BoxRegions } | undefined
      if (result?.success && result.regions) {
        setRegions(result.regions)
        showToast('已保存框选区域', 'success')
      } else if (result?.reason === 'cancelled' || result?.reason === 'closed') {
        showToast('框选已取消', 'error')
      } else {
        showToast('框选失败', 'error')
      }
    } finally {
      setOpeningWizard(false)
    }
  }, [appType, status])

  const addLog = useCallback((type: LogEntry['type'], content: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false })
    setLogs((prev) => [...prev.slice(-99), { time, type, content }])
  }, [])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  useEffect(() => {
    const cleanup = window.electron?.on('engine:log', (data: { type: string; content: string }) => {
      addLog(data.type as LogEntry['type'], data.content)

      if (data.type === 'error' && data.content.includes('引擎无法启动')) {
        setStatus('error')
      }
    })
    return cleanup
  }, [addLog, setStatus])

  const statusLabel =
    status === 'running'
      ? t('status.running')
      : status === 'error'
        ? t('status.error')
        : t('status.idle')

  const isVlm = isVlmSupported(appType)
  const captureReady = isVlm || regions !== null

  return (
    <div className="fade-in">
      <div className={`status-indicator ${status}`}>
        <div className={`status-dot ${status}`} />
        <span className="status-text">{statusLabel}</span>
      </div>

      <TargetAppQuickCard
        appType={appType}
        regions={regions}
        captureReady={captureReady}
        isVlm={isVlm}
        openingWizard={openingWizard}
        running={status === 'running'}
        onAppTypeChange={handleAppTypeChange}
        onOpenWizard={handleOpenWizard}
      />

      <div className="card">
        <div className="card-title">{t('control.log')}</div>
        <div className="message-log" ref={logRef}>
          {logs.length === 0 ? (
            <div className="message-log-empty">{t('control.log.empty')}</div>
          ) : (
            logs.map((entry, i) => (
              <div className="log-entry" key={i}>
                <span className="log-time">{entry.time}</span>
                <span className={`log-type ${entry.type}`}>
                  {t(`control.log.${entry.type}` as never)}
                </span>
                <span>{entry.content}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

interface TargetAppQuickCardProps {
  appType: AppType
  regions: BoxRegions | null
  captureReady: boolean
  isVlm: boolean
  openingWizard: boolean
  running: boolean
  onAppTypeChange: (t: AppType) => void
  onOpenWizard: () => void
}

// 首屏的"目标应用 + 框选"快捷卡片：让新用户开箱即用，不用先翻设置。
function TargetAppQuickCard({
  appType,
  regions,
  captureReady,
  isVlm,
  openingWizard,
  running,
  onAppTypeChange,
  onOpenWizard
}: TargetAppQuickCardProps): React.JSX.Element {
  const statusText = isVlm
    ? '自动识别（VLM）'
    : regions
      ? '已框选 3 / 3 个区域'
      : '尚未框选'

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-title">目标应用</div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <select
          className="form-input"
          value={appType}
          onChange={(e) => onAppTypeChange(e.target.value as AppType)}
          disabled={running || openingWizard}
          style={{ flex: 1 }}
        >
          {(Object.keys(APP_TYPE_LABELS) as AppType[]).map((type) => (
            <option key={type} value={type}>
              {APP_TYPE_LABELS[type]}
              {!isVlmSupported(type) ? '（框选）' : ''}
            </option>
          ))}
        </select>

        {!isVlm && (
          <button
            className="btn btn-primary"
            onClick={onOpenWizard}
            disabled={running || openingWizard}
            style={{
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {regions ? (
                // 重新框选 — 旋转刷新图标
                <>
                  <path d="M21 12a9 9 0 1 1-3-6.7" />
                  <path d="M21 4v5h-5" />
                </>
              ) : (
                // 开始框选 — 矩形 + 十字
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </>
              )}
            </svg>
            {openingWizard ? '打开中...' : regions ? '重新框选' : '开始框选'}
          </button>
        )}
      </div>

      <div
        className="form-hint"
        style={{
          marginTop: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: captureReady ? '#94a3b8' : '#fbbf24'
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: 999,
            background: captureReady ? '#34d399' : '#fbbf24'
          }}
        />
        {statusText}
        {!isVlm && !regions ? '：点右侧按钮先把 3 个关键区域圈出来' : ''}
      </div>
    </div>
  )
}

function BottomBar({
  status,
  setStatus
}: {
  status: EngineStatus
  setStatus: (s: EngineStatus) => void
}) {
  const handleStart = useCallback(async () => {
    const settings = (await window.electron?.invoke('settings:getAll')) as AppSettings | undefined
    if (!settings?.vision?.apiKey) {
      showToast(t('control.start.novisionkey'), 'error')
      return
    }
    // 没装自定义 provider → 走内置 doubao（getInstalled 会返回 isBuiltinDefault: true）
    const providerInfo = (await window.electron?.invoke('provider:getInstalled')) as {
      manifest: ProviderManifest | null
      isBuiltinDefault?: boolean
    }
    // doubao 默认共享视觉密钥，required 已剥离 apiKey
    const required = providerInfo?.manifest?.configSchema?.required || []
    const missing = required.find((key) => {
      const value = settings.chatProvider.config?.[key]
      return value === undefined || value === null || value === ''
    })
    if (missing) {
      showToast(`${t('control.start.missingProviderField')}: ${missing}`, 'error')
      return
    }

    const result = await window.electron?.invoke('engine:start', settings)
    if (result?.success) {
      setStatus('running')
      showToast(t('toast.engineStarted'), 'success')
    } else {
      setStatus('error')
      showToast(result?.error || t('toast.startFailed'), 'error')
    }
  }, [setStatus])

  const handleStop = useCallback(async () => {
    await window.electron?.invoke('engine:stop')
    setStatus('idle')
    showToast(t('toast.engineStopped'), 'success')
  }, [setStatus])

  const running = status === 'running'

  return (
    <div className="bottom-bar">
      {running ? (
        <button className="bottom-btn bottom-btn-stop" onClick={handleStop}>
          <StopIcon />
          {t('control.stop')}
        </button>
      ) : (
        <button className="bottom-btn bottom-btn-play" onClick={handleStart}>
          <PlayIcon />
          {t('control.start')}
        </button>
      )}
      <button
        className="bottom-btn bottom-btn-settings"
        onClick={() => window.electron?.invoke('memory:open')}
        title="工作记忆"
      >
        <MemoryIcon />
      </button>
      <button
        className="bottom-btn bottom-btn-settings"
        onClick={() => window.electron?.invoke('settings:open')}
        title="设置"
      >
        <GearIcon />
      </button>
    </div>
  )
}

function SettingsWindow(): React.JSX.Element {
  const [section, setSection] = useState<SettingsSection>('base')

  return (
    <div className="settings-shell">
      <aside className="settings-sidebar">
        <div className="settings-sidebar-brand">
          <img src={logoUrl} alt="SightFlow" className="app-logo" />
          <span>设置</span>
        </div>
        <button
          className={`settings-nav-item ${section === 'base' ? 'active' : ''}`}
          onClick={() => setSection('base')}
        >
          基础配置
        </button>
        <button
          className={`settings-nav-item ${section === 'model' ? 'active' : ''}`}
          onClick={() => setSection('model')}
        >
          模型配置
        </button>
        <button
          className={`settings-nav-item ${section === 'agent' ? 'active' : ''}`}
          onClick={() => setSection('agent')}
        >
          智能体
        </button>
      </aside>

      <main className="settings-main">
        {section === 'base' ? <SettingsPanel /> : section === 'model' ? <ModelConfigPanel /> : <AgentPanel />}
      </main>
    </div>
  )
}

function SettingsPanel() {
  const [visionApiKey, setVisionApiKey] = useState('')
  const [visionModel, setVisionModel] = useState('')
  const [visionBaseUrl, setVisionBaseUrl] = useState('')
  const [testing, setTesting] = useState(false)
  const [training, setTraining] = useState(false)
  const [trainLog, setTrainLog] = useState<{ time: string; message: string }[]>([])
  const trainLogRef = useRef<HTMLDivElement>(null)
  const [models, setModels] = useState<ModelConfig[]>([])
  const [globalVisionModelId, setGlobalVisionModelId] = useState('')
  const [globalReplyModelId, setGlobalReplyModelId] = useState('')

  useEffect(() => {
    const load = async () => {
      const settings = (await window.electron?.invoke('settings:getAll')) as AppSettings | undefined
      if (settings) {
        setVisionApiKey(settings.vision?.apiKey || '')
        setVisionModel(settings.vision?.model || '')
        setVisionBaseUrl(settings.vision?.baseURL || '')
        setModels(settings.models || [])
        setGlobalVisionModelId(settings.globalVisionModelId || '')
        setGlobalReplyModelId(settings.globalReplyModelId || '')
      }
      const status = await window.electron?.invoke('train:status')
      if (status?.running) setTraining(true)
    }

    void load()
  }, [])

  useEffect(() => {
    const handler = (data: any) => {
      console.log('[SettingsPanel] train:event received:', data)
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

  const handleSaveVision = useCallback(async () => {
    const payload: Partial<AppSettings> = {
      vision: { apiKey: visionApiKey, model: visionModel, baseURL: visionBaseUrl }
    }
    await window.electron?.invoke('settings:set', payload)
    await window.electron?.invoke('engine:updateConfig', {
      ...((await window.electron?.invoke('settings:getAll')) as AppSettings),
      ...payload,
      vision: { apiKey: visionApiKey, model: visionModel, baseURL: visionBaseUrl }
    })
    showToast(t('settings.saved'), 'success')
  }, [visionApiKey, visionModel, visionBaseUrl])

  const handleTestConnection = useCallback(async () => {
    if (!visionApiKey) return
    setTesting(true)
    try {
      const result = await window.electron?.invoke('engine:testConnection', {
        apiKey: visionApiKey,
        model: visionModel,
        baseURL: visionBaseUrl
      })
      if (result?.success) {
        showToast(t('settings.testConnection.success'), 'success')
      } else {
        showToast(`${t('settings.testConnection.fail')}: ${result?.error || ''}`, 'error')
      }
    } catch (e: any) {
      showToast(`${t('settings.testConnection.fail')}: ${e.message}`, 'error')
    } finally {
      setTesting(false)
    }
  }, [visionApiKey, visionModel, visionBaseUrl])

  return (
    <div className="settings-page slide-up">
      <div className="settings-page-header">
        <div>
          <h1>基础配置</h1>
          <p>维护桌面端运行所需的基础参数。</p>
        </div>
      </div>

      <div className="card base-settings-card">
        <div className="card-title">{t('settings.vision')}</div>

        <div className="form-group">
          <label className="form-label">{t('settings.visionApiKey')}</label>
          <input
            className="form-input"
            type="password"
            value={visionApiKey}
            onChange={(e) => setVisionApiKey(e.target.value)}
            placeholder={t('settings.visionApiKey.placeholder')}
            autoComplete="off"
          />
          <div className="form-hint">{t('settings.visionApiKey.hint')}</div>
        </div>

        <div className="form-group">
          <label className="form-label">{t('settings.visionModel')}</label>
          <input
            className="form-input"
            value={visionModel}
            onChange={(e) => setVisionModel(e.target.value)}
            placeholder="doubao-seed-2-0-lite-260215"
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t('settings.visionBaseUrl')}</label>
          <input
            className="form-input"
            value={visionBaseUrl}
            onChange={(e) => setVisionBaseUrl(e.target.value)}
            placeholder="https://ark.cn-beijing.volces.com/api/v3"
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={handleTestConnection}
            disabled={!visionApiKey || testing}
          >
            {testing ? t('settings.testConnection.testing') : t('settings.testConnection')}
          </button>
          <button className="btn btn-primary" onClick={handleSaveVision} style={{ flex: 1 }}>
            {t('settings.saveVision')}
          </button>
        </div>
      </div>

      <div className="card base-settings-card">
        <div className="card-title">全局模型选择</div>
        <div className="form-hint" style={{ marginBottom: 12 }}>
          选择用于视觉检测和回复生成的模型。如需添加新模型，请前往"模型配置"页面。
        </div>

        <div className="form-group">
          <label className="form-label">全局视觉模型</label>
          <select
            className="form-input"
            value={globalVisionModelId}
            onChange={async (e) => {
              const id = e.target.value
              setGlobalVisionModelId(id)
              await window.electron?.invoke('settings:set', { globalVisionModelId: id })
              if (id) {
                const selected = models.find((m) => m.id === id)
                if (selected) {
                  setVisionApiKey(selected.apiKey)
                  setVisionModel(selected.modelName)
                  setVisionBaseUrl(selected.baseURL)
                }
              }
            }}
          >
            <option value="">使用下方视觉配置</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.modelName})</option>
            ))}
          </select>
          <div className="form-hint">用于 VLM 布局检测、红点检测、对象识别</div>
        </div>

        <div className="form-group">
          <label className="form-label">全局回复模型</label>
          <select
            className="form-input"
            value={globalReplyModelId}
            onChange={async (e) => {
              const id = e.target.value
              setGlobalReplyModelId(id)
              await window.electron?.invoke('settings:set', { globalReplyModelId: id })
            }}
          >
            <option value="">使用视觉模型</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.modelName})</option>
            ))}
          </select>
          <div className="form-hint">用于 AI 回复生成，未选择时使用视觉模型</div>
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
    <div className="settings-page slide-up">
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
                    <span className="provider-name">{model.name}</span>
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

  useEffect(() => {
    if (!isEdit) {
      const preset = PROVIDER_PRESETS.find((p) => p.id === provider)
      if (preset) {
        setModelName(preset.defaultModel)
        setBaseURL(preset.defaultBaseURL)
      }
    }
  }, [provider, isEdit])

  const handleSave = useCallback(async () => {
    if (!name.trim()) { showToast('模型名称不能为空', 'error'); return }
    if (!modelName.trim()) { showToast('模型标识不能为空', 'error'); return }
    if (!apiKey.trim()) { showToast('API Key 不能为空', 'error'); return }

    const input = { name: name.trim(), provider, modelName: modelName.trim(), apiKey, baseURL }
    const result = isEdit
      ? await window.electron?.invoke('model:update', model!.id, input)
      : await window.electron?.invoke('model:create', input)

    if (result?.success) {
      showToast(isEdit ? '模型已更新' : '模型已添加', 'success')
      onSaved()
    } else {
      showToast(result?.error || '操作失败', 'error')
    }
  }, [name, provider, modelName, apiKey, baseURL, isEdit, model, onSaved])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>{isEdit ? '编辑模型' : '添加模型'}</h2>

        <div className="form-group">
          <label className="form-label">供应商 <span className="required-mark">*</span></label>
          <select className="form-input" value={provider} onChange={(e) => setProvider(e.target.value)} disabled={isEdit}>
            {PROVIDER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">模型名称 <span className="required-mark">*</span></label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：我的豆包模型" />
          <div className="form-hint">用于在界面中识别此模型配置</div>
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

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave}>{isEdit ? '保存' : '添加'}</button>
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
    <div className="settings-page slide-up">
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

let _showToast: ((msg: string, type: 'success' | 'error') => void) | null = null

export function showToast(msg: string, type: 'success' | 'error') {
  _showToast?.(msg, type)
}

function Toast() {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')
  const [type, setType] = useState<'success' | 'error'>('success')
  const timerRef = useRef<number | undefined>(undefined)

  _showToast = useCallback((msg: string, t: 'success' | 'error') => {
    setMessage(msg)
    setType(t)
    setVisible(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setVisible(false), 2500)
  }, [])

  return <div className={`toast ${type} ${visible ? 'show' : ''}`}>{message}</div>
}

export default App
