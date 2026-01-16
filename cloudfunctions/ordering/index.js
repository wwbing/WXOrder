// 云函数：点餐管理
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// 截止时间选项（分钟）
const DEADLINE_OPTIONS = [15, 30, 45, 60, 90, 120]

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

  // 验证会话
  async function getSession(sessionId) {
    const sessionRes = await db.collection('dining_sessions').doc(sessionId).get()
    if (!sessionRes.data) {
      throw new Error('会话不存在')
    }
    return sessionRes.data
  }

  try {
    switch (action) {
      case 'createSession': {
        // 创建点餐会话
        const user = await getUser()
        const { title, deadlineMinutes } = event

        // 检查是否有进行中的会话
        const existingSession = await db.collection('dining_sessions')
          .where({
            family_id: user.family_id,
            status: 'active'
          })
          .get()

        if (existingSession.data.length > 0) {
          throw new Error('当前已有进行中的点餐，请先完成或取消')
        }

        // 计算截止时间
        const deadline = new Date(Date.now() + (deadlineMinutes || 60) * 60 * 1000)

        // 创建会话
        const sessionRes = await db.collection('dining_sessions').add({
          data: {
            family_id: user.family_id,
            title: title || '点餐',
            created_by: wxContext.OPENID,
            status: 'active',
            deadline: deadline,
            preset_items: [],
            total_amount: 0,
            order_count: 0,
            created_at: new Date(),
            closed_at: null
          }
        })

        return {
          success: true,
          data: {
            sessionId: sessionRes._id,
            deadline: deadline
          }
        }
      }

      case 'getSession': {
        // 获取会话详情
        const session = await getSession(event.sessionId)
        return { success: true, data: session }
      }

      case 'getActiveSession': {
        // 获取当前进行中的会话
        const { familyId } = event

        const activeRes = await db.collection('dining_sessions')
          .where({
            family_id: familyId,
            status: 'active'
          })
          .get()

        if (activeRes.data.length === 0) {
          return { success: true, data: null }
        }

        return { success: true, data: activeRes.data[0] }
      }

      case 'getSessionList': {
        // 获取会话列表
        const { familyId, status, page = 1, pageSize = 10 } = event

        let query = db.collection('dining_sessions')
          .where({
            family_id: familyId
          })

        if (status) {
          query = query.where({ status })
        }

        const sessionsRes = await query
          .orderBy('created_at', 'desc')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get()

        const totalRes = await db.collection('dining_sessions')
          .where({ family_id: familyId })
          .count()

        return {
          success: true,
          data: {
            list: sessionsRes.data,
            total: totalRes.total
          }
        }
      }

      case 'closeSession': {
        // 关闭会话（生成订单）
        const session = await getSession(event.sessionId)

        if (session.status !== 'active') {
          throw new Error('会话已关闭')
        }

        if (session.created_by !== wxContext.OPENID) {
          throw new Error('只有发起人可以关闭会话')
        }

        // 获取所有选择
        const selectionsRes = await db.collection('order_selections')
          .where({ session_id: event.sessionId })
          .get()

        // 计算总金额
        let totalAmount = 0
        selectionsRes.data.forEach(sel => {
          totalAmount += sel.subtotal
        })

        // 生成订单
        let orderId = null
        if (selectionsRes.data.length > 0) {
          try {
            const orderRes = await wx.cloud.callFunction({
              name: 'order',
              data: {
                action: 'generateFromSession',
                sessionId: event.sessionId,
                familyId: session.family_id,
                title: session.title
              }
            })
            if (orderRes.result && orderRes.result.success) {
              orderId = orderRes.result.data.orderId
            }
          } catch (err) {
            console.error('生成订单失败', err)
          }
        }

        // 更新会话状态
        await db.collection('dining_sessions').doc(event.sessionId).update({
          data: {
            status: 'closed',
            total_amount: totalAmount,
            order_count: selectionsRes.data.length,
            closed_at: new Date(),
            order_id: orderId
          }
        })

        return {
          success: true,
          data: {
            totalAmount,
            orderCount: selectionsRes.data.length,
            orderId
          }
        }
      }

      case 'cancelSession': {
        // 取消会话
        const session = await getSession(event.sessionId)

        if (session.status !== 'active') {
          throw new Error('只能取消进行中的会话')
        }

        if (session.created_by !== wxContext.OPENID) {
          throw new Error('只有发起人可以取消会话')
        }

        // 删除所有选择
        await db.collection('order_selections')
          .where({ session_id: event.sessionId })
          .remove()

        // 删除会话
        await db.collection('dining_sessions').doc(event.sessionId).remove()

        return { success: true }
      }

      case 'getSelections': {
        // 获取会话的所有选择
        const { sessionId } = event

        const selectionsRes = await db.collection('order_selections')
          .where({ session_id: sessionId })
          .get()

        // 获取菜品详情
        const allItems = []
        selectionsRes.data.forEach(sel => {
          sel.items.forEach(item => {
            allItems.push(item.menu_item_id)
          })
        })

        const itemsRes = await db.collection('menu_items')
          .where({
            _id: _.in(allItems)
          })
          .get()

        const itemMap = {}
        itemsRes.data.forEach(item => {
          itemMap[item._id] = item
        })

        // 关联菜品详情
        const selectionsWithDetails = selectionsRes.data.map(sel => ({
          ...sel,
          items: sel.items.map(item => ({
            ...item,
            menu_item: itemMap[item.menu_item_id] || null
          }))
        }))

        // 汇总统计
        const summary = {}
        let totalQuantity = 0
        let totalAmount = 0

        selectionsWithDetails.forEach(sel => {
          sel.items.forEach(item => {
            if (!summary[item.menu_item_id]) {
              summary[item.menu_item_id] = {
                item: itemMap[item.menu_item_id] || null,
                totalQuantity: 0,
                totalAmount: 0
              }
            }
            summary[item.menu_item_id].totalQuantity += item.quantity
            summary[item.menu_item_id].totalAmount += item.quantity * item.menu_item_price
            totalQuantity += item.quantity
            totalAmount += sel.subtotal
          })
        })

        return {
          success: true,
          data: {
            selections: selectionsWithDetails,
            summary: Object.values(summary),
            totalQuantity,
            totalAmount
          }
        }
      }

      case 'submitSelection': {
        // 提交/更新选择
        const user = await getUser()
        const { sessionId, items, note } = event

        // 验证会话
        const session = await getSession(sessionId)
        if (session.status !== 'active') {
          throw new Error('会话已关闭')
        }

        // 检查是否过期
        if (new Date(session.deadline) < new Date()) {
          throw new Error('已超过截止时间')
        }

        // 计算小计
        let subtotal = 0
        const itemsWithPrice = await Promise.all(items.map(async (item) => {
          const itemRes = await db.collection('menu_items').doc(item.menu_item_id).get()
          const price = itemRes.data?.price || 0
          const itemTotal = price * item.quantity
          subtotal += itemTotal
          return {
            ...item,
            menu_item_name: itemRes.data?.name || '',
            menu_item_price: price,
            itemTotal
          }
        }))

        // 检查是否已有选择
        const existingRes = await db.collection('order_selections')
          .where({
            session_id: sessionId,
            user_openid: wxContext.OPENID
          })
          .get()

        if (existingRes.data.length > 0) {
          // 更新
          await db.collection('order_selections').doc(existingRes.data[0]._id).update({
            data: {
              items: itemsWithPrice,
              subtotal: subtotal,
              note: note || '',
              updated_at: new Date()
            }
          })
        } else {
          // 新增
          await db.collection('order_selections').add({
            data: {
              session_id: sessionId,
              user_openid: wxContext.OPENID,
              user_name: user.nickname,
              user_avatar: user.avatar_url,
              items: itemsWithPrice,
              subtotal: subtotal,
              note: note || '',
              created_at: new Date(),
              updated_at: new Date()
            }
          })
        }

        return { success: true, data: { subtotal } }
      }

      case 'getMySelection': {
        // 获取我的选择
        const { sessionId } = event

        const selectionRes = await db.collection('order_selections')
          .where({
            session_id: sessionId,
            user_openid: wxContext.OPENID
          })
          .get()

        if (selectionRes.data.length === 0) {
          return { success: true, data: null }
        }

        return { success: true, data: selectionRes.data[0] }
      }

      case 'deleteSelection': {
        // 删除我的选择
        const { sessionId } = event

        await db.collection('order_selections')
          .where({
            session_id: sessionId,
            user_openid: wxContext.OPENID
          })
          .remove()

        return { success: true }
      }

      case 'getDeadlineOptions': {
        // 获取截止时间选项
        return {
          success: true,
          data: DEADLINE_OPTIONS.map(minutes => ({
            value: minutes,
            label: minutes < 60 ? `${minutes}分钟后` : `${Math.floor(minutes / 60)}小时后`
          }))
        }
      }

      default:
        return { success: false, errMsg: '未知的操作类型' }
    }
  } catch (err) {
    return { success: false, errMsg: err.message }
  }
}
