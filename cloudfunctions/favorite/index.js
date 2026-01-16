// 云函数：收藏管理
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event

  // 验证用户是否属于该家庭
  async function validateUserFamily(familyId) {
    const userRes = await db.collection('users').where({
      openid: wxContext.OPENID,
      family_id: familyId
    }).get()

    if (userRes.data.length === 0) {
      throw new Error('您不属于该家庭')
    }
    return userRes.data[0]
  }

  try {
    switch (action) {
      case 'list': {
        // 获取我的收藏列表
        const { familyId, page = 1, pageSize = 20 } = event

        // 验证用户
        await validateUserFamily(familyId)

        // 查询收藏
        const favoritesRes = await db.collection('favorites')
          .where({
            user_openid: wxContext.OPENID,
            family_id: familyId
          })
          .orderBy('created_at', 'desc')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get()

        if (favoritesRes.data.length === 0) {
          return { success: true, data: { list: [], total: 0 } }
        }

        // 获取菜品详情
        const itemIds = favoritesRes.data.map(f => f.menu_item_id)
        const itemsRes = await db.collection('menu_items')
          .where({
            _id: _.in(itemIds),
            is_available: true
          })
          .get()

        // 关联数据
        const itemMap = {}
        itemsRes.data.forEach(item => {
          itemMap[item._id] = item
        })

        const list = favoritesRes.data.map(fav => ({
          ...fav,
          menu_item: itemMap[fav.menu_item_id] || null
        }))

        // 获取总数
        const totalRes = await db.collection('favorites')
          .where({
            user_openid: wxContext.OPENID,
            family_id: familyId
          })
          .count()

        return {
          success: true,
          data: {
            list,
            total: totalRes.total
          }
        }
      }

      case 'add': {
        // 添加收藏
        const { menuItemId, familyId: addFamilyId } = event

        // 验证用户
        await validateUserFamily(addFamilyId)

        // 验证菜品是否存在
        const itemRes = await db.collection('menu_items').doc(menuItemId).get()
        if (!itemRes.data) {
          throw new Error('菜品不存在')
        }

        // 检查是否已收藏
        const existingRes = await db.collection('favorites').where({
          user_openid: wxContext.OPENID,
          menu_item_id: menuItemId
        }).get()

        if (existingRes.data.length > 0) {
          throw new Error('您已收藏该菜品')
        }

        // 添加收藏
        await db.collection('favorites').add({
          data: {
            user_openid: wxContext.OPENID,
            menu_item_id: menuItemId,
            family_id: addFamilyId,
            created_at: new Date()
          }
        })

        return { success: true }
      }

      case 'remove': {
        // 取消收藏
        const { menuItemId: removeItemId } = event

        await db.collection('favorites').where({
          user_openid: wxContext.OPENID,
          menu_item_id: removeItemId
        }).remove()

        return { success: true }
      }

      case 'check': {
        // 检查是否已收藏
        const { menuItemId: checkItemId } = event

        const checkRes = await db.collection('favorites').where({
          user_openid: wxContext.OPENID,
          menu_item_id: checkItemId
        }).get()

        return {
          success: true,
          data: {
            isFavorited: checkRes.data.length > 0
          }
        }
      }

      case 'batchCheck': {
        // 批量检查收藏状态
        const { menuItemIds } = event

        const batchCheckRes = await db.collection('favorites')
          .where({
            user_openid: wxContext.OPENID,
            menu_item_id: _.in(menuItemIds)
          })
          .get()

        const favoritedIds = batchCheckRes.data.map(f => f.menu_item_id)

        return {
          success: true,
          data: {
            favoritedIds
          }
        }
      }

      case 'getFavoriteCount': {
        // 获取菜品被收藏次数
        const { menuItemId: countItemId } = event

        const countRes = await db.collection('favorites')
          .where({
            menu_item_id: countItemId
          })
          .count()

        return {
          success: true,
          data: {
            count: countRes.total
          }
        }
      }

      default:
        return { success: false, errMsg: '未知的操作类型' }
    }
  } catch (err) {
    return { success: false, errMsg: err.message }
  }
}
