const router = require('express').Router();
const mongoose = require('mongoose');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const User = require('../models/User');
const auth = require('../middleware/auth');
const notify = require('../utils/notify');
const { fmtProject, taskOut, tasksOut } = require('../utils/format');

router.use(auth);

// Loads a project and checks the user belongs to it
async function getProject(req, res) {
  const p = mongoose.isValidObjectId(req.params.id) && await Project.findById(req.params.id).populate('members', 'username');
  if (!p) { res.status(404).json({ message: 'Project not found' }); return null; }
  if (!p.members.some(m => m._id.equals(req.userId))) { res.status(403).json({ message: 'You are not a member of this project' }); return null; }
  return p;
}
const fresh = id => Project.findById(id).populate('members', 'username');

// GET /api/projects
router.get('/', async (req, res, next) => {
  try {
    const ps = await Project.find({ members: req.userId }).populate('members', 'username').sort({ createdAt: 1 });
    res.json(ps.map(fmtProject));
  } catch (err) { next(err); }
});

// POST /api/projects  { name, color, members: [userId] }
router.post('/', async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Enter a project name' });
    const ids = [...new Set((req.body.members || []).map(String))].filter(i => mongoose.isValidObjectId(i) && i !== req.userId);
    const users = await User.find({ _id: { $in: ids } }).select('_id');
    const p = await Project.create({
      name: name.slice(0, 60), owner: req.userId, members: [req.userId, ...users.map(u => u._id)],
      color: /^#[0-9a-f]{6}$/i.test(req.body.color) ? req.body.color : '#4F46E5'
    });
    const out = fmtProject(await fresh(p._id));
    const io = req.app.get('io');
    io.in('user:' + req.userId).socketsJoin('project:' + p._id);
    for (const u of users) {
      io.in('user:' + u._id).socketsJoin('project:' + p._id);
      io.to('user:' + u._id).emit('project:added', out);
      await notify(io, { to: u._id, actor: req.userId, type: 'invited', text: `added you to ${p.name}`, project: p._id });
    }
    res.status(201).json(out);
  } catch (err) { next(err); }
});

// DELETE /api/projects/:id  (owner only)
router.delete('/:id', async (req, res, next) => {
  try {
    const p = await getProject(req, res); if (!p) return;
    if (String(p.owner) !== req.userId) return res.status(403).json({ message: 'Only the owner can delete a project' });
    const ids = (await Task.find({ project: p._id }).select('_id')).map(t => t._id);
    await Comment.deleteMany({ task: { $in: ids } });
    await Task.deleteMany({ project: p._id });
    await p.deleteOne();
    const io = req.app.get('io');
    io.to('project:' + p._id).emit('project:deleted', { id: p._id });
    io.in('project:' + p._id).socketsLeave('project:' + p._id);
    res.json({ message: 'Project deleted' });
  } catch (err) { next(err); }
});

// POST /api/projects/:id/members  { userId }  (any member can invite)
router.post('/:id/members', async (req, res, next) => {
  try {
    const p = await getProject(req, res); if (!p) return;
    const uid = req.body.userId;
    const u = mongoose.isValidObjectId(uid) && await User.findById(uid);
    if (!u) return res.status(404).json({ message: 'User not found' });
    if (p.members.some(m => m._id.equals(u._id))) return res.status(400).json({ message: 'Already a member' });
    await Project.updateOne({ _id: p._id }, { $addToSet: { members: u._id } });
    const out = fmtProject(await fresh(p._id));
    const io = req.app.get('io');
    io.in('user:' + u._id).socketsJoin('project:' + p._id);
    io.to('user:' + u._id).emit('project:added', out);
    io.to('project:' + p._id).emit('project:updated', out);
    await notify(io, { to: u._id, actor: req.userId, type: 'invited', text: `added you to ${p.name}`, project: p._id });
    res.json(out);
  } catch (err) { next(err); }
});

// DELETE /api/projects/:id/members/:userId  (owner only)
router.delete('/:id/members/:userId', async (req, res, next) => {
  try {
    const p = await getProject(req, res); if (!p) return;
    if (String(p.owner) !== req.userId) return res.status(403).json({ message: 'Only the owner can remove members' });
    if (req.params.userId === String(p.owner)) return res.status(400).json({ message: "The owner can't be removed" });
    await Project.updateOne({ _id: p._id }, { $pull: { members: req.params.userId } });
    await Task.updateMany({ project: p._id, assignee: req.params.userId }, { assignee: null });
    const out = fmtProject(await fresh(p._id));
    const io = req.app.get('io');
    io.to('project:' + p._id).emit('project:updated', out);
    io.to('user:' + req.params.userId).emit('project:removed', { id: p._id });
    io.in('user:' + req.params.userId).socketsLeave('project:' + p._id);
    res.json(out);
  } catch (err) { next(err); }
});

// GET /api/projects/:id/tasks
router.get('/:id/tasks', async (req, res, next) => {
  try {
    const p = await getProject(req, res); if (!p) return;
    res.json(await tasksOut(await Task.find({ project: p._id }).sort({ order: 1 })));
  } catch (err) { next(err); }
});

// POST /api/projects/:id/tasks
router.post('/:id/tasks', async (req, res, next) => {
  try {
    const p = await getProject(req, res); if (!p) return;
    const b = req.body, title = (b.title || '').trim();
    if (!title) return res.status(400).json({ message: 'Enter a task title' });
    const assignee = b.assignee && p.members.some(m => String(m._id) === String(b.assignee)) ? b.assignee : null;
    const t = await Task.create({
      project: p._id, title: title.slice(0, 120), assignee, createdBy: req.userId,
      status: ['todo', 'prog', 'rev', 'done'].includes(b.status) ? b.status : 'todo',
      priority: ['high', 'med', 'low'].includes(b.priority) ? b.priority : 'med',
      label: b.label || 'Docs', due: b.due || '', description: (b.description || '').slice(0, 2000)
    });
    const out = await taskOut(t);
    const io = req.app.get('io');
    io.to('project:' + p._id).emit('task:created', out);
    if (assignee) await notify(io, { to: assignee, actor: req.userId, type: 'assigned', text: `assigned you ${t.title}`, project: p._id, task: t._id });
    res.status(201).json(out);
  } catch (err) { next(err); }
});

module.exports = router;
