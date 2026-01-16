// pages/admin/category-manage/index.js
const ITEM_HEIGHT_RPX = 140

Page({
    data: {
        categories: [],
        draggingIndex: -1,
        areaHeight: 0,
        itemHeightPx: 0
    },

    onLoad() {
        this.calculateDimensions()
        this.loadCategories()
    },

    calculateDimensions() {
        const sys = wx.getSystemInfoSync()
        const itemHeightPx = (ITEM_HEIGHT_RPX / 750) * sys.windowWidth
        this.setData({ itemHeightPx })
    },

    async loadCategories() {
        wx.showLoading({ title: '加载中...' })
        try {
            // Cloud First
            const res = await wx.cloud.callFunction({
                name: 'menu',
                data: { action: 'getCategories' }
            })

            if (res.result && res.result.success) {
                let rawCats = res.result.data
                this.updateLocalList(rawCats)
                // Sync to local cache
                wx.setStorageSync('categories', rawCats)
            } else {
                // Fallback
                this.loadFromLocal()
            }
        } catch (err) {
            console.error(err)
            this.loadFromLocal()
        } finally {
            wx.hideLoading()
        }
    },

    loadFromLocal() {
        let rawCats = wx.getStorageSync('categories') || []
        // Fallback Mock
        if (rawCats.length === 0) {
            rawCats = [
                { _id: 'cat1', name: '汤' },
                { _id: 'cat2', name: '炒菜' },
                { _id: 'cat3', name: '主食' }
            ]
            wx.setStorageSync('categories', rawCats)
        }
        this.updateLocalList(rawCats)
    },

    updateLocalList(rawCats) {
        // Add Y position for drag logic
        const categories = rawCats.map((c, i) => ({
            ...c,
            y: i * this.data.itemHeightPx
        }))
        this.setData({
            categories,
            areaHeight: categories.length * ITEM_HEIGHT_RPX
        })
    },

    // --- Sort Logic (Manual Touch) ---

    onDragStart(e) {
        const { index } = e.currentTarget.dataset
        this.startY = e.touches[0].clientY
        this.startTop = this.data.categories[index].y

        this.setData({ draggingIndex: index })
    },

    onDragMove(e) {
        const idx = this.data.draggingIndex
        if (idx === -1) return

        const currentY = e.touches[0].clientY
        const delta = currentY - this.startY
        let newTop = this.startTop + delta

        this.setData({
            [`categories[${idx}].y`]: newTop
        })
    },

    async onDragEnd(e) {
        const idx = this.data.draggingIndex
        if (idx === -1) return

        const itemHeight = this.data.itemHeightPx
        const currentTop = this.data.categories[idx].y
        let targetIdx = Math.round(currentTop / itemHeight)

        if (targetIdx < 0) targetIdx = 0
        if (targetIdx >= this.data.categories.length) targetIdx = this.data.categories.length - 1

        const list = [...this.data.categories]

        if (targetIdx !== idx) {
            // Visual Reorder
            const originalItem = list[idx]
            list.splice(idx, 1)
            list.splice(targetIdx, 0, originalItem)

            // Generate clean list for update
            const cleanList = list.map((c, index) => ({
                ...c,
                sort_order: index + 1 // New sort order
            }))

            this.updateLocalList(cleanList)
            this.setData({ draggingIndex: -1 })

            // Persist Sort Order (Update ALL or just moved? Better update all to be safe)
            // Ideally we should have a batchUpdate API. For now, loop or just update local if API missing.
            // We'll update just the moved one's sort_order? No, that breaks other orders.
            // Let's rely on local storage for immediate sync, and try to update cloud loop generally?
            // Actually, let's just update the ONE item with a new sort order average? No.
            // Efficient way: Loop and update all.
            wx.showLoading({ title: '保存排序...', mask: true })
            try {
                // Update Cloud in parallel
                // Note: Limited concurrency effectively
                const promises = cleanList.map(item => {
                    return wx.cloud.callFunction({
                        name: 'menu',
                        data: {
                            action: 'updateCategory',
                            categoryId: item._id,
                            sortOrder: item.sort_order
                        }
                    })
                })
                await Promise.all(promises)
                wx.setStorageSync('categories', cleanList)
            } catch (e) {
                console.error(e)
            } finally {
                wx.hideLoading()
                wx.showToast({ title: '排序已保存' })
            }

        } else {
            // Snap back
            this.setData({
                draggingIndex: -1,
                [`categories[${idx}].y`]: idx * itemHeight
            })
        }
    },

    // --- Edit / Delete / Add (Cloud Integration) ---

    onEditCategory(e) {
        const { item } = e.currentTarget.dataset
        wx.showModal({
            title: '编辑分类',
            editable: true,
            placeholderText: item.name,
            content: item.name,
            success: async (res) => {
                if (res.confirm && res.content && res.content !== item.name) {
                    wx.showLoading({ title: '保存中...' })
                    try {
                        const cloudRes = await wx.cloud.callFunction({
                            name: 'menu',
                            data: {
                                action: 'updateCategory',
                                categoryId: item._id,
                                name: res.content
                            }
                        })
                        if (cloudRes.result.success) {
                            this.loadCategories() // Reload to refresh
                            wx.showToast({ title: '已修改' })
                        }
                    } catch (err) {
                        wx.showToast({ title: '修改失败', icon: 'none' })
                    } finally {
                        wx.hideLoading()
                    }
                }
            }
        })
    },

    onDeleteCategory(e) {
        const { id } = e.currentTarget.dataset
        wx.showModal({
            title: '删除分类',
            content: '确定删除此分类吗？关联菜品将下架。',
            success: async (res) => {
                if (res.confirm) {
                    wx.showLoading({ title: '删除中...' })
                    try {
                        const cloudRes = await wx.cloud.callFunction({
                            name: 'menu',
                            data: {
                                action: 'deleteCategory',
                                categoryId: id
                            }
                        })
                        if (cloudRes.result.success) {
                            this.loadCategories()
                            wx.showToast({ title: '已删除' })
                        }
                    } catch (err) {
                        wx.showToast({ title: '删除失败', icon: 'none' })
                    } finally {
                        wx.hideLoading()
                    }
                }
            }
        })
    },

    onAddCategory() {
        wx.showModal({
            title: '添加分类',
            editable: true,
            placeholderText: '请输入分类名称',
            success: async (res) => {
                if (res.confirm && res.content) {
                    wx.showLoading({ title: '添加中...' })
                    try {
                        const cloudRes = await wx.cloud.callFunction({
                            name: 'menu',
                            data: {
                                action: 'createCategory',
                                name: res.content,
                                color: '#07c160' // Default color
                            }
                        })
                        if (cloudRes.result.success) {
                            this.loadCategories()
                            wx.showToast({ title: '已添加' })
                        }
                    } catch (err) {
                        wx.showToast({ title: '添加失败', icon: 'none' })
                    } finally {
                        wx.hideLoading()
                    }
                }
            }
        })
    }
})
