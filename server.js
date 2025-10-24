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

  socket.on('createGame', ({ gridSize }, callback) => {
    const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    games[gameId] = {
      board: Array(gridSize * gridSize).fill(''),
      currentPlayer: 'X',
      gameActive: true,
      scores: { X: 0, O: 0, ties: 0 },
      players: { X: socket.id, O: null },
      gridSize: gridSize
    };
    socket.join(gameId);
    callback({ gameId, role: 'X' });
    console.log(`Game created: ${gameId} with ${gridSize}x${gridSize} grid`);
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
    callback({ success: true, role: 'O', gridSize: game.gridSize });
    io.to(gameId).emit('gameState', game);
    console.log(`Player joined game: ${gameId}`);
  });

  socket.on('makeMove', ({ gameId, index, player }) => {
    const game = games[gameId];
    if (!game || game.board[index] !== '' || !game.gameActive) return;
    if (game.currentPlayer !== player) return;

    game.board[index] = player;

    const winner = checkWinner(game.board, game.gridSize);
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

    game.board = Array(game.gridSize * game.gridSize).fill('');
    game.currentPlayer = 'X';
    game.gameActive = true;

    io.to(gameId).emit('gameState', game);
  });

  socket.on('resetScores', ({ gameId }) => {
    const game = games[gameId];
    if (!game) return;

    game.board = Array(game.gridSize * game.gridSize).fill('');
    game.currentPlayer = 'X';
    game.gameActive = true;
    game.scores = { X: 0, O: 0, ties: 0 };

    io.to(gameId).emit('gameState', game);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

function checkWinner(board, gridSize) {
  const winLength = gridSize === 3 ? 3 : gridSize === 6 ? 4 : 5;
  
  // Check rows
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col <= gridSize - winLength; col++) {
      const start = row * gridSize + col;
      let winner = board[start];
      if (!winner) continue;
      let win = true;
      for (let i = 1; i < winLength; i++) {
        if (board[start + i] !== winner) {
          win = false;
          break;
        }
      }
      if (win) return winner;
    }
  }

  // Check columns
  for (let col = 0; col < gridSize; col++) {
    for (let row = 0; row <= gridSize - winLength; row++) {
      const start = row * gridSize + col;
      let winner = board[start];
      if (!winner) continue;
      let win = true;
      for (let i = 1; i < winLength; i++) {
        if (board[start + i * gridSize] !== winner) {
          win = false;
          break;
        }
      }
      if (win) return winner;
    }
  }

  // Check diagonals (top-left to bottom-right)
  for (let row = 0; row <= gridSize - winLength; row++) {
    for (let col = 0; col <= gridSize - winLength; col++) {
      const start = row * gridSize + col;
      let winner = board[start];
      if (!winner) continue;
      let win = true;
      for (let i = 1; i < winLength; i++) {
        if (board[start + i * (gridSize + 1)] !== winner) {
          win = false;
          break;
        }
      }
      if (win) return winner;
    }
  }

  // Check diagonals (top-right to bottom-left)
  for (let row = 0; row <= gridSize - winLength; row++) {
    for (let col = winLength - 1; col < gridSize; col++) {
      const start = row * gridSize + col;
      let winner = board[start];
      if (!winner) continue;
      let win = true;
      for (let i = 1; i < winLength; i++) {
        if (board[start + i * (gridSize - 1)] !== winner) {
          win = false;
          break;
        }
      }
      if (win) return winner;
    }
  }

  return null;
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
