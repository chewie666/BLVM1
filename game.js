const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiLayer = document.getElementById('ui-layer');
const rotateScreen = document.getElementById('rotate-screen');
const gameContainer = document.getElementById('game-container');
const healthBar = document.getElementById('health-bar');
const scoreDisplay = document.getElementById('score');
const gameOverScreen = document.getElementById('game-over-screen');
const restartBtn = document.getElementById('restart-btn');

// Game State
let gameState = 'START';
let lastTime = 0;
let score = 0;
let health = 100;

// Config
const GRAVITY = 0.6;
const FLOOR_HEIGHT = 80;
const PLAYER_SPEED = 5;
const JUMP_FORCE = -15;

// Assets Management
const assets = {
    player: new Image(),
    enemy: new Image(),
    weed: new Image(),
    beer: new Image(),
    drumstick: new Image(),
    background: new Image(),
    graffiti1: new Image(),
    graffiti2: new Image()
};

// Load assets securely
let assetsLoaded = 0;
const totalAssets = 8;

function onAssetLoad() {
    assetsLoaded++;
    if (assetsLoaded === totalAssets) {
        console.log("All assets loaded");
        // Ready to start, but we wait for user interaction to init
    }
}

assets.player.src = 'assets/player_new.png';
assets.player.onload = onAssetLoad;

assets.enemy.src = 'assets/enemy_new.png';
assets.enemy.onload = onAssetLoad;

assets.weed.src = 'assets/weed_new.png';
assets.weed.onload = onAssetLoad;

assets.beer.src = 'assets/beer.svg';
assets.beer.onload = onAssetLoad;

assets.drumstick.src = 'assets/drumstick.svg';
assets.drumstick.onload = onAssetLoad;

assets.background.src = 'assets/bg.svg';
assets.background.onload = onAssetLoad;

assets.graffiti1.src = 'assets/graffiti_text.png';
assets.graffiti1.onload = onAssetLoad;

assets.graffiti2.src = 'assets/graffiti_art.jpg';
assets.graffiti2.onload = onAssetLoad;


// Game Entities
let player;
let enemies = [];
let items = [];
let projectiles = [];
let bgOffset = 0; // For background scrolling

// Input
const keys = { left: false, right: false, up: false, attack: false };

class Player {
    constructor() {
        this.width = 80;  // 64 * 1.25 = 80
        this.height = 80; // 64 * 1.25 = 80
        this.x = 100;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.grounded = false;
        this.facingRight = true;
        this.attackCooldown = 0;
    }

    update() {
        if (keys.left) {
            this.vx = -PLAYER_SPEED;
            this.facingRight = false;
        } else if (keys.right) {
            this.vx = PLAYER_SPEED;
            this.facingRight = true;
        } else {
            this.vx = 0;
        }

        this.x += this.vx;

        if (keys.up && this.grounded) {
            this.vy = JUMP_FORCE;
            this.grounded = false;
            keys.up = false;
        }

        this.vy += GRAVITY;
        this.y += this.vy;

        const floor = canvas.height - FLOOR_HEIGHT;
        if (this.y + this.height > floor) {
            this.y = floor - this.height;
            this.vy = 0;
            this.grounded = true;
        }

        // Camera / Scroll Logic
        if (this.x > canvas.width / 3) {
            const diff = this.x - (canvas.width / 3);
            this.x = canvas.width / 3;
            // Scroll everything else
            bgOffset = (bgOffset - diff * 0.5) % canvas.width; // Parallax background
            enemies.forEach(e => e.x -= diff);
            items.forEach(i => i.x -= diff);
            projectiles.forEach(p => p.x -= diff);
            // Spawn logic
            checkSpawns();
        }

        if (this.x < 0) this.x = 0;

        // Attack
        if (keys.attack && this.attackCooldown <= 0) {
            this.shoot();
            this.attackCooldown = 30;
        }
        if (this.attackCooldown > 0) this.attackCooldown--;
    }

    shoot() {
        const velX = this.facingRight ? 10 : -10;
        projectiles.push(new Projectile(this.x + this.width / 2, this.y + this.height / 2, velX));
    }

    draw() {
        ctx.save();
        if (!this.facingRight) {
            ctx.translate(this.x + this.width, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(assets.player, 0, 0, this.width, this.height);
        } else {
            ctx.drawImage(assets.player, this.x, this.y, this.width, this.height);
        }
        ctx.restore();
    }
}

class Enemy {
    constructor(x) {
        this.width = 64;
        this.height = 64;
        this.x = x;
        this.y = canvas.height - FLOOR_HEIGHT - 64;
        this.vx = -3;
        this.active = true;
    }

    update() {
        this.x += this.vx;
        if (checkCollision(this, player)) {
            health -= 1;
            // Knockback
            player.vx = (player.x < this.x) ? -10 : 10;
        }
    }

    draw() {
        ctx.save();
        if (this.vx > 0) {
            ctx.translate(this.x + this.width, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(assets.enemy, 0, 0, this.width, this.height);
        } else {
            ctx.drawImage(assets.enemy, this.x, this.y, this.width, this.height);
        }
        ctx.restore();
    }
}

class Item {
    constructor(x, type) {
        this.width = 32;
        this.height = 32;
        this.x = x;
        this.y = canvas.height - FLOOR_HEIGHT - 100;
        this.type = type;
        this.active = true;
    }

    update() {
        if (checkCollision(this, player)) {
            this.active = false;
            if (this.type === 'weed') { score += 100; health = Math.min(100, health + 10); }
            else { score += 50; health = Math.min(100, health + 5); }
        }
    }

    draw() {
        const img = (this.type === 'weed') ? assets.weed : assets.beer;
        ctx.drawImage(img, this.x, this.y, this.width, this.height);
    }
}

class Projectile {
    constructor(x, y, vx) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.width = 32;
        this.height = 8;
        this.active = true;
    }

    update() {
        this.x += this.vx;
        if (this.x < 0 || this.x > canvas.width) this.active = false;
        enemies.forEach(enemy => {
            if (enemy.active && checkCollision(this, enemy)) {
                enemy.active = false;
                this.active = false;
                score += 200;
            }
        });
    }

    draw() {
        ctx.drawImage(assets.drumstick, this.x, this.y, this.width, this.height);
    }
}

function checkCollision(rect1, rect2) {
    return (rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.height + rect1.y > rect2.y);
}

function checkSpawns() {
    // Check if we need to spawn new enemies at the edge of screen
    const rightEdge = canvas.width;
    // Count enemies ahead
    const enemiesAhead = enemies.filter(e => e.x > rightEdge - 100).length;

    if (enemiesAhead === 0 && Math.random() < 0.05) {
        enemies.push(new Enemy(rightEdge + 100));
    }

    if (Math.random() < 0.02) {
        items.push(new Item(rightEdge + 100, Math.random() > 0.5 ? 'weed' : 'beer'));
    }
}

function initGame() {
    resizeCanvas();
    if (assetsLoaded < totalAssets) {
        // Simple wait
        console.log("Waiting for assets...");
        setTimeout(initGame, 100);
        return;
    }
    player = new Player();
    resetGame();
    gameLoop(0);
}

function resetGame() {
    score = 0;
    health = 100;
    player.x = 100;
    player.y = canvas.height - 150;
    enemies = [];
    items = [];
    projectiles = [];
    bgOffset = 0;
    gameState = 'PLAYING';
    gameOverScreen.classList.add('hidden');
    // Initial Wave
    enemies.push(new Enemy(600));
    enemies.push(new Enemy(900));
    items.push(new Item(400, 'weed'));
}

function updateGame() {
    if (gameState !== 'PLAYING') return;

    player.update();
    enemies.forEach(e => e.update());
    items.forEach(i => i.update());
    projectiles.forEach(p => p.update());

    enemies = enemies.filter(e => e.active);
    items = items.filter(i => i.active);
    projectiles = projectiles.filter(p => p.active);

    if (health <= 0) {
        gameState = 'GAME_OVER';
        gameOverScreen.classList.remove('hidden');
    }

    healthBar.style.width = health + '%';
    scoreDisplay.innerText = 'Score: ' + score;
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Background (Scrolling)
    // We draw the image twice to fill the screen and loop
    if (assets.background.complete) {
        const bgW = canvas.width;  // Scale background to screen width for coverage
        const bgH = canvas.height;

        // Loop logic with Graffiti
        let x = bgOffset;
        while (x < canvas.width) {
            ctx.drawImage(assets.background, x, 0, bgW, bgH);

            // Draw Graffiti relative to this tile
            // Graffiti 1 (Text): Billboard style
            if (assets.graffiti1.complete) {
                const g1x = x + bgW * 0.15;
                const g1y = bgH * 0.45;
                const g1w = 140;
                const g1h = 80;

                // Billboard Frame
                ctx.fillStyle = '#3e2723'; // Dark Wood/Metal
                ctx.fillRect(g1x - 5, g1y - 5, g1w + 10, g1h + 10);
                ctx.fillStyle = '#ffffff'; // White backing
                ctx.fillRect(g1x, g1y, g1w, g1h);

                // Image
                ctx.drawImage(assets.graffiti1, g1x, g1y, g1w, g1h);
            }

            // Graffiti 2 (Art): Large vertical billboard
            if (assets.graffiti2.complete) {
                const g2x = x + bgW * 0.75;
                const g2y = bgH * 0.35;
                const g2w = 120;
                const g2h = 180;

                // Billboard Frame
                ctx.fillStyle = '#212121'; // Black Frame
                ctx.fillRect(g2x - 5, g2y - 5, g2w + 10, g2h + 10);

                // Image
                ctx.drawImage(assets.graffiti2, g2x, g2y, g2w, g2h);
            }

            x += bgW;
        }

        if (bgOffset > 0) {
            const leftX = bgOffset - bgW;
            ctx.drawImage(assets.background, leftX, 0, bgW, bgH);

            // Graffiti 1 (Text)
            if (assets.graffiti1.complete) {
                const g1x = leftX + bgW * 0.15;
                const g1y = bgH * 0.45;
                const g1w = 140;
                const g1h = 80;

                ctx.fillStyle = '#3e2723';
                ctx.fillRect(g1x - 5, g1y - 5, g1w + 10, g1h + 10);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(g1x, g1y, g1w, g1h);
                ctx.drawImage(assets.graffiti1, g1x, g1y, g1w, g1h);
            }

            // Graffiti 2 (Art)
            if (assets.graffiti2.complete) {
                const g2x = leftX + bgW * 0.75;
                const g2y = bgH * 0.35;
                const g2w = 120;
                const g2h = 180;

                ctx.fillStyle = '#212121';
                ctx.fillRect(g2x - 5, g2y - 5, g2w + 10, g2h + 10);
                ctx.drawImage(assets.graffiti2, g2x, g2y, g2w, g2h);
            }
        }

    } else {
        // Fallback
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Floor
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(0, canvas.height - FLOOR_HEIGHT, canvas.width, FLOOR_HEIGHT);
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(0, canvas.height - FLOOR_HEIGHT, canvas.width, 10);

    items.forEach(i => i.draw());
    enemies.forEach(e => e.draw());
    projectiles.forEach(p => p.draw());
    if (player) player.draw();
}

function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    if (gameState === 'PLAYING') {
        updateGame();
        drawGame();
    }

    requestAnimationFrame(gameLoop);
}

// Event Listeners
rotateScreen.addEventListener('click', () => {
    rotateScreen.style.display = 'none';
    gameContainer.style.display = 'block';
    if (gameState === 'START') {
        initGame();
    }
});
restartBtn.addEventListener('click', resetGame);

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

function bindTouch(btnId, key) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); keys[key] = true; });
    btn.addEventListener('mouseup', (e) => { e.preventDefault(); keys[key] = false; });
}
bindTouch('btn-left', 'left');
bindTouch('btn-right', 'right');
bindTouch('btn-jump', 'up');
bindTouch('btn-attack', 'attack');

window.addEventListener('keydown', e => {
    if (e.code === 'ArrowLeft') keys.left = true;
    if (e.code === 'ArrowRight') keys.right = true;
    if (e.code === 'ArrowUp' || e.code === 'Space') keys.up = true;
    if (e.code === 'KeyZ') keys.attack = true;
});

window.addEventListener('keyup', e => {
    if (e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'ArrowRight') keys.right = false;
    if (e.code === 'ArrowUp' || e.code === 'Space') keys.up = false;
    if (e.code === 'KeyZ') keys.attack = false;
});
