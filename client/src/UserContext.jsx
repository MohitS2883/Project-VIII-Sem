import React, {createContext, useEffect, useState} from "react";
import axios from "axios";

export const UserContext = createContext({});

export const UserContextProvider = ({ children }) => {
    const [userName, setLoggedInUserName] = useState(null);
    const [id, setId] = useState(null);
    useEffect(() => {
        axios.get('/profile').then(res => {
            setId(res.data.userId)
            setLoggedInUserName(res.data.username)
        })
    }, []);

    return (
        <UserContext.Provider value={{ userName, setLoggedInUserName, id, setId }}>
            {children}
        </UserContext.Provider>
    );
};
