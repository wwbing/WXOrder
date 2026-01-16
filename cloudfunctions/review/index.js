// 云函数：评价管理
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// 预设口味标签
const TASTE_TAGS = ['好吃', '一般', '偏咸', '偏淡', '份量足', '份量少', '味道正宗', '不推荐', '性价比高', '颜值高']

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event

  // 验证用户
  async function getUser() {
    const userRes = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get()

    if (userRes.data.length === 0) {
      throw new Error('用户不存在')
    }
    return userRes.data[0]
  }

  try {
    switch (action) {
      case 'create': {
        // 发布评价
        const user = await getUser()
        const { menuItemId, orderId, rating, content, images, tasteTags, isAnonymous } = event

        // 验证菜品
        const itemRes = await db.collection('menu_items').doc(menuItemId).get()
        if (!itemRes.data) {
          throw new Error('菜品不存在')
        }

        // 检查是否已评价
        const existingRes = await db.collection('reviews').where({
          user_openid: wxContext.OPENID,
          menu_item_id: menuItemId,
          order_id: orderId || _.exists(false)
        }).get()

        if (existingRes.data.length > 0) {
          throw new Error('您已评价过该菜品')
        }

        // 创建评价
        const reviewRes = await db.collection('reviews').add({
          data: {
            menu_item_id: menuItemId,
            order_id: orderId || '',
            user_openid: wxContext.OPENID,
            user_name: isAnonymous ? '匿名用户' : user.nickname,
            user_avatar: isAnonymous ? '' : user.avatar_url,
            rating: rating,
            content: content || '',
            images: images || [],
            taste_tags: tasteTags || [],
            is_anonymous: isAnonymous || false,
            is_verified: !!orderId,
            created_at: new Date(),
            updated_at: new Date()
          }
        })

        // 更新统计
        await updateReviewStats(menuItemId)

        return { success: true, data: { reviewId: reviewRes._id } }
      }

      case 'list': {
        // 获取评价列表
        const { menuItemId, page = 1, pageSize = 10 } = event

        const reviewsRes = await db.collection('reviews')
          .where({
            menu_item_id: menuItemId
          })
          .orderBy('created_at', 'desc')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get()

        // 获取总数
        const totalRes = await db.collection('reviews')
          .where({ menu_item_id: menuItemId })
          .count()

        return {
          success: true,
          data: {
            list: reviewsRes.data,
            total: totalRes.total,
            tasteTags: TASTE_TAGS
          }
        }
      }

      case 'myReviews': {
        // 获取我的评价
        const { page = 1, pageSize = 10 } = event

        const myReviewsRes = await db.collection('reviews')
          .where({
            user_openid: wxContext.OPENID
          })
          .orderBy('created_at', 'desc')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get()

        // 获取菜品信息
        const itemIds = myReviewsRes.data.map(r => r.menu_item_id)
        const itemsRes = await db.collection('menu_items')
          .where({
            _id: _.in(itemIds)
          })
          .get()

        const itemMap = {}
        itemsRes.data.forEach(item => {
          itemMap[item._id] = item
        })

        const listWithItems = myReviewsRes.data.map(review => ({
          ...review,
          menu_item: itemMap[review.menu_item_id] || null
        }))

        const myTotalRes = await db.collection('reviews')
          .where({ user_openid: wxContext.OPENID })
          .count()

        return {
          success: true,
          data: {
            list: listWithItems,
            total: myTotalRes.total
          }
        }
      }

      case 'getStats': {
        // 获取评价统计
        const { menuItemId } = event

        // 先查缓存
        let statsRes = await db.collection('review_stats')
          .doc(menuItemId)
          .get()

        if (statsRes.data) {
          return { success: true, data: statsRes.data }
        }

        // 计算统计数据
        const reviews = await db.collection('reviews')
          .where({ menu_item_id: menuItemId })
          .get()

        if (reviews.data.length === 0) {
          return {
            success: true,
            data: {
              menu_item_id: menuItemId,
              avg_rating: 0,
              total_count: 0,
              rating_distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
              popular_tags: []
            }
          }
        }

        // 计算平均分
        const totalRating = reviews.data.reduce((sum, r) => sum + r.rating, 0)
        const avgRating = (totalRating / reviews.data.length).toFixed(1)

        // 计算评分分布
        const ratingDist = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
        reviews.data.forEach(r => {
          ratingDist[r.rating]++
        })

        // 计算热门标签
        const tagCount = {}
        reviews.data.forEach(r => {
          (r.taste_tags || []).forEach(tag => {
            tagCount[tag] = (tagCount[tag] || 0) + 1
          })
        })
        const popularTags = Object.entries(tagCount)
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        // 保存到缓存
        await db.collection('review_stats').doc(menuItemId).set({
          data: {
            menu_item_id: menuItemId,
            avg_rating: parseFloat(avgRating),
            total_count: reviews.data.length,
            rating_distribution: ratingDist,
            popular_tags: popularTags,
            updated_at: new Date()
          }
        })

        return {
          success: true,
          data: {
            menu_item_id: menuItemId,
            avg_rating: parseFloat(avgRating),
            total_count: reviews.data.length,
            rating_distribution: ratingDist,
            popular_tags: popularTags
          }
        }
      }

      case 'delete': {
        // 删除评价
        const { reviewId } = event

        const review = await db.collection('reviews').doc(reviewId).get()

        if (!review.data) {
          throw new Error('评价不存在')
        }

        if (review.data.user_openid !== wxContext.OPENID) {
          throw new Error('只能删除自己的评价')
        }

        await db.collection('reviews').doc(reviewId).remove()

        // 更新统计
        await updateReviewStats(review.data.menu_item_id)

        return { success: true }
      }

      default:
        return { success: false, errMsg: '未知的操作类型' }
    }
  } catch (err) {
    return { success: false, errMsg: err.message }
  }
}

// 更新评价统计
async function updateReviewStats(menuItemId) {
  try {
    const reviews = await db.collection('reviews')
      .where({ menu_item_id: menuItemId })
      .get()

    if (reviews.data.length === 0) {
      await db.collection('review_stats').doc(menuItemId).remove()
      return
    }

    // 计算
    const totalRating = reviews.data.reduce((sum, r) => sum + r.rating, 0)
    const avgRating = (totalRating / reviews.data.length).toFixed(1)

    const ratingDist = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
    reviews.data.forEach(r => {
      ratingDist[r.rating]++
    })

    const tagCount = {}
    reviews.data.forEach(r => {
      (r.taste_tags || []).forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1
      })
    })
    const popularTags = Object.entries(tagCount)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // 保存
    await db.collection('review_stats').doc(menuItemId).set({
      data: {
        menu_item_id: menuItemId,
        avg_rating: parseFloat(avgRating),
        total_count: reviews.data.length,
        rating_distribution: ratingDist,
        popular_tags: popularTags,
        updated_at: new Date()
      }
    })
  } catch (err) {
    console.error('更新评价统计失败', err)
  }
}
