const express = require('express');
const router = express.Router();
const {
  createRoom,
  getRooms,
  getLatestRooms,
  getRoomById,
  updateRoom,
  deleteRoom
} = require('../controllers/roomController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .get(getRooms)
  .post(protect, createRoom);

router.get('/latest', getLatestRooms);

router.route('/:id')
  .get(getRoomById)
  .put(protect, updateRoom)
  .delete(protect, deleteRoom);

module.exports = router;
