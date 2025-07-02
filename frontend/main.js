let gameId = null;
let gameState = null;
let ws = null;
let lastBotAction = null;
let currentTurnPlayer = null;

const PLAYER_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

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
    console.log(`WebSocket message: ${msg.type}`, msg);
    if (msg.type === 'subscribed') return;
    if (msg.type === 'game_finished') {
      // Mostrar alerta con el ganador
      alert(msg.winner === PLAYER_NAMES[0] ? '¡Felicidades, ganaste!' : `¡${msg.winner} ha ganado la partida!`);
      localStorage.removeItem('uno_gameId');
      localStorage.removeItem('uno_state');
      setTimeout(() => location.reload(), 1000);
      return;
    }
    if (msg.gameState) {
      gameState = msg.gameState;
      saveState();
      renderBoard(gameState, msg);
      showTurnInfo(msg);
    }
    // Manejar mensajes que no tienen gameState
    if (msg.type === 'uno_warning' || msg.type === 'uno_penalty') {
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
  // Resaltar el jugador activo
  const turnIdx = data.turn;
  const playerIds = ['player-1', 'player-2', 'player-3', 'player-4'];
  playerIds.forEach((id, idx) => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle('active-player', idx === turnIdx);
    }
  });
  document.getElementById('player-3').innerHTML = `
    <div class="player-name">Player 3</div>
    ${renderBackCards(data.otherPlayers[1].count)}
    <div class="card-count">${data.otherPlayers[1].count} cards</div>
  `;
  document.getElementById('player-2').innerHTML = `
    <div class="player-name">Player 2</div>
    ${renderBackCards(data.otherPlayers[0].count)}
    <div class="card-count">${data.otherPlayers[0].count} cards</div>
  `;
  document.getElementById('player-4').innerHTML = `
    <div class="player-name">Player 4</div>
    ${renderBackCards(data.otherPlayers[2].count)}
    <div class="card-count">${data.otherPlayers[2].count} cards</div>
  `;
  const isMyTurn = data.turn === 0 && !data.finished;
  document.getElementById('player-1').innerHTML = `
    <div class="player-name">Player 1</div>
    <div>${data.clientCards.map(c => renderClickableCard(c, isMyTurn, data)).join('')}</div>
  `;
  // Mazo clickeable solo si es tu turno y no tienes jugada válida
  const canDraw = isMyTurn && !data.clientCards.some(c => isCardValid(c, data.discardPile, data.currentColor));
  document.getElementById('deck').innerHTML = `<img src="cartas/back.jpg" class="card-img" alt="deck" style="cursor:${canDraw ? 'pointer' : 'not-allowed'};" ${canDraw ? 'onclick="drawFromDeck()"' : ''}>`;
  document.getElementById('pile').innerHTML = renderCard(data.discardPile);
  showStatus(data, lastAction);
  
  // Mostrar botón de UNO si el cliente tiene una carta
  if (data.clientCards.length === 1) {
    showUnoButton();
  } else {
    hideUnoButton();
  }
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

function renderClickableCard(card, isMyTurn, data) {
  const isValid = isMyTurn && isCardValid(card, data.discardPile, data.currentColor);
  const name = `${card.color === 'wild' ? '' : card.color}${cardValueToImage(card)}`;
  return `<img src="cartas/${name}.png" class="card-img${isValid ? ' playable' : ''}" alt="${name}" style="cursor:${isValid ? 'pointer' : 'not-allowed'};opacity:${isValid ? 1 : 0.5}" ${isValid ? `onclick="playCard(${card.id})"` : ''}>`;
}

function renderBackCards(count) {
  let html = '';
  const maxCards = Math.min(count, 7);
  for (let i = 0; i < maxCards; i++) {
    html += '<img src="cartas/back.jpg" class="card-img" alt="back">';
  }
  return html;
}

function isCardValid(card, discardPile, currentColor) {
  if (card.color === 'wild') return true;
  if (card.color === currentColor) return true;
  if (card.type === discardPile.type && card.value === discardPile.value) return true;
  if (card.type === 'number' && card.value === discardPile.value) return true;
  if ('numero' in card && 'numero' in discardPile && card.numero === discardPile.numero) return true;
  return false;
}

async function playCard(cardId) {
  const card  = gameState.clientCards.find(el=> el.id === String(cardId))
  if (gameState.turn !== 0 || gameState.finished) return; // Solo puedes jugar en tu turno
  let chosenColor = null;
  if (card.color === 'wild') {
    chosenColor = prompt('Choose a color: red, yellow, green, blue', 'red');
    if (!['red','yellow','green','blue'].includes(chosenColor)) chosenColor = 'red';
  }
  const res = await fetch('http://localhost:3001/play', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, card, chosenColor })
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

async function sayUno() {
  if (gameState.clientCards.length !== 1) return;
  const res = await fetch('http://localhost:3001/uno', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId })
  });
  const data = await res.json();
  if (data.success) {
    gameState = { ...gameState, ...data.gameState };
    saveState();
    renderBoard(gameState);
    showTurnInfo({ type: 'client_uno', player: 'You' });
    hideUnoButton();
  }
}

function showUnoButton() {
  let btn = document.getElementById('uno-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'uno-btn';
    btn.textContent = '¡UNO!';
    btn.style = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);z-index:50;padding:20px 40px;font-size:2em;font-weight:bold;background:#ffeb3b;color:#000;border:3px solid #000;border-radius:15px;box-shadow:0 4px 20px #0004;cursor:pointer;transition:all 0.2s;animation:unoButtonPulse 1s ease-in-out infinite alternate;';
    btn.onclick = sayUno;
    btn.onmouseover = () => btn.style.background = '#ffd700';
    btn.onmouseout = () => btn.style.background = '#ffeb3b';
    document.body.appendChild(btn);
  }
  btn.style.display = 'block';
}

function hideUnoButton() {
  const btn = document.getElementById('uno-btn');
  if (btn) {
    btn.style.display = 'none';
  }
}

function showStatus(data, lastAction = null) {
  let msg = '';
  if (data.finished) {
    msg = data.clientCards.length === 0 ? 'Congratulations, you won the game!' : 'You lost!';
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
  // Notificaciones relevantes
  if (msg.type === 'draw_penalty') {
    info = `<b>${msg.affectedPlayer}</b> drew ${msg.amount} card${msg.amount > 1 ? 's' : ''} as penalty.`;
  } else if (msg.type === 'bot_draw_from_deck') {
    info = `<b>${msg.player}</b> drew a card from the deck.`;
  } else if (msg.type === 'bot_draw') {
    info = `<b>${msg.player}</b> drew a card and passed.`;
  } else if (msg.type === 'bot_uno') {
    info = `<b>${msg.player} dice UNO!</b>`;
  } else if (msg.type === 'uno_warning') {
    info = `<b>¡Tienes una carta! ¡Di UNO antes de 4 segundos!</b>`;
  } else if (msg.type === 'uno_penalty') {
    info = `<b>¡No dijiste UNO! +2 cartas como penalización.</b>`;
  } else if (msg.type === 'client_draw_from_deck') {
    info = `<b>You drew a card from the deck.</b>`;
  } else if (msg.type === 'client_draw') {
    info = `<b>You drew a card and passed.</b>`;
  } else if (msg.type === 'client_draw_play') {
    info = `<b>You drew and played</b> ${renderCard(msg.card)}`;
    if (msg.card.color === 'wild') {
      info += ` and chose <span style=\"color:${msg.chosenColor}\">${msg.chosenColor}</span>`;
    }
  } else if (msg.type === 'client_uno') {
    info = `<b>¡Tú dices UNO!</b>`;
  }
  // Notificación de cambio de color por comodín
  if ((msg.type === 'bot_play' || msg.type === 'client_play' || msg.type === 'client_draw_play') && msg.card && msg.card.color === 'wild' && msg.chosenColor) {
    if (msg.type.startsWith('bot_')) {
      info = `<b>${msg.player}</b> changed the color to <span style=\"color:${msg.chosenColor}\">${msg.chosenColor}</span>`;
    } else {
      info = `<b>You changed the color to <span style=\"color:${msg.chosenColor}\">${msg.chosenColor}</span></b>`;
    }
  }
  let div = document.getElementById('turn-info');
  if (!div) {
    div = document.createElement('div');
    div.id = 'turn-info';
    div.style = 'position:absolute;top:calc(50% + 80px);left:50%;transform:translateX(-50%);background:#fff3;padding:12px 24px;border-radius:10px;font-size:1.1em;z-index:30;min-width:220px;text-align:center;box-shadow:0 2px 8px #0002;';
    const center = document.getElementById('center');
    if (center) center.appendChild(div); else document.body.appendChild(div);
  }
  div.innerHTML = info;
  div.style.display = info ? 'block' : 'none';
  if (msg.type && msg.type.startsWith('bot_')) {
    div.style.background = '#e3f2fd';
  } else {
    div.style.background = '#fff3';
  }
  
  // Estilo especial para el mensaje UNO
  if (msg.type === 'bot_uno' || msg.type === 'client_uno') {
    div.style.background = '#ffeb3b';
    div.style.color = '#000';
    div.style.fontWeight = 'bold';
    div.style.fontSize = '1.3em';
    div.style.animation = 'unoPulse 1s ease-in-out';
  }
  
  // Estilo especial para advertencia de UNO
  if (msg.type === 'uno_warning') {
    div.style.background = '#ff9800';
    div.style.color = '#fff';
    div.style.fontWeight = 'bold';
    div.style.fontSize = '1.2em';
    div.style.animation = 'unoWarning 0.5s ease-in-out infinite alternate';
  }
  
  // Estilo especial para penalización de UNO
  if (msg.type === 'uno_penalty') {
    div.style.background = '#f44336';
    div.style.color = '#fff';
    div.style.fontWeight = 'bold';
    div.style.fontSize = '1.2em';
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
  btn.style = 'position:fixed;top:20px;right:20px;z-index:40;padding:12px 28px;font-size:1.1em;font-weight:bold;background:#1976d2;color:#fff;border:none;border-radius:8px;box-shadow:0 2px 8px #0002;cursor:pointer;transition:background 0.2s;';
  btn.onmouseover = () => btn.style.background = '#1565c0';
  btn.onmouseout = () => btn.style.background = '#1976d2';
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
.active-player .player-name, .active-player-name {
  color: #1976d2 !important;
  font-weight: bold;
  text-shadow: 0 2px 8px #fff8;
  background: #e3f2fd;
  border-radius: 6px;
  padding: 2px 8px;
}
@keyframes unoPulse {
  0% { transform: translateX(-50%) scale(1); }
  50% { transform: translateX(-50%) scale(1.1); }
  100% { transform: translateX(-50%) scale(1); }
}
@keyframes unoWarning {
  0% { background: #ff9800; }
  100% { background: #ff5722; }
}
@keyframes unoButtonPulse {
  0% { transform: translate(-50%, -50%) scale(1); }
  100% { transform: translate(-50%, -50%) scale(1.1); }
}
`;
document.head.appendChild(style); 