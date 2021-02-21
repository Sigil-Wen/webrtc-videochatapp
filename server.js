require('dotenv').config();

const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);
const socket = require('socket.io');
const io = socket(server);
const path = require('path');

const rooms = {}

io.on("connection", socket => { //when person joins  server, creates socket.io object for person
    socket.on("join room", roomID =>{
        if(rooms[roomID]){ //if the room already exists in rooms
            rooms[roomID].push(socket.id); //pushes socket id
        }else { //if room doesnt exists
            rooms[roomID] = [socket.id] //room id is used for roomID
        }
        const otherUser = rooms[roomID].find(id => id !== socket.id); //Are there otherUsers in the id?
        if(otherUser){ //if they do exist
            socket.emit("other user", otherUser); // tells us that other user exists
            socket.to(otherUser).emit("user joined", socket.id) //notifies user a with userid
        }
    }) 
    socket.on("offer", payload => {
        io.to(payload.target).emit("offer",payload); //who am I (id), and offer for webRTC
    })
    socket.on("answer", payload=> {
        io.to(payload.target).emit("answer", payload); //returns answer
    })

    socket.on("ice-candidate", incoming => {
        io.to(incoming.target).emit("ice-candidate", incoming.candidate); //each peer keeps finding a candidate for way to communicate to each other
    })
})

if(process.env.PROD){
    app.use(express.static(path.join(__dirname, './client/build')));
    app.get('*', (req,res)=> {
        res.sendFile(path.join(__dirname, './client/build/index.html'));
    });
}

const port = process.env.PORT || 8000;
server.listen(port,() => console.log("server is running on port "+ port));