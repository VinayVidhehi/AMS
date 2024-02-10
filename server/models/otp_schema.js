// otpModel.js
const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  otp: {
    type: Number,
    required: true,
  },
});

const OTPModel = mongoose.model('OTPModel', otpSchema);

module.exports = OTPModel;
