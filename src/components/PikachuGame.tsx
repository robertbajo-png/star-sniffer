import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import pikachuSprite from "@/assets/pikachu.png";
import gengarSprite from "@/assets/gengar-sprite.png";
import charizardSprite from "@/assets/charizard-sprite.png";
import capybaraSprite from "@/assets/capybara.svg";

type GameState = "menu" | "playing" | "gameOver";
type Ability = "doubleJump" | "glide" | "phase" | "chill";

interface Dimensions {
  width: number;
  height: number;
}

interface GameMode {
  id: string;
  name: string;
  tagline: string;
  sprite: string;
  background: string;
  groundColor: string;
  accent: string;
  accentSoft: string;
  ability: Ability;
  abilityLabel: string;
  abilityDescription: string;
  speed: number;
  speedRamp: number;
  gravity: number;
  jumpVelocity: number;
  spawnIntervalRange: [number, number];
  obstacleHeight: [number, number];
  hitboxPadding?: number;
  difficulty: string;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Obstacle extends Rect {
  id: number;
}

interface Player extends Rect {
  velocityY: number;
  jumpsUsed: number;
}

const PLAYER_SIZE = 56;
const GROUND_HEIGHT = 56;

const computeDimensions = (): Dimensions => {
  if (typeof window === "undefined") {
    return { width: 640, height: 360 };
  }

  const isNarrow = window.innerWidth < 1024;
  const padding = isNarrow ? 28 : 80;
  const maxWidth = isNarrow ? 720 : 900;
  const width = Math.max(320, Math.min(window.innerWidth - padding, maxWidth));
  const height = Math.max(
    260,
    Math.min(Math.round(width * (isNarrow ? 0.6 : 0.55)), isNarrow ? 340 : 420)
  );

  return { width, height };
};

const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min;
const rollSpawnDelay = (entry: GameMode) =>
  randomBetween(entry.spawnIntervalRange[0], entry.spawnIntervalRange[1]);

const boxesIntersect = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.height + a.y > b.y;

const GAME_MODES: GameMode[] = [
  {
    id: "pikachu",
    name: "Pikachu Dash",
    tagline: "Spark-powered sprints through a pastel skyline.",
    sprite: pikachuSprite,
    background: "linear-gradient(160deg, #fef3c7 0%, #bfdbfe 55%, #c4b5fd 100%)",
    groundColor: "linear-gradient(90deg, rgba(30,64,175,0.75) 0%, rgba(14,116,144,0.75) 100%)",
    accent: "#facc15",
    accentSoft: "rgba(250, 204, 21, 0.35)",
    ability: "doubleJump",
    abilityLabel: "Double Jump",
    abilityDescription: "Tap jump twice to keep Pikachu airborne for longer streaks.",
    speed: 3.6,
    speedRamp: 0.032,
    gravity: 0.78,
    jumpVelocity: 11,
    spawnIntervalRange: [1300, 1700],
    obstacleHeight: [48, 78],
    difficulty: "Balanced"
  },
  {
    id: "charizard",
    name: "Charizard Glide",
    tagline: "Skim the lava horizon with fiery finesse.",
    sprite: charizardSprite,
    background: "linear-gradient(160deg, #fee2e2 0%, #fecaca 42%, #fef9c3 100%)",
    groundColor: "linear-gradient(90deg, rgba(124,45,18,0.82) 0%, rgba(185,28,28,0.82) 100%)",
    accent: "#f97316",
    accentSoft: "rgba(249, 115, 22, 0.32)",
    ability: "glide",
    abilityLabel: "Gentle Glide",
    abilityDescription: "Hold the jump key in mid-air to glide through volcanic thermals.",
    speed: 4.2,
    speedRamp: 0.038,
    gravity: 0.62,
    jumpVelocity: 10.5,
    spawnIntervalRange: [1125, 1500],
    obstacleHeight: [52, 88],
    difficulty: "Spicy"
  },
  {
    id: "gengar",
    name: "Gengar Phase",
    tagline: "Dance between shadows with spectral precision.",
    sprite: gengarSprite,
    background: "linear-gradient(170deg, #ede9fe 0%, #c4b5fd 45%, #a5b4fc 100%)",
    groundColor: "linear-gradient(90deg, rgba(76,29,149,0.82) 0%, rgba(109,40,217,0.82) 100%)",
    accent: "#8b5cf6",
    accentSoft: "rgba(139, 92, 246, 0.32)",
    ability: "phase",
    abilityLabel: "Shadow Slip",
    abilityDescription: "A slimmer hitbox lets this ghost slip through tight gaps.",
    speed: 3.4,
    speedRamp: 0.028,
    gravity: 0.74,
    jumpVelocity: 10.8,
    spawnIntervalRange: [1050, 1380],
    obstacleHeight: [56, 96],
    hitboxPadding: 6,
    difficulty: "Tricky"
  },
  {
    id: "capybara",
    name: "Capybara Cruise",
    tagline: "A cozy riverbank jog for the chillest companion.",
    sprite: capybaraSprite,
    background: "linear-gradient(170deg, #dcfce7 0%, #bbf7d0 45%, #bfdbfe 100%)",
    groundColor: "linear-gradient(90deg, rgba(20,83,45,0.78) 0%, rgba(4,120,87,0.78) 100%)",
    accent: "#34d399",
    accentSoft: "rgba(52, 211, 153, 0.32)",
    ability: "chill",
    abilityLabel: "Relaxed Pace",
    abilityDescription: "Everything moves a touch slower around this serene friend.",
    speed: 3,
    speedRamp: 0.018,
    gravity: 0.7,
    jumpVelocity: 10.5,
    spawnIntervalRange: [1500, 1900],
    obstacleHeight: [44, 72],
    difficulty: "Calm"
  }
];

const abilityControlHints: Record<Ability, string> = {
  doubleJump: "Press jump twice to trigger the second boost.",
  glide: "Hold the jump key while falling to glide forward.",
  phase: "A slimmer hitbox means you can brush past spikes.",
  chill: "Lean back—everything cruises at a gentler tempo."
};

const abilityMilestoneHints: Record<Ability, string[]> = {
  doubleJump: [
    "Delay the second hop to stretch over taller stacks.",
    "Feather quick taps to maintain aerial rhythm.",
    "Every 20 seconds the pace rises—stay light on your feet."
  ],
  glide: [
    "Hold the key just after lift-off to skim hazards.",
    "Short glides reset faster—pulse the button between obstacles.",
    "Ride thermals low to prep for the next updraft."
  ],
  phase: [
    "Line up with gaps early so the slim form can squeeze through.",
    "Brush near pillars to keep combos alive—trust the shadow slip.",
    "Watch the purple glow; it grows as the realm quickens."
  ],
  chill: [
    "Your calm aura slows the world—breathe between jumps.",
    "Use the extra beat to plan double obstacle clears.",
    "Stacks grow taller later—keep the tempo cozy."
  ]
};

export const PikachuGame = () => {
  const [modeId, setModeId] = useState<GameMode["id"]>(GAME_MODES[0].id);
  const mode = useMemo(
    () => GAME_MODES.find((entry) => entry.id === modeId) ?? GAME_MODES[0],
    [modeId]
  );

  const [dimensions, setDimensions] = useState<Dimensions>(() => computeDimensions());
  const groundLevel = dimensions.height - GROUND_HEIGHT;

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [gameState, setGameState] = useState<GameState>("menu");
  const [score, setScore] = useState(0);
  const [bestScores, setBestScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(GAME_MODES.map((entry) => [entry.id, 0]))
  );
  const [modeHint, setModeHint] = useState(mode.abilityDescription);
  const [abilityBanner, setAbilityBanner] = useState(abilityControlHints[mode.ability]);
  const [progression, setProgression] = useState(0);

  const playerRef = useRef<Player>({
    x: 80,
    y: groundLevel - PLAYER_SIZE,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    velocityY: 0,
    jumpsUsed: 0
  });

  const obstaclesRef = useRef<Obstacle[]>([]);
  const nextObstacleId = useRef(0);
  const scoreRef = useRef(0);
  const keysRef = useRef<Record<string, boolean>>({});
  const abilityMessageRef = useRef(abilityControlHints[mode.ability]);
  const milestoneRef = useRef(0);
  const elapsedRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const [, setRenderTick] = useState(0);

  const updateAbilityBanner = useCallback((message: string) => {
    if (abilityMessageRef.current === message) return;
    abilityMessageRef.current = message;
    setAbilityBanner(message);
  }, []);

  useEffect(() => {
    abilityMessageRef.current = abilityControlHints[mode.ability];
    setAbilityBanner(abilityControlHints[mode.ability]);
    setModeHint(mode.abilityDescription);
  }, [mode]);

  const sparkles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, index) => ({
        id: index,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 18 + 8,
        opacity: Math.random() * 0.25 + 0.15
      })),
    []
  );

  const prepareScene = useCallback(() => {
    const startingX = Math.min(120, dimensions.width * 0.2);
    playerRef.current = {
      x: startingX,
      y: groundLevel - PLAYER_SIZE,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
      velocityY: 0,
      jumpsUsed: 0
    };

    obstaclesRef.current = [];
    nextObstacleId.current = 0;
    scoreRef.current = 0;
    milestoneRef.current = 0;
    elapsedRef.current = 0;
    spawnTimerRef.current = rollSpawnDelay(mode);
    setScore(0);
    setModeHint(mode.abilityDescription);
    const introMessage = abilityControlHints[mode.ability];
    abilityMessageRef.current = introMessage;
    setAbilityBanner(introMessage);
    setProgression(0);
    setRenderTick((tick) => tick + 1);
  }, [dimensions.width, groundLevel, mode]);

  const startGame = useCallback(() => {
    prepareScene();
    setGameState("playing");
  }, [prepareScene]);

  const endGame = useCallback(() => {
    setGameState("gameOver");
    const currentScore = Math.floor(scoreRef.current);
    setBestScores((prev) => {
      const best = prev[mode.id] ?? 0;
      if (currentScore > best) {
        return { ...prev, [mode.id]: currentScore };
      }
      return prev;
    });
  }, [mode.id]);

  const jump = useCallback(() => {
    if (gameState !== "playing") return;

    const player = playerRef.current;
    const maxJumps = mode.ability === "doubleJump" ? 2 : 1;

    if (player.jumpsUsed >= maxJumps) return;

    player.velocityY = -mode.jumpVelocity;
    player.y -= 1;
    player.jumpsUsed += 1;
    setRenderTick((tick) => tick + 1);
  }, [gameState, mode.ability, mode.jumpVelocity]);

  const handlePointerDown = useCallback(() => {
    if (gameState !== "playing") {
      startGame();
      requestAnimationFrame(() => {
        jump();
      });
      return;
    }
    jump();
  }, [gameState, jump, startGame]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      keysRef.current[event.code] = true;

      if (["Space", "ArrowUp", "KeyW"].includes(event.code)) {
        event.preventDefault();
        if (gameState !== "playing") {
          startGame();
          requestAnimationFrame(() => {
            jump();
          });
        } else {
          jump();
        }
      }

      if (event.code === "KeyR" && gameState === "gameOver") {
        startGame();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      keysRef.current[event.code] = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [gameState, jump, startGame]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(media.matches);

    updatePreference();
    media.addEventListener("change", updatePreference);

    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setDimensions(computeDimensions());
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    prepareScene();
    setGameState("menu");
  }, [prepareScene]);

  useEffect(() => {
    if (gameState !== "playing") return;

    let animationFrame: number;
    let lastTime = performance.now();

    const step = (time: number) => {
      const deltaRaw = Math.min(32, time - lastTime);
      const delta = prefersReducedMotion ? Math.min(20, deltaRaw) : deltaRaw;
      lastTime = time;

      const player = playerRef.current;
      const isHoldingJump =
        keysRef.current["Space"] || keysRef.current["ArrowUp"] || keysRef.current["KeyW"];
      const gravityModifier = mode.ability === "glide" && isHoldingJump ? 0.45 : 1;
      const gravity = mode.gravity * gravityModifier;

      elapsedRef.current += delta;
      spawnTimerRef.current -= delta;

      player.velocityY += gravity * (delta / 16.67);
      player.y += player.velocityY * (delta / 16.67);

      const floorY = groundLevel - PLAYER_SIZE;

      if (player.y > floorY) {
        player.y = floorY;
        player.velocityY = 0;
        player.jumpsUsed = 0;
      }

      if (player.y < 0) {
        player.y = 0;
        player.velocityY = 0;
      }

      const rampBase = 1 + (elapsedRef.current / 1000) * mode.speedRamp;
      const rampMultiplier = Math.min(
        1.75,
        prefersReducedMotion ? 1 + (rampBase - 1) * 0.6 : rampBase
      );
      const progressValue = Math.min(1, Math.max(0, (rampMultiplier - 1) / 0.75));
      setProgression((prev) => (Math.abs(prev - progressValue) > 0.02 ? progressValue : prev));

      const speedModifier = mode.ability === "chill" ? 0.8 : 1;
      const distance = mode.speed * speedModifier * rampMultiplier * (delta / 16.67);

      const movedObstacles = obstaclesRef.current
        .map((obstacle) => ({ ...obstacle, x: obstacle.x - distance }))
        .filter((obstacle) => obstacle.x + obstacle.width > -40);

      obstaclesRef.current = movedObstacles;

      if (spawnTimerRef.current <= 0) {
        const clusterChance = mode.ability === "phase" ? 0.45 : 0.32;
        const clusterCount = Math.random() < clusterChance ? 2 : 1;
        const spawnBase = dimensions.width + 48;
        const newObstacles: Obstacle[] = [];
        let offset = 0;

        for (let index = 0; index < clusterCount; index += 1) {
          const height = randomBetween(mode.obstacleHeight[0], mode.obstacleHeight[1]);
          const width = randomBetween(clusterCount > 1 ? 30 : 34, clusterCount > 1 ? 56 : 72);

          newObstacles.push({
            id: nextObstacleId.current++,
            x: spawnBase + offset,
            y: groundLevel - height,
            width,
            height
          });

          offset += width + randomBetween(54, 84);
        }

        obstaclesRef.current = [...obstaclesRef.current, ...newObstacles];
        const recoveryDelay = clusterCount > 1 ? randomBetween(220, 340) : 0;
        spawnTimerRef.current = rollSpawnDelay(mode) + recoveryDelay;
      }

      const padding = mode.hitboxPadding ?? 0;
      const playerBox: Rect = {
        x: player.x + padding,
        y: player.y + padding,
        width: player.width - padding * 2,
        height: player.height - padding * 2
      };

      const collided = obstaclesRef.current.some((obstacle) => boxesIntersect(playerBox, obstacle));

      if (collided) {
        endGame();
        return;
      }

      scoreRef.current += delta * 0.015 * mode.speed * rampMultiplier;
      const roundedScore = Math.floor(scoreRef.current);
      setScore((prev) => (prev === roundedScore ? prev : roundedScore));

      const milestoneThresholds = [24, 60, 110];
      const nextMilestone = milestoneRef.current;
      if (nextMilestone < milestoneThresholds.length && scoreRef.current >= milestoneThresholds[nextMilestone]) {
        const hints = abilityMilestoneHints[mode.ability];
        const hint = hints[Math.min(nextMilestone, hints.length - 1)] ?? mode.abilityDescription;
        setModeHint(hint);
        milestoneRef.current += 1;
      }

      if (mode.ability === "doubleJump") {
        const maxJumps = 2;
        if (player.jumpsUsed >= maxJumps) {
          updateAbilityBanner("Touch down to recharge your double jump.");
        } else if (player.jumpsUsed === 0) {
          updateAbilityBanner("Double jump primed! Time the second boost late.");
        } else {
          updateAbilityBanner("Second jump ready—clear that tall stack.");
        }
      } else if (mode.ability === "glide") {
        const gliding = isHoldingJump && player.velocityY > 0;
        updateAbilityBanner(
          gliding
            ? "Gliding—ease the press to descend."
            : "Hold jump mid-air to ride the thermals."
        );
      } else if (mode.ability === "phase") {
        const nearby = obstaclesRef.current.some(
          (obstacle) => obstacle.x - player.x < 140 && obstacle.x + obstacle.width > player.x
        );
        updateAbilityBanner(
          nearby
            ? "Thread the gap—your shadow form is slim."
            : "Line up early for the next slip-through."
        );
      } else if (mode.ability === "chill") {
        updateAbilityBanner(
          rampMultiplier > 1.25
            ? "The world stirs—keep the calm cadence."
            : "Everything moves softer—plan your leaps."
        );
      }

      setRenderTick((tick) => tick + 1);
      animationFrame = requestAnimationFrame(step);
    };

    animationFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrame);
  }, [dimensions.width, endGame, gameState, groundLevel, mode, prefersReducedMotion, updateAbilityBanner]);

  const currentBest = bestScores[mode.id] ?? 0;
  const player = playerRef.current;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: mode.background }} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.2),_transparent_65%)] mix-blend-screen" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 py-14 text-white lg:gap-12 lg:py-16">
        <header className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.45em] text-white/60">
              Pocket Trails
            </span>
            <h1 className="text-4xl font-semibold sm:text-5xl">Cozy Critter Dash</h1>
            <p className="max-w-2xl text-base text-white/70 sm:text-lg">
              Pick a companion, learn their signature trick, and dash through painterly horizons while racking up the longest streaks.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.32em] text-white/70">
            <span className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: mode.accent }} />
              {mode.name}
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 font-semibold text-white">
              Score {score.toString().padStart(3, "0")}
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5">
              Best {currentBest.toString().padStart(3, "0")}
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5">
              {mode.difficulty}
            </span>
          </div>
        </header>

        <nav className="flex flex-wrap gap-3">
          {GAME_MODES.map((entry) => {
            const selected = entry.id === mode.id;
            return (
              <button
                key={entry.id}
                onClick={() => setModeId(entry.id)}
                className={cn(
                  "group flex items-center gap-3 rounded-full border px-4 py-2 text-left text-sm font-semibold transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                  selected
                    ? "border-transparent bg-white text-slate-900 shadow-[0_25px_55px_-35px_rgba(15,23,42,0.9)]"
                    : "border-white/15 bg-white/10 text-white/70 hover:border-white/30 hover:bg-white/20"
                )}
                style={
                  selected
                    ? {
                        boxShadow: `0 25px 65px -35px ${entry.accent}`
                      }
                    : undefined
                }
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-slate-900 shadow-inner">
                  <img src={entry.sprite} alt="" className="h-7 w-7 object-contain" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold leading-tight">{entry.name}</span>
                  <span className="text-[11px] uppercase tracking-[0.3em] text-white/60 group-hover:text-white/80">
                    {entry.abilityLabel}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.75fr)]">
          <section className="rounded-3xl border border-white/15 bg-slate-950/60 p-6 shadow-[0_45px_140px_-70px_rgba(15,23,42,0.95)] backdrop-blur-xl">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.38em] text-white/60">Arena</span>
                <h2 className="text-2xl font-semibold text-white">{mode.tagline}</h2>
                <p className="text-sm text-white/70">
                  Balance timing, rhythm, and your ability to chase new distances. Tap the arena or press jump to get airborne.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-white/60">
                <span className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 font-semibold text-white">
                  {mode.abilityLabel}
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 font-medium text-white/80">
                  {abilityControlHints[mode.ability]}
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 font-medium text-white/80">
                  Best {currentBest.toString().padStart(3, "0")}
                </span>
              </div>

              <div className="flex w-full justify-center">
                <div
                  className="relative isolate flex cursor-pointer items-end overflow-hidden rounded-[28px] border border-white/15 bg-slate-950/40 shadow-[0_45px_120px_-65px_rgba(15,23,42,0.95)]"
                  style={{
                    background: mode.background,
                    width: dimensions.width,
                    height: dimensions.height,
                    maxWidth: "100%"
                  }}
                  onPointerDown={handlePointerDown}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent" />

                  {sparkles.map((sparkle) => (
                    <div
                      key={sparkle.id}
                      className="absolute rounded-full bg-white/70 blur-[1px]"
                      style={{
                        left: `${sparkle.left}%`,
                        top: `${sparkle.top}%`,
                        width: sparkle.size,
                        height: sparkle.size,
                        opacity: sparkle.opacity
                      }}
                    />
                  ))}

                  <div
                    className="absolute left-0 right-0"
                    style={{
                      top: groundLevel,
                      background: mode.groundColor,
                      height: GROUND_HEIGHT,
                      boxShadow: "0 -12px 24px -14px rgba(15,23,42,0.6)"
                    }}
                  />

                  {obstaclesRef.current.map((obstacle) => (
                    <div
                      key={obstacle.id}
                      className="absolute origin-bottom rounded-2xl border border-white/25 shadow-[0_14px_26px_-18px_rgba(15,23,42,0.75)]"
                      style={{
                        left: obstacle.x,
                        top: obstacle.y,
                        width: obstacle.width,
                        height: obstacle.height,
                        background: `linear-gradient(180deg, ${mode.accent} 0%, rgba(15,23,42,0.85) 100%)`
                      }}
                    />
                  ))}

                  <img
                    src={mode.sprite}
                    alt={mode.name}
                    className="absolute drop-shadow-[0_20px_28px_rgba(15,23,42,0.55)]"
                    style={{
                      left: player.x,
                      top: player.y,
                      width: player.width,
                      height: player.height
                    }}
                  />

                  <div className="pointer-events-none absolute left-6 top-6 flex w-56 flex-col gap-3">
                    <div className="rounded-2xl border border-white/20 bg-slate-950/70 px-5 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur">
                      Score <span className="font-mono text-lg">{score.toString().padStart(3, "0")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-white/70">
                      <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
                        Best {currentBest.toString().padStart(3, "0")}
                      </span>
                      <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">{mode.difficulty}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full transition-[width] duration-200 ease-out"
                        style={{ width: `${Math.round(progression * 100)}%`, background: mode.accent }}
                      />
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.38em] text-white/60">Pace boost</span>
                  </div>

                  {abilityBanner && (
                    <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-full border border-white/20 bg-slate-950/70 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.34em] text-white shadow-lg backdrop-blur">
                      {abilityBanner}
                    </div>
                  )}

                  {gameState !== "playing" && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/55 text-center backdrop-blur-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.5em] text-white/60">
                        {gameState === "menu" ? "Ready Up" : "Run It Back"}
                      </p>
                      <h3 className="text-2xl font-semibold text-white">
                        {gameState === "menu" ? `Dash with ${mode.name}` : "Try for a new best"}
                      </h3>
                      <p className="max-w-xs text-sm text-white/70">
                        {gameState === "menu"
                          ? "Press space, click, or tap to leap into the skyline."
                          : "Tap or press space to jump back into the flow."}
                      </p>
                      <p className="pointer-events-none rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
                        {mode.abilityLabel}: {abilityControlHints[mode.ability]}
                      </p>
                      <Button
                        variant="secondary"
                        className="pointer-events-auto border border-white/30 bg-white/90 px-6 py-2 text-slate-900 shadow-lg transition hover:bg-white"
                        onClick={startGame}
                      >
                        Start Run
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
          <aside className="flex flex-col gap-6">
            <section className="rounded-3xl border border-white/15 bg-white/5 p-6 text-white shadow-[0_35px_100px_-65px_rgba(15,23,42,0.95)] backdrop-blur-xl">
              <h3 className="text-sm font-semibold uppercase tracking-[0.36em] text-white/60">Mode Briefing</h3>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80">
                  <img src={mode.sprite} alt={mode.name} className="h-12 w-12 object-contain" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{mode.name}</p>
                  <p className="text-sm text-white/70">{mode.tagline}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Badge
                  className="border-transparent text-[11px] font-semibold uppercase tracking-[0.32em]"
                  style={{ background: mode.accent, color: "#0f172a" }}
                >
                  {mode.abilityLabel}
                </Badge>
                <span className="text-xs uppercase tracking-[0.32em] text-white/60">{mode.difficulty}</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/80">{mode.abilityDescription}</p>
              <p className="mt-4 rounded-2xl border border-white/15 bg-slate-950/50 p-4 text-xs text-white/70">
                {abilityControlHints[mode.ability]}
              </p>
            </section>

            <section className="rounded-3xl border border-white/15 bg-slate-950/60 p-6 text-white shadow-[0_35px_110px_-70px_rgba(15,23,42,0.95)] backdrop-blur-xl">
              <h3 className="text-sm font-semibold uppercase tracking-[0.36em] text-white/60">Run Toolkit</h3>
              <ul className="mt-4 space-y-3 text-sm text-white/80">
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full" style={{ background: mode.accent }} />
                  <span>
                    <span className="font-semibold text-white">Jump</span> — Press Space / W or tap on the arena to clear obstacles.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-white/50" />
                  <span>
                    <span className="font-semibold text-white">Ability</span> — {abilityControlHints[mode.ability]}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-white/30" />
                  <span>
                    <span className="font-semibold text-white">Restart</span> — Hit <kbd className="rounded bg-white/20 px-1 text-xs">R</kbd> after a tumble to replay instantly.
                  </span>
                </li>
              </ul>
              <div className="mt-5 rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/80">
                <p className="text-xs uppercase tracking-[0.36em] text-white/60">Mode Insight</p>
                <p className="mt-2 text-sm leading-relaxed">{modeHint}</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );

};
