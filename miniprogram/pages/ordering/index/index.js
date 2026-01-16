// pages/ordering/index/index.js
const app = getApp()

Page({
  data: {
    activeSession: null,
    summary: null,
    loading: true,
    isCreator: false,
    showCreatePopup: false,
    createForm: {
      title: '',
      deadlineMinutes: 60
    },
    deadlineOptions: [],
    timeLeft: '',
    timer: null,
    defaultImage: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjIwIiBmaWxsPSIjOTk5Ij5cI+eVjOiJglvCoDwvdGV4dD48L3N2Zz4=',
    defaultAvatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI2YzZjNmMyIvPjwvc3ZnPg=='
  },

  onShow() {
    this.loadData()
  },

  onUnload() {
    if (this.data.timer) {
      clearInterval(this.data.timer)
    }
  },

  async loadData() {
    if (!app.globalData.familyId) {
      this.setData({ loading: false })
      return
    }

    this.setData({ loading: true })

    try {
      // 获取进行中的会话
      const sessionRes = await wx.cloud.callFunction({
        name: 'ordering',
        data: {
          action: 'getActiveSession',
          familyId: app.globalData.familyId
        }
      })

      if (sessionRes.result && sessionRes.result.data) {
        const session = sessionRes.result.data
        const isCreator = session.created_by === app.globalData.userInfo?.openid

        this.setData({
          activeSession: session,
          isCreator
        })

        // 加载汇总信息
        await this.loadSummary(session._id)

        // 启动倒计时
        this.startCountdown(session.deadline)
      } else {
        this.setData({
          activeSession: null,
          summary: null
        })
      }

      // 加载截止时间选项
      if (this.data.deadlineOptions.length === 0) {
        const optionsRes = await wx.cloud.callFunction({
          name: 'ordering',
          data: { action: 'getDeadlineOptions' }
        })
        if (optionsRes.result && optionsRes.result.data) {
          this.setData({ deadlineOptions: optionsRes.result.data })
        }
      }
    } catch (err) {
      console.error('加载数据失败', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadSummary(sessionId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'ordering',
        data: {
          action: 'getSelections',
          sessionId
        }
      })

      if (res.result && res.result.data) {
        this.setData({
          summary: res.result.data
        })
      }
    } catch (err) {
      console.error('加载汇总失败', err)
    }
  },

  startCountdown(deadline) {
    if (this.data.timer) {
      clearInterval(this.data.timer)
    }

    const updateTimeLeft = () => {
      const now = new Date()
      const end = new Date(deadline)
      const diff = end - now

      if (diff <= 0) {
        this.setData({ timeLeft: '已结束' })
        clearInterval(this.data.timer)
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      let timeStr = ''
      if (hours > 0) {
        timeStr = `${hours}小时${minutes}分`
      } else if (minutes > 0) {
        timeStr = `${minutes}分${seconds}秒`
      } else {
        timeStr = `${seconds}秒`
      }

      this.setData({ timeLeft: timeStr })
    }

    updateTimeLeft()

    const timer = setInterval(updateTimeLeft, 1000)
    this.setData({ timer })
  },

  // 发起点餐
  onStartOrdering() {
    this.setData({
      showCreatePopup: true,
      createForm: {
        title: '',
        deadlineMinutes: 60
      }
    })
  },

  closePopup() {
    this.setData({ showCreatePopup: false })
  },

  onTitleInput(e) {
    this.setData({ 'createForm.title': e.detail.value })
  },

  onDeadlineSelect(e) {
    this.setData({ 'createForm.deadlineMinutes': e.currentTarget.dataset.value })
  },

  async onCreateSession() {
    wx.showLoading({ title: '创建中...' })

    try {
      const res = await wx.cloud.callFunction({
        name: 'ordering',
        data: {
          action: 'createSession',
          title: this.data.createForm.title,
          deadlineMinutes: this.data.createForm.deadlineMinutes
        }
      })

      wx.hideLoading()

      if (res.result && res.result.success) {
        wx.showToast({ title: '创建成功', icon: 'success' })
        this.closePopup()
        this.loadData()
      } else {
        wx.showToast({ title: res.result?.errMsg || '创建失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '创建失败', icon: 'none' })
    }
  },

  // 修改我的点餐
  onEditMyOrder() {
    if (!this.data.activeSession) return
    wx.navigateTo({
      url: `/pages/ordering/select/index?sessionId=${this.data.activeSession._id}`
    })
  },

  // 取消点餐
  onCancelSession() {
    wx.showModal({
      title: '取消点餐',
      content: '确定要取消这次点餐吗？已点的菜品将被清除。',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await wx.cloud.callFunction({
              name: 'ordering',
              data: {
                action: 'cancelSession',
                sessionId: this.data.activeSession._id
              }
            })

            if (result.result && result.result.success) {
              wx.showToast({ title: '已取消', icon: 'success' })
              this.loadData()
            } else {
              wx.showToast({ title: result.result?.errMsg || '操作失败', icon: 'none' })
            }
          } catch (err) {
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 确认完成
  onCloseSession() {
    wx.showModal({
      title: '确认完成',
      content: `确定要完成点餐吗？\n共计 ${this.data.summary?.totalQuantity || 0} 份，¥${(this.data.summary?.totalAmount || 0) / 100}`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await wx.cloud.callFunction({
              name: 'ordering',
              data: {
                action: 'closeSession',
                sessionId: this.data.activeSession._id
              }
            })

            if (result.result && result.result.success) {
              wx.showToast({ title: '点餐完成', icon: 'success' })
              // 跳转到订单页
              setTimeout(() => {
                wx.navigateTo({ url: '/pages/orders/index' })
              }, 1500)
            } else {
              wx.showToast({ title: result.result?.errMsg || '操作失败', icon: 'none' })
            }
          } catch (err) {
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  }
})
