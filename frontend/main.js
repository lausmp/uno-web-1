let gameId = null;
let gameState = null;
let ws = null;
let lastBotAction = null;
let currentTurnPlayer = null;

const PLAYER_NAMES = ['Stephanie', 'Player 2', 'Player 3', 'Player 4'];

async function startGame() {
  const res = await fetch('http://localhost:3001/start', { method: 'POST' });
  const data = await res.json();
  gameId = data.gameId;
  gameState = data;
  saveState();
  connectWebSocket();
  renderBoard(data);
}

function connectWebSocket() {
  if (ws) ws.close();
  ws = new WebSocket('ws://localhost:3001');
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe', gameId }));
  };
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    console.log('WebSocket message:', msg);
    if (msg.type === 'subscribed') return;
    if (msg.gameState) {
      gameState = msg.gameState;
      saveState();
      renderBoard(gameState, msg);
      showTurnInfo(msg);
    }
  };
  ws.onclose = () => {
    if (gameId && !gameState?.finished) setTimeout(connectWebSocket, 1000);
  };
}

function saveState() {
  localStorage.setItem('uno_gameId', gameId);
  localStorage.setItem('uno_state', JSON.stringify(gameState));
}

function restoreState() {
  gameId = localStorage.getItem('uno_gameId');
  const state = localStorage.getItem('uno_state');
  if (gameId && state) {
    gameState = JSON.parse(state);
    connectWebSocket();
    renderBoard(gameState);
    return true;
  }
  return false;
}

function renderBoard(data, lastAction = null) {
  document.getElementById('player-3').innerHTML = `
    <div class="player-name">Player 3</div>
    ${renderBackCards(data.otherPlayers[0].count)}
    <div class="card-count">${data.otherPlayers[0].count} cards</div>
  `;
  document.getElementById('player-2').innerHTML = `
    <div class="player-name">Player 2</div>
    ${renderBackCards(data.otherPlayers[1].count)}
    <div class="card-count">${data.otherPlayers[1].count} cards</div>
  `;
  document.getElementById('player-4').innerHTML = `
    <div class="player-name">Player 4</div>
    ${renderBackCards(data.otherPlayers[2].count)}
    <div class="card-count">${data.otherPlayers[2].count} cards</div>
  `;
  const isMyTurn = data.turn === 0 && !data.finished;
  document.getElementById('player-1').innerHTML = `
    <div class="player-name">Stephanie</div>
    <div>${data.clientCards.map((c, i) => renderClickableCard(c, i, isMyTurn, data)).join('')}</div>
  `;
  // Mazo clickeable solo si es tu turno y no tienes jugada válida
  const canDraw = isMyTurn && !data.clientCards.some(c => isCardValid(c, data.pileCard, data.currentColor));
  document.getElementById('deck').innerHTML = `<img src="cartas/back.jpg" class="card-img" alt="deck" style="cursor:${canDraw ? 'pointer' : 'not-allowed'};" ${canDraw ? 'onclick="drawFromDeck()"' : ''}>`;
  document.getElementById('pile').innerHTML = renderCard(data.pileCard);
  showStatus(data, lastAction);
}

function cardValueToImage(card) {
    if (!card || typeof card !== 'object') return 'empty';
    if ('numero' in card) return card.numero;
    if (card.color === 'wild') {
      if (card.type === 'wild') return 'wild';
      if (card.type === 'wild4') return 'wild4';
    }
    if (card.type === 'skip') return '11';
    if (card.type === 'reverse') return '10';
    if (card.type === 'draw2') return '12';
    if (typeof card.value === 'undefined') {
      console.warn('Card with undefined value:', card);
      return 'empty';
    }
    return card.value;
  }

function renderCard(card) {
  const name = `${card.color === 'wild' ? '' : card.color}${cardValueToImage(card)}`;
  return `<img src="cartas/${name}.png" class="card-img" alt="${name}">`;
}

function renderClickableCard(card, idx, isMyTurn, data) {
  const isValid = isMyTurn && isCardValid(card, data.pileCard, data.currentColor);
  const name = `${card.color === 'wild' ? '' : card.color}${cardValueToImage(card)}`;
  return `<img src="cartas/${name}.png" class="card-img${isValid ? ' playable' : ''}" alt="${name}" style="cursor:${isValid ? 'pointer' : 'not-allowed'};opacity:${isValid ? 1 : 0.5}" ${isValid ? `onclick="playCard(${idx})"` : ''}>`;
}

function renderBackCards(count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += '<img src="cartas/back.jpg" class="card-img" alt="back">';
  }
  return html;
}

function isCardValid(card, pileCard, currentColor) {
  if (card.color === 'wild') return true;
  if (card.color === currentColor) return true;
  if (card.type === pileCard.type && card.value === pileCard.value) return true;
  if (card.type === 'number' && card.value === pileCard.value) return true;
  if ('numero' in card && 'numero' in pileCard && card.numero === pileCard.numero) return true;
  return false;
}

async function playCard(idx) {
  if (gameState.turn !== 0 || gameState.finished) return; // Solo puedes jugar en tu turno
  const card = gameState.clientCards[idx];
  let chosenColor = null;
  if (card.color === 'wild') {
    chosenColor = prompt('Choose a color: red, yellow, green, blue', 'red');
    if (!['red','yellow','green','blue'].includes(chosenColor)) chosenColor = 'red';
  }
  const res = await fetch('http://localhost:3001/play', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, card, idx, chosenColor })
  });
  const data = await res.json();
  gameState = { ...gameState, ...data };
  saveState();
  renderBoard(gameState);
  if (data.finished) showEndMessage();
}

async function drawFromDeck() {
  if (gameState.turn !== 0 || gameState.finished) return;
  const res = await fetch('http://localhost:3001/draw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId })
  });
  const data = await res.json();
  gameState = { ...gameState, ...data.gameState };
  saveState();
  renderBoard(gameState);
  // Notificación visual (opcional)
  showTurnInfo({ type: 'client_draw_from_deck', player: 'You', card: data.card });
}

function showStatus(data, lastAction = null) {
  let msg = '';
  let turnPlayer = PLAYER_NAMES[data.turn];
  if (data.finished) {
    msg = data.clientCards.length === 0 ? 'Congratulations, you won the game!' : 'You lost!';
  } else {
    msg = data.turn === 0 ? 'Your turn' : `Turn: <b>${turnPlayer}</b>`;
    msg += ` | Current color: <span style="color:${data.currentColor}">${data.currentColor}</span>`;
  }
  let div = document.getElementById('game-status');
  if (!div) {
    div = document.createElement('div');
    div.id = 'game-status';
    div.style = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#fff3;padding:10px 20px;border-radius:8px;font-size:1.2em;z-index:10;';
    document.body.appendChild(div);
  }
  div.innerHTML = msg;
}

function showTurnInfo(msg) {
  let info = '';
  if (msg.type === 'bot_play') {
    info = `<b>${msg.player}</b> played ${renderCard(msg.card)}`;
    if (msg.card.color === 'wild') {
      info += ` and chose <span style=\"color:${msg.chosenColor}\">${msg.chosenColor}</span>`;
    }
  } else if (msg.type === 'bot_draw_from_deck') {
    info = `<b>${msg.player}</b> drew a card from the deck.`;
  } else if (msg.type === 'bot_draw') {
    info = `<b>${msg.player}</b> drew a card and passed.`;
  } else if (msg.type === 'client_play') {
    info = `<b>You played</b> ${renderCard(msg.card)}`;
    if (msg.card.color === 'wild') {
      info += ` and chose <span style=\"color:${msg.chosenColor}\">${msg.chosenColor}</span>`;
    }
  } else if (msg.type === 'client_draw_from_deck') {
    info = `<b>You drew a card from the deck.</b>`;
  } else if (msg.type === 'client_draw') {
    info = `<b>You drew a card and passed.</b>`;
  } else if (msg.type === 'client_draw_play') {
    info = `<b>You drew and played</b> ${renderCard(msg.card)}`;
    if (msg.card.color === 'wild') {
      info += ` and chose <span style=\"color:${msg.chosenColor}\">${msg.chosenColor}</span>`;
    }
  }
  let div = document.getElementById('turn-info');
  if (!div) {
    div = document.createElement('div');
    div.id = 'turn-info';
    div.style = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:#fff3;padding:10px 20px;border-radius:8px;font-size:1.1em;z-index:11;min-width:200px;text-align:center;';
    document.body.appendChild(div);
  }
  div.innerHTML = info;
  if (msg.type && msg.type.startsWith('bot_')) {
    div.style.background = '#e3f2fd';
  } else {
    div.style.background = '#fff3';
  }
}

function showEndMessage() {
  setTimeout(() => {
    alert(gameState.clientCards.length === 0 ? 'Congratulations, you won the game!' : 'You lost!');
    localStorage.removeItem('uno_gameId');
    localStorage.removeItem('uno_state');
    location.reload();
  }, 500);
}

if (!document.getElementById('btn-restart')) {
  const btn = document.createElement('button');
  btn.id = 'btn-restart';
  btn.textContent = 'Restart game';
  btn.style = 'position:fixed;top:10px;right:10px;z-index:20;padding:8px 16px;font-size:1em;';
  btn.onclick = () => {
    localStorage.removeItem('uno_gameId');
    localStorage.removeItem('uno_state');
    location.reload();
  };
  document.body.appendChild(btn);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!restoreState()) startGame();
});

const style = document.createElement('style');
style.innerHTML = `
.card-img {
  width: 60px;
  height: 90px;
  border-radius: 8px;
  margin: 0 4px;
  box-shadow: 0 1px 4px #0008;
  border: 2px solid #fff3;
  background: #fff;
  transition: transform 0.1s;
}
.card-img.playable:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px #000a;
  z-index: 2;
}
`;
document.head.appendChild(style); 