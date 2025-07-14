const express = require('express')
const cors = require('cors')
const fs = require('fs').promises
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
const PORT = process.env.PORT || 3000
const DATA_DIR = path.join(__dirname, 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const JWT_SECRET =
  process.env.JWT_SECRET || 'ebbinghaus-memory-system-secret-key-2025'

// 中间件
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.static('public'))

// 确保数据目录存在
async function ensureDataDirectory() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })

    // 初始化用户文件
    try {
      await fs.access(USERS_FILE)
    } catch {
      await fs.writeFile(USERS_FILE, '[]')
    }
  } catch (error) {
    console.error('初始化数据目录失败:', error)
  }
}

// 读取用户数据
async function readUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('读取用户数据错误:', error)
    return []
  }
}

// 写入用户数据
async function writeUsers(users) {
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2))
    return true
  } catch (error) {
    console.error('写入用户数据失败:', error)
    return false
  }
}

// 读取用户的复习数据
async function readUserReviews(userId) {
  try {
    const userFile = path.join(DATA_DIR, `reviews_${userId}.json`)
    const data = await fs.readFile(userFile, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

// 写入用户的复习数据
async function writeUserReviews(userId, reviews) {
  try {
    const userFile = path.join(DATA_DIR, `reviews_${userId}.json`)
    await fs.writeFile(userFile, JSON.stringify(reviews, null, 2))
    return true
  } catch (error) {
    console.error('写入用户复习数据失败:', error)
    return false
  }
}

// JWT 验证中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({
      success: false,
      error: '需要登录访问',
    })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: '令牌无效或已过期',
      })
    }
    req.user = user
    next()
  })
}

// 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body

    // 验证输入
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: '用户名、邮箱和密码都是必填项',
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: '密码长度至少6位',
      })
    }

    const users = await readUsers()

    // 检查用户是否已存在
    const existingUser = users.find(
      (u) => u.username === username || u.email === email
    )

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: '用户名或邮箱已存在',
      })
    }

    // 加密密码
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // 创建新用户
    const newUser = {
      id: Date.now().toString(),
      username,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    }

    users.push(newUser)
    await writeUsers(users)

    // 生成JWT令牌
    const token = jwt.sign(
      {
        userId: newUser.id,
        username: newUser.username,
        email: newUser.email,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    )

    res.json({
      success: true,
      message: '注册成功',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        createdAt: newUser.createdAt,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '注册失败',
      message: error.message,
    })
  }
})

// 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '用户名和密码都是必填项',
      })
    }

    const users = await readUsers()

    // 查找用户（支持用户名或邮箱登录）
    const user = users.find(
      (u) => u.username === username || u.email === username
    )

    if (!user) {
      return res.status(400).json({
        success: false,
        error: '用户名或密码错误',
      })
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        error: '用户名或密码错误',
      })
    }

    // 更新最后登录时间
    user.lastLoginAt = new Date().toISOString()
    await writeUsers(users)

    // 生成JWT令牌
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    )

    res.json({
      success: true,
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '登录失败',
      message: error.message,
    })
  }
})

// 验证令牌
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.userId,
      username: req.user.username,
      email: req.user.email,
    },
  })
})

// 用户登出（客户端删除token即可，这里主要用于日志记录）
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: '登出成功',
  })
})

// 获取用户的复习数据
app.get('/api/reviews', authenticateToken, async (req, res) => {
  try {
    const data = await readUserReviews(req.user.userId)
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

// 保存用户的复习数据
app.post('/api/reviews', authenticateToken, async (req, res) => {
  try {
    const { reviews } = req.body

    if (!Array.isArray(reviews)) {
      return res.status(400).json({
        success: false,
        error: '数据格式错误',
      })
    }

    const success = await writeUserReviews(req.user.userId, reviews)

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

// 获取用户统计信息
app.get('/api/user/stats', authenticateToken, async (req, res) => {
  try {
    const reviews = await readUserReviews(req.user.userId)

    let totalReviews = 0
    let completedReviews = 0
    let overdueReviews = 0
    const now = new Date()

    reviews.forEach((item) => {
      item.reviewDates.forEach((dateStr, index) => {
        totalReviews++
        const reviewDate = new Date(dateStr)

        if (item.status[index] === 2) {
          completedReviews++
        } else if (now > reviewDate && item.status[index] === 0) {
          overdueReviews++
        }
      })
    })

    res.json({
      success: true,
      stats: {
        totalItems: reviews.length,
        totalReviews,
        completedReviews,
        overdueReviews,
        completionRate:
          totalReviews > 0
            ? ((completedReviews / totalReviews) * 100).toFixed(1)
            : 0,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取统计信息失败',
      message: error.message,
    })
  }
})

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: '艾宾浩斯复习系统',
    version: '2.0.0',
    features: ['用户系统', '数据隔离', 'JWT认证'],
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// 获取服务器信息
app.get('/api/info', (req, res) => {
  res.json({
    name: '艾宾浩斯记忆曲线复习系统',
    version: '2.0.0',
    description: '基于科学记忆曲线的复习时间管理系统，支持多用户',
    features: [
      '用户注册登录',
      '数据安全隔离',
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
║     艾宾浩斯记忆曲线复习系统 v2.0           ║
╠══════════════════════════════════════════════╣
║  🚀 服务启动成功                            ║
║  🔐 用户系统: 已启用                        ║
║  🌐 访问地址: http://localhost:${PORT}        ║
║  📊 API接口: http://localhost:${PORT}/api     ║
║  💾 数据存储: ${DATA_DIR}                    ║
║  🔑 JWT密钥: ${JWT_SECRET.substring(0, 20)}... ║
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
