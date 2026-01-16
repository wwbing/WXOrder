// pages/profile/edit/index.js
const app = getApp()

Page({
    data: {
        userInfo: null,
        nickname: '',
        avatarUrl: '',
        avatarFileId: '', // Store fileID for cloud storage
        defaultAvatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0U4RThFOCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTUlIiBmb250LXNpemU9IjQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5Ij7nlKg8L3RleHQ+PC9zdmc+'
    },

    async onLoad() {
        const userInfo = app.globalData.userInfo
        if (userInfo) {
            let avatarUrl = this.data.defaultAvatar

            // If user has avatar_url (could be fileID), get temp URL
            if (userInfo.avatar_url) {
                if (userInfo.avatar_url.startsWith('cloud://')) {
                    // It's a fileID, get temp URL
                    try {
                        const res = await wx.cloud.getTempFileURL({
                            fileList: [userInfo.avatar_url]
                        })
                        if (res.fileList[0].tempFileURL) {
                            avatarUrl = res.fileList[0].tempFileURL
                        }
                    } catch (err) {
                        console.error('Get temp URL error:', err)
                    }
                } else {
                    // It's already a URL
                    avatarUrl = userInfo.avatar_url
                }
            }

            this.setData({
                userInfo,
                nickname: userInfo.nickname || '',
                avatarUrl: avatarUrl,
                avatarFileId: userInfo.avatar_url || ''
            })
        }
    },

    onNicknameInput(e) {
        this.setData({ nickname: e.detail.value })
    },

    async onChooseAvatar() {
        try {
            const res = await wx.chooseImage({
                count: 1,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera']
            })

            const tempFilePath = res.tempFilePaths[0]

            wx.showLoading({ title: '上传中...' })

            // Upload to cloud storage
            const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
            const uploadRes = await wx.cloud.uploadFile({
                cloudPath,
                filePath: tempFilePath
            })

            if (uploadRes.fileID) {
                // Get temp URL for preview
                const tempUrlRes = await wx.cloud.getTempFileURL({
                    fileList: [uploadRes.fileID]
                })

                wx.hideLoading()

                if (tempUrlRes.fileList[0].tempFileURL) {
                    this.setData({
                        avatarUrl: tempUrlRes.fileList[0].tempFileURL,
                        avatarFileId: uploadRes.fileID  // Save fileID
                    })
                    wx.showToast({ title: '头像已选择', icon: 'success' })
                }
            } else {
                wx.hideLoading()
                wx.showToast({ title: '上传失败', icon: 'none' })
            }
        } catch (err) {
            wx.hideLoading()
            console.error('Choose avatar error:', err)
            if (err.errMsg && !err.errMsg.includes('cancel')) {
                wx.showToast({ title: '选择头像失败', icon: 'none' })
            }
        }
    },

    async onSubmit() {
        const { nickname, avatarFileId } = this.data

        if (!nickname.trim()) {
            wx.showToast({ title: '请输入昵称', icon: 'none' })
            return
        }

        try {
            wx.showLoading({ title: '保存中...' })

            const res = await wx.cloud.callFunction({
                name: 'auth',
                data: {
                    action: 'updateUserProfile',
                    nickname: nickname.trim(),
                    avatarUrl: avatarFileId  // Save fileID to database
                }
            })

            wx.hideLoading()

            if (res.result.success) {
                // Update global data with fileID
                const updatedUser = {
                    ...app.globalData.userInfo,
                    nickname: nickname.trim(),
                    avatar_url: avatarFileId
                }
                app.globalData.userInfo = updatedUser

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
            console.error('Update profile error:', err)
            wx.showToast({ title: '保存失败', icon: 'none' })
        }
    }
})
