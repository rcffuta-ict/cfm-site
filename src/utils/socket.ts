import { io } from "socket.io-client";

const mainUrl = "192.168.137.242";
const base = `${mainUrl}:3020`;

const connect = (path:string)=>{
    return io( `${base}/${path}`, {
        transports: ["websocket"], // Force WebSockets
        withCredentials: true, // Needed if using cookies for auth
        autoConnect: false,
        });
}
export const socket = connect("oracle");
// export const regsocket = connect("register");
// WebSocket connection
export const authsocket = connect("register");
