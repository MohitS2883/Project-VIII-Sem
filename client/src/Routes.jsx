import RegisterAndLoginForm from "./RegisterAndLoginForm.jsx";
import {useContext} from "react";
import {UserContext} from "./UserContext.jsx";
import Chat from "./Chat.jsx";

export default  function Routes() {
    const {userName,id} = useContext(UserContext)
    if (userName) {
        return (
            <Chat />
        )
    }
    return (
        <RegisterAndLoginForm/>
    )
}