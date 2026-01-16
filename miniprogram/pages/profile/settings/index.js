// pages/profile/settings/index.js
Page({
  data: {
    tastePreferences: {
      avoid_cilantro: false,
      no_spicy: false,
      vegetarian: false,
      custom: []
    },
    notificationEnabled: true
  },

  onLoad() {
    this.loadSettings()
  },

  async loadSettings() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'auth',
        data: { action: 'getMyInfo' }
      })

      if (res.result.success && res.result.data?.user) {
        const user = res.result.data.user
        this.setData({
          tastePreferences: user.taste_preferences || {
            avoid_cilantro: false,
            no_spicy: false,
            vegetarian: false,
            custom: []
          },
          notificationEnabled: user.notification_enabled !== false
        })
      }
    } catch (err) {
      console.error('加载设置失败', err)
    }
  },

  async updateSettings() {
    try {
      await wx.cloud.callFunction({
        name: 'auth',
        data: {
          action: 'updateUserProfile',
          tastePreferences: this.data.tastePreferences,
          notificationEnabled: this.data.notificationEnabled
        }
      })
      wx.showToast({ title: '保存成功', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  onCilantroChange(e) {
    this.setData({
      'tastePreferences.avoid_cilantro': e.detail.value
    })
    this.updateSettings()
  },

  onSpicyChange(e) {
    this.setData({
      'tastePreferences.no_spicy': e.detail.value
    })
    this.updateSettings()
  },

  onVegetarianChange(e) {
    this.setData({
      'tastePreferences.vegetarian': e.detail.value
    })
    this.updateSettings()
  },

  onNotificationChange(e) {
    this.setData({
      notificationEnabled: e.detail.value
    })
    this.updateSettings()
  }
})
