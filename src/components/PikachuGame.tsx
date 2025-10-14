import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import gengarSprite from "@/assets/gengar-sprite.png";
import charizardSprite from "@/assets/charizard-sprite.png";

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Spike extends GameObject {
  id: number;
}

interface FlyingObstacle extends GameObject {
  id: number;
  speed: number;
}

// Responsive game dimensions
const getGameDimensions = () => {
  const isMobile = window.innerWidth < 768;
  return {
    width: isMobile ? Math.min(window.innerWidth - 20, 400) : 800,
    height: isMobile ? 300 : 400
  };
};

const GAME_WIDTH = 800;
const GAME_HEIGHT = 400;
const GROUND_HEIGHT = 50;
const PLAYER_SIZE = 50;
const SPIKE_WIDTH = 25;
const SPIKE_HEIGHT = 30;
const JUMP_HEIGHT = 120;
const GAME_SPEED = 2.5;
const FLYING_OBSTACLE_SIZE = 35;
const FLYING_MODE_THRESHOLD = 1000;
const GENGAR_MODE_THRESHOLD = 5000;
const CHARIZARD_SIZE = 50;

export const PikachuGame = () => {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameOver'>('menu');
  const [score, setScore] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [gameWidth, setGameWidth] = useState(() => getGameDimensions().width);
  const [gameHeight, setGameHeight] = useState(() => getGameDimensions().height);
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);

  const [player, setPlayer] = useState<GameObject>({
    x: 100,
    y: GAME_HEIGHT - GROUND_HEIGHT - PLAYER_SIZE,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE
  });

  const [spikes, setSpikes] = useState<Spike[]>([]);
  const [flyingObstacles, setFlyingObstacles] = useState<FlyingObstacle[]>([]);
  const [isJumping, setIsJumping] = useState(false);
  const [jumpVelocity, setJumpVelocity] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(GAME_SPEED);
  const [keys, setKeys] = useState<{[key: string]: boolean}>({});
  const [isFlying, setIsFlying] = useState(false);
  const [flyingY, setFlyingY] = useState(0);
  const [isGengar, setIsGengar] = useState(false);
  const [gravityUp, setGravityUp] = useState(false);
  const [flyingModeChangedAt, setFlyingModeChangedAt] = useState<number | null>(null);
  const [gengarModeChangedAt, setGengarModeChangedAt] = useState<number | null>(null);

  const gameLoopRef = useRef<number>();
  const spikeIdCounter = useRef(0);
  const flyingObstacleIdCounter = useRef(0);

  const groundY = gameHeight - GROUND_HEIGHT;

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const dimensions = getGameDimensions();
      const newIsMobile = window.innerWidth < 768;
      setIsMobile(newIsMobile);
      setGameWidth(dimensions.width);
      setGameHeight(dimensions.height);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Touch controls
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const minSwipeDistance = 30;

    // Detect tap (short swipe distance)
    if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) {
      jump();
    } else if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      if (deltaX > minSwipeDistance) {
        setKeys(prev => ({ ...prev, ArrowRight: true }));
        setTimeout(() => setKeys(prev => ({ ...prev, ArrowRight: false })), 150);
      } else if (deltaX < -minSwipeDistance) {
        setKeys(prev => ({ ...prev, ArrowLeft: true }));
        setTimeout(() => setKeys(prev => ({ ...prev, ArrowLeft: false })), 150);
      }
    } else {
      // Vertical swipe (flying mode)
      if (isFlying) {
        if (deltaY < -minSwipeDistance) {
          setKeys(prev => ({ ...prev, ArrowUp: true }));
          setTimeout(() => setKeys(prev => ({ ...prev, ArrowUp: false })), 150);
        } else if (deltaY > minSwipeDistance) {
          setKeys(prev => ({ ...prev, ArrowDown: true }));
          setTimeout(() => setKeys(prev => ({ ...prev, ArrowDown: false })), 150);
        }
      }
    }

    setTouchStart(null);
  };

  const resetGame = useCallback(() => {
    setPlayer({
      x: 50,
      y: groundY - PLAYER_SIZE,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE
    });
    setSpikes([]);
    setFlyingObstacles([]);
    setScore(0);
    setIsJumping(false);
    setJumpVelocity(0);
    setCurrentSpeed(GAME_SPEED);
    setIsFlying(false);
    setFlyingY(0);
    setIsGengar(false);
    setGravityUp(false);
    setFlyingModeChangedAt(null);
    setGengarModeChangedAt(null);
    spikeIdCounter.current = 0;
    flyingObstacleIdCounter.current = 0;
  }, [groundY]);

  const startGame = () => {
    resetGame();
    setGameState('playing');
  };


  const jump = useCallback(() => {
    if (gameState === 'playing') {
      if (isGengar) {
        // In Gengar mode, clicking switches gravity
        setGravityUp(prev => !prev);
      } else if (isFlying) {
        // In flying mode, allow gravity switching
        setGravityUp(prev => !prev);
      } else if (!isJumping) {
        // Normal jump mode
        setIsJumping(true);
        setJumpVelocity(-15);
      } else {
        // Allow gravity switching while jumping
        setJumpVelocity(prev => prev > 0 ? -15 : prev);
      }
    }
  }, [isJumping, gameState, isFlying, isGengar]);

  const checkCollision = (rect1: GameObject, rect2: GameObject) => {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  };

  // Check if flying mode should be activated
  useEffect(() => {
    if (score >= FLYING_MODE_THRESHOLD && !isFlying && !isGengar) {
      setIsFlying(true);
      setFlyingModeChangedAt(Date.now());
      setFlyingY(groundY - 150);
      setPlayer(prev => ({
        ...prev,
        y: groundY - 150,
        width: CHARIZARD_SIZE,
        height: CHARIZARD_SIZE
      }));
    }
  }, [score, isFlying, groundY, isGengar]);

  // Check if Gengar mode should be activated
  useEffect(() => {
    if (score >= GENGAR_MODE_THRESHOLD && !isGengar) {
      setIsGengar(true);
      setGengarModeChangedAt(Date.now());
      setIsFlying(false);
      setFlyingModeChangedAt(null); // Clear flying mode grace period
      setFlyingY(0);
      setPlayer(prev => ({
        ...prev,
        y: groundY - (PLAYER_SIZE - 14),
        width: PLAYER_SIZE - 14,
        height: PLAYER_SIZE - 14
      }));
    }
  }, [score, isGengar, groundY]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const gameLoop = () => {
      setPlayer(prevPlayer => {
        let newY = prevPlayer.y;
        let newX = prevPlayer.x;
        let newJumpVelocity = jumpVelocity;

        // Handle horizontal movement
        if (keys['ArrowLeft'] || keys['KeyA']) {
          newX = Math.max(0, newX - 6);
        }
        if (keys['ArrowRight'] || keys['KeyD']) {
          newX = Math.min(gameWidth - (isFlying ? CHARIZARD_SIZE : isGengar ? PLAYER_SIZE - 14 : PLAYER_SIZE), newX + 6);
        }

        if (isFlying) {
          // Flying mode controls
          if (keys['ArrowUp'] || keys['KeyW']) {
            newY = Math.max(50, newY - 4);
          }
          if (keys['ArrowDown'] || keys['KeyS']) {
            newY = Math.min(groundY - CHARIZARD_SIZE, newY + 4);
          }
          setFlyingY(newY);
        } else if (isGengar) {
          // Gengar mode - moves between ground and ceiling with gravity switching
          if (gravityUp) {
            newY = Math.max(newY - 4, 50); // Move up faster to ceiling
          } else {
            newY = Math.min(newY + 4, groundY - (PLAYER_SIZE - 14)); // Move down faster to ground
          }
        } else if (isJumping) {
          newY += newJumpVelocity;
          newJumpVelocity += 0.5; // gravity

          if (newY >= groundY - PLAYER_SIZE) {
            newY = groundY - PLAYER_SIZE;
            setIsJumping(false);
            setJumpVelocity(0);
          } else {
            setJumpVelocity(newJumpVelocity);
          }
        }

        return { ...prevPlayer, y: newY, x: newX };
      });

      // Move spikes and check collisions
      setSpikes(prevSpikes => {
        const newSpikes = prevSpikes
          .map(spike => ({ ...spike, x: spike.x - currentSpeed }))
          .filter(spike => spike.x + spike.width > 0);

        // Check collisions with player
        const collision = newSpikes.some(spike => checkCollision(player, spike));
        if (collision) {
          setGameState('gameOver');
        }

        return newSpikes;
      });

      // Move flying obstacles and check collisions
      setFlyingObstacles(prevObstacles => {
        const newObstacles = prevObstacles
          .map(obstacle => ({ ...obstacle, x: obstacle.x - obstacle.speed }))
          .filter(obstacle => obstacle.x + obstacle.width > 0);

        // Check collisions with player
        const collision = newObstacles.some(obstacle => checkCollision(player, obstacle));
        if (collision) {
          setGameState('gameOver');
        }

        return newObstacles;
      });

      // Add new spikes (more frequent in flying mode)
      setSpikes(prevSpikes => {
        const lastSpike = prevSpikes[prevSpikes.length - 1];
        const spikeDistance = isFlying ? 200 : 350;

        // Check grace periods
        const isInFlyingGracePeriod = flyingModeChangedAt && (Date.now() - flyingModeChangedAt) < 2000 && isFlying;
        const isInGengarGracePeriod = gengarModeChangedAt && (Date.now() - gengarModeChangedAt) < 5000 && isGengar;

        if (!isInFlyingGracePeriod && !isInGengarGracePeriod && (!lastSpike || lastSpike.x < gameWidth - spikeDistance)) {
          const spikes = [];

          // Ground spikes
          spikes.push({
            id: spikeIdCounter.current++,
            x: gameWidth,
            y: groundY - SPIKE_HEIGHT,
            width: SPIKE_WIDTH,
            height: SPIKE_HEIGHT
          });

          // In flying mode, add ceiling spikes
          if (isFlying && Math.random() < 0.6) {
            spikes.push({
              id: spikeIdCounter.current++,
              x: gameWidth + (Math.random() * 100),
              y: 0,
              width: SPIKE_WIDTH,
              height: SPIKE_HEIGHT * 2
            });
          }

          return [...prevSpikes, ...spikes];
        }
        return prevSpikes;
      });

      // Add new flying obstacles (more in flying mode and even more in Gengar mode)
      setFlyingObstacles(prevObstacles => {
        const lastObstacle = prevObstacles[prevObstacles.length - 1];
        const obstacleDistance = isGengar ? 150 : (isFlying ? 250 : 400);

        // Check grace periods
        const isInFlyingGracePeriod = flyingModeChangedAt && (Date.now() - flyingModeChangedAt) < 2000 && isFlying;
        const isInGengarGracePeriod = gengarModeChangedAt && (Date.now() - gengarModeChangedAt) < 5000 && isGengar;

        if (!isInFlyingGracePeriod && !isInGengarGracePeriod && (!lastObstacle || lastObstacle.x < gameWidth - obstacleDistance)) {
          const obstacles = [];

          if (isGengar) {
            // Gengar mode - many obstacles at different heights
            const heights = [50, 100, 150, 200, 250, groundY - 80, groundY - 120, groundY - 160, groundY - 200];
            const numObstacles = Math.random() < 0.8 ? 3 : 2;

            for (let i = 0; i < numObstacles; i++) {
              const randomHeight = heights[Math.floor(Math.random() * heights.length)];
              obstacles.push({
                id: flyingObstacleIdCounter.current++,
                x: gameWidth + (i * 60),
                y: randomHeight,
                width: FLYING_OBSTACLE_SIZE - 10,
                height: FLYING_OBSTACLE_SIZE - 10,
                speed: currentSpeed + Math.random() * 2.5
              });
            }
          } else if (isFlying) {
            // Multiple height levels in flying mode
            const heights = [50, 120, 200, groundY - 80, groundY - 120, groundY - 160];
            const numObstacles = Math.random() < 0.7 ? 2 : 1;

            for (let i = 0; i < numObstacles; i++) {
              const randomHeight = heights[Math.floor(Math.random() * heights.length)];
              obstacles.push({
                id: flyingObstacleIdCounter.current++,
                x: gameWidth + (i * 80),
                y: randomHeight,
                width: FLYING_OBSTACLE_SIZE,
                height: FLYING_OBSTACLE_SIZE,
                speed: currentSpeed + Math.random() * 2
              });
            }
          } else {
            const heights = [groundY - 80, groundY - 120, groundY - 160];
            const randomHeight = heights[Math.floor(Math.random() * heights.length)];
            obstacles.push({
              id: flyingObstacleIdCounter.current++,
              x: gameWidth,
              y: randomHeight,
              width: FLYING_OBSTACLE_SIZE,
              height: FLYING_OBSTACLE_SIZE,
              speed: currentSpeed + Math.random() * 1.5
            });
          }

          return [...prevObstacles, ...obstacles];
        }
        return prevObstacles;
      });

      // Increase speed over time
      setCurrentSpeed(prevSpeed => Math.min(prevSpeed + 0.001, 5));

      // Update score (pause during grace periods)
      const isInFlyingGracePeriod = flyingModeChangedAt && (Date.now() - flyingModeChangedAt) < 2000 && isFlying;
      const isInGengarGracePeriod = gengarModeChangedAt && (Date.now() - gengarModeChangedAt) < 5000 && isGengar;
      if (!isInFlyingGracePeriod && !isInGengarGracePeriod) {
        setScore(prevScore => prevScore + 3);
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, isJumping, jumpVelocity, player, score, groundY, currentSpeed, flyingObstacles, keys, isFlying, isGengar, gravityUp]);

  // Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        if (gameState === 'playing') {
          setGameState('paused');
        } else if (gameState === 'paused') {
          setGameState('playing');
        }
        return;
      }

      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
      if (gameState === 'playing') {
        setKeys(prev => ({ ...prev, [e.code]: true }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.code]: false }));
    };

    const handleClick = () => {
      jump();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('click', handleClick);
    };
  }, [jump, gameState]);

  if (gameState === 'menu') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-electric bg-grid">
        <div className="text-center space-y-8">
          <h1 className="game-title">PIKACHU DASH</h1>
          <div className="text-cyber text-lg">Avoid the spikes and flying obstacles!</div>
          <div className="space-y-4">
            <Button
              onClick={startGame}
              className="bg-neon-green text-black border-neon font-bold px-8 py-4 text-lg hover:bg-neon-green/80"
            >
              START GAME
            </Button>
            <div className="text-muted-foreground">
              <div className="text-sm mt-2">Press SPACE or click to jump</div>
              <div className="text-xs mt-1 text-fire">Reach 1000 for FLYING MODE!</div>
              <div className="text-xs mt-1 text-destructive">Reach 5000 for GENGAR MODE!</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center min-h-screen ${isFlying ? 'bg-fire bg-fire-grid' : 'bg-electric bg-grid'}`}>
      <div className="mb-4 flex gap-8 text-center">
        <div className="text-cyber">
          <div className="text-2xl font-bold">{score}</div>
          <div className="text-sm">SCORE</div>
          {isFlying && <div className="text-xs text-neon animate-pulse">FLYING MODE!</div>}
          {isGengar && <div className="text-xs text-destructive animate-pulse">GENGAR MODE!</div>}
        </div>
      </div>

      <div
        className="relative overflow-hidden"
        style={{ width: gameWidth, height: gameHeight }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Mobile Pause Button */}
        {isMobile && (gameState === 'playing' || gameState === 'paused') && (
          <Button
            onClick={() => setGameState(gameState === 'playing' ? 'paused' : 'playing')}
            className="absolute top-2 right-2 z-10 bg-neon/20 border border-neon text-cyber px-3 py-1 text-sm hover:bg-neon/30"
          >
            {gameState === 'playing' ? '⏸️' : '▶️'}
          </Button>
        )}

        {/* Ground */}
        <div
          className="absolute bottom-0 w-full bg-neon-green/20 border-t border-neon-green"
          style={{ height: GROUND_HEIGHT }}
        />

        {/* Player (Pikachu or Charizard) */}
        <div
          className={`absolute transition-none bg-transparent ${isJumping ? 'animate-float' : ''} ${isFlying ? 'animate-bounce' : ''}`}
          style={{
            left: player.x,
            bottom: gameHeight - player.y - player.height,
            width: player.width,
            height: player.height,
          }}
        >
          {isFlying ? (
            <div className="relative">
              <img
                src={charizardSprite}
                alt="Charizard"
                className="w-full h-full object-contain animate-pulse-neon bg-transparent"
              />
              <img
                src="/lovable-uploads/2c373f45-ab6b-45ba-a70a-8609e02d54cd.png"
                alt="Pikachu"
                className="absolute top-2 left-1/2 transform -translate-x-1/2 w-6 h-6 object-contain"
              />
            </div>
          ) : isGengar ? (
            <img
              src={gengarSprite}
              alt="Gengar"
              className="w-full h-full object-contain animate-pulse-neon bg-transparent"
            />
          ) : (
            <img
              src="/lovable-uploads/2c373f45-ab6b-45ba-a70a-8609e02d54cd.png"
              alt="Pikachu"
              className="w-full h-full object-contain animate-pulse-neon bg-transparent"
            />
          )}
        </div>

        {/* Spikes */}
        {spikes.map(spike => (
          <div
            key={spike.id}
            className="absolute bg-destructive"
            style={{
              left: spike.x,
              bottom: gameHeight - spike.y - spike.height,
              width: spike.width,
              height: spike.height,
              clipPath: spike.y === 0 ? 'polygon(50% 100%, 0% 0%, 100% 0%)' : 'polygon(50% 0%, 0% 100%, 100% 100%)',
            }}
          />
        ))}

        {/* Flying Obstacles */}
        {flyingObstacles.map(obstacle => (
          <div
            key={obstacle.id}
            className="absolute"
            style={{
              left: obstacle.x,
              bottom: gameHeight - obstacle.y - obstacle.height,
              width: obstacle.width,
              height: obstacle.height,
            }}
          >
            <img
              src={gengarSprite}
              alt="Gengar"
              className="w-full h-full object-contain animate-pulse bg-transparent"
            />
          </div>
        ))}

        {gameState === 'paused' && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="text-center space-y-4">
              <h2 className="text-neon text-3xl font-bold">PAUSED</h2>
              <div className="text-cyber text-lg">Score: {score}</div>
              <Button
                onClick={() => setGameState('playing')}
                className="bg-neon-green text-black border-neon font-bold px-6 py-3 hover:bg-neon-green/80"
              >
                RESUME
              </Button>
              <div className="text-muted-foreground text-sm">Press ESC to resume</div>
            </div>
          </div>
        )}

        {gameState === 'gameOver' && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="text-center space-y-4">
              <h2 className="text-destructive text-3xl font-bold">GAME OVER</h2>
              <div className="text-cyber text-xl">Final Score: {score}</div>
              <Button
                onClick={startGame}
                className="bg-neon-green text-black border-neon font-bold px-6 py-3 hover:bg-neon-green/80"
              >
                PLAY AGAIN
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-muted-foreground text-center">
        <div>
          {isMobile ? (
            isGengar ? "Tap the screen to switch gravity (Gengar floats up/down)" : (isFlying ? "Tap the screen or use buttons to fly up/down/left/right" : "Tap the screen or use buttons to jump and move")
          ) : (
            isGengar ? "Click anywhere or press SPACE to switch gravity (Gengar floats up/down)" : (isFlying ? "Use ARROW KEYS or WASD to fly up/down/left/right" : "Press SPACE or click anywhere to jump")
          )}
        </div>
      </div>

      {/* Mobile Control Buttons */}
      {isMobile && gameState === 'playing' && (
        <div className="mt-4 flex flex-col items-center gap-3">
          {isFlying && (
            <div className="flex gap-4">
              <Button
                onTouchStart={() => setKeys(prev => ({ ...prev, ArrowUp: true }))}
                onTouchEnd={() => setKeys(prev => ({ ...prev, ArrowUp: false }))}
                className="bg-neon/20 border border-neon text-cyber px-4 py-2 text-sm"
              >
                ↑
              </Button>
              <Button
                onTouchStart={() => setKeys(prev => ({ ...prev, ArrowDown: true }))}
                onTouchEnd={() => setKeys(prev => ({ ...prev, ArrowDown: false }))}
                className="bg-neon/20 border border-neon text-cyber px-4 py-2 text-sm"
              >
                ↓
              </Button>
            </div>
          )}
          <div className="flex gap-4">
            <Button
              onTouchStart={() => setKeys(prev => ({ ...prev, ArrowLeft: true }))}
              onTouchEnd={() => setKeys(prev => ({ ...prev, ArrowLeft: false }))}
              className="bg-neon/20 border border-neon text-cyber px-4 py-2 text-sm"
            >
              ←
            </Button>
            {!isFlying && (
              <Button
                onTouchStart={jump}
                className="bg-neon-green text-black border-neon font-bold px-6 py-2 text-sm"
              >
                JUMP
              </Button>
            )}
            <Button
              onTouchStart={() => setKeys(prev => ({ ...prev, ArrowRight: true }))}
              onTouchEnd={() => setKeys(prev => ({ ...prev, ArrowRight: false }))}
              className="bg-neon/20 border border-neon text-cyber px-4 py-2 text-sm"
            >
              →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
