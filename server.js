// --- هذا هو المحرك (Backend) الذي ينقصك ---
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors()); // السماح بالاتصالات من أي دومين

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // السماح للجميع (لتسهيل الأمر)
        methods: ["GET", "POST"]
    }
});

const rooms = {}; // لتخزين بيانات الغرف

io.on('connection', (socket) => {
    console.log(`[اتصال جديد] - ${socket.id}`);

    socket.on('join-room', (data) => {
        const { roomId, userId, userName, videoUrl } = data;

        // 1. إدخال المستخدم للغرفة
        socket.join(roomId);

        // 2. تهيئة الغرفة إذا لم تكن موجودة
        if (!rooms[roomId]) {
            rooms[roomId] = {
                users: [],
                videoState: {
                    videoUrl: videoUrl, // أول شخص ينضم يحدد الفيديو
                    isPlaying: false,
                    currentTime: 0
                }
            };
        }

        // 3. إضافة المستخدم للغرفة
        rooms[roomId].users.push({ id: userId, name: userName, socketId: socket.id });

        // 4. إرسال بيانات الغرفة الحالية للمنضم الجديد فقط
        socket.emit('room-data', {
            users: rooms[roomId].users,
            videoState: rooms[roomId].videoState
        });

        // 5. إعلام باقي المستخدمين بانضمام شخص جديد
        socket.to(roomId).emit('user-joined', {
            userName: userName,
            users: rooms[roomId].users
        });

        console.log(`[انضمام] ${userName} انضم للغرفة ${roomId}`);
    });

    // --- أحداث الدردشة ---
    socket.on('send-message', (data) => {
        // إرسال الرسالة للجميع في الغرفة (بما فيهم المرسل)
        // لتجنب تكرار الرسالة عند المرسل، الكود في ملفك يعالج هذا
        socket.to(data.roomId).emit('new-message', data);
    });

    // --- أحداث مزامنة الفيديو ---
    socket.on('video-play', (data) => {
        if (rooms[data.roomId]) {
            rooms[data.roomId].videoState.isPlaying = true;
            rooms[data.roomId].videoState.currentTime = data.currentTime;
            socket.to(data.roomId).emit('played', data);
        }
    });

    socket.on('video-pause', (data) => {
        if (rooms[data.roomId]) {
            rooms[data.roomId].videoState.isPlaying = false;
            rooms[data.roomId].videoState.currentTime = data.currentTime;
            socket.to(data.roomId).emit('paused', data);
        }
    });

    socket.on('video-seek', (data) => {
        if (rooms[data.roomId]) {
            rooms[data.roomId].videoState.currentTime = data.currentTime;
            socket.to(data.roomId).emit('seeked', data);
        }
    });

    // --- حدث المغادرة ---
    socket.on('disconnect', () => {
        console.log(`[انقطاع اتصال] - ${socket.id}`);
        // البحث عن المستخدم في جميع الغرف وإزالته
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const userIndex = room.users.findIndex(u => u.socketId === socket.id);

            if (userIndex !== -1) {
                const leavingUser = room.users.splice(userIndex, 1)[0];
                // إعلام باقي الغرفة
                socket.to(roomId).emit('user-left', {
                    userName: leavingUser.name,
                    users: room.users
                });
                console.log(`[مغادرة] ${leavingUser.name} غادر الغرفة ${roomId}`);
                break;
            }
        }
    });
});

// تشغيل الخادم
const PORT = process.env.PORT || 3000; // مهم للاستضافة
server.listen(PORT, () => {
    console.log(`خادم المشاهدة الجماعية يعمل على المنفذ ${PORT}`);
});