const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const sessions = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join', ({ user_id, session_id }) => {
    socket.user_id = user_id;
    socket.session_id = session_id;

    if (!sessions.has(session_id)) {
      sessions.set(session_id, new Set());
    }
    sessions.get(session_id).add(socket.id);
    socket.join(session_id);

    io.to(session_id).emit('user_joined', { user_id, socket_id: socket.id });
  });

  socket.on('offer', ({ offer, to }) => {
    io.to(to).emit('offer', { offer, from: socket.id });
  });

  socket.on('answer', ({ answer, to }) => {
    io.to(to).emit('answer', { answer, from: socket.id });
  });

  socket.on('ice_candidate', ({ candidate, to }) => {
    io.to(to).emit('ice_candidate', { candidate, from: socket.id });
  });

  socket.on('screen_sharing', ({ isSharing }) => {
    io.to(socket.session_id).emit('screen_sharing', {
      user_id: socket.user_id,
      socket_id: socket.id,
      isSharing,
    });
  });

  socket.on('chat_message', ({ message }) => {
    io.to(socket.session_id).emit('chat_message', {
      user_id: socket.user_id,
      message,
      timestamp: new Date().toLocaleTimeString(),
    });
  });

  socket.on('disconnect', () => {
    if (socket.session_id) {
      const session = sessions.get(socket.session_id);
      if (session) {
        session.delete(socket.id);
        if (session.size === 0) sessions.delete(socket.session_id);
        io.to(socket.session_id).emit('user_left', {
          user_id: socket.user_id,
          socket_id: socket.id,
        });
      }
    }
    console.log(`User disconnected: ${socket.id}`);
  });
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});