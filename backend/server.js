import cors from 'cors';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- UNO constants and utilities ---
const COLORS = ['red', 'yellow', 'green', 'blue'];
const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const SPECIALS = ['skip', 'reverse', 'draw2'];
const WILDS = ['wild', 'wild4'];
const PLAYERS = ['Stephanie', 'Adrian', 'Cristian', 'Rossana'];

// In-memory game state (by id)
const games = {};

function createDeck() {
  const deck = [];
  // Number cards
  for (const color of COLORS) {
    deck.push({ color, type: 'number', value: '0' }); // Only one 0 per color
    for (let n = 1; n <= 9; n++) {
      deck.push({ color, type: 'number', value: String(n) });
      deck.push({ color, type: 'number', value: String(n) });
    }
    // Specials per color
    for (let i = 0; i < 2; i++) {
      deck.push({ color, type: 'skip', value: 'skip' });
      deck.push({ color, type: 'reverse', value: 'reverse' });
      deck.push({ color, type: 'draw2', value: 'draw2' });
    }
  }
  // Wilds
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', type: 'wild', value: 'wild' });
    deck.push({ color: 'wild', type: 'wild4', value: 'wild4' });
  }
  return deck;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function dealHands(deck, numPlayers, cardsPerPlayer) {
  const hands = [];
  for (let i = 0; i < numPlayers; i++) {
    hands.push([]);
  }
  for (let c = 0; c < cardsPerPlayer; c++) {
    for (let j = 0; j < numPlayers; j++) {
      hands[j].push(deck.pop());
    }
  }
  return hands;
}

function isCardValid(card, pileCard, currentColor) {
  if (!card) return false;
  if (card.color === 'wild') return true;
  if (card.color === currentColor) return true;
  if (card.type === 'number' && pileCard.type === 'number' && card.value === pileCard.value) return true;
  // Solo puedes poner skip, reverse, draw2 si el color coincide
  if (SPECIALS.includes(card.type) && card.color === currentColor && card.type === pileCard.type) return true;
  return false;
}

function nextTurn(turn, direction, numPlayers) {
  return (turn + direction + numPlayers) % numPlayers;
}

function getValidCards(hand, pileCard, currentColor) {
  return hand.map((c, i) => isCardValid(c, pileCard, currentColor) ? i : -1).filter(i => i !== -1);
}

function drawCard(game, playerIdx) {
  if (game.deck.length === 0) return null;
  const card = game.deck.pop();
  game.hands[playerIdx].push(card);
  return card;
}

function simulateBot(game, botIdx) {
  const hand = game.hands[botIdx];
  const pileCard = game.pile[game.pile.length-1];
  const currentColor = game.currentColor;
  let validIndexes = getValidCards(hand, pileCard, currentColor);
  if (validIndexes.length > 0) {
    // Juega la primera carta válida
    return { play: true, idx: validIndexes[0] };
  } else {
    // Roba una carta
    const drawn = drawCard(game, botIdx);
    if (isCardValid(drawn, pileCard, currentColor)) {
      return { play: true, idx: hand.length - 1 };
    } else {
      return { play: false };
    }
  }
}

// --- Endpoints ---

// Start game
app.post('/start', (req, res) => {
  const deck = shuffle(createDeck());
  const hands = dealHands(deck, 4, 7);
  let pileCard = deck.pop();
  while (pileCard.color === 'wild') pileCard = deck.pop();
  const gameId = uuidv4();
  games[gameId] = {
    deck,
    hands,
    pile: [pileCard],
    currentColor: pileCard.color,
    turn: 0, // Stephanie
    direction: 1,
    finished: false
  };
  res.json({
    gameId,
    clientName: PLAYERS[0],
    clientCards: hands[0],
    pileCard,
    currentColor: pileCard.color,
    otherPlayers: [
      { name: PLAYERS[1], count: hands[1].length },
      { name: PLAYERS[2], count: hands[2].length },
      { name: PLAYERS[3], count: hands[3].length }
    ],
    turn: 0,
    finished: false
  });
});

// Play card
app.post('/play', (req, res) => {
  console.log('POST /play BODY:', req.body);
  const { gameId, card, idx, chosenColor } = req.body;
  const game = games[gameId];
  if (!game) {
    console.error('Game not found:', gameId);
    return res.status(400).json({ error: 'Game not found or finished' });
  }
  if (game.finished) {
    console.error('Game already finished:', gameId);
    return res.status(400).json({ error: 'Game not found or finished' });
  }
  if (game.turn !== 0) {
    console.error('Not your turn:', gameId);
    return res.status(400).json({ error: 'Not your turn' });
  }
  const hand = game.hands[0];
  const pileCard = game.pile[game.pile.length-1];
  const currentColor = game.currentColor;
  let played = false;
  // Validación de carta
  console.log(card,req.body.card)
  if (!card || typeof card !== 'object' || !('color' in card)) {
    console.error('Carta inválida o no enviada:', card);
    return res.status(400).json({ error: 'Carta inválida o no enviada' });
  }

  // Validar jugada del cliente
  if (idx !== undefined && isCardValid(card, pileCard, currentColor)) {
    // Jugar carta
    const playedCard = hand.splice(idx, 1)[0];
    game.pile.push(playedCard);
    played = true;
    // Cambiar color si es wild
    if (playedCard.color === 'wild') {
      game.currentColor = chosenColor || 'red';
    } else {
      game.currentColor = playedCard.color;
    }
    // Efectos especiales
    let skip = false, draw = 0;
    if (playedCard.type === 'skip') skip = true;
    if (playedCard.type === 'reverse') game.direction *= -1;
    if (playedCard.type === 'draw2') draw = 2;
    if (playedCard.type === 'wild4') draw = 4;
    // Siguiente turno
    game.turn = nextTurn(game.turn, game.direction, 4);
    if (skip) game.turn = nextTurn(game.turn, game.direction, 4);
    if (draw > 0) {
      for (let i = 0; i < draw; i++) {
        drawCard(game, game.turn);
      }
      game.turn = nextTurn(game.turn, game.direction, 4);
    }
  } else {
    // No tiene carta válida, roba una
    const drawn = drawCard(game, 0);
    if (isCardValid(drawn, pileCard, currentColor)) {
      // Si la carta robada es válida, la juega automáticamente
      const playedCard = hand.pop();
      game.pile.push(playedCard);
      if (playedCard.color === 'wild') {
        game.currentColor = chosenColor || 'red';
      } else {
        game.currentColor = playedCard.color;
      }
      let skip = false, draw = 0;
      if (playedCard.type === 'skip') skip = true;
      if (playedCard.type === 'reverse') game.direction *= -1;
      if (playedCard.type === 'draw2') draw = 2;
      if (playedCard.type === 'wild4') draw = 4;
      game.turn = nextTurn(game.turn, game.direction, 4);
      if (skip) game.turn = nextTurn(game.turn, game.direction, 4);
      if (draw > 0) {
        for (let i = 0; i < draw; i++) {
          drawCard(game, game.turn);
        }
        game.turn = nextTurn(game.turn, game.direction, 4);
      }
    } else {
      // No puede jugar, pierde turno
      game.turn = nextTurn(game.turn, game.direction, 4);
    }
  }

  // Simular bots
  while (game.turn !== 0 && !game.finished) {
    const botIdx = game.turn;
    const botHand = game.hands[botIdx];
    const pileCard = game.pile[game.pile.length-1];
    const currentColor = game.currentColor;
    let botAction = simulateBot(game, botIdx);
    if (botAction.play) {
      const playedCard = botHand.splice(botAction.idx, 1)[0];
      game.pile.push(playedCard);
      if (playedCard.color === 'wild') {
        const colorsInHand = botHand.filter(c => c.color !== 'wild').map(c => c.color);
        game.currentColor = colorsInHand.length ? colorsInHand.sort((a,b) => colorsInHand.filter(x=>x===a).length - colorsInHand.filter(x=>x===b).length).pop() : 'red';
      } else {
        game.currentColor = playedCard.color;
      }
      let skip = false, draw = 0;
      if (playedCard.type === 'skip') skip = true;
      if (playedCard.type === 'reverse') game.direction *= -1;
      if (playedCard.type === 'draw2') draw = 2;
      if (playedCard.type === 'wild4') draw = 4;
      game.turn = nextTurn(game.turn, game.direction, 4);
      if (skip) game.turn = nextTurn(game.turn, game.direction, 4);
      if (draw > 0) {
        for (let i = 0; i < draw; i++) {
          drawCard(game, game.turn);
        }
        game.turn = nextTurn(game.turn, game.direction, 4);
      }
    } else {
      // Bot no puede jugar, roba una
      const drawn = drawCard(game, botIdx);
      if (isCardValid(drawn, pileCard, currentColor)) {
        const playedCard = botHand.pop();
        game.pile.push(playedCard);
        if (playedCard.color === 'wild') {
          const colorsInHand = botHand.filter(c => c.color !== 'wild').map(c => c.color);
          game.currentColor = colorsInHand.length ? colorsInHand.sort((a,b) => colorsInHand.filter(x=>x===a).length - colorsInHand.filter(x=>x===b).length).pop() : 'red';
        } else {
          game.currentColor = playedCard.color;
        }
        let skip = false, draw = 0;
        if (playedCard.type === 'skip') skip = true;
        if (playedCard.type === 'reverse') game.direction *= -1;
        if (playedCard.type === 'draw2') draw = 2;
        if (playedCard.type === 'wild4') draw = 4;
        game.turn = nextTurn(game.turn, game.direction, 4);
        if (skip) game.turn = nextTurn(game.turn, game.direction, 4);
        if (draw > 0) {
          for (let i = 0; i < draw; i++) {
            drawCard(game, game.turn);
          }
          game.turn = nextTurn(game.turn, game.direction, 4);
        }
      } else {
        game.turn = nextTurn(game.turn, game.direction, 4);
      }
    }
    if (botHand.length === 0) game.finished = true;
  }
  if (hand.length === 0) game.finished = true;
  res.json({
    finished: game.finished,
    clientCards: hand,
    pileCard: game.pile[game.pile.length-1],
    currentColor: game.currentColor,
    otherPlayers: [
      { name: PLAYERS[1], count: game.hands[1].length },
      { name: PLAYERS[2], count: game.hands[2].length },
      { name: PLAYERS[3], count: game.hands[3].length }
    ],
    turn: game.turn,
    message: game.finished ? 'Game finished!' : undefined
  });
});

app.listen(PORT, () => {
  console.log(`UNO server listening at http://localhost:${PORT}`);
}); 