import { useContext, useEffect, useRef, useState } from "react";
import Logo from "./Logo.jsx";
import { UserContext } from "./UserContext.jsx";
import { uniqBy } from "lodash";
import axios from "axios";
import Contact from "./components/Contact.jsx";
import FlightMessage from "./components/FlightCard.jsx";
import HotelMessage from "./components/HotelMessage.jsx";
import WeatherMessage from "./components/WeatherCard.jsx";
import FlightBookingMessage from "./components/FlightBookingMessage.jsx";

export default function Chat() {
    const [ws, setWs] = useState(null);
    const [onlinePeople, setOnlinePeople] = useState({});
    const [offlinePeople, setOfflinePeople] = useState({});
    const [selectedUser, setSelectedUser] = useState(null);
    const [newMessageText, setNewMessageText] = useState('');
    const [userInfoVisible, setUserInfoVisible] = useState(false);
    const [messages, setMessages] = useState([]);
    const { setId, id, userName, setLoggedInUserName, userInfo, setUserInfo } = useContext(UserContext);
    const divUnderMessages = useRef(null);
    const BOT_ID = "60b8d295f7f6d632d8b53cd4";
    const BOT_USERNAME = "travel-bot";

    console.log(userName, id, BOT_USERNAME, BOT_ID)

    useEffect(() => {
        connectToWebSocket();
    }, []);

    function connectToWebSocket() {
        const ws = new WebSocket('ws://localhost:3000');
        setWs(ws);
        ws.addEventListener('message', handleMessage);
        ws.addEventListener('close', () => {
            setTimeout(() => {
                console.log('Reconnecting...');
                connectToWebSocket()
            }, 1000)
        });
    }

    useEffect(() => {
        if (divUnderMessages.current) {
            divUnderMessages.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages]);

    useEffect(() => {
        axios.get('/profile').then(res => {
            setUserInfo(res.data);
        });
    }, []);


    useEffect(() => {
        if (selectedUser) {
            axios.get('/messages/' + selectedUser).then(res => {
                setMessages(res.data);
            });
        }
    }, [selectedUser]);

    function logout() {
        axios.post('/logout').then(() => {
            setWs(null);
            setId(null)
            setLoggedInUserName(null)
        });
    }
    function showOnlinePeople(peopleArray) {
        const people = {};
        peopleArray.forEach(({ userId, username }) => {
            people[userId] = username;
        });
        setOnlinePeople(people);
    }

    function handleMessage(e) {
        const messageData = JSON.parse(e.data);
        if ('online' in messageData) {
            showOnlinePeople(messageData.online);
        } else if ('text' in messageData) {
            setMessages(prev => ([...prev, { ...messageData }]));
        }
    }

    function sendMessage(e) {
        e.preventDefault();
        ws.send(JSON.stringify({
            recipient: selectedUser,
            text: newMessageText
        }));
        setNewMessageText('');
        setMessages(messages => [...messages, {
            text: newMessageText,
            sender: id,
            recipient: selectedUser,
            _id: Date.now()
        }]);
    }

    useEffect(() => {
        axios.get('/people').then(res => {
            const offlinePeopleArr = res.data
                .filter(person => person._id !== id)
                .filter(p => !Object.keys(onlinePeople).includes(p._id));
            const offlinePeopleObj = {};
            offlinePeopleArr.forEach(p => {
                offlinePeopleObj[p._id] = p.username;
            });
            setOfflinePeople(offlinePeopleObj);
        });
    }, [onlinePeople]);

    const onlinePeopleExcludingOurUser = { ...onlinePeople };
    delete onlinePeopleExcludingOurUser[id];
    const messageWithoutDupes = uniqBy(messages, '_id');

    return (
        <>
        <div className="flex h-screen">
            {/* Sidebar */}
            <div className="bg-gradient-to-b from-slate-100 to-slate-200 w-1/4 border-r border-slate-300 flex flex-col">
                {/* Sticky Header */}
                <div className="sticky top-0 z-10 bg-slate-100 px-4 py-3 border-b border-slate-300 flex items-center justify-between">
                    <Logo />
                    <span className="text-sm text-slate-500">Chat</span>
                </div>

                {/* Contacts List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {/* Bot Contact */}
                    <Contact
                        key={BOT_ID}
                        online={Object.keys(onlinePeopleExcludingOurUser).includes(BOT_ID)}
                        id={BOT_ID}
                        username="Travel Agent"
                        setSelectedUser={setSelectedUser}
                        selected={BOT_ID === selectedUser}
                    />

                    {/* Online Users */}
                    <div className="mt-3">
                        <div className="text-xs text-slate-500 font-medium px-2">Online</div>
                        {Object.entries(onlinePeopleExcludingOurUser)
                            .filter(([userId, username]) => !!username)
                            .map(([userId, username]) => (
                                <Contact
                                    key={userId}
                                    id={userId}
                                    online={true}
                                    username={username}
                                    setSelectedUser={setSelectedUser}
                                    selected={userId === selectedUser}
                                />
                            ))}

                    </div>

                    {/*/!* Offline Users *!/*/}
                    {/*<div className="mt-3">*/}
                    {/*    <div className="text-xs text-slate-500 font-medium px-2">Offline</div>*/}
                    {/*    {Object.entries(offlinePeople)*/}
                    {/*        .filter(([userId, username]) => !!username)*/}
                    {/*        .map(([userId, username]) => (*/}
                    {/*            <Contact*/}
                    {/*                key={userId}*/}
                    {/*                id={userId}*/}
                    {/*                online={false}*/}
                    {/*                username={username}*/}
                    {/*                setSelectedUser={setSelectedUser}*/}
                    {/*                selected={userId === selectedUser}*/}
                    {/*            />*/}
                    {/*        ))}*/}
                    {/*</div>*/}
                </div>
                <div className="p-4 flex items-center justify-between border-t border-slate-300 bg-slate-200">
                    <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setUserInfoVisible(true)}>
                        <div className="bg-slate-100 p-2 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-gray-500">
                                <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <span className="text-sm font-medium text-gray-700">{userName}</span>
                    </div>
                    <button
                        onClick={logout}
                        className="text-sm px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </div>

            {/* Main Chat Window */}
            <div className="flex flex-col bg-slate-50 w-3/4 p-4">
                <div className="flex-grow">
                    {!selectedUser && (
                        <div className="flex flex-grow h-full items-center justify-center">
                            <div className="text-slate-400 text-4xl">&larr; Select a person from the sidebar</div>
                        </div>
                    )}
                    {!!selectedUser && (
                        <div className="relative h-full">
                            <div
                                className="overflow-y-scroll absolute top-0 left-0 right-0 bottom-2"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                                {messageWithoutDupes.map((message) => (
                                    <div
                                        className={message.sender === id ? 'text-right' : 'text-left'}
                                        key={message._id}
                                    >
                                        <div
                                            className={`rounded-xl inline-block px-4 py-2 my-2 text-md max-w-xs ${
                                                message.sender === id
                                                    ? 'bg-teal-600 text-white'
                                                    : 'bg-slate-200 text-slate-900'
                                            } whitespace-pre-line`}
                                        >
                                            {/\d+(\.\d+)?°C/.test(message.text) ? (
                                                <WeatherMessage text={message.text} />
                                            ) : message.type === 'flight_booking' ? (
                                                <FlightBookingMessage text={message.text} />
                                            ) : message.type === 'flight' ? (
                                                <FlightMessage text={message.text} />
                                            ) : message.type === 'hotel' ? (
                                                <HotelMessage text={message.text} />
                                            ) : (
                                                <div className="whitespace-pre-line">{message.text}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div ref={divUnderMessages}></div>
                            </div>
                        </div>
                    )}
                </div>

                {!!selectedUser && (
                    <form className="flex gap-2 mt-4" onSubmit={sendMessage}>
                    <textarea
                        value={newMessageText}
                        onChange={e => setNewMessageText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage(e);
                            }
                        }}
                        className="bg-white flex-grow border border-slate-300 p-2 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
                        placeholder="Type your message here"
                        rows={1}
                    />
                        <button type="submit" className="bg-teal-600 hover:bg-teal-700 p-2 text-white rounded-md transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                            </svg>
                        </button>
                    </form>
                )}
            </div>
        </div>
            {userInfoVisible && (
                <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-80">
                        <h2 className="text-lg font-semibold mb-2">User Info</h2>
                        <p><strong>Username:</strong> {userInfo.username}</p>
                        <p><strong>Email:</strong> {userInfo.email || "—"}</p>
                        <p><strong>Phone:</strong> {userInfo.phone || "—"}</p>
                        <p><strong>Age:</strong> {userInfo.age || "—"}</p>

                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                onClick={() => {
                                    setUserInfoVisible(false);
                                }}
                                className="bg-gray-300 px-3 py-1 rounded hover:bg-gray-400"
                            >
                                Close
                            </button>
                            <button
                                onClick={logout}
                                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
