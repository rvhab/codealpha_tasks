const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const auth = require('../middleware/auth');

const token = id => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const pub = u => ({ id: u._id, username: u.username, email: u.email });

router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: 'All fields are required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    if (await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] }))
      return res.status(400).json({ message: 'Username or email already in use' });

    const user = await User.create({ username, email, password: await bcrypt.hash(password, 10) });

    // New users join the demo projects so the boards are not empty
    const demo = await Project.find({ demo: true });
    await Project.updateMany({ demo: true }, { $addToSet: { members: user._id } });
    if (demo[0]) await Task.create({
      project: demo[0]._id, title: 'Welcome! Drag this card to another column', status: 'todo',
      description: 'Open a task to change its assignee, priority or due date, and leave a comment.',
      label: 'Docs', assignee: user._id, createdBy: demo[0].owner
    });
    res.status(201).json({ token: token(user._id), user: pub(user) });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const user = await User.findOne({ email: (req.body.email || '').toLowerCase() });
    if (!user || !(await bcrypt.compare(req.body.password || '', user.password)))
      return res.status(400).json({ message: 'Invalid email or password' });
    res.json({ token: token(user._id), user: pub(user) });
  } catch (err) { next(err); }
});

router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(pub(user));
  } catch (err) { next(err); }
});

module.exports = router;
