// pages/auth/login/index.js
const app = getApp()

Page({
  data: {
    isNewUser: true,
    userInfo: null,
    familyInfo: null,
    familyName: '',
    inviteCode: '',
    loading: false
  },

  onLoad(options) {
    this.type = options.type || 'login'
    this.checkLoginStatus()
  },

  // 检查登录状态
  async checkLoginStatus() {
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'auth',
        data: { action: 'login' }
      })

      this.setData({ loading: false })

      if (res.result.success) {
        const { isNew, user, family } = res.result.data

        if (isNew) {
          // 未注册，显示授权页
          this.setData({ step: 'auth' })
        } else {
          // 已注册
          this.setData({ userInfo: user, familyInfo: family })
          app.globalData.userInfo = user
          if (family) app.globalData.familyId = family._id

          if (this.type === 'login') {
            // 仅登录，直接返回
            wx.navigateBack()
          } else if (this.type === 'create') {
            this.setData({ step: 'create' })
          } else if (this.type === 'join') {
            this.setData({ step: 'join' })
          }
        }
      }
    } catch (err) {
      this.setData({ loading: false })
      // console.error(err)
    }
  },

  async onRegister() {
    // 注册用户
    this.setData({ loading: true })
    try {
      const userProfile = await this.getUserProfile()
      const res = await wx.cloud.callFunction({
        name: 'auth',
        data: { action: 'register', userInfo: userProfile }
      })

      if (res.result.success) {
        // 注册成功，重新检查状态以跳转
        this.checkLoginStatus()
      }
    } catch (err) {
      console.error(err)
      this.setData({ loading: false })
    }
  },

  // 输入家庭名称
  onFamilyNameInput(e) {
    this.setData({ familyName: e.detail.value })
  },

  // 输入邀请码
  onInviteCodeInput(e) {
    this.setData({
      inviteCode: e.detail.value.toUpperCase()
    })
  },

  // 创建家庭
  async createFamily() {
    this.setData({ loading: true })

    try {
      const userProfile = await this.getUserProfile()

      const res = await wx.cloud.callFunction({
        name: 'auth',
        data: {
          action: 'createFamily',
          familyName: this.data.familyName,
          userInfo: userProfile
        }
      })

      if (res.result.success) {
        wx.showToast({ title: '创建成功', icon: 'success' })

        // 重新获取用户信息
        await this.checkLoginStatus()

        // 保存全局数据
        app.globalData.familyId = res.result.data.familyId
      } else {
        wx.showToast({ title: res.result.errMsg, icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '创建失败', icon: 'none' })
      console.error(err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加入家庭
  async joinFamily() {
    if (!this.data.inviteCode || this.data.inviteCode.length !== 6) {
      wx.showToast({ title: '请输入6位邀请码', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    try {
      const userProfile = await this.getUserProfile()

      const res = await wx.cloud.callFunction({
        name: 'auth',
        data: {
          action: 'joinFamily',
          inviteCode: this.data.inviteCode,
          userInfo: userProfile
        }
      })

      if (res.result.success) {
        wx.showToast({ title: '加入成功', icon: 'success' })

        // 重新获取用户信息
        await this.checkLoginStatus()

        // 保存全局数据
        app.globalData.familyId = res.result.data.familyId
      } else {
        wx.showToast({ title: res.result.errMsg, icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '加入失败', icon: 'none' })
      console.error(err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 获取用户信息
  getUserProfile() {
    return new Promise((resolve) => {
      wx.getUserProfile({
        desc: '用于完善用户信息',
        success: (res) => {
          resolve(res.userInfo)
        },
        fail: () => {
          // 如果用户拒绝，也继续使用默认信息
          resolve({ nickName: '', avatarUrl: '' })
        }
      })
    })
  },

  // 复制邀请码
  copyInviteCode() {
    if (!this.data.familyInfo?.invite_code) return

    wx.setClipboardData({
      data: this.data.familyInfo.invite_code,
      success: () => {
        wx.showToast({ title: '邀请码已复制', icon: 'success' })
      }
    })
  },

  // 跳转菜单页面
  goToMenu() {
    wx.navigateTo({ url: '/pages/menu/index/index' })
  },

  // 跳转个人中心
  goToProfile() {
    wx.navigateTo({ url: '/pages/profile/index/index' })
  }
})
