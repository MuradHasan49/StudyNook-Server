const Booking = require('../models/Booking');
const Room = require('../models/Room');
const User = require('../models/User');

// @desc    Create a new booking
// @route   POST /api/bookings
// @access  Private
const createBooking = async (req, res, next) => {
  try {
    const { roomId, date, startTime, endTime, note } = req.body;

    const room = await Room.findById(roomId);

    if (!room) {
      res.status(404);
      throw new Error('Room not found');
    }

    // Check for booking conflict
    const conflictingBooking = await Booking.findOne({
      roomId,
      date,
      status: 'confirmed',
      $or: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime }
        }
      ]
    });

    if (conflictingBooking) {
      res.status(400);
      throw new Error('Room is already booked for the selected time slot');
    }

    // Calculate duration in hours (assuming HH:mm format)
    const startHour = parseInt(startTime.split(':')[0]);
    const startMin = parseInt(startTime.split(':')[1]) / 60;
    const endHour = parseInt(endTime.split(':')[0]);
    const endMin = parseInt(endTime.split(':')[1]) / 60;
    
    const duration = (endHour + endMin) - (startHour + startMin);
    
    if (duration <= 0) {
      res.status(400);
      throw new Error('Invalid time slot');
    }

    const totalCost = duration * room.hourlyRate;

    const booking = new Booking({
      roomId,
      userId: req.user._id,
      date,
      startTime,
      endTime,
      totalCost,
      note,
    });

    const createdBooking = await booking.save();

    // Increment room booking count
    await Room.findByIdAndUpdate(roomId, { $inc: { bookingCount: 1 } });

    // Add booking to user
    await User.findByIdAndUpdate(req.user._id, { $push: { bookings: createdBooking._id } });

    res.status(201).json({
      success: true,
      data: createdBooking
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get my bookings
// @route   GET /api/bookings/my
// @access  Private
const getMyBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ userId: req.user._id }).populate('roomId', 'name image');

    res.status(200).json({
      success: true,
      data: bookings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel a booking
// @route   PATCH /api/bookings/:id/cancel
// @access  Private
const cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      res.status(404);
      throw new Error('Booking not found');
    }

    // Verify ownership
    if (booking.userId.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Not authorized to cancel this booking');
    }

    if (booking.status === 'cancelled') {
      res.status(400);
      throw new Error('Booking is already cancelled');
    }

    booking.status = 'cancelled';
    await booking.save();

    // Decrease room booking count
    await Room.findByIdAndUpdate(booking.roomId, { $inc: { bookingCount: -1 } });

    // Remove booking from user's bookings array
    await User.findByIdAndUpdate(req.user._id, { $pull: { bookings: booking._id } });

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  cancelBooking
};
