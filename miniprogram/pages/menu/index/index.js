// pages/menu/index/index.js
const app = getApp()

// 默认图片（Base64 SVG）
const DEFAULT_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjIwIiBmaWxsPSIjOTk5Ij5cI+eVjOiJglvCoDwvdGV4dD48L3N2Zz4='

// Kitchen Defaults
const DEFAULT_BG = 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'
const DEFAULT_AVATAR = '/images/icon-kitchen-active.png'

Page({
  data: {
    categories: [],
    items: [],
    selectedCategory: '',
    selectedCategoryName: '',
    searchKeyword: '',
    loading: false,
    hasFamily: false,
    familyId: '',
    defaultImage: DEFAULT_IMAGE,
    cartCount: 0,
    totalPrice: 0,
    cartList: [],
    showCartDetail: false,
    showSearchPopup: false,
    searchResults: [],

    // Kitchen Info
    defaultBg: DEFAULT_BG,
    defaultAvatar: DEFAULT_AVATAR,
    kitchenInfo: {
      name: '我的厨房',
      description: '世间万物，唯有美食不可辜负',
      bgImage: '',
      avatar: ''
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' &&
      this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0 // Index of Kitchen tab
      })
    }
    this.checkFamily()
    this.loadKitchenInfo() // Refresh kitchen info when returning
  },

  async loadKitchenInfo() {
    console.log('[厨房] 开始加载厨房信息...')
    try {
      // 从云端加载厨房信息
      const res = await wx.cloud.callFunction({
        name: 'kitchen',
        data: { action: 'getKitchen' }
      })

      console.log('[厨房] 云函数返回:', res.result)

      if (res.result.success && res.result.data) {
        const kitchen = res.result.data
        console.log('[厨房] 厨房数据:', kitchen)

        // 如果有背景图，获取临时 URL
        let bgImage = this.data.defaultBg
        if (kitchen.bg_temp_url) {
          bgImage = kitchen.bg_temp_url
        } else if (kitchen.bg_file_id && kitchen.bg_file_id.startsWith('cloud://')) {
          try {
            const urlRes = await wx.cloud.getTempFileURL({
              fileList: [kitchen.bg_file_id]
            })
            if (urlRes.fileList && urlRes.fileList[0] && urlRes.fileList[0].tempFileURL) {
              bgImage = urlRes.fileList[0].tempFileURL
            }
          } catch (err) {
            console.error('[厨房] 获取背景图临时URL失败:', err)
          }
        }

        // 如果有头像，获取临时 URL
        let avatar = this.data.defaultAvatar
        if (kitchen.avatar_temp_url) {
          avatar = kitchen.avatar_temp_url
        } else if (kitchen.avatar_file_id && kitchen.avatar_file_id.startsWith('cloud://')) {
          try {
            const urlRes = await wx.cloud.getTempFileURL({
              fileList: [kitchen.avatar_file_id]
            })
            if (urlRes.fileList && urlRes.fileList[0] && urlRes.fileList[0].tempFileURL) {
              avatar = urlRes.fileList[0].tempFileURL
            }
          } catch (err) {
            console.error('[厨房] 获取头像临时URL失败:', err)
          }
        }

        this.setData({
          kitchenInfo: {
            ...this.data.kitchenInfo,
            name: kitchen.name || this.data.kitchenInfo.name,
            bgImage: bgImage,
            avatar: avatar
          }
        })

        console.log('[厨房] ✅ 厨房信息更新完成')
      } else {
        console.error('[厨房] ❌ 云函数调用失败或无数据')
      }
    } catch (err) {
      console.error('[厨房] ❌ 加载厨房信息出错:', err)
    }
  },

  goToKitchenEdit() {
    wx.navigateTo({
      url: '/pages/kitchen/edit/index'
    })
  },

  // 预览背景大图
  previewKitchenBg() {
    const url = this.data.kitchenInfo.bgImage || this.data.defaultBg;
    wx.previewImage({
      current: url,
      urls: [url]
    })
  },

  onShopSettings() {
    wx.showActionSheet({
      itemList: ['基础信息', '收款码', '展示设置'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.goToKitchenEdit()
        }
      }
    })
  },

  checkFamily() {
    this.updateCart()
    const familyId = app.globalData.familyId
    if (!familyId) {
      this.setData({ hasFamily: false, familyId: '' })
    } else {
      this.setData({ hasFamily: true, familyId })
    }
    this.loadData()
  },

  updateCart() {
    let cartItems = wx.getStorageSync('cartItems') || []
    const totalCount = cartItems.reduce((sum, i) => sum + i.quantity, 0)
    const totalPrice = cartItems.reduce((sum, i) => sum + (i.menu_item.price * i.quantity), 0)

    this.setData({
      cartList: cartItems,
      cartCount: totalCount,
      totalPrice: totalPrice
    })
  },

  // 加载数据
  async loadData() {
    this.setData({ loading: true })

    try {
      // 1. Try Cloud Database First (Primary Source of Truth)
      const cloudRes = await wx.cloud.callFunction({
        name: 'menu',
        data: { action: 'getAllCategoriesWithItems' }
      })

      if (cloudRes.result && cloudRes.result.success) {
        console.log('Loaded from Cloud DB:', cloudRes.result.data.length, 'categories')

        let categories = cloudRes.result.data.map(cat => ({
          ...cat,
          items: (cat.items || []).map(item => ({
            ...item,
            categoryId: item.category_id
          }))
        }))

        categories = categories.map(cat => ({
          ...cat,
          itemCount: cat.items.length
        }))

        this.updateViewWithData(categories)

        wx.setStorageSync('categories', categories)
        const flatItems = categories.flatMap(c => c.items)
        wx.setStorageSync('items', flatItems)

      } else {
        throw new Error(cloudRes.result?.errMsg || 'Cloud Error')
      }

    } catch (err) {
      console.warn('Cloud load failed, falling back to local/mock:', err)
      this.loadLocalOrMockData()
    } finally {
      this.setData({ loading: false })
    }
  },

  async updateViewWithData(categories) {
    let selectedCategory = this.data.selectedCategory
    let currentCat = null

    if (selectedCategory) {
      currentCat = categories.find(c => c._id === selectedCategory)
    }

    if (!currentCat && categories.length > 0) {
      currentCat = categories[0]
    }

    if (currentCat) {
      // 获取菜品图片的临时 URL
      const items = currentCat.items || []
      const itemsWithUrls = await Promise.all(items.map(async (item) => {
        // 1. 优先使用云端返回的临时URL
        if (item.image_temp_url) {
          return { ...item, image_url: item.image_temp_url }
        }
        // 2. 尝试前端获取 (可能会有权限问题)
        if (item.image_url && item.image_url.startsWith('cloud://')) {
          try {
            const urlRes = await wx.cloud.getTempFileURL({
              fileList: [item.image_url]
            })
            if (urlRes.fileList[0].tempFileURL) {
              return { ...item, image_url: urlRes.fileList[0].tempFileURL }
            }
          } catch (err) {
            console.error('Get item image temp URL error:', err)
          }
        }
        return item
      }))

      this.setData({
        categories,
        selectedCategory: currentCat._id,
        selectedCategoryName: currentCat.name,
        items: itemsWithUrls
      })
    } else {
      this.setData({ categories: [], items: [] })
    }
  },

  loadLocalOrMockData() {
    let categories = wx.getStorageSync('categories') || []
    let allItems = wx.getStorageSync('items') || []

    if (categories.length === 0) {
      categories = [
        { _id: 'cat1', name: '热销推荐' },
        { _id: 'cat2', name: '私房菜' },
        { _id: 'cat3', name: '汤类' },
        { _id: 'cat4', name: '主食' }
      ]
      wx.setStorageSync('categories', categories)

      if (allItems.length === 0) {
        allItems = [
          { _id: 'm1', categoryId: 'cat1', name: '招牌红烧肉', price: 5800, image_url: 'https://images.unsplash.com/photo-1606728035253-49e8a23146de', is_available: true, category_id: 'cat1' },
          { _id: 'm2', categoryId: 'cat1', name: '蒜蓉粉丝虾', price: 4800, image_url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641', is_available: true, category_id: 'cat1' },
          { _id: 'm3', categoryId: 'cat2', name: '回锅肉', price: 3800, image_url: 'https://images.unsplash.com/photo-1598188306155-25e400eb5809', is_available: true, category_id: 'cat2' },
          { _id: 'm4', categoryId: 'cat2', name: '宫保鸡丁', price: 3200, image_url: 'https://images.unsplash.com/photo-1525755617299-720656604a34', is_available: true, category_id: 'cat2' },
          { _id: 'm5', categoryId: 'cat3', name: '番茄蛋汤', price: 1200, image_url: 'https://images.unsplash.com/photo-1547592166-23acbe34071b', is_available: true, category_id: 'cat3' },
          { _id: 'm6', categoryId: 'cat3', name: '紫菜蛋花汤', price: 1000, image_url: '', is_available: true, category_id: 'cat3' }
        ]
        wx.setStorageSync('items', allItems)
      }
    }

    const availableItems = allItems.filter(i => i.is_available !== false)
    categories = categories.map(cat => ({
      ...cat,
      itemCount: availableItems.filter(i => (i.categoryId === cat._id || i.category_id === cat._id)).length,
      items: availableItems.filter(i => (i.categoryId === cat._id || i.category_id === cat._id))
    }))

    this.updateViewWithData(categories)
  },

  onCategorySelect(e) {
    const { id } = e.currentTarget.dataset
    if (id === this.data.selectedCategory) return

    const category = this.data.categories.find(c => c._id === id)
    if (!category) return

    // 刷新菜品图片的临时URL
    this.refreshCategoryItems(category)
  },

  async refreshCategoryItems(category) {
    const items = category.items || []
    const itemsWithUrls = await Promise.all(items.map(async (item) => {
      // 1. 优先使用云端返回的临时URL
      if (item.image_temp_url) {
        return { ...item, image_url: item.image_temp_url }
      }
      // 2. 尝试前端获取 (可能会有权限问题)
      if (item.image_url && item.image_url.startsWith('cloud://')) {
        try {
          const urlRes = await wx.cloud.getTempFileURL({
            fileList: [item.image_url]
          })
          if (urlRes.fileList && urlRes.fileList[0] && urlRes.fileList[0].tempFileURL) {
            return { ...item, image_url: urlRes.fileList[0].tempFileURL }
          }
        } catch (err) {
          console.error('Get item image temp URL error:', err)
        }
      }
      return item
    }))

    this.setData({
      selectedCategory: category._id,
      selectedCategoryName: category.name,
      items: itemsWithUrls
    })
  },

  onItemTap(e) {
    const { item } = e.currentTarget.dataset
    wx.showActionSheet({
      itemList: ['查看详情', '加入购物车'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.showModal({
            title: item.name,
            content: item.description || '暂无描述',
            showCancel: false
          })
        } else {
          this.onAddToCart({ currentTarget: { dataset: { item } } })
        }
      }
    })
  },

  onManageMenu() {
    wx.navigateTo({ url: '/pages/admin/menu-manage/index/index' })
  },

  onAddMenu() {
    wx.navigateTo({ url: '/pages/menu/add/index' })
  },

  // 加入购物车/点餐
  onAddToCart(e) {
    const { item } = e.currentTarget.dataset
    let cartItems = wx.getStorageSync('cartItems') || []

    const existingIndex = cartItems.findIndex(i => i.menu_item_id === item._id)
    if (existingIndex > -1) {
      cartItems[existingIndex].quantity += 1
    } else {
      cartItems.push({
        menu_item_id: item._id,
        menu_item: item,
        quantity: 1
      })
    }

    wx.setStorageSync('cartItems', cartItems)
    this.updateCart()
    wx.showToast({ title: '已添加', icon: 'success', duration: 800 })
  },

  // Cart Actions
  onToggleCart() {
    if (this.data.cartList.length === 0) return
    this.setData({ showCartDetail: !this.data.showCartDetail })
  },

  onHideCart() {
    this.setData({ showCartDetail: false })
  },

  onIncreaseCart(e) {
    const { index } = e.currentTarget.dataset
    let cartItems = this.data.cartList
    cartItems[index].quantity += 1
    wx.setStorageSync('cartItems', cartItems)
    this.updateCart()
  },

  onDecreaseCart(e) {
    const { index } = e.currentTarget.dataset
    let cartItems = this.data.cartList
    if (cartItems[index].quantity > 1) {
      cartItems[index].quantity -= 1
    } else {
      cartItems.splice(index, 1)
      if (cartItems.length === 0) {
        this.setData({ showCartDetail: false })
      }
    }
    wx.setStorageSync('cartItems', cartItems)
    this.updateCart()
  },

  onClearCart() {
    wx.showModal({
      title: '提示',
      content: '确定清空购物车吗？',
      success: (res) => {
        if (res.confirm) {
          wx.setStorageSync('cartItems', [])
          this.updateCart()
          this.setData({ showCartDetail: false })
        }
      }
    })
  },

  onSearchTap() {
    this.setData({
      showSearchPopup: true,
      searchKeyword: '',
      searchResults: []
    })
  },

  onCloseSearch() {
    this.setData({ showSearchPopup: false })
  },

  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({ searchKeyword: keyword })

    if (!keyword.trim()) {
      this.setData({ searchResults: [] })
      return
    }

    const allItems = wx.getStorageSync('items') || []
    const lowerKey = keyword.toLowerCase()

    const results = allItems.filter(item =>
      item.name && item.name.toLowerCase().includes(lowerKey) && item.is_available !== false
    )

    this.setData({ searchResults: results })
  },

  onManageCategories() {
    wx.navigateTo({ url: '/pages/admin/menu-manage/index/index?tab=categories' })
  },

  // 跳转许愿池
  goToWishPool() {
    wx.navigateTo({ url: '/pages/wish/index/index' })
  },

  onInviteFriends() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
    wx.showToast({ title: '请点击右上角分享', icon: 'none' })
  },

  onStartOrdering() {
    // Check if user is logged in
    const app = getApp()
    if (!app.globalData.userInfo) {
      wx.showModal({
        title: '请先登录',
        content: '下单前需要登录，是否前往登录？',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/profile/index/index' })
          }
        }
      })
      return
    }

    const cartItems = wx.getStorageSync('cartItems') || []
    if (cartItems.length === 0) {
      wx.showToast({ title: '购物车是空的', icon: 'none' })
      return
    }

    // Create order
    wx.showLoading({ title: '提交订单中...' })

    const orderItems = cartItems.map(item => ({
      menu_item_id: item.menu_item_id,
      name: item.menu_item.name,
      price: item.menu_item.price,
      quantity: item.quantity
    }))

    const totalPrice = cartItems.reduce((sum, item) =>
      sum + (item.menu_item.price * item.quantity), 0
    )

    wx.cloud.callFunction({
      name: 'order',
      data: {
        action: 'createOrder',
        items: orderItems,
        totalPrice: totalPrice
      }
    }).then(res => {
      wx.hideLoading()

      if (res.result.success) {
        // Clear cart
        wx.setStorageSync('cartItems', [])
        this.updateCart()

        wx.showToast({
          title: '下单成功！',
          icon: 'success',
          duration: 1500
        })

        // Navigate to Dynamic tab after 1.5s
        setTimeout(() => {
          wx.switchTab({ url: '/pages/dynamic/index' })
        }, 1500)
      } else {
        wx.showToast({
          title: res.result.errMsg || '下单失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      wx.hideLoading()
      console.error('Order creation failed:', err)
      wx.showToast({ title: '下单失败', icon: 'none' })
    })
  },

  onGoToCart() {
    this.onToggleCart()
  },

  // 阻止事件冒泡
  stopPropagation() { }
})
