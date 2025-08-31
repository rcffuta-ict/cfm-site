import { io } from "socket.io-client";

const mainUrl = "10.217.52.234";
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
