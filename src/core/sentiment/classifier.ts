import { spawn, execSync, ChildProcess } from 'child_process'
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { SentimentResult } from './types'

const CLASS_NAMES = ['无抑郁', '轻度抑郁', '中度抑郁', '重度抑郁', '极重度抑郁']

const DEPS_MARKER_FILE = '.deps-installed'
const SCRIPTS_MARKER_FILE = '.scripts-copied'
const REQUIRED_PACKAGES = ['torch', 'torchvision', 'transformers', 'pandas', 'sklearn', 'kagglehub', 'tqdm', 'numpy']

export interface PythonCheckResult {
  installed: boolean
  version?: string
  path?: string
  error?: string
}

function getEmbeddedPythonDir(): string {
  const resDir = (process as any).resourcesPath || ''
  if (resDir) {
    return join(resDir, 'python')
  }
  const appPath = (globalThis as any).__electron_app_path || ''
  if (appPath) {
    return join(dirname(appPath), 'resources', 'python')
  }
  return ''
}

function getEmbeddedPythonPath(): string {
  const dir = getEmbeddedPythonDir()
  return dir ? join(dir, 'python.exe') : ''
}

function buildSpawnEnv(extra?: Record<string, string>): Record<string, string> {
  const systemRoot = process.env.SystemRoot || process.env.SYSTEMROOT || 'C:\\WINDOWS'
  const existingPath = process.env.PATH || ''
  const criticalPaths = [
    join(systemRoot, 'system32'),
    join(systemRoot, 'System32', 'Wbem'),
    systemRoot
  ]
  const pathParts = [...criticalPaths]
  if (existingPath) {
    pathParts.push(existingPath)
  }
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    SystemRoot: systemRoot,
    SYSTEMROOT: systemRoot,
    PATH: pathParts.join(';'),
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1',
    ...extra
  }
  return env
}

function findPythonPath(): string | null {
  const embeddedPath = getEmbeddedPythonPath()
  if (embeddedPath && existsSync(embeddedPath)) {
    return embeddedPath
  }

  try {
    if (process.platform === 'win32') {
      const result = execSync('where python', {
        stdio: 'pipe',
        timeout: 5000,
        env: buildSpawnEnv()
      })
      const paths = result.toString().trim().split('\n')
      for (const p of paths) {
        const trimmed = p.trim()
        if (trimmed && !trimmed.includes('WindowsApps')) {
          return trimmed
        }
      }
    } else {
      const result = execSync('which python3', {
        stdio: 'pipe',
        timeout: 5000,
        env: buildSpawnEnv()
      })
      return result.toString().trim()
    }
  } catch {}

  const COMMON_PYTHON_PATHS = [
    'D:\\Program\\Add\\Python\\anaconda3\\python.exe',
    'D:\\Program\\Add\\Python\\3.10.6\\python.exe',
    'C:\\Python313\\python.exe',
    'C:\\Python312\\python.exe',
    'C:\\Python311\\python.exe',
    'C:\\Python310\\python.exe',
    'C:\\Python39\\python.exe',
    'C:\\Python38\\python.exe'
  ]
  for (const p of COMMON_PYTHON_PATHS) {
    if (existsSync(p)) {
      return p
    }
  }

  return null
}

export function checkPythonInstalled(): PythonCheckResult {
  const pythonPath = findPythonPath()
  if (!pythonPath) {
    return {
      installed: false,
      error: '未检测到 Python 环境。请先安装 Python 3.8+ 并确保已添加到系统 PATH。\n下载地址: https://www.python.org/downloads/'
    }
  }

  try {
    const result = execSync(`"${pythonPath}" --version`, {
      stdio: 'pipe',
      timeout: 5000,
      env: buildSpawnEnv()
    })
    const version = result.toString().trim()
    console.log(`[PythonCheck] 找到 Python: ${pythonPath}, 版本: ${version}`)
    return { installed: true, version, path: pythonPath }
  } catch {
    return {
      installed: false,
      error: 'Python 检测失败。请确保 Python 已正确安装。\n下载地址: https://www.python.org/downloads/'
    }
  }
}

function getLibsDir(userDataPath: string): string {
  return join(userDataPath, 'sentpredict-libs')
}

function getScriptsDir(userDataPath: string): string {
  return join(userDataPath, 'sentpredict-scripts')
}

function isDepsInstalled(libsDir: string): boolean {
  if (!existsSync(join(libsDir, DEPS_MARKER_FILE))) return false
  for (const pkg of REQUIRED_PACKAGES) {
    if (!existsSync(join(libsDir, pkg))) return false
  }
  return true
}

function markDepsInstalled(libsDir: string): void {
  writeFileSync(join(libsDir, DEPS_MARKER_FILE), new Date().toISOString(), 'utf-8')
}

export function ensureScriptsCopied(appPath: string, userDataPath: string): string {
  const scriptsDir = getScriptsDir(userDataPath)
  const markerPath = join(scriptsDir, SCRIPTS_MARKER_FILE)

  if (existsSync(markerPath) && existsSync(join(scriptsDir, 'classify_server.py'))) {
    return scriptsDir
  }

  mkdirSync(scriptsDir, { recursive: true })

  const sourceDir = join(appPath, 'sentpredict')
  const filesToCopy = [
    'classify_server.py',
    'train_server.py',
    'BertModel.py',
    'predict.py',
    'requirements.txt'
  ]

  for (const file of filesToCopy) {
    const src = join(sourceDir, file)
    const dest = join(scriptsDir, file)
    try {
      if (existsSync(src)) {
        copyFileSync(src, dest)
        console.log(`[Scripts] 已复制: ${file}`)
      }
    } catch (err: any) {
      console.warn(`[Scripts] 复制失败 ${file}: ${err.message}`)
    }
  }

  const modelsDir = join(scriptsDir, 'models')
  if (!existsSync(modelsDir)) {
    mkdirSync(modelsDir, { recursive: true })
  }

  writeFileSync(markerPath, new Date().toISOString(), 'utf-8')
  console.log(`[Scripts] Python 脚本已复制到: ${scriptsDir}`)

  return scriptsDir
}

export async function ensurePythonDeps(_scriptDir: string, userDataPath?: string): Promise<void> {
  const pythonCheck = checkPythonInstalled()
  if (!pythonCheck.installed) {
    throw new Error(pythonCheck.error!)
  }

  const pythonPath = pythonCheck.path!
  const libsDir = userDataPath ? getLibsDir(userDataPath) : null

  if (libsDir && isDepsInstalled(libsDir)) {
    console.log('[PythonDeps] 依赖已安装，跳过检查')
    return
  }

  const env = buildSpawnEnv(libsDir ? { PYTHONPATH: libsDir } : {})

  try {
    execSync(`"${pythonPath}" -c "import torch; import torchvision; import transformers; import pandas; import sklearn; import kagglehub; import tqdm; import numpy"`, {
      stdio: 'pipe',
      timeout: 10000,
      env
    })
    if (libsDir) {
      mkdirSync(libsDir, { recursive: true })
      markDepsInstalled(libsDir)
    }
  } catch {
    console.log('[PythonDeps] 检测到缺少 Python 依赖，正在安装...')
    try {
      const installTarget = libsDir ? `--target="${libsDir}"` : ''
      const pipPath = pythonPath.replace(/python\.exe$/i, 'Scripts\\pip.exe')
      const hasPip = existsSync(pipPath)
      const installCmd = hasPip
        ? `"${pipPath}" install ${installTarget} torch torchvision transformers pandas scikit-learn kagglehub tqdm numpy`
        : `"${pythonPath}" -m pip install ${installTarget} torch torchvision transformers pandas scikit-learn kagglehub tqdm numpy`

      execSync(installCmd, {
        stdio: 'pipe',
        timeout: 600000,
        env
      })
      console.log('[PythonDeps] Python 依赖安装完成 ✓')
      if (libsDir) {
        mkdirSync(libsDir, { recursive: true })
        markDepsInstalled(libsDir)
      }
    } catch (installErr: any) {
      console.error('[PythonDeps] 依赖安装失败:', installErr?.message || installErr)
      throw new Error(
        `Python 依赖安装失败。\n` +
        `请手动执行以下命令:\n` +
        `"${pythonPath}" -m pip install torch transformers pandas scikit-learn kagglehub tqdm numpy`
      )
    }
  }
}

export class SentimentClassifier {
  private process: ChildProcess | null = null
  private ready = false
  private buffer = ''
  private pending: {
    resolve: (result: SentimentResult) => void
    reject: (error: Error) => void
  } | null = null

  async start(scriptDir: string, modelDir?: string, userDataPath?: string): Promise<void> {
    if (this.process) return

    await ensurePythonDeps(scriptDir, userDataPath)

    const pythonCheck = checkPythonInstalled()
    if (!pythonCheck.installed || !pythonCheck.path) {
      throw new Error(pythonCheck.error!)
    }

    const pythonPath = pythonCheck.path
    const effectiveModelDir = modelDir || join(scriptDir, 'models')
    if (!existsSync(effectiveModelDir)) {
      mkdirSync(effectiveModelDir, { recursive: true })
    }

    const libsDir = userDataPath ? getLibsDir(userDataPath) : null
    const env = buildSpawnEnv({
      HF_ENDPOINT: 'https://hf-mirror.com',
      SENTIMENT_MODEL_DIR: effectiveModelDir,
      ...(libsDir ? { PYTHONPATH: libsDir } : {})
    })

    return new Promise((resolve, reject) => {
      console.log('[SentimentClassifier] 正在启动 Python 子进程...')
      console.log(`[SentimentClassifier] Python 路径: ${pythonPath}`)
      console.log(`[SentimentClassifier] 脚本目录: ${scriptDir}`)
      console.log(`[SentimentClassifier] 模型目录: ${effectiveModelDir}`)
      if (libsDir) {
        console.log(`[SentimentClassifier] 依赖目录: ${libsDir}`)
      }
      const proc = spawn(pythonPath, ['classify_server.py'], {
        cwd: scriptDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env
      })
      this.process = proc

      const pid = proc.pid
      console.log(`[SentimentClassifier] Python 子进程已创建 (PID: ${pid})，等待模型加载...`)

      let readyResolved = false

      proc.stdout?.on('data', (data: Buffer) => {
        this.buffer += data.toString()
        const lines = this.buffer.split('\n')
        this.buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const parsed = JSON.parse(trimmed)
            if (!readyResolved && parsed.status === 'ready') {
              readyResolved = true
              this.ready = true
              console.log('[SentimentClassifier] Python 子进程就绪 ✓ — BERT 模型加载完成')
              resolve()
              continue
            }
            if (!readyResolved && parsed.status === 'error') {
              readyResolved = true
              console.error('[SentimentClassifier] Python 子进程启动失败:', parsed.error)
              proc.kill()
              this.process = null
              reject(new Error(parsed.error || '模型加载失败'))
              continue
            }
            if (this.pending) {
              if (parsed.error) {
                console.error('[SentimentClassifier] 分类推理失败:', parsed.error)
                this.pending.reject(new Error(parsed.error))
              } else {
                const result = parsed as SentimentResult
                const name = CLASS_NAMES[result.classIndex] || result.className
                const maxProb = Math.max(...(result.probabilities || []))
                console.log(`[SentimentClassifier] 分类结果：${name}（置信度 ${(maxProb * 100).toFixed(1)}%）`)
                this.pending.resolve(result)
              }
              this.pending = null
            }
          } catch {}
        }
      })

      proc.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim()
        if (msg) console.error('[SentimentClassifier] Python stderr:', msg)
      })

      proc.on('error', (err) => {
        console.error('[SentimentClassifier] 子进程异常:', err.message)
        this.process = null
        this.ready = false
        if (!readyResolved) {
          readyResolved = true
          reject(err)
        }
        if (this.pending) {
          this.pending.reject(new Error('子进程异常'))
          this.pending = null
        }
      })

      proc.on('exit', (code) => {
        console.log(`[SentimentClassifier] 子进程已退出 (code: ${code})`)
        this.process = null
        this.ready = false
        if (!readyResolved) {
          readyResolved = true
          reject(new Error(`子进程意外退出 (code: ${code})`))
        }
        if (this.pending) {
          this.pending.reject(new Error('子进程意外退出'))
          this.pending = null
        }
      })
    })
  }

  async classify(text: string): Promise<SentimentResult> {
    if (!this.process || !this.ready) {
      throw new Error('SentimentClassifier 未就绪')
    }
    if (this.pending) {
      throw new Error('分类推理正在进行中')
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending = null
        reject(new Error('情感分类超时 (10s)'))
      }, 10000)

      this.pending = {
        resolve: (result) => {
          clearTimeout(timeout)
          resolve(result)
        },
        reject: (error) => {
          clearTimeout(timeout)
          reject(error)
        }
      }

      const request = JSON.stringify({ text }) + '\n'
      this.process?.stdin?.write(request)
    })
  }

  stop(): void {
    if (this.process) {
      console.log('[SentimentClassifier] 正在关闭 Python 子进程...')
      try {
        this.process.stdin?.write('exit\n')
      } catch {}
      setTimeout(() => {
        this.process?.kill()
        this.process = null
        this.ready = false
        console.log('[SentimentClassifier] Python 子进程已关闭')
      }, 1000)
    }
  }

  isReady(): boolean {
    return this.ready && this.process !== null
  }
}
