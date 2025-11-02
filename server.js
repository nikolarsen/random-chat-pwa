const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const onlineUsers = new Map();

io.on('connection', socket => {
  socket.on('join', ({ userId, mode, avatar }) => {
    onlineUsers.set(userId, { socket, mode, avatar });
    socket.userId = userId;
  });

  socket.on('findPartner', userId => {
    const user = onlineUsers.get(userId);
    if (!user) return;
    const candidates = [...onlineUsers.values()].filter(
      u => u !== user && u.mode === user.mode
    );
    if (candidates.length === 0) {
      socket.emit('noPartner');
      return;
    }
    const partner = candidates[Math.floor(Math.random() * candidates.length)];
    user.socket.emit('partnerFound', { partnerId: partner.socket.userId, avatar: partner.avatar });
    partner.socket.emit('partnerFound', { partnerId: userId, avatar: user.avatar });
  });

  socket.on('offer', data => {
    const partner = onlineUsers.get(data.partnerId);
    if (partner) partner.socket.emit('offer', { sdp: data.sdp, from: socket.userId });
  });

  socket.on('answer', data => {
    const partner = onlineUsers.get(data.partnerId);
    if (partner) partner.socket.emit('answer', { sdp: data.sdp, from: socket.userId });
  });

  socket.on('ice-candidate', data => {
    const partner = onlineUsers.get(data.partnerId);
    if (partner) partner.socket.emit('ice-candidate', { candidate: data.candidate, from: socket.userId });
  });

  socket.on('disconnect', () => {
    if (socket.userId) onlineUsers.delete(socket.userId);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Server running');
});
