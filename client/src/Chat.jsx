import { useContext, useEffect, useRef, useState } from "react";
import Avatar from "./Avatar.jsx";
import Logo from "./Logo.jsx";
import { UserContext } from "./UserContext.jsx";
import { uniqBy } from "lodash";
import axios from "axios";
import FlightCard from "./components/FlightCard.jsx";
import Contact from "./components/Contact.jsx";

export default function Chat() {
    const [ws, setWs] = useState(null);
    const [onlinePeople, setOnlinePeople] = useState({});
    const [offlinePeople, setOfflinePeople] = useState({});
    const [selectedUser, setSelectedUser] = useState(null);
    const [newMessageText, setNewMessageText] = useState('');
    const [messages, setMessages] = useState([]);
    const { username, id } = useContext(UserContext);
    const divUnderMessages = useRef(null);
    const BOT_ID = "60b8d295f7f6d632d8b53cd4";
    const BOT_USERNAME = "python-bot";


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
            },1000)
        })
    }
    useEffect(() => {
        if (divUnderMessages.current) {
            divUnderMessages.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages]);

    useEffect(() => {
        if(selectedUser) {
            axios.get('/messages/' +selectedUser).then(res => {
                setMessages(res.data)
            })
        }
        }, [selectedUser])

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
            })
            setOfflinePeople(offlinePeopleObj);
        })
    }, [onlinePeople])

    function parseFlightsFromMessage(text) {
        const flights = [];
        const regex = /\*\*(.*?)\*\*\s+- Departure: (.*?)\s+- Arrival: (.*?)\s+- Duration: (.*?)\s+- Airplane: (.*?)\s+- Travel Class: (.*?)\s+- Flight Number: (.*?)\s+(?:- Legroom: (.*?)\s+)?- Carbon Emissions: (.*?)\s+- Price: (\$\d+)/g;

        let match;
        while ((match = regex.exec(text)) !== null) {
            flights.push({
                airline: match[1],
                departure: match[2],
                arrival: match[3],
                duration: match[4],
                airplane: match[5],
                travelClass: match[6],
                flightNumber: match[7],
                legroom: match[8] || null,
                emissions: match[9],
                price: match[10]
            });
        }

        return flights;
    }

    const onlinePeopleExcludingOurUser = { ...onlinePeople };
    delete onlinePeopleExcludingOurUser[id];
    const messageWithoutDupes = uniqBy(messages, '_id');

    return (
        <div className="flex h-screen">
            <div className="bg-gradient-to-b from-gray-50 to-gray-100 w-1/4">
                <Logo />
                {Object.keys(onlinePeopleExcludingOurUser).includes(BOT_ID) ? (
                    <Contact
                        key={BOT_ID}
                        online={true}
                        id={BOT_ID}
                        username={BOT_USERNAME}
                        setSelectedUser={setSelectedUser}
                        selected={BOT_ID === selectedUser}
                    />
                ) : (
                    <Contact
                        key={BOT_ID}
                        online={false}
                        id={BOT_ID}
                        username={BOT_USERNAME}
                        setSelectedUser={setSelectedUser}
                        selected={BOT_ID === selectedUser}
                    />
                )}
            </div>
            <div className="flex flex-col bg-indigo-50 w-3/4 p-4">
                <div className="flex-grow">
                    {!selectedUser && (
                        <div className="flex flex-grow h-full items-center justify-center">
                            <div className='text-gray-400 text-4xl'>&larr; Select a person from the sidebar</div>
                        </div>
                    )}
                    {!!selectedUser && (
                        <div className="relative h-full">
                            <div className="overflow-y-scroll absolute top-0 left-0 right-0 bottom-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                {messageWithoutDupes.map(message => (
                                    <div className={(message.sender === id ? 'text-right' : 'text-left')} key={message.id}>
                                        <div className={`rounded-sm inline-block px-4 py-2 my-2 text-md max-w-xs ${message.sender === id ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-900'}`}>
                                            {message.text}
                                        </div>
                                    </div>
                                ))}
                                <div ref={divUnderMessages}></div> {/* Scroll target */}
                            </div>
                        </div>
                    )}
                </div>
                {!!selectedUser && (
                    <form className="flex gap-2 mt-4" onSubmit={sendMessage}>
                        <input type="text"
                               value={newMessageText}
                               onChange={e => setNewMessageText(e.target.value)}
                               className="bg-white flex-grow border border-gray-300 p-2 rounded-sm"
                               placeholder="Type your message here" />
                        <button type="submit" className="bg-indigo-600 p-2 text-white rounded-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                            </svg>
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
