//Variables globales
let deck = [];
let discardPile = [];
const colors = ["red", "green", "blue", "yellow"];
const specialCards = ["jump", "reverse", "draw2", "draw4", "changeColor"];

//Variables de control de juego
let players = [];
let currentPlayerIndex = 0;
let direction = 1; // 1 para sentido horario, -1 para antihorario

let playersArea = document.getElementById("players-area");
let gameContainer = document.getElementById("game-container");
let deckArea = document.getElementById("deck");
let discardPileArea = document.getElementById("discard-pile");
let welcomeScreen = document.getElementById("welcome-screen");
let colorChoiceModal = document.getElementById("color-choice-modal");

//cards
const card = {
  id: "r-5",
  color: "red",
  type: "number",
  value: 5,
};

//player
const player = {
  id: "player1",
  name: "Player 1",
  cards: [],
  points: 0,
  saidUNO: false,
  isHuman: true,
};

//estado inicial de juego
const game = {
  players,
  deck,
  discardPile,
  turn: currentPlayerIndex,
  direction,
  currentCard: null,
  waitingForColor: false,
  roundWinner: null,
};

function startGame(numJugadores = 4) {
  initializeDeck();
  createPlayers(numJugadores);
  dealCards();
  showCards();
  game.players = players;
  game.deck = deck;
  game.discardPile = discardPile;
  currentPlayerIndex = 0;
  game.turn = currentPlayerIndex;
  game.direction = 1;
  game.currentCard = discardPile[discardPile.length - 1];
  game.waitingForColor = false;
  game.roundWinner = null;
}

function initializeDeck() {
  deck = [];
  for (let color of colors) {
    deck.push({ id: `${color[0]}-${0}`, color, type: "number", value: 0 });
    for (let i = 1; i <= 9; i++) {
      let n = 1;
      while (n <= 2) {
        deck.push({ id: `${color[0]}-${i}`, color, type: "number", value: i });
        n++;
      }
    }
    for (let card of specialCards) {
      let n = 1;
      if (card !== "changeColor" && card !== "draw4") {
        while (n <= 2) {
          deck.push({
            id: `${color[0]}-${card}`,
            color: color,
            type: "special",
            value: card,
          });
          n++;
        }
      }
    }
  }
  for (let card of specialCards) {
    let n = 1;
    if (card === "changeColor" || card === "draw4") {
      while (n <= 4) {
        deck.push({
          id: card,
          color: null,
          type: "special",
          value: card,
        });
        n++;
      }
    } else {
      continue;
    }
  }
  shuffleDeck();
  firstCard();
}

function firstCard() {
  for (let card of deck) {
    if (card.type !== "special") {
      discardPile.push(card);
      deck.splice(deck.indexOf(card), 1);
      break;
    }
  }
}

function shuffleDeck() {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function createPlayers(num) {
  playersArea.innerHTML = "";
  players = [];
  let html = "";
  for (let i = 0; i < num; i++) {
    html += `<div id="player${i + 1}" class="player"><h3>Jugador ${
      i + 1
    }</h3></div>`;
    players.push({
      id: `player${i + 1}`,
      name: `Jugador ${i + 1}`,
      cards: [],
      points: 0,
      saidUNO: false,
      isHuman: i === 0,
    });
  }
  html += `<div id="center-area">
    <div id="discard-pile"></div>
    <div id="deck"></div>
  </div>`;
  playersArea.innerHTML = html;
}

function dealCards() {
  const cardsPerPlayer = 7;
  for (let i = 0; i < players.length; i++) {
    for (let j = 0; j < cardsPerPlayer; j++) {
      players[i].cards.push(deck.shift());
    }
  }
}

function showCards() {
  let deckArea = document.getElementById("deck");
  let discardPileArea = document.getElementById("discard-pile");
  for (let player of players) {
    const playerDiv = document.getElementById(`${player.id}`);
    playerDiv.innerHTML = `<div class=nameofPlayer><h3>${player.name}</h3></div>`;
    const handDiv = document.createElement("div");
    handDiv.className = "hand";
    player.cards.forEach((card) => {
      const img = document.createElement("img");
      if (player.id !== "player1") {
        img.src = `Assets/backcard.png`;
      } else {
        img.src = `Assets/${card.id}.png`;
        img.onclick = () => playCard(0, card);
      }
      img.className = "card-img";
      if (players.indexOf(player) === currentPlayerIndex) {
        img.classList.add("active-card");
      }
      handDiv.appendChild(img);
    });
    playerDiv.appendChild(handDiv);
  }
  deckArea.innerHTML = "";
  discardPileArea.innerHTML = "";
  if (deck.length > 0) {
    const deckImg = document.createElement("img");
    deckImg.src = "Assets/backcard.png";
    deckImg.className = "card-img deck-card";

    if (players[currentPlayerIndex].id === "player1") {
      deckImg.onclick = () => drawCard(0);
    }
    deckArea.appendChild(deckImg);
  }

  discardPileArea.innerHTML = "";
  if (discardPile.length > 0) {
    const topCard = discardPile[discardPile.length - 1];
    const img = document.createElement("img");
    img.src = `Assets/${topCard.id}.png`;
    img.className = "card-img discard-card";
    discardPileArea.appendChild(img);
  }
}

function validCard(card, topCard) {
  return (
    card.color === topCard.color ||
    card.value === topCard.value ||
    (card.type === "special" &&
      (card.value === "changeColor" || card.value === "draw4"))
  );
}

async function playCard(playerIndex, card) {
  const currentPlayer = players[playerIndex];
  const topCard = discardPile[discardPile.length - 1];

  if (validCard(card, topCard)) {
    discardPile.push(card);
    const cardIndex = currentPlayer.cards.indexOf(card);
    currentPlayer.cards.splice(cardIndex, 1);
    game.currentCard = card;

    if (currentPlayer.cards.length === 1) {
      if (!currentPlayer.isHuman) {
        setTimeout(() => {
          currentPlayer.saidUNO = true;
          showModalAlert(`${currentPlayer.name} ha dicho UNO!`, () => {
            playUnoSound();
            nextTurn();
          });
        }, 200);
        return;
      }
    }

    // Si gana la ronda
    if (currentPlayer.cards.length === 0) {
      playWinSound();
      showCards();
      const points = countPoints();
      const okBtn = document.getElementById("modal-alert-OK");
      okBtn.textContent = "Volver a jugar";
      showModalAlert(
        `${currentPlayer.name} ha ganado la ronda! Su puntaje es ${points} `,
        () => {
          okBtn.textContent = "OK";
          players[currentPlayerIndex].points = points;
          resetRound();
        },
        true,
        () => {
          window.location.href = "index.html";
        }
      );
      return;
    }

    // efectos de cartas especiales
    if (card.type === "special") {
      if (card.value === "reverse") {
        playSkipReverseSound();
        direction *= -1;
        game.direction = direction;
        if (players.length === 2) {
          setTimeout(() => nextTurn(true), 800);
          return;
        }
      }
      if (card.value === "jump") {
        playSkipReverseSound();
        if (players.length === 2) {
          setTimeout(() => nextTurn(true), 800);
          return;
        } else {
          currentPlayerIndex += direction;
          if (currentPlayerIndex >= players.length) currentPlayerIndex = 0;
          if (currentPlayerIndex < 0) currentPlayerIndex = players.length - 1;
        }
      }
      if (card.value === "draw2") {
        playPlusSound();
        let nextIndex = currentPlayerIndex + direction;
        if (nextIndex >= players.length) nextIndex = 0;
        if (nextIndex < 0) nextIndex = players.length - 1;
        forceDraw(nextIndex, 2);
        if (players.length === 2) {
          setTimeout(() => nextTurn(true), 800);
          return;
        } else {
          currentPlayerIndex += direction;
          if (currentPlayerIndex >= players.length) currentPlayerIndex = 0;
          if (currentPlayerIndex < 0) currentPlayerIndex = players.length - 1;
        }
      }
      if (card.value === "changeColor" || card.value === "draw4") {
        let chosenColor;
        if (players[playerIndex].isHuman) {
          chosenColor = await chooseColor();
          showModalAlert(`El nuevo color es: ${chosenColor}`, () => {
            discardPile[discardPile.length - 1].color = chosenColor;
            playChangeColorSound();
            if (card.value === "draw4") {
              let nextIndex = currentPlayerIndex + direction;
              if (nextIndex >= players.length) nextIndex = 0;
              if (nextIndex < 0) nextIndex = players.length - 1;
              forceDraw(nextIndex, 4);
              if (players.length === 2) {
                nextTurn(true);
                return;
              } else {
                currentPlayerIndex += direction;
                if (currentPlayerIndex >= players.length)
                  currentPlayerIndex = 0;
                if (currentPlayerIndex < 0)
                  currentPlayerIndex = players.length - 1;
              }
            }
            setTimeout(() => nextTurn(), 800);
          });
          return;
        } else {
          chosenColor = getRandomColor();
          showModalAlert(`El nuevo color es: ${chosenColor}`, () => {
            discardPile[discardPile.length - 1].color = chosenColor;
            playChangeColorSound();
            if (card.value === "draw4") {
              playPlusSound();
              let nextIndex = currentPlayerIndex + direction;
              if (nextIndex >= players.length) nextIndex = 0;
              if (nextIndex < 0) nextIndex = players.length - 1;
              forceDraw(nextIndex, 4);
              if (players.length === 2) {
                nextTurn(true);
                return;
              } else {
                currentPlayerIndex += direction;
                if (currentPlayerIndex >= players.length)
                  currentPlayerIndex = 0;
                if (currentPlayerIndex < 0)
                  currentPlayerIndex = players.length - 1;
              }
            }
            setTimeout(() => nextTurn(), 800);
          });
          return;
        }
      }
    }
    nextTurn();
  } else {
    showModalAlert("No puedes jugar esa carta!");
    playErrorSound();
  }
}

function botTurn(botIndex) {
  const bot = players[botIndex];
  const topCard = discardPile[discardPile.length - 1];
  let played = false;
  for (let card of bot.cards) {
    if (
      card.color === topCard.color ||
      card.value === topCard.value ||
      (card.type === "special" &&
        (card.value === "changeColor" || card.value === "draw4"))
    ) {
      playCard(botIndex, card);
      played = true;
      break;
    }
  }
  if (played === false) {
    drawCard(botIndex);
  }
}

function forceDraw(playerIndex, n) {
  for (let i = 0; i < n; i++) {
    replenishDeck();
    if (deck.length === 0) break;
    const card = deck.shift();
    players[playerIndex].cards.push(card);
  }
  showCards();
}

function replenishDeck() {
  if (deck.length === 0) {
    const topCard = discardPile.pop();
    deck = discardPile;
    discardPile = [topCard];
    shuffleDeck();
  }
}

function drawCard(playerIndex) {
  replenishDeck();
  const card = deck.shift();
  players[playerIndex].cards.push(card);
  showCards();
  if (validCard(card, discardPile[discardPile.length - 1])) {
    setTimeout(() => playCard(playerIndex, card), 700);
  } else {
    setTimeout(() => nextTurn(), 700);
  }
}

function nextTurn(skipAdvance = false) {
  if (!skipAdvance) {
    currentPlayerIndex += direction;
    if (currentPlayerIndex >= players.length) currentPlayerIndex = 0;
    if (currentPlayerIndex < 0) currentPlayerIndex = players.length - 1;
    showCards();
  }
  game.turn = currentPlayerIndex;
  const currentPlayer = players[currentPlayerIndex];
  if (currentPlayer.cards.length === 1 && !currentPlayer.saidUNO) {
    showModalAlert(
      `¡${currentPlayer.name} NO ha dicho UNO! ¡Penalización!`,
      () => {
        forceDraw(currentPlayerIndex, 2);
        showCards();
      }
    );
    currentPlayer.saidUNO = false;
    return;
  }
  currentPlayer.saidUNO = false;
  showCards();
  if (!players[currentPlayerIndex].isHuman) {
    setTimeout(() => botTurn(currentPlayerIndex), 700);
  }
}

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

function getRandomColor() {
  return colors[Math.floor(Math.random() * colors.length)];
}

function checkUNO() {
  const player = players[0];
  if (player.cards.length === 1 && !player.saidUNO) {
    player.saidUNO = true;
    showModalAlert("¡Has dicho UNO!");
    playUnoSound();
  } else {
    forceDraw(0, 2);
    showModalAlert(
      "¡Penalización! Solo puedes decir UNO cuando te queda una carta."
    );
  }
}

function countPoints() {
  let points = 0;
  for (let player of players) {
    for (let card of player.cards) {
      if (card.type === "number") {
        points += card.value;
      } else if (card.type === "special") {
        if (
          card.value === "draw2" ||
          card.value === "reverse" ||
          card.value === "jump"
        ) {
          points += 20;
        }
        if (card.value === "changeColor" || card.value === "draw4") {
          points += 50;
        }
      }
    }
  }
  return points;
}

function resetRound() {
  for (let player of players) {
    player.cards = [];
    player.saidUNO = false;
  }
  currentPlayerIndex = 0;
  game.turn = currentPlayerIndex;
  game.direction = 1;
  game.currentCard = discardPile[discardPile.length - 1];
  game.waitingForColor = false;
  game.roundWinner = null;
  deck = [];
  discardPile = [];
  initializeDeck();
  dealCards();
  showCards();
}

document.querySelector(".uno-button").addEventListener("click", checkUNO);

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

function openModalJugadores() {
  document.getElementById("modal-jugadores").style.display = "flex";
}

function goToGame() {
  const num = document.getElementById("num-jugadores").value;
  localStorage.setItem("numJugadores", num);
  window.location.href = "interfazdejuego.html";
}

//MUSICA
function PlayAudio() {
  document.getElementById("audio-bg").play();
}

//Modales Alerta
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

window.onload = function () {
  if (document.getElementById("players-area")) {
    const numJugadores = parseInt(localStorage.getItem("numJugadores") || "2");
    startGame(numJugadores);
  }
};

//Musica Cartas
function playUnoSound() {
  const audio = document.getElementById("UNO-sound");
  if (audio) {
    audio.currentTime = 0; // Reinicia el sonido si ya está sonando
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
