// pages/kitchen/edit/index.js
const app = getApp()

const DEFAULT_BG = 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'
const DEFAULT_AVATAR = '/images/icon-kitchen-active.png'

Page({
    data: {
        defaultBg: DEFAULT_BG,
        defaultAvatar: DEFAULT_AVATAR,
        kitchenInfo: {
            bgImage: '',
            bgFileId: '',  // 云存储 fileID
            avatar: '',
            avatarFileId: '',
            name: '我的厨房',
            description: '世间万物，唯有美食不可辜负'
        },
        uploading: false
    },

    async onLoad() {
        await this.loadKitchenInfo()
    },

    async loadKitchenInfo() {
        try {
            // 从云端加载厨房信息
            const res = await wx.cloud.callFunction({
                name: 'kitchen',
                data: { action: 'getKitchen' }
            })

            if (res.result.success && res.result.data) {
                const kitchen = res.result.data

                // 如果有云存储背景图，获取临时 URL
                let bgImage = this.data.defaultBg
                if (kitchen.bg_file_id && kitchen.bg_file_id.startsWith('cloud://')) {
                    try {
                        const urlRes = await wx.cloud.getTempFileURL({
                            fileList: [kitchen.bg_file_id]
                        })
                        if (urlRes.fileList[0].tempFileURL) {
                            bgImage = urlRes.fileList[0].tempFileURL
                        }
                    } catch (err) {
                        console.error('Get bg temp URL error:', err)
                    }
                }

                // 如果有云存储头像，获取临时 URL
                let avatar = this.data.defaultAvatar
                if (kitchen.avatar_file_id && kitchen.avatar_file_id.startsWith('cloud://')) {
                    try {
                        const urlRes = await wx.cloud.getTempFileURL({
                            fileList: [kitchen.avatar_file_id]
                        })
                        if (urlRes.fileList[0].tempFileURL) {
                            avatar = urlRes.fileList[0].tempFileURL
                        }
                    } catch (err) {
                        console.error('Get avatar temp URL error:', err)
                    }
                }

                this.setData({
                    kitchenInfo: {
                        bgImage: bgImage,
                        bgFileId: kitchen.bg_file_id || '',
                        avatar: avatar,
                        avatarFileId: kitchen.avatar_file_id || '',
                        name: kitchen.name || '我的厨房',
                        description: kitchen.description || '世间万物，唯有美食不可辜负'
                    }
                })
            } else {
                // 使用默认值
                this.setData({
                    'kitchenInfo.bgImage': DEFAULT_BG
                })
            }
        } catch (err) {
            console.error('Load kitchen info error:', err)
            this.setData({
                'kitchenInfo.bgImage': DEFAULT_BG
            })
        }
    },

    // 更换头像
    async chooseAvatar() {
        try {
            const res = await wx.chooseMedia({
                count: 1,
                mediaType: ['image'],
                sourceType: ['album', 'camera']
            })

            const tempFilePath = res.tempFiles[0].tempFilePath

            // 先显示预览
            this.setData({
                'kitchenInfo.avatar': tempFilePath,
                uploading: true
            })

            // 上传到云存储
            wx.showLoading({ title: '上传中...' })

            const cloudPath = `kitchens/avatar_${Date.now()}.jpg`
            const uploadRes = await wx.cloud.uploadFile({
                cloudPath,
                filePath: tempFilePath
            })

            wx.hideLoading()

            if (uploadRes.fileID) {
                this.setData({
                    'kitchenInfo.avatarFileId': uploadRes.fileID,
                    uploading: false
                })
                wx.showToast({ title: '头像已更换', icon: 'success' })
            }
        } catch (err) {
            wx.hideLoading()
            this.setData({ uploading: false })
            console.error('Choose avatar error:', err)
            if (err.errMsg && !err.errMsg.includes('cancel')) {
                wx.showToast({ title: '上传失败', icon: 'none' })
            }
        }
    },

    // 更换背景
    async chooseBgImage() {
        try {
            const res = await wx.chooseMedia({
                count: 1,
                mediaType: ['image'],
                sourceType: ['album', 'camera']
            })

            const tempFilePath = res.tempFiles[0].tempFilePath

            // 先显示预览
            this.setData({
                'kitchenInfo.bgImage': tempFilePath,
                uploading: true
            })

            // 上传到云存储
            wx.showLoading({ title: '上传中...' })

            const cloudPath = `kitchens/bg_${Date.now()}.jpg`
            const uploadRes = await wx.cloud.uploadFile({
                cloudPath,
                filePath: tempFilePath
            })

            wx.hideLoading()

            if (uploadRes.fileID) {
                this.setData({
                    'kitchenInfo.bgFileId': uploadRes.fileID,
                    uploading: false
                })
                wx.showToast({ title: '上传成功', icon: 'success' })
            }
        } catch (err) {
            wx.hideLoading()
            this.setData({ uploading: false })
            console.error('Choose bg error:', err)
            if (err.errMsg && !err.errMsg.includes('cancel')) {
                wx.showToast({ title: '上传失败', icon: 'none' })
            }
        }
    },

    onNameInput(e) {
        this.setData({
            'kitchenInfo.name': e.detail.value
        })
    },

    onDescInput(e) {
        this.setData({
            'kitchenInfo.description': e.detail.value
        })
    },

    // 保存到云端
    async savekitchenInfo() {
        const { name, description, bgFileId, avatarFileId } = this.data.kitchenInfo

        if (!name.trim()) {
            wx.showToast({ title: '请输入厨房名称', icon: 'none' })
            return
        }

        try {
            wx.showLoading({ title: '保存中...' })

            const res = await wx.cloud.callFunction({
                name: 'kitchen',
                data: {
                    action: 'updateKitchen',
                    name: name.trim(),
                    description: description.trim(),
                    bgFileId: bgFileId,
                    avatarFileId: avatarFileId
                }
            })

            wx.hideLoading()

            if (res.result.success) {
                // 同时保存到本地缓存（用于快速加载）
                wx.setStorageSync('kitchenInfo', {
                    name: name.trim(),
                    description: description.trim()
                })

                wx.showToast({
                    title: '保存成功',
                    icon: 'success',
                    duration: 1500
                })

                setTimeout(() => {
                    wx.navigateBack()
                }, 1500)
            } else {
                wx.showToast({ title: res.result.errMsg || '保存失败', icon: 'none' })
            }
        } catch (err) {
            wx.hideLoading()
            console.error('Save kitchen error:', err)
            wx.showToast({ title: '保存失败', icon: 'none' })
        }
    }
})
