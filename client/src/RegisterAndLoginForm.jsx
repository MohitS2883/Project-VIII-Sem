import {useContext, useState} from "react"
import axios from "axios";
import {UserContext} from "./UserContext.jsx";

export default function RegisterAndLoginForm() {
    const [userName,setUsername] = useState("")
    const [password,setPassword] = useState("")
    const [isLoginOrRegister,setIsLoginOrRegister] = useState('register')
    const {setLoggedInUserName,setId} = useContext(UserContext)
    async function handleSubmit(e) {
        e.preventDefault();
        const url = isLoginOrRegister === 'register' ? '/register' : '/login'
        const {data} = await axios.post(url,{username:userName,password:password})
        setLoggedInUserName(userName)
        setId(data.userId)
    }
    return (
        <>
            <div className="bg-blue-50 h-screen flex items-center">
                <form className="w-64 mx-auto mb-12" onSubmit={handleSubmit}>
                    <input value={userName} 
                    onChange={e => setUsername(e.target.value)}
                    type="text" placeholder="Username" 
                    className="block w-full rounded-sm p-2 mb-2 border" />
                    <input value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    type="password" placeholder="Password" 
                    className="block w-full rounded-sm p-2 mb-2 border"/>
                    <button className="bg-blue-500 text-white block w-full rounded-sm p-2">
                        {isLoginOrRegister === 'register' ? 'Register' : 'Login'}
                    </button>
                        {isLoginOrRegister === 'register' && (
                            <div className="text-center mt-2">
                                Already have an account?
                                <button onClick={() => setIsLoginOrRegister('login')}>
                                    Login here
                                </button>
                            </div>
                        )}
                    {isLoginOrRegister === 'login' && (
                        <div className="text-center mt-2">
                            Don't have an account?
                            <button onClick={() => setIsLoginOrRegister('register')}>
                                Register here
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </>
    )
}