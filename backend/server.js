import cors from 'cors';
import express from 'express';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketServer } from 'ws';
// Importa funciones y constantes de inicialización de partida
import { PLAYERS, initGameState } from './gameInit.js';
// Importa utilidades generales del juego
import { drawCard, getValidCards, isCardValid, nextTurnWithDirection, sleep } from './gameUtils.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Estado en memoria
const games = {}; // Estado de cada partida por id
const wsClients = {}; // Clientes WebSocket por id de partida

// --- Funciones de utilidades ---

// Envía una actualización por WebSocket al cliente de la partida
function sendWsUpdate(gameId, data) {
  const ws = wsClients[gameId];
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

// Aplica los efectos de una carta especial (skip, reverse, draw2, wild4)
function applySpecialEffects(game, playedCard) {
  let skip = false, draw = 0;
  if (playedCard.type === 'skip') skip = true;
  if (playedCard.type === 'reverse') game.direction *= -1;
  if (playedCard.type === 'draw2') draw = 2;
  if (playedCard.type === 'wild4') draw = 4;
  return { skip, draw };
}

// Aplica penalización de robo de cartas y avanza turno
function applyDrawPenalty(game, gameId, draw, sendUpdate = true) {
  const currentTurn = game.turn
  game.turn = nextTurnWithDirection(game.turn, 4, game.direction);
  for (let i = 0; i < draw; i++) {
    drawCard(game, currentTurn);
  }
  console.log('agregando una carta',draw,  game.hands)
  if (sendUpdate) {
    sendWsUpdate(gameId, {
      type: 'draw_penalty',
      affectedPlayer: currentTurn,
      amount: draw,
      gameState: getGameState(game, gameId)
    });
  }
  // Bandera para que el bot penalizado pierda su turno
  game.skipBotTurn = true;
}

// Devuelve el estado actual de la partida para el frontend
function getGameState(game, gameId) {
  return {
    finished: game.finished,
    // el deck no se manda al cliente
    clientCards: game.hands[0],
    discardPile: game.pile[game.pile.length-1],
    currentColor: game.currentColor,
    otherPlayers: PLAYERS.map((player,i)=> {return {name: player, count: game.hands[i].length}}).filter((el,i)=> i>0),
    // [
    //   { name: PLAYERS[1], count: game.hands[1].length },
    //   { name: PLAYERS[2], count: game.hands[2].length },
    //   { name: PLAYERS[3], count: game.hands[3].length }
    // ],
    turn: game.turn,
    direction: game.direction,
    message: game.finished ? 'Game finished!' : undefined,
    gameId
  };
}

// Simula los turnos de los bots con delays y aplica reglas
async function simulateBotsWithDelay(game, gameId) {
  while (game.turn !== 0 && !game.finished) {
    // Si el bot fue penalizado, pierde el turno y resetea la bandera
    if (game.skipBotTurn) {
      game.skipBotTurn = false;
      // Solo avanza el turno, no juega ni roba
      game.turn = nextTurnWithDirection(game.turn, 4, game.direction);
      continue;
    }
    const botIdx = game.turn;
    const botHand = game.hands[botIdx];
    const discardPile = game.pile[game.pile.length-1];
    const currentColor = game.currentColor;
    let validIndexes = getValidCards(botHand, discardPile, currentColor);
    let playedCard = null;
    let chosenColor = null;
    if (validIndexes.length > 0) {
      await sleep(2500); // Simula tiempo de "pensar"
      const idx = validIndexes[0];
      playedCard = botHand.splice(idx, 1)[0];
      game.pile.push(playedCard);
      // Si es comodín, elige color
      if (playedCard.color === 'wild') {
        const colorsInHand = botHand.filter(c => c.color !== 'wild').map(c => c.color);
        chosenColor = colorsInHand.length ? colorsInHand.sort((a,b) => colorsInHand.filter(x=>x===a).length - colorsInHand.filter(x=>x===b).length).pop() : 'red';
        game.currentColor = chosenColor;
      } else {
        game.currentColor = playedCard.color;
      }
      // Aplica efectos especiales
      const { skip, draw } = applySpecialEffects(game, playedCard);
      game.turn = nextTurnWithDirection(game.turn, 4, game.direction);
      if (skip) game.turn = nextTurnWithDirection(game.turn, 4, game.direction);
      if (draw > 0) {
        applyDrawPenalty(game, gameId, draw);
      }
      sendWsUpdate(gameId, {
        type: 'bot_play',
        player: PLAYERS[botIdx],
        card: playedCard,
        gameState: getGameState(game, gameId)
      });
    } else {
      await sleep(2000); // Simula tiempo de "robar"
      const drawn = drawCard(game, botIdx);
      if (isCardValid(drawn, discardPile, currentColor)) {
        playedCard = botHand.pop();
        game.pile.push(playedCard);
        if (playedCard.color === 'wild') {
          const colorsInHand = botHand.filter(c => c.color !== 'wild').map(c => c.color);
          chosenColor = colorsInHand.length ? colorsInHand.sort((a,b) => colorsInHand.filter(x=>x===a).length - colorsInHand.filter(x=>x===b).length).pop() : 'red';
          game.currentColor = chosenColor;
        } else {
          game.currentColor = playedCard.color;
        }
        const { skip, draw } = applySpecialEffects(game, playedCard);
        game.turn = nextTurnWithDirection(game.turn, 4, game.direction);
        if (skip) game.turn = nextTurnWithDirection(game.turn, 4, game.direction);
        if (draw > 0) {
          applyDrawPenalty(game, gameId, draw);
        }
        sendWsUpdate(gameId, {
          type: 'bot_play',
          player: PLAYERS[botIdx],
          card: playedCard,
          chosenColor,
          gameState: getGameState(game, gameId)
        });
      } else {
        game.turn = nextTurnWithDirection(game.turn, 4, game.direction);
        sendWsUpdate(gameId, {
          type: 'bot_draw_from_deck',
          player: PLAYERS[botIdx],
          card: drawn,
          gameState: getGameState(game, gameId)
        });
      }
    }
    if (botHand.length === 0) game.finished = true;
  }
}

// --- Endpoints HTTP ---

// Inicia una nueva partida
app.post('/start', (req, res) => {
  const gameState = initGameState();
  const gameId = uuidv4();
  games[gameId] = gameState;
  res.json(getGameState(games[gameId], gameId));
});

// Jugar una carta o robar si no hay jugada válida
app.post('/play', async (req, res) => {
  const { gameId, card, chosenColor } = req.body;
  const game = games[gameId];
  if (!game) return res.status(400).json({ error: 'Game not found or finished' });
  if (game.finished) return res.status(400).json({ error: 'Game not found or finished' });
  if (game.turn !== 0) return res.status(400).json({ error: 'Not your turn' });
  const discardPile = game.pile[game.pile.length-1];
  const currentColor = game.currentColor;
  // Validación de carta
  if (!card || typeof card !== 'object' || !('color' in card)) {
    return res.status(400).json({ error: 'Invalid Card' });
  }
  // Si la jugada es válida
  if (isCardValid(card, discardPile, currentColor)) {
    // Añadimos la carta seleccionada a la zona de descarte
    game.pile.push(card);
    // Y la eliminamos de la mano del cliente
    game.hands[0] = game.hands[0].filter(el=> el.id !== card.id)
    // Cambiamos el color si es un comodín
    if (card.color === 'wild') {
      game.currentColor = chosenColor || 'red';
    } else {
      game.currentColor = card.color;
    }
    // Aplica efectos especiales
    const { skip, draw } = applySpecialEffects(game, card);
    game.turn = nextTurnWithDirection(game.turn, 4, game.direction);
    if (skip) game.turn = nextTurnWithDirection(game.turn, 4, game.direction);
    if (draw > 0) {
      applyDrawPenalty(game, gameId, draw);
    }
    sendWsUpdate(gameId, {
      type: 'client_play',
      player: PLAYERS[0],
      card: card,
      chosenColor: card.color === 'wild' ? game.currentColor : null,
      gameState: getGameState(game, gameId)
    });
  } else {
    // Si no tiene jugada válida, roba una carta
    const drawn = drawCard(game, 0);
    if (isCardValid(drawn, discardPile, currentColor)) {
      // Si la carta robada es válida, la juega automáticamente
      const card = hand.pop();
      game.pile.push(card);
      if (card.color === 'wild') {
        game.currentColor = chosenColor || 'red';
      } else {
        game.currentColor = card.color;
      }
      const { skip, draw } = applySpecialEffects(game, card);
      game.turn = nextTurnWithDirection(game.turn, 4, game.direction);
      if (skip) game.turn = nextTurnWithDirection(game.turn, 4, game.direction);
      if (draw > 0) {
        applyDrawPenalty(game, gameId, draw);
      }
      sendWsUpdate(gameId, {
        type: 'client_draw_play',
        player: PLAYERS[0],
        card: card,
        chosenColor: card.color === 'wild' ? game.currentColor : null,
        gameState: getGameState(game, gameId)
      });
    } else {
      // No puede jugar, pierde turno
      game.turn = nextTurnWithDirection(game.turn, 4, game.direction);
      sendWsUpdate(gameId, {
        type: 'client_draw',
        player: PLAYERS[0],
        gameState: getGameState(game, gameId)
      });
    }
  }
  // Simula los turnos de los bots
  await simulateBotsWithDelay(game, gameId);
//   if (hand.length === 0) game.finished = true;
  res.json(getGameState(game, gameId));
});

// Endpoint para robar carta manualmente
app.post('/draw', (req, res) => {
  const { gameId } = req.body;
  const game = games[gameId];
  if (!game || game.finished) return res.status(400).json({ error: 'Game not found or finished' });
  if (game.turn !== 0) return res.status(400).json({ error: 'Not your turn' });
  const card = drawCard(game, 0);
  sendWsUpdate(gameId, {
    type: 'client_draw_from_deck',
    player: PLAYERS[0],
    card,
    gameState: getGameState(game, gameId)
  });
  res.json({ card, clientCards: game.hands[0], gameState: getGameState(game, gameId) });
});

















// --- WebSocket Server ---

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Maneja conexiones WebSocket para notificaciones en tiempo real
wss.on('connection', (ws, req) => {
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'subscribe' && data.gameId) {
        wsClients[data.gameId] = ws;
        ws.send(JSON.stringify({ type: 'subscribed', gameId: data.gameId }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ error: 'Invalid message' }));
    }
  });
  ws.on('close', () => {
    for (const [gameId, client] of Object.entries(wsClients)) {
      if (client === ws) delete wsClients[gameId];
    }
  });
});

// Inicia el servidor HTTP y WebSocket
server.listen(PORT, () => {
  console.log(`UNO server listening at http://localhost:${PORT}`);
}); 