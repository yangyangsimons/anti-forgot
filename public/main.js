let reviewData = []
let isOnline = false

// 艾宾浩斯复习间隔（分钟）
const intervals = [20, 60, 1440, 2880, 5760, 10080, 21600, 43200] // 20分钟，1小时，1天，2天，4天，7天，15天，30天

// API 配置
const API_BASE = '/api'

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
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('API请求失败:', error)
    throw error
  }
}

// 从服务器加载数据
async function loadFromServer() {
  try {
    updateSyncStatus('🔄 正在从服务器加载数据...', true)

    const response = await apiRequest('/reviews')

    if (response.success) {
      // 转换数据格式（确保日期对象正确）
      reviewData = response.data.map((item) => ({
        ...item,
        startDate: new Date(item.startDate),
        reviewDates: item.reviewDates.map((dateStr) => new Date(dateStr)),
      }))

      isOnline = true
      updateSyncStatus(
        `✅ 服务器连接成功，加载了 ${reviewData.length} 条记录`,
        true
      )

      // 同时保存到本地作为备份
      saveToLocal()
    } else {
      throw new Error(response.error || '服务器返回错误')
    }
  } catch (error) {
    console.error('从服务器加载数据失败:', error)
    isOnline = false
    updateSyncStatus('⚠️ 服务器连接失败，使用本地数据', false)

    // 使用本地备份数据
    loadFromLocal()
  }

  renderTable()
}

// 保存数据到服务器
async function saveToServer() {
  if (!isOnline) {
    saveToLocal()
    return
  }

  try {
    // 准备要发送的数据
    const dataToSend = reviewData.map((item) => ({
      ...item,
      startDate: item.startDate.toISOString(),
      reviewDates: item.reviewDates.map((date) => date.toISOString()),
    }))

    const response = await apiRequest('/reviews', {
      method: 'POST',
      body: JSON.stringify({ reviews: dataToSend }),
    })

    if (response.success) {
      updateSyncStatus(`✅ 数据已同步到服务器 (${response.count} 条记录)`, true)
      saveToLocal() // 同时保存到本地
    } else {
      throw new Error(response.error || '保存失败')
    }
  } catch (error) {
    console.error('保存到服务器失败:', error)
    isOnline = false
    updateSyncStatus('⚠️ 服务器保存失败，数据已保存到本地', false)
    saveToLocal()
  }
}

// 本地存储操作
function saveToLocal() {
  try {
    localStorage.setItem('reviewData', JSON.stringify(reviewData))
  } catch (error) {
    console.error('本地保存失败:', error)
  }
}

function loadFromLocal() {
  try {
    const localData = localStorage.getItem('reviewData')
    if (localData) {
      const parsed = JSON.parse(localData)
      reviewData = parsed.map((item) => ({
        ...item,
        startDate: new Date(item.startDate),
        reviewDates: item.reviewDates.map((dateStr) => new Date(dateStr)),
      }))
    } else {
      reviewData = []
    }
  } catch (error) {
    console.error('本地数据加载失败:', error)
    reviewData = []
  }
}

function toggleInstructions() {
  const instructions = document.getElementById('instructions')
  const toggleBtn = instructions.querySelector('.toggle-btn')

  if (instructions.classList.contains('collapsed')) {
    instructions.classList.remove('collapsed')
    toggleBtn.textContent = '收起说明'
  } else {
    instructions.classList.add('collapsed')
    toggleBtn.textContent = '展开说明'
  }
}

function formatDate(date) {
  return date.toLocaleDateString('zh-CN')
}

function formatTime(date) {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000)
}

async function addContent() {
  const content = document.getElementById('contentInput').value.trim()
  const startDate = document.getElementById('startDateInput').value
  const startTime = document.getElementById('startTimeInput').value

  if (!content || !startDate || !startTime) {
    alert('请填写学习内容、日期和时间！')
    return
  }

  // 组合日期和时间创建完整的开始时间
  const startDateTime = new Date(`${startDate}T${startTime}`)
  const reviewDates = intervals.map((interval) =>
    addMinutes(startDateTime, interval)
  )

  const newItem = {
    id: Date.now(),
    content: content,
    startDate: startDateTime,
    reviewDates: reviewDates,
    status: new Array(8).fill(0), // 0: 未开始, 1: 进行中, 2: 已完成
  }

  reviewData.push(newItem)
  await saveData()
  renderTable()

  // 清空输入框
  document.getElementById('contentInput').value = ''
  // 重新设置为当前时间
  setCurrentDateTime()

  updateSyncStatus(`✅ 已添加"${content}"`, true)
}

async function toggleStatus(itemId, reviewIndex) {
  const item = reviewData.find((item) => item.id === itemId)
  if (item) {
    item.status[reviewIndex] = (item.status[reviewIndex] + 1) % 3
    await saveData()
    renderTable()
  }
}

async function deleteItem(itemId) {
  const item = reviewData.find((item) => item.id === itemId)
  if (item && confirm(`确定要删除"${item.content}"吗？`)) {
    reviewData = reviewData.filter((item) => item.id !== itemId)
    await saveData()
    renderTable()
    updateSyncStatus('✅ 项目已删除', true)
  }
}

function getStatusClass(status) {
  switch (status) {
    case 0:
      return 'status-not-started'
    case 1:
      return 'status-in-progress'
    case 2:
      return 'status-completed'
    default:
      return 'status-not-started'
  }
}

function getStatusText(status) {
  switch (status) {
    case 0:
      return '未开始'
    case 1:
      return '进行中'
    case 2:
      return '已完成'
    default:
      return '未开始'
  }
}

function renderTable() {
  const tbody = document.getElementById('tableBody')
  tbody.innerHTML = ''

  if (reviewData.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 40px; color: #666;">
                    📚 暂无学习计划<br>
                    <small style="color: #999; margin-top: 10px; display: inline-block;">
                        请添加新的学习内容开始使用艾宾浩斯复习法
                    </small>
                </td>
            </tr>
        `
    return
  }

  const today = new Date()

  reviewData.forEach((item) => {
    const row = document.createElement('tr')

    let html = `
            <td style="font-weight: bold; color: #333; text-align: left;">${
              item.content
            }</td>
            <td>
                <div style="font-weight: 600;">${formatDate(
                  item.startDate
                )}</div>
                <small style="color: #666;">${formatTime(
                  item.startDate
                )}</small>
            </td>
        `

    item.reviewDates.forEach((date, index) => {
      const isToday = today.toDateString() === date.toDateString()
      const isPast = today > date
      const isOverdue = isPast && item.status[index] === 0

      let cellClass = ''
      if (isToday) cellClass = 'today-highlight'
      else if (isOverdue) cellClass = 'overdue'

      html += `
                <td class="${cellClass}">
                    <div style="font-weight: 600; margin-bottom: 4px;">${formatDate(
                      date
                    )}</div>
                    <div style="font-size: 12px; color: #666; margin-bottom: 8px;">${formatTime(
                      date
                    )}</div>
                    <button class="status-btn ${getStatusClass(
                      item.status[index]
                    )}" 
                            onclick="toggleStatus(${item.id}, ${index})"
                            title="点击切换状态">
                        ${getStatusText(item.status[index])}
                    </button>
                    ${
                      isToday
                        ? '<div style="font-size: 11px; color: #ffc107; margin-top: 4px;">📅 今日</div>'
                        : ''
                    }
                    ${
                      isOverdue
                        ? '<div style="font-size: 11px; color: #dc3545; margin-top: 4px;">⚠️ 逾期</div>'
                        : ''
                    }
                </td>
            `
    })

    html += `
            <td>
                <button class="delete-btn" onclick="deleteItem(${item.id})" title="删除这个学习计划">
                    🗑️ 删除
                </button>
            </td>
        `

    row.innerHTML = html
    tbody.appendChild(row)
  })
}

// 统一的数据保存方法
async function saveData() {
  await saveToServer()
}

function setCurrentDateTime() {
  const now = new Date()

  // 设置当前日期
  const dateStr = now.toISOString().split('T')[0]
  document.getElementById('startDateInput').value = dateStr

  // 设置当前时间（格式化为HH:MM）
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const timeStr = `${hours}:${minutes}`
  document.getElementById('startTimeInput').value = timeStr
}

// 定期重连服务器
function startPeriodicSync() {
  // 每30秒尝试重连一次（如果离线）
  setInterval(async () => {
    if (!isOnline) {
      try {
        const response = await apiRequest('/health')
        if (response.status === 'ok') {
          await loadFromServer()
        }
      } catch (error) {
        // 继续保持离线状态
      }
    }
  }, 30000)

  // 每分钟更新表格显示
  setInterval(() => {
    renderTable()
  }, 60000)
}

// 页面可见性变化时重新加载数据
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    loadFromServer()
  }
})

// 页面初始化
async function initApp() {
  // 设置当前日期和时间
  setCurrentDateTime()

  // 尝试从服务器加载数据
  await loadFromServer()

  // 开始定期同步
  startPeriodicSync()

  console.log('🎉 艾宾浩斯复习系统初始化完成')
}

// 启动应用
initApp()
