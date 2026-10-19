const Notification = require('../models/Notification');

const fmt = n => ({
  id: n._id, type: n.type, text: n.text, read: n.read, createdAt: n.createdAt,
  actor: n.actor ? n.actor.username : null, project: n.project, task: n.task
});

async function notify(io, { to, actor, type, text, project, task }) {
  if (String(to) === String(actor)) return;
  const n = await Notification.create({ user: to, actor, type, text, project, task });
  await n.populate('actor', 'username');
  io.to('user:' + to).emit('notification', fmt(n));
}

module.exports = notify;
module.exports.fmt = fmt;
