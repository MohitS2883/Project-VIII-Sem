import mongoose from "mongoose";

const FlightBookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 100
    },
    from: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 100,
        // You could add a regex here if you want to restrict to airport codes or city names
    },
    to: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 100,
    },
    airline: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50,
    },
    dateOfJourney: {
        type: Date,
        required: true,
        validate: {
            validator: function(value) {
                return value >= new Date();
            },
            message: 'Journey date must be today or in the future.'
        }
    },
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    }
}, {
    timestamps: true
});

export const FlightBooking = mongoose.model('FlightBooking', FlightBookingSchema);
