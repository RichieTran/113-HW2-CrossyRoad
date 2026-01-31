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

// Session high score (resets on page reload)
let highScore = 0;

// Game state
let game = {
    player: {
        x: Math.floor(config.gridWidth / 2),
        y: 0,
        color: '#ffffff'
    },
    score: 0,
    highestRow: 0,
    tiles: [],
    logs: [],        // { x: float, y: int, width: int, direction: 1|-1, speed: float }
    waterRows: {},   // rowY -> { direction, speed } metadata
    gameOver: false
};

// Tile types with different colors
const tileTypes = [
    { name: 'grass', color: '#2ecc71', weight: 3 },
    { name: 'rock', color: '#95a5a6', weight: 2 },
    { name: 'water', color: '#3498db', weight: 1 }
];

// Get the tile-snapped X position of the player
function playerTileX() {
    return Math.round(game.player.x);
}

// Get the tile at a given grid position
function getTileAt(x, y) {
    return game.tiles.find(t => t.x === x && t.y === y);
}

// Initialize the grid with random tiles
function initializeGrid() {
    const cameraY = game.player.y - config.tilesAhead;
    const startRow = cameraY;
    const endRow = game.player.y + config.tilesAhead;

    for (let row = startRow; row <= endRow; row++) {
        generateNewRow(row);
    }
}

// Pick a row type: 'water' makes a full river, 'land' is a grass/rock mix
function getRandomRowType() {
    // ~20% chance of water river row
    return Math.random() < 0.2 ? 'water' : 'land';
}

// Generate a new row of tiles
function generateNewRow(rowY) {
    // Rows behind spawn (1 to 5) are solid rock walls
    if (rowY >= 1 && rowY <= 5) {
        const rockType = tileTypes.find(t => t.name === 'rock');
        for (let col = 0; col < config.gridWidth; col++) {
            game.tiles.push({
                x: col, y: rowY,
                type: rockType.name, color: rockType.color
            });
        }
        return;
    }

    const spawnX = Math.floor(config.gridWidth / 2);
    const isSpawnRow = (rowY === 0);
    const isAdjacentToSpawn = (rowY === -1);

    // Prevent consecutive water rows — check if the row behind (rowY+1) is water
    const prevRowIsWater = game.tiles.some(t => t.y === rowY + 1 && t.type === 'water');

    // Spawn row and adjacent rows are always land; no back-to-back water rows
    const rowType = (isSpawnRow || isAdjacentToSpawn || prevRowIsWater) ? 'land' : getRandomRowType();

    if (rowType === 'water') {
        // Full river across the entire row
        const waterType = tileTypes.find(t => t.name === 'water');
        for (let col = 0; col < config.gridWidth; col++) {
            game.tiles.push({
                x: col, y: rowY,
                type: waterType.name, color: waterType.color
            });
        }

        // Spawn logs for this water row
        const direction = Math.random() < 0.5 ? 1 : -1;
        const speed = 0.02 + Math.random() * 0.03; // tiles per frame
        game.waterRows[rowY] = { direction, speed };

        const logCount = 2 + Math.floor(Math.random() * 3); // 2, 3, or 4
        const spacing = config.gridWidth / logCount;
        for (let i = 0; i < logCount; i++) {
            const logWidth = 2 + Math.floor(Math.random() * 2); // 2 or 3 tiles wide
            game.logs.push({
                x: Math.floor(spacing * i + Math.random() * (spacing - logWidth)),
                y: rowY,
                width: logWidth,
                direction,
                speed
            });
        }
    } else {
        // Land row: mix of grass and rock, guaranteed at least 1 grass
        const grassType = tileTypes.find(t => t.name === 'grass');
        const rockType = tileTypes.find(t => t.name === 'rock');

        // Build array of tile types for this row
        const row = [];
        for (let col = 0; col < config.gridWidth; col++) {
            // ~35% chance of rock on a land row
            row.push(Math.random() < 0.35 ? 'rock' : 'grass');
        }

        // Guarantee at least 1 grass tile: pick a random column and force it
        if (!row.includes('grass')) {
            row[Math.floor(Math.random() * config.gridWidth)] = 'grass';
        }

        // Find the nearest land row behind this one (skip over water rows)
        // to ensure grass connectivity. Players cross water via logs and can
        // land at any column, so after water we need wide grass coverage.
        let lookbackY = rowY + 1;
        while (lookbackY <= rowY + 5) {
            const hasTiles = game.tiles.some(t => t.y === lookbackY);
            if (!hasTiles) break;
            const isWater = game.tiles.some(t => t.y === lookbackY && t.type === 'water');
            if (!isWater) break;
            lookbackY++;
        }

        const prevRowGrass = game.tiles
            .filter(t => t.y === lookbackY && t.type === 'grass')
            .map(t => t.x);

        if (lookbackY !== rowY + 1) {
            // This land row follows a water row — player could land anywhere from a log.
            // Ensure every grass tile from the last land row has a forward path,
            // and also spread extra grass so logs can drop the player safely.
            for (const prevCol of prevRowGrass) {
                row[prevCol] = 'grass';
            }
        } else {
            // Normal land-to-land: ensure every grass tile has a reachable neighbor
            for (const prevCol of prevRowGrass) {
                const neighbors = [prevCol - 1, prevCol, prevCol + 1]
                    .filter(c => c >= 0 && c < config.gridWidth);
                const hasPath = neighbors.some(c => row[c] === 'grass');
                if (!hasPath) {
                    row[prevCol] = 'grass';
                }
            }
        }

        // Spawn safety: ensure spawn tile and at least one neighbor (left, right, forward) are grass
        if (isSpawnRow) {
            row[spawnX] = 'grass';
            if (spawnX > 0) row[spawnX - 1] = 'grass';
            if (spawnX < config.gridWidth - 1) row[spawnX + 1] = 'grass';
        }
        if (isAdjacentToSpawn) {
            row[spawnX] = 'grass';
        }

        for (let col = 0; col < config.gridWidth; col++) {
            const tileType = row[col] === 'rock' ? rockType : grassType;
            game.tiles.push({
                x: col, y: rowY,
                type: tileType.name, color: tileType.color
            });
        }
    }
}

// Remove old tiles and logs that are too far behind
function removeOldTiles() {
    const maxRow = game.player.y + config.tilesBehind + 2;
    game.tiles = game.tiles.filter(tile => tile.y <= maxRow);
    game.logs = game.logs.filter(log => log.y <= maxRow);
    // Clean up waterRows metadata
    for (const rowY in game.waterRows) {
        if (Number(rowY) > maxRow) delete game.waterRows[rowY];
    }
}

// Check if the player is standing on a log (using float positions)
function getLogUnderPlayer() {
    const px = game.player.x + 0.5; // player center
    return game.logs.find(log => {
        return log.y === game.player.y &&
               px > log.x &&
               px < log.x + log.width;
    });
}

// Update all logs: move them and carry the player if riding one
function updateLogs() {
    if (game.gameOver) return;

    for (const log of game.logs) {
        log.x += log.speed * log.direction;

        // Wrap logs around the screen
        if (log.direction === 1 && log.x >= config.gridWidth) {
            log.x = -log.width;
        } else if (log.direction === -1 && log.x + log.width <= 0) {
            log.x = config.gridWidth;
        }
    }

    // If player is on a water row, check log status
    const tile = getTileAt(playerTileX(), game.player.y);
    if (tile && tile.type === 'water') {
        const log = getLogUnderPlayer();
        if (log) {
            // Move player smoothly with the log
            game.player.x += log.speed * log.direction;

            // Die if carried off screen
            if (game.player.x < -0.5 || game.player.x >= config.gridWidth - 0.5) {
                die();
            }
        } else {
            // In water with no log
            die();
        }
    }
}

// Kill the player and show game over screen
function die() {
    game.gameOver = true;
    if (game.score > highScore) {
        highScore = game.score;
        document.getElementById('highScore').textContent = highScore;
    }
}

// Reset game state for a fresh start
function restartGame() {
    game = {
        player: {
            x: Math.floor(config.gridWidth / 2),
            y: 0,
            color: '#ffffff'
        },
        score: 0,
        highestRow: 0,
        tiles: [],
        logs: [],
        waterRows: {},
        gameOver: false
    };
    document.getElementById('score').textContent = 0;
    initializeGrid();
}

// Handle player movement
function movePlayer(dx, dy) {
    if (game.gameOver) return;

    // Snap to nearest tile column, then apply horizontal offset
    // For vertical moves: snap to whichever tile the majority of the player is on
    // For horizontal moves: hop one tile from the snapped position
    const snappedX = playerTileX();
    const newX = snappedX + dx;
    const newY = game.player.y + dy;

    // Check boundaries (left/right)
    if (newX < 0 || newX >= config.gridWidth) {
        return;
    }

    // Check tile at destination
    const destTile = getTileAt(newX, newY);
    if (destTile && destTile.type === 'rock') {
        return; // Can't walk onto rocks
    }

    // Update player position (snap to integer for non-water tiles)
    game.player.x = newX;
    game.player.y = newY;

    // Water: land on log or die
    if (destTile && destTile.type === 'water') {
        if (!getLogUnderPlayer()) {
            die();
            return;
        }
    }

    // If player moved forward, update score and generate new tiles
    if (dy < 0) {  // Moving forward (negative Y)
        if (game.player.y < game.highestRow) {
            game.score += 1;
            game.highestRow = game.player.y;
            document.getElementById('score').textContent = game.score;
            if (game.score > highScore) {
                highScore = game.score;
                document.getElementById('highScore').textContent = highScore;
            }

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
    // If game over, any key restarts
    if (game.gameOver) {
        restartGame();
        return;
    }

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
    } else if (e.key === 'ArrowDown' && !keys.moved) {
        movePlayer(0, 1);  // Positive Y is backward
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

    // Draw logs
    game.logs.forEach(log => {
        const screenY = (log.y - cameraY) * config.tileSize;
        if (screenY >= -config.tileSize && screenY <= canvas.height) {
            const screenX = log.x * config.tileSize;
            const logW = log.width * config.tileSize;

            // Solid brown log
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(screenX, screenY + 4, logW, config.tileSize - 8);
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

    // Yellow beak (triangle between the eyes)
    const beakCX = playerScreenX + config.tileSize / 2;
    const beakCY = playerScreenY + config.tileSize / 2;
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.moveTo(beakCX - 4, beakCY - 2);
    ctx.lineTo(beakCX + 4, beakCY - 2);
    ctx.lineTo(beakCX, beakCY + 4);
    ctx.closePath();
    ctx.fill();

    // Red comb on top
    const combCX = playerScreenX + config.tileSize / 2;
    const combTop = playerScreenY + config.tileSize / 2 - (config.tileSize / 2 - 5);
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(combCX - 5, combTop - 2, 4, 0, Math.PI * 2);
    ctx.arc(combCX, combTop - 4, 4, 0, Math.PI * 2);
    ctx.arc(combCX + 5, combTop - 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw row indicators (for debugging/visual feedback)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '12px Arial';
    ctx.fillText(`Row: ${-game.player.y}`, 10, canvas.height - 10);

    // Game over overlay
    if (game.gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#e74c3c';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 60);

        ctx.fillStyle = 'white';
        ctx.font = '28px Arial';
        ctx.fillText(`Current Score: ${game.score}`, canvas.width / 2, canvas.height / 2);
        ctx.fillText(`High Score: ${highScore}`, canvas.width / 2, canvas.height / 2 + 40);

        ctx.font = '20px Arial';
        ctx.fillStyle = '#bdc3c7';
        ctx.fillText('Press any key to restart', canvas.width / 2, canvas.height / 2 + 100);

        ctx.textAlign = 'start'; // reset alignment
    }
}

// Game loop
function gameLoop() {
    updateLogs();
    render();
    requestAnimationFrame(gameLoop);
}

// Initialize and start game
initializeGrid();
gameLoop();
