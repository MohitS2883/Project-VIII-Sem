import express from 'express';
import env from 'dotenv';
import mongoose from "mongoose";
import jwt from 'jsonwebtoken'
import User from './models/user.js';
import cors from 'cors';
import cookieParser from "cookie-parser";
import * as bcrypt from 'bcryptjs';
import * as ws from 'ws';
import Message from "./models/Message.js";
import {FlightBooking} from "./models/FlightBooking.js";
import crypto from 'crypto';

const app = express();
app.use(cors({
      origin: 'http://localhost:5173',
      credentials: true
    }
));
app.use(express.json());
app.use(cookieParser())
env.config();
const jwtsecret = process.env.JWT_SECRET;
mongoose.connect(process.env.MONGO_URL)
.then(() => console.log('Connected to MongoDB'))
.catch(e => console.error(e));
const bcryptSalt = bcrypt.genSaltSync(12);

function getUserDateFromRequest(req) {
    return new Promise((resolve, reject) => {
        const token = req.cookies?.token
        if(token) {
            jwt.verify(token, jwtsecret,{}, (err, userData) => {
                if (err) throw err
                resolve(userData)
            })
        } else {
            reject('No token provided')
        }
    })
}
function isFlightMessage(text) {
    return text.includes('flight options') || text.includes('flights');
}

function isHotelMessage(text) {
    return text.includes('Rate per night:') || text.includes('Description:') || text.includes('Rate') || text.includes("hotel options");
}

function isFlightBookingMessage(text) {
    return text.includes('Flight Bookings Summary:')
}

app.get('/', (req, res) => {
    res.send('Hello, Mohit!');
});

app.post('/register', async (req, res) => {
    const { username, password, email, phone, age } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, bcryptSalt);
        const createdUser = await User.create({
            username,
            password: hashedPassword,
            email,
            phone,
            age,
        });

        jwt.sign(
            { userId: createdUser._id, username },
            jwtsecret,
            {},
            (err, token) => {
                if (err) throw err;
                res
                    .cookie('token', token, { sameSite: 'none', secure: true })
                    .status(201)
                    .json({
                        userId: createdUser._id,
                        username: createdUser.username,
                    });
            }
        );
    } catch (e) {
        console.log(e)
        if (e.code === 11000) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        return res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

app.post('/logout', (req, res) => {
    res.cookie('token', '', {
        sameSite: 'none',
        secure: true,
        httpOnly: true
    }).json({ message: 'Logged out' });
});


app.post('/login',async (req,res) => {
    const {username, password} = req.body;
    const foundUser = await User.findOne({username})
    console.log('foundUser:', foundUser);
    if (!foundUser) {
        return res.status(400).json({ error: "User not found" });
    }
    if(foundUser) {
        const passOk = bcrypt.compareSync(password, foundUser.password)
        if(passOk) {
            jwt.sign({
                    userId:foundUser._id,
                    username
                }, jwtsecret,
                {},
                (err,token) => {
                    if(err) throw err;
                    res.cookie(
                        'token' , token, {sameSite:'none',secure:true})
                        .status(201).json({
                        id: foundUser._id, username: foundUser.username })
                },
            )
        }
    }

})

app.get('/profile', (req, res) => {
    const token = req.cookies?.token
    if(token) {
        jwt.verify(token, jwtsecret,{}, (err, userData) => {
            if (err) throw err
            res.json({ userId: userData.userId, username: userData.username })
        })
    } else {
        res.status(401).json({error: 'No token provided'})
    }
})

app.get('/messages/:userId',async (req,res) => {
    const userId = req.params.userId
    const userData = await getUserDateFromRequest(req)
    const ourUserId = userData.userId
    const messages = await Message.find({
        sender: {$in: [ourUserId,userId]},
        recipient: {$in: [ourUserId,userId]},
    })
    res.json(messages)
})

app.get('/people',async(req,res) =>{
    const users = await User.find({},{'_id':1,username:1})
    res.json(users)
})

app.get('/bookings/:userId',async(req,res) => {
    const userData = await getUserDateFromRequest(req)
    const bookings = await FlightBooking.find(
        {user: userData.userId},
    )
    res.json(bookings)
})

app.post('/bookings',async(req,res) => {
    try {
        const { user, name, from, to, airline, dateOfJourney, totalPrice } = req.body;
        const newBooking = new FlightBooking({
            user: user,
            name: name,
            from: from,
            to: to,
            airline: airline,
            dateOfJourney: dateOfJourney,
            totalPrice: totalPrice,
        });
        await newBooking.save();
        res.status(200).json({ message: 'Booking confirmed' });
    } catch (error) {
        console.error('Error in booking:', error);
        res.status(500).json({ error: 'An error occurred, please try again' });
    }
})

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

function verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
    console.log("Inside verify Payment")
    const generated_signature = crypto
        .createHmac('sha256', process.env.RAZORPAYKEYSECRET)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest('hex');

    return generated_signature === razorpay_signature;
}
const wss = new ws.WebSocketServer({server});
wss.on('connection',(connection, req) => {

    function notifyAboutOnlinePeople() {
        Array.from(wss.clients).forEach(currentClient => {
            const onlineUsers = Array.from(wss.clients).map(otherClient => ({
                userId: otherClient.userId,
                username: otherClient.username
            }));

            currentClient.send(JSON.stringify({ online: onlineUsers }));
        });
    }
    // read username and id from the cookie for this connection
    const cookies = req.headers.cookie
    if(cookies) {
        const tokenCookieString = cookies
            .split(';')
            .map(str => str.trim())
            .find(str => str.startsWith('token='))
        if(tokenCookieString) {
            const token = tokenCookieString.split('=')[1]
            jwt.verify(token,jwtsecret,{},(err,userData) => {
                if(err) throw err;
                const {userId,username} = userData;
                connection.userId = userId;
                connection.username = username;
            })
        }
    }
    connection.on('message', async (message) => {
        try {
            const messageData = JSON.parse(message.toString());
            const { recipient, text } = messageData;
            // Skip saving show_payment_ui messages
            if (messageData.action === "show_payment_ui") {
                console.log("Skipping show_payment_ui message:", messageData);
                return;
            }

            if (messageData.type === "payment_success") {
                console.log("✅ Received payment_success on backend:", messageData);
                const {
                    razorpay_order_id,
                    razorpay_payment_id,
                    razorpay_signature,
                    booking_meta
                } = messageData;

                try {
                    const isValid = verifyPaymentSignature({
                        razorpay_order_id,
                        razorpay_payment_id,
                        razorpay_signature
                    });

                    if (isValid) {
                        console.log("Payment signature verified successfully!");

                        const newBooking = await FlightBooking.create({
                            user: booking_meta.user_id,
                            name: booking_meta.name,
                            from: booking_meta.from_city,
                            to: booking_meta.to_city,
                            airline: booking_meta.airline,
                            flightno: booking_meta.flightno,
                            dateOfJourney: booking_meta.dateOfJourney,
                            totalPrice: booking_meta.totalPrice,
                            numberOfTickets: booking_meta.numberOfTickets,
                            payment_status: "paid"
                        });

                        // ✅ Save confirmation message to DB
                        const confirmationText = `✅ Booking confirmed! ID: ${newBooking._id}`;
                        const messageDoc = await Message.create({
                            sender: new mongoose.Types.ObjectId(messageData.sender),
                            recipient: new mongoose.Types.ObjectId(messageData.recipient),
                            text: confirmationText,
                            type: "flight_booking"
                        });
                        console.log('Saved Message:', messageDoc);

                        connection.send(JSON.stringify({
                            text: confirmationText,
                            sender: messageData.sender,
                            recipient: messageData.recipient,
                            type: "flight_booking",
                            _id: messageDoc._id
                        }));

                    } else {
                        const errorText = "❌ Payment verification failed. Booking not created.";
                        console.log(errorText);

                        const messageDoc = await Message.create({
                            sender: new mongoose.Types.ObjectId(messageData.sender),
                            recipient: new mongoose.Types.ObjectId(messageData.recipient),
                            text: errorText,
                            type: "text"
                        });
                        console.log('Saved Message:', messageDoc);

                        connection.send(JSON.stringify({
                            text: errorText,
                            sender: messageData.sender,
                            recipient: messageData.recipient,
                            type: "text",
                            _id: messageDoc._id
                        }));
                    }

                } catch (error) {
                    console.error("Payment processing error:", error.message);
                }

                return;
            }
            // Defensive checks
            if (!connection.userId || !text) return;

            if (recipient) {
                const messageDoc = await Message.create({
                    sender: new mongoose.Types.ObjectId(connection.userId),
                    recipient: new mongoose.Types.ObjectId(recipient),
                    text: text,
                    type: isFlightBookingMessage(text) ? 'flight_booking' : isFlightMessage(text) ? 'flight' : isHotelMessage(text)
                                ? 'hotel'
                                : 'text',
                });
                console.log(isFlightMessage(text))
                console.log('Saved Message:', messageDoc);
                console.log('Message data',messageData);

                Array.from(wss.clients)
                    .filter(c => c.userId === recipient)
                    .forEach(c =>
                        c.send(JSON.stringify({
                            text,
                            sender: connection.userId,
                            recipient,
                            _id: messageDoc._id,
                            type: isFlightBookingMessage(text) ? 'flight_booking' : isFlightMessage(text) ? 'flight' : isHotelMessage(text)
                                ? 'hotel'
                                : 'text'
                        }))
                    );
            }
        } catch (e) {
            console.error("WebSocket message error:", e.message);
        }
    });
    //notify everyone online people (when someone connects)
    notifyAboutOnlinePeople()
})

wss.on('close',(data) => {
    console.log('Connection closed',data)
})