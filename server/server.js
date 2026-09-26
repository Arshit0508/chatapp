const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const jwt = require('jsonwebtoken');

require('dotenv').config();
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
app.use('/api/auth', authRoutes);

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

    socket.on('join', (data) => {
    const username = socket.user.username;
    const room = data.room;

        users.set(socket.id, { username, room });
        usernameToSocket.set(username, socket.id);
        socket.join(room);
        console.log("Rooms for", username, ":", Array.from(socket.rooms));
        socket.join('user:' + username); // personal channel for DMs

        console.log(username + ' joined room: ' + room);

        io.to(room).emit('user_joined', {
            username: username,
            message: username + ' joined the chat',
            timestamp: getTime()
        });

        // Send recent history for the room, with current reaction state attached
        const history = (roomHistory.get(room) || []).map(function(msg) {
            return Object.assign({}, msg, { reactions: reactionSummary(msg.id) });
        });
        socket.emit('room_history', { room: room, messages: history });

        sendRoomUsers(room);
    });

    socket.on('send_message', (data) => {
        const user = users.get(socket.id);
        if (!user) return;

        const messageData = {
            username: user.username,
            text: data.text,
            timestamp: getTime(),
            id: Date.now() + '-' + Math.random().toString(36).slice(2, 8)
        };

        console.log('[' + user.room + '] ' + user.username + ': ' + data.text);

        pushHistory(roomHistory, user.room, messageData);
        
        io.to(user.room).emit('new_message', messageData);
    });

    // ── Private messaging ──
    socket.on('send_dm', (data) => {
        const sender = users.get(socket.id);
        if (!sender) return;

        const toUsername = data.to;
        if (!toUsername || toUsername === sender.username) return;

        const messageData = {
            from: sender.username,
            to: toUsername,
            text: data.text,
            timestamp: getTime(),
            id: 'dm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
        };

        pushHistory(dmHistory, dmKey(sender.username, toUsername), messageData);

        // Deliver to recipient (if online) and echo back to sender
        io.to('user:' + toUsername).emit('new_dm', messageData);
        socket.emit('new_dm', messageData);
    });

    socket.on('get_dm_history', (data) => {
        const sender = users.get(socket.id);
        if (!sender) return;

        const withUsername = data.with;
        const key = dmKey(sender.username, withUsername);
        const history = (dmHistory.get(key) || []).map(function(msg) {
            return Object.assign({}, msg, { reactions: reactionSummary(msg.id) });
        });

        socket.emit('dm_history', { with: withUsername, messages: history });
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

connectDB().then(function() {
    server.listen(PORT, function() {
        console.log('Chat Server running at http://localhost:' + PORT);
    });
});