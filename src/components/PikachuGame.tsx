import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
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
    speed: 3.2,
    speedRamp: 0.025,
    gravity: 0.78,
    jumpVelocity: 11,
    spawnIntervalRange: [1600, 2100],
    obstacleHeight: [40, 65],
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
    speed: 3.6,
    speedRamp: 0.03,
    gravity: 0.62,
    jumpVelocity: 10.5,
    spawnIntervalRange: [1500, 1900],
    obstacleHeight: [42, 72],
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
    speed: 3.2,
    speedRamp: 0.024,
    gravity: 0.74,
    jumpVelocity: 10.8,
    spawnIntervalRange: [1400, 1750],
    obstacleHeight: [46, 78],
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
    speed: 2.8,
    speedRamp: 0.015,
    gravity: 0.7,
    jumpVelocity: 10.5,
    spawnIntervalRange: [1800, 2300],
    obstacleHeight: [38, 62],
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
        const height = randomBetween(mode.obstacleHeight[0], mode.obstacleHeight[1]);
        const width = randomBetween(32, 68);
        const obstacle: Obstacle = {
          id: nextObstacleId.current++,
          x: dimensions.width + 48,
          y: groundLevel - height,
          width,
          height
        };

        obstaclesRef.current = [...obstaclesRef.current, obstacle];
        spawnTimerRef.current = rollSpawnDelay(mode);
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
    <div className="relative w-full max-w-6xl px-4 py-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-40 max-w-4xl rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 top-24 h-52 w-52 rounded-full bg-[#6366f1]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 bottom-10 h-48 w-48 rounded-full bg-[#facc15]/10 blur-3xl" />

      <Card className="relative overflow-hidden border-white/10 bg-slate-950/75 text-slate-100 shadow-2xl backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%)]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-white/10 via-transparent to-transparent" />

        <CardHeader className="relative z-10 space-y-4 pb-4 sm:pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 shadow-lg ring-1 ring-white/10">
                <img src={mode.sprite} alt={mode.name} className="h-14 w-14 object-contain" />
              </div>
              <div>
                <CardTitle className="text-3xl font-semibold sm:text-4xl">
                  {mode.name}
                </CardTitle>
                <CardDescription className="text-base text-slate-200/70">
                  {mode.tagline}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm font-medium text-slate-200">
              <div
                className="rounded-full px-4 py-1 shadow-sm"
                style={{
                  background: mode.accentSoft,
                  color: mode.accent
                }}
              >
                {mode.abilityLabel}
              </div>
              <Badge
                className="border-transparent px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-900"
                style={{ background: mode.accent }}
              >
                {mode.difficulty}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 grid gap-6 pb-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <div
              className="relative flex h-[480px] w-full cursor-pointer items-end overflow-hidden rounded-3xl border border-white/10 shadow-[0_40px_120px_-60px_rgba(148,163,184,0.7)] transition-transform hover:scale-[1.01]"
              style={{ background: mode.background }}
              onPointerDown={handlePointerDown}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />

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
                  className="absolute bottom-0 origin-bottom rounded-2xl border border-white/20 shadow-[0_12px_25px_-15px_rgba(15,23,42,0.75)]"
                  style={{
                    left: obstacle.x,
                    top: obstacle.y,
                    width: obstacle.width,
                    height: obstacle.height,
                    background: `linear-gradient(180deg, ${mode.accent} 0%, rgba(15,23,42,0.8) 100%)`
                  }}
                />
              ))}

              <img
                src={mode.sprite}
                alt={mode.name}
                className="absolute drop-shadow-[0_16px_24px_rgba(15,23,42,0.55)] z-10"
                style={{
                  left: player.x,
                  top: player.y,
                  width: player.width,
                  height: player.height
                }}
              />

              <div className="pointer-events-none absolute left-4 top-4 flex w-56 flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-slate-950/50 px-4 py-1 text-sm font-semibold text-white shadow-lg backdrop-blur">
                    Score {score.toString().padStart(3, "0")}
                  </div>
                  <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-900">
                    Best {currentBest.toString().padStart(3, "0")}
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-[width] duration-200 ease-out"
                    style={{ width: `${Math.round(progression * 100)}%`, background: mode.accent }}
                  />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/60">
                  Pace boost
                </span>
              </div>

              {abilityBanner && (
                <div className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-slate-950/60 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-white shadow-lg backdrop-blur">
                  {abilityBanner}
                </div>
              )}

              {gameState !== "playing" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/30 text-center backdrop-blur-[2px] z-20">
                  <div className="pointer-events-none flex flex-col items-center gap-3">
                    <p className="text-lg font-semibold uppercase tracking-[0.3em] text-white drop-shadow-lg">
                      {gameState === "menu" ? mode.name : "You got this!"}
                    </p>
                    <p className="max-w-xs text-sm text-slate-200 drop-shadow">
                      {gameState === "menu"
                        ? "Press space, click, or tap to leap into action."
                        : "Press space or tap to dash again."}
                    </p>
                    <p className="rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.26em] text-white/90 backdrop-blur-sm">
                      {mode.abilityLabel}: {abilityControlHints[mode.ability]}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="pointer-events-auto mt-2 border border-white/20 bg-white/95 text-slate-900 shadow-xl hover:bg-white hover:scale-105 transition-all"
                    onClick={startGame}
                  >
                    Play {mode.name}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_25px_60px_-45px_rgba(15,23,42,0.9)] backdrop-blur">
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">
                Game Modes
              </h3>
              <div className="mt-4 grid gap-3">
                {GAME_MODES.map((entry) => {
                  const selected = entry.id === mode.id;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => setModeId(entry.id)}
                      className={cn(
                        "flex items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-all",
                        "hover:border-white/40 hover:bg-white/15",
                        selected
                          ? "border-transparent bg-white/60 text-slate-900 shadow-[0_18px_55px_-35px_rgba(15,23,42,0.9)]"
                          : "border-white/10 bg-white/5 text-slate-200"
                      )}
                      style={
                        selected
                          ? {
                              boxShadow: `0 20px 45px -30px ${entry.accent}`
                            }
                          : undefined
                      }
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/70">
                        <img src={entry.sprite} alt="" className="h-10 w-10 object-contain" />
                      </div>
                      <div className="flex-1">
                        <p className="text-base font-semibold">{entry.name}</p>
                        <p className="text-xs text-slate-900/70">
                          {entry.abilityLabel}
                        </p>
                      </div>
                      <Badge
                        className="border-transparent text-[11px] font-semibold uppercase tracking-wide"
                        style={{
                          background: selected ? entry.accent : entry.accentSoft,
                          color: selected ? "#0f172a" : entry.accent
                        }}
                      >
                        {entry.difficulty}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-950/40 p-6 text-sm leading-relaxed text-slate-200 shadow-[0_30px_80px_-60px_rgba(15,23,42,0.95)] backdrop-blur">
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">
                How to play
              </h3>
              <ul className="mt-4 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full" style={{ background: mode.accent }} />
                  <span>
                    <span className="font-semibold text-white">Jump</span> — Press Space / W or tap on the arena to hop over obstacles.
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
              <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-200/80">
                {modeHint}
              </p>
            </section>
          </aside>
        </CardContent>
      </Card>
    </div>
  );
};
