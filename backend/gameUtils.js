// gameUtils.js
// Funciones utilitarias generales para la lógica de UNO

// Valida si una carta se puede jugar sobre la carta de la pila
export function isCardValid(card, discardPile, currentColor) {
  if (!card) return false;
  if (card.color === 'wild') return true;
  if (card.color === currentColor) return true;
  if (card.type === 'number' && discardPile.type === 'number' && card.value === discardPile.value) return true;
  // Solo puedes poner skip, reverse, draw2 si el color coincide y el tipo coincide
  if (["skip", "reverse", "draw2"].includes(card.type) && card.color === currentColor && card.type === discardPile.type) return true;
  return false;
}

// Calcula el siguiente turno según la dirección
export function nextTurnWithDirection(turn, numPlayers, direction) {
  return (turn + direction + numPlayers) % numPlayers;
}

// Devuelve los índices de cartas válidas en la mano
export function getValidCards(hand, discardPile, currentColor) {
  return hand.map((c, i) => isCardValid(c, discardPile, currentColor) ? i : -1).filter(i => i !== -1);
}

// Roba una carta del mazo para un jugador
export function drawCard(game, playerIdx) {
  if (game.deck.length === 0) return null;
  const card = game.deck.pop();
  game.hands[playerIdx].push(card);
  return card;
}

// Pausa asíncrona (para simular turnos de bots)
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
} 