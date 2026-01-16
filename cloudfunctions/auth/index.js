// 云函数：用户认证
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 生成6位邀请码
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// 检查邀请码是否已存在
async function checkInviteCodeExists(code) {
  const res = await db.collection('families').where({
    invite_code: code
  }).count()
  return res.total > 0
}

// 生成唯一邀请码
async function generateUniqueInviteCode() {
  let code = generateInviteCode()
  let attempts = 0
  while (await checkInviteCodeExists(code) && attempts < 10) {
    code = generateInviteCode()
    attempts++
  }
  if (attempts >= 10) {
    // 如果随机生成失败，使用时间戳后6位
    code = Date.now().toString(36).toUpperCase().slice(-6).padStart(6, '0')
  }
  return code
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event

  try {
    switch (action) {
      case 'login': {
        // 用户登录/注册
        const userRes = await db.collection('users').where({
          openid: wxContext.OPENID
        }).get()

        if (userRes.data.length > 0) {
          // 用户已存在，返回用户信息和家庭信息
          const user = userRes.data[0]
          let familyInfo = null
          if (user.family_id) {
            const familyDoc = await db.collection('families').doc(user.family_id).get()
            familyInfo = familyDoc.data
          }
          return {
            success: true,
            data: {
              isNew: false,
              user: user,
              family: familyInfo
            }
          }
        } else {
          // 新用户，返回引导创建/加入家庭
          return {
            success: true,
            data: {
              isNew: true,
              user: null,
              family: null
            }
          }
        }
      }

      case 'register': {
        const { userInfo } = event

        // Check if exists
        const userRes = await db.collection('users').where({ openid: wxContext.OPENID }).get()
        if (userRes.data.length > 0) {
          return { success: true, data: userRes.data[0] }
        }

        // 新用户自动加入全局厨房
        const res = await db.collection('users').add({
          data: {
            openid: wxContext.OPENID,
            nickname: userInfo?.nickName || '新用户',
            avatar_url: userInfo?.avatarUrl || '',
            family_id: 'global_home',  // 全局厨房
            role: 'foodie',  // 默认角色为吃货
            created_at: new Date(),
            updated_at: new Date()
          }
        })

        // 返回完整用户信息
        const newUser = await db.collection('users').doc(res._id).get()
        return { success: true, data: newUser.data }
      }

      case 'createFamily': {
        // 创建新家庭
        const { familyName, userInfo } = event

        // 生成唯一邀请码
        const inviteCode = await generateUniqueInviteCode()

        // 创建家庭
        const familyAddRes = await db.collection('families').add({
          data: {
            name: familyName || '我家',
            owner_openid: wxContext.OPENID,
            invite_code: inviteCode,
            member_count: 1,
            settings: {
              currency: 'CNY',
              timezone: 'Asia/Shanghai',
              default_deadline_minutes: 60
            },
            created_at: new Date(),
            updated_at: new Date()
          }
        })

        // 检查用户是否已存在
        const existingUserRes = await db.collection('users').where({ openid: wxContext.OPENID }).get()
        if (existingUserRes.data.length > 0) {
          await db.collection('users').doc(existingUserRes.data[0]._id).update({
            data: {
              family_id: familyAddRes._id,
              role: 'admin',
              updated_at: new Date()
            }
          })
        } else {
          // 创建用户记录
          await db.collection('users').add({
            data: {
              openid: wxContext.OPENID,
              nickname: userInfo?.nickName || '家庭成员',
              avatar_url: userInfo?.avatarUrl || '',
              family_id: familyAddRes._id,
              role: 'admin',
              taste_preferences: {
                avoid_cilantro: false,
                no_spicy: false,
                vegetarian: false,
                custom: []
              },
              notification_enabled: true,
              created_at: new Date(),
              updated_at: new Date()
            }
          })
        }

        return {
          success: true,
          data: {
            familyId: familyAddRes._id,
            inviteCode: inviteCode
          }
        }
      }

      case 'joinFamily': {
        // 加入已有家庭
        const { inviteCode: joinInviteCode } = event

        // 查找家庭
        const familyQueryRes = await db.collection('families').where({
          invite_code: joinInviteCode.toUpperCase()
        }).get()

        if (familyQueryRes.data.length === 0) {
          return { success: false, errMsg: '邀请码不存在' }
        }

        const family = familyQueryRes.data[0]

        // 检查用户是否已在该家庭
        const existUserRes = await db.collection('users').where({
          openid: wxContext.OPENID,
          family_id: family._id
        }).get()

        if (existUserRes.data.length > 0) {
          return { success: false, errMsg: '您已加入该家庭' }
        }

        // 更新用户家庭信息
        await db.collection('users').where({
          openid: wxContext.OPENID
        }).update({
          data: {
            family_id: family._id,
            role: 'member',
            updated_at: new Date()
          }
        })

        // 更新家庭成员数量
        await db.collection('families').doc(family._id).update({
          data: {
            member_count: db.command.inc(1),
            updated_at: new Date()
          }
        })

        return {
          success: true,
          data: {
            familyId: family._id,
            familyName: family.name
          }
        }
      }

      case 'getFamilyMembers': {
        // 获取家庭成员列表
        const { familyId } = event

        const membersRes = await db.collection('users').where({
          family_id: familyId
        }).get()

        return {
          success: true,
          data: membersRes.data
        }
      }

      case 'updateUserProfile': {
        // 更新用户信息
        const { nickname, tastePreferences, notificationEnabled, role, avatarUrl } = event

        const updateData = {
          updated_at: new Date()
        }

        if (nickname) updateData.nickname = nickname
        if (tastePreferences) updateData.taste_preferences = tastePreferences
        if (notificationEnabled !== undefined) {
          updateData.notification_enabled = notificationEnabled
        }
        if (role) updateData.role = role
        if (avatarUrl) updateData.avatar_url = avatarUrl

        await db.collection('users').where({
          openid: wxContext.OPENID
        }).update({
          data: updateData
        })

        return { success: true }
      }

      case 'leaveFamily': {
        // 退出家庭
        const userResult = await db.collection('users').where({
          openid: wxContext.OPENID
        }).get()

        if (userResult.data.length === 0) {
          return { success: false, errMsg: '用户不存在' }
        }

        const user = userResult.data[0]

        if (user.role === 'admin') {
          return { success: false, errMsg: '管理员无法退出，请先转让家庭所有权' }
        }

        // 清空用户的家庭ID
        await db.collection('users').doc(user._id).update({
          data: {
            family_id: '',
            role: 'member',
            updated_at: new Date()
          }
        })

        // 减少家庭成员数量
        if (user.family_id) {
          await db.collection('families').doc(user.family_id).update({
            data: {
              member_count: db.command.inc(-1),
              updated_at: new Date()
            }
          })
        }

        return { success: true }
      }

      case 'getInviteCode': {
        // 获取家庭邀请码
        const myUserRes = await db.collection('users').where({
          openid: wxContext.OPENID
        }).get()

        if (myUserRes.data.length === 0) {
          return { success: false, errMsg: '用户不存在' }
        }

        const myUser = myUserRes.data[0]

        if (!myUser.family_id) {
          return { success: false, errMsg: '您还没有加入家庭' }
        }

        const myFamilyRes = await db.collection('families').doc(myUser.family_id).get()

        return {
          success: true,
          data: {
            inviteCode: myFamilyRes.data.invite_code,
            familyName: myFamilyRes.data.name
          }
        }
      }

      case 'getMyInfo': {
        // 获取当前用户信息
        const myInfoRes = await db.collection('users').where({
          openid: wxContext.OPENID
        }).get()

        if (myInfoRes.data.length === 0) {
          return { success: true, data: null }
        }

        const myInfo = myInfoRes.data[0]
        let familyInfo = null

        if (myInfo.family_id) {
          const fRes = await db.collection('families').doc(myInfo.family_id).get()
          familyInfo = fRes.data
        }

        return {
          success: true,
          data: {
            user: myInfo,
            family: familyInfo
          }
        }
      }

      default:
        return { success: false, errMsg: '未知的操作类型' }
    }
  } catch (err) {
    return { success: false, errMsg: err.message }
  }
}
