// pages/reviews/create/index.js
Page({
  data: {
    orderId: '',
    rating: 5,
    praise: '',
    praiseTemplates: [
      '大厨做的太好吃啦！🌈',
      '简直是人间美味！👨‍🍳',
      '你是世界上最棒的大厨！💖',
      '这个菜绝了，吃了还想吃！😋',
      '比米其林三星还好吃！✨'
    ]
  },

  onLoad(options) {
    if (options.orderId) {
      this.setData({ orderId: options.orderId })
    }
  },

  onRatingChange(e) {
    this.setData({ rating: e.detail.value })
  },

  onPraiseInput(e) {
    this.setData({ praise: e.detail.value })
  },

  usePraiseTemplate(e) {
    const { index } = e.currentTarget.dataset
    this.setData({ praise: this.data.praiseTemplates[index] })
  },

  async onSubmit() {
    const { orderId, rating, praise } = this.data

    if (!praise.trim()) {
      wx.showToast({ title: '请给大厨一点鼓励~', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '提交中...' })

      // 先提交彩虹屁
      const praiseRes = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'addPraise',
          orderId: orderId,
          praiseText: praise
        }
      })

      if (!praiseRes.result.success) {
        throw new Error(praiseRes.result.errMsg || '提交失败')
      }

      // 再提交评分
      const reviewRes = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'addReview',
          orderId: orderId,
          rating: rating,
          comment: '' // 评论可以是空的
        }
      })

      wx.hideLoading()

      if (reviewRes.result.success) {
        wx.showToast({
          title: '评价成功！',
          icon: 'success',
          duration: 1500
        })

        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        throw new Error(reviewRes.result.errMsg || '提交失败')
      }
    } catch (err) {
      wx.hideLoading()
      console.error('Submit review error:', err)
      wx.showToast({ title: err.message || '提交失败', icon: 'none' })
    }
  }
})
