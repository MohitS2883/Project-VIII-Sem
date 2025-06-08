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
    const [newMessageText, setNewMessageText] = useState("");
    const [userInfoVisible, setUserInfoVisible] = useState(false);
    const [messages, setMessages] = useState([]);
    const { setId, id, userName, setLoggedInUserName, userInfo, setUserInfo } = useContext(UserContext);
    const divUnderMessages = useRef(null);
    const BOT_ID = "60b8d295f7f6d632d8b53cd4";
    const BOT_USERNAME = "travel-bot";
    const wsRef = useRef(null);

    useEffect(() => {
        connectToWebSocket();
    }, []);

    function connectToWebSocket() {
        const ws = new WebSocket("ws://localhost:3000");
        setWs(ws);
        wsRef.current = ws;
        ws.addEventListener("message", handleMessage);
        ws.addEventListener("close", () => {
            setTimeout(() => {
                console.log("Reconnecting...");
                connectToWebSocket();
            }, 1000);
        });
    }

    useEffect(() => {
        if (divUnderMessages.current) {
            divUnderMessages.current.scrollIntoView({ behavior: "smooth", block: "end" });
        }
    }, [messages]);

    useEffect(() => {
        axios.get("/profile").then((res) => {
            setUserInfo(res.data);
        });
    }, []);

    useEffect(() => {
        if (selectedUser) {
            axios.get("/messages/" + selectedUser).then((res) => {
                setMessages(res.data);
            });
        }
    }, [selectedUser]);

    function logout() {
        axios.post("/logout").then(() => {
            setWs(null);
            setId(null);
            setLoggedInUserName(null);
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
        if ("online" in messageData) {
            showOnlinePeople(messageData.online);
        } else if ("text" in messageData) {
            try {
                const parsed = JSON.parse(messageData.text);

                // Razorpay trigger
                if (parsed?.action === "show_payment_ui") {
                    const options = {
                        key: parsed.key,
                        amount: parsed.amount,
                        currency: parsed.currency,
                        order_id: parsed.order_id,
                        name: "Flight Booking",
                        description: "Confirm your ticket",
                        handler: function (response) {
                            console.log("Razorpay payment success:", response);
                            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                                wsRef.current.send(
                                    JSON.stringify({
                                        type: "payment_success",
                                        razorpay_order_id: response.razorpay_order_id,
                                        razorpay_payment_id: response.razorpay_payment_id,
                                        razorpay_signature: response.razorpay_signature,
                                        booking_meta: parsed.meta,
                                    })
                                );
                            } else {
                                console.warn("WebSocket is not open");
                            }
                        },
                        prefill: {
                            name: parsed.meta.name,
                            email: "test@example.com",
                        },
                        theme: {
                            color: "#009689",
                        },
                    };
                    const rzp = new window.Razorpay(options);
                    rzp.open();
                    return; // skip adding to messages
                }
            } catch (err) {
                // Not a Razorpay action
            }
            setMessages((prev) => [...prev, { ...messageData }]);
        }
    }

    function sendMessage(e) {
        e.preventDefault();
        if (!newMessageText.trim()) return;
        ws.send(
            JSON.stringify({
                recipient: selectedUser,
                text: newMessageText,
            })
        );
        setMessages((messages) => [
            ...messages,
            {
                text: newMessageText,
                sender: id,
                recipient: selectedUser,
                _id: Date.now(),
            },
        ]);
        setNewMessageText("");
    }

    useEffect(() => {
        axios.get("/people").then((res) => {
            const offlinePeopleArr = res.data
                .filter((person) => person._id !== id)
                .filter((p) => !Object.keys(onlinePeople).includes(p._id));
            const offlinePeopleObj = {};
            offlinePeopleArr.forEach((p) => {
                offlinePeopleObj[p._id] = p.username;
            });
            setOfflinePeople(offlinePeopleObj);
        });
    }, [onlinePeople]);

    const onlinePeopleExcludingOurUser = { ...onlinePeople };
    delete onlinePeopleExcludingOurUser[id];
    const messageWithoutDupes = uniqBy(messages, "_id");

    // Helper to get initials for avatars
    function getInitials(name) {
        if (!name) return "";
        const parts = name.split(" ");
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    // Close modal on outside click
    const modalRef = useRef(null);
    useEffect(() => {
        function handleClickOutside(event) {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                setUserInfoVisible(false);
            }
        }
        if (userInfoVisible) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [userInfoVisible]);

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
                            avatar={
                                <div className="bg-teal-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                                    🤖
                                </div>
                            }
                        />

                        {/* Online Users */}
                        <div className="mt-3">
                            <div className="text-xs text-slate-500 font-medium px-2 mb-1">Online</div>
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
                                        avatar={
                                            <div className="bg-teal-400 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold select-none">
                                                {getInitials(username)}
                                            </div>
                                        }
                                    />
                                ))}
                        </div>

                        {/* Uncomment if you want offline users back */}
                        {/* <div className="mt-3">
              <div className="text-xs text-slate-500 font-medium px-2">Offline</div>
              {Object.entries(offlinePeople)
                .filter(([userId, username]) => !!username)
                .map(([userId, username]) => (
                  <Contact
                    key={userId}
                    id={userId}
                    online={false}
                    username={username}
                    setSelectedUser={setSelectedUser}
                    selected={userId === selectedUser}
                    avatar={
                      <div className="bg-gray-300 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold select-none">
                        {getInitials(username)}
                      </div>
                    }
                  />
                ))}
            </div> */}
                    </div>
                    <div className="p-4 flex items-center justify-between border-t border-slate-300 bg-slate-200">
                        <div
                            className="flex items-center space-x-2 cursor-pointer"
                            onClick={() => setUserInfoVisible(true)}
                        >
                            <div className="bg-slate-100 p-2 rounded-full">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    className="w-6 h-6 text-gray-500"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </div>
                            <span className="text-sm font-medium text-gray-700 select-none">{userName}</span>
                        </div>
                        <button
                            onClick={logout}
                            className="text-sm px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                            aria-label="Logout"
                        >
                            Logout
                        </button>
                    </div>
                </div>

                {/* Main Chat Window */}
                <div className="flex flex-col bg-slate-50 w-3/4 p-4">
                    <div className="flex-grow relative">
                        {!selectedUser && (
                            <div className="flex flex-grow h-full items-center justify-center select-none">
                                <div className="text-slate-400 text-4xl">&larr; Select a person from the sidebar</div>
                            </div>
                        )}
                        {!!selectedUser && (
                            <div
                                className="overflow-y-scroll absolute top-0 left-0 right-0 bottom-2 px-2"
                                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                            >
                                {messageWithoutDupes.map((message) => (
                                    <div
                                        key={message._id}
                                        className={`flex ${message.sender === id ? "justify-end" : "justify-start"}`}
                                    >
                                        <div
                                            className={`relative rounded-xl inline-block px-4 py-2 my-2 text-md max-w-xs whitespace-pre-line
                        ${
                                                message.sender === id
                                                    ? "bg-teal-600 text-white"
                                                    : "bg-slate-200 text-slate-900 border border-slate-300 shadow-sm"
                                            }`}
                                        >
                                            {/* Tail pointer */}
                                            <span
                                                className={`absolute bottom-0 ${
                                                    message.sender === id ? "right-0" : "left-0"
                                                } w-0 h-0
                          border-t-8 border-t-transparent
                          ${
                                                    message.sender === id
                                                        ? "border-r-8 border-r-teal-600"
                                                        : "border-l-8 border-l-slate-200"
                                                }`}
                                            ></span>

                                            {/* Message content rendering */}
                                            {/\d+(\.\d+)?°C/.test(message.text) ? (
                                                <WeatherMessage text={message.text} />
                                            ) : message.type === "flight_booking" ? (
                                                <FlightBookingMessage text={message.text} />
                                            ) : message.type === "flight" ? (
                                                <FlightMessage text={message.text} />
                                            ) : message.type === "hotel" ? (
                                                <HotelMessage text={message.text} />
                                            ) : (
                                                <div>{message.text}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div ref={divUnderMessages}></div>
                            </div>
                        )}
                    </div>

                    {!!selectedUser && (
                        <form className="flex gap-2 mt-4" onSubmit={sendMessage}>
              <textarea
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage(e);
                      }
                  }}
                  className="bg-white flex-grow border border-slate-300 p-2 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
                  placeholder="Type your message here"
                  rows={1}
                  aria-label="Message input"
              />
                            <button
                                type="submit"
                                disabled={!newMessageText.trim()}
                                className={`p-2 text-white rounded-md transition-colors ${
                                    newMessageText.trim()
                                        ? "bg-teal-600 hover:bg-teal-700 cursor-pointer"
                                        : "bg-teal-300 cursor-not-allowed"
                                }`}
                                aria-label="Send message"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className="w-6 h-6"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M6 12L3.269 3.125A59.769 59.769 0 0121.485 12 59.768 59.768 0 013.27 20.875L6 12z"
                                    />
                                </svg>
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {userInfoVisible && (
                <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-50">
                    <div
                        ref={modalRef}
                        className="bg-white p-6 rounded-lg shadow-xl w-80 relative"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="userinfo-title"
                    >
                        <h2 id="userinfo-title" className="text-lg font-semibold mb-2">
                            User Info
                        </h2>
                        <button
                            onClick={() => setUserInfoVisible(false)}
                            aria-label="Close user info"
                            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <p>
                            <strong>Username:</strong> {userInfo.username}
                        </p>
                        <p>
                            <strong>Email:</strong> {userInfo.email || "—"}
                        </p>
                        <p>
                            <strong>Phone:</strong> {userInfo.phone || "—"}
                        </p>
                        <p>
                            <strong>Age:</strong> {userInfo.age || "—"}
                        </p>

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