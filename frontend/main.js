let gameId = null;
let gameState = null;

async function startGame() {
  const res = await fetch('http://localhost:3001/start', { method: 'POST' });
  const data = await res.json();
  gameId = data.partidaId;
  gameState = data;
  saveState();
  renderBoard(data);
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
    renderBoard(gameState);
    return true;
  }
  return false;
}

function renderBoard(data) {
  document.getElementById('player-adrian').innerHTML = `
    <div class="player-name">Adrian</div>
    ${renderBackCards(data.otherPlayers[0].count)}
    <div class="card-count">${data.otherPlayers[0].count} cards</div>
  `;
  document.getElementById('player-cristian').innerHTML = `
    <div class="player-name">Cristian</div>
    ${renderBackCards(data.otherPlayers[1].count)}
    <div class="card-count">${data.otherPlayers[1].count} cards</div>
  `;
  document.getElementById('player-rossana').innerHTML = `
    <div class="player-name">Rossana</div>
    ${renderBackCards(data.otherPlayers[2].count)}
    <div class="card-count">${data.otherPlayers[2].count} cards</div>
  `;
  const isMyTurn = data.turn === 0 && !data.finished;
  document.getElementById('player-stephanie').innerHTML = `
    <div class="player-name">Stephanie</div>
    <div>${data.clientCards.map((c, i) => renderClickableCard(c, i, isMyTurn, data)).join('')}</div>
  `;
  document.getElementById('pile').innerHTML = renderCard(data.pileCard);
  document.getElementById('deck').innerHTML = '<img src="cartas/back.jpg" class="card-img" alt="deck">';
  showStatus(data);
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
  return `<img src="cartas/${name}.png" class="card-img${isValid ? ' playable' : ''}" alt="${name}" style="cursor:${isValid ? 'pointer' : 'default'};opacity:${isValid ? 1 : 0.5}" onclick="${isValid ? `playCard(${idx})` : ''}">`;
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
  const card = gameState.clientCards[idx];
  let chosenColor = null;
  if (card.color === 'wild') {
    chosenColor = prompt('Choose a color: red, yellow, green, blue', 'red');
    if (!['red','yellow','green','blue'].includes(chosenColor)) chosenColor = 'red';
  }
  const res = await fetch('http://localhost:3001/play', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partidaId: gameId, carta: card, idx, colorElegido: chosenColor })
  });
  const data = await res.json();
  gameState = { ...gameState, ...data };
  saveState();
  renderBoard(gameState);
  if (data.finished) showEndMessage();
}

function showStatus(data) {
  let msg = '';
  if (data.finished) {
    msg = data.clientCards.length === 0 ? 'Congratulations, you won the game!' : 'You lost!';
  } else {
    msg = data.turn === 0 ? 'Your turn' : 'Bots turn';
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