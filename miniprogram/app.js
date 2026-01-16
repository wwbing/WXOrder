// app.js
App({
  onLaunch: function () {
    this.globalData = {
      // 环境ID
      env: "cloud1-6g4l5jepb3f2f9aa",

      // 用户信息
      userInfo: null,

      // 家庭ID
      familyId: ''
    };

    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }
  }
});
