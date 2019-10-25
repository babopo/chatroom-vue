// 账户相关的api
const router = require('express').Router()

const multer = require('multer')
const sharp = require('sharp')
const fs = require('fs')
const fsp = fs.promises
const nodemailer= require('nodemailer')

// 因为前端发送的是form-data表单，所以需要multer处理
const uploader = multer({
    // dest: __dirname + '/static/avatars'
    // 后续处理头像上传
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            console.log(1)
            cb(null, __dirname + '/static/avatars')
        },
        filename: function (req, file, cb) {
            console.log(1)
            cb(null, req.signedCookies.username)
        }
    })
})

let db
dbPromise = require(__dirname + '/database.js').then(database => {
    db = database
})

// 邮件发送器
const mailer = nodemailer.createTransport({
    service: 'qq',
    sercure: true,
    auth: {
        user: "3184267367",
        pass: "wlcumfbdulvxdfgj"       
    }
})

router.post('/login', uploader.none(), async(req, res, next) => {
    const user = await db.get(`SELECT * FROM users WHERE username = "${req.body.username}" AND password = "${req.body.password}"`)
    // 找不到返回undefined
    if(user) {
        console.log(req.body.username)
        res.cookie('username', req.body.username, {
            signed: true
        })
        res.json({
            code: 1,
            msg: "登陆成功",
        })
    } else {
        res.json({
            code: 0,
            msg: "登陆失败",
        })
    }
    
})


router.post('/register', uploader.none(), async(req, res, next) => {
    const user = await db.get(`SELECT * FROM users WHERE username = "${req.body.username}" OR email ="${req.body.email}"`)
    // 找不到返回undefined
    if(user) {
        res.json({
            code: 0,
            msg: "注册失败",
        })
    } else {
        await db.run(`INSERT INTO users VALUES (null, "${req.body.username}", "${req.body.password}", "${req.body.email}", null)`)
        res.cookie('username', req.body.username, { signed: true })
        res.json({
            code: 1,
            msg: "注册成功",
        })
    }
})


router.get('/verify', uploader.none(), async(req, res, next) => {
    const user = await db.get(`SELECT * FROM users WHERE username = "${req.signedCookies.username}"`)
    if(user) {
        res.json({
            code: 1,
            name: req.signedCookies.username,
        })
    } else {
        res.json({
            code: 0,
            msg: '验证失败'
        })
    }
})


router.get('/logout', uploader.none(), async(req, res, next) => {
    res.clearCookie('username')
    res.json({
        code: 1,
        msg: '已注销',
    })
})

router.post('/forget', uploader.none(), async(req, res, next) => {
    const user = await db.get(`SELECT * FROM users WHERE ${req.body.method} = "${req.body.val}"`)
    if(user && user.email) {
        const token = Math.random().toString().slice(2)
        const tempURL = 'http://chat-vue.limbotech.top:8000/#/passwordChanging/' + token
        mailer.sendMail({
            from: '"Chat Room" <3184267367@qq.com>',
            to: user.email,
            subject: '您的账户信息正在修改',
            text: `用户名: ${user.username}\r\n新密码: ${req.body.password}\r\n\r\n请确认以上并点击链接使修改信息生效：${tempURL}\r\n链接将在20分钟内失效！`
        }, (err, info) => {
            if (err) {
                res.json({
                    code: 0,
                    msg: '邮件发送失败！'
                })
            } else {
                db.run(`INSERT INTO passwordChanging VALUES(${user.uid}, "${req.body.password}", ${token})`)
                setTimeout(() => {
                    //20分钟后使连接失效
                    db.run(`DELETE FROM passwordChanging WHERE uid = ${user.uid}`)
                }, 1000 * 60 * 20)
                res.json({
                    code: 1,
                    msg: `重置链接已发送至${user.email}，请尽快查看邮箱，连接将在20分钟后失效！`
                })
            }
        })
    } else {
        res.json({
            code: 0,
            msg: '用户邮箱不存在！'
        })
    }
})

router.post('/update', uploader.none(), (req, res, next) => {
    // 请求头像的静态文件地址
    if(req.body.pass) {
        db.run(`UPDATE users SET password = "${req.body.pass}" WHERE username = "${req.body.username}"`)
    }
    if(req.body.email) {
        db.run(`UPDATE users SET email = "${req.body.email}" WHERE username = "${req.body.username}"`)
    }
    res.json({
        code: 1,
        msg: '登陆信息修改成功',
    })
})

router.post('/avatar', uploader.none(), async (req, res, next) => {
    // 请求头像的静态文件地址
    const user = await db.get(`SELECT * FROM users WHERE username = "${req.body.username}"`)
    if(user) {
        res.send('/static/avatars/' + user.avatar)
    } else {
        res.send('')
    }
})

router.post('/settings/upload', uploader.single('avatar'), async (req, res, next) => {
    // 更新头像
    const filePath = __dirname + '/static/avatars/' + req.file.filename
    if (/image/.test(req.file.mimetype)) {
        // 判断上传的是否是图片
        imgBuffer = await fsp.readFile(filePath).catch(err => new Error())
        // 上传奇怪的图像格式可能抛错
        if(imgBuffer instanceof Error) {
            fs.unlink(filePath)
            res.json({
                code: 1,
                msg: '文件格式不支持'
            })
        } else {
            await sharp(imgBuffer).resize(100, 100).toFile(filePath)
            //将图片统一大小后重新保存
            await db.run(`UPDATE users SET avatar = "${req.signedCookies.username}" WHERE username = "${req.signedCookies.username}"`)
            res.json({
                code: 1,
                msg: '更新头像成功'
            })
        }
    } else {
        //不是图片直接删掉
        fs.unlink(filePath)
        res.json({
            code: 1,
            msg: '文件格式不支持'
        })
    }
})

router.post('/passwordChanging', uploader.none(), async (req, res, next) => {
    console.log('token',req.body.token)
    const change = await db.get(`SELECT * FROM passwordChanging WHERE token = "${req.body.token}"`)
    console.log('change',change)
    if(change) {
        await db.run(`UPDATE users SET password = "${chage.password}" WHERE uid = ${change.uid}`)
        await db.run(`DELETE FROM passwordChanging WHERE uid = ${change.uid}`)
        res.json({
            code: 1,
            msg: '密码修改成功'
        })
    } else {
        res.json({
            code: 0,
            msg: '验证失败'
        })
    }
})


module.exports = router 