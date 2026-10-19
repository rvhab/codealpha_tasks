const Task = require('../models/Task');
const Comment = require('../models/Comment');

const fmtProject = p => ({
  id: p._id, name: p.name, color: p.color, owner: String(p.owner),
  members: p.members.map(u => ({ id: u._id, username: u.username }))
});

const fmtTask = (t, count) => ({
  id: t._id, project: t.project, title: t.title, description: t.description,
  status: t.status, priority: t.priority, label: t.label, due: t.due, order: t.order,
  commentsCount: count,
  assignee: t.assignee ? { id: t.assignee._id, username: t.assignee.username } : null
});

async function taskOut(t) {
  await t.populate('assignee', 'username');
  return fmtTask(t, await Comment.countDocuments({ task: t._id }));
}

async function tasksOut(tasks) {
  await Task.populate(tasks, { path: 'assignee', select: 'username' });
  const agg = await Comment.aggregate([
    { $match: { task: { $in: tasks.map(t => t._id) } } },
    { $group: { _id: '$task', n: { $sum: 1 } } }
  ]);
  const m = Object.fromEntries(agg.map(a => [String(a._id), a.n]));
  return tasks.map(t => fmtTask(t, m[String(t._id)] || 0));
}

const fmtComment = (c, uid) => ({
  id: c._id, text: c.text, createdAt: c.createdAt,
  author: { id: c.author._id, username: c.author.username },
  isMine: String(c.author._id) === String(uid)
});

module.exports = { fmtProject, taskOut, tasksOut, fmtComment };
