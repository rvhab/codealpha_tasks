const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const auth = require('../middleware/auth');

router.use(auth);

const EXT = { png: 'png', jpeg: 'jpg', jpg: 'jpg', webp: 'webp', gif: 'gif' };
const UPLOADS = path.join(__dirname, '..', 'public', 'uploads');

function saveImage(dataUrl) {
  const m = /^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw Object.assign(new Error('Invalid image'), { status: 400 });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 4 * 1024 * 1024) throw Object.assign(new Error('Image too large (max 4MB)'), { status: 400 });
  const name = crypto.randomBytes(8).toString('hex') + '.' + EXT[m[1]];
  fs.mkdirSync(UPLOADS, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  return '/uploads/' + name;
}

const POPULATE = q => q.populate('author', 'username avatar').populate('likes', 'username');

async function format(post, userId) {
  const ids = post.likes.map(l => String(l._id || l));
  return {
    id: post._id, content: post.content, image: post.image, createdAt: post.createdAt,
    author: { id: post.author._id, username: post.author.username, avatar: post.author.avatar || '' },
    likesCount: ids.length,
    firstLiker: (post.likes[0] && post.likes[0].username) || null,
    liked: ids.includes(String(userId)),
    commentsCount: await Comment.countDocuments({ post: post._id }),
    isMine: post.author._id.equals(userId)
  };
}
const formatMany = (posts, userId) => Promise.all(posts.map(p => format(p, userId)));
const fail = (err, res, next) => err.status ? res.status(err.status).json({ message: err.message }) : next(err);

// POST /api/posts   { content?, image? (data URL) }
router.post('/', async (req, res, next) => {
  try {
    const content = (req.body.content || '').trim();
    if (!content && !req.body.image) return res.status(400).json({ message: 'Write something or add a photo' });
    if (content.length > 500) return res.status(400).json({ message: 'Max 500 characters' });
    const image = req.body.image ? saveImage(req.body.image) : '';
    const post = await Post.create({ author: req.userId, content, image });
    await post.populate('author', 'username avatar');
    res.status(201).json(await format(post, req.userId));
  } catch (err) { fail(err, res, next); }
});

// GET /api/posts?feed=following&page=1
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const filter = {};
    if (req.query.feed === 'following') {
      const me = await User.findById(req.userId);
      filter.author = { $in: [...me.following, me._id] };
    }
    const posts = await POPULATE(Post.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 10).limit(10));
    res.json(await formatMany(posts, req.userId));
  } catch (err) { next(err); }
});

// GET /api/posts/user/:username
router.get('/user/:username', async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const posts = await POPULATE(Post.find({ author: user._id }).sort({ createdAt: -1 }));
    res.json(await formatMany(posts, req.userId));
  } catch (err) { next(err); }
});

// DELETE /api/posts/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (!post.author.equals(req.userId)) return res.status(403).json({ message: 'Not your post' });
    if (post.image.startsWith('/uploads/')) fs.unlink(path.join(UPLOADS, path.basename(post.image)), () => {});
    await Comment.deleteMany({ post: post._id });
    await post.deleteOne();
    res.json({ message: 'Post deleted' });
  } catch (err) { next(err); }
});

// POST /api/posts/:id/like (toggle)
router.post('/:id/like', async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const liked = post.likes.some(l => l.equals(req.userId));
    if (liked) post.likes.pull(req.userId); else post.likes.addToSet(req.userId);
    await post.save();
    res.json({ liked: !liked, likesCount: post.likes.length });
  } catch (err) { next(err); }
});

const fmtComment = (c, userId) => ({
  id: c._id, text: c.text, createdAt: c.createdAt,
  author: { id: c.author._id, username: c.author.username, avatar: c.author.avatar || '' }, isMine: c.author._id.equals(userId)
});

router.get('/:id/comments', async (req, res, next) => {
  try {
    const cs = await Comment.find({ post: req.params.id }).sort({ createdAt: 1 }).populate('author', 'username avatar');
    res.json(cs.map(c => fmtComment(c, req.userId)));
  } catch (err) { next(err); }
});

router.post('/:id/comments', async (req, res, next) => {
  try {
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ message: 'Comment cannot be empty' });
    if (!(await Post.exists({ _id: req.params.id }))) return res.status(404).json({ message: 'Post not found' });
    const c = await Comment.create({ post: req.params.id, author: req.userId, text });
    await c.populate('author', 'username avatar');
    res.status(201).json(fmtComment(c, req.userId));
  } catch (err) { next(err); }
});

router.delete('/:postId/comments/:commentId', async (req, res, next) => {
  try {
    const c = await Comment.findById(req.params.commentId);
    if (!c) return res.status(404).json({ message: 'Comment not found' });
    if (!c.author.equals(req.userId)) return res.status(403).json({ message: 'Not your comment' });
    await c.deleteOne();
    res.json({ message: 'Comment deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
