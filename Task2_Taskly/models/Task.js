const mongoose = require('mongoose');
const ref = (r) => ({ type: mongoose.Schema.Types.ObjectId, ref: r });
module.exports = mongoose.model('Task', new mongoose.Schema({
  project:     { ...ref('Project'), required: true },
  title:       { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 2000 },
  status:      { type: String, enum: ['todo', 'prog', 'rev', 'done'], default: 'todo' },
  priority:    { type: String, enum: ['high', 'med', 'low'], default: 'med' },
  label:       { type: String, default: 'Docs' },
  assignee:    { ...ref('User'), default: null },
  due:         { type: String, default: '' },
  order:       { type: Number, default: () => Date.now() },
  createdBy:   ref('User')
}, { timestamps: true }));
