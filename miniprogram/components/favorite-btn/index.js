// components/favorite-btn/index.js
const app = getApp()

Component({
  properties: {
    menuItemId: {
      type: String,
      value: ''
    },
    familyId: {
      type: String,
      value: ''
    },
    size: {
      type: String,
      value: 'normal' // small, normal, large
    },
    showCount: {
      type: Boolean,
      value: false
    }
  },

  data: {
    isFavorited: false,
    count: 0
  },

  lifetimes: {
    attached() {
      if (this.data.menuItemId) {
        this.checkFavoriteStatus()
      }
    }
  },

  observers: {
    'menuItemId': function(newId) {
      if (newId) {
        this.checkFavoriteStatus()
      }
    }
  },

  methods: {
    async checkFavoriteStatus() {
      if (!this.data.menuItemId) return

      try {
        const res = await wx.cloud.callFunction({
          name: 'favorite',
          data: {
            action: 'check',
            menuItemId: this.data.menuItemId
          }
        })

        if (res.result && res.result.success) {
          this.setData({ isFavorited: res.result.data.isFavorited })
        }
      } catch (err) {
        console.error('检查收藏状态失败', err)
      }
    },

    async toggle() {
      const action = this.data.isFavorited ? 'remove' : 'add'

      try {
        const res = await wx.cloud.callFunction({
          name: 'favorite',
          data: {
            action,
            menuItemId: this.data.menuItemId,
            familyId: this.data.familyId || app.globalData.familyId
          }
        })

        if (res.result && res.result.success) {
          this.setData({
            isFavorited: !this.data.isFavorited
          })
          wx.showToast({
            title: this.data.isFavorited ? '收藏成功' : '已取消',
            icon: 'success'
          })

          // 触发事件
          this.triggerEvent('change', {
            isFavorited: this.data.isFavorited,
            menuItemId: this.data.menuItemId
          })
        } else {
          wx.showToast({ title: res.result?.errMsg || '操作失败', icon: 'none' })
        }
      } catch (err) {
        wx.showToast({ title: '操作失败', icon: 'none' })
      }
    }
  }
})
