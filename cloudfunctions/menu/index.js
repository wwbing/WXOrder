// 云函数：菜单管理
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

  // 获取用户家庭ID
  // 获取用户的厨房ID - 全局模式：所有用户共享同一厨房
  async function getUserFamilyId() {
    // 固定返回全局厨房ID，所有用户共享数据
    return 'global_home'
  }

  try {
    switch (action) {
      // ========== 分类相关 ==========

      case 'getCategories': {
        // 获取分类列表
        const familyId = await getUserFamilyId()

        const categoriesRes = await db.collection('menu_categories')
          .where({
            family_id: familyId,
            is_active: true
          })
          .orderBy('sort_order', 'asc')
          .get()

        return { success: true, data: categoriesRes.data }
      }

      case 'createCategory': {
        // 前端直接传递参数，所以从 event 中获取
        const { name, color } = event
        const familyId = await getUserFamilyId()
        await validateUserFamily(familyId)

        // 获取最大排序
        const maxSortRes = await db.collection('menu_categories')
          .where({ family_id: familyId })
          .orderBy('sort_order', 'desc')
          .limit(1)
          .get()

        const maxSort = maxSortRes.data.length > 0 ? maxSortRes.data[0].sort_order : 0

        const res = await db.collection('menu_categories').add({
          data: {
            family_id: familyId,
            name: name,
            color: color || '#07c160',
            sort_order: maxSort + 1,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          }
        })

        return { success: true, data: { _id: res._id } }
      }

      case 'updateCategory': {
        const { categoryId, name, color, sortOrder } = event
        const familyId = await getUserFamilyId()
        const category = await db.collection('menu_categories').doc(categoryId).get()
        await validateUserFamily(category.data.family_id)

        const updateData = { updated_at: new Date() }
        if (name) updateData.name = name
        if (color) updateData.color = color
        if (sortOrder !== undefined) updateData.sort_order = sortOrder

        await db.collection('menu_categories').doc(categoryId).update({ data: updateData })
        return { success: true }
      }

      case 'deleteCategory': {
        const { categoryId } = event
        const familyId = await getUserFamilyId()
        const category = await db.collection('menu_categories').doc(categoryId).get()
        await validateUserFamily(category.data.family_id)

        // 删除该分类下的所有菜品
        await db.collection('menu_items')
          .where({
            category_id: categoryId,
            family_id: familyId
          })
          .update({
            data: { is_available: false, updated_at: new Date() }
          })

        // 标记分类为非活跃
        await db.collection('menu_categories').doc(categoryId).update({
          data: { is_active: false, updated_at: new Date() }
        })

        return { success: true }
      }

      // ========== 菜品相关 ==========

      case 'getItems': {
        // 获取菜品列表
        const familyId = await getUserFamilyId()
        const { categoryId, keyword } = event

        let query = db.collection('menu_items').where({
          family_id: familyId,
          is_available: true
        })

        if (categoryId) {
          query = query.where({ category_id: categoryId })
        }

        if (keyword) {
          query = query.where({
            name: db.RegExp({
              regexp: keyword,
              options: 'i'
            })
          })
        }

        const itemsRes = await query
          .orderBy('category_id', 'asc')
          .orderBy('sort_order', 'asc')
          .get()

        return { success: true, data: itemsRes.data }
      }

      case 'getItemDetail': {
        const { itemId } = event
        const item = await db.collection('menu_items').doc(itemId).get()

        if (!item.data) {
          throw new Error('菜品不存在')
        }

        return { success: true, data: item.data }
      }

      case 'createItem': {
        const { name, price, imageUrl, description, categoryId } = event
        const familyId = await getUserFamilyId()
        await validateUserFamily(familyId)

        // 获取最大排序
        const maxSortRes = await db.collection('menu_items')
          .where({
            family_id: familyId,
            category_id: categoryId
          })
          .orderBy('sort_order', 'desc')
          .limit(1)
          .get()

        const maxSort = maxSortRes.data.length > 0 ? maxSortRes.data[0].sort_order : 0

        const res = await db.collection('menu_items').add({
          data: {
            family_id: familyId,
            category_id: categoryId,
            name: name,
            price: Math.round(price * 100), // 转为分
            image_url: imageUrl || '',
            description: description || '',
            is_available: true,
            is_recommended: false,
            sort_order: maxSort + 1,
            created_at: new Date(),
            updated_at: new Date()
          }
        })

        return { success: true, data: { _id: res._id } }
      }

      case 'updateItem': {
        const { itemId, name, price, imageUrl, description, isAvailable, isRecommended, categoryId } = event
        const familyId = await getUserFamilyId()
        const item = await db.collection('menu_items').doc(itemId).get()
        await validateUserFamily(item.data.family_id)

        const updateData = { updated_at: new Date() }
        if (name) updateData.name = name
        if (price !== undefined) updateData.price = Math.round(price * 100)
        if (imageUrl !== undefined) updateData.image_url = imageUrl
        if (description !== undefined) updateData.description = description
        if (isAvailable !== undefined) updateData.is_available = isAvailable
        if (isRecommended !== undefined) updateData.is_recommended = isRecommended
        if (categoryId) updateData.category_id = categoryId

        await db.collection('menu_items').doc(itemId).update({ data: updateData })
        return { success: true }
      }

      case 'deleteItem': {
        const { itemId } = event
        const familyId = await getUserFamilyId()
        const item = await db.collection('menu_items').doc(itemId).get()
        await validateUserFamily(item.data.family_id)

        await db.collection('menu_items').doc(itemId).update({
          data: { is_available: false, updated_at: new Date() }
        })

        return { success: true }
      }

      case 'toggleRecommend': {
        const { itemId, isRecommended } = event
        const familyId = await getUserFamilyId()
        const item = await db.collection('menu_items').doc(itemId).get()
        await validateUserFamily(item.data.family_id)

        // 清除同分类的其他推荐
        if (isRecommended) {
          await db.collection('menu_items').where({
            family_id: familyId,
            category_id: item.data.category_id,
            is_recommended: true
          }).update({
            data: { is_recommended: false, updated_at: new Date() }
          })
        }

        await db.collection('menu_items').doc(itemId).update({
          data: { is_recommended: isRecommended, updated_at: new Date() }
        })

        return { success: true }
      }

      case 'getRecommended': {
        const familyId = await getUserFamilyId()

        const recommendedRes = await db.collection('menu_items')
          .where({
            family_id: familyId,
            is_recommended: true,
            is_available: true
          })
          .limit(10)
          .get()

        return { success: true, data: recommendedRes.data }
      }

      case 'getAllCategoriesWithItems': {
        // 获取所有分类及其下的菜品
        const familyId = await getUserFamilyId()

        // 获取分类
        const categoriesRes = await db.collection('menu_categories')
          .where({
            family_id: familyId,
            is_active: true
          })
          .orderBy('sort_order', 'asc')
          .get()

        // 获取所有上架的菜品
        const itemsRes = await db.collection('menu_items')
          .where({
            family_id: familyId,
            is_available: true
          })
          .get()

        // 关联数据
        const categories = categoriesRes.data
        const items = itemsRes.data

        // 批量获取图片临时URL
        const fileList = items
          .filter(item => item.image_url && item.image_url.startsWith('cloud://'))
          .map(item => item.image_url)

        let tempUrlMap = {}
        if (fileList.length > 0) {
          try {
            // 每次最多获取50个，这里假设不超过限制，或者简单分批
            const urlRes = await cloud.getTempFileURL({ fileList })
            urlRes.fileList.forEach(file => {
              if (file.tempFileURL) {
                tempUrlMap[file.fileID] = file.tempFileURL
              }
            })
          } catch (err) {
            console.error('Get menu images temp URLs error:', err)
          }
        }

        const result = categories.map(cat => ({
          ...cat,
          items: items
            .filter(item => item.category_id === cat._id)
            .map(item => ({
              ...item,
              image_temp_url: tempUrlMap[item.image_url] || ''
            }))
        }))

        return { success: true, data: result }
      }

      default:
        return { success: false, errMsg: '未知的操作类型' }
    }
  } catch (err) {
    return { success: false, errMsg: err.message }
  }
}
