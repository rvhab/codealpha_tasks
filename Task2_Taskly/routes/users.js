const router = require('express').Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// GET /api/users  -> everyone (used to invite people to a project)
router.get('/', auth, async (req, res, next) => {
  try {
    const users = await User.find().sort({ username: 1 }).limit(100).select('username');
    res.json(users.map(u => ({ id: u._id, username: u.username })));
  } catch (err) { next(err); }
});

module.exports = router;
