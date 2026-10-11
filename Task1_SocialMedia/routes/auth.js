const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const makeToken = id => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const publicUser = u => ({ id: u._id, username: u.username, email: u.email, bio: u.bio });

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: 'All fields are required' });
    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const exists = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (exists) return res.status(400).json({ message: 'Username or email already in use' });

    const user = await User.create({ username, email, password: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: makeToken(user._id), user: publicUser(user) });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase() });
    if (!user || !(await bcrypt.compare(password || '', user.password)))
      return res.status(400).json({ message: 'Invalid email or password' });

    res.json({ token: makeToken(user._id), user: publicUser(user) });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(publicUser(user));
  } catch (err) { next(err); }
});

module.exports = router;
