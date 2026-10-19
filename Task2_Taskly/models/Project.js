const mongoose = require('mongoose');
const id = { type: mongoose.Schema.Types.ObjectId, ref: 'User' };
module.exports = mongoose.model('Project', new mongoose.Schema({
  name:    { type: String, required: true, trim: true, maxlength: 60 },
  color:   { type: String, default: '#4F46E5' },
  owner:   { ...id, required: true },
  members: [id],
  demo:    { type: Boolean, default: false }
}, { timestamps: true }));
