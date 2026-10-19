const mongoose = require('mongoose');
const ref = (r) => ({ type: mongoose.Schema.Types.ObjectId, ref: r, required: true });
module.exports = mongoose.model('Comment', new mongoose.Schema({
  task:   ref('Task'),
  author: ref('User'),
  text:   { type: String, required: true, trim: true, maxlength: 500 }
}, { timestamps: true }));
