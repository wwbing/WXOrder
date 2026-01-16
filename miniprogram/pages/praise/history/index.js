// pages/praise/history/index.js
const app = getApp()

Page({
    data: {
        praiseList: [],
        loading: false
    },

    onLoad() {
        this.loadPraiseHistory()
    },

    async loadPraiseHistory() {
        try {
            this.setData({ loading: true })
            wx.showLoading({ title: '加载中...' })

            // 获取所有已完成的订单（包含彩虹屁）
            const res = await wx.cloud.callFunction({
                name: 'order',
                data: { action: 'getOrders' }
            })

            wx.hideLoading()
            this.setData({ loading: false })

            if (res.result.success) {
                // 过滤出有彩虹屁的订单
                const praiseList = res.result.data
                    .filter(order => order.praise && order.praise.content)
                    .map(order => ({
                        _id: order._id,
                        content: order.praise.content,
                        author: order.praise.nickname,
                        createdAt: order.praise.created_at,
                        orderDate: order.created_at,
                        rating: order.review ? order.review.rating : 0,
                        dishes: order.items.map(item => item.name).join('、')
                    }))
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

                this.setData({ praiseList })
            } else {
                wx.showToast({ title: '加载失败', icon: 'none' })
            }
        } catch (err) {
            wx.hideLoading()
            this.setData({ loading: false })
            console.error('Load praise history error:', err)
            wx.showToast({ title: '加载失败', icon: 'none' })
        }
    },

    onPullDownRefresh() {
        this.loadPraiseHistory().then(() => {
            wx.stopPullDownRefresh()
        })
    }
})
