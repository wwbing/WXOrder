// pages/orders/detail/index.js
const app = getApp()

Page({
  data: {
    orderId: '',
    order: null,
    items: [],
    summary: null,
    loading: true,
    defaultImage: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjIwIiBmaWxsPSIjOTk5Ij5cI+eVjOiJglvCoDwvdGV4dD48L3N2Zz4=',
    defaultAvatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI2YzZjNmMyIvPjwvc3ZnPg=='
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ orderId: options.id })
      this.loadData()
    }
  },

  async loadData() {
    if (!this.data.orderId) return

    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getDetail',
          orderId: this.data.orderId
        }
      })

      if (res.result && res.result.success) {
        this.setData({
          order: res.result.data.order,
          items: res.result.data.items
        })

        // 计算汇总
        this.calculateSummary(res.result.data.items)
      }
    } catch (err) {
      console.error('加载订单详情失败', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 计算汇总
  calculateSummary(items) {
    const summaryMap = {}
    let totalQuantity = 0
    let totalAmount = 0

    items.forEach(userItem => {
      userItem.items.forEach(item => {
        if (!summaryMap[item.menu_item_id]) {
          summaryMap[item.menu_item_id] = {
            item: item.menu_item,
            totalQuantity: 0,
            totalAmount: 0
          }
        }
        summaryMap[item.menu_item_id].totalQuantity += item.quantity
        summaryMap[item.menu_item_id].totalAmount += item.quantity * item.menu_item_price
        totalQuantity += item.quantity
        totalAmount += userItem.subtotal
      })
    })

    this.setData({
      summary: {
        summary: Object.values(summaryMap),
        totalQuantity,
        totalAmount
      }
    })
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

  // 标记为已付款
  onMarkAsPaid() {
    wx.showModal({
      title: '标记付款',
      content: '确定要将此订单标记为已付款吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await wx.cloud.callFunction({
              name: 'order',
              data: {
                action: 'markAsPaid',
                orderId: this.data.orderId,
                memberOpenid: app.globalData.userInfo?.openid,
                amount: this.data.order.total_amount
              }
            })

            if (result.result && result.result.success) {
              wx.showToast({ title: '已标记付款', icon: 'success' })
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
  }
})
