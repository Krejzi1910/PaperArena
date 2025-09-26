class PaperIOGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 10;
        this.mapWidth = this.canvas.width / this.gridSize;
        this.mapHeight = this.canvas.height / this.gridSize;
        
        this.players = [];
        this.gameRunning = false;
        this.gameStartTime = 0;
        this.gameTimeLimit = 180000; // 3 minutes
        
        this.colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
        
        this.initializeGame();
        this.setupEventListeners();
        this.gameLoop();
    }

    initializeGame() {
        this.grid = Array(this.mapHeight).fill().map(() => Array(this.mapWidth).fill(0));
        this.players = [];
        
        // Create 4 players
        const startPositions = [
            { x: 5, y: 5 },
            { x: this.mapWidth - 6, y: 5 },
            { x: 5, y: this.mapHeight - 6 },
            { x: this.mapWidth - 6, y: this.mapHeight - 6 }
        ];

        for (let i = 0; i < 4; i++) {
            const player = {
                id: i + 1,
                x: startPositions[i].x,
                y: startPositions[i].y,
                direction: { x: 0, y: 0 },
                color: this.colors[i],
                trail: [],
                territory: new Set(),
                alive: true,
                isHuman: i === 0, // First player is human
                lastMoveTime: 0,
                moveInterval: i === 0 ? 100 : 150 + Math.random() * 100 // AI moves slightly slower
            };

            // Initialize starting territory (3x3 square)
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = player.x + dx;
                    const ny = player.y + dy;
                    if (this.isValidPosition(nx, ny)) {
                        this.grid[ny][nx] = player.id;
                        player.territory.add(`${nx},${ny}`);
                    }
                }
            }

            this.players.push(player);
        }

        this.gameRunning = true;
        this.gameStartTime = Date.now();
        this.updateScores();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (!this.gameRunning) return;
            
            const player = this.players[0]; // Human player
            if (!player.alive) return;

            let newDirection = { ...player.direction };
            
            switch (e.key) {
                case 'ArrowUp':
                    if (player.direction.y !== 1) newDirection = { x: 0, y: -1 };
                    break;
                case 'ArrowDown':
                    if (player.direction.y !== -1) newDirection = { x: 0, y: 1 };
                    break;
                case 'ArrowLeft':
                    if (player.direction.x !== 1) newDirection = { x: -1, y: 0 };
                    break;
                case 'ArrowRight':
                    if (player.direction.x !== -1) newDirection = { x: 1, y: 0 };
                    break;
            }
            
            player.direction = newDirection;
            e.preventDefault();
        });
    }

    gameLoop() {
        const currentTime = Date.now();
        
        if (this.gameRunning) {
            this.updatePlayers(currentTime);
            this.checkGameEnd();
        }
        
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }

    updatePlayers(currentTime) {
        for (const player of this.players) {
            if (!player.alive) continue;
            
            if (currentTime - player.lastMoveTime >= player.moveInterval) {
                if (!player.isHuman) {
                    this.updateAI(player);
                }
                
                if (player.direction.x !== 0 || player.direction.y !== 0) {
                    this.movePlayer(player);
                    player.lastMoveTime = currentTime;
                }
            }
        }
    }

    updateAI(player) {
        // Simple AI logic
        const directions = [
            { x: 0, y: -1 }, // up
            { x: 0, y: 1 },  // down
            { x: -1, y: 0 }, // left
            { x: 1, y: 0 }   // right
        ];

        // If player has no direction, pick a random one
        if (player.direction.x === 0 && player.direction.y === 0) {
            player.direction = directions[Math.floor(Math.random() * directions.length)];
            return;
        }

        // Check if current direction is safe
        const nextX = player.x + player.direction.x;
        const nextY = player.y + player.direction.y;
        
        if (this.isValidMove(player, nextX, nextY)) {
            // Continue in current direction most of the time
            if (Math.random() < 0.9) return;
        }

        // Find safe directions
        const safeDirections = directions.filter(dir => {
            const nx = player.x + dir.x;
            const ny = player.y + dir.y;
            return this.isValidMove(player, nx, ny) && 
                   !(dir.x === -player.direction.x && dir.y === -player.direction.y); // Don't reverse
        });

        if (safeDirections.length > 0) {
            player.direction = safeDirections[Math.floor(Math.random() * safeDirections.length)];
        }
    }

    movePlayer(player) {
        const newX = player.x + player.direction.x;
        const newY = player.y + player.direction.y;

        if (!this.isValidMove(player, newX, newY)) {
            this.eliminatePlayer(player);
            return;
        }

        // Add current position to trail if outside territory
        if (!player.territory.has(`${player.x},${player.y}`)) {
            player.trail.push({ x: player.x, y: player.y });
        }

        player.x = newX;
        player.y = newY;

        // Check if player returned to their territory
        if (player.territory.has(`${newX},${newY}`) && player.trail.length > 0) {
            this.claimTerritory(player);
        }
    }

    isValidMove(player, x, y) {
        // Check boundaries
        if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) {
            return false;
        }

        // Check if position is occupied by another player's territory
        const cellOwner = this.grid[y][x];
        if (cellOwner !== 0 && cellOwner !== player.id) {
            return false;
        }

        // Check if player would hit their own trail
        if (player.trail.some(pos => pos.x === x && pos.y === y)) {
            return false;
        }

        // Check if player would hit another player's trail
        for (const otherPlayer of this.players) {
            if (otherPlayer.id !== player.id && otherPlayer.alive) {
                if (otherPlayer.trail.some(pos => pos.x === x && pos.y === y)) {
                    return false;
                }
            }
        }

        return true;
    }

    claimTerritory(player) {
        if (player.trail.length === 0) return;

        // Add trail to territory
        for (const pos of player.trail) {
            player.territory.add(`${pos.x},${pos.y}`);
            this.grid[pos.y][pos.x] = player.id;
        }

        // Flood fill to claim enclosed area
        this.floodFillTerritory(player);
        
        player.trail = [];
        this.updateScores();
    }

    floodFillTerritory(player) {
        // Simple flood fill algorithm to claim enclosed areas
        const visited = new Set();
        const toVisit = [];

        // Start flood fill from edges to find unclaimed areas
        for (let x = 0; x < this.mapWidth; x++) {
            for (let y = 0; y < this.mapHeight; y++) {
                if (this.grid[y][x] === 0 && !visited.has(`${x},${y}`)) {
                    const region = this.getConnectedRegion(x, y, visited);
                    
                    // If region doesn't touch the border, it's enclosed
                    if (!this.regionTouchesBorder(region)) {
                        for (const pos of region) {
                            const [px, py] = pos.split(',').map(Number);
                            this.grid[py][px] = player.id;
                            player.territory.add(pos);
                        }
                    }
                }
            }
        }
    }

    getConnectedRegion(startX, startY, visited) {
        const region = new Set();
        const stack = [{ x: startX, y: startY }];

        while (stack.length > 0) {
            const { x, y } = stack.pop();
            const key = `${x},${y}`;

            if (visited.has(key) || region.has(key)) continue;
            if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) continue;
            if (this.grid[y][x] !== 0) continue;

            region.add(key);
            visited.add(key);

            stack.push({ x: x + 1, y });
            stack.push({ x: x - 1, y });
            stack.push({ x, y: y + 1 });
            stack.push({ x, y: y - 1 });
        }

        return region;
    }

    regionTouchesBorder(region) {
        for (const pos of region) {
            const [x, y] = pos.split(',').map(Number);
            if (x === 0 || x === this.mapWidth - 1 || y === 0 || y === this.mapHeight - 1) {
                return true;
            }
        }
        return false;
    }

    eliminatePlayer(player) {
        player.alive = false;
        player.trail = [];
        
        // Check if any other player's trail intersects with eliminated player's trail
        for (const otherPlayer of this.players) {
            if (otherPlayer.id !== player.id && otherPlayer.alive) {
                for (const trailPos of player.trail) {
                    if (otherPlayer.trail.some(pos => pos.x === trailPos.x && pos.y === trailPos.y)) {
                        this.eliminatePlayer(otherPlayer);
                    }
                }
            }
        }
    }

    checkGameEnd() {
        const alivePlayers = this.players.filter(p => p.alive);
        const timeElapsed = Date.now() - this.gameStartTime;

        if (alivePlayers.length <= 1 || timeElapsed >= this.gameTimeLimit) {
            this.gameRunning = false;
            this.showGameOver();
        }
    }

    showGameOver() {
        const gameOverDiv = document.getElementById('gameOver');
        const gameOverText = document.getElementById('gameOverText');
        
        const alivePlayers = this.players.filter(p => p.alive);
        const sortedPlayers = this.players.sort((a, b) => b.territory.size - a.territory.size);
        
        let message = 'Game Over!\n\nFinal Scores:\n';
        sortedPlayers.forEach((player, index) => {
            const percentage = ((player.territory.size / (this.mapWidth * this.mapHeight)) * 100).toFixed(1);
            message += `${index + 1}. Player ${player.id}: ${percentage}%\n`;
        });

        gameOverText.innerHTML = message.replace(/\n/g, '<br>');
        gameOverDiv.style.display = 'block';
    }

    updateScores() {
        const scoresDiv = document.getElementById('scores');
        const totalCells = this.mapWidth * this.mapHeight;
        
        let html = '';
        for (const player of this.players) {
            const percentage = ((player.territory.size / totalCells) * 100).toFixed(1);
            const status = player.alive ? 'Alive' : 'Eliminated';
            
            html += `
                <div class="player-score" style="background-color: ${player.color}20; border-left: 4px solid ${player.color}">
                    <div style="display: flex; align-items: center;">
                        <div class="player-color" style="background-color: ${player.color}"></div>
                        Player ${player.id} ${player.isHuman ? '(You)' : ''}
                    </div>
                    <div>
                        <div>${percentage}%</div>
                        <div style="font-size: 12px; color: ${player.alive ? '#4CAF50' : '#f44336'}">${status}</div>
                    </div>
                </div>
            `;
        }
        
        scoresDiv.innerHTML = html;
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        for (let x = 0; x <= this.mapWidth; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.gridSize, 0);
            this.ctx.lineTo(x * this.gridSize, this.canvas.height);
            this.ctx.stroke();
        }
        for (let y = 0; y <= this.mapHeight; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * this.gridSize);
            this.ctx.lineTo(this.canvas.width, y * this.gridSize);
            this.ctx.stroke();
        }

        // Draw territories
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const owner = this.grid[y][x];
                if (owner > 0) {
                    const player = this.players[owner - 1];
                    this.ctx.fillStyle = player.color + '80'; // Semi-transparent
                    this.ctx.fillRect(x * this.gridSize, y * this.gridSize, this.gridSize, this.gridSize);
                }
            }
        }

        // Draw trails
        for (const player of this.players) {
            if (!player.alive) continue;
            
            this.ctx.fillStyle = player.color;
            for (const pos of player.trail) {
                this.ctx.fillRect(pos.x * this.gridSize + 2, pos.y * this.gridSize + 2, 
                                this.gridSize - 4, this.gridSize - 4);
            }
        }

        // Draw players
        for (const player of this.players) {
            if (!player.alive) continue;
            
            this.ctx.fillStyle = player.color;
            this.ctx.fillRect(player.x * this.gridSize + 1, player.y * this.gridSize + 1, 
                            this.gridSize - 2, this.gridSize - 2);
            
            // Draw player border
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(player.x * this.gridSize + 1, player.y * this.gridSize + 1, 
                              this.gridSize - 2, this.gridSize - 2);
        }

        // Draw time remaining
        if (this.gameRunning) {
            const timeElapsed = Date.now() - this.gameStartTime;
            const timeRemaining = Math.max(0, this.gameTimeLimit - timeElapsed);
            const minutes = Math.floor(timeRemaining / 60000);
            const seconds = Math.floor((timeRemaining % 60000) / 1000);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '20px Arial';
            this.ctx.fillText(`Time: ${minutes}:${seconds.toString().padStart(2, '0')}`, 10, 30);
        }
    }

    isValidPosition(x, y) {
        return x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight;
    }

    restart() {
        document.getElementById('gameOver').style.display = 'none';
        this.initializeGame();
    }
}

// Start the game
const game = new PaperIOGame();