// pages/ordering/select/index.js
const app = getApp()

Page({
  data: {
    sessionId: '',
    session: null,
    categories: [],
    items: [],
    activeCategoryId: '',
    selectedItems: [],
    totalAmount: 0,
    totalQuantity: 0,
    loading: true,
    defaultImage: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQwIiBoZWlnaHQ9IjE0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5Ij5cI+eVjOiJglvCoDwvdGV4dD48L3N2Zz4='
  },

  onLoad(options) {
    if (options.sessionId) {
      this.setData({ sessionId: options.sessionId })
    }
    if (options.presetItem) {
      // 从 URL 参数中解析预选菜品
      try {
        const presetItem = JSON.parse(decodeURIComponent(options.presetItem))
        this.addPresetItem(presetItem)
      } catch (err) {
        console.error('解析预选菜品失败', err)
      }
    }
    this.loadData()
  },

  async loadData() {
    this.setData({ loading: true })

    try {
      // 加载会话信息
      if (this.data.sessionId) {
        const sessionRes = await wx.cloud.callFunction({
          name: 'ordering',
          data: {
            action: 'getSession',
            sessionId: this.data.sessionId
          }
        })
        if (sessionRes.result && sessionRes.result.data) {
          this.setData({ session: sessionRes.result.data })
        }

        // 加载我已有的选择 (First check local storage from Main Menu)
        let localCart = wx.getStorageSync('cartItems') || []
        if (localCart.length > 0) {
          this.setData({ selectedItems: localCart })
        } else {
          // Fallback to Cloud
          const mySelectionRes = await wx.cloud.callFunction({
            name: 'ordering',
            data: {
              action: 'getMySelection',
              sessionId: this.data.sessionId
            }
          })
          if (mySelectionRes.result && mySelectionRes.result.data) {
            this.setData({ selectedItems: mySelectionRes.result.data.items })
          }
        }
      } else {
        // No session, just check local cart
        let localCart = wx.getStorageSync('cartItems') || []
        if (localCart.length > 0) {
          this.setData({ selectedItems: localCart })
        }
      }

      // 加载菜单 (Use Local Storage to match Main Page & Admin)
      let categories = wx.getStorageSync('categories') || []
      let allItems = wx.getStorageSync('items') || []

      console.log('Cart Page loaded storage:', categories.length, allItems.length)

      if (categories.length > 0) {
        // Map items to categories
        categories = categories.map(cat => ({
          ...cat,
          items: allItems.filter(i => i.categoryId === cat._id && i.is_available !== false)
        }))

        // Remove empty categories if desired, or keep them. 
        // User saw "4 items" means categories were effectively populated.

        this.setData({
          categories,
          activeCategoryId: categories.length > 0 ? categories[0]._id : '',
          items: categories.length > 0 && categories[0].items ? categories[0].items : []
        })
      } else {
        // Fallback or Empty
        this.setData({ categories: [], items: [] })
      }
    } catch (err) {
      console.error('加载数据失败', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      this.updateTotal()
      this.setData({ loading: false })
    }
  },

  // 添加预选菜品
  addPresetItem(item) {
    const { selectedItems } = this.data
    const existingIndex = selectedItems.findIndex(i => i.menu_item_id === item._id)

    if (existingIndex >= 0) {
      selectedItems[existingIndex].quantity += 1
      this.setData({ selectedItems: [...selectedItems] })
    } else {
      this.setData({
        selectedItems: [...selectedItems, {
          menu_item_id: item._id,
          menu_item: item,
          quantity: 1
        }]
      })
    }
    wx.setStorageSync('cartItems', this.data.selectedItems)
    this.updateTotal()
  },

  // 切换分类
  onCategoryTap(e) {
    const { id } = e.currentTarget.dataset
    const category = this.data.categories.find(c => c._id === id)

    this.setData({
      activeCategoryId: id,
      items: category ? category.items : []
    })
  },

  // 添加菜品
  onAddItem(e) {
    const { item } = e.currentTarget.dataset
    const { selectedItems } = this.data
    const existingIndex = selectedItems.findIndex(i => i.menu_item_id === item._id)

    if (existingIndex >= 0) {
      selectedItems[existingIndex].quantity += 1
      this.setData({ selectedItems: [...selectedItems] })
    } else {
      this.setData({
        selectedItems: [...selectedItems, {
          menu_item_id: item._id,
          menu_item: item,
          quantity: 1
        }]
      })
    }
    // Sync to Storage
    wx.setStorageSync('cartItems', this.data.selectedItems)
    this.updateTotal()
  },

  // 减少数量
  onDecrease(e) {
    const { index } = e.currentTarget.dataset
    const { selectedItems } = this.data

    if (selectedItems[index].quantity > 1) {
      selectedItems[index].quantity -= 1
    } else {
      selectedItems.splice(index, 1)
    }

    this.setData({ selectedItems: [...selectedItems] })
    // Sync to Storage
    wx.setStorageSync('cartItems', selectedItems)
    this.updateTotal()
  },

  // 增加数量
  onIncrease(e) {
    const { index } = e.currentTarget.dataset
    const { selectedItems } = this.data

    selectedItems[index].quantity += 1
    this.setData({ selectedItems: [...selectedItems] })
    // Sync to Storage
    wx.setStorageSync('cartItems', selectedItems)
    this.updateTotal()
  },

  // 获取菜品已选数量
  getItemQuantity(itemId) {
    const item = this.data.selectedItems.find(i => i.menu_item_id === itemId)
    return item ? item.quantity : 0
  },

  // 计算总金额 (Property, accessible as check value)
  // Note: MiniProgram computed props need observing or wxs. 
  // In pure JS data binding, you can't use a getter directly in wxml {{totalAmount}} unless it's set in data.
  // Wait, the current code has `get totalAmount() { ... }`.
  // WXML accesses it via `{{totalAmount}}`.
  // But getters on Page instance are NOT automatically available in WXML data binding unless explicitly set in `data` or updated.
  // Actually, getters on the Page object 'this' are technically accessible if the framework supports it, but standard Wechat helper is `data`.
  // The PREVIOUS code had a getter. Accessing `this.totalAmount` in JS works.
  // But WXML usually needs `data`.
  // Let's check if `totalAmount` was working or NaN.
  // Ah, the WXML says `{{totalAmount}}`. This implies there is a `totalAmount` in `data`.
  // But I don't see `totalAmount` in `data`.
  // AND the getter is not invalid code, but likely useless for WXML binding unless custom logic maps it.
  // However, `NaN` error means it probable WAS calculating something or trying to.
  // I will add `updateTotal()` helper and set `totalAmount` in `data`.

  updateTotal() {
    const { total, count } = this.data.selectedItems.reduce((acc, item) => {
      const price = Number(item.menu_item.price) || 0
      acc.total += (price * item.quantity)
      acc.count += item.quantity
      return acc
    }, { total: 0, count: 0 })

    this.setData({
      totalAmount: total,
      totalQuantity: count
    })
  },

  // 提交点餐
  async onSubmit() {
    if (this.data.selectedItems.length === 0) {
      wx.showToast({ title: '请选择菜品', icon: 'none' })
      return
    }

    wx.showLoading({ title: '提交中...' })

    try {
      const items = this.data.selectedItems.map(item => ({
        menu_item_id: item.menu_item_id,
        quantity: item.quantity
      }))

      const res = await wx.cloud.callFunction({
        name: 'ordering',
        data: {
          action: 'submitSelection',
          sessionId: this.data.sessionId,
          items
        }
      })

      wx.hideLoading()

      if (res.result && res.result.success) {
        wx.showToast({ title: '点餐成功', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({ title: res.result?.errMsg || '提交失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '提交失败', icon: 'none' })
    }
  }
})
