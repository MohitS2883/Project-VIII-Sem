import { useContext, useState } from "react";
import axios from "axios";
import { UserContext } from "./UserContext.jsx";

export default function RegisterAndLoginForm() {
    const [userName, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [mode, setMode] = useState("register");
    const { setLoggedInUserName, setId } = useContext(UserContext);

    async function handleSubmit(e) {
        e.preventDefault();
        if (!userName || !password) return;

        const url = mode === "register" ? "/register" : "/login";

        try {
            const { data } = await axios.post(url, { username: userName, password });
            setLoggedInUserName(userName);
            setId(data.userId);
        } catch (error) {
            alert(`Failed to ${mode}. Please try again.`);
        }
    }

    return (
        <div className="bg-blue-50 h-screen flex items-center justify-center px-4">
            <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
                <h2 className="text-2xl font-semibold mb-6 text-center text-gray-800">
                    {mode === "register" ? "Welcome! Please Register" : "Welcome Back! Please Login"}
                </h2>
                <form onSubmit={handleSubmit}>
                    <input
                        value={userName}
                        onChange={(e) => setUsername(e.target.value)}
                        type="text"
                        placeholder="Username"
                        autoComplete="username"
                        className="block w-full rounded-sm p-2 mb-4 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type="password"
                        placeholder="Password"
                        autoComplete={mode === "register" ? "new-password" : "current-password"}
                        className="block w-full rounded-sm p-2 mb-6 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button
                        type="submit"
                        disabled={!userName || !password}
                        className="bg-blue-600 hover:bg-blue-700 text-white block w-full rounded-sm p-2 mb-4 disabled:opacity-50"
                    >
                        {mode === "register" ? "Register" : "Login"}
                    </button>
                </form>

                {mode === "register" ? (
                    <p className="text-center text-sm text-gray-600">
                        Already have an account?{" "}
                        <button
                            type="button"
                            className="text-blue-600 underline hover:text-blue-800"
                            onClick={() => setMode("login")}
                        >
                            Login here
                        </button>
                    </p>
                ) : (
                    <p className="text-center text-sm text-gray-600">
                        Don't have an account?{" "}
                        <button
                            type="button"
                            className="text-blue-600 underline hover:text-blue-800"
                            onClick={() => setMode("register")}
                        >
                            Register here
                        </button>
                    </p>
                )}
            </div>
        </div>
    );
}
