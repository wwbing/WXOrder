// 云函数：许愿池管理
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

  try {
    switch (action) {
      case 'create': {
        // 创建愿望
        const { title, description } = event
        if (!title || title.trim() === '') {
          return { success: false, errMsg: '请输入愿望名称' }
        }

        const user = await getUser()
        const familyId = user.family_id || 'global_home'

        const res = await db.collection('wishes').add({
          data: {
            family_id: familyId,
            openid: wxContext.OPENID,
            creator_name: user.nickname || '匿名',
            title: title.trim(),
            description: description?.trim() || '',
            status: 'pending', // pending, approved, rejected, implemented
            vote_count: 0,
            voted_by: [],
            remark: '',
            created_at: new Date(),
            updated_at: new Date()
          }
        })

        return { success: true, data: { _id: res._id } }
      }

      case 'getList': {
        // 获取愿望列表
        const { familyId, status, page = 1, pageSize = 20 } = event

        // 获取当前用户
        const user = await getUser()
        const targetFamilyId = familyId || user.family_id || 'global_home'

        let query = db.collection('wishes').where({
          family_id: targetFamilyId
        })

        if (status) {
          query = query.where({ status })
        }

        const res = await query
          .orderBy('created_at', 'desc')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get()

        return { success: true, data: res.data }
      }

      case 'getDetail': {
        // 获取愿望详情
        const { wishId } = event

        const res = await db.collection('wishes').doc(wishId).get()
        if (!res.data) {
          return { success: false, errMsg: '愿望不存在' }
        }

        return { success: true, data: res.data }
      }

      case 'update': {
        // 更新愿望
        const { wishId, title, description, status, remark } = event

        if (!wishId) {
          return { success: false, errMsg: '缺少愿望ID' }
        }

        // 检查愿望是否存在
        const wishRes = await db.collection('wishes').doc(wishId).get()
        if (!wishRes.data) {
          return { success: false, errMsg: '愿望不存在' }
        }

        // 构建更新数据
        const updateData = { updated_at: new Date() }
        if (title !== undefined) updateData.title = title.trim()
        if (description !== undefined) updateData.description = description.trim()
        if (status !== undefined) updateData.status = status
        if (remark !== undefined) updateData.remark = remark.trim()

        await db.collection('wishes').doc(wishId).update({
          data: updateData
        })

        return { success: true }
      }

      case 'delete': {
        // 删除愿望
        const { wishId } = event

        if (!wishId) {
          return { success: false, errMsg: '缺少愿望ID' }
        }

        await db.collection('wishes').doc(wishId).remove()

        return { success: true }
      }

      case 'vote': {
        // 投票/取消投票
        const { wishId } = event

        if (!wishId) {
          return { success: false, errMsg: '缺少愿望ID' }
        }

        const wishRes = await db.collection('wishes').doc(wishId).get()
        if (!wishRes.data) {
          return { success: false, errMsg: '愿望不存在' }
        }

        const wish = wishRes.data
        const votedBy = wish.voted_by || []
        const index = votedBy.indexOf(wxContext.OPENID)

        if (index > -1) {
          // 已投票，取消投票
          votedBy.splice(index, 1)
          await db.collection('wishes').doc(wishId).update({
            data: {
              voted_by: votedBy,
              vote_count: _.inc(-1),
              updated_at: new Date()
            }
          })
          return { success: true, voted: false }
        } else {
          // 未投票，添加投票
          votedBy.push(wxContext.OPENID)
          await db.collection('wishes').doc(wishId).update({
            data: {
              voted_by: votedBy,
              vote_count: _.inc(1),
              updated_at: new Date()
            }
          })
          return { success: true, voted: true }
        }
      }

      case 'batchDelete': {
        // 批量删除
        const { wishIds } = event

        if (!wishIds || !Array.isArray(wishIds) || wishIds.length === 0) {
          return { success: false, errMsg: '缺少愿望ID列表' }
        }

        await db.collection('wishes').where({
          _id: _.in(wishIds)
        }).remove()

        return { success: true }
      }

      case 'getStats': {
        // 获取统计信息
        const user = await getUser()
        const familyId = user.family_id || 'global_home'

        const pendingRes = await db.collection('wishes').where({
          family_id: familyId,
          status: 'pending'
        }).count()

        const implementedRes = await db.collection('wishes').where({
          family_id: familyId,
          status: 'implemented'
        }).count()

        return {
          success: true,
          data: {
            pendingCount: pendingRes.total,
            implementedCount: implementedRes.total
          }
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
