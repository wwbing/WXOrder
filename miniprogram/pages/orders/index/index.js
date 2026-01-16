// pages/orders/index/index.js
const app = getApp()

Page({
  data: {
    list: [],
    stats: null,
    loading: true
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    if (!app.globalData.familyId) {
      this.setData({ loading: false })
      return
    }

    this.setData({ loading: true })

    try {
      // 并行加载订单列表和统计
      const [listRes, statsRes] = await Promise.all([
        wx.cloud.callFunction({
          name: 'order',
          data: {
            action: 'getOrders',
            familyId: app.globalData.familyId
          }
        }),
        wx.cloud.callFunction({
          name: 'order',
          data: {
            action: 'getStats',
            familyId: app.globalData.familyId
          }
        })
      ])

      if (listRes.result && listRes.result.success) {
        this.setData({ list: listRes.result.data })
      }

      if (statsRes.result && statsRes.result.success) {
        this.setData({ stats: statsRes.result.data })
      }
    } catch (err) {
      console.error('加载订单失败', err)
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
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${month}-${day} ${hours}:${minutes}`
  },

  // 跳转详情
  goToDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/orders/detail/index?id=${id}`
    })
  }
})
