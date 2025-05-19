import axios from "axios";
import {UserContextProvider} from "./UserContext.jsx";
import Routes from "./Routes.jsx";

function App() {
    axios.defaults.baseURL = "https://c8ad-2406-7400-104-8b07-3d3a-82f0-f0af-f617.ngrok-free.app/";
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
