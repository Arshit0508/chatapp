const express = require('express');
const Room = require('../models/Room');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async function(req, res) {
    try {
        const rooms = await Room.find()
            .sort({ name: 1 })
            .select('name displayName');

        res.json({
            rooms: rooms
        });

    } catch (error) {
        console.error('Get rooms error:', error.message);

        res.status(500).json({
            message: 'Server error'
        });
    }
});

module.exports = router;