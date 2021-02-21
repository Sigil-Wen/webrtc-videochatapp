import React, {useRef, useEffect} from "react";
import io from "socket.io-client";

const Room = (props) => {
    const userVideo = useRef(); //stores user video
    const partnerVideo =useRef();
    const peerRef = useRef();
    const socketRef = useRef(); //refers to socket 
    const otherUser = useRef();
    const userStream = useRef(); //

    useEffect(()=>{
        //asks user to grant access to audio and video, tehn ressolves promise to stream 
        navigator.mediaDevices.getUserMedia({audio: true, video: true}).then(stream =>{
            userVideo.current.srcObject = stream; //displays ourselves in the video tab
            userStream.current = stream; //stores stream 

            socketRef.current = io.connect('/');
            socketRef.current.emit("join room", props.match.params.roomID); //emits event and shares roomID

            //person joining new room with someone else
            socketRef.current.on('other user', userID => {
                callUser(userID);
                otherUser.current = userID; //stores other persons ID
            })

            //person joining your room
            socketRef.current.on('user joined', userID => {
                otherUser.current = userID;
            })

            socketRef.current.on("offer", handleRecieveCall);
            socketRef.current.on("answer", handleAnswer);
            socketRef.current.on("ice-candidate", handleNewICECandidateMsg);

        })
    }, []); //

    function callUser(userID){
        peerRef.current = createPeer(userID); //builds webRTC function object, stores in peerRef
        userStream.current.getTracks().forEach(track => peerRef.current.addTrack(track, userStream.current)) //returns all tracks from user streams, addstrack to peerRef streams
    }

    //userID is person we are trying to call
    function createPeer(userID){
        const peer = new RTCPeerConnection({ //creates new RTCPeerConnection using constructor
            iceServers: [
                {//STUN 
                    urls: "stun:stun.stunprotocol.org"
                }, 
                {//TURN 
                    urls: "turn:numb.viagenie.ca",
                    credential: 'muazkh',
                    username: 'webrtc@live.com'
                },
            ]
        })

        //when icecandidate is created, raises event 
        peer.onicecandidate = handleICECandidateEvent;
        //when a proper connection is set, remote peer sends us stream and ontrack event fires, 
        peer.ontrack = handleTrackEvent;

        //defines when negiotiation is fired
        peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);

        return peer;
    }
   
    //handles call
    function handleNegotiationNeededEvent(userID) {
        //every offer and answer, remote description and local description 
        peerRef.current.createOffer().then(offer => {
            return peerRef.current.setLocalDescription(offer);
        }).then(() => {
            const payload = { //creates payload object to send 
                target: userID,
                caller: socketRef.current.id,
                sdp: peerRef.current.localDescription //actual offer
            };
            socketRef.current.emit("offer", payload); //who we are + offer
        }).catch(e => console.log(e)); //fails
    }

    function handleRecieveCall(incoming) { //handles incoming payload
        peerRef.current = createPeer(); //creates a peer for the recieving peer 
        const desc = new RTCSessionDescription(incoming.sdp); //passes incoming sdp offer data, constructing sdp, to create remote description
        peerRef.current.setRemoteDescription(desc).then(() => { // sets remote description 
            userStream.current.getTracks().forEach(track => peerRef.current.addTrack(track, userStream.current)); //attach each of our tracks to our peer
        }).then(() => {
            return peerRef.current.createAnswer(); //creates answer 
        }).then(answer => {
            return peerRef.current.setLocalDescription(answer); //sets local description with answer
        }).then(() => {
            const payload = { //creates a payload with sdp of our answer
                target: incoming.caller,
                caller: socketRef.current.id,
                sdp: peerRef.current.localDescription
            }
            socketRef.current.emit("answer", payload); //emits answer with payload
        })
    }

    //completes handshake, sents offer, sets offer as remote desc, creates answer sets as local desc, sends back which we set as remote desc
    function handleAnswer(message) {
        const desc = new RTCSessionDescription(message.sdp);
        peerRef.current.setRemoteDescription(desc).catch(e => console.log(e));
    }


    function handleICECandidateEvent(e) {
        if (e.candidate) { //checks if e has a candidate 
            const payload = { 
                target: otherUser.current, //sends to other
                candidate: e.candidate, //sends the candidate
            }
            socketRef.current.emit("ice-candidate", payload);
        }
    }

    function handleNewICECandidateMsg(incoming) { //recieves incoming
        const candidate = new RTCIceCandidate(incoming); //passes constructor with incoming

        peerRef.current.addIceCandidate(candidate) //adds icecandidate onto peer (continues until finds an effective peer handshake)
            .catch(e => console.log(e));
    }

    function handleTrackEvent(e) { //event
        partnerVideo.current.srcObject = e.streams[0]; //gets stream and stores to srcObject of partnerVideo
    };


    return (
        <div>
            <video autoPlay ref = {userVideo} /> 
            <video autoPlay ref = {partnerVideo}/>

        </ div>
    )
}

export default Room;
