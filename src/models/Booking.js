const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },
  totalCost: {
    type: Number,
    required: true,
  },
  note: {
    type: String,
  },
  status: {
    type: String,
    enum: ["confirmed", "cancelled"],
    default: "confirmed",
  }
}, {
  timestamps: true
});

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;
