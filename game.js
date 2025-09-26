class SmoothPaperIOGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Game settings
        this.playerSpeed = 120; // pixels per second
        this.aiSpeed = 100;
        this.playerSize = 8;
        this.trailWidth = 4;
        
        // Game state
        this.players = [];
        this.gameRunning = false;
        this.gameStartTime = 0;
        this.gameTimeLimit = 180000; // 3 minutes
        this.lastFrameTime = 0;
        
        // Colors for players
        this.colors = [
            '#FF6B6B', // Red - Human player
            '#4ECDC4', // Teal
            '#45B7D1', // Blue  
            '#96CEB4', // Green
            '#FFEAA7', // Yellow
            '#DDA0DD', // Plum
            '#98D8C8', // Mint
            '#F7DC6F'  // Light Yellow
        ];
        
        this.initializeGame();
        this.setupEventListeners();
        this.gameLoop();
    }

    initializeGame() {
        this.players = [];
        
        // Create players with starting positions in corners
        const startPositions = [
            { x: 100, y: 100 },     // Top-left (Human)
            { x: 700, y: 100 },     // Top-right
            { x: 100, y: 500 },     // Bottom-left
            { x: 700, y: 500 }      // Bottom-right
        ];

        for (let i = 0; i < 4; i++) {
            const player = {
                id: i + 1,
                x: startPositions[i].x,
                y: startPositions[i].y,
                direction: { x: 0, y: 0 },
                color: this.colors[i],
                trail: [],
                territory: [],
                alive: true,
                isHuman: i === 0,
                speed: i === 0 ? this.playerSpeed : this.aiSpeed,
                lastDirectionChange: 0,
                aiTarget: null
            };

            // Create initial territory (circle around starting position)
            this.createInitialTerritory(player);
            this.players.push(player);
        }

        this.gameRunning = true;
        this.gameStartTime = Date.now();
        this.lastFrameTime = Date.now();
        this.updateScores();
    }

    createInitialTerritory(player) {
        const radius = 40;
        const points = [];
        const segments = 16;
        
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            points.push({
                x: player.x + Math.cos(angle) * radius,
                y: player.y + Math.sin(angle) * radius
            });
        }
        
        player.territory = [points];
    }

    setupEventListeners() {
        const keys = {};
        
        document.addEventListener('keydown', (e) => {
            keys[e.key] = true;
            this.handleInput(keys);
            e.preventDefault();
        });
        
        document.addEventListener('keyup', (e) => {
            keys[e.key] = false;
        });
    }

    handleInput(keys) {
        if (!this.gameRunning) return;
        
        const player = this.players[0]; // Human player
        if (!player.alive) return;

        let newDirection = { ...player.direction };
        
        if (keys['ArrowUp'] && player.direction.y !== 1) {
            newDirection = { x: 0, y: -1 };
        } else if (keys['ArrowDown'] && player.direction.y !== -1) {
            newDirection = { x: 0, y: 1 };
        } else if (keys['ArrowLeft'] && player.direction.x !== 1) {
            newDirection = { x: -1, y: 0 };
        } else if (keys['ArrowRight'] && player.direction.x !== -1) {
            newDirection = { x: 1, y: 0 };
        }
        
        player.direction = newDirection;
    }

    gameLoop() {
        const currentTime = Date.now();
        const deltaTime = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
        this.lastFrameTime = currentTime;
        
        if (this.gameRunning) {
            this.updatePlayers(deltaTime);
            this.checkCollisions();
            this.updateAI(currentTime);
            this.checkGameEnd();
            this.updateTimer();
        }
        
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }

    updatePlayers(deltaTime) {
        for (const player of this.players) {
            if (!player.alive || (player.direction.x === 0 && player.direction.y === 0)) continue;
            
            const oldX = player.x;
            const oldY = player.y;
            
            // Update position based on direction and speed
            player.x += player.direction.x * player.speed * deltaTime;
            player.y += player.direction.y * player.speed * deltaTime;
            
            // Check if player is outside their territory
            if (!this.isInTerritory(player, player.x, player.y)) {
                // Add to trail if we moved significantly
                const distance = Math.sqrt((player.x - oldX) ** 2 + (player.y - oldY) ** 2);
                if (distance > 2) {
                    player.trail.push({ x: oldX, y: oldY });
                }
            } else if (player.trail.length > 0) {
                // Player returned to territory, close the trail
                this.closeTrail(player);
            }
        }
    }

    updateAI(currentTime) {
        for (const player of this.players) {
            if (!player.alive || player.isHuman) continue;
            
            // Change direction occasionally or when needed
            if (currentTime - player.lastDirectionChange > 1000 + Math.random() * 2000) {
                this.updateAIDirection(player);
                player.lastDirectionChange = currentTime;
            }
            
            // Check if AI needs to avoid danger
            if (this.isAIInDanger(player)) {
                this.updateAIDirection(player);
                player.lastDirectionChange = currentTime;
            }
        }
    }

    updateAIDirection(player) {
        const directions = [
            { x: 0, y: -1 }, // up
            { x: 0, y: 1 },  // down
            { x: -1, y: 0 }, // left
            { x: 1, y: 0 }   // right
        ];

        // Filter safe directions
        const safeDirections = directions.filter(dir => {
            // Don't reverse direction
            if (dir.x === -player.direction.x && dir.y === -player.direction.y) return false;
            
            // Check if this direction leads to safety
            const testX = player.x + dir.x * 50;
            const testY = player.y + dir.y * 50;
            
            return this.isPositionSafe(player, testX, testY);
        });

        if (safeDirections.length > 0) {
            // Prefer directions that lead toward unclaimed territory
            const bestDirection = this.findBestAIDirection(player, safeDirections);
            player.direction = bestDirection || safeDirections[Math.floor(Math.random() * safeDirections.length)];
        } else if (player.trail.length === 0) {
            // If no safe direction and no trail, pick any direction
            player.direction = directions[Math.floor(Math.random() * directions.length)];
        }
    }

    findBestAIDirection(player, directions) {
        let bestDirection = null;
        let bestScore = -1;
        
        for (const dir of directions) {
            const testX = player.x + dir.x * 100;
            const testY = player.y + dir.y * 100;
            
            // Score based on distance from other players and potential territory gain
            let score = 0;
            
            // Prefer directions away from other players
            for (const otherPlayer of this.players) {
                if (otherPlayer.id === player.id) continue;
                const distance = Math.sqrt((testX - otherPlayer.x) ** 2 + (testY - otherPlayer.y) ** 2);
                score += Math.min(distance / 100, 1);
            }
            
            // Prefer directions toward center if near edges
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            const distanceToCenter = Math.sqrt((testX - centerX) ** 2 + (testY - centerY) ** 2);
            if (testX < 50 || testX > this.canvas.width - 50 || testY < 50 || testY > this.canvas.height - 50) {
                score += (1 - distanceToCenter / 400);
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestDirection = dir;
            }
        }
        
        return bestDirection;
    }

    isAIInDanger(player) {
        const lookAhead = 30;
        const testX = player.x + player.direction.x * lookAhead;
        const testY = player.y + player.direction.y * lookAhead;
        
        return !this.isPositionSafe(player, testX, testY);
    }

    isPositionSafe(player, x, y) {
        // Check boundaries
        if (x < 10 || x > this.canvas.width - 10 || y < 10 || y > this.canvas.height - 10) {
            return false;
        }
        
        // Check collision with other players' trails
        for (const otherPlayer of this.players) {
            if (otherPlayer.id === player.id || !otherPlayer.alive) continue;
            
            if (this.isPointNearTrail(x, y, otherPlayer.trail, 15)) {
                return false;
            }
        }
        
        // Check collision with own trail
        if (this.isPointNearTrail(x, y, player.trail, 10)) {
            return false;
        }
        
        return true;
    }

    checkCollisions() {
        for (const player of this.players) {
            if (!player.alive) continue;
            
            // Check boundary collision
            if (player.x < 0 || player.x > this.canvas.width || 
                player.y < 0 || player.y > this.canvas.height) {
                this.eliminatePlayer(player);
                continue;
            }
            
            // Check collision with other players' trails
            for (const otherPlayer of this.players) {
                if (otherPlayer.id === player.id || !otherPlayer.alive) continue;
                
                if (this.isPointNearTrail(player.x, player.y, otherPlayer.trail, this.playerSize)) {
                    this.eliminatePlayer(player);
                    break;
                }
            }
            
            // Check collision with own trail (but not the most recent part)
            if (player.trail.length > 10) {
                const checkTrail = player.trail.slice(0, -5);
                if (this.isPointNearTrail(player.x, player.y, checkTrail, this.playerSize)) {
                    this.eliminatePlayer(player);
                }
            }
        }
    }

    isPointNearTrail(x, y, trail, threshold) {
        for (let i = 0; i < trail.length - 1; i++) {
            const distance = this.distanceToLineSegment(x, y, trail[i], trail[i + 1]);
            if (distance < threshold) {
                return true;
            }
        }
        return false;
    }

    distanceToLineSegment(px, py, p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return Math.sqrt((px - p1.x) ** 2 + (py - p1.y) ** 2);
        
        const t = Math.max(0, Math.min(1, ((px - p1.x) * dx + (py - p1.y) * dy) / (length * length)));
        const projection = { x: p1.x + t * dx, y: p1.y + t * dy };
        
        return Math.sqrt((px - projection.x) ** 2 + (py - projection.y) ** 2);
    }

    isInTerritory(player, x, y) {
        for (const territory of player.territory) {
            if (this.isPointInPolygon(x, y, territory)) {
                return true;
            }
        }
        return false;
    }

    isPointInPolygon(x, y, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            if (((polygon[i].y > y) !== (polygon[j].y > y)) &&
                (x < (polygon[j].x - polygon[i].x) * (y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
                inside = !inside;
            }
        }
        return inside;
    }

    closeTrail(player) {
        if (player.trail.length < 3) {
            player.trail = [];
            return;
        }
        
        // Add current position to complete the trail
        player.trail.push({ x: player.x, y: player.y });
        
        // Find the connection point in existing territory
        const connectionPoint = this.findTerritoryConnection(player);
        if (connectionPoint) {
            // Create new territory from the trail
            const newTerritory = [...player.trail];
            player.territory.push(newTerritory);
        }
        
        player.trail = [];
        this.updateScores();
    }

    findTerritoryConnection(player) {
        // Simplified: just return the current position as connection point
        return { x: player.x, y: player.y };
    }

    eliminatePlayer(player) {
        player.alive = false;
        player.trail = [];
        player.direction = { x: 0, y: 0 };
        this.updateScores();
    }

    calculateTerritoryArea(territories) {
        let totalArea = 0;
        for (const territory of territories) {
            totalArea += this.polygonArea(territory);
        }
        return totalArea;
    }

    polygonArea(polygon) {
        let area = 0;
        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            area += polygon[i].x * polygon[j].y;
            area -= polygon[j].x * polygon[i].y;
        }
        return Math.abs(area) / 2;
    }

    updateScores() {
        const scoresDiv = document.getElementById('scores');
        const totalArea = this.canvas.width * this.canvas.height;
        
        let html = '';
        for (const player of this.players) {
            const area = this.calculateTerritoryArea(player.territory);
            const percentage = ((area / totalArea) * 100).toFixed(1);
            const status = player.alive ? 'alive' : 'eliminated';
            const statusText = player.alive ? 'Alive' : 'Eliminated';
            
            html += `
                <div class="player-score" style="background-color: ${player.color}15; border-left: 4px solid ${player.color}">
                    <div class="player-info">
                        <div class="player-color" style="background-color: ${player.color}"></div>
                        <div>
                            <div>Player ${player.id} ${player.isHuman ? '(You)' : ''}</div>
                        </div>
                    </div>
                    <div class="player-stats">
                        <div class="percentage">${percentage}%</div>
                        <div class="status ${status}">${statusText}</div>
                    </div>
                </div>
            `;
        }
        
        scoresDiv.innerHTML = html;
    }

    updateTimer() {
        const timeElapsed = Date.now() - this.gameStartTime;
        const timeRemaining = Math.max(0, this.gameTimeLimit - timeElapsed);
        const minutes = Math.floor(timeRemaining / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        
        document.getElementById('timer').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
        const gameOverTitle = document.getElementById('gameOverTitle');
        const finalScores = document.getElementById('finalScores');
        
        const totalArea = this.canvas.width * this.canvas.height;
        const sortedPlayers = [...this.players].sort((a, b) => {
            const areaA = this.calculateTerritoryArea(a.territory);
            const areaB = this.calculateTerritoryArea(b.territory);
            return areaB - areaA;
        });
        
        const winner = sortedPlayers[0];
        const isHumanWinner = winner.isHuman;
        
        gameOverTitle.textContent = isHumanWinner ? '🎉 You Won!' : '💀 Game Over!';
        
        let scoresHtml = '<h3>Final Rankings:</h3>';
        sortedPlayers.forEach((player, index) => {
            const area = this.calculateTerritoryArea(player.territory);
            const percentage = ((area / totalArea) * 100).toFixed(1);
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
            
            scoresHtml += `
                <div style="margin: 8px 0; color: ${player.color};">
                    ${medal} ${index + 1}. Player ${player.id} ${player.isHuman ? '(You)' : ''}: ${percentage}%
                </div>
            `;
        });

        finalScores.innerHTML = scoresHtml;
        gameOverDiv.style.display = 'block';
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw territories
        for (const player of this.players) {
            this.ctx.fillStyle = player.color + '40'; // Semi-transparent
            this.ctx.strokeStyle = player.color;
            this.ctx.lineWidth = 2;
            
            for (const territory of player.territory) {
                if (territory.length > 2) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(territory[0].x, territory[0].y);
                    for (let i = 1; i < territory.length; i++) {
                        this.ctx.lineTo(territory[i].x, territory[i].y);
                    }
                    this.ctx.closePath();
                    this.ctx.fill();
                    this.ctx.stroke();
                }
            }
        }
        
        // Draw trails
        for (const player of this.players) {
            if (!player.alive || player.trail.length < 2) continue;
            
            this.ctx.strokeStyle = player.color;
            this.ctx.lineWidth = this.trailWidth;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            
            this.ctx.beginPath();
            this.ctx.moveTo(player.trail[0].x, player.trail[0].y);
            for (let i = 1; i < player.trail.length; i++) {
                this.ctx.lineTo(player.trail[i].x, player.trail[i].y);
            }
            // Connect to current position
            if (player.trail.length > 0) {
                this.ctx.lineTo(player.x, player.y);
            }
            this.ctx.stroke();
        }
        
        // Draw players
        for (const player of this.players) {
            if (!player.alive) continue;
            
            // Player body
            this.ctx.fillStyle = player.color;
            this.ctx.beginPath();
            this.ctx.arc(player.x, player.y, this.playerSize, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Player border
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Direction indicator
            if (player.direction.x !== 0 || player.direction.y !== 0) {
                this.ctx.fillStyle = '#fff';
                this.ctx.beginPath();
                this.ctx.arc(
                    player.x + player.direction.x * (this.playerSize - 2),
                    player.y + player.direction.y * (this.playerSize - 2),
                    2, 0, Math.PI * 2
                );
                this.ctx.fill();
            }
        }
    }

    restart() {
        document.getElementById('gameOver').style.display = 'none';
        this.initializeGame();
    }
}

// Start the game
const game = new SmoothPaperIOGame();