// DOM elements
const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const engineStatusEl = document.getElementById("engineStatus");
const moveHistoryEl = document.getElementById("moveHistory");
const newGameBtn = document.getElementById("newGameBtn");
const flipBoardBtn = document.getElementById("flipBoardBtn");
const undoBtn = document.getElementById("undoBtn");
const difficultySlider = document.getElementById("difficulty");
const difficultyValue = document.getElementById("difficultyValue");
const playerColorSelect = document.getElementById("playerColor");
const gameOverEl = document.getElementById("gameOver");
const gameResultEl = document.getElementById("gameResult");
const playAgainBtn = document.getElementById("playAgainBtn");

// Game state
const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const game = new Chess();
let boardFlipped = false;
let playerColor = "white";
let lastMove = null;
let moveHistory = [];

//Initialize Stockfish engine
const engine = new Worker("stockfish.js");
let engineReady = false;

// Set up engine
engine.postMessage("uci");
engine.postMessage("isready");

engine.onmessage = (e) => {
  const msg = e.data;

  // Check if engine is ready
  if (msg === "readyok") {
    engineReady = true;
    engineStatusEl.textContent = "Stockfish: Ready";
  }

  // Handle best move
  if (msg.startsWith("bestmove")) {
    engineStatusEl.textContent = "Stockfish: Thinking...";
    setTimeout(() => {
      const moveStr = msg.split(" ")[1];
      if (moveStr && moveStr !== "none") {
        applyEngineMove(moveStr);
      }
    }, 500);
  }
};

// Create chess board
function createBoard() {
  boardEl.innerHTML = "";

  // Add coordinate labels
  const fileCoords = document.createElement("div");
  fileCoords.className = "coordinates file-coords";
  files.forEach((file) => {
    const coord = document.createElement("div");
    coord.textContent = file;
    fileCoords.appendChild(coord);
  });

  const rankCoords = document.createElement("div");
  rankCoords.className = "coordinates rank-coords";
  for (let rank = 8; rank >= 1; rank--) {
    const coord = document.createElement("div");
    coord.textContent = rank;
    rankCoords.appendChild(coord);
  }

  boardEl.appendChild(fileCoords);
  boardEl.appendChild(rankCoords);

  // Create squares
  for (let rank = 8; rank >= 1; rank--) {
    for (let file = 0; file < 8; file++) {
      const sq = document.createElement("div");
      sq.classList.add("box");

      // Apply color based on position
      if ((rank + file) % 2 === 0) {
        sq.classList.add("white");
      } else {
        sq.classList.add("black");
      }

      // Set ID like "e4"
      sq.id = files[file] + rank;
      boardEl.appendChild(sq);
    }
  }
}

// Render pieces on the board
function renderPosition() {
  // Clear highlights
  document.querySelectorAll(".box").forEach((box) => {
    box.classList.remove("highlight", "valid-move", "capture", "last-move");
    box.innerHTML = "";
  });

  // Highlight last move
  if (lastMove) {
    const fromSquare = document.getElementById(lastMove.from);
    const toSquare = document.getElementById(lastMove.to);
    if (fromSquare) fromSquare.classList.add("last-move");
    if (toSquare) toSquare.classList.add("last-move");
  }

  // Place pieces
  game.board().forEach((row, r) => {
    row.forEach((piece, f) => {
      if (piece) {
        const squareId = files[f] + (8 - r);
        const squareEl = document.getElementById(squareId);
        if (squareEl) {
          squareEl.innerHTML = "";
          const cls = piece.color === "w" ? "wh" : "bl";
          const icon = {
            p: "fa-chess-pawn",
            r: "fa-chess-rook",
            n: "fa-chess-knight",
            b: "fa-chess-bishop",
            q: "fa-chess-queen",
            k: "fa-chess-king",
          }[piece.type];

          const pieceEl = document.createElement("i");
          pieceEl.className = `fa-solid ${icon} ${cls} piece`;
          pieceEl.draggable = true;
          pieceEl.id = `piece-${squareId}`;
          pieceEl.dataset.square = squareId;
          pieceEl.dataset.type = piece.type;
          pieceEl.dataset.color = piece.color === "w" ? "white" : "black";
          squareEl.appendChild(pieceEl);
        }
      }
    });
  });

  makeDraggable();
  updateStatus();
}

// Make pieces draggable
function makeDraggable() {
  document.querySelectorAll(".piece").forEach((p) => {
    p.addEventListener("dragstart", handleDragStart);
    p.addEventListener("dragend", handleDragEnd);
  });
}

// Highlight valid moves
function highlightMoves(square) {
  // Clear previous highlights
  document.querySelectorAll(".box").forEach((box) => {
    box.classList.remove("valid-move", "capture", "highlight");
  });

  // Highlight selected piece
  const selectedSquare = document.getElementById(square);
  if (selectedSquare) selectedSquare.classList.add("highlight");

  // Highlight valid moves
  const moves = game.moves({ square, verbose: true });
  moves.forEach((move) => {
    const targetSquare = document.getElementById(move.to);
    if (targetSquare) {
      if (game.get(move.to)) {
        targetSquare.classList.add("capture");
      } else {
        targetSquare.classList.add("valid-move");
      }
    }
  });
}

// Handle drag start
function handleDragStart(e) {
  const piece = e.target;
  const square = piece.dataset.square;
  const pieceColor = piece.dataset.color;

  // Only allow dragging of player's pieces on their turn
  if (pieceColor !== playerColor || game.turn() !== pieceColor[0]) {
    e.preventDefault();
    return;
  }

  e.dataTransfer.setData("text/plain", piece.id);
  piece.classList.add("dragging");

  // Highlight possible moves
  highlightMoves(square);

  // Add slight delay for better visual feedback
  setTimeout(() => {
    piece.style.opacity = "0.4";
  }, 0);
}

// Handle drag end
function handleDragEnd(e) {
  const piece = e.target;
  piece.classList.remove("dragging");
  piece.style.opacity = "1";

  // Clear highlights
  document.querySelectorAll(".box").forEach((box) => {
    box.classList.remove("valid-move", "capture", "highlight");
  });
}

// Setup drag and drop
function setupDragAndDrop() {
  boardEl.querySelectorAll(".box").forEach((box) => {
    box.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    box.addEventListener("dragenter", (e) => {
      e.preventDefault();
      box.classList.add("drag-over");
    });

    box.addEventListener("dragleave", (e) => {
      box.classList.remove("drag-over");
    });

    box.addEventListener("drop", (e) => {
      e.preventDefault();
      box.classList.remove("drag-over");

      const pid = e.dataTransfer.getData("text/plain");
      const pieceEl = document.getElementById(pid);

      if (!pieceEl) return;

      const from = pieceEl.dataset.square;
      const to = box.id;
      const piece = game.get(from);

      // Handle pawn promotion
      let promotion = "q";
      if (piece && piece.type === "p" && (to[1] === "1" || to[1] === "8")) {
        promotion = "q"; // Default to queen
      }

      // Try to make the move
      const move = game.move({ from, to, promotion });

      if (move) {
        lastMove = { from, to };
        moveHistory.push(move);
        updateMoveHistory();
        renderPosition();

        if (!game.game_over()) {
          // If player is black and just moved, it's now white's turn (engine's turn)
          if (playerColor === "black") {
            setTimeout(requestEngineMove, 300);
          }
        } else {
          handleGameOver();
        }
      }
    });
  });
}

// Request engine move
function requestEngineMove() {
  if (!engineReady) return;

  engineStatusEl.textContent = "Stockfish: Thinking...";
  engine.postMessage("ucinewgame");
  engine.postMessage("position fen " + game.fen());
  const depth = difficultySlider.value;
  engine.postMessage(`go depth ${depth}`);
}

// Apply engine move
function applyEngineMove(moveStr) {
  if (!moveStr || moveStr.length < 4) {
    console.warn("Invalid move string from Stockfish:", moveStr);
    return;
  }

  const from = moveStr.slice(0, 2); // e2
  const to = moveStr.slice(2, 4); // e4

  // Optional promotion
  let promotion = "q";
  if (moveStr.length === 5) {
    promotion = moveStr[4];
  }

  const move = game.move({ from, to, promotion });
  console.log("Applying Stockfish move:", { from, to, promotion }, "=>", move);

  if (move) {
    lastMove = { from: move.from, to: move.to };
    moveHistory.push(move);
    updateMoveHistory();
    renderPosition();

    if (game.game_over()) {
      handleGameOver();
    }
  } else {
    console.warn("Failed to apply engine move:", moveStr);
  }

  engineStatusEl.textContent = "Stockfish: Ready";
}

// Update game status
function updateStatus() {
  if (game.game_over()) {
    handleGameOver();
    return;
  }

  const turn = game.turn() === "w" ? "White" : "Black";
  statusEl.textContent = `${turn}'s turn`;

  if (game.in_check()) {
    statusEl.textContent += " (Check)";
  }

  // If it's the engine's turn, request move
  if (
    (playerColor === "white" && game.turn() === "b") ||
    (playerColor === "black" && game.turn() === "w")
  ) {
    setTimeout(requestEngineMove, 300);
  }
}

// Update move history
function updateMoveHistory() {
  moveHistoryEl.innerHTML = "<h2>Move History</h2>";

  for (let i = 0; i < moveHistory.length; i += 2) {
    const moveDiv = document.createElement("div");
    const moveNum = Math.floor(i / 2) + 1;
    const whiteMove = moveHistory[i].san;
    const blackMove = moveHistory[i + 1] ? moveHistory[i + 1].san : "";

    moveDiv.innerHTML = `<strong>${moveNum}.</strong> ${whiteMove} ${blackMove}`;
    moveHistoryEl.appendChild(moveDiv);
  }

  // Scroll to bottom
  moveHistoryEl.scrollTop = moveHistoryEl.scrollHeight;
}

// Handle game over
function handleGameOver() {
  let result = "";

  if (game.in_checkmate()) {
    const winner = game.turn() === "w" ? "Black" : "White";
    result = `Checkmate! ${winner} wins!`;
  } else if (game.in_draw()) {
    if (game.in_stalemate()) {
      result = "Draw by stalemate!";
    } else if (game.in_threefold_repetition()) {
      result = "Draw by repetition!";
    } else if (game.insufficient_material()) {
      result = "Draw by insufficient material!";
    } else {
      result = "Draw!";
    }
  }

  gameResultEl.textContent = result;
  gameOverEl.classList.add("active");
}

// Initialize new game
function initGame() {
  game.reset();
  moveHistory = [];
  lastMove = null;
  updateMoveHistory();
  renderPosition();
  gameOverEl.classList.remove("active");
  engineStatusEl.textContent = "Stockfish: Ready";
}

// Flip board
function flipBoard() {
  boardFlipped = !boardFlipped;
  boardEl.style.transform = boardFlipped ? "rotate(180deg)" : "rotate(0deg)";

  // Flip pieces
  document.querySelectorAll(".piece").forEach((piece) => {
    piece.style.transform = boardFlipped ? "rotate(180deg)" : "rotate(0deg)";
  });

  // Flip coordinates
  document.querySelectorAll(".coordinates > div").forEach((coord) => {
    coord.style.transform = boardFlipped ? "rotate(180deg)" : "rotate(0deg)";
  });
}

// Undo last move
function undoMove() {
  if (game.history().length < 1) return;

  game.undo();
  moveHistory.pop(); // Remove last move from history

  if (playerColor === "black") {
    // If player is black, undo two moves to return to player's turn
    if (game.history().length >= 1) {
      game.undo();
      moveHistory.pop();
    }
  }

  updateMoveHistory();
  renderPosition();
}

// Event listeners
newGameBtn.addEventListener("click", initGame);
flipBoardBtn.addEventListener("click", flipBoard);
undoBtn.addEventListener("click", undoMove);
playAgainBtn.addEventListener("click", initGame);

difficultySlider.addEventListener("input", () => {
  difficultyValue.textContent = difficultySlider.value;
});

playerColorSelect.addEventListener("change", () => {
  playerColor = playerColorSelect.value;
  initGame();
});

// Initialize the game
createBoard();
initGame();
setupDragAndDrop();

// After each render, reattach drag handlers
new MutationObserver(makeDraggable).observe(boardEl, {
  childList: true,
  subtree: true,
});
