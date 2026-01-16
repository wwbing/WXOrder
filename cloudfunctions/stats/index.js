// 云函数：用户统计
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event

  // 获取用户信息
  async function getUser() {
    const userRes = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get()

    if (userRes.data.length === 0) {
      throw new Error('用户不存在')
    }
    return userRes.data[0]
  }

  // 计算本周开始时间
  function getWeekStart(date = new Date()) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  try {
    switch (action) {
      case 'getWeeklyStats': {
        // 获取本周吃货统计
        const user = await getUser()
        const weekStart = getWeekStart()

        // 1. 获取本周点餐次数
        const selectionsRes = await db.collection('order_selections')
          .where({
            user_openid: wxContext.OPENID,
            created_at: _.gte(weekStart)
          })
          .get()

        const totalMeals = selectionsRes.data.length

        // 2. 统计菜品频次，找出最爱
        const dishCount = {}
        selectionsRes.data.forEach(sel => {
          sel.items.forEach(item => {
            const key = item.menu_item_id
            if (!dishCount[key]) {
              dishCount[key] = {
                id: key,
                name: item.menu_item_name || '',
                count: 0
              }
            }
            dishCount[key].count += item.quantity || 1
          })
        })

        let favDish = '暂无'
        let favDishCount = 0
        if (Object.keys(dishCount).length > 0) {
          const sorted = Object.values(dishCount).sort((a, b) => b.count - a.count)
          favDish = sorted[0]?.name || '暂无'
          favDishCount = sorted[0]?.count || 0
        }

        // 3. 如果是大厨，获取本周收到的彩虹屁数量
        let praiseCount = 0
        if (user.role === 'chef') {
          const familyId = user.family_id || 'global_home'
          const weekOrdersRes = await db.collection('orders')
            .where({
              family_id: familyId,
              created_at: _.gte(weekStart),
              'praise.content': _.exists(true)
            })
            .get()
          praiseCount = weekOrdersRes.data.length
        }

        // 4. 计算本周总消费
        let totalSpent = 0
        selectionsRes.data.forEach(sel => {
          totalSpent += sel.subtotal || 0
        })

        // 5. 获取本周评价数量
        const reviewsRes = await db.collection('reviews')
          .where({
            user_openid: wxContext.OPENID,
            created_at: _.gte(weekStart)
          })
          .get()

        return {
          success: true,
          data: {
            totalMeals,           // 本周总点餐次数
            favDish,              // 本周最爱菜品
            favDishCount,         // 最爱菜品点餐次数
            praiseCount,          // 本周收到的彩虹屁数量
            totalSpent,           // 本周总消费（分）
            reviewCount: reviewsRes.data.length,  // 本周评价数量
            weekStart: weekStart.toISOString()
          }
        }
      }

      case 'getAllTimeStats': {
        // 获取全部历史统计
        const user = await getUser()

        // 1. 获取全部点餐次数
        const selectionsRes = await db.collection('order_selections')
          .where({
            user_openid: wxContext.OPENID
          })
          .get()

        const totalMeals = selectionsRes.data.length

        // 2. 统计菜品频次
        const dishCount = {}
        selectionsRes.data.forEach(sel => {
          sel.items.forEach(item => {
            const key = item.menu_item_id
            if (!dishCount[key]) {
              dishCount[key] = {
                id: key,
                name: item.menu_item_name || '',
                count: 0
              }
            }
            dishCount[key].count += item.quantity || 1
          })
        })

        let favDish = '暂无'
        if (Object.keys(dishCount).length > 0) {
          const sorted = Object.values(dishCount).sort((a, b) => b.count - a.count)
          favDish = sorted[0]?.name || '暂无'
        }

        // 3. 如果是大厨，获取全部彩虹屁数量
        let praiseCount = 0
        if (user.role === 'chef') {
          const familyId = user.family_id || 'global_home'
          const praiseRes = await db.collection('orders')
            .where({
              family_id: familyId,
              'praise.content': _.exists(true)
            })
            .get()
          praiseCount = praiseRes.data.length
        }

        // 4. 计算总消费
        let totalSpent = 0
        selectionsRes.data.forEach(sel => {
          totalSpent += sel.subtotal || 0
        })

        return {
          success: true,
          data: {
            totalMeals,
            favDish,
            praiseCount,
            totalSpent
          }
        }
      }

      case 'getDishStats': {
        // 获取用户最常点的菜品排行榜
        const { limit = 5 } = event

        const selectionsRes = await db.collection('order_selections')
          .where({
            user_openid: wxContext.OPENID
          })
          .get()

        const dishCount = {}
        selectionsRes.data.forEach(sel => {
          sel.items.forEach(item => {
            const key = item.menu_item_id
            if (!dishCount[key]) {
              dishCount[key] = {
                id: key,
                name: item.menu_item_name || '',
                count: 0,
                totalSpent: 0
              }
            }
            dishCount[key].count += item.quantity || 1
            dishCount[key].totalSpent += (item.menu_item_price || 0) * (item.quantity || 1)
          })
        })

        const ranking = Object.values(dishCount)
          .sort((a, b) => b.count - a.count)
          .slice(0, limit)

        return {
          success: true,
          data: ranking
        }
      }

      default:
        return { success: false, errMsg: '未知的操作类型' }
    }
  } catch (err) {
    console.error(err)
    return { success: false, errMsg: err.message }
  }
}
