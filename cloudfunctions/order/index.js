// 云函数：订单管理
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event

  try {
    switch (action) {
      case 'createOrder': {
        // 创建订单
        const { items, totalPrice } = event

        if (!items || items.length === 0) {
          return { success: false, errMsg: '订单不能为空' }
        }

        // 获取用户信息
        const userRes = await db.collection('users').where({
          openid: wxContext.OPENID
        }).get()

        if (userRes.data.length === 0) {
          return { success: false, errMsg: '用户不存在' }
        }

        const user = userRes.data[0]

        // 创建订单
        const orderRes = await db.collection('orders').add({
          data: {
            family_id: user.family_id || 'global_home',
            user_id: user._id,
            created_by: {
              _id: user._id,
              nickname: user.nickname,
              avatar_url: user.avatar_url
            },
            items: items,
            total_price: totalPrice,
            status: 'pending', // pending, cooking, ready, completed
            created_at: new Date(),
            updated_at: new Date(),
            praise: {},  // 使用空对象而不是 null
            review: {}   // 使用空对象而不是 null
          }
        })

        return {
          success: true,
          data: {
            orderId: orderRes._id
          }
        }
      }

      case 'getOrders': {
        // 获取订单列表
        const { status, limit = 50 } = event

        // 获取用户信息
        const userRes = await db.collection('users').where({
          openid: wxContext.OPENID
        }).get()

        if (userRes.data.length === 0) {
          return { success: false, errMsg: '用户不存在' }
        }

        const user = userRes.data[0]
        const familyId = user.family_id || 'global_home'

        // 构建查询条件
        let query = db.collection('orders').where({
          family_id: familyId
        })

        if (status) {
          query = query.where({ status })
        }

        const ordersRes = await query
          .orderBy('created_at', 'desc')
          .limit(limit)
          .get()

        const orders = ordersRes.data

        // 获取所有涉及用户的头像临时URL
        const userIds = orders.map(o => o.user_id).filter(id => id)
        if (userIds.length > 0) {
          // 获取唯一用户ID
          const uniqueUserIds = [...new Set(userIds)]
          const usersRes = await db.collection('users').where({
            _id: db.command.in(uniqueUserIds)
          }).get()

          const users = usersRes.data
          const fileList = users
            .filter(u => u.avatar_url && u.avatar_url.startsWith('cloud://'))
            .map(u => u.avatar_url)

          let avatarUrlMap = {}
          if (fileList.length > 0) {
            try {
              const urlRes = await cloud.getTempFileURL({ fileList })
              urlRes.fileList.forEach(file => {
                if (file.tempFileURL) {
                  avatarUrlMap[file.fileID] = file.tempFileURL
                }
              })
            } catch (err) {
              console.error('Get order avatar temp URLs error:', err)
            }
          }

          // 将临时头像URL注入订单数据
          for (let order of orders) {
            const orderUser = users.find(u => u._id === order.user_id)
            if (orderUser && orderUser.avatar_url) {
              const tempUrl = avatarUrlMap[orderUser.avatar_url] || orderUser.avatar_url
              // 同步更新 created_by.avatar_url，保证前端显示最新头像
              order.user_avatar = tempUrl
              if (order.created_by) {
                order.created_by.avatar_url = tempUrl
              }
            }
          }
        }

        return {
          success: true,
          data: orders
        }
      }

      case 'updateOrderStatus': {
        // 更新订单状态
        const { orderId, newStatus } = event

        if (!orderId || !newStatus) {
          return { success: false, errMsg: '缺少参数' }
        }

        // 验证状态值
        const validStatuses = ['pending', 'cooking', 'ready', 'completed']
        if (!validStatuses.includes(newStatus)) {
          return { success: false, errMsg: '无效的状态' }
        }

        await db.collection('orders').doc(orderId).update({
          data: {
            status: newStatus,
            updated_at: new Date()
          }
        })

        return { success: true }
      }

      case 'addPraise': {
        // 添加彩虹屁
        const { orderId, praiseText } = event

        if (!orderId || !praiseText) {
          return { success: false, errMsg: '缺少参数' }
        }

        // 获取用户信息
        const userRes = await db.collection('users').where({
          openid: wxContext.OPENID
        }).get()

        if (userRes.data.length === 0) {
          return { success: false, errMsg: '用户不存在' }
        }

        const user = userRes.data[0]

        // 使用 _.set() 或直接赋值，避免在 null 上创建字段的问题
        const res = await db.collection('orders').doc(orderId).update({
          data: {
            praise: {
              user_id: user._id,
              nickname: user.nickname,
              content: praiseText,
              created_at: db.serverDate()
            },
            updated_at: db.serverDate()
          }
        })

        return { success: true }
      }

      case 'addReview': {
        // 添加评价
        const { orderId, rating, comment } = event

        if (!orderId || !rating) {
          return { success: false, errMsg: '缺少参数' }
        }

        const res = await db.collection('orders').doc(orderId).update({
          data: {
            review: {
              rating: rating,
              comment: comment || '',
              created_at: db.serverDate()
            },
            status: 'completed',
            updated_at: db.serverDate()
          }
        })

        return { success: true }
      }

      case 'deleteOrder': {
        // 删除订单（仅大厨可删除）
        const { orderId } = event

        if (!orderId) {
          return { success: false, errMsg: '缺少订单ID' }
        }

        // 验证用户权限
        const userRes = await db.collection('users').where({
          openid: wxContext.OPENID
        }).get()

        if (userRes.data.length === 0) {
          return { success: false, errMsg: '用户不存在' }
        }

        const user = userRes.data[0]
        if (user.role !== 'chef') {
          return { success: false, errMsg: '仅大厨可删除订单' }
        }

        // 删除订单
        await db.collection('orders').doc(orderId).remove()

        return { success: true }
      }

      case 'getStats': {
        // 获取订单统计
        const { familyId } = event

        const userRes = await db.collection('users').where({
          openid: wxContext.OPENID
        }).get()

        if (userRes.data.length === 0) {
          return { success: false, errMsg: '用户不存在' }
        }

        const user = userRes.data[0]
        const targetFamilyId = familyId || user.family_id || 'global_home'

        const allRes = await db.collection('orders').where({
          family_id: targetFamilyId
        }).count()

        const pendingRes = await db.collection('orders').where({
          family_id: targetFamilyId,
          status: 'pending'
        }).count()

        const completedRes = await db.collection('orders').where({
          family_id: targetFamilyId,
          status: 'completed'
        }).count()

        return {
          success: true,
          data: {
            total: allRes.total,
            pending: pendingRes.total,
            completed: completedRes.total
          }
        }
      }

      case 'getDetail': {
        // 获取订单详情
        const { orderId } = event

        if (!orderId) {
          return { success: false, errMsg: '缺少订单ID' }
        }

        const orderRes = await db.collection('orders').doc(orderId).get()

        if (!orderRes.data) {
          return { success: false, errMsg: '订单不存在' }
        }

        // 获取创建者头像的临时URL
        const order = orderRes.data
        if (order.created_by && order.created_by.avatar_url && order.created_by.avatar_url.startsWith('cloud://')) {
          try {
            const urlRes = await wx.cloud.getTempFileURL({
              fileList: [order.created_by.avatar_url]
            })
            if (urlRes.fileList[0].tempFileURL) {
              order.created_by.avatar_url = urlRes.fileList[0].tempFileURL
            }
          } catch (err) {
            console.error('Get creator avatar temp URL error:', err)
          }
        }

        return {
          success: true,
          data: {
            order: order
          }
        }
      }

      case 'markAsPaid': {
        // 标记为已付款
        const { orderId, amount } = event

        if (!orderId) {
          return { success: false, errMsg: '缺少订单ID' }
        }

        await db.collection('orders').doc(orderId).update({
          data: {
            paid_at: new Date(),
            paid_amount: amount,
            updated_at: new Date()
          }
        })

        return { success: true }
      }

      default:
        return { success: false, errMsg: '未知的操作类型' }
    }
  } catch (err) {
    console.error(err)
    return { success: false, errMsg: err.message }
  }
}
