// pages/admin/menu-manage/index/index.js
const app = getApp()
const DEFAULT_IMAGE = '/images/placeholder-food.png'

Page({
  data: {
    categories: [],
    items: [],
    allItems: [],
    selectedCategoryId: '',
    selectedCategoryName: '',
    loading: false,

    // Batch Mode
    isBatchMode: false,
    selectedItemIds: []
  },

  onLoad(options) {
    this.loadData()
  },

  onShow() {
    // Reload every time to catch category changes
    this.loadData()
  },

  // Save changes to storage to persist them
  saveData() {
    wx.setStorageSync('categories', this.data.categories)
    wx.setStorageSync('items', this.data.allItems)
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      // 1. Try Cloud First
      const cloudRes = await wx.cloud.callFunction({
        name: 'menu',
        data: { action: 'getAllCategoriesWithItems' }
      })

      if (cloudRes.result && cloudRes.result.success) {
        console.log('Admin Loaded from Cloud:', cloudRes.result.data.length, 'categories')

        let categories = cloudRes.result.data
        // Flatten items from nested structure
        let allItems = []

        categories = categories.map(cat => {
          const catItems = (cat.items || []).map(item => ({
            ...item,
            categoryId: item.category_id // normalize
          }))
          allItems = allItems.concat(catItems)

          return {
            ...cat,
            items: undefined, // keep lightweight
            itemCount: catItems.length
          }
        })

        this.setPageData(categories, allItems)

        // Update Local Cache
        wx.setStorageSync('categories', categories)
        wx.setStorageSync('items', allItems)

      } else {
        throw new Error('Cloud Error')
      }

    } catch (err) {
      console.warn('Fallback to local:', err)
      this.loadLocalOrMockData()
    } finally {
      this.setData({ loading: false })
    }
  },

  setPageData(categories, allItems) {
    // Logic to determine selection, reused
    let initialId = this.data.selectedCategoryId
    let initialName = this.data.selectedCategoryName

    if (!initialId && categories.length > 0) {
      initialId = categories[0]._id
      initialName = categories[0].name
    } else if (initialId) {
      const exists = categories.find(c => c._id === initialId)
      if (!exists && categories.length > 0) {
        initialId = categories[0]._id
        initialName = categories[0].name
      }
    }

    this.setData({
      categories,
      allItems,
      selectedCategoryId: initialId,
      selectedCategoryName: initialName
    })
    this.filterItems()
  },

  loadLocalOrMockData() {
    // 1. Try Local Storage
    let categories = wx.getStorageSync('categories') || []
    let allItems = wx.getStorageSync('items') || []

    // 2. Fallback to Mock if empty
    if (categories.length === 0) {
      categories = [
        { _id: 'cat1', name: '汤' },
        { _id: 'cat2', name: '炒菜' },
        { _id: 'cat3', name: '主食' }
      ]
      wx.setStorageSync('categories', categories)
    }

    if (allItems.length === 0) {
      allItems = [
        { _id: '1', categoryId: 'cat1', name: '辣条汤', price: 3000, image_url: '', is_available: true },
        { _id: '2', categoryId: 'cat2', name: '西红柿炒蛋', price: 2000, image_url: '', is_available: true }
      ]
      wx.setStorageSync('items', allItems)
    }

    // Calculate Counts
    categories = categories.map(cat => {
      const count = allItems.filter(i => (i.categoryId === cat._id || i.category_id === cat._id)).length
      return { ...cat, itemCount: count }
    })

    this.setPageData(categories, allItems)
  },

  filterItems() {
    const { allItems, selectedCategoryId } = this.data
    const items = allItems.filter(i => i.categoryId === selectedCategoryId)
    this.setData({ items })
  },

  onCategorySelect(e) {
    const { id } = e.currentTarget.dataset
    if (id === this.data.selectedCategoryId) return
    const cat = this.data.categories.find(c => c._id === id)
    this.setData({
      selectedCategoryId: id,
      selectedCategoryName: cat ? cat.name : '',
      isBatchMode: false,
      selectedItemIds: []
    })
    this.filterItems()
  },

  onManageCategories() {
    wx.navigateTo({
      url: '/pages/admin/category-manage/index'
    })
  },

  // 添加菜品
  onAddMenuItem() {
    if (!this.data.selectedCategoryId) {
      wx.showToast({ title: '请先选择分类', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/menu/add/index?categoryId=${this.data.selectedCategoryId}`
    })
  },

  toggleBatchMode() {
    this.setData({
      isBatchMode: !this.data.isBatchMode,
      selectedItemIds: []
    })
  },

  toggleSelectAll() {
    const { items, selectedItemIds } = this.data
    const isAllSelected = items.length > 0 && selectedItemIds.length === items.length

    if (isAllSelected) {
      this.setData({ selectedItemIds: [] })
    } else {
      const allIds = items.map(i => i._id)
      this.setData({ selectedItemIds: allIds })
    }
  },

  onToggleItemSelect(e) {
    if (!this.data.isBatchMode) return
    const { id } = e.currentTarget.dataset
    let ids = this.data.selectedItemIds
    if (ids.includes(id)) {
      ids = ids.filter(i => i !== id)
    } else {
      ids.push(id)
    }
    this.setData({ selectedItemIds: ids })
  },

  onToggleItemStatus(e) {
    const { id, status } = e.currentTarget.dataset
    const newStatus = status === 'up'

    const updatedItems = this.data.allItems.map(item => {
      if (item._id === id) {
        return { ...item, is_available: newStatus }
      }
      return item
    })

    this.setData({ allItems: updatedItems })
    this.filterItems()
    this.saveData() // Persist

    wx.showToast({ title: status === 'up' ? '已上架' : '已下架', icon: 'success' })
  },

  onBatchStatus(e) {
    const { status } = e.currentTarget.dataset
    if (this.data.selectedItemIds.length === 0) return wx.showToast({ title: '请选择菜品', icon: 'none' })

    const newStatus = status === 'up'
    const updatedItems = this.data.allItems.map(item => {
      if (this.data.selectedItemIds.includes(item._id)) {
        return { ...item, is_available: newStatus }
      }
      return item
    })

    this.setData({ allItems: updatedItems })
    this.filterItems()
    this.saveData() // Persist

    wx.showToast({ title: status === 'up' ? '已批量上架' : '已批量下架', icon: 'success' })
    this.toggleBatchMode()
  },

  onBatchMove() {
    if (this.data.selectedItemIds.length === 0) return wx.showToast({ title: '请选择菜品', icon: 'none' })

    const itemList = this.data.categories.map(c => c.name)
    wx.showActionSheet({
      itemList: itemList,
      success: (res) => {
        const targetCat = this.data.categories[res.tapIndex]

        const updatedItems = this.data.allItems.map(item => {
          if (this.data.selectedItemIds.includes(item._id)) {
            return { ...item, categoryId: targetCat._id }
          }
          return item
        })

        // Count update is handled in filter/load but here we just update allItems locally
        // Actually we should update categories count too.
        const newCats = this.data.categories.map(cat => {
          const count = updatedItems.filter(i => i.categoryId === cat._id).length
          return { ...cat, itemCount: count }
        })

        this.setData({
          categories: newCats,
          allItems: updatedItems
        })
        this.filterItems()
        this.saveData() // Persist

        wx.showToast({ title: `已移动到 ${targetCat.name}`, icon: 'success' })
        this.toggleBatchMode()
      }
    })
  },

  onEditItem(e) {
    const { item } = e.currentTarget.dataset
    // Navigate to edit page (reusing add page)
    wx.navigateTo({
      url: `/pages/menu/add/index?id=${item._id}`
    })
  },

  async onDeleteItem(e) {
    const { id } = e.currentTarget.dataset
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个菜品吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          try {
            // Call Cloud Function
            await wx.cloud.callFunction({
              name: 'menu',
              data: {
                action: 'deleteItem',
                itemId: id
              }
            })

            // Update Local State on Success
            const newAllIdx = this.data.allItems.filter(i => i._id !== id)
            const newCats = this.data.categories.map(cat => {
              const count = newAllIdx.filter(i => i.categoryId === cat._id).length
              return { ...cat, itemCount: count }
            })

            this.setData({ allItems: newAllIdx, categories: newCats })
            this.filterItems()
            this.saveData() // Persist to storage just in case

            wx.hideLoading()
            wx.showToast({ title: '已删除', icon: 'none' })

          } catch (err) {
            wx.hideLoading()
            console.error(err)
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }
})
