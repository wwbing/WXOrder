// 云函数：厨房信息管理
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext()
    const { action } = event

    try {
        switch (action) {
            case 'getKitchen': {
                // 获取全局厨房信息
                const kitchenRes = await db.collection('kitchens').where({
                    family_id: 'global_home'
                }).get()

                let kitchenData = null

                if (kitchenRes.data.length > 0) {
                    kitchenData = kitchenRes.data[0]
                } else {
                    // 自动创建初始记录
                    const defaultKitchen = {
                        family_id: 'global_home',
                        name: '我的厨房',
                        description: '世间万物，唯有美食不可辜负',
                        bg_file_id: '',
                        avatar_file_id: '',
                        created_at: db.serverDate(),
                        updated_at: db.serverDate()
                    }

                    const addRes = await db.collection('kitchens').add({
                        data: defaultKitchen
                    })

                    kitchenData = {
                        ...defaultKitchen,
                        _id: addRes._id
                    }
                }

                // 在云端获取背景图临时URL
                if (kitchenData.bg_file_id && kitchenData.bg_file_id.startsWith('cloud://')) {
                    try {
                        const urlRes = await cloud.getTempFileURL({
                            fileList: [kitchenData.bg_file_id]
                        })
                        if (urlRes.fileList && urlRes.fileList[0].tempFileURL) {
                            kitchenData.bg_temp_url = urlRes.fileList[0].tempFileURL
                        }
                    } catch (err) {
                        console.error('Get bg temp URL error:', err)
                    }
                }

                // 在云端获取头像临时URL
                if (kitchenData.avatar_file_id && kitchenData.avatar_file_id.startsWith('cloud://')) {
                    try {
                        const urlRes = await cloud.getTempFileURL({
                            fileList: [kitchenData.avatar_file_id]
                        })
                        if (urlRes.fileList && urlRes.fileList[0].tempFileURL) {
                            kitchenData.avatar_temp_url = urlRes.fileList[0].tempFileURL
                        }
                    } catch (err) {
                        console.error('Get avatar temp URL error:', err)
                    }
                }

                return { success: true, data: kitchenData }
            }

            case 'updateKitchen': {
                // 更新厨房信息
                const { name, description, bgFileId, avatarFileId } = event

                // 检查是否已存在
                const kitchenRes = await db.collection('kitchens').where({
                    family_id: 'global_home'
                }).get()

                const updateData = {
                    name: name || '我的厨房',
                    description: description || '',
                    updated_at: db.serverDate()
                }

                if (bgFileId) {
                    updateData.bg_file_id = bgFileId
                }

                if (avatarFileId) {
                    updateData.avatar_file_id = avatarFileId
                }

                if (kitchenRes.data.length > 0) {
                    // 更新现有记录
                    await db.collection('kitchens').doc(kitchenRes.data[0]._id).update({
                        data: updateData
                    })
                } else {
                    // 创建新记录
                    await db.collection('kitchens').add({
                        data: {
                            family_id: 'global_home',
                            ...updateData,
                            created_at: db.serverDate()
                        }
                    })
                }

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
