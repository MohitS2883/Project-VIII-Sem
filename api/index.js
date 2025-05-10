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
app.get('/', (req, res) => {
    res.send('Hello, Mohit!');
});

app.post('/register', async (req, res) => {
    const {username, password} = req.body;
    try{
        const hashedPassword = await bcrypt.hash(password, bcryptSalt);
        const createdUser = await User.create({
            username:username,
            password:hashedPassword})
            jwt.sign({
                userId:createdUser._id,
                username
            }, jwtsecret,
            {},
        (err,token) => {
            if(err) throw err;
            res.cookie(
                'token' , token, {sameSite:'none',secure:true})
                .status(201).json({
                id: createdUser._id, username: createdUser.username })
                },
            )
    }catch (e) {
        if (e.code === 11000) {
            return res.status(400).json({ error: 'Username already exists' });
        }
    }
})

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

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const wss = new ws.WebSocketServer({server});
wss.on('connection',(connection, req) => {
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
        const messageData = JSON.parse(message.toString());
        const {recipient,text} = messageData;
        if(recipient && text) {
            const messageDoc = await Message.create({
                sender: new mongoose.Types.ObjectId(connection.userId),
                recipient: new mongoose.Types.ObjectId(recipient),
                text: text
            });

            Array.from(wss.clients)
                .filter(c => c.userId == recipient)
                .forEach(c => c.send(JSON.stringify({
                    text,
                    sender:connection.userId,
                    recipient:recipient,
                    _id:messageDoc._id
                })))
        }
    })
    //notify everyone online people (when someone connects)
    Array.from(wss.clients).forEach(currentClient => {
        const onlineUsers = Array.from(wss.clients).map(otherClient => ({
            userId: otherClient.userId,
            username: otherClient.username
        }));

        currentClient.send(JSON.stringify({ online: onlineUsers }));
    });

})