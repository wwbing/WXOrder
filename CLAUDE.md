# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WeChat Mini Program for kitchen/menu ordering (家庭点餐小程序). Built with WeChat Cloud Development (云开发) including cloud functions, cloud database, and cloud storage.

**重要说明**: 本项目**不使用家庭隔离**，所有用户共享同一个全局厨房 `global_home` 数据。虽然代码中存在 `families` 集合和邀请码相关逻辑，但核心业务数据（菜单、订单、评价等）都存储在 `global_home` 下，不做用户隔离。

## Development Environment

- **IDE**: WeChat Developer Tools
- **Cloud Environment**: `cloud1-6g4l5jepb3f2f9aa`
- **AppID**: `wx69bbcf771ac284bd`
- **LibVersion**: 2.20.1

## Project Structure

```
miniprogram-1/
├── miniprogram/           # 小程序前端
│   ├── app.js            # 应用入口，全局状态管理
│   ├── app.json          # 页面路由配置(tabBar)
│   ├── app.wxss          # 全局样式
│   ├── envList.js        # 云环境配置
│   └── pages/            # 页面组件
├── cloudfunctions/        # 云函数
│   ├── auth/             # 用户认证
│   ├── menu/             # 菜单分类和菜品CRUD
│   ├── ordering/         # 点餐会话管理
│   ├── order/            # 订单管理
│   ├── favorite/         # 收藏功能
│   ├── review/           # 评价管理
│   ├── kitchen/          # 厨房信息管理
│   ├── wish/             # 许愿池管理
│   ├── stats/            # 用户统计
│   └── migrate/          # 数据迁移
└── project.config.json   # 微信开发者工具配置
```

**TabBar页面**:
- `pages/menu/index/index` - 厨房菜单(主入口)
- `pages/dynamic/index` - 动态/点餐历史/订单管理
- `pages/profile/index/index` - 个人中心

## Common Commands

**Deploy cloud function**: Right-click cloud function folder in WeChat DevTools → "上传并部署：云端安装依赖"

**Clear cache & recompile**: WeChat DevTools "清除编译缓存" → "编译"

## Database Collections

| Collection | 用途 | 关键字段 |
|------------|------|----------|
| `users` | 用户信息 | openid, nickname, avatar_url, role, taste_preferences, family_id |
| `families` | 家庭组(未实际隔离) | name, owner_openid, invite_code, member_count, settings |
| `kitchens` | 厨房信息(全局) | family_id='global_home', name, description, bg_file_id, avatar_file_id |
| `menu_categories` | 菜单分类 | family_id, name, color, sort_order, is_active |
| `menu_items` | 菜单项 | family_id, category_id, name, price(分), image_url, is_available, is_recommended |
| `favorites` | 收藏 | user_openid, menu_item_id, family_id |
| `reviews` | 评价 | menu_item_id, order_id, user_openid, rating, taste_tags |
| `review_stats` | 评价统计(聚合缓存) | menu_item_id, avg_rating, total_count, popular_tags |
| `dining_sessions` | 点餐会话 | family_id, title, created_by, status, deadline, total_amount |
| `order_selections` | 用户选择 | session_id, user_openid, items[], subtotal |
| `orders` | 订单 | family_id, user_id, items[], total_price, status, praise, review |
| `wishes` | 许愿 | family_id, openid, title, description, status, vote_count, voted_by |

## Cloud Function Pattern

All cloud functions follow this pattern:

```javascript
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event

  // Helper: getUser() 获取当前用户

  try {
    switch (action) {
      case 'action1':
        // ... implementation
        return { success: true, data: result }
      case 'action2':
        // ... implementation
        return { success: true }
      default:
        return { success: false, errMsg: '未知的操作类型' }
    }
  } catch (err) {
    return { success: false, errMsg: err.message }
  }
}
```

## Key Patterns

**全局厨房**: 所有数据存储在 `family_id = 'global_home'` 下，不做用户隔离

**软删除**: 分类使用 `is_active` 标志，菜品使用 `is_available` 标志

**金额存储**: 所有价格以分存储，显示时乘以100

**图片处理**: cloud:// 开头的图片需使用 `getTempFileURL` 转换临时URL

**用户角色**: foodie(默认), chef(可删除订单、管理许愿), admin

**订单状态流转**: pending → cooking → ready → completed

**评价预设标签**: 好吃、一般、偏咸、偏淡、份量足、份量少、味道正宗、不推荐、性价比高、颜值高

## Page Navigation Flow

1. Login → `pages/auth/login/index`
2. 厨房(主入口) → `pages/menu/index/index`
   - 搜索菜品 → `pages/menu/search/index`
   - 添加菜品 → `pages/menu/add/index` (admin)
   - 开始点餐 → `pages/ordering/index/index` → `pages/ordering/select/index`
3. 动态 → `pages/dynamic/index`
   - 订单详情 → `pages/orders/detail/index`
4. 我的 → `pages/profile/index/index`
   - 菜单管理 → `pages/admin/menu-manage/index/index`
   - 分类管理 → `pages/admin/category-manage/index`
   - 编辑厨房 → `pages/kitchen/edit/index`
   - 我的收藏 → `pages/favorites/index/index`
   - 评价列表 → `pages/reviews/list/index`
   - 撰写评价 → `pages/reviews/create/index`
   - 许愿池 → `pages/wish/index/index`
   - 彩虹屁历史 → `pages/praise/history/index`
   - 编辑资料 → `pages/profile/edit/index`
   - 设置 → `pages/profile/settings/index`

## Global State (app.globalData)

```javascript
{
  env: "cloud1-6g4l5jepb3f2f9aa",  // 云环境ID
  userInfo: null,                   // 用户信息
  familyId: 'global_home'           // 固定为 global_home
}
```

## Important Implementation Notes

- **不做家庭隔离**: 所有云函数使用 `getUserFamilyId()` 固定返回 `'global_home'`
- 云函数使用 `wxContext.OPENID` 标识用户
- 点餐会话可设置截止时间 [15,30,45,60,90,120分钟]
- 会话创建者可取消/关闭会话，所有用户可编辑自己的选择
- 大厨(chef)角色可删除订单、管理许愿状态
