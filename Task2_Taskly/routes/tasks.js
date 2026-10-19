const router = require('express').Router();
const mongoose = require('mongoose');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Comment = require('../models/Comment');
const auth = require('../middleware/auth');
const notify = require('../utils/notify');
const { taskOut, fmtComment } = require('../utils/format');

router.use(auth);

const STATUS = { todo: 'To do', prog: 'In progress', rev: 'In review', done: 'Done' };

// Loads a task and checks the user is a member of its project
async function load(req, res) {
  const t = mongoose.isValidObjectId(req.params.id) && await Task.findById(req.params.id);
  const p = t && await Project.findById(t.project);
  if (!t || !p) { res.status(404).json({ message: 'Task not found' }); return {}; }
  if (!p.members.some(m => m.equals(req.userId))) { res.status(403).json({ message: 'You are not a member of this project' }); return {}; }
  return { t, p };
}

// PATCH /api/tasks/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { t, p } = await load(req, res); if (!t) return;
    const b = req.body, io = req.app.get('io');
    const oldAssignee = String(t.assignee || ''), oldStatus = t.status;

    if (typeof b.title === 'string') { if (!b.title.trim()) return res.status(400).json({ message: 'Title cannot be empty' }); t.title = b.title.trim().slice(0, 120); }
    if (typeof b.description === 'string') t.description = b.description.slice(0, 2000);
    if (['high', 'med', 'low'].includes(b.priority)) t.priority = b.priority;
    if (typeof b.label === 'string' && b.label) t.label = b.label;
    if (typeof b.due === 'string') t.due = b.due;
    if (STATUS[b.status] && b.status !== t.status) { t.status = b.status; t.order = Date.now(); }
    if ('assignee' in b) {
      if (b.assignee && !p.members.some(m => String(m) === String(b.assignee)))
        return res.status(400).json({ message: 'Assignee must be a project member' });
      t.assignee = b.assignee || null;
    }
    await t.save();

    const out = await taskOut(t);
    io.to('project:' + p._id).emit('task:updated', out);
    if (String(t.assignee || '') !== oldAssignee && t.assignee)
      await notify(io, { to: t.assignee, actor: req.userId, type: 'assigned', text: `assigned you ${t.title}`, project: p._id, task: t._id });
    else if (t.status !== oldStatus && t.assignee)
      await notify(io, { to: t.assignee, actor: req.userId, type: 'moved', text: `moved ${t.title} to ${STATUS[t.status]}`, project: p._id, task: t._id });
    res.json(out);
  } catch (err) { next(err); }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { t, p } = await load(req, res); if (!t) return;
    await Comment.deleteMany({ task: t._id });
    await t.deleteOne();
    req.app.get('io').to('project:' + p._id).emit('task:deleted', { id: t._id, project: p._id });
    res.json({ message: 'Task deleted' });
  } catch (err) { next(err); }
});

// GET /api/tasks/:id/comments
router.get('/:id/comments', async (req, res, next) => {
  try {
    const { t } = await load(req, res); if (!t) return;
    const cs = await Comment.find({ task: t._id }).sort({ createdAt: 1 }).populate('author', 'username');
    res.json(cs.map(c => fmtComment(c, req.userId)));
  } catch (err) { next(err); }
});

// POST /api/tasks/:id/comments
router.post('/:id/comments', async (req, res, next) => {
  try {
    const { t, p } = await load(req, res); if (!t) return;
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ message: 'Comment cannot be empty' });
    const c = await Comment.create({ task: t._id, author: req.userId, text: text.slice(0, 500) });
    await c.populate('author', 'username');
    const io = req.app.get('io');
    io.to('project:' + p._id).emit('comment:created', { task: t._id, comment: fmtComment(c, '') });
    for (const to of new Set([String(t.assignee || ''), String(t.createdBy || '')].filter(Boolean)))
      await notify(io, { to, actor: req.userId, type: 'comment', text: `commented on ${t.title}`, project: p._id, task: t._id });
    res.status(201).json(fmtComment(c, req.userId));
  } catch (err) { next(err); }
});

// DELETE /api/tasks/:id/comments/:cid  (own comments only)
router.delete('/:id/comments/:cid', async (req, res, next) => {
  try {
    const { t, p } = await load(req, res); if (!t) return;
    const c = mongoose.isValidObjectId(req.params.cid) && await Comment.findById(req.params.cid);
    if (!c) return res.status(404).json({ message: 'Comment not found' });
    if (String(c.author) !== req.userId) return res.status(403).json({ message: 'Not your comment' });
    await c.deleteOne();
    req.app.get('io').to('project:' + p._id).emit('comment:deleted', { task: t._id, id: c._id });
    res.json({ message: 'Comment deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
