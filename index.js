const express = require('express')
const compression = require('compression')
const app = express()

const fs = require('fs')
const cors = require('cors')
const options = {
    key: fs.readFileSync("/root/.acme.sh/limbotech.top/limbotech.top.key"),
    cert: fs.readFileSync("/root/.acme.sh/limbotech.top/limbotech.top.cer")
}
const httpsServer = require('https').createServer(options, app)

const port = 8000

//处理相关请求的路由
const api = require(__dirname + '/api.js')

const cookieParser = require('cookie-parser')
//cookie签名
const cookieSignature = 'chatRoom'

// websocket
const io = require('socket.io')(httpsServer)
// 用let创建，因为下面要过滤
let usersOL = []
io.on('connection', async socket => {
    console.log('connected')
    // 连接时需要将所以在线用户发送给新连接
    socket.emit('usersOL', usersOL)
    socket.on('join', (name) => {
        // 有用户触发此事件，需要通知其他用户该用户在线
        // 要先验证一下，防止前端路由跳转的重新触发事件
        const has = usersOL.find(it => it.name === name)
        if(!has) {
            const user = {
                name: name,
                id: socket.id
            }
            socket.broadcast.emit('newer', user)
            usersOL.push(user)
        }
    })
    socket.on('privateChat', (id, name, msg) => {
        if(id === '1') {
            // 不需要发给自己，因为前端已经添加了
            socket.broadcast.emit('openChat', {
                user: name,
                timeStamp: Date.now(),
                content: msg,
            })
        } else {
            // 不能简单的加入房间再广播，因为一个用户可能同时与多个用户私聊
            socket.broadcast.to(id).emit('privateChat', {
                user: name,
                timeStamp: Date.now(),
                content: msg,
            })
        }
    })
    socket.on('leave', (name) => {
        usersOL = usersOL.filter(it => it.name !== name)
        io.emit('usersOL', usersOL)
    })
    socket.on('disconnect', async () => {
        usersOL = usersOL.filter(it => it.id !== socket.id)
        // 有用户离开需要给其他用户发送新的在线用户
        io.emit('usersOL', usersOL)
    })
})

// gzip压缩
app.use(compression())
//前置过滤器
app.use(cookieParser(cookieSignature))
// 跨域设置，允许所有跨域请求，带cookie的跨域必须设置
app.use(cors({
    origin: 'http://limbotech.top/',
    maxAge: 60 * 60 * 24,
    credentials: true,
}))
//解析请求体
app.use(express.json())
app.use(express.urlencoded())
// 静态文件
app.use('/static', express.static(__dirname + '/static'))

app.use('/api', api)

app.get('/', (req, res, next) => {
    res.sendFile(__dirname + '/static/dist/index.html')
})




httpsServer.listen(port, () => {
    console.log(port)
})