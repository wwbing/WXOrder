// pages/dynamic/index.js
const app = getApp()

Page({
    data: {
        userRole: 'foodie', // 'chef' or 'foodie'
        orders: [],
        allOrders: [], // 所有订单
        activeTab: 'pending' // pending, cooking, completed
    },

    onLoad() {
        this.loadUserRole()
    },

    onShow() {
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
            this.getTabBar().setData({
                selected: 1 // Index of Dynamic tab
            })
        }

        // Always reload role from global data
        this.loadUserRole()
        this.loadOrders()
    },

    loadUserRole() {
        const userInfo = app.globalData.userInfo
        if (userInfo && userInfo.role) {
            console.log('Current user role:', userInfo.role)
            this.setData({ userRole: userInfo.role })
        } else {
            // Default to foodie if not set
            this.setData({ userRole: 'foodie' })
        }
    },

    async loadOrders() {
        try {
            wx.showLoading({ title: '加载中...' })

            const res = await wx.cloud.callFunction({
                name: 'order',
                data: { action: 'getOrders' }
            })

            wx.hideLoading()

            if (res.result.success) {
                const allOrders = res.result.data
                this.setData({ allOrders })
                this.filterOrdersByTab()
            } else {
                wx.showToast({ title: '加载失败', icon: 'none' })
            }
        } catch (err) {
            wx.hideLoading()
            console.error('Load orders failed:', err)
            wx.showToast({ title: '加载失败', icon: 'none' })
        }
    },

    filterOrdersByTab() {
        const { activeTab, allOrders } = this.data
        let filteredOrders = []

        if (activeTab === 'pending') {
            filteredOrders = allOrders.filter(o => o.status === 'pending')
        } else if (activeTab === 'cooking') {
            filteredOrders = allOrders.filter(o => o.status === 'cooking' || o.status === 'ready')
        } else if (activeTab === 'completed') {
            filteredOrders = allOrders.filter(o => o.status === 'completed')
        }

        this.setData({ orders: filteredOrders })
    },

    onTabSwitch(e) {
        const { tab } = e.currentTarget.dataset
        this.setData({ activeTab: tab })
        this.filterOrdersByTab()
    },

    // Chef Actions
    async onAcceptOrder(e) {
        const { id } = e.currentTarget.dataset

        try {
            const res = await wx.cloud.callFunction({
                name: 'order',
                data: {
                    action: 'updateOrderStatus',
                    orderId: id,
                    newStatus: 'cooking'
                }
            })

            if (res.result.success) {
                wx.showToast({ title: '已接单！开始做菜', icon: 'success' })
                this.loadOrders()
            } else {
                wx.showToast({ title: '操作失败', icon: 'none' })
            }
        } catch (err) {
            console.error(err)
            wx.showToast({ title: '操作失败', icon: 'none' })
        }
    },

    async onCallForDinner(e) {
        const { id } = e.currentTarget.dataset

        try {
            const res = await wx.cloud.callFunction({
                name: 'order',
                data: {
                    action: 'updateOrderStatus',
                    orderId: id,
                    newStatus: 'ready'
                }
            })

            if (res.result.success) {
                wx.showToast({ title: '🎉 开饭啦！', icon: 'success' })
                this.loadOrders()
            } else {
                wx.showToast({ title: '操作失败', icon: 'none' })
            }
        } catch (err) {
            console.error(err)
            wx.showToast({ title: '操作失败', icon: 'none' })
        }
    },

    // Foodie Actions
    async onUrgeOrder(e) {
        const { id } = e.currentTarget.dataset
        wx.showToast({ title: '催单成功！大厨正在加速~', icon: 'none', duration: 2000 })
        // TODO: 可以发送通知给大厨
    },

    // 合并的评价功能（包含彩虹屁和评分）
    onSubmitReview(e) {
        const { id } = e.currentTarget.dataset
        const order = this.data.orders.find(o => o._id === id)

        if (!order) return

        // 导航到评价页面
        wx.navigateTo({
            url: `/pages/reviews/create/index?orderId=${id}`
        })
    },

    // 删除订单（仅大厨可用）
    async onDeleteOrder(e) {
        const { id } = e.currentTarget.dataset

        wx.showModal({
            title: '确认删除',
            content: '确定要删除这个订单吗？此操作不可恢复。',
            success: async (res) => {
                if (res.confirm) {
                    try {
                        wx.showLoading({ title: '删除中...' })

                        const result = await wx.cloud.callFunction({
                            name: 'order',
                            data: {
                                action: 'deleteOrder',
                                orderId: id
                            }
                        })

                        wx.hideLoading()

                        if (result.result.success) {
                            wx.showToast({ title: '已删除', icon: 'success' })
                            this.loadOrders()
                        } else {
                            wx.showToast({ title: result.result.errMsg || '删除失败', icon: 'none' })
                        }
                    } catch (err) {
                        wx.hideLoading()
                        console.error('Delete order error:', err)
                        wx.showToast({ title: '删除失败', icon: 'none' })
                    }
                }
            }
        })
    },

    // 下拉刷新
    onPullDownRefresh() {
        this.loadOrders().then(() => {
            wx.stopPullDownRefresh()
        })
    }
})
