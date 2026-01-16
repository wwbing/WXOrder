// pages/demo/index.js
Page({
  data: {
    userInfo: {},
    result: '等待操作...',
    errorDetail: '',
    defaultAvatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI2YzZjNmMyIvPjwvc3ZnPg=='
  },

  // 获取用户信息
  getUserProfile() {
    wx.getUserProfile({
      desc: '用于展示用户信息',
      success: (res) => {
        this.setData({
          userInfo: res.userInfo,
          result: '登录成功：' + res.userInfo.nickName,
          errorDetail: JSON.stringify(res, null, 2)
        });
      },
      fail: (err) => {
        this.setData({
          result: '获取用户信息失败',
          errorDetail: '完整错误信息：\n' + JSON.stringify(err, null, 2)
        });
      }
    });
  },

  // 调用云函数
  callCloudFunction() {
    this.setData({ result: '正在调用云函数...', errorDetail: '' });
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'getOpenId'
      },
      success: (res) => {
        this.setData({
          result: '云函数调用成功',
          errorDetail: '返回结果：\n' + JSON.stringify(res, null, 2)
        });
      },
      fail: (err) => {
        this.setData({
          result: '云函数调用失败',
          errorDetail: 'errMsg: ' + err.errMsg + '\n\n完整错误：\n' + JSON.stringify(err, null, 2)
        });
      }
    });
  },

  // 添加数据到数据库
  addToDatabase() {
    this.setData({ result: '正在添加数据...', errorDetail: '' });
    const db = wx.cloud.database();
    db.collection('test_collection').add({
      data: {
        name: '测试菜品',
        price: 25,
        created_at: new Date()
      },
      success: (res) => {
        this.setData({
          result: '数据添加成功',
          errorDetail: '_id: ' + res._id + '\n\n完整结果：\n' + JSON.stringify(res, null, 2)
        });
      },
      fail: (err) => {
        this.setData({
          result: '数据添加失败',
          errorDetail: 'errMsg: ' + err.errMsg + '\n\n完整错误：\n' + JSON.stringify(err, null, 2)
        });
      }
    });
  },

  // 查询数据
  queryData() {
    this.setData({ result: '正在查询数据...', errorDetail: '' });
    const db = wx.cloud.database();
    db.collection('test_collection').get({
      success: (res) => {
        this.setData({
          result: '查询成功，数据条数: ' + res.data.length,
          errorDetail: '完整结果：\n' + JSON.stringify(res, null, 2)
        });
      },
      fail: (err) => {
        this.setData({
          result: '查询失败',
          errorDetail: 'errMsg: ' + err.errMsg + '\n\n完整错误：\n' + JSON.stringify(err, null, 2)
        });
      }
    });
  },

  // 复制错误信息
  copyError() {
    const text = this.data.result + '\n\n' + this.data.errorDetail;
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
      }
    });
  }
});
