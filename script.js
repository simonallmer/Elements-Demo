/**
 * Elements Game Logic
 */

// --- Constants & Config ---
const COLORS = ['blue', 'red', 'green', 'purple'];
const SHAPES = ['circle', 'square', 'triangle', 'hexagon'];
const CARD_TYPES = {
    REGULAR: 'regular',
    SINGLE: 'single',
    ELEMENTS: 'elements'
};

// --- Game State ---
let state = {
    // players will now be objects: { hand: [...cards], type: 'human'|'computer', name: 'PLAYER 1' }
    players: [],
    deck: [],
    discardPile: [],
    currentPlayer: 0,
    viewingPlayer: 0, // which player's hand should be shown on screen
    direction: 1, // 1 (clockwise) or -1 (counter-clockwise)
    topCard: null, // The effective top card (can be overridden by Elements choice)
    forcedColor: null, // If Elements card was played
    forcedShape: null, // If Elements card was played
    turnPhase: 'play', // 'play' or 'pass'
    cardsPlayedThisTurn: 0,
    currentChoice: { color: null, shape: null }, // Tracks current turn's constraint
    sortMode: 'shape' // 'color' or 'shape' (starts as 'shape' so first click becomes 'color')
};

// flag to prevent computer turns from running when game is not active
let gameActive = false;

// track current/previous screens for return from rules
let currentScreenName = null;
let prevScreenName = null;

// temporary setup vars
let selectedPlayerCount = null;
let selectedPlayerTypes = []; // array of 'human'|'computer'
let selectedPlayerNames = []; // array of strings

// load saved names from localStorage
const savedNames = JSON.parse(localStorage.getItem('elementNames') || '[]');


// --- DOM Elements ---
const screens = {
    menu: document.getElementById('main-menu'),
    setup: document.getElementById('player-setup'),
    game: document.getElementById('game-board'),
    pass: document.getElementById('pass-device'),
    rules: document.getElementById('rules-screen'),
    pause: document.getElementById('pause-menu')
};

const ui = {
    startBtn: document.getElementById('btn-start-game'),
    rulesBtn: document.getElementById('btn-rules'),
    menuGameBtn: document.getElementById('btn-menu-game'),
    passDeviceBtn: document.getElementById('btn-ready'),
    resumeBtn: document.getElementById('btn-resume'),
    quitBtn: document.getElementById('btn-end-game'),
    drawPile: document.getElementById('draw-pile'),
    discardPile: document.getElementById('discard-pile'),
    playerHand: document.getElementById('player-hand'),
    currentPlayerDisplay: document.getElementById('current-player-display'),
    cardCountDisplay: document.getElementById('card-count-display'),
    messageArea: document.getElementById('message-area'),
    passButton: document.getElementById('btn-pass-turn'),
    drawCardsBtn: document.getElementById('btn-draw-cards'),
    sortHandBtn: document.getElementById('btn-sort-hand'),
    elementsModal: document.getElementById('elements-modal'),
    nextPlayerName: document.getElementById('next-player-name'),
    pauseStats: document.getElementById('pause-stats'),
    opponentsStats: document.getElementById('opponents-stats')
};

// --- Initialization ---

function init() {
    // Event Listeners
    ui.startBtn.addEventListener('click', () => {
        showScreen('setup');
    });

    ui.rulesBtn.addEventListener('click', () => showScreen('rules'));

    // Close Rules button - return to previous screen if available
    document.getElementById('btn-close-rules').addEventListener('click', () => {
        if (prevScreenName && prevScreenName !== 'rules') {
            showScreen(prevScreenName);
        } else {
            showScreen('menu');
        }
    });

    // Pause menu rules button
    document.getElementById('btn-pause-rules').addEventListener('click', () => {
        showScreen('rules');
    });

    ui.menuGameBtn.addEventListener('click', () => {
        // Pause Menu
        showPauseMenu();
    });

    ui.resumeBtn.addEventListener('click', () => {
        screens.pause.classList.add('hidden');
    });

    ui.quitBtn.addEventListener('click', () => {
        screens.pause.classList.add('hidden');
        showScreen('menu');
    });

    ui.drawPile.addEventListener('click', drawCardsAction);
    ui.drawCardsBtn.addEventListener('click', drawCardsAction);
    ui.passButton.addEventListener('click', endTurn);
    ui.sortHandBtn.addEventListener('click', sortHand);

    ui.passDeviceBtn.addEventListener('click', startTurn);

    // Player Count Selection
    document.querySelectorAll('.player-count-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.player-count-btn').forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
        });
    });

    // Player Count Buttons (now used to configure types)
    document.querySelectorAll('.btn-count').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const count = parseInt(e.target.dataset.count);
            selectedPlayerCount = count;
            // reset previous types
            selectedPlayerTypes = Array(count).fill('human');
            // initialize or trim names array
            selectedPlayerNames = [];
            const stored = JSON.parse(localStorage.getItem('elementNames') || '[]');
            for (let i = 0; i < count; i++) {
                selectedPlayerNames[i] = stored[i] || `Player ${i + 1}`;
            }
            renderPlayerTypeSelectors(count);
            document.getElementById('btn-reset-names').classList.remove('hidden');
            // show begin button
            document.getElementById('btn-begin-game').classList.remove('hidden');
        });
    });

    // name reset button
    document.getElementById('btn-reset-names').addEventListener('click', () => {
        if (selectedPlayerCount) {
            for (let i = 0; i < selectedPlayerCount; i++) {
                selectedPlayerNames[i] = `Player ${i + 1}`;
            }
            localStorage.removeItem('elementNames');
            renderPlayerTypeSelectors(selectedPlayerCount);
        }
    });

    // Begin game after configuration
    document.getElementById('btn-begin-game').addEventListener('click', () => {
        if (selectedPlayerCount) {
            startGame(selectedPlayerCount, selectedPlayerTypes, selectedPlayerNames);
        }
    });

    // Back button from setup
    document.getElementById('btn-back-menu').addEventListener('click', () => {
        showScreen('menu');
        // clear any configuration UI
        selectedPlayerCount = null;
        selectedPlayerTypes = [];
        const config = document.getElementById('player-type-config');
        config.classList.add('hidden');
        config.innerHTML = '';
        document.getElementById('btn-begin-game').classList.add('hidden');
    });

    // Elements Modal Selection Logic
    // Color Selection
    document.querySelectorAll('.btn-color').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Deselect others
            document.querySelectorAll('.btn-color').forEach(b => b.classList.remove('selected'));
            // Select this
            e.target.classList.add('selected');
            // Store choice temporarily
            if (!state.tempElementsChoice) state.tempElementsChoice = {};
            state.tempElementsChoice.color = e.target.dataset.color;
            // Show Transform button if both are selected
            checkElementsSelection();
        });
    });

    // Shape Selection
    document.querySelectorAll('.btn-shape').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Deselect others
            document.querySelectorAll('.btn-shape').forEach(b => b.classList.remove('selected'));
            // Select this (handle click on svg/path by finding closest button)
            const button = e.target.closest('.btn-shape');
            button.classList.add('selected');
            // Store choice
            if (!state.tempElementsChoice) state.tempElementsChoice = {};
            state.tempElementsChoice.shape = button.dataset.shape;
            // Show Transform button if both are selected
            checkElementsSelection();
        });
    });

    // Transform button
    document.getElementById('btn-transform').addEventListener('click', () => {
        if (state.tempElementsChoice && state.tempElementsChoice.color && state.tempElementsChoice.shape) {
            resolveElementsCard(state.tempElementsChoice.color, state.tempElementsChoice.shape);
        }
    });
}

// create toggle rows for each player slot when count is chosen
function renderPlayerTypeSelectors(count) {
    const container = document.getElementById('player-type-config');
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const row = document.createElement('div');
        row.className = 'player-type-row';

        // name input
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'player-name-input';
        nameInput.value = selectedPlayerNames[i] || `Player ${i + 1}`;
        // when focusing if the value is still default label, clear it for easier typing
        nameInput.addEventListener('focus', (e) => {
            const val = e.target.value;
            if (/^Player \d+$/.test(val)) {
                e.target.value = '';
            }
        });
        // if user leaves empty, restore default
        nameInput.addEventListener('blur', (e) => {
            if (e.target.value.trim() === '') {
                e.target.value = `Player ${i + 1}`;
                selectedPlayerNames[i] = e.target.value;
                localStorage.setItem('elementNames', JSON.stringify(selectedPlayerNames));
            }
        });
        nameInput.addEventListener('input', (e) => {
            selectedPlayerNames[i] = e.target.value;
            // save immediately
            localStorage.setItem('elementNames', JSON.stringify(selectedPlayerNames));
        });
        row.appendChild(nameInput);

        // first player always human, no buttons
        if (i === 0) {
            const hint = document.createElement('span');
            hint.textContent = 'Human';
            row.appendChild(hint);
        } else {
            const humanBtn = document.createElement('button');
            humanBtn.className = 'btn-toggle-type';
            humanBtn.dataset.player = i;
            humanBtn.dataset.type = 'human';
            humanBtn.textContent = 'Human';
            humanBtn.addEventListener('click', togglePlayerType);

            const cpuBtn = document.createElement('button');
            cpuBtn.className = 'btn-toggle-type';
            cpuBtn.dataset.player = i;
            cpuBtn.dataset.type = 'computer';
            cpuBtn.textContent = 'Computer';
            cpuBtn.addEventListener('click', togglePlayerType);

            // mark active according to current selection
            if (selectedPlayerTypes[i] === 'human') humanBtn.classList.add('active');
            else cpuBtn.classList.add('active');

            row.appendChild(humanBtn);
            row.appendChild(cpuBtn);
        }

        container.appendChild(row);
    }
    container.classList.remove('hidden');
}


function togglePlayerType(e) {
    const btn = e.currentTarget;
    const index = parseInt(btn.dataset.player);
    const type = btn.dataset.type;
    selectedPlayerTypes[index] = type;
    // update button active states
    const rows = document.querySelectorAll('.player-type-row');
    const row = rows[index];
    if (row) {
        row.querySelectorAll('.btn-toggle-type').forEach(b => {
            if (b.dataset.type === type) b.classList.add('active');
            else b.classList.remove('active');
        });
    }
}

function checkElementsSelection() {
    const transformBtn = document.getElementById('btn-transform');
    if (state.tempElementsChoice && state.tempElementsChoice.color && state.tempElementsChoice.shape) {
        transformBtn.classList.remove('hidden');
    } else {
        transformBtn.classList.add('hidden');
    }
}

function showScreen(screenName) {
    // remember previous screen
    if (currentScreenName !== screenName) {
        prevScreenName = currentScreenName;
    }

    Object.values(screens).forEach(s => s.classList.add('hidden'));
    Object.values(screens).forEach(s => s.classList.remove('active'));

    if (screens[screenName]) {
        screens[screenName].classList.remove('hidden');
        screens[screenName].classList.add('active');
    }

    // track current
    currentScreenName = screenName;

    // Set gameActive flag based on which screen is shown
    gameActive = (screenName === 'game');
}

function hideScreen(screenName) {
    if (screens[screenName]) {
        screens[screenName].classList.add('hidden');
        screens[screenName].classList.remove('active');
    }
}

// --- Deck Management ---

function createDeck() {
    let deck = [];

    // 1. Regular Cards: 16 of each color (4 shapes * 4 copies? Or just mixed?)
    // Rules say: 16 Blue, 16 Red, 16 Green, 16 Purple. Total 64.
    // That means 4 of each shape per color.
    COLORS.forEach(color => {
        SHAPES.forEach(shape => {
            for (let i = 0; i < 4; i++) {
                deck.push({ type: CARD_TYPES.REGULAR, color, shape, id: Math.random() });
            }
        });
    });

    // 2. Single Cards: 8 cards. "Each Single Card is in the game once."
    // There are 4 colors * 4 shapes = 16 combos. Rules say 8 Single Cards.
    // "They only show one shape or color." -> This implies a card is EITHER just "Blue" OR just "Circle".
    // Let's interpret: 4 Color-only cards + 4 Shape-only cards? Or 8 specific combos?
    // "Each Single Card is in the game once." -> Maybe 8 unique cards that are special.
    // Re-reading: "They only show one shape or color."
    // Let's add 4 Color-only cards (Wild Shape) and 4 Shape-only cards (Wild Color).
    // 2. Single Cards: 8 cards.
    // "They only show one shape or color."
    // We use 'none' to indicate the missing property.
    COLORS.forEach(color => {
        deck.push({ type: CARD_TYPES.SINGLE, color: color, shape: 'none', id: Math.random() });
    });
    SHAPES.forEach(shape => {
        deck.push({ type: CARD_TYPES.SINGLE, color: 'none', shape: shape, id: Math.random() });
    });

    // 3. Elements Cards: 8 cards.
    for (let i = 0; i < 8; i++) {
        deck.push({ type: CARD_TYPES.ELEMENTS, color: 'wild', shape: 'wild', id: Math.random() });
    }

    return shuffle(deck);
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- Game Logic ---

function startGame(playerCount, types, names) {
    // store names in localStorage
    if (names && names.length) {
        localStorage.setItem('elementNames', JSON.stringify(names));
    }

    // build player objects
    state.players = [];
    for (let i = 0; i < playerCount; i++) {
        const type = (types && types[i]) || 'human';
        let name;
        if (names && names[i]) {
            name = names[i];
        } else {
            name = type === 'computer' ? `COMPUTER ${i + 1}` : `PLAYER ${i + 1}`;
        }
        state.players.push({ hand: [], type, name });
    }

    state.deck = createDeck();
    state.discardPile = [];
    state.currentPlayer = Math.floor(Math.random() * playerCount); // Random start
    state.direction = 1;

    // initial viewing player should be first human or current if human
    state.viewingPlayer = state.players.findIndex(p => p.type === 'human');
    if (state.viewingPlayer === -1) state.viewingPlayer = 0;

    // Deal 8 cards to each
    for (let i = 0; i < playerCount; i++) {
        for (let j = 0; j < 8; j++) {
            state.players[i].hand.push(state.deck.pop());
        }
    }

    // Flip top card
    let startCard = state.deck.pop();
    while (startCard.type === CARD_TYPES.ELEMENTS) {
        // "If the card that gets turned over... is an Elements Card, any card can be layed out"
        // We can just treat it as a wild start.
        break;
    }
    state.discardPile.push(startCard);
    state.topCard = startCard;

    // Reset turn state
    resetTurnState();

    showScreen('pass');
    updatePassScreen();
}

function resetTurnState() {
    state.cardsPlayedThisTurn = 0;
    state.currentChoice = { color: null, shape: null };
    state.forcedColor = null;
    state.forcedShape = null;
    ui.messageArea.textContent = "";
    ui.passButton.classList.add('hidden');
}

function updatePassScreen() {
    ui.nextPlayerName.textContent = state.players[state.currentPlayer].name;
}

function startTurn() {
    showScreen('game');
    ui.messageArea.textContent = ""; // Clear any previous messages

    // if a human just received the device, make sure we view their hand
    if (state.players[state.currentPlayer].type === 'human') {
        state.viewingPlayer = state.currentPlayer;
    }

    renderGame();

    // Check if deck is empty -> Game End
    if (state.deck.length === 0) {
        endGameByEmptyDeck();
        return;
    }

    // if it's a computer's turn, immediately kick off its logic
    if (state.players[state.currentPlayer].type === 'computer') {
        handleComputerTurn();
    }
}

function getEffectiveTopCard() {
    const actualTop = state.discardPile[state.discardPile.length - 1];

    // If the top card is a transformed Elements card, treat it as a regular card
    if (actualTop && actualTop.type === CARD_TYPES.ELEMENTS && actualTop.displayColor && actualTop.displayShape) {
        return {
            color: actualTop.displayColor,
            shape: actualTop.displayShape,
            type: CARD_TYPES.REGULAR
        };
    }

    // If an Elements card was just played THIS TURN and a choice was made, that choice dictates the rule.
    // This only applies during the same turn (before endTurn clears forcedColor/Shape)
    if (state.forcedColor || state.forcedShape) {
        return {
            color: state.forcedColor || 'all',
            shape: state.forcedShape || 'all',
            type: 'virtual'
        };
    }

    return actualTop;
}

// --- AI / Computer player helpers ---

// return array of indices in the specified player's hand that are playable given current turn state
function getValidMoves(playerIndex) {
    const hand = state.players[playerIndex].hand;
    // temporarily remember current player and cardsPlayedThisTurn so we can call isValidMove safely
    const origPlayer = state.currentPlayer;
    const origCards = state.cardsPlayedThisTurn;
    state.currentPlayer = playerIndex;
    // cardsPlayedThisTurn should already reflect how many this player has played in the current turn
    const valid = hand.map((card, idx) => isValidMove(card, playerIndex) ? idx : -1).filter(i => i >= 0);
    state.currentPlayer = origPlayer;
    state.cardsPlayedThisTurn = origCards;
    return valid;
}

// choose an index from valid moves using medium difficulty heuristics
function chooseComputerCard(playerIndex) {
    const valid = getValidMoves(playerIndex);
    if (valid.length === 0) return null;

    // For simplicity, just play the first valid card
    return valid[0];
}

// render the player circle illustration
function renderPlayerCircle() {
    const numPlayers = state.players.length;
    const radius = 25;
    const centerX = 40;
    const centerY = 40;
    const angleStep = (2 * Math.PI) / numPlayers;

    let svg = `<svg width="80" height="80" viewBox="0 0 80 80">`;

    // Calculate positions for all players first
    const positions = [];
    for (let i = 0; i < numPlayers; i++) {
        const angle = i * angleStep - Math.PI / 2; // Start from top
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        positions.push({ x, y });
    }

    // Draw line from current to next player
    let nextPlayer = state.currentPlayer + state.direction;
    if (nextPlayer >= numPlayers) nextPlayer = 0;
    if (nextPlayer < 0) nextPlayer = numPlayers - 1;
    
    const currentPos = positions[state.currentPlayer];
    const nextPos = positions[nextPlayer];
    svg += `<line x1="${currentPos.x}" y1="${currentPos.y}" x2="${nextPos.x}" y2="${nextPos.y}" stroke="var(--accent-green)" stroke-width="1.5" opacity="0.6" />`;

    // Draw circles and labels
    for (let i = 0; i < numPlayers; i++) {
        const { x, y } = positions[i];
        const isCurrent = i === state.currentPlayer;
        const fill = isCurrent ? 'var(--accent-blue)' : 'var(--text-color)';
        const opacity = isCurrent ? '1' : '0.5';
        const label = state.players[i].type === 'computer' ? `C${i + 1}` : `${i + 1}`;

        svg += `<circle cx="${x}" cy="${y}" r="8" fill="${fill}" opacity="${opacity}" />`;
        svg += `<text x="${x}" y="${y + 3}" text-anchor="middle" font-size="8" fill="var(--bg-color)" font-weight="bold">${label}</text>`;
    }

    svg += `</svg>`;
    document.getElementById('player-circle').innerHTML = svg;
}

// run the computer's turn; plays cards one at a time with brief pauses so the human player can watch
function animateComputerPlay(callback) {
    // create a ghost card from top center to discard pile
    const cardEl = document.createElement('div');
    cardEl.className = 'flying-card computer-play';
    const startTop = 0;
    const startLeft = window.innerWidth / 2;
    cardEl.style.top = `${startTop}px`;
    cardEl.style.left = `${startLeft}px`;
    document.body.appendChild(cardEl);
    const discRect = ui.discardPile.getBoundingClientRect();
    // force reflow
    cardEl.offsetHeight;
    cardEl.style.top = `${discRect.top}px`;
    cardEl.style.left = `${discRect.left}px`;
    cardEl.style.transform = `scale(0.5)`;
    cardEl.style.opacity = '0';
    setTimeout(() => {
        cardEl.remove();
        if (callback) callback();
    }, 500);
}

function handleComputerTurn() {
    // Check if game is still active before proceeding
    if (!gameActive || state.players[state.currentPlayer].type !== 'computer') return;


    const cardIndex = chooseComputerCard(state.currentPlayer);
    if (cardIndex !== null) {
        // show animation then play
        animateComputerPlay(() => {
            playCard(cardIndex);
            if (state.players[state.currentPlayer].type === 'computer' && state.cardsPlayedThisTurn > 0) {
                setTimeout(handleComputerTurn, 500);
            }
        });
        return;
    }

    // no valid moves: draw 3 and skip turn
    const count = Math.min(3, state.deck.length);
    for (let i = 0; i < count; i++) {
        if (state.deck.length > 0) {
            state.players[state.currentPlayer].hand.push(state.deck.pop());
        }
    }
    state.direction *= -1;
    ui.messageArea.textContent = 'Computer draws 3';
    renderGame();
    // end the turn after a short pause so human can read message
    setTimeout(() => {
        if (gameActive) endTurn();
    }, 800);
}


function isValidMove(card, playerIndex = state.currentPlayer) {
    const top = getEffectiveTopCard();
    const hand = state.players[playerIndex].hand;

    // 1. Elements Card Rules
    if (card.type === CARD_TYPES.ELEMENTS) {
        // "An Elements Card cannot be played as the last card from your hand."
        if (hand.length === 1) return false;

        // "When you choose the Elements Card, no other card can be played in your turn."
        // This implies it must be the ONLY card played.
        if (state.cardsPlayedThisTurn > 0 && playerIndex === state.currentPlayer) return false;

        return true;
    }

    // 1b. Prevent playing a card if it would leave ONLY an Elements card in hand
    // (because Elements card cannot be played as last card)
    if (hand.length === 2) {
        // Check if the OTHER card (not the one being played) is an Elements card
        const otherCard = hand.find(c => c !== card);
        if (otherCard && otherCard.type === CARD_TYPES.ELEMENTS) {
            return false; // Cannot play this card, as it would leave only Elements card
        }
    }

    // 2. Single Card Restrictions: "Single Cards cannot be placed on other Single Cards."
    if (card.type === CARD_TYPES.SINGLE && top.type === CARD_TYPES.SINGLE) {
        return false;
    }

    // 3. Turn Constraint: "The decision between shape or color cannot be changed once taken."
    if (state.cardsPlayedThisTurn > 0) {
        // If we are locked to a specific Color
        if (state.currentChoice.color && state.currentChoice.color !== 'all') {
            // Card must match the locked color. 'none' (Single Shape card) does NOT match.
            // 'all' (Virtual/Elements) is allowed if we had that logic, but cards don't have 'all' anymore except virtual.
            if (card.color !== state.currentChoice.color) return false;
        }
        // If we are locked to a specific Shape
        if (state.currentChoice.shape && state.currentChoice.shape !== 'all') {
            // Card must match the locked shape. 'none' (Single Color card) does NOT match.
            if (card.shape !== state.currentChoice.shape) return false;
        }
    }

    // 4. Matching Logic
    // If top is Elements/Virtual, we match against forcedColor/Shape
    if (top.type === 'virtual') {
        // Virtual 'all' means ANY.
        if (top.color !== 'all' && card.color !== top.color) return false;
        if (top.shape !== 'all' && card.shape !== top.shape) return false;
        return true;
    }

    // If top is a raw Elements card (no forced choice yet, e.g. start of game), ANY card is valid.
    if (top.type === CARD_TYPES.ELEMENTS) {
        return true;
    }

    // Standard Matching
    // 'none' never matches anything (except 'none'==='none' but Single on Single is blocked).
    // top.color might be 'none' (if top is Single Shape card).
    // card.color might be 'none' (if playing Single Shape card).

    const colorMatch = (card.color === top.color) && (card.color !== 'none');
    const shapeMatch = (card.shape === top.shape) && (card.shape !== 'none');

    // If we have already locked in a choice this turn
    if (state.currentChoice.color) return colorMatch;
    if (state.currentChoice.shape) return shapeMatch;

    return colorMatch || shapeMatch;
}

function playCard(cardIndex) {
    const hand = state.players[state.currentPlayer].hand;
    const card = hand[cardIndex];

    // Capture the effective top card BEFORE we play the new one
    const previousTop = getEffectiveTopCard();

    if (!isValidMove(card)) {
        ui.messageArea.textContent = "Invalid Move!";
        ui.messageArea.style.color = 'red';
        setTimeout(() => ui.messageArea.textContent = "", 1000);
        return;
    }

    // Execute Play
    hand.splice(cardIndex, 1);
    state.discardPile.push(card);
    state.cardsPlayedThisTurn++;
    ui.passButton.classList.remove('hidden');

    // Handle Elements Card
    if (card.type === CARD_TYPES.ELEMENTS) {
        if (state.players[state.currentPlayer].type === 'computer') {
            // computer picks a random color/shape and ends its turn
            const pickColor = COLORS[Math.floor(Math.random() * COLORS.length)];
            const pickShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
            resolveElementsCard(pickColor, pickShape);
            return;
        }

        // Elements card is played. User must choose. Turn will end after choice.
        ui.elementsModal.classList.remove('hidden');

        // Reset Selections and Button
        document.querySelectorAll('.btn-color, .btn-shape').forEach(b => b.classList.remove('selected'));
        document.getElementById('btn-transform').classList.add('hidden');

        state.tempElementsChoice = {}; // Reset temp choice

        renderGame();
        return;
    }

    // Determine Constraint (Color or Shape) if first card of turn
    if (state.cardsPlayedThisTurn === 1) {
        // Compare the played card with the PREVIOUS top card

        // Special Case: Single Cards & Virtual Cards (Elements Choice)
        // If the previous card only had ONE specific property, we MUST have matched that property.
        // Therefore, we are locked to that property.

        if (previousTop.type === CARD_TYPES.SINGLE) {
            if (previousTop.color === 'none') {
                // It was a Shape-only card (e.g. Triangle). We matched Shape. Lock Shape.
                state.currentChoice.shape = previousTop.shape;
            } else if (previousTop.shape === 'none') {
                // It was a Color-only card (e.g. Blue). We matched Color. Lock Color.
                state.currentChoice.color = previousTop.color;
            }
        } else if (previousTop.type === 'virtual') {
            // Elements choice. We are locked to whatever was chosen.
            if (previousTop.color !== 'all') state.currentChoice.color = previousTop.color;
            if (previousTop.shape !== 'all') state.currentChoice.shape = previousTop.shape;
        } else {
            // Regular Card (has both Color and Shape)
            const colorMatch = (card.color === previousTop.color) && (card.color !== 'none');
            const shapeMatch = (card.shape === previousTop.shape) && (card.shape !== 'none');

            if (colorMatch && !shapeMatch) {
                state.currentChoice.color = card.color;
            } else if (shapeMatch && !colorMatch) {
                state.currentChoice.shape = card.shape;
            } else if (colorMatch && shapeMatch) {
                // Matched both. Remain open.
            }
        }
    } else {
        // Subsequent cards: Refine lock if it was open
        // If we were open (matched both previously), and now we diverge, we lock.
        if (!state.currentChoice.color && !state.currentChoice.shape) {
            // We need to compare with the card BEFORE this one (which is now at index -2)
            const prevCard = state.discardPile[state.discardPile.length - 2];
            const colorMatch = (card.color === prevCard.color) && (card.color !== 'none');
            const shapeMatch = (card.shape === prevCard.shape) && (card.shape !== 'none');

            if (colorMatch && !shapeMatch) state.currentChoice.color = card.color;
            if (shapeMatch && !colorMatch) state.currentChoice.shape = card.shape;
        }
    }

    // Check Win
    if (hand.length === 0) {
        alert(`Player ${state.currentPlayer + 1} wins. Congratulations on becoming the supreme samurai!`);
        showScreen('menu');
        return;
    }

    renderGame();
}

function resolveElementsCard(color, shape) {
    ui.elementsModal.classList.add('hidden');

    state.forcedColor = color;
    state.forcedShape = shape;

    // Transform the Elements card on the table
    const topCard = state.discardPile[state.discardPile.length - 1];
    if (topCard.type === CARD_TYPES.ELEMENTS) {
        topCard.displayColor = color;
        topCard.displayShape = shape;
    }

    // Also lock the current turn choice (though turn ends immediately)
    state.currentChoice.color = color;
    state.currentChoice.shape = shape;

    // "When you choose the Elements Card, no other card can be played in your turn."
    endTurn();
}

function drawCardsAction() {
    // "Draw 3 cards and skip your turn. The direction of the game changes."

    // Check if deck has enough cards
    if (state.deck.length === 0) {
        endGameByEmptyDeck();
        return;
    }

    // Disable interactions during animation
    ui.drawPile.style.pointerEvents = 'none';
    ui.drawCardsBtn.disabled = true;

    // Animate 3 cards
    let cardsToDraw = Math.min(3, state.deck.length);
    let completedAnimations = 0;

    for (let i = 0; i < cardsToDraw; i++) {
        setTimeout(() => {
            animateDrawCard(() => {
                completedAnimations++;
                if (completedAnimations === cardsToDraw) {
                    // All animations done, execute logic
                    finishDrawTurn(cardsToDraw);
                }
            });
        }, i * 200); // Stagger animations
    }
}

function animateDrawCard(callback) {
    const cardEl = document.createElement('div');
    cardEl.className = 'flying-card';

    // Start position (Draw Pile)
    const startRect = ui.drawPile.getBoundingClientRect();
    cardEl.style.top = `${startRect.top}px`;
    cardEl.style.left = `${startRect.left}px`;

    document.body.appendChild(cardEl);

    // End position (Player Hand - roughly center or specific slot if we calculated it, but center is fine for "hand")
    // Let's aim for the center of the hand area
    const handRect = ui.playerHand.getBoundingClientRect();
    const endTop = handRect.top + (handRect.height / 2) - (startRect.height / 2);
    const endLeft = handRect.left + (handRect.width / 2) - (startRect.width / 2);

    // Force reflow
    cardEl.offsetHeight;

    // Animate
    cardEl.style.top = `${endTop}px`;
    cardEl.style.left = `${endLeft}px`;
    cardEl.style.transform = `scale(0.5) rotate(${Math.random() * 30 - 15}deg)`; // Shrink slightly as it enters hand
    cardEl.style.opacity = '0'; // Fade out at the end

    setTimeout(() => {
        cardEl.remove();
        if (callback) callback();
    }, 800); // Match CSS transition time
}

function finishDrawTurn(count) {
    for (let i = 0; i < count; i++) {
        if (state.deck.length > 0) {
            state.players[state.currentPlayer].hand.push(state.deck.pop());
        }
    }

    state.direction *= -1;

    // Re-enable interactions
    ui.drawPile.style.pointerEvents = 'auto';
    ui.drawCardsBtn.disabled = false;

    endTurn();
}

function sortHand() {
    const hand = state.players[state.currentPlayer].hand;

    // Toggle Sort Mode
    state.sortMode = state.sortMode === 'color' ? 'shape' : 'color';

    // Feedback
    ui.messageArea.textContent = `Sorted by ${state.sortMode.toUpperCase()}`;
    setTimeout(() => ui.messageArea.textContent = "", 1500);

    hand.sort((a, b) => {
        // 1. Elements Cards always last
        if (a.type === CARD_TYPES.ELEMENTS && b.type !== CARD_TYPES.ELEMENTS) return 1;
        if (a.type !== CARD_TYPES.ELEMENTS && b.type === CARD_TYPES.ELEMENTS) return -1;
        if (a.type === CARD_TYPES.ELEMENTS && b.type === CARD_TYPES.ELEMENTS) return 0;

        // 2. Sort based on Mode
        if (state.sortMode === 'color') {
            // "Single Cards (no color) coming first" -> color === 'none'
            const colorA = a.color === 'none' ? ' ' : a.color; // Space comes before letters
            const colorB = b.color === 'none' ? ' ' : b.color;

            if (colorA < colorB) return -1;
            if (colorA > colorB) return 1;

            // Secondary sort by shape
            const shapeA = a.shape === 'none' ? ' ' : a.shape;
            const shapeB = b.shape === 'none' ? ' ' : b.shape;
            if (shapeA < shapeB) return -1;
            if (shapeA > shapeB) return 1;
        } else {
            // Sort by Shape
            // "Single Cards (no shape) coming first" -> shape === 'none'
            const shapeA = a.shape === 'none' ? ' ' : a.shape; // Space comes before letters
            const shapeB = b.shape === 'none' ? ' ' : b.shape;

            if (shapeA < shapeB) return -1;
            if (shapeA > shapeB) return 1;

            // Secondary sort by color
            const colorA = a.color === 'none' ? ' ' : a.color;
            const colorB = b.color === 'none' ? ' ' : b.color;
            if (colorA < colorB) return -1;
            if (colorA > colorB) return 1;
        }

        return 0;
    });

    renderGame();
}

function endTurn() {
    // Move to next player
    let next = state.currentPlayer + state.direction;
    if (next >= state.players.length) next = 0;
    if (next < 0) next = state.players.length - 1;

    state.currentPlayer = next;
    resetTurnState();

    // Check if there's only one human player
    const humanCount = state.players.filter(p => p.type === 'human').length;
    if (humanCount === 1) {
        // Skip pass screen entirely when only one human, but add a brief delay for the player to see the board
        setTimeout(() => startTurn(), 1500);
    } else {
        // Normal behavior: skip pass only for computers
        if (state.players[state.currentPlayer].type === 'computer') {
            startTurn();
        } else {
            showScreen('pass');
            updatePassScreen();
        }
    }
}

function endGameByEmptyDeck() {
    // "Players with the fewest cards in hand win"
    let minCards = Infinity;
    let winners = [];

    state.players.forEach((hand, index) => {
        if (hand.length < minCards) {
            minCards = hand.length;
            winners = [index + 1];
        } else if (hand.length === minCards) {
            winners.push(index + 1);
        }
    });

    alert(`Game Over! Deck Empty. Winners: Player(s) ${winners.join(', ')}`);
    showScreen('menu');
}

function showPauseMenu() {
    // Populate Stats
    ui.pauseStats.innerHTML = '';
    state.players.forEach((player, index) => {
        const row = document.createElement('div');
        row.className = 'stat-row';
        row.innerHTML = `
            <span class="stat-player">${player.name}</span>
            <span class="stat-count">${player.hand.length} Cards</span>
        `;
        ui.pauseStats.appendChild(row);
    });

    screens.pause.classList.remove('hidden');
}

// --- Rendering ---

function renderGame() {
    // Show who currently has the turn
    ui.currentPlayerDisplay.textContent = state.players[state.currentPlayer].name;

    // card count shows for the viewing player (the human holding device) so it doesn't jump around
    const viewingCount = state.players[state.viewingPlayer].hand.length;
    ui.cardCountDisplay.textContent = `Cards: ${viewingCount}`;

    // Render player circle
    renderPlayerCircle();

    // Render Opponents Stats
    ui.opponentsStats.innerHTML = '';
    state.players.forEach((player, index) => {
        if (index !== state.currentPlayer) {
            const row = document.createElement('div');
            row.className = 'opponent-row';
            const count = player.hand.length;
            const warningClass = count === 1 ? 'style="color: var(--accent-red); font-weight: bold;"' : '';
            const label = player.type === 'computer' ? `CPU ${index + 1}` : `P${index + 1}`;

            row.innerHTML = `
                <span class="opponent-name">${label}</span>
                <span class="opponent-cards" ${warningClass}>
                    ${count} <span style="font-size: 0.8em;">🎴</span>
                </span>
            `;
            ui.opponentsStats.appendChild(row);
        }
    });

    // Render Discard Pile (Top Card)
    ui.discardPile.innerHTML = '';
    const topCard = state.discardPile[state.discardPile.length - 1];
    if (topCard) {
        ui.discardPile.appendChild(createCardElement(topCard, false));
    }

    // Render Hand for viewing player (usually a human)
    ui.playerHand.innerHTML = '';
    const handToShow = state.players[state.viewingPlayer].hand;
    handToShow.forEach((card, index) => {
        const el = createCardElement(card, true);
        if (state.viewingPlayer === state.currentPlayer && state.players[state.currentPlayer].type === 'human') {
            el.addEventListener('click', () => playCard(index));
        }
        ui.playerHand.appendChild(el);
    });

    // Visual feedback for Elements choice
    if (state.forcedColor) {
        ui.messageArea.textContent = `Must play: ${state.forcedColor.toUpperCase()}`;
        ui.messageArea.style.color = `var(--accent-${state.forcedColor})`;
    } else if (state.forcedShape) {
        ui.messageArea.textContent = `Must play: ${state.forcedShape.toUpperCase()}`;
        ui.messageArea.style.color = '#fff';
    } else {
        ui.messageArea.textContent = "";
    }

    // Disable Draw 3 button if cards have been played this turn
    if (state.cardsPlayedThisTurn > 0) {
        ui.drawCardsBtn.disabled = true;
    } else {
        ui.drawCardsBtn.disabled = false;
    }
}

function createCardElement(card, isHand) {
    const el = document.createElement('div');

    // Determine effective properties (handle transformation)
    let renderType = card.type;
    let renderColor = card.color;
    let renderShape = card.shape;

    if (card.type === CARD_TYPES.ELEMENTS && card.displayColor && card.displayShape) {
        renderType = CARD_TYPES.REGULAR;
        renderColor = card.displayColor;
        renderShape = card.displayShape;
    }

    // Determine classes
    let colorClass = renderColor === 'none' ? 'white' : renderColor;
    // If it's an Elements card (and NOT transformed), it's special
    if (renderType === CARD_TYPES.ELEMENTS) {
        colorClass = 'elements';
    }

    el.className = `card ${colorClass}`;

    // SVG Shapes
    const getShapeSVG = (shape) => {
        if (shape === 'circle') return `<svg viewBox="0 0 100 100" class="shape-svg"><circle cx="50" cy="50" r="40" /></svg>`;
        if (shape === 'square') return `<svg viewBox="0 0 100 100" class="shape-svg"><rect x="15" y="15" width="70" height="70" /></svg>`;
        if (shape === 'triangle') return `<svg viewBox="0 0 100 100" class="shape-svg"><polygon points="50,15 15,85 85,85" /></svg>`;
        if (shape === 'hexagon') return `<svg viewBox="0 0 100 100" class="shape-svg"><polygon points="50,10 85,30 85,70 50,90 15,70 15,30" /></svg>`;
        if (shape === 'no-shape') return `<div class="no-shape-symbol"></div>`;
        // 4-pointed star for Elements
        if (shape === 'wild') return `<svg viewBox="0 0 100 100" class="shape-svg"><path d="M50 5 L65 35 L95 50 L65 65 L50 95 L35 65 L5 50 L35 35 Z" /></svg>`;
        return '';
    };

    let centerShapeHtml = '';
    let cornerShapeHtml = '';

    if (renderType === CARD_TYPES.ELEMENTS) {
        centerShapeHtml = getShapeSVG('wild');
        cornerShapeHtml = getShapeSVG('wild');
    } else if (renderType === CARD_TYPES.SINGLE) {
        if (renderShape === 'none') {
            // Color only, No Shape
            centerShapeHtml = getShapeSVG('no-shape');
            cornerShapeHtml = getShapeSVG('no-shape');
        } else {
            // Shape only, No Color (White)
            centerShapeHtml = getShapeSVG(renderShape);
            cornerShapeHtml = getShapeSVG(renderShape);
        }
    } else {
        // Regular
        centerShapeHtml = getShapeSVG(renderShape);
        cornerShapeHtml = getShapeSVG(renderShape);
    }

    el.innerHTML = `
        <div class="card-face">
            <div class="card-inner"></div>
            <div class="corner-pip corner-top-right">${cornerShapeHtml}</div>
            <div class="center-shape">${centerShapeHtml}</div>
            <div class="corner-pip corner-bottom-left">${cornerShapeHtml}</div>
        </div>
    `;

    return el;
}

// Start
init();
