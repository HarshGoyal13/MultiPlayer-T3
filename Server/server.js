const { createServer } = require("http");
const { Server } = require("socket.io");
require("dotenv").config()

// Use Render's provided port or default to 3000
const PORT = process.env.PORT || 3000;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: "http://localhost:5174/",
});

const allUsers = {};
const allRooms = [];
const waitingPlayers = [];

io.on("connection", (socket) => {
  allUsers[socket.id] = {
    socket: socket,
    online: true,
  };

  socket.on("request_to_play", (data) => {
    const currentUser = allUsers[socket.id];
    currentUser.playerName = data.playerName;

    // Add the current user to the waiting queue
    waitingPlayers.push(currentUser);

    // Check if there's another player waiting
    if (waitingPlayers.length >= 2) {
      const player1 = waitingPlayers.shift(); // Get the first player
      const player2 = waitingPlayers.shift(); // Get the second player

      allRooms.push({
        player1: player1,
        player2: player2,
      });

      player1.socket.emit("OpponentFound", {
        opponentName: player2.playerName,
        playingAs: "circle",
      });

      player2.socket.emit("OpponentFound", {
        opponentName: player1.playerName,
        playingAs: "cross",
      });

      player1.playing = true;
      player2.playing = true;

      player1.socket.on("playerMoveFromClient", (data) => {
        player2.socket.emit("playerMoveFromServer", { ...data });
      });

      player2.socket.on("playerMoveFromClient", (data) => {
        player1.socket.emit("playerMoveFromServer", { ...data });
      });
    } else {
      currentUser.socket.emit("OpponentNotFound");
    }
  });

  socket.on("disconnect", function () {
    const currentUser = allUsers[socket.id];
    currentUser.online = false;
    currentUser.playing = false;

    // Remove the user from the waiting queue if they are in it
    const index = waitingPlayers.findIndex(
      (player) => player.socket.id === socket.id
    );
    if (index !== -1) {
      waitingPlayers.splice(index, 1);
    }

    for (let index = 0; index < allRooms.length; index++) {
      const { player1, player2 } = allRooms[index];

      if (player1.socket.id === socket.id) {
        player2.socket.emit("opponentLeftMatch");
        break;
      }

      if (player2.socket.id === socket.id) {
        player1.socket.emit("opponentLeftMatch");
        break;
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
