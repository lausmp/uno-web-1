let gameId = null;
let ws = null;
let clientCards = [];
let currentColor = null;
let discardPile = null;
let otherPlayers = [];
let turn = 0;
let direction = 1;
let scores = [];
let waitingForColor = false;

// Elementos de la UI
let playersArea = document.getElementById("players-area");
let gameContainer = document.getElementById("game-container");
let deckArea = document.getElementById("deck");
let discardPileArea = document.getElementById("discard-pile");
let welcomeScreen = document.getElementById("welcome-screen");
let colorChoiceModal = document.getElementById("color-choice-modal");

// Iniciar partida con backend
async function startGameBackend(numJugadores = 4) {
  const res = await fetch("http://localhost:3001/start", { method: "POST" });
  const data = await res.json();
  gameId = data.gameId;
  updateGameState(data);
  connectWebSocket();
}

// Conectar WebSocket para actualizaciones en tiempo real
function connectWebSocket() {
  ws = new WebSocket("ws://localhost:3001");
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "subscribe", gameId }));
  };
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.gameState) updateGameState(msg.gameState);
  };
}

// Actualizar estado del juego y UI
function updateGameState(state) {
  clientCards = state.clientCards;
  currentColor = state.currentColor;
  discardPile = state.discardPile;
  otherPlayers = state.otherPlayers;
  turn = state.turn;
  direction = state.direction;
  scores = state.scores;
  waitingForColor = state.waitingForColor || false;
  showCardsBackend();
}

function getCardImage(card) {
  if (card.type === "number") {
    return `Assets/${card.color[0]}-${card.value}.png`;
  }
  if (
    card.type === "skip" ||
    card.type === "reverse" ||
    card.type === "draw2"
  ) {
    return `Assets/${card.color[0]}-${card.value}.png`;
  }
  if (card.type === "wild" || card.type === "wild4") {
    return `Assets/${card.value}.png`;
  }
  // return 'Assets/backcard.png'; // Imagen por defecto si no encuentra
}

// Mostrar cartas y estado en la UI
function showCardsBackend() {
  playersArea.innerHTML = "";
  // Jugador humano
  let html = `<div id="player1" class="player"><h3>Tú</h3></div>`;
  // Otros jugadores
  otherPlayers.forEach((p, idx) => {
    html += `<div id="player${idx + 2}" class="player"><h3>Jugador ${
      idx + 2
    }</h3><div class="hand">${"<img src='Assets/backcard.png' class='card-img'>".repeat(p.count)}</div></div>`;
  });
  html += `<div id="center-area">
    <div id="discard-pile"></div>
    <div id="deck"></div>
  </div>`;
  playersArea.innerHTML = html;

  // Renderiza tu mano
  const playerDiv = document.getElementById("player1");
  const handDiv = document.createElement("div");
  handDiv.className = "hand";
  clientCards.forEach((card, idx) => {
    const img = document.createElement("img");
    let cardImage = getCardImage(card);
    img.src = cardImage;
    img.className = "card-img";
    if (turn === 0) img.classList.add("active-card");
    img.onclick = () => playCardBackend(card);
    handDiv.appendChild(img);
  });
  playerDiv.appendChild(handDiv);

  // Renderiza mazo
  deckArea.innerHTML = "";
  const deckImg = document.createElement("img");
  deckImg.src = "Assets/backcard.png";
  deckImg.className = "card-img deck-card";
  if (turn === 0) deckImg.onclick = () => drawCardBackend();
  deckArea.appendChild(deckImg);

  // Renderiza pila de descarte
  discardPileArea.innerHTML = "";
  if (discardPile) {
    const img = document.createElement("img");
    img.src = getCardImage(discardPile);
    img.className = "card-img discard-card";
    discardPileArea.appendChild(img);
  }
}

// Jugar una carta
async function playCardBackend(card) {
  if (card.value === "changeColor" || card.value === "draw4") {
    const chosenColor = await chooseColor();
    await sendPlay(card, chosenColor);
  } else {
    await sendPlay(card, null);
  }
}

async function sendPlay(card, chosenColor) {
  const res = await fetch("http://localhost:3001/play", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId, card, chosenColor }),
  });
  const data = await res.json();
  updateGameState(data.gameState);
}

// Robar carta
async function drawCardBackend() {
  const res = await fetch("http://localhost:3001/draw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId }),
  });
  const data = await res.json();
  updateGameState(data.gameState);
}

// Decir UNO
async function sayUnoBackend() {
  const res = await fetch("http://localhost:3001/uno", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId }),
  });
  const data = await res.json();
  updateGameState(data.gameState);
}

// Nueva ronda
async function newRoundBackend() {
  const res = await fetch("http://localhost:3001/new-round", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId }),
  });
  const data = await res.json();
  updateGameState(data);
}

// Elegir color para comodín
function chooseColor() {
  return new Promise((resolve) => {
    colorChoiceModal.classList.remove("hidden");
    colorChoiceModal.style.display = "flex";
    const colorButtons = document.querySelectorAll(".color-button");
    colorButtons.forEach((button) => {
      button.onclick = () => {
        const chosenColor = button.dataset.color;
        colorChoiceModal.style.display = "none";
        resolve(chosenColor);
      };
    });
  });
}

// Botón UNO
document.querySelector(".uno-button").addEventListener("click", sayUnoBackend);

// --- MODALES Y UTILIDADES ---
function showModalAlert(
  message,
  callback,
  showExit = false,
  exitCallback = null
) {
  const modal = document.getElementById("modal-alert");
  const msg = document.getElementById("modal-alert-message");
  const okBtn = document.getElementById("modal-alert-OK");
  const exitBtn = document.getElementById("modal-alert-EXIT");
  msg.textContent = message;
  modal.style.display = "flex";

  okBtn.onclick = () => {
    modal.style.display = "none";
    if (callback) callback();
  };

  if (showExit) {
    exitBtn.style.display = "inline-block";
    exitBtn.onclick = () => {
      modal.style.display = "none";
      if (exitCallback) exitCallback();
    };
  } else {
    exitBtn.style.display = "none";
    exitBtn.onclick = null;
  }
}

function openModal() {
  document.getElementById("modal-reglas").style.display = "block";
}

function closeModal() {
  document
    .querySelectorAll(".modal")
    .forEach((modal) => (modal.style.display = "none"));
}

// cerrar el modal al hacer clic fuera del contenido
window.onclick = function (event) {
  var modal = document.getElementById("modal-reglas");
  if (event.target === modal) {
    closeModal();
  }
};

// function openModalJugadores() {
//   document.getElementById("modal-jugadores").style.display = "flex";
// }

function goToGame() {
  // const num = document.getElementById("num-jugadores").value;
  // localStorage.setItem("numJugadores", num);
  window.location.href = "interfazdejuego.html";
}

// --- SONIDOS Y MÚSICA ---
function PlayAudio() {
  document.getElementById("audio-bg").play();
}

function playUnoSound() {
  const audio = document.getElementById("UNO-sound");
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
}

function playPlusSound() {
  const audio = document.getElementById("plus-sound");
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
}

function playSkipReverseSound() {
  const audio = document.getElementById("skip-reverse-sound");
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
}

function playReverseSound() {
  const audio = document.getElementById("reverse-sound");
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
}

function playChangeColorSound() {
  const audio = document.getElementById("change-color-sound");
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
}

function playWinSound() {
  const audio = document.getElementById("win-sound");
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
}

function playErrorSound() {
  const audio = document.getElementById("error-sound");
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
}

// --- INICIO AUTOMÁTICO ---
window.onload = function () {
  if (document.getElementById("players-area")) {
    const numJugadores = parseInt(localStorage.getItem("numJugadores") || "2");
    startGameBackend(numJugadores);
  }
};
