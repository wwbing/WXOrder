// pages/menu/search/index.js
const app = getApp()
const DEFAULT_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjIwIiBmaWxsPSIjOTk5Ij5cI+eVjOiJglvCoDwvdGV4dD48L3N2Zz4='

Page({
    data: {
        keyword: '',
        allItems: [], // Source of search
        results: [],
        defaultImage: DEFAULT_IMAGE
    },

    onLoad() {
        this.loadAllItems()
    },

    loadAllItems() {
        // Search from local cache primarily (same as Main Menu)
        const items = wx.getStorageSync('items') || []
        this.setData({ allItems: items })
    },

    onInput(e) {
        const keyword = e.detail.value
        this.setData({ keyword })
        this.performSearch(keyword)
    },

    onClear() {
        this.setData({ keyword: '', results: [] })
    },

    onCancel() {
        wx.navigateBack()
    },

    performSearch(keyword) {
        if (!keyword) {
            this.setData({ results: [] })
            return
        }

        const lowerKey = keyword.toLowerCase()
        const results = this.data.allItems.filter(item => {
            // Filter by name (case insensitive)
            return item.name && item.name.toLowerCase().includes(lowerKey)
                && item.is_available !== false
        })

        this.setData({ results })
    },

    // Add to Cart Logic (Same as Menu Home)
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

        // We don't update local cart data here since search page doesn't show cart total/bar
        // But we should notify previous page if needed (onShow handles it)

        wx.showToast({ title: '已添加', icon: 'success' })
    }
})
