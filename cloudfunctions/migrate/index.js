// 云函数：迁移现有用户到全局厨房
// cloudfunctions/migrate/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
    try {
        // 获取所有用户
        const usersRes = await db.collection('users').get()

        console.log(`找到 ${usersRes.data.length} 个用户`)

        let updatedCount = 0

        // 更新每个用户的 family_id 为 global_home
        for (const user of usersRes.data) {
            await db.collection('users').doc(user._id).update({
                data: {
                    family_id: 'global_home',
                    updated_at: new Date()
                }
            })
            updatedCount++
            console.log(`已更新用户: ${user.nickname} (${user._id})`)
        }

        // 同时更新所有菜品分类的 family_id
        const categoriesRes = await db.collection('menu_categories').get()
        for (const cat of categoriesRes.data) {
            await db.collection('menu_categories').doc(cat._id).update({
                data: {
                    family_id: 'global_home',
                    updated_at: new Date()
                }
            })
        }

        // 更新所有菜品的 family_id
        const itemsRes = await db.collection('menu_items').get()
        for (const item of itemsRes.data) {
            await db.collection('menu_items').doc(item._id).update({
                data: {
                    family_id: 'global_home',
                    updated_at: new Date()
                }
            })
        }

        // 更新所有订单的 family_id
        const ordersRes = await db.collection('orders').get()
        for (const order of ordersRes.data) {
            await db.collection('orders').doc(order._id).update({
                data: {
                    family_id: 'global_home',
                    updated_at: new Date()
                }
            })
        }

        return {
            success: true,
            message: '迁移完成',
            stats: {
                users: updatedCount,
                categories: categoriesRes.data.length,
                items: itemsRes.data.length,
                orders: ordersRes.data.length
            }
        }
    } catch (err) {
        console.error('迁移失败:', err)
        return {
            success: false,
            error: err.message
        }
    }
}
