const express = require('express');
const User = require('../models/User');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/profile', authenticateToken, async function(req, res) {
    try {
        const user = await User.findById(req.user.userId)
            .select('-password');

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        res.json({
            user: user
        });

    } catch (error) {
        console.error('Get profile error:', error.message);

        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.put('/profile', authenticateToken, async function(req, res) {
    try {
        const { displayName, bio } = req.body;

        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        if (displayName !== undefined) {
            user.profile.displayName = displayName.trim();
        }

        if (bio !== undefined) {
            user.profile.bio = bio.trim();
        }

        await user.save();

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                profile: user.profile
            }
        });

    } catch (error) {
        console.error('Update profile error:', error.message);

        res.status(500).json({
            message: 'Server error'
        });
    }
});

module.exports = router;