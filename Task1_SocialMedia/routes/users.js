const router = require('express').Router();
const User = require('../models/User');
const Post = require('../models/Post');
const auth = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS = path.join(__dirname, '..', 'public', 'uploads');
function saveAvatar(dataUrl) {
  const m = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw Object.assign(new Error('Invalid image'), { status: 400 });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 3 * 1024 * 1024) throw Object.assign(new Error('Image too large (max 3MB)'), { status: 400 });
  const name = 'av_' + crypto.randomBytes(8).toString('hex') + '.' + (m[1] === 'png' ? 'png' : m[1] === 'webp' ? 'webp' : 'jpg');
  fs.mkdirSync(UPLOADS, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  return '/uploads/' + name;
}

const card = (u, me) => ({
  id: u._id, username: u.username, bio: u.bio, avatar: u.avatar || '',
  followersCount: u.followers.length,
  isFollowing: u.followers.some(f => f.equals(me))
});

// PUT /api/users/me
router.put('/me', auth, async (req, res, next) => {
  try {
    const me = await User.findById(req.userId);
    me.bio = (req.body.bio || '').slice(0, 160);
    if (req.body.avatar) {
      const old = me.avatar || '';
      me.avatar = saveAvatar(req.body.avatar);
      if (old.startsWith('/uploads/')) fs.unlink(path.join(UPLOADS, path.basename(old)), () => {});
    }
    await me.save();
    res.json({ id: me._id, username: me.username, bio: me.bio, avatar: me.avatar });
  } catch (err) { err.status ? res.status(err.status).json({ message: err.message }) : next(err); }
});

// GET /api/users/search?q=
router.get('/search', auth, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await User.find({ username: new RegExp(safe, 'i'), _id: { $ne: req.userId } }).limit(8);
    res.json(users.map(u => card(u, req.userId)));
  } catch (err) { next(err); }
});

// GET /api/users/suggestions?limit=5  -> people you don't follow yet
router.get('/suggestions', auth, async (req, res, next) => {
  try {
    const me = await User.findById(req.userId);
    const users = await User.find({ _id: { $nin: [me._id, ...me.following] } });
    users.sort((a, b) => b.followers.length - a.followers.length);
    res.json(users.slice(0, parseInt(req.query.limit) || 5).map(u => card(u, req.userId)));
  } catch (err) { next(err); }
});

// GET /api/users/all  -> everyone else (Explore page)
router.get('/all', auth, async (req, res, next) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } }).limit(60);
    res.json(users.map(u => card(u, req.userId)));
  } catch (err) { next(err); }
});

// GET /api/users/:username
router.get('/:username', auth, async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      id: user._id, username: user.username, bio: user.bio, avatar: user.avatar || '', joined: user.createdAt,
      postsCount: await Post.countDocuments({ author: user._id }),
      followersCount: user.followers.length, followingCount: user.following.length,
      isFollowing: user.followers.some(f => f.equals(req.userId)),
      isMe: user._id.equals(req.userId)
    });
  } catch (err) { next(err); }
});

// POST /api/users/:id/follow  (toggle)
router.post('/:id/follow', auth, async (req, res, next) => {
  try {
    if (req.params.id === req.userId) return res.status(400).json({ message: "You can't follow yourself" });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });
    const already = target.followers.some(f => f.equals(req.userId));
    const op = already ? '$pull' : '$addToSet';
    await User.findByIdAndUpdate(target._id, { [op]: { followers: req.userId } });
    await User.findByIdAndUpdate(req.userId, { [op]: { following: target._id } });
    const updated = await User.findById(target._id);
    res.json({ following: !already, followersCount: updated.followers.length });
  } catch (err) { next(err); }
});

module.exports = router;
