// pages/menu/add/index.js
Page({
    data: {
        categories: [],
        categoryIndex: 0,

        // Form Data
        name: '',
        description: '',
        imageUrl: '',
        imageFileId: '',  // 云存储 fileID
        price: '',
        isAvailable: true,
        categoryId: '',

        // Edit Mode
        isEditMode: false,
        itemId: '',
        uploading: false
    },

    onLoad(options) {
        this.loadCategories().then(() => {
            if (options.id) {
                this.setData({
                    isEditMode: true,
                    itemId: options.id
                })
                wx.setNavigationBarTitle({ title: '编辑菜谱' })
                this.loadItemData(options.id)
            } else if (options.categoryId) {
                // 从菜单管理页面传来的分类ID
                this.setData({ categoryId: options.categoryId })
            }
        })
    },

    async loadCategories() {
        // Attempt to load from storage first for speed
        let localCats = wx.getStorageSync('categories') || []
        if (localCats.length > 0) {
            this.setData({ categories: localCats })
            if (!this.data.categoryId) {
                this.setData({ categoryId: localCats[0]._id })
            }
        }

        try {
            const res = await wx.cloud.callFunction({
                name: 'menu',
                data: { action: 'getCategories' }
            })
            if (res.result && res.result.success) {
                const categories = res.result.data
                this.setData({ categories })

                // If no ID set and no Edit Mode, set first
                if (!this.data.categoryId && !this.data.isEditMode && categories.length > 0) {
                    this.setData({
                        categoryIndex: 0,
                        categoryId: categories[0]._id
                    })
                }
            }
        } catch (err) {
            console.error('Failed to load categories', err)
        }
    },

    loadItemData(id) {
        // Try local storage first
        const allItems = wx.getStorageSync('items') || []
        const item = allItems.find(i => i._id === id)

        if (item) {
            this.initializeForm(item)
        } else {
            // Fetch from cloud if not found locally (unlikely but possible)
            wx.showLoading({ title: '加载中...' })
            wx.cloud.callFunction({
                name: 'menu',
                data: { action: 'getItem', itemId: id }
            }).then(res => {
                wx.hideLoading()
                if (res.result && res.result.data) {
                    this.initializeForm(res.result.data)
                }
            }).catch(err => {
                wx.hideLoading()
                wx.showToast({ title: '加载失败', icon: 'none' })
            })
        }
    },

    async initializeForm(item) {
        const catIndex = this.data.categories.findIndex(c => c._id === item.categoryId)

        // 如果有图片 fileID，获取临时 URL
        let imageUrl = item.image_url || ''
        let imageFileId = item.image_url || ''

        if (item.image_url && item.image_url.startsWith('cloud://')) {
            try {
                const urlRes = await wx.cloud.getTempFileURL({
                    fileList: [item.image_url]
                })
                if (urlRes.fileList[0].tempFileURL) {
                    imageUrl = urlRes.fileList[0].tempFileURL
                }
            } catch (err) {
                console.error('Get image temp URL error:', err)
            }
        }

        this.setData({
            name: item.name,
            description: item.description || '',
            imageUrl: imageUrl,
            imageFileId: imageFileId,
            price: (item.price / 100).toString(),
            isAvailable: item.is_available !== false,
            categoryId: item.categoryId,
            categoryIndex: catIndex >= 0 ? catIndex : 0
        })
    },

    async onChooseImage() {
        try {
            const res = await wx.chooseImage({
                count: 1,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera']
            })

            const tempFilePath = res.tempFilePaths[0]

            // 先显示预览
            this.setData({
                imageUrl: tempFilePath,
                uploading: true
            })

            // 上传到云存储
            wx.showLoading({ title: '上传中...' })

            const cloudPath = `menu-items/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
            const uploadRes = await wx.cloud.uploadFile({
                cloudPath,
                filePath: tempFilePath
            })

            wx.hideLoading()

            if (uploadRes.fileID) {
                this.setData({
                    imageFileId: uploadRes.fileID,
                    uploading: false
                })
                wx.showToast({ title: '上传成功', icon: 'success' })
            }
        } catch (err) {
            wx.hideLoading()
            this.setData({ uploading: false })
            console.error('Choose image error:', err)
            if (err.errMsg && !err.errMsg.includes('cancel')) {
                wx.showToast({ title: '上传失败', icon: 'none' })
            }
        }
    },

    onCategoryChange(e) {
        const index = e.detail.value
        const cat = this.data.categories[index]
        this.setData({
            categoryIndex: index,
            categoryId: cat._id
        })
    },

    onAvailableChange(e) {
        this.setData({ isAvailable: e.detail.value })
    },

    async onSubmit() {
        const { name, price, imageFileId, description, categoryId, isAvailable, isEditMode, itemId } = this.data

        if (!name) {
            return wx.showToast({ title: '请输入菜谱名称', icon: 'none' })
        }

        wx.showLoading({ title: isEditMode ? '保存中...' : '发布中...' })

        try {
            const action = isEditMode ? 'updateItem' : 'createItem'
            const payload = {
                action,
                name,
                price: parseFloat(price || 0),
                imageUrl: imageFileId,  // 使用云存储 fileID
                description,
                categoryId,
                isAvailable
            }

            if (isEditMode) {
                payload.itemId = itemId
            }

            const res = await wx.cloud.callFunction({
                name: 'menu',
                data: payload
            })

            wx.hideLoading()

            if (res.result && res.result.success) {
                wx.showToast({ title: isEditMode ? '已保存' : '发布成功', icon: 'success' })

                // Navigate back and refresh
                setTimeout(() => {
                    const pages = getCurrentPages()
                    const prevPage = pages[pages.length - 2]
                    if (prevPage && prevPage.loadData) {
                        prevPage.loadData()
                    }
                    wx.navigateBack()
                }, 1500)
            } else {
                throw new Error(res.result?.errMsg || '操作失败')
            }

        } catch (err) {
            wx.hideLoading()
            console.error(err)
            wx.showToast({ title: '操作失败', icon: 'none' })
        }
    }
})
