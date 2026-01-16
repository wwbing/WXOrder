# 家庭点餐小程序

<p align="center">
  <img src="https://img.shields.io/badge/WeChat_Mini_Program-✓-07C160?style=for-the-badge&logo=wechat" alt="微信小程序">
  <img src="https://img.shields.io/badge/云开发-✓-07C160?style=for-the-badge&logo=cloudflare" alt="微信云开发">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="许可证">
</p>

基于微信云开发的家庭点餐小程序，提供完整的菜单管理、点餐会话、订单追踪、评价系统和互动功能。

**特点**：无家庭隔离，所有用户共享同一个"全局厨房"数据，适合小团队或家庭内部使用。

## 功能特性

### 菜单管理
- 支持自定义菜单分类
- 菜品图片、价格、口味标签管理
- 推荐菜品标记
- 收藏功能

### 点餐系统
- 创建点餐会话
- 设置截止时间（15/30/45/60/90/120分钟）
- 多人协作点餐
- 实时查看他人选择

### 订单管理
- 订单状态追踪（待制作 → 制作中 → 待取餐 → 已完成）
- 订单详情查看
- 彩虹屁评价系统
- 口味标签统计

### 互动功能
- 许愿池：许愿想吃的菜品，支持投票
- 评价系统：菜品评分 + 口味标签
- 用户角色：普通用户 / 大厨（可管理订单和许愿）

## 技术栈

- **前端**：微信小程序原生开发
- **后端**：微信云函数（Node.js）
- **数据库**：微信云数据库
- **存储**：微信云存储

## 项目结构

```
miniprogram-1/
├── miniprogram/           # 小程序前端
│   ├── app.js            # 应用入口
│   ├── app.json          # 页面路由配置
│   └── pages/            # 页面组件
├── cloudfunctions/        # 云函数
│   ├── auth/             # 用户认证
│   ├── menu/             # 菜单管理
│   ├── ordering/         # 点餐会话
│   ├── order/            # 订单管理
│   ├── kitchen/          # 厨房信息
│   ├── favorite/         # 收藏
│   ├── review/           # 评价
│   ├── wish/             # 许愿池
│   └── stats/            # 统计
└── project.config.json   # 项目配置
```

## 快速开始

### 环境准备

- 微信开发者工具
- 微信小程序账号

### 配置步骤

1. 克隆项目：
   ```bash
   git clone https://github.com/yourusername/miniprogram-1.git
   ```

2. 使用微信开发者工具打开项目

3. 在微信开发者工具中：
   - 点击「云开发」按钮，开通云环境
   - 记录你的云环境 ID（格式如 `cloud1-xxxxx`）
   - 右键点击每个云函数文件夹，选择「上传并部署：云端安装依赖」

4. 修改配置：
   - `miniprogram/envList.js` - 更新云环境 ID
   - `project.config.json` - 更新 AppID

### 数据库初始化

在云开发控制台中会自动创建以下集合：
- `users` - 用户信息
- `kitchens` - 厨房信息
- `menu_categories` - 菜单分类
- `menu_items` - 菜单项
- `dining_sessions` - 点餐会话
- `orders` - 订单
- `reviews` - 评价
- `wishes` - 许愿

## 使用说明

1. 首次打开小程序，授权登录
2. 进入「厨房」页面浏览菜单
3. 点击「开始点餐」创建会话
4. 选择菜品，确认下单
5. 订单完成后可撰写评价
6. 在「我的」页面管理个人资料和收藏

## 数据库设计

### 用户角色

| 角色 | 权限 |
|-----|------|
| `foodie` | 普通用户（默认） |
| `chef` | 大厨（可删除订单、管理许愿） |
| `admin` | 管理员 |

### 订单状态

```
pending → cooking → ready → completed
```

### 评价标签

好吃、一般、偏咸、偏淡、份量足、份量少、味道正宗、不推荐、性价比高、颜值高

## 配置说明

### 云环境配置

```javascript
// miniprogram/envList.js
module.exports = {
  envList: ['your-cloud-env-id']
}
```

### 应用配置

```javascript
// miniprogram/app.js
App({
  globalData: {
    env: 'your-cloud-env-id',
    userInfo: null,
    familyId: 'global_home'  // 全局厨房
  }
})
```

## 部署

### 部署云函数

在微信开发者工具中：
1. 展开 `cloudfunctions` 目录
2. 右键点击每个云函数文件夹
3. 选择「上传并部署：云端安装依赖」
4. 如有依赖，请选择「上传并部署：云端安装依赖（不上传 node_modules）」

### 编译小程序

1. 点击微信开发者工具「编译」按钮
2. 如需清除缓存：「清除编译缓存」→「编译」

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
