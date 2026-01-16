// pages/profile/index/index.js
const app = getApp()

Page({
  data: {
    userInfo: null,
    familyInfo: null,
    kitchenInfo: null,
    members: [],
    stats: {
      totalMeals: 0,
      favDish: '暂无',
      praiseCount: 0
    },
    defaultAvatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI2YzZjNmMyIvPjwvc3ZnPg=='
  },

  onShow() {
    this.loadUserInfo()
    this.loadKitchenInfo()
    this.loadStats()
  },

  loadKitchenInfo() {
    const info = wx.getStorageSync('kitchenInfo')
    if (info) {
      this.setData({ kitchenInfo: info })
    }
  },

  loadStats() {
    // 从云函数获取真实数据
    wx.cloud.callFunction({
      name: 'stats',
      data: { action: 'getWeeklyStats' },
      success: (res) => {
        if (res.result.success && res.result.data) {
          const data = res.result.data
          this.setData({
            stats: {
              totalMeals: data.totalMeals || 0,
              favDish: data.favDish || '暂无',
              praiseCount: data.praiseCount || 0
            }
          })
        }
      },
      fail: (err) => {
        console.error('加载统计数据失败', err)
        // 失败时使用默认空数据
        this.setData({
          stats: {
            totalMeals: 0,
            favDish: '暂无',
            praiseCount: 0
          }
        })
      }
    })
  },

  // 加载用户信息
  async loadUserInfo() {
    const userInfo = app.globalData.userInfo
    if (!userInfo) {
      this.setData({ userInfo: null, familyInfo: null, members: [] })
      return
    }

    // Get avatar temp URL if needed
    let displayUserInfo = { ...userInfo }
    if (userInfo.avatar_url && userInfo.avatar_url.startsWith('cloud://')) {
      try {
        const res = await wx.cloud.getTempFileURL({
          fileList: [userInfo.avatar_url]
        })
        if (res.fileList[0].tempFileURL) {
          displayUserInfo.avatar_url = res.fileList[0].tempFileURL
        }
      } catch (err) {
        console.error('Get avatar temp URL error:', err)
      }
    }

    this.setData({ userInfo: displayUserInfo })

    // 加载家庭信息
    try {
      const res = await wx.cloud.callFunction({
        name: 'auth',
        data: { action: 'getMyInfo' }
      })

      if (res.result.success && res.result.data) {
        const { user, family } = res.result.data

        // Also get temp URL for user from server
        if (user.avatar_url && user.avatar_url.startsWith('cloud://')) {
          try {
            const avatarRes = await wx.cloud.getTempFileURL({
              fileList: [user.avatar_url]
            })
            if (avatarRes.fileList[0].tempFileURL) {
              user.avatar_url = avatarRes.fileList[0].tempFileURL
            }
          } catch (err) {
            console.error('Get avatar temp URL error:', err)
          }
        }

        this.setData({
          userInfo: user,
          familyInfo: family
        })
        app.globalData.userInfo = user
        if (family) app.globalData.familyId = family._id

        if (family) {
          this.loadFamilyMembers(family._id)
        }
      }
    } catch (err) {
      console.error('加载用户信息失败', err)
    }
  },

  async loadFamilyMembers(familyId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'auth',
        data: { action: 'getFamilyMembers', familyId }
      })

      if (res.result.success) {
        this.setData({ members: res.result.data })
      }
    } catch (err) {
      console.error('加载成员失败', err)
    }
  },

  // 角色切换
  async onRoleSwitch(e) {
    const isChef = e.detail.value
    const newRole = isChef ? 'chef' : 'foodie'

    try {
      wx.showLoading({ title: '切换中...' })

      const res = await wx.cloud.callFunction({
        name: 'auth',
        data: {
          action: 'updateUserProfile',
          role: newRole
        }
      })

      wx.hideLoading()

      if (res.result.success) {
        const updatedUser = { ...this.data.userInfo, role: newRole }
        this.setData({ userInfo: updatedUser })
        app.globalData.userInfo = updatedUser

        wx.showToast({
          title: isChef ? '已切换为大厨' : '已切换为吃货',
          icon: 'success',
          duration: 1500
        })

        // Notify Dynamic page to refresh if it exists
        setTimeout(() => {
          const pages = getCurrentPages()
          const dynamicPage = pages.find(p => p.route === 'pages/dynamic/index')
          if (dynamicPage && dynamicPage.loadUserRole) {
            dynamicPage.loadUserRole()
          }
        }, 200)
      } else {
        wx.showToast({ title: '切换失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error(err)
      wx.showToast({ title: '切换失败', icon: 'none' })
    }
  },

  // 用户点击头像登录或编辑
  async handleUserLogin() {
    // 如果已登录，跳转到编辑页面
    if (this.data.userInfo && this.data.userInfo._id) {
      wx.navigateTo({ url: '/pages/profile/edit/index' })
      return
    }

    // 未登录，发起授权注册
    try {
      const { userInfo } = await wx.getUserProfile({ desc: '用于完善会员资料' })
      wx.showLoading({ title: '登录中...' })

      const res = await wx.cloud.callFunction({
        name: 'auth',
        data: { action: 'register', userInfo }
      })

      wx.hideLoading()
      if (res.result.success) {
        const user = res.result.data
        app.globalData.userInfo = user
        if (user.family_id) {
          app.globalData.familyId = user.family_id
        }

        this.setData({ userInfo: user })
        this.loadUserInfo()
        wx.showToast({ title: '登录成功', icon: 'success' })
      } else {
        console.error('Login Failed Result:', res)
        wx.showToast({ title: res.result.errMsg || '登录失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error(err)
    }
  },

  // 跳转厨房设置
  goToKitchenEdit() {
    wx.navigateTo({ url: '/pages/kitchen/edit/index' })
  },

  // 跳转菜单管理
  goToMenuManage() {
    wx.navigateTo({ url: '/pages/admin/menu-manage/index/index' })
  },

  // 跳转订单管理
  goToOrderManage() {
    wx.switchTab({ url: '/pages/dynamic/index' })
  },

  // 跳转许愿池
  goToWishingWell() {
    wx.navigateTo({ url: '/pages/wish/index/index' })
  },

  // 跳转许愿池管理
  goToWishManage() {
    wx.navigateTo({ url: '/pages/wish/index/index' })
  },

  // 跳转彩虹屁历史
  goToPraiseHistory() {
    wx.navigateTo({ url: '/pages/praise/history/index' })
  },

  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.globalData.userInfo = null
          app.globalData.familyId = ''

          wx.removeStorageSync('userInfo')
          wx.removeStorageSync('familyId')

          this.setData({
            userInfo: null,
            familyInfo: null,
            members: [],
            stats: {
              totalMeals: 0,
              favDish: '暂无',
              praiseCount: 0
            }
          })

          wx.showToast({ title: '已退出', icon: 'success' })
        }
      }
    })
  }
})
