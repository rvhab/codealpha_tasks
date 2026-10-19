require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const path = require('path');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.set('io', io);
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/notifications', require('./routes/notifications'));
app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error' });
});

// WebSockets: every user joins a room for themself and one for each project they belong to
io.use((socket, next) => {
  try {
    socket.userId = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET).id;
    next();
  } catch { next(new Error('Not authorised')); }
});
io.on('connection', async socket => {
  socket.join('user:' + socket.userId);
  const projects = await require('./models/Project').find({ members: socket.userId }).select('_id');
  projects.forEach(p => socket.join('project:' + p._id));
});

const PORT = process.env.PORT || 5001;
mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('MongoDB connected');
  if (!(await require('./models/User').exists({ username: 'ayesha_k' }))) {
    await require('./seed')();
    console.log('Demo users and projects created (password: password123)');
  }
  server.listen(PORT, () => console.log(`Taskly running on http://localhost:${PORT}`));
}).catch(err => console.error('MongoDB connection failed:', err.message));
