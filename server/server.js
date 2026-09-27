const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const jwt = require('jsonwebtoken');
const Message = require('./models/Message');
const Room = require('./models/Room');
const roomRoutes = require('./routes/rooms');
require('dotenv').config();
async function seedRooms() {
    const rooms = [
        {
            name: 'general',
            displayName: 'General'
        },
        {
            name: 'tech',
            displayName: 'Tech'
        },
        {
            name: 'random',
            displayName: 'Random'
        }
    ];

    for (const room of rooms) {
        await Room.updateOne(
            { name: room.name },
            { $setOnInsert: room },
            { upsert: true }
        );
    }

    console.log('Chat rooms ready');
}
const connectDB = require('./config/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
io.use(function(socket, next) {
    try {
        const token = socket.handshake.auth.token;

        if (!token) {
            return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        socket.user = decoded;

        next();

    } catch (error) {
        next(new Error('Invalid or expired token'));
    }
});

app.use(express.json());
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);

app.use(express.static(path.join(__dirname, '..', 'frontend')));

const users = new Map();           // socket.id -> { username, room }
const usernameToSocket = new Map(); // username -> socket.id (for DMs/lookups)
const rooms = new Set(['general', 'tech', 'random']);

const HISTORY_LIMIT = 20;
const roomHistory = new Map();     // room -> array of last N room messages
const dmHistory = new Map();       // dmKey -> array of last N DM messages
const reactions = new Map();       // messageId -> { emoji: Set(username) }

function getTime() {
    return new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function pushHistory(map, key, message) {
    if (!map.has(key)) map.set(key, []);
    const list = map.get(key);
    list.push(message);
    if (list.length > HISTORY_LIMIT) list.shift();
}

function dmKey(userA, userB) {
    return [userA, userB].sort().join('::');
}

function reactionSummary(messageId) {
    const data = reactions.get(messageId);
    if (!data) return {};
    const summary = {};
    for (const [emoji, userSet] of data.entries()) {
        if (userSet.size > 0) summary[emoji] = Array.from(userSet);
    }
    return summary;
}

function sendRoomUsers(room) {
    const roomUsers = Array.from(users.values())
        .filter(function(u) { return u.room === room; })
        .map(function(u) { return u.username; });

    io.to(room).emit('room_users', roomUsers);
}

io.on('connection', (socket) => {
    console.log('New connection: ' + socket.id);
    socket.emit('rooms_list', Array.from(rooms));

socket.on('join', async (data) => {
    const username = socket.user.username;
    const room = data.room;

    const roomExists = await Room.findOne({
    name: room
});

if (!roomExists) {
    return;
}

    users.set(socket.id, { username, room });
    usernameToSocket.set(username, socket.id);

    socket.join(room);

    console.log(
        "Rooms for",
        username,
        ":",
        Array.from(socket.rooms)
    );

    socket.join('user:' + username);

    console.log(username + ' joined room: ' + room);

    io.to(room).emit('user_joined', {
        username: username,
        message: username + ' joined the chat',
        timestamp: getTime()
    });

    // Send recent history from MongoDB
    const history = await Message.find({
        room: room
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

    history.reverse();
    
    socket.emit('room_history', {
        room: room,
        messages: history.map(function(message) {
            return {
                username: message.username,
                text: message.text,
                timestamp: message.createdAt.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                id: message._id.toString(),
                reactions: {}
            };
        })
    });

    sendRoomUsers(room);
});

    socket.on('send_message', async (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const text = data.text.trim();

    if (!text || text.length > 500) return;

    try {
        const savedMessage = await Message.create({
            room: user.room,
            username: user.username,
            text: text
        });

       const messageData = {
    username: savedMessage.username,
    text: savedMessage.text,
    timestamp: savedMessage.createdAt.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    }),
    id: savedMessage._id.toString(),
    
};

        console.log(
            '[' + user.room + '] ' +
            user.username + ': ' +
            text
        );

        pushHistory(roomHistory, user.room, messageData);

        io.to(user.room).emit('new_message', messageData);

    } catch (error) {
        console.error('Message save error:', error.message);
    }
});

    // ── Private messaging ──
    socket.on('send_dm', async (data) => {
    const sender = users.get(socket.id);
    if (!sender) return;

    const toUsername = data.to;
    const text = data.text.trim();

    if (!toUsername || toUsername === sender.username) return;

    if (!text || text.length > 500) return;

    try {
        const savedMessage = await Message.create({
            from: sender.username,
            to: toUsername,
            text: text
        });

        const messageData = {
            from: savedMessage.from,
            to: savedMessage.to,
            text: savedMessage.text,
            timestamp: savedMessage.createdAt.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            }),
            id: savedMessage._id.toString()
        };

        pushHistory(
            dmHistory,
            dmKey(sender.username, toUsername),
            messageData
        );

        io.to('user:' + toUsername).emit('new_dm', messageData);
        socket.emit('new_dm', messageData);

    } catch (error) {
        console.error('DM save error:', error.message);
    }
});

    socket.on('get_dm_history', async (data) => {
    const sender = users.get(socket.id);
    if (!sender) return;

    const withUsername = data.with;

    if (!withUsername || withUsername === sender.username) {
        return;
    }

    try {
        const history = await Message.find({
            $or: [
                {
                    from: sender.username,
                    to: withUsername
                },
                {
                    from: withUsername,
                    to: sender.username
                }
            ]
        })
        .sort({ createdAt: 1 })
        .limit(50)
        .lean();

        socket.emit('dm_history', {
            with: withUsername,
            messages: history.map(function(message) {
                return {
                    from: message.from,
                    to: message.to,
                    text: message.text,
                    timestamp: message.createdAt.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    id: message._id.toString(),
                    reactions: {}
                };
            })
        });

    } catch (error) {
        console.error('DM history error:', error.message);
    }
});
    // ── Emoji reactions ──
    socket.on('react_message', (data) => {
        const user = users.get(socket.id);
        if (!user) return;

        const messageId = data.messageId;
        const emoji = data.emoji;
        const scope = data.scope;          // 'room' or 'dm'
        const target = data.target;        // room name, or other username for dm

        if (!reactions.has(messageId)) reactions.set(messageId, new Map());
        const messageReactions = reactions.get(messageId);
        if (!messageReactions.has(emoji)) messageReactions.set(emoji, new Set());

        const userSet = messageReactions.get(emoji);
        if (userSet.has(user.username)) {
            userSet.delete(user.username); // toggle off
        } else {
            userSet.add(user.username);
        }

        const summary = reactionSummary(messageId);

        if (scope === 'dm') {
            const key = dmKey(user.username, target);
            const otherUser = key.split('::').find(function(u) { return u !== user.username; });
            io.to('user:' + user.username).emit('reaction_update', { messageId, reactions: summary });
            io.to('user:' + otherUser).emit('reaction_update', { messageId, reactions: summary });
        } else {
            io.to(target || user.room).emit('reaction_update', { messageId, reactions: summary });
        }
    });

    socket.on('typing', (data) => {
        const user = users.get(socket.id);
        if (!user) return;

        socket.to(user.room).emit('user_typing', {
            username: user.username,
            isTyping: data.isTyping
        });
    });

    socket.on('switch_room', (data) => {
        const user = users.get(socket.id);
        if (!user) return;

        const oldRoom = user.room;
        const newRoom = data.newRoom;

        socket.leave(oldRoom);

        io.to(oldRoom).emit('user_left', {
            username: user.username,
            message: user.username + ' left the room',
            timestamp: getTime()
        });
        sendRoomUsers(oldRoom);

        user.room = newRoom;
        users.set(socket.id, user);
        socket.join(newRoom);

        io.to(newRoom).emit('user_joined', {
            username: user.username,
            message: user.username + ' joined the room',
            timestamp: getTime()
        });
        sendRoomUsers(newRoom);

        const history = (roomHistory.get(newRoom) || []).map(function(msg) {
            return Object.assign({}, msg, { reactions: reactionSummary(msg.id) });
        });
        socket.emit('room_history', { room: newRoom, messages: history });

        socket.emit('room_switched', { room: newRoom });
    });

    socket.on('disconnect', () => {
        const user = users.get(socket.id);

        if (user) {
            console.log(user.username + ' disconnected');

            io.to(user.room).emit('user_left', {
                username: user.username,
                message: user.username + ' left the chat',
                timestamp: getTime()
            });

            users.delete(socket.id);
            if (usernameToSocket.get(user.username) === socket.id) {
                usernameToSocket.delete(user.username);
            }
            sendRoomUsers(user.room);
        }
    });

});

const PORT = process.env.PORT || 3000;

connectDB().then(async function() {
    await seedRooms();

    server.listen(PORT, function() {
        console.log('Chat Server running at http://localhost:' + PORT);
    });
});