const Room = require('../models/Room');
const Booking = require('../models/Booking');

// @desc    Create a new room
// @route   POST /api/rooms
// @access  Private
const createRoom = async (req, res, next) => {
  try {
    const { name, description, image, floor, capacity, hourlyRate, amenities } = req.body;

    const room = new Room({
      name,
      description,
      image,
      floor,
      capacity,
      hourlyRate,
      amenities,
      owner: req.user._id,
    });

    const createdRoom = await room.save();

    res.status(201).json({
      success: true,
      data: createdRoom
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all rooms with filtering and search
// @route   GET /api/rooms
// @access  Public
const getRooms = async (req, res, next) => {
  try {
    const { search, amenities } = req.query;

    let query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (amenities) {
      // Split comma separated amenities into an array
      const amenitiesArray = amenities.split(',').map(item => item.trim());
      query.amenities = { $in: amenitiesArray };
    }

    const rooms = await Room.find(query);

    res.status(200).json({
      success: true,
      data: rooms
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get latest rooms
// @route   GET /api/rooms/latest
// @access  Public
const getLatestRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find().sort({ createdAt: -1 }).limit(6);

    res.status(200).json({
      success: true,
      data: rooms
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single room
// @route   GET /api/rooms/:id
// @access  Public
const getRoomById = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id).populate('owner', 'name email');

    if (room) {
      res.status(200).json({
        success: true,
        data: room
      });
    } else {
      res.status(404);
      throw new Error('Room not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update room
// @route   PUT /api/rooms/:id
// @access  Private
const updateRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      res.status(404);
      throw new Error('Room not found');
    }

    // Check ownership
    if (room.owner.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('User is not authorized to update this room');
    }

    const updatedRoom = await Room.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedRoom
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete room
// @route   DELETE /api/rooms/:id
// @access  Private
const deleteRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      res.status(404);
      throw new Error('Room not found');
    }

    // Check ownership
    if (room.owner.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('User is not authorized to delete this room');
    }

    // Delete associated bookings
    await Booking.deleteMany({ roomId: room._id });
    
    // Removing references from users who booked this room could be added here
    // e.g., User.updateMany({ bookings: { $in: bookingIds } }, { $pull: { bookings: { $in: bookingIds } } })

    await room.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Room removed'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRoom,
  getRooms,
  getLatestRooms,
  getRoomById,
  updateRoom,
  deleteRoom
};
