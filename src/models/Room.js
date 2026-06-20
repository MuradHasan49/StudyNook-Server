const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  image: {
    type: String,
  },
  floor: {
    type: String,
    required: true,
  },
  capacity: {
    type: Number,
    required: true,
  },
  hourlyRate: {
    type: Number,
    required: true,
  },
  amenities: [{
    type: String
  }],
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  bookingCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const Room = mongoose.model('Room', roomSchema);
module.exports = Room;
