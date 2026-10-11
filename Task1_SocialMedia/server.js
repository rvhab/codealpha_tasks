require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '6mb' }));
fs.mkdirSync(path.join(__dirname, 'public', 'uploads'), { recursive: true });

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/posts', require('./routes/posts'));
app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error' });
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('MongoDB connected');
  const User = require('./models/User');
  if (!(await User.exists({ username: 'ayesha_k' }))) {
    await require('./seed')();
    console.log('Demo users, posts and comments created (password: password123)');
  }
  await require('./seed').ensureAvatars();
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}).catch(err => console.error('MongoDB connection failed:', err.message));
