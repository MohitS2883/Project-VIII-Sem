import axios from "axios";
import {UserContextProvider} from "./UserContext.jsx";
import Routes from "./Routes.jsx";

function App() {
    axios.defaults.baseURL = "https://rnvpg-2406-7400-104-bbf7-c976-d3ae-6875-be27.a.free.pinggy.link/";
    axios.defaults.withCredentials = true;
    return (
        <>
          <UserContextProvider>
              <Routes />
          </UserContextProvider>
        </>
    )
}

export default App
