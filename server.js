const express = require('express')
const cors = require('cors')
const fs = require('fs').promises
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3000
const DATA_FILE = path.join(__dirname, 'data', 'reviews.json')

// 中间件
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.static('public'))

// 确保数据目录存在
async function ensureDataDirectory() {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
    // 初始化空数据文件
    try {
      await fs.access(DATA_FILE)
    } catch {
      await fs.writeFile(DATA_FILE, '[]')
    }
  } catch (error) {
    console.error('初始化数据目录失败:', error)
  }
}

// 读取数据
async function readData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('读取数据错误:', error)
    return []
  }
}

// 写入数据
async function writeData(data) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2))
    return true
  } catch (error) {
    console.error('写入数据失败:', error)
    return false
  }
}

// API 路由
app.get('/api/reviews', async (req, res) => {
  try {
    const data = await readData()
    res.json({
      success: true,
      data: data,
      count: data.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '读取数据失败',
      message: error.message,
    })
  }
})

app.post('/api/reviews', async (req, res) => {
  try {
    const { reviews } = req.body

    if (!Array.isArray(reviews)) {
      return res.status(400).json({
        success: false,
        error: '数据格式错误',
      })
    }

    const success = await writeData(reviews)

    if (success) {
      res.json({
        success: true,
        message: '数据保存成功',
        count: reviews.length,
        timestamp: new Date().toISOString(),
      })
    } else {
      res.status(500).json({
        success: false,
        error: '数据保存失败',
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '保存数据失败',
      message: error.message,
    })
  }
})

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: '艾宾浩斯复习系统',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// 获取服务器信息
app.get('/api/info', (req, res) => {
  res.json({
    name: '艾宾浩斯记忆曲线复习系统',
    version: '1.0.0',
    description: '基于科学记忆曲线的复习时间管理系统',
    features: [
      '艾宾浩斯记忆曲线算法',
      '云端数据同步',
      '多设备支持',
      '进度统计',
    ],
    intervals: [
      { name: '20分钟后', minutes: 20 },
      { name: '1小时后', minutes: 60 },
      { name: '1天后', minutes: 1440 },
      { name: '2天后', minutes: 2880 },
      { name: '4天后', minutes: 5760 },
      { name: '7天后', minutes: 10080 },
      { name: '15天后', minutes: 21600 },
      { name: '30天后', minutes: 43200 },
    ],
  })
})

// 启动服务器
async function startServer() {
  await ensureDataDirectory()

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════╗
║        艾宾浩斯记忆曲线复习系统              ║
╠══════════════════════════════════════════════╣
║  🚀 服务启动成功                            ║
║  🌐 访问地址: http://localhost:${PORT}        ║
║  📊 API接口: http://localhost:${PORT}/api     ║
║  💾 数据存储: ${DATA_FILE}      ║
║  ⏰ 启动时间: ${new Date().toLocaleString('zh-CN')} ║
╚══════════════════════════════════════════════╝
        `)
  })
}

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason)
})

startServer()
