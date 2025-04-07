const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // Allow all origins for testing (adjust for production)
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const sessions = new Map(); // session_id -> Set of socket_ids
const userSessions = new Map(); // socket_id -> { user_id, session_id }

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join', ({ user_id, session_id }) => {
    if (!user_id || !session_id) {
      console.error(`Invalid join data for socket ${socket.id}: user_id=${user_id}, session_id=${session_id}`);
      socket.emit('error', 'Invalid user_id or session_id');
      return;
    }

    // Store user session data
    userSessions.set(socket.id, { user_id, session_id });

    if (!sessions.has(session_id)) {
      sessions.set(session_id, new Set());
    }
    sessions.get(session_id).add(socket.id);
    socket.join(session_id);

    // Notify all other users in the session about the new user
    socket.to(session_id).emit('user_joined', { user_id, socket_id: socket.id });
    console.log(`User ${user_id} joined session ${session_id} with socket ${socket.id}`);
  });

  socket.on('offer', ({ offer, to }) => {
    console.log(`Relaying offer from ${socket.id} to ${to}`);
    io.to(to).emit('offer', { offer, from: socket.id });
  });

  socket.on('answer', ({ answer, to }) => {
    console.log(`Relaying answer from ${socket.id} to ${to}`);
    io.to(to).emit('answer', { answer, from: socket.id });
  });

  socket.on('ice_candidate', ({ candidate, to }) => {
    console.log(`Relaying ICE candidate from ${socket.id} to ${to}`);
    io.to(to).emit('ice_candidate', { candidate, from: socket.id });
  });

  socket.on('screen_sharing', ({ isSharing, user_id }) => {
    const sessionData = userSessions.get(socket.id);
    if (!sessionData) {
      console.error(`No session data for socket ${socket.id}`);
      return;
    }
    const currentUserId = sessionData.user_id;
    console.log(`Screen sharing update from ${socket.id} (${currentUserId}): isSharing=${isSharing}, user_id=${user_id}`);
    if (user_id && user_id !== currentUserId) {
      console.warn(`User_id mismatch for ${socket.id}: expected ${currentUserId}, got ${user_id}`);
    }
    // Use the stored user_id to ensure consistency
    socket.to(sessionData.session_id).emit('screen_sharing', {
      socket_id: socket.id,
      isSharing,
      user_id: currentUserId,
    });
    socket.emit('screen_sharing', {
      socket_id: socket.id,
      isSharing,
      user_id: currentUserId,
    });
  });

  socket.on('chat_message', ({ message }) => {
    const sessionData = userSessions.get(socket.id);
    if (sessionData) {
      io.to(sessionData.session_id).emit('chat_message', {
        user_id: sessionData.user_id,
        message,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  });

  socket.on('disconnect', () => {
    const sessionData = userSessions.get(socket.id);
    if (sessionData && sessions.has(sessionData.session_id)) {
      const session = sessions.get(sessionData.session_id);
      session.delete(socket.id);
      if (session.size === 0) sessions.delete(sessionData.session_id);
      io.to(sessionData.session_id).emit('user_left', {
        user_id: sessionData.user_id,
        socket_id: socket.id,
      });
      console.log(`User ${sessionData.user_id} disconnected from session ${sessionData.session_id} with socket ${socket.id}`);
    }
    userSessions.delete(socket.id);
    console.log(`User disconnected: ${socket.id}`);
  });
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});