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
  if (card.color === 'wild') return true;
  if (card.color === currentColor) return true;
  if (card.type === pileCard.type && card.value === pileCard.value) return true;
  if (card.type === 'number' && card.value === pileCard.value) return true;
  return false;
}

function nextTurn(turn, direction, numPlayers) {
  return (turn + direction + numPlayers) % numPlayers;
}

function simulateBot(player, hand, pileCard, currentColor) {
  for (let i = 0; i < hand.length; i++) {
    if (isCardValid(hand[i], pileCard, currentColor)) {
      return { card: hand[i], idx: i };
    }
  }
  return null;
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
  const { gameId, carta, idx, colorElegido } = req.body;
  const game = games[gameId];
  if (!game || game.finished) return res.status(400).json({ error: 'Game not found or finished' });
  if (game.turn !== 0) return res.status(400).json({ error: 'Not your turn' });
  const hand = game.hands[0];
  // Validate card
  if (!isCardValid(carta, game.pile[game.pile.length-1], game.currentColor)) {
    return res.status(400).json({ error: 'Invalid card' });
  }
  // Play card
  hand.splice(idx, 1);
  game.pile.push(carta);
  // Change color if wild
  if (carta.color === 'wild') {
    game.currentColor = colorElegido || 'red';
  } else {
    game.currentColor = carta.color;
  }
  // Special effects
  let skip = false, draw = 0;
  if (carta.type === 'skip') skip = true;
  if (carta.type === 'reverse') game.direction *= -1;
  if (carta.type === 'draw2') draw = 2;
  if (carta.type === 'wild4') draw = 4;
  // Next turn
  game.turn = nextTurn(game.turn, game.direction, 4);
  if (skip) game.turn = nextTurn(game.turn, game.direction, 4);
  // Draw cards if needed
  if (draw > 0) {
    for (let i = 0; i < draw; i++) {
      game.hands[game.turn].push(game.deck.pop());
    }
    game.turn = nextTurn(game.turn, game.direction, 4);
  }
  // Simulate bots until it's the client's turn or someone wins
  while (game.turn !== 0 && !game.finished) {
    const botIdx = game.turn;
    const botHand = game.hands[botIdx];
    const play = simulateBot(PLAYERS[botIdx], botHand, game.pile[game.pile.length-1], game.currentColor);
    if (play) {
      // Bot plays card
      const botCard = botHand.splice(play.idx, 1)[0];
      game.pile.push(botCard);
      if (botCard.color === 'wild') {
        const colorsInHand = botHand.filter(c => c.color !== 'wild').map(c => c.color);
        game.currentColor = colorsInHand.length ? colorsInHand.sort((a,b) => colorsInHand.filter(x=>x===a).length - colorsInHand.filter(x=>x===b).length).pop() : 'red';
      } else {
        game.currentColor = botCard.color;
      }
      let skipBot = false, drawBot = 0;
      if (botCard.type === 'skip') skipBot = true;
      if (botCard.type === 'reverse') game.direction *= -1;
      if (botCard.type === 'draw2') drawBot = 2;
      if (botCard.type === 'wild4') drawBot = 4;
      game.turn = nextTurn(game.turn, game.direction, 4);
      if (skipBot) game.turn = nextTurn(game.turn, game.direction, 4);
      if (drawBot > 0) {
        for (let i = 0; i < drawBot; i++) {
          game.hands[game.turn].push(game.deck.pop());
        }
        game.turn = nextTurn(game.turn, game.direction, 4);
      }
    } else {
      // Bot draws card
      if (game.deck.length === 0) break;
      botHand.push(game.deck.pop());
      game.turn = nextTurn(game.turn, game.direction, 4);
    }
    if (botHand.length === 0) {
      game.finished = true;
    }
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