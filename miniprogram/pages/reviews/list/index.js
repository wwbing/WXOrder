// pages/reviews/list/index.js
const app = getApp()

Page({
  data: {
    menuItemId: '',
    list: [],
    stats: null,
    loading: true,
    hasReviewed: false,
    defaultAvatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI2YzZjNmMyIvPjwvc3ZnPg=='
  },

  onLoad(options) {
    if (options.menuId) {
      this.setData({ menuItemId: options.menuId })
      this.loadData()
    }
  },

  onShow() {
    if (this.data.menuItemId) {
      this.loadData()
    }
  },

  async loadData() {
    if (!this.data.menuItemId) return

    this.setData({ loading: true })

    try {
      // 并行加载评价列表和统计数据
      const [listRes, statsRes] = await Promise.all([
        wx.cloud.callFunction({
          name: 'review',
          data: {
            action: 'list',
            menuItemId: this.data.menuItemId
          }
        }),
        wx.cloud.callFunction({
          name: 'review',
          data: {
            action: 'getStats',
            menuItemId: this.data.menuItemId
          }
        })
      ])

      if (listRes.result && listRes.result.success) {
        this.setData({ list: listRes.result.data.list })
      }

      if (statsRes.result && statsRes.result.success) {
        this.setData({ stats: statsRes.result.data })
      }
    } catch (err) {
      console.error('加载评价失败', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 格式化时间
  formatTime(timestamp) {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${month}-${day}`
  },

  // 预览图片
  previewImage(e) {
    const { urls, current } = e.currentTarget.dataset
    wx.previewImage({
      urls: urls,
      current: current
    })
  },

  // 跳转写评价
  goToWriteReview() {
    const menuItemId = this.data.menuItemId
    wx.navigateTo({
      url: `/pages/reviews/create/index?menuId=${menuItemId}`
    })
  }
})
