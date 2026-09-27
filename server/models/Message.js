const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
    {
        room: {
    type: String,
    trim: true
},

from: {
    type: String,
    trim: true
},

to: {
    type: String,
    trim: true
},

        username: {
            type: String,
            
            trim: true
        },

        text: {
            type: String,
            required: true,
            trim: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Message', messageSchema);