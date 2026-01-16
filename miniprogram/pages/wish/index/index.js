// pages/wish/index/index.js
const app = getApp()

Page({
  data: {
    wishes: [],
    loading: true,
    showAddDialog: false,
    newWish: {
      title: '',
      description: ''
    },
    userOpenid: ''
  },

  onLoad() {
    // 获取用户openid用于判断投票状态
    this.setData({ userOpenid: app.globalData.userInfo?.openid || '' })
  },

  onShow() {
    this.loadWishes()
  },

  // 加载愿望列表
  async loadWishes() {
    try {
      this.setData({ loading: true })
      const res = await wx.cloud.callFunction({
        name: 'wish',
        data: { action: 'getList' }
      })

      if (res.result.success) {
        this.setData({ wishes: res.result.data })
      } else {
        wx.showToast({ title: res.result.errMsg || '加载失败', icon: 'none' })
      }
    } catch (err) {
      console.error('加载愿望失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 显示添加对话框
  showAddDialog() {
    this.setData({
      showAddDialog: true,
      newWish: { title: '', description: '' }
    })
  },

  // 隐藏添加对话框
  hideAddDialog() {
    this.setData({ showAddDialog: false })
  },

  // 输入愿望标题
  onTitleInput(e) {
    this.setData({
      'newWish.title': e.detail.value
    })
  },

  // 输入愿望描述
  onDescInput(e) {
    this.setData({
      'newWish.description': e.detail.value
    })
  },

  // 提交许愿
  async submitWish() {
    const { title, description } = this.data.newWish
    if (!title.trim()) {
      wx.showToast({ title: '请输入愿望', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '提交中...' })
      const res = await wx.cloud.callFunction({
        name: 'wish',
        data: {
          action: 'create',
          title,
          description
        }
      })

      wx.hideLoading()
      if (res.result.success) {
        this.hideAddDialog()
        this.loadWishes()
        wx.showToast({ title: '许愿成功', icon: 'success' })
      } else {
        wx.showToast({ title: res.result.errMsg || '提交失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('提交愿望失败', err)
      wx.showToast({ title: '提交失败', icon: 'none' })
    }
  },

  // 投票/取消投票
  async onVote(e) {
    const { id } = e.currentTarget.dataset
    const wish = this.data.wishes.find(w => w._id === id)
    if (!wish) return

    try {
      const res = await wx.cloud.callFunction({
        name: 'wish',
        data: { action: 'vote', wishId: id }
      })

      if (res.result.success) {
        // 更新本地数据
        const wishes = this.data.wishes.map(w => {
          if (w._id === id) {
            const voted = res.result.voted
            return {
              ...w,
              voted_by: voted
                ? [...(w.voted_by || []), this.data.userOpenid]
                : (w.voted_by || []).filter(openid => openid !== this.data.userOpenid),
              vote_count: w.vote_count + (voted ? 1 : -1)
            }
          }
          return w
        })
        this.setData({ wishes })
      }
    } catch (err) {
      console.error('投票失败', err)
      wx.showToast({ title: '投票失败', icon: 'none' })
    }
  },

  // 删除愿望
  async onDelete(e) {
    const { id } = e.currentTarget.dataset

    wx.showModal({
      title: '删除愿望',
      content: '确定要删除这个愿望吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await wx.cloud.callFunction({
              name: 'wish',
              data: { action: 'delete', wishId: id }
            })

            if (result.result.success) {
              this.loadWishes()
              wx.showToast({ title: '已删除', icon: 'success' })
            } else {
              wx.showToast({ title: result.result.errMsg || '删除失败', icon: 'none' })
            }
          } catch (err) {
            console.error('删除失败', err)
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 编辑愿望
  onEdit(e) {
    const { id } = e.currentTarget.dataset
    const wish = this.data.wishes.find(w => w._id === id)
    if (!wish) return

    wx.showModal({
      title: '编辑愿望',
      editable: true,
      placeholderText: '请输入愿望名称',
      content: wish.title,
      success: async (res) => {
        if (res.confirm && res.content && res.content.trim() !== wish.title) {
          try {
            const result = await wx.cloud.callFunction({
              name: 'wish',
              data: {
                action: 'update',
                wishId: id,
                title: res.content
              }
            })

            if (result.result.success) {
              this.loadWishes()
              wx.showToast({ title: '已更新', icon: 'success' })
            } else {
              wx.showToast({ title: result.result.errMsg || '更新失败', icon: 'none' })
            }
          } catch (err) {
            console.error('更新失败', err)
            wx.showToast({ title: '更新失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 标记状态（大厨功能）
  onUpdateStatus(e) {
    const { id } = e.currentTarget.dataset
    const wish = this.data.wishes.find(w => w._id === id)
    if (!wish) return

    const statusText = {
      pending: '待实现',
      approved: '已认可',
      rejected: '不做了',
      implemented: '已实现'
    }

    wx.showActionSheet({
      itemList: ['待实现', '已认可', '不做了', '已实现'],
      success: async (res) => {
        const statusMap = ['pending', 'approved', 'rejected', 'implemented']
        const newStatus = statusMap[res.tapIndex]

        if (newStatus !== wish.status) {
          try {
            const result = await wx.cloud.callFunction({
              name: 'wish',
              data: {
                action: 'update',
                wishId: id,
                status: newStatus
              }
            })

            if (result.result.success) {
              this.loadWishes()
            } else {
              wx.showToast({ title: result.result.errMsg || '更新失败', icon: 'none' })
            }
          } catch (err) {
            console.error('更新失败', err)
            wx.showToast({ title: '更新失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadWishes().then(() => {
      wx.stopPullDownRefresh()
    })
  }
})
