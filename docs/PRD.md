# 家庭点餐小程序 - 需求文档

> 版本：v2.0
> 更新日期：2026-01-14

---

## 1. 项目概述

### 1.1 项目背景
开发一款适合小家庭使用的微信点餐小程序，主要服务于家庭成员之间的日常点餐需求，解决"今天吃什么"的世纪难题。

### 1.2 目标用户
- 家庭成员（3-5人规模）
- 目标场景：日常用餐、偶尔的聚餐点餐
- 技术背景：微信云开发

### 1.3 核心价值
- 简化家庭成员沟通点餐的流程
- 汇总家庭成员的选择，生成最终订单
- 记录菜品口味偏好，提供个性化推荐
- 支持历史记录查看，便于统计分析

---

## 2. 功能需求

### 2.1 用户与家庭模块

#### 2.1.1 用户登录
| 功能点 | 说明 |
|--------|------|
| 微信一键登录 | 通过 `wx.login` + `getUserProfile` 获取用户信息 |
| 自动注册 | 首次登录自动创建用户记录 |
| 登录态维护 | 微信原生登录态，无需额外处理 |

#### 2.1.2 家庭管理
| 功能点 | 说明 |
|--------|------|
| 创建家庭 | 用户首次使用时创建自己的家庭 |
| 加入家庭 | 通过家庭码或邀请链接加入已有家庭 |
| 家庭成员列表 | 展示所有成员头像和昵称 |
| 成员角色 | 管理员（创建者）、普通成员 |
| 退出家庭 | 退出当前家庭（需保留历史数据） |

#### 2.1.3 用户信息管理
- 头像、昵称展示与修改
- 口味偏好设置（不吃香菜、不吃辣等）
- 消息通知开关

---

### 2.2 菜单管理模块

#### 2.2.1 菜品管理
| 功能点 | 说明 |
|--------|------|
| 新增菜品 | 名称、价格、图片、描述、分类 |
| 编辑菜品 | 修改菜品信息 |
| 删除菜品 | 软删除（保留历史订单关联） |
| 上架/下架 | 控制菜品是否可选 |
| 批量操作 | 批量上架/下架、批量修改价格 |

#### 2.2.2 菜品信息字段
```typescript
interface MenuItem {
  _id: string;
  family_id: string;
  name: string;           // 菜品名称
  category_id: string;    // 分类ID
  price: number;          // 价格（分）
  image_url: string;      // 图片云存储ID
  description: string;    // 菜品描述
  is_available: boolean;  // 是否上架
  is_recommended: boolean; // 今日推荐
  sort_order: number;     // 排序权重
  created_by: string;     // 创建者openid
  created_at: Date;
  updated_at: Date;
}
```

#### 2.2.3 菜单分类
| 功能点 | 说明 |
|--------|------|
| 自定义分类 | 支持创建多个分类（主食、小菜、饮料、汤品等） |
| 分类排序 | 拖拽调整分类顺序 |
| 分类图标 | 可选设置分类图标 |
| 分类颜色 | 分类标签颜色区分 |

#### 2.2.4 菜品图片管理
- 使用微信云存储上传图片
- 支持压缩处理
- 图片懒加载
- 默认占位图

---

### 2.3 收藏功能模块

#### 2.3.1 功能说明
| 功能点 | 说明 |
|--------|------|
| 收藏/取消收藏 | 用户可收藏喜欢的菜品 |
| 我的收藏列表 | 展示用户收藏的菜品 |
| 快速点餐 | 从收藏列表快速添加到订单 |
| 收藏统计 | 统计菜品的收藏人数 |

#### 2.3.2 收藏数据结构
```typescript
interface Favorite {
  _id: string;
  user_openid: string;
  menu_item_id: string;  // 关联菜品ID
  family_id: string;
  created_at: Date;
}
```

#### 2.3.3 UI交互
- 菜品卡片右上角显示收藏图标（空心/实心）
- 点击图标触发收藏/取消
- 收藏成功Toast提示
- 支持批量从收藏夹添加

---

### 2.4 评价功能模块

#### 2.4.1 功能说明
| 功能点 | 说明 |
|--------|------|
| 菜品评分 | 1-5星评分 |
| 评价文字 | 可选输入评价内容 |
| 评价图片 | 最多上传3张图片 |
| 口味标签 | 可选快捷标签（好吃、偏咸、份量足等） |
| 评价列表 | 展示所有评价 |
| 删除评价 | 用户可删除自己的评价 |

#### 2.4.2 评价数据结构
```typescript
interface Review {
  _id: string;
  menu_item_id: string;      // 菜品ID
  order_id: string;          // 关联订单ID（可选）
  user_openid: string;       // 评价用户
  user_name: string;         // 用户昵称（冗余）
  user_avatar: string;       // 用户头像（冗余）
  rating: number;            // 评分 1-5
  content: string;           // 评价内容
  images: string[];          // 评价图片URL数组
  taste_tags: string[];      // 口味标签
  is_anonymous: boolean;     // 是否匿名
  created_at: Date;
  updated_at: Date;
}
```

#### 2.4.3 评价统计
| 指标 | 说明 |
|------|------|
| 平均分 | 菜品综合评分 |
| 评价数量 | 累计评价条数 |
| 评分分布 | 各星级占比（5星、4星...） |
| 热门标签 | 最常被选中的口味标签 |

#### 2.4.4 评价功能UI
- 订单完成后弹出评价邀请
- 评价弹窗：星级 + 文字输入 + 图片上传
- 评价列表：卡片式展示
- 个人评价：可查看/删除自己的评价

---

### 2.5 点餐流程模块

#### 2.5.1 发起点餐
| 步骤 | 说明 |
|------|------|
| 创建会话 | 设置点餐标题（如"午餐点餐"） |
| 设置截止时间 | 可选 30分钟、1小时、2小时、自定义 |
| 选择菜品 | 从菜单中预选部分菜品（可选） |
| 发起分享 | 生成分享卡片，发送到家庭群 |
| 取消点餐 | 发起点者可取消当前点餐 |

#### 2.5.2 点餐会话数据结构
```typescript
interface DiningSession {
  _id: string;
  family_id: string;
  title: string;            // 点餐标题
  created_by: string;       // 发起点餐的用户
  status: 'active' | 'closed' | 'cancelled'; // 状态
  deadline: Date;           // 截止时间
  total_amount: number;     // 汇总金额
  order_count: number;      // 参与人数
  created_at: Date;
  closed_at: Date;
}
```

#### 2.5.3 选择餐品
| 功能点 | 说明 |
|--------|------|
| 浏览菜单 | 按分类查看菜品 |
| 搜索菜品 | 支持名称搜索 |
| 加入选择 | 选择菜品、份数、备注 |
| 查看他人选择 | 实时查看其他成员的选择 |
| 修改选择 | 在截止前可修改自己的选择 |
| 收藏快速点 | 从收藏夹快速添加 |

#### 2.5.4 订单选择数据结构
```typescript
interface OrderSelection {
  _id: string;
  session_id: string;       // 点餐会话ID
  user_openid: string;      // 选择人
  user_name: string;        // 用户名（冗余）
  items: {
    menu_item_id: string;   // 菜品ID
    quantity: number;       // 份数
    note: string;           // 备注（如：不要香菜）
  }[];
  subtotal: number;         // 小计金额
  created_at: Date;
  updated_at: Date;
}
```

#### 2.5.5 确认与汇总
| 功能点 | 说明 |
|--------|------|
| 实时汇总 | 显示当前总金额和参与人数 |
| 截止提醒 | 截止时间前5分钟提醒 |
| 自动截止 | 到达截止时间自动关闭 |
| 生成订单 | 关闭后生成最终订单 |
| 标记付款 | 可标记谁已付款 |

---

### 2.6 订单管理模块

#### 2.6.1 订单列表
| 筛选维度 | 说明 |
|----------|------|
| 时间筛选 | 今日、本周、本月、自定义 |
| 状态筛选 | 待付款、已完成、已取消 |
| 成员筛选 | 按选择人筛选 |

#### 2.6.2 订单详情
- 订单基本信息（时间、金额、状态）
- 各成员选择清单
- 菜品明细（名称、数量、小计）
- 评价入口（完成后可评价菜品）

#### 2.6.3 订单状态流转
```
draft(草稿) -> active(进行中) -> closed(已关闭) -> completed(已完成)
                                    ↓
                              cancelled(已取消)
```

---

### 2.7 数据统计模块（可选）

#### 2.7.1 消费统计
| 维度 | 说明 |
|------|------|
| 家庭月度报表 | 每月消费总额、订单数 |
| 个人消费排行 | 成员消费排名 |
| 人均消费 | 家庭人均消费金额 |

#### 2.7.2 菜品分析
| 维度 | 说明 |
|------|------|
| 热门菜品 | 点餐次数TOP10 |
| 零蛋菜品 | 从未被点的菜品 |
| 高分菜品 | 评分最高的菜品 |
| 口味偏好 | 家庭成员整体口味倾向 |

---

## 3. 非功能需求

### 3.1 性能需求
- 页面加载时间 < 2秒
- 列表滑动流畅（60fps）
- 图片懒加载

### 3.2 安全需求
- 用户数据隔离（只能查看本家庭数据）
- 微信鉴权登录
- 云函数鉴权（需检查family_id归属）
- 敏感数据脱敏

### 3.3 兼容性
- 微信基础库版本 >= 2.2.3
- iOS 和 Android 微信兼容

### 3.4 用户体验
- 操作反馈（Toast/Loading）
- 防止重复提交
- 加载状态展示
- 空状态引导

---

## 4. 数据库设计

### 4.1 数据集合总览

| 集合名 | 说明 | 索引 |
|--------|------|------|
| `families` | 家庭信息 | owner_id |
| `users` | 用户信息 | openid, family_id |
| `menu_categories` | 菜单分类 | family_id |
| `menu_items` | 菜品菜单 | family_id, category_id |
| `dining_sessions` | 点餐会话 | family_id, status |
| `order_selections` | 点餐选择 | session_id, user_openid |
| `orders` | 订单 | family_id, created_at |
| `favorites` | 收藏 | user_openid, menu_item_id |
| `reviews` | 评价 | menu_item_id, created_at |

### 4.2 详细表结构

#### families（家庭表）
```json
{
  "_id": "ObjectId",
  "name": "我家",
  "owner_openid": "用户openid",
  "invite_code": "邀请码(6位)",
  "settings": {
    "currency": "CNY",
    "timezone": "Asia/Shanghai",
    "default_deadline_minutes": 60
  },
  "created_at": "Date",
  "updated_at": "Date"
}
```

#### users（用户表）
```json
{
  "_id": "ObjectId",
  "openid": "微信openid",
  "nickname": "用户昵称",
  "avatar_url": "头像URL",
  "family_id": "家庭ID",
  "role": "admin|member",
  "taste_preferences": {
    "avoid_cilantro": false,
    "no_spicy": false,
    "vegetarian": false,
    "custom": []
  },
  "notification_enabled": true,
  "created_at": "Date",
  "updated_at": "Date"
}
```

#### menu_categories（菜单分类表）
```json
{
  "_id": "ObjectId",
  "family_id": "家庭ID",
  "name": "主食",
  "icon": "图标URL",
  "color": "#07C160",
  "sort_order": 0,
  "is_active": true,
  "created_at": "Date",
  "updated_at": "Date"
}
```

#### menu_items（菜品表）
```json
{
  "_id": "ObjectId",
  "family_id": "家庭ID",
  "category_id": "分类ID",
  "name": "红烧肉",
  "price": 3500,
  "image_url": "云存储ID",
  "description": "肥而不腻，入口即化",
  "is_available": true,
  "is_recommended": false,
  "sort_order": 0,
  "created_by": "用户openid",
  "created_at": "Date",
  "updated_at": "Date"
}
```

#### dining_sessions（点餐会话表）
```json
{
  "_id": "ObjectId",
  "family_id": "家庭ID",
  "title": "午餐点餐",
  "created_by": "用户openid",
  "status": "active|closed|cancelled",
  "deadline": "Date",
  "total_amount": 0,
  "order_count": 0,
  "created_at": "Date",
  "closed_at": "Date"
}
```

#### order_selections（点餐选择表）
```json
{
  "_id": "ObjectId",
  "session_id": "会话ID",
  "user_openid": "用户openid",
  "user_name": "用户昵称(冗余)",
  "user_avatar": "头像URL(冗余)",
  "items": [
    {
      "menu_item_id": "菜品ID",
      "menu_item_name": "菜品名称(冗余)",
      "quantity": 2,
      "note": "不要香菜",
      "price": 3500
    }
  ],
  "subtotal": 7000,
  "created_at": "Date",
  "updated_at": "Date"
}
```

#### orders（订单表）
```json
{
  "_id": "ObjectId",
  "family_id": "家庭ID",
  "session_id": "会话ID",
  "title": "午餐点餐",
  "total_amount": 15000,
  "status": "draft|confirmed|completed|cancelled",
  "payment_status": "unpaid|paid",
  "payments": {
    "user_openid": "金额"
  },
  "created_by": "用户openid",
  "created_at": "Date",
  "completed_at": "Date"
}
```

#### favorites（收藏表）
```json
{
  "_id": "ObjectId",
  "user_openid": "用户openid",
  "menu_item_id": "菜品ID",
  "family_id": "家庭ID",
  "created_at": "Date"
}
```

#### reviews（评价表）
```json
{
  "_id": "ObjectId",
  "menu_item_id": "菜品ID",
  "order_id": "订单ID",
  "user_openid": "用户openid",
  "user_name": "用户昵称",
  "user_avatar": "头像URL",
  "rating": 5,
  "content": "味道很棒！",
  "images": ["图片URL1", "图片URL2"],
  "taste_tags": ["好吃", "份量足"],
  "is_anonymous": false,
  "created_at": "Date",
  "updated_at": "Date"
}
```

---

## 5. 页面规划

```
pages/
├── demo/                   # Demo页面（开发调试用）
├── index/                  # 首页
│   └── index               # 今日点餐入口 + 最近订单
├── auth/                   # 授权页
│   └── login               # 登录 + 创建/加入家庭
├── menu/                   # 菜单浏览
│   ├── index               # 菜单主页面（分类Tab + 菜品列表）
│   └── detail              # 菜品详情 + 收藏 + 评价列表
├── ordering/               # 点餐流程
│   ├── session             # 点餐会话详情
│   ├── create              # 创建点餐会话
│   └── select              # 选择菜品
├── orders/                 # 订单管理
│   ├── index               # 订单列表
│   └── detail              # 订单详情
├── favorites/              # 收藏管理
│   └── index               # 我的收藏
├── profile/                # 个人中心
│   ├── index               # 个人信息 + 家庭信息
│   ├── settings            # 设置
│   └── taste               # 口味偏好设置
└── admin/                  # 管理功能
    ├── menu-manage         # 菜单管理
    │   ├── list            # 菜品列表
    │   └── editor          # 菜品编辑器
    ├── category-manage     # 分类管理
    └── statistics          # 数据统计
```

### 5.1 页面流程图

```
用户打开小程序
    │
    ├─ 未登录 ──→ auth/login ──→ 创建/加入家庭
    │
    └─ 已登录 ──→ index (首页)
                    │
                    ├─ 有进行中的点餐 ──→ ordering/session
                    │
                    ├─ 无进行中的点餐 ──→ ordering/create (发起新点餐)
                    │
                    └─ 查看历史 ──→ orders/index
```

---

## 6. 接口设计（云函数）

### 6.1 用户相关
| 云函数 | 方法 | 说明 |
|--------|------|------|
| `auth` | login | 用户登录/注册 |
| `auth` | joinFamily | 加入家庭 |
| `auth` | createFamily | 创建家庭 |

### 6.2 菜单相关
| 云函数 | 方法 | 说明 |
|--------|------|------|
| `menu` | getCategories | 获取分类列表 |
| `menu` | getItems | 获取菜品列表 |
| `menu` | createItem | 创建菜品 |
| `menu` | updateItem | 更新菜品 |
| `menu` | deleteItem | 删除菜品 |

### 6.3 点餐相关
| 云函数 | 方法 | 说明 |
|--------|------|------|
| `ordering` | createSession | 创建点餐会话 |
| `ordering` | getSession | 获取会话详情 |
| `ordering` | submitSelection | 提交选择 |
| `ordering` | closeSession | 关闭会话 |
| `ordering` | generateOrder | 生成订单 |

### 6.4 收藏相关
| 云函数 | 方法 | 说明 |
|--------|------|------|
| `favorite` | list | 我的收藏列表 |
| `favorite` | add | 添加收藏 |
| `favorite` | remove | 取消收藏 |
| `favorite` | check | 检查是否已收藏 |

### 6.5 评价相关
| 云函数 | 方法 | 说明 |
|--------|------|------|
| `review` | create | 提交评价 |
| `review` | list | 评价列表 |
| `review` | delete | 删除评价 |
| `review` | getStats | 获取评价统计 |

---

## 7. 开发计划

### 第一阶段：核心功能
| 序号 | 功能 | 优先级 | 预估工作量 |
|------|------|--------|------------|
| 1 | 用户登录 + 家庭创建/加入 | P0 | 1天 |
| 2 | 菜单分类管理 | P0 | 0.5天 |
| 3 | 菜品CRUD | P0 | 1天 |
| 4 | 发起点餐 | P0 | 0.5天 |
| 5 | 选择餐品 | P0 | 1天 |
| 6 | 订单汇总 | P0 | 0.5天 |

### 第二阶段：增强功能
| 序号 | 功能 | 优先级 | 预估工作量 |
|------|------|--------|------------|
| 7 | 订单历史记录 | P1 | 0.5天 |
| 8 | 成员管理 | P1 | 0.5天 |
| 9 | 收藏功能 | P1 | 1天 |
| 10 | 评价功能 | P1 | 1.5天 |
| 11 | 消费统计 | P2 | 1天 |

### 第三阶段：体验优化
| 序号 | 功能 | 优先级 | 预估工作量 |
|------|------|--------|------------|
| 12 | 分享功能优化 | P1 | 0.5天 |
| 13 | 消息订阅通知 | P2 | 1天 |
| 14 | 图片上传优化 | P1 | 0.5天 |
| 15 | 数据导出 | P2 | 1天 |

---

## 8. 技术选型

| 领域 | 技术方案 |
|------|----------|
| 前端框架 | 微信小程序原生框架 |
| 后端服务 | 微信云开发（云函数、云数据库、云存储） |
| UI 组件 | Vant Weapp（可选）或 自定义组件 |
| 图片存储 | 微信云存储 |
| 图表统计 | ECharts for WeChat（可选） |

---

## 9. 项目结构

```
miniprogram-1/
├── cloudfunctions/          # 云函数目录
│   └── quickstartFunctions/ # 示例云函数
├── miniprogram/             # 小程序前端
│   ├── components/          # 公共组件
│   ├── images/              # 静态图片
│   ├── pages/               # 页面
│   ├── utils/               # 工具函数
│   ├── app.js               # 应用入口
│   ├── app.json             # 应用配置
│   └── app.wxss             # 全局样式
├── docs/                    # 文档
│   └── PRD.md               # 需求文档
├── project.config.json      # 项目配置
└── README.md
```

---

## 10. 参考资料

- [微信小程序文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [Vant Weapp](https://vant-contrib.gitee.io/vant-weapp/)
