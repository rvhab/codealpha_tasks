const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username:  { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true },
  bio:       { type: String, default: '', maxlength: 160 },
  avatar:    { type: String, default: '' },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
