// Game configuration
const config = {
    tileSize: 40,
    tilesAhead: 10,    // Number of tiles to show ahead of player
    tilesBehind: 3,    // Number of tiles to show behind player
    gridWidth: 20      // Number of tiles horizontally
};

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
const game = {
    player: {
        x: Math.floor(config.gridWidth / 2), // Start in middle horizontally
        y: 0,  // Starting row
        color: '#e74c3c'
    },
    score: 0,
    highestRow: 0,  // Track the furthest forward position
    tiles: []
};

// Tile types with different colors
const tileTypes = [
    { name: 'grass', color: '#2ecc71', weight: 3 },
    { name: 'road', color: '#95a5a6', weight: 2 },
    { name: 'water', color: '#3498db', weight: 1 }
];

// Initialize the grid with random tiles
function initializeGrid() {
    // Generate tiles from camera position to well ahead of player
    const cameraY = game.player.y - config.tilesAhead;
    const startRow = cameraY;
    const endRow = game.player.y + config.tilesAhead;

    for (let row = startRow; row <= endRow; row++) {
        for (let col = 0; col < config.gridWidth; col++) {
            const tileType = getRandomTileType();
            game.tiles.push({
                x: col,
                y: row,
                type: tileType.name,
                color: tileType.color
            });
        }
    }
}

// Get random tile type based on weights
function getRandomTileType() {
    const totalWeight = tileTypes.reduce((sum, type) => sum + type.weight, 0);
    let random = Math.random() * totalWeight;

    for (const type of tileTypes) {
        random -= type.weight;
        if (random <= 0) {
            return type;
        }
    }
    return tileTypes[0];
}

// Generate new row of tiles ahead
function generateNewRow(rowY) {
    for (let col = 0; col < config.gridWidth; col++) {
        const tileType = getRandomTileType();
        game.tiles.push({
            x: col,
            y: rowY,
            type: tileType.name,
            color: tileType.color
        });
    }
}

// Remove old tiles that are too far behind
function removeOldTiles() {
    const maxRow = game.player.y + config.tilesBehind + 2;
    game.tiles = game.tiles.filter(tile => tile.y <= maxRow);
}

// Handle player movement
function movePlayer(dx, dy) {
    const newX = game.player.x + dx;
    const newY = game.player.y + dy;

    // Check boundaries (left/right)
    if (newX < 0 || newX >= config.gridWidth) {
        return;
    }

    // Update player position
    game.player.x = newX;
    game.player.y = newY;

    // If player moved forward, update score and generate new tiles
    if (dy < 0) {  // Moving forward (negative Y)
        if (game.player.y < game.highestRow) {
            game.score += 10;
            game.highestRow = game.player.y;
            document.getElementById('score').textContent = game.score;

            // Generate new rows ahead (with buffer beyond visible area)
            const maxExistingRow = Math.min(...game.tiles.map(t => t.y));
            const cameraY = game.player.y - config.tilesAhead;
            const targetRow = cameraY - 2; // Generate 2 extra rows beyond top of screen

            for (let row = maxExistingRow - 1; row >= targetRow; row--) {
                generateNewRow(row);
            }

            // Clean up old tiles
            removeOldTiles();
        }
    }
}

// Keyboard input
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    // Immediate movement on key press
    if (e.key === 'ArrowLeft' && !keys.moved) {
        movePlayer(-1, 0);
        keys.moved = true;
    } else if (e.key === 'ArrowRight' && !keys.moved) {
        movePlayer(1, 0);
        keys.moved = true;
    } else if (e.key === 'ArrowUp' && !keys.moved) {
        movePlayer(0, -1);  // Negative Y is forward
        keys.moved = true;
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
    keys.moved = false;
});

// Render the game
function render() {
    // Clear canvas
    ctx.fillStyle = '#34495e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate camera offset to keep player near bottom with more tiles ahead
    const cameraY = game.player.y - config.tilesAhead;

    // Draw tiles
    game.tiles.forEach(tile => {
        const screenY = (tile.y - cameraY) * config.tileSize;
        const screenX = tile.x * config.tileSize;

        // Only draw tiles that are visible on screen
        if (screenY >= -config.tileSize && screenY <= canvas.height) {
            ctx.fillStyle = tile.color;
            ctx.fillRect(screenX, screenY, config.tileSize, config.tileSize);

            // Draw grid lines
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.lineWidth = 1;
            ctx.strokeRect(screenX, screenY, config.tileSize, config.tileSize);
        }
    });

    // Draw player
    const playerScreenX = game.player.x * config.tileSize;
    const playerScreenY = (game.player.y - cameraY) * config.tileSize;

    // Player body (circle)
    ctx.fillStyle = game.player.color;
    ctx.beginPath();
    ctx.arc(
        playerScreenX + config.tileSize / 2,
        playerScreenY + config.tileSize / 2,
        config.tileSize / 2 - 5,
        0,
        Math.PI * 2
    );
    ctx.fill();

    // Player eyes (to show direction)
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(playerScreenX + config.tileSize / 2 - 8, playerScreenY + config.tileSize / 2 - 5, 3, 0, Math.PI * 2);
    ctx.arc(playerScreenX + config.tileSize / 2 + 8, playerScreenY + config.tileSize / 2 - 5, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(playerScreenX + config.tileSize / 2 - 8, playerScreenY + config.tileSize / 2 - 5, 1.5, 0, Math.PI * 2);
    ctx.arc(playerScreenX + config.tileSize / 2 + 8, playerScreenY + config.tileSize / 2 - 5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Draw row indicators (for debugging/visual feedback)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '12px Arial';
    ctx.fillText(`Row: ${-game.player.y}`, 10, canvas.height - 10);
}

// Game loop
function gameLoop() {
    render();
    requestAnimationFrame(gameLoop);
}

// Initialize and start game
initializeGrid();
gameLoop();
