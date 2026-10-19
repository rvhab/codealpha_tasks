const router = require('express').Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const { fmt } = require('../utils/notify');

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const list = await Notification.find({ user: req.userId }).sort({ createdAt: -1 }).limit(30).populate('actor', 'username');
    res.json({ items: list.map(fmt), unread: await Notification.countDocuments({ user: req.userId, read: false }) });
  } catch (err) { next(err); }
});

router.post('/read', async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.userId, read: false }, { read: true });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
