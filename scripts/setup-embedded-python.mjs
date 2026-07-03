import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import https from 'https'
import { execSync } from 'child_process'
import { createUnzip } from 'zlib'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PYTHON_DIR = join(ROOT, 'resources', 'python')

const PYTHON_VERSION = '3.10.11'
const PYTHON_EMBED_URL = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`
const GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py'

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`  下载: ${url}`)
    const file = createWriteStream(dest)
    https.get(url, { timeout: 120000 }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, dest).then(resolve).catch(reject)
        return
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }
      const total = parseInt(response.headers['content-length'], 10)
      let downloaded = 0
      response.on('data', (chunk) => {
        downloaded += chunk.length
        if (total) {
          const pct = ((downloaded / total) * 100).toFixed(1)
          process.stdout.write(`\r  进度: ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB)`)
        }
      })
      response.pipe(file)
      file.on('finish', () => {
        process.stdout.write('\n')
        file.close(resolve)
      })
    }).on('error', (err) => {
      file.close()
      reject(err)
    })
  })
}

async function extractZip(zipPath, destDir) {
  console.log(`  解压: ${zipPath} -> ${destDir}`)
  const { default: AdmZip } = await import('adm-zip')
  const zip = new AdmZip(zipPath)
  zip.extractAllTo(destDir, true)
}

function modifyPthFile(pythonDir) {
  const pthFiles = ['python310._pth', 'python311._pth', 'python312._pth', 'python313._pth']
  for (const pthFile of pthFiles) {
    const pthPath = join(pythonDir, pthFile)
    if (existsSync(pthPath)) {
      let content = readFileSync(pthPath, 'utf-8')
      content = content.replace(/^#?\s*import site$/m, 'import site')
      content = content.replace(/^#?\s*Lib\s*$/m, 'Lib')
      content = content.replace(/^#?\s*DLLs\s*$/m, 'DLLs')
      writeFileSync(pthPath, content, 'utf-8')
      console.log(`  已修改: ${pthFile}`)
      return
    }
  }
  console.warn('  警告: 未找到 ._pth 文件')
}

async function main() {
  console.log('=== AutoReply 嵌入式 Python 环境设置 ===\n')

  if (existsSync(join(PYTHON_DIR, 'python.exe'))) {
    console.log('嵌入式 Python 已存在，跳过下载。')
    console.log(`  路径: ${PYTHON_DIR}`)
    return
  }

  mkdirSync(PYTHON_DIR, { recursive: true })

  const zipPath = join(PYTHON_DIR, 'python-embed.zip')

  if (!existsSync(zipPath)) {
    console.log(`[1/4] 下载 Python ${PYTHON_VERSION} Embedded...`)
    await downloadFile(PYTHON_EMBED_URL, zipPath)
  } else {
    console.log('[1/4] Python Embedded 压缩包已存在，跳过下载。')
  }

  console.log('\n[2/4] 解压 Python Embedded...')
  await extractZip(zipPath, PYTHON_DIR)

  console.log('\n[3/4] 配置 _pth 文件（启用 site-packages）...')
  modifyPthFile(PYTHON_DIR)

  console.log('\n[4/4] 下载 get-pip.py...')
  await downloadFile(GET_PIP_URL, join(PYTHON_DIR, 'get-pip.py'))

  console.log('\n安装 pip...')
  try {
    execSync(`"${join(PYTHON_DIR, 'python.exe')}" "${join(PYTHON_DIR, 'get-pip.py')}" --no-warn-script-location`, {
      stdio: 'inherit',
      cwd: PYTHON_DIR,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
    })
    console.log('pip 安装完成 ✓')
  } catch (err) {
    console.warn('pip 安装失败，将在应用首次运行时自动安装。')
  }

  console.log('\n=== 设置完成 ===')
  console.log(`嵌入式 Python 路径: ${PYTHON_DIR}`)
  console.log('注意: Python 依赖（torch, transformers 等）将在应用首次使用情感分析功能时自动安装。')
}

main().catch((err) => {
  console.error('设置失败:', err)
  process.exit(1)
})
