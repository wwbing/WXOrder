// pages/favorites/index/index.js
const app = getApp()

// 默认图片（Base64 SVG）
const DEFAULT_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjE2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2IiBmaWxsPSIjOTk5Ij5cI+eVjOiJglvCoDwvdGV4dD48L3N2Zz4='

Page({
  data: {
    familyId: '',
    list: [],
    loading: true,
    defaultImage: DEFAULT_IMAGE
  },

  onShow() {
    this.loadFavorites()
  },

  async loadFavorites() {
    if (!app.globalData.familyId) {
      wx.showToast({ title: '请先加入家庭', icon: 'none' })
      this.setData({ loading: false })
      return
    }

    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'favorite',
        data: {
          action: 'list',
          familyId: app.globalData.familyId
        }
      })

      if (res.result && res.result.success) {
        this.setData({
          familyId: app.globalData.familyId,
          list: res.result.data.list
        })
      } else {
        wx.showToast({ title: res.result?.errMsg || '加载失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' })
      console.error(err)
    } finally {
      this.setData({ loading: false })
    }
  },

  async removeFavorite(e) {
    const { id } = e.currentTarget.dataset

    wx.showModal({
      title: '取消收藏',
      content: '确定取消收藏该菜品吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await wx.cloud.callFunction({
              name: 'favorite',
              data: {
                action: 'remove',
                menuItemId: id
              }
            })

            if (result.result && result.result.success) {
              wx.showToast({ title: '已取消收藏', icon: 'success' })
              this.loadFavorites()
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

  addToOrder(e) {
    const { item } = e.currentTarget.dataset
    // 跳转到点餐页面，并携带菜品信息
    const encodedItem = encodeURIComponent(JSON.stringify(item))
    wx.navigateTo({
      url: `/pages/ordering/select?presetItem=${encodedItem}`
    })
  },

  goToMenu() {
    wx.navigateTo({ url: '/pages/menu/index/index' })
  }
})
