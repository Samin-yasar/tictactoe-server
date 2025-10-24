const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const games = {};

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('createGame', (callback) => {
    const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    games[gameId] = {
      board: ['', '', '', '', '', '', '', '', ''],
      currentPlayer: 'X',
      gameActive: true,
      scores: { X: 0, O: 0, ties: 0 },
      players: { X: socket.id, O: null }
    };
    socket.join(gameId);
    callback({ gameId, role: 'X' });
    console.log('Game created:', gameId);
  });

  socket.on('joinGame', ({ gameId }, callback) => {
    const game = games[gameId];
    if (!game) {
      callback({ error: 'Game not found' });
      return;
    }
    if (game.players.O) {
      callback({ error: 'Game is full' });
      return;
    }
    game.players.O = socket.id;
    socket.join(gameId);
    callback({ success: true, role: 'O' });
    io.to(gameId).emit('gameState', game);
    console.log('Player joined game:', gameId);
  });

  socket.on('makeMove', ({ gameId, index, player }) => {
    const game = games[gameId];
    if (!game || game.board[index] !== '' || !game.gameActive) return;
    if (game.currentPlayer !== player) return;

    game.board[index] = player;

    const winner = checkWinner(game.board);
    if (winner) {
      game.scores[winner]++;
      game.gameActive = false;
    } else if (game.board.every(cell => cell !== '')) {
      game.scores.ties++;
      game.gameActive = false;
    } else {
      game.currentPlayer = player === 'X' ? 'O' : 'X';
    }

    io.to(gameId).emit('gameState', game);
  });

  socket.on('resetGame', ({ gameId }) => {
    const game = games[gameId];
    if (!game) return;

    game.board = ['', '', '', '', '', '', '', '', ''];
    game.currentPlayer = 'X';
    game.gameActive = true;

    io.to(gameId).emit('gameState', game);
  });

  socket.on('resetScores', ({ gameId }) => {
    const game = games[gameId];
    if (!game) return;

    game.board = ['', '', '', '', '', '', '', '', ''];
    game.currentPlayer = 'X';
    game.gameActive = true;
    game.scores = { X: 0, O: 0, ties: 0 };

    io.to(gameId).emit('gameState', game);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

function checkWinner(board) {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});