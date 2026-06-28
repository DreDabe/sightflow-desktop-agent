import { spawn, ChildProcess } from 'child_process'
import { SentimentResult } from './types'

const CLASS_NAMES = ['无抑郁', '轻度抑郁', '中度抑郁', '重度抑郁', '极重度抑郁']

export class SentimentClassifier {
  private process: ChildProcess | null = null
  private ready = false
  private buffer = ''
  private pending: {
    resolve: (result: SentimentResult) => void
    reject: (error: Error) => void
  } | null = null

  async start(scriptDir: string): Promise<void> {
    if (this.process) return

    return new Promise((resolve, reject) => {
      console.log('[SentimentClassifier] 正在启动 Python 子进程...')
      this.process = spawn('python', ['classify_server.py'], {
        cwd: scriptDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          HF_ENDPOINT: 'https://hf-mirror.com',
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1'
        }
      })

      const pid = this.process.pid
      console.log(`[SentimentClassifier] Python 子进程已创建 (PID: ${pid})，等待模型加载...`)

      let readyResolved = false

      this.process.stdout?.on('data', (data: Buffer) => {
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
              this.process?.kill()
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

      this.process.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim()
        if (msg) console.error('[SentimentClassifier] Python stderr:', msg)
      })

      this.process.on('error', (err) => {
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

      this.process.on('exit', (code) => {
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
