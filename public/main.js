// 全局状态
let currentUser = null
let reviewData = []
let isOnline = false
let isGuestMode = true // 默认游客模式

// 艾宾浩斯复习间隔（分钟）
const intervals = [20, 60, 1440, 2880, 5760, 10080, 21600, 43200]
const intervalNames = [
  '20分钟后',
  '1小时后',
  '1天后',
  '2天后',
  '4天后',
  '7天后',
  '15天后',
  '30天后',
]

// API 配置
const API_BASE = '/api'

// ==================== 认证相关函数 ====================

function showAuthModal() {
  const modal = document.getElementById('authModal')
  modal.classList.add('show')
  document.body.style.overflow = 'hidden'
}

function hideAuthModal() {
  const modal = document.getElementById('authModal')
  modal.classList.remove('show')
  document.body.style.overflow = ''
}

// 点击空白区域关闭弹窗
function handleModalBackdropClick(event) {
  const modal = document.getElementById('authModal')
  if (event.target === modal) {
    hideAuthModal()
  }
}

// ESC 键关闭弹窗
function handleEscapeKey(event) {
  if (event.key === 'Escape') {
    const modal = document.getElementById('authModal')
    if (modal.classList.contains('show')) {
      hideAuthModal()
    }
  }
}

function switchAuthTab(tab) {
  // 更新标签状态
  document
    .querySelectorAll('.auth-tab')
    .forEach((t) => t.classList.remove('active'))
  document
    .querySelector(`[onclick="switchAuthTab('${tab}')"]`)
    .classList.add('active')

  // 更新表单显示
  document
    .querySelectorAll('.auth-form-container')
    .forEach((f) => f.classList.remove('active'))
  document.getElementById(tab + 'FormModal').classList.add('active')

  // 清除消息
  hideAuthMessages()
}

function showAuthError(message) {
  const errorDiv = document.getElementById('authErrorMessage')
  errorDiv.textContent = message
  errorDiv.style.display = 'block'
  document.getElementById('authSuccessMessage').style.display = 'none'
}

function showAuthSuccess(message) {
  const successDiv = document.getElementById('authSuccessMessage')
  successDiv.textContent = message
  successDiv.style.display = 'block'
  document.getElementById('authErrorMessage').style.display = 'none'
}

function hideAuthMessages() {
  document.getElementById('authErrorMessage').style.display = 'none'
  document.getElementById('authSuccessMessage').style.display = 'none'
}

function showAuthLoading() {
  document.getElementById('authLoading').classList.add('show')
  document.querySelectorAll('.auth-btn').forEach((btn) => (btn.disabled = true))
}

function hideAuthLoading() {
  document.getElementById('authLoading').classList.remove('show')
  document
    .querySelectorAll('.auth-btn')
    .forEach((btn) => (btn.disabled = false))
}

async function handleModalLogin(event) {
  event.preventDefault()

  const username = document.getElementById('modalLoginUsername').value
  const password = document.getElementById('modalLoginPassword').value

  hideAuthMessages()
  showAuthLoading()

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    })

    const data = await response.json()

    if (data.success) {
      // 保存token和用户信息
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      currentUser = data.user
      isGuestMode = false

      showAuthSuccess('登录成功！')

      // 1.5秒后关闭弹窗并切换到用户模式
      setTimeout(() => {
        hideAuthModal()
        switchToUserMode()
        loadFromServer()
        clearAuthForms()
      }, 1500)
    } else {
      showAuthError(data.error || '登录失败')
    }
  } catch (error) {
    showAuthError('网络错误，请稍后重试')
    console.error('登录错误:', error)
  } finally {
    hideAuthLoading()
  }
}

async function handleModalRegister(event) {
  event.preventDefault()

  const username = document.getElementById('modalRegisterUsername').value
  const email = document.getElementById('modalRegisterEmail').value
  const password = document.getElementById('modalRegisterPassword').value

  hideAuthMessages()
  showAuthLoading()

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, email, password }),
    })

    const data = await response.json()

    if (data.success) {
      // 保存token和用户信息
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      currentUser = data.user
      isGuestMode = false

      showAuthSuccess('注册成功！')

      // 1.5秒后关闭弹窗并切换到用户模式
      setTimeout(() => {
        hideAuthModal()
        switchToUserMode()

        // 如果有本地数据，询问是否同步到云端
        const localData = JSON.parse(localStorage.getItem('reviewData') || '[]')
        if (localData.length > 0) {
          if (
            confirm(
              `检测到您有 ${localData.length} 个本地学习项目，是否同步到云端？`
            )
          ) {
            syncLocalDataToServer(localData)
          }
        }

        clearAuthForms()
      }, 1500)
    } else {
      showAuthError(data.error || '注册失败')
    }
  } catch (error) {
    showAuthError('网络错误，请稍后重试')
    console.error('注册错误:', error)
  } finally {
    hideAuthLoading()
  }
}

function clearAuthForms() {
  // 清空表单
  document.getElementById('modalLoginUsername').value = ''
  document.getElementById('modalLoginPassword').value = ''
  document.getElementById('modalRegisterUsername').value = ''
  document.getElementById('modalRegisterEmail').value = ''
  document.getElementById('modalRegisterPassword').value = ''

  // 重置到登录标签
  switchAuthTab('login')
  hideAuthMessages()
}

function logout() {
  if (confirm('确定要退出登录吗？您的数据将保存在云端。')) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    currentUser = null
    isGuestMode = true

    // 切换到游客模式
    switchToGuestMode()

    // 清空当前数据，加载本地数据
    reviewData = JSON.parse(localStorage.getItem('reviewData') || '[]')
    renderTable()
    updateSyncStatus('🏠 游客模式 - 数据仅保存在本地', false)
  }
}

function switchToUserMode() {
  // 显示用户栏，隐藏游客栏
  document.getElementById('userBar').style.display = 'flex'
  document.getElementById('guestBar').style.display = 'none'

  // 更新用户信息
  if (currentUser) {
    document.getElementById(
      'userWelcome'
    ).textContent = `👋 ${currentUser.username}`
    loadUserStats()
  }

  updateSyncStatus('☁️ 已连接云端存储', true)
}

function switchToGuestMode() {
  // 显示游客栏，隐藏用户栏
  document.getElementById('userBar').style.display = 'none'
  document.getElementById('guestBar').style.display = 'flex'

  updateSyncStatus('🏠 游客模式 - 数据仅保存在本地', false)
}

function checkAuth() {
  const token = localStorage.getItem('token')
  const user = localStorage.getItem('user')

  if (token && user) {
    try {
      currentUser = JSON.parse(user)
      isGuestMode = false
      return true
    } catch (error) {
      console.error('用户信息解析失败:', error)
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }
  return false
}

function getAuthHeaders() {
  const token = localStorage.getItem('token')
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function loadUserStats() {
  try {
    const response = await apiRequest('/user/stats')
    if (response.success) {
      const stats = response.stats
      document.getElementById(
        'userStats'
      ).textContent = `📚 ${stats.totalItems}个学习项目 | ✅ 完成率 ${stats.completionRate}%`
    }
  } catch (error) {
    console.error('加载统计信息失败:', error)
  }
}

// 同步本地数据到服务器
async function syncLocalDataToServer(localData) {
  try {
    const response = await apiRequest('/reviews', {
      method: 'POST',
      body: JSON.stringify({ reviews: localData }),
    })

    if (response.success) {
      // 清除本地数据
      localStorage.removeItem('reviewData')
      reviewData = localData
      renderTable()
      updateSyncStatus('✅ 本地数据已同步到云端', true)
    }
  } catch (error) {
    console.error('同步本地数据失败:', error)
    updateSyncStatus('❌ 同步失败，请稍后重试', false)
  }
}

// ==================== 核心功能函数 ====================

// 显示同步状态
function updateSyncStatus(message, isSuccess = true) {
  const statusElement = document.getElementById('syncStatus')
  if (statusElement) {
    statusElement.textContent = message
    statusElement.className = `sync-status ${isSuccess ? 'success' : 'error'}`
  }
  console.log(`[同步状态] ${message}`)
}

// API 请求封装
async function apiRequest(endpoint, options = {}) {
  if (isGuestMode) {
    throw new Error('游客模式下无法访问API')
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        ...getAuthHeaders(),
        ...options.headers,
      },
      ...options,
    })

    if (response.status === 401 || response.status === 403) {
      // token失效，切换到游客模式
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      currentUser = null
      isGuestMode = true
      switchToGuestMode()
      loadLocalData()
      return
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('API请求失败:', error)
    throw error
  }
}

// 切换使用说明
function toggleInstructions() {
  const panel = document.getElementById('instructionsPanel')
  panel.classList.toggle('show')
}

// 格式化日期显示
function formatDate(date) {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 格式化相对时间
function formatRelativeTime(date) {
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffMins = Math.round(diffMs / (1000 * 60))
  const diffHours = Math.round(diffMs / (1000 * 60 * 60))
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (Math.abs(diffMins) < 60) {
    return diffMins > 0 ? `${diffMins}分钟后` : `${Math.abs(diffMins)}分钟前`
  } else if (Math.abs(diffHours) < 24) {
    return diffHours > 0 ? `${diffHours}小时后` : `${Math.abs(diffHours)}小时前`
  } else {
    return diffDays > 0 ? `${diffDays}天后` : `${Math.abs(diffDays)}天前`
  }
}

// 添加学习内容
function addContent(event) {
  if (event) {
    event.preventDefault()
  }

  // 如果是游客模式，提示登录以获得更好体验
  if (isGuestMode) {
    if (
      confirm(
        '您当前是游客模式，数据仅保存在本地，刷新页面会丢失。\n\n注册登录后可以云端同步，多设备访问。\n\n是否现在登录注册？'
      )
    ) {
      showAuthModal()
      return
    }
  }

  const contentInput = document.getElementById('content')
  const content = contentInput.value.trim()

  if (!content) {
    alert('请输入学习内容')
    return
  }

  const now = new Date()
  const reviewTimes = intervals.map((interval) => {
    const reviewTime = new Date(now.getTime() + interval * 60 * 1000)
    return reviewTime.toISOString()
  })

  const newItem = {
    id: Date.now(),
    content: content,
    addTime: now.toISOString(),
    reviewDates: reviewTimes,
    status: new Array(8).fill(0), // 0: 待复习, 1: 跳过, 2: 已完成
  }

  reviewData.unshift(newItem)
  contentInput.value = ''

  // 保存数据
  if (isGuestMode) {
    saveToLocal()
    updateSyncStatus('📝 已保存到本地', true)
  } else {
    saveToServer()
  }

  renderTable()
  console.log('添加学习内容:', content)
}

// 标记复习状态
function markReview(id, reviewIndex, status) {
  const item = reviewData.find((item) => item.id === id)
  if (item) {
    item.status[reviewIndex] = status

    // 保存数据
    if (isGuestMode) {
      saveToLocal()
    } else {
      saveToServer()
    }

    renderTable()

    const statusText = status === 2 ? '已完成' : '已跳过'
    console.log(
      `标记复习状态: ${item.content} - 第${
        reviewIndex + 1
      }次复习 - ${statusText}`
    )
  }
}

// 删除学习项目
function deleteItem(id) {
  if (confirm('确定要删除这个学习项目吗？')) {
    reviewData = reviewData.filter((item) => item.id !== id)

    // 保存数据
    if (isGuestMode) {
      saveToLocal()
    } else {
      saveToServer()
    }

    renderTable()
    console.log('删除学习项目:', id)
  }
}

// 清理已完成的项目
function clearCompleted() {
  const completedItems = reviewData.filter((item) =>
    item.status.every((status) => status === 2)
  )

  if (completedItems.length === 0) {
    alert('没有已完成的项目需要清理')
    return
  }

  if (confirm(`确定要清理 ${completedItems.length} 个已完成的项目吗？`)) {
    reviewData = reviewData.filter(
      (item) => !item.status.every((status) => status === 2)
    )

    // 保存数据
    if (isGuestMode) {
      saveToLocal()
    } else {
      saveToServer()
    }

    renderTable()
    console.log(`清理了 ${completedItems.length} 个已完成项目`)
  }
}

// 渲染表格（使用原有的详细样式）
function renderTable() {
  const tbody = document.getElementById('reviewTableBody')
  const emptyState = document.getElementById('emptyState')
  const filter = document.getElementById('statusFilter').value

  // 筛选数据
  let filteredData = reviewData
  const now = new Date()

  switch (filter) {
    case 'pending':
      filteredData = reviewData.filter((item) =>
        item.status.some((status, index) => {
          const reviewDate = new Date(item.reviewDates[index])
          return status === 0 && reviewDate <= now
        })
      )
      break
    case 'overdue':
      filteredData = reviewData.filter((item) =>
        item.status.some((status, index) => {
          const reviewDate = new Date(item.reviewDates[index])
          return status === 0 && reviewDate < now
        })
      )
      break
    case 'completed':
      filteredData = reviewData.filter((item) =>
        item.status.every((status) => status === 2)
      )
      break
    case 'today':
      filteredData = reviewData.filter((item) =>
        item.status.some((status, index) => {
          const reviewDate = new Date(item.reviewDates[index])
          const today = new Date()
          return (
            status === 0 && reviewDate.toDateString() === today.toDateString()
          )
        })
      )
      break
  }

  // 显示空状态或表格
  if (filteredData.length === 0) {
    tbody.innerHTML = ''
    emptyState.style.display = 'block'
  } else {
    emptyState.style.display = 'none'

    tbody.innerHTML = filteredData
      .map((item) => {
        // 创建复习时间点详细信息
        const reviewDetails = item.reviewDates
          .map((dateStr, index) => {
            const reviewDate = new Date(dateStr)
            const status = item.status[index]
            const isOverdue = status === 0 && reviewDate < now
            const isToday =
              status === 0 && reviewDate.toDateString() === now.toDateString()

            let statusClass = ''
            let statusIcon = ''
            let statusText = ''

            if (status === 2) {
              statusClass = 'completed'
              statusIcon = '✅'
              statusText = '已完成'
            } else if (status === 1) {
              statusClass = 'skipped'
              statusIcon = '⏭️'
              statusText = '已跳过'
            } else if (isOverdue) {
              statusClass = 'overdue'
              statusIcon = '🔴'
              statusText = '逾期'
            } else if (isToday) {
              statusClass = 'today'
              statusIcon = '🟡'
              statusText = '今日到期'
            } else {
              statusClass = 'pending'
              statusIcon = '⚪'
              statusText = '待复习'
            }

            return `
                    <div class="review-item ${statusClass}">
                        <div class="review-header">
                            <span class="review-number">第${index + 1}次</span>
                            <span class="review-interval">${
                              intervalNames[index]
                            }</span>
                            <span class="review-status">${statusIcon} ${statusText}</span>
                        </div>
                        <div class="review-time">
                            📅 ${formatDate(reviewDate)}
                            <span class="relative-time">(${formatRelativeTime(
                              reviewDate
                            )})</span>
                        </div>
                        ${
                          status === 0
                            ? `
                            <div class="review-actions">
                                <button class="action-btn btn-complete" 
                                        onclick="markReview(${item.id}, ${index}, 2)">
                                    ✅ 完成复习
                                </button>
                                <button class="action-btn btn-skip" 
                                        onclick="markReview(${item.id}, ${index}, 1)">
                                    ⏭️ 跳过
                                </button>
                            </div>
                        `
                            : ''
                        }
                    </div>
                `
          })
          .join('')

        // 计算总体状态
        const completedCount = item.status.filter((s) => s === 2).length
        const totalCount = item.status.length
        const progressPercent = ((completedCount / totalCount) * 100).toFixed(0)

        let overallStatus = ''
        if (completedCount === totalCount) {
          overallStatus =
            '<span class="overall-status completed">🎉 全部完成</span>'
        } else {
          const nextReviewIndex = item.status.findIndex((s) => s === 0)
          if (nextReviewIndex !== -1) {
            const nextDate = new Date(item.reviewDates[nextReviewIndex])
            if (nextDate < now) {
              overallStatus =
                '<span class="overall-status overdue">⚠️ 有逾期复习</span>'
            } else if (nextDate.toDateString() === now.toDateString()) {
              overallStatus =
                '<span class="overall-status today">📅 今日需复习</span>'
            } else {
              overallStatus =
                '<span class="overall-status pending">📚 进行中</span>'
            }
          }
        }

        return `
                <tr>
                    <td colspan="6" class="content-row">
                        <div class="content-card">
                            <div class="content-header">
                                <div class="content-info">
                                    <h3 class="content-title">${
                                      item.content
                                    }</h3>
                                    <div class="content-meta">
                                        <span class="add-time">📅 添加时间: ${formatDate(
                                          new Date(item.addTime)
                                        )}</span>
                                        <span class="progress">📊 进度: ${completedCount}/${totalCount} (${progressPercent}%)</span>
                                        ${overallStatus}
                                    </div>
                                </div>
                                <div class="content-actions">
                                    <button class="action-btn btn-delete" 
                                            onclick="deleteItem(${item.id})"
                                            title="删除项目">
                                        🗑️ 删除
                                    </button>
                                </div>
                            </div>
                            <div class="review-timeline">
                                ${reviewDetails}
                            </div>
                        </div>
                    </td>
                </tr>
            `
      })
      .join('')
  }

  // 更新统计
  updateStats()
}

// 更新统计信息
function updateStats() {
  const now = new Date()
  let totalItems = reviewData.length
  let overdueCount = 0
  let todayCount = 0
  let completedCount = 0

  reviewData.forEach((item) => {
    // 检查是否全部完成
    if (item.status.every((status) => status === 2)) {
      completedCount++
      return
    }

    // 检查逾期和今日到期
    item.status.forEach((status, index) => {
      if (status === 0) {
        const reviewDate = new Date(item.reviewDates[index])
        if (reviewDate < now) {
          overdueCount++
        } else if (reviewDate.toDateString() === now.toDateString()) {
          todayCount++
        }
      }
    })
  })

  document.getElementById('totalCount').textContent = `总计: ${totalItems}`
  document.getElementById('overdueCount').textContent = `逾期: ${overdueCount}`
  document.getElementById('todayCount').textContent = `今日: ${todayCount}`
  document.getElementById(
    'completedCount'
  ).textContent = `已完成: ${completedCount}`
}

// 设置当前时间
function setCurrentDateTime() {
  function updateTime() {
    const now = new Date()
    const timeString = now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    const timeElement = document.getElementById('currentTime')
    if (timeElement) {
      timeElement.textContent = timeString
    }
  }

  updateTime()
  setInterval(updateTime, 1000)
}

// ==================== 数据存储相关 ====================

// 保存到本地存储
function saveToLocal() {
  try {
    localStorage.setItem('reviewData', JSON.stringify(reviewData))
    console.log('[本地存储] 数据保存成功')
  } catch (error) {
    console.error('[本地存储] 保存失败:', error)
    updateSyncStatus('❌ 本地保存失败', false)
  }
}

// 加载本地数据
function loadLocalData() {
  try {
    const localData = localStorage.getItem('reviewData')
    if (localData) {
      reviewData = JSON.parse(localData)
      console.log('[本地存储] 数据加载成功，项目数:', reviewData.length)
    } else {
      reviewData = []
      console.log('[本地存储] 没有本地数据')
    }
    renderTable()
    updateSyncStatus('🏠 游客模式 - 数据仅保存在本地', false)
  } catch (error) {
    console.error('[本地存储] 加载失败:', error)
    reviewData = []
    renderTable()
    updateSyncStatus('❌ 本地数据加载失败', false)
  }
}

// 保存到服务器
async function saveToServer() {
  if (isGuestMode) {
    saveToLocal()
    return
  }

  try {
    updateSyncStatus('🔄 正在同步到云端...', true)

    const response = await apiRequest('/reviews', {
      method: 'POST',
      body: JSON.stringify({ reviews: reviewData }),
    })

    if (response.success) {
      isOnline = true
      updateSyncStatus(`☁️ 云端同步成功 (${response.count}项)`, true)
      console.log('[云端同步] 保存成功:', response)

      // 更新用户统计
      if (currentUser) {
        loadUserStats()
      }
    } else {
      throw new Error(response.error || '保存失败')
    }
  } catch (error) {
    console.error('[云端同步] 保存失败:', error)
    isOnline = false

    // fallback到本地存储
    saveToLocal()
    updateSyncStatus('❌ 云端同步失败，已保存到本地', false)
  }
}

// 从服务器加载数据
async function loadFromServer() {
  if (isGuestMode) {
    loadLocalData()
    return
  }

  try {
    updateSyncStatus('🔄 正在从云端加载...', true)

    const response = await apiRequest('/reviews')

    if (response.success) {
      reviewData = response.data || []
      isOnline = true
      renderTable()
      updateSyncStatus(`☁️ 云端数据加载成功 (${reviewData.length}项)`, true)
      console.log('[云端同步] 加载成功:', response)
    } else {
      throw new Error(response.error || '加载失败')
    }
  } catch (error) {
    console.error('[云端同步] 加载失败:', error)
    isOnline = false

    // fallback到本地数据
    loadLocalData()
    updateSyncStatus('❌ 云端加载失败，使用本地数据', false)
  }
}

// 定期同步
function startPeriodicSync() {
  if (isGuestMode) return

  setInterval(async () => {
    if (!isGuestMode && reviewData.length > 0) {
      try {
        await saveToServer()
      } catch (error) {
        console.log('[定期同步] 同步失败，将在下次尝试')
      }
    }
  }, 60000) // 每分钟同步一次
}

// ==================== 应用初始化 ====================

async function initApp() {
  // 添加事件监听器
  document.addEventListener('click', handleModalBackdropClick)
  document.addEventListener('keydown', handleEscapeKey)

  // 检查认证状态
  if (checkAuth()) {
    // 已登录，切换到用户模式
    switchToUserMode()

    // 验证token有效性并加载数据
    try {
      const response = await apiRequest('/auth/verify')
      if (response.success) {
        await loadFromServer()
      }
    } catch (error) {
      // token无效，切换到游客模式
      currentUser = null
      isGuestMode = true
      switchToGuestMode()
      loadLocalData()
    }
  } else {
    // 未登录，游客模式
    switchToGuestMode()
    loadLocalData()
  }

  // 设置当前日期和时间
  setCurrentDateTime()

  // 开始定期同步（仅在已登录时）
  if (!isGuestMode) {
    startPeriodicSync()
  }

  console.log('🎉 艾宾浩斯复习系统初始化完成')
}

// 启动应用
document.addEventListener('DOMContentLoaded', function () {
  initApp()
})
