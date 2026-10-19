const mongoose = require('mongoose');
const ref = (r) => ({ type: mongoose.Schema.Types.ObjectId, ref: r });
module.exports = mongoose.model('Notification', new mongoose.Schema({
  user:    { ...ref('User'), required: true },
  actor:   ref('User'),
  type:    { type: String, enum: ['assigned', 'comment', 'moved', 'invited'], required: true },
  text:    { type: String, required: true },
  project: ref('Project'),
  task:    ref('Task'),
  read:    { type: Boolean, default: false }
}, { timestamps: true }));
