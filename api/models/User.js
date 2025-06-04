import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true, // to avoid duplicate email signups
    },
    phone: {
        type: String, // use string to allow things like "+91..."
        required: false,
    },
    age: {
        type: Number,
        required: false,
    }
}, { timestamps: true });

const UserModel = mongoose.model('User', UserSchema);
export default UserModel;