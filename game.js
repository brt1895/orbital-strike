const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const levelValue = document.getElementById("levelValue");
const targetValue = document.getElementById("targetValue");
const hitsValue = document.getElementById("hitsValue");
const stateValue = document.getElementById("stateValue");
const powerRange = document.getElementById("powerRange");
const powerValue = document.getElementById("powerValue");
const fireButton = document.getElementById("fireButton");
const resetButton = document.getElementById("resetButton");
const startButton = document.getElementById("startButton");
const introOverlay = document.getElementById("introOverlay");
const dialogOverlay = document.getElementById("dialogOverlay");
const dialogEyebrow = document.getElementById("dialogEyebrow");
const dialogTitle = document.getElementById("dialogTitle");
const dialogCopy = document.getElementById("dialogCopy");
const dialogButton = document.getElementById("dialogButton");
const messageRibbon = document.getElementById("messageRibbon");

const TAU = Math.PI * 2;
const targetSequence = ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"];
const totalLevels = targetSequence.length;
const PHYSICS = {
  shotSpeedMinFactor: 0.68,
  shotSpeedMaxFactor: 1.34,
  inheritedVelocityFactor: 1.36,
  sunGravityMultiplier: 4.85,
  planetGravityMultiplier: 3.45,
  gravitySofteningFactor: 0.012,
  sunInfluenceBoost: 3.2,
  planetInfluenceBoost: 5.1,
  levelGravityRamp: 0.14,
  previewDt: 1 / 120,
  previewSteps: 360,
  previewStride: 4,
};

const planetDefs = [
  { id: "mercury", name: "Merkur", orbitFactor: 0.17, radiusFactor: 0.026, angularSpeed: 0.84, gravityFactor: 0.46, spinSpeed: 1.3, texture: "rocky", startAngle: -1.5, colors: ["#f6c98b", "#b97746", "#5f3823"] },
  { id: "venus", name: "Venus", orbitFactor: 0.255, radiusFactor: 0.036, angularSpeed: 0.63, gravityFactor: 0.72, spinSpeed: 0.9, texture: "cloud", startAngle: -0.55, colors: ["#f9e8be", "#d59f52", "#7f5124"] },
  { id: "earth", name: "Dunya", orbitFactor: 0.35, radiusFactor: 0.039, angularSpeed: 0.48, gravityFactor: 0.8, spinSpeed: 1.4, texture: "earth", startAngle: 0.65, colors: ["#7ae1ff", "#1e79d0", "#0f3d7a"] },
  { id: "mars", name: "Mars", orbitFactor: 0.445, radiusFactor: 0.031, angularSpeed: 0.38, gravityFactor: 0.58, spinSpeed: 1.15, texture: "rocky", startAngle: 1.18, colors: ["#ffb089", "#b95f39", "#632d1d"] },
  { id: "jupiter", name: "Jupiter", orbitFactor: 0.59, radiusFactor: 0.078, angularSpeed: 0.21, gravityFactor: 1.95, spinSpeed: 0.62, texture: "gas", startAngle: 2.42, colors: ["#f7dfba", "#d7ab7b", "#8c5c44"] },
  { id: "saturn", name: "Saturn", orbitFactor: 0.73, radiusFactor: 0.069, angularSpeed: 0.15, gravityFactor: 1.42, spinSpeed: 0.55, texture: "gas-ring", startAngle: -2.56, colors: ["#f9e1a1", "#d5b26f", "#85643e"] },
  { id: "uranus", name: "Uranus", orbitFactor: 0.855, radiusFactor: 0.054, angularSpeed: 0.11, gravityFactor: 0.98, spinSpeed: 0.48, texture: "ice", startAngle: -1.05, colors: ["#dcfff9", "#7ed5d9", "#2f7594"] },
  { id: "neptune", name: "Neptun", orbitFactor: 0.975, radiusFactor: 0.051, angularSpeed: 0.085, gravityFactor: 1.02, spinSpeed: 0.5, texture: "ice", startAngle: 2.95, colors: ["#b4e7ff", "#3a89ff", "#112e89"] },
];

const game = {
  dpr: Math.max(1, Math.min(window.devicePixelRatio || 1, 2)),
  width: 0,
  height: 0,
  center: { x: 0, y: 0 },
  systemRadius: 0,
  time: 0,
  accumulator: 0,
  lastTime: 0,
  started: false,
  state: "intro",
  level: 1,
  levelHits: 0,
  power: Number(powerRange.value),
  canFire: true,
  fireCooldown: 0,
  planets: [],
  planetMap: new Map(),
  sun: null,
  activeShot: null,
  previewPoints: [],
  previewDirty: true,
  previewRefresh: 0,
  aimWorld: null,
  stars: [],
  effects: [],
  dialogAction: null,
  messageTimer: 0,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function vecLength(vector) {
  return Math.hypot(vector.x, vector.y);
}

function normalize(vector) {
  const length = vecLength(vector) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scale(vector, multiplier) {
  return { x: vector.x * multiplier, y: vector.y * multiplier };
}

function worldToScreen(position) {
  return { x: game.center.x + position.x, y: game.center.y + position.y };
}

function screenToWorld(x, y) {
  return { x: x - game.center.x, y: y - game.center.y };
}

function getTargetPlanet() {
  return game.planetMap.get(targetSequence[game.level - 1]);
}

function getEarth() {
  return game.planetMap.get("earth");
}

function getRequiredHits() {
  return game.level;
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  game.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  game.width = Math.max(320, Math.floor(bounds.width));
  game.height = Math.max(320, Math.floor(bounds.height));
  canvas.width = Math.floor(game.width * game.dpr);
  canvas.height = Math.floor(game.height * game.dpr);
  ctx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);

  game.center.x = game.width * 0.5;
  game.center.y = game.height * 0.54;
  game.systemRadius = Math.min(game.width, game.height) * 0.39;

  createStars();
  buildBodies();
  resetAimToTarget();
  game.previewDirty = true;
}

function createStars() {
  const count = Math.floor((game.width * game.height) / 8500);
  game.stars = Array.from({ length: count }, () => ({
    x: Math.random() * game.width,
    y: Math.random() * game.height,
    radius: Math.random() * 1.8 + 0.25,
    alpha: Math.random() * 0.32 + 0.08,
    twinkle: Math.random() * TAU,
    speed: Math.random() * 1.8 + 0.4,
  }));
}

function buildBodies() {
  const radius = game.systemRadius;
  game.sun = {
    id: "sun",
    name: "Gunes",
    radius: radius * 0.13,
    gravityStrength: radius * radius * 5.55 * PHYSICS.sunGravityMultiplier,
    spin: 0,
    position: { x: 0, y: 0 },
  };

  game.planets = planetDefs.map((definition) => {
    const planet = {
      ...definition,
      orbitRadius: radius * definition.orbitFactor,
      radius: Math.max(11, radius * definition.radiusFactor),
      gravityStrength: radius * radius * definition.gravityFactor * PHYSICS.planetGravityMultiplier,
      angle: definition.startAngle,
      spin: Math.random() * TAU,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    };

    planet.position.x = Math.cos(planet.angle) * planet.orbitRadius;
    planet.position.y = Math.sin(planet.angle) * planet.orbitRadius;
    planet.velocity.x = -Math.sin(planet.angle) * planet.orbitRadius * planet.angularSpeed;
    planet.velocity.y = Math.cos(planet.angle) * planet.orbitRadius * planet.angularSpeed;
    return planet;
  });

  game.planetMap = new Map(game.planets.map((planet) => [planet.id, planet]));
}

function updateBodies(dt) {
  game.time += dt;
  game.sun.spin += dt * 0.18;

  for (const planet of game.planets) {
    planet.angle += planet.angularSpeed * dt;
    planet.spin += planet.spinSpeed * dt;
    planet.position.x = Math.cos(planet.angle) * planet.orbitRadius;
    planet.position.y = Math.sin(planet.angle) * planet.orbitRadius;
    planet.velocity.x = -Math.sin(planet.angle) * planet.orbitRadius * planet.angularSpeed;
    planet.velocity.y = Math.cos(planet.angle) * planet.orbitRadius * planet.angularSpeed;
  }
}

function getLauncherAnchor() {
  const earth = getEarth();
  const outward = normalize(earth.position);
  return add(earth.position, scale(outward, earth.radius + Math.max(14, game.systemRadius * 0.024)));
}

function resetAimToTarget() {
  const target = getTargetPlanet();
  const launcher = getLauncherAnchor();
  const distance = game.systemRadius * 0.28;
  const targetDirection = normalize(subtract(target.position, launcher));
  game.aimWorld = add(launcher, scale(targetDirection, distance));
}

function getShotSeed() {
  const earth = getEarth();
  const launcher = getLauncherAnchor();
  let desiredDirection = subtract(game.aimWorld || getTargetPlanet().position, launcher);
  if (vecLength(desiredDirection) < 0.001) {
    desiredDirection = subtract(getTargetPlanet().position, launcher);
  }

  const direction = normalize(desiredDirection);
  const powerRatio = clamp(game.power / 100, 0, 1);
  const speed = lerp(
    game.systemRadius * PHYSICS.shotSpeedMinFactor,
    game.systemRadius * PHYSICS.shotSpeedMaxFactor,
    easeOutCubic(powerRatio)
  );
  const inheritedVelocity = scale(earth.velocity, PHYSICS.inheritedVelocityFactor);

  return {
    origin: launcher,
    direction,
    velocity: add(scale(direction, speed), inheritedVelocity),
    powerRatio,
  };
}

function computeAcceleration(position) {
  const softening = game.systemRadius * PHYSICS.gravitySofteningFactor;
  const allBodies = [game.sun, ...game.planets];
  const acceleration = { x: 0, y: 0 };
  const levelMultiplier = 1 + (game.level - 1) * PHYSICS.levelGravityRamp;

  for (const body of allBodies) {
    const dx = body.position.x - position.x;
    const dy = body.position.y - position.y;
    const distSq = dx * dx + dy * dy + softening * softening;
    const dist = Math.sqrt(distSq);
    let force = (body.gravityStrength / distSq) * levelMultiplier;

    const influenceRadius = body.id === "sun"
      ? body.radius * 5.8
      : Math.max(body.radius * 6.2, game.systemRadius * 0.085);

    if (dist < influenceRadius) {
      const proximity = 1 - dist / influenceRadius;
      const localBoost = body.id === "sun"
        ? 1 + proximity * PHYSICS.sunInfluenceBoost
        : 1 + proximity * PHYSICS.planetInfluenceBoost;
      force *= localBoost;
    }

    acceleration.x += (dx / dist) * force;
    acceleration.y += (dy / dist) * force;
  }

  return acceleration;
}

function createEffect(type, position, color) {
  game.effects.push({
    type,
    position: { x: position.x, y: position.y },
    color,
    life: 1,
    radius: game.systemRadius * 0.022,
  });
}

function showRibbon(message, tone = "neutral", duration = 2.4) {
  messageRibbon.textContent = message;
  messageRibbon.className = "message-ribbon visible";
  if (tone === "hit") {
    messageRibbon.classList.add("hit");
  } else if (tone === "warn") {
    messageRibbon.classList.add("warn");
  }
  game.messageTimer = duration;
}

function hideRibbon() {
  messageRibbon.className = "message-ribbon";
  game.messageTimer = 0;
}

function updateRibbon(dt) {
  if (game.messageTimer <= 0) {
    return;
  }

  game.messageTimer -= dt;
  if (game.messageTimer <= 0) {
    hideRibbon();
  }
}

function updateHud() {
  const target = getTargetPlanet();
  levelValue.textContent = `${game.level} / ${totalLevels}`;
  targetValue.textContent = target.name;
  hitsValue.textContent = `${game.levelHits} / ${getRequiredHits()}`;

  if (game.state === "intro") {
    stateValue.textContent = "Beklemede";
  } else if (game.state === "running" && game.activeShot) {
    stateValue.textContent = "Meteor Ucusta";
  } else if (game.state === "running") {
    stateValue.textContent = "Hazir";
  } else if (game.state === "dialog") {
    stateValue.textContent = "Gecis";
  } else if (game.state === "won") {
    stateValue.textContent = "Tamamlandi";
  }

  powerValue.textContent = `${game.power}%`;
  fireButton.disabled = !game.started || game.state !== "running" || !game.canFire || Boolean(game.activeShot);
}

function fireShot() {
  if (!game.started || game.state !== "running" || !game.canFire || game.activeShot) {
    return;
  }

  const seed = getShotSeed();
  game.activeShot = {
    position: { x: seed.origin.x, y: seed.origin.y },
    velocity: { x: seed.velocity.x, y: seed.velocity.y },
    direction: { x: seed.direction.x, y: seed.direction.y },
    radius: Math.max(4, game.systemRadius * 0.01),
    age: 0,
    trailTimer: 0,
    trail: [],
    maxEarthDistance: 0,
  };

  game.canFire = false;
  game.fireCooldown = 0.42;
  showRibbon("Meteor salindi. Yercekimi koridorlarini oku.", "neutral", 1.6);
  updateHud();
}

function endShot() {
  game.activeShot = null;
  game.previewDirty = true;
  updateHud();
}

function showDialog(eyebrow, title, copy, buttonLabel, action) {
  dialogEyebrow.textContent = eyebrow;
  dialogTitle.textContent = title;
  dialogCopy.textContent = copy;
  dialogButton.textContent = buttonLabel;
  dialogOverlay.classList.remove("hidden");
  game.dialogAction = action;
}

function hideDialog() {
  dialogOverlay.classList.add("hidden");
  game.dialogAction = null;
}

function completeLevel() {
  if (game.level === totalLevels) {
    game.state = "won";
    showDialog("Sistem Temizlendi", "Butun gorevleri tamamladin", "Neptun gorevini de bitirdin. Istersen ilk seviyeden yeniden baslayip yeni rotalar deneyebilirsin.", "Bastan Oyna", "restartGame");
    showRibbon("Tum gezegen gorevleri tamamlandi.", "hit", 3.2);
  } else {
    game.state = "dialog";
    const nextPlanet = game.planetMap.get(targetSequence[game.level]);
    const nextCopy = `Siradaki hedef ${nextPlanet.name}. Bu kez ${game.level + 1} isabet gerekiyor.`;
    showDialog("Seviye Tamam", `${getTargetPlanet().name} gorevi bitti`, nextCopy, "Sonraki Seviye", "nextLevel");
    showRibbon(`${getTargetPlanet().name} gorevi tamamlandi.`, "hit", 2.8);
  }

  updateHud();
}

function advanceLevel() {
  game.level += 1;
  game.levelHits = 0;
  game.activeShot = null;
  game.canFire = true;
  game.fireCooldown = 0;
  game.state = "running";
  hideDialog();
  resetAimToTarget();
  game.previewDirty = true;
  const target = getTargetPlanet();
  showRibbon(`Seviye ${game.level}: ${target.name} hedefte.`, "neutral", 2.4);
  updateHud();
}

function resetCurrentLevel(showMessage = false) {
  game.levelHits = 0;
  game.activeShot = null;
  game.canFire = true;
  game.fireCooldown = 0;
  game.state = game.started ? "running" : "intro";
  hideDialog();
  resetAimToTarget();
  game.previewDirty = true;

  if (showMessage) {
    showRibbon("Seviye temizlendi. Yeni rota belirleyebilirsin.", "neutral", 1.5);
  }

  updateHud();
}

function restartGame() {
  game.level = 1;
  game.levelHits = 0;
  game.activeShot = null;
  game.canFire = true;
  game.fireCooldown = 0;
  game.state = "running";
  hideDialog();
  resetAimToTarget();
  game.previewDirty = true;
  updateHud();
}

function startGame() {
  game.started = true;
  game.state = "running";
  introOverlay.classList.add("hidden");
  restartGame();
  showRibbon("Seviye 1: Merkur hedefte. Ilk isabeti bul.", "neutral", 2.4);
}

function simulatePreview() {
  if (!game.started || game.state !== "running" || game.activeShot) {
    game.previewPoints = [];
    return;
  }

  const earth = getEarth();
  const seed = getShotSeed();
  const preview = [];
  const position = { x: seed.origin.x, y: seed.origin.y };
  const velocity = { x: seed.velocity.x, y: seed.velocity.y };
  const previewDt = PHYSICS.previewDt;
  let age = 0;
  let maxEarthDistance = 0;

  for (let step = 0; step < PHYSICS.previewSteps; step += 1) {
    age += previewDt;
    const acceleration = computeAcceleration(position);
    velocity.x += acceleration.x * previewDt;
    velocity.y += acceleration.y * previewDt;
    position.x += velocity.x * previewDt;
    position.y += velocity.y * previewDt;

    const earthDistance = vecLength(subtract(position, earth.position));
    maxEarthDistance = Math.max(maxEarthDistance, earthDistance);

    if (step % PHYSICS.previewStride === 0) {
      preview.push({ x: position.x, y: position.y });
    }

    if (vecLength(position) > game.systemRadius * 1.46) {
      break;
    }

    if (detectCollision(position, 4, age, maxEarthDistance, true)) {
      break;
    }
  }

  game.previewPoints = preview;
}

function detectCollision(position, radius, age, maxEarthDistance, previewMode = false) {
  const armedEarthHit = age > 1.05 && maxEarthDistance > getEarth().radius * 4.4;
  const target = getTargetPlanet();
  const bodies = [game.sun, ...game.planets];

  for (const body of bodies) {
    const distance = vecLength(subtract(position, body.position));
    if (distance > body.radius + radius) {
      continue;
    }

    if (body.id === "earth" && !armedEarthHit) {
      continue;
    }

    if (previewMode) {
      return body;
    }

    if (body.id === "sun") {
      createEffect("burst", body.position, "rgba(255,190,84,1)");
      showRibbon("Meteor Gunes'e yakalandi.", "warn");
      endShot();
      return body;
    }

    if (body.id === target.id) {
      game.levelHits += 1;
      createEffect("hit", body.position, "rgba(133,242,255,1)");
      showRibbon(`${body.name} isabeti ${game.levelHits}/${getRequiredHits()}`, "hit");
      endShot();

      if (game.levelHits >= getRequiredHits()) {
        completeLevel();
      } else {
        updateHud();
      }

      return body;
    }

    createEffect("burst", body.position, "rgba(255,158,136,1)");
    showRibbon(`${body.name} cekim alani rotayi bozdu.`, "warn");
    endShot();
    return body;
  }

  return null;
}

function updateShot(dt) {
  const shot = game.activeShot;
  if (!shot) {
    return;
  }

  shot.age += dt;
  const acceleration = computeAcceleration(shot.position);
  shot.velocity.x += acceleration.x * dt;
  shot.velocity.y += acceleration.y * dt;
  shot.position.x += shot.velocity.x * dt;
  shot.position.y += shot.velocity.y * dt;

  const earthDistance = vecLength(subtract(shot.position, getEarth().position));
  shot.maxEarthDistance = Math.max(shot.maxEarthDistance, earthDistance);

  shot.trailTimer += dt;
  if (shot.trailTimer >= 0.016) {
    shot.trail.unshift({ x: shot.position.x, y: shot.position.y, life: 1 });
    shot.trailTimer = 0;
  }

  shot.trail = shot.trail
    .map((point) => ({ ...point, life: point.life - dt * 2.4 }))
    .filter((point) => point.life > 0)
    .slice(0, 30);

  if (detectCollision(shot.position, shot.radius, shot.age, shot.maxEarthDistance, false)) {
    return;
  }

  if (vecLength(shot.position) > game.systemRadius * 1.52 || shot.age > 20) {
    showRibbon("Meteor sistemin disina savruldu.", "warn");
    endShot();
  }
}

function updateEffects(dt) {
  game.effects = game.effects
    .map((effect) => ({
      ...effect,
      life: effect.life - dt * 1.2,
      radius: effect.radius + dt * game.systemRadius * 0.08,
    }))
    .filter((effect) => effect.life > 0);
}

function drawBackground() {
  ctx.clearRect(0, 0, game.width, game.height);

  const deepGlow = ctx.createRadialGradient(game.center.x, game.center.y, game.systemRadius * 0.05, game.center.x, game.center.y, game.systemRadius * 1.18);
  deepGlow.addColorStop(0, "rgba(13, 33, 58, 0.16)");
  deepGlow.addColorStop(0.38, "rgba(8, 18, 35, 0.07)");
  deepGlow.addColorStop(1, "rgba(3, 7, 18, 0)");
  ctx.fillStyle = deepGlow;
  ctx.fillRect(0, 0, game.width, game.height);

  for (const star of game.stars) {
    const blink = 0.5 + Math.sin(game.time * star.speed + star.twinkle) * 0.5;
    ctx.globalAlpha = star.alpha * (0.6 + blink * 0.8);
    ctx.fillStyle = "#f5fbff";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, TAU);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function drawOrbits() {
  ctx.save();
  ctx.translate(game.center.x, game.center.y);
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 14]);

  for (const planet of game.planets) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    ctx.arc(0, 0, planet.orbitRadius, 0, TAU);
    ctx.stroke();
  }

  ctx.restore();
  ctx.setLineDash([]);
}

function drawSun() {
  const sun = game.sun;
  const screen = worldToScreen(sun.position);

  ctx.save();
  ctx.translate(screen.x, screen.y);

  for (let index = 0; index < 10; index += 1) {
    const pulse = sun.radius * (1.4 + index * 0.05 + Math.sin(game.time * 0.8 + index) * 0.03);
    ctx.strokeStyle = `rgba(255, 173, 46, ${0.08 - index * 0.006})`;
    ctx.lineWidth = 4 + index * 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, pulse, 0, TAU);
    ctx.stroke();
  }

  ctx.save();
  ctx.rotate(game.sun.spin);
  for (let index = 0; index < 12; index += 1) {
    ctx.rotate(TAU / 12);
    ctx.fillStyle = "rgba(255, 188, 95, 0.14)";
    ctx.beginPath();
    ctx.moveTo(sun.radius * 0.25, 0);
    ctx.quadraticCurveTo(sun.radius * 1.1, sun.radius * 0.2, sun.radius * 1.7, 0);
    ctx.quadraticCurveTo(sun.radius * 1.1, -sun.radius * 0.2, sun.radius * 0.25, 0);
    ctx.fill();
  }
  ctx.restore();

  const outerGlow = ctx.createRadialGradient(0, 0, sun.radius * 0.25, 0, 0, sun.radius * 1.6);
  outerGlow.addColorStop(0, "rgba(255, 244, 213, 0.96)");
  outerGlow.addColorStop(0.38, "rgba(255, 183, 67, 0.88)");
  outerGlow.addColorStop(0.7, "rgba(255, 124, 36, 0.42)");
  outerGlow.addColorStop(1, "rgba(255, 124, 36, 0)");
  ctx.fillStyle = outerGlow;
  ctx.beginPath();
  ctx.arc(0, 0, sun.radius * 1.6, 0, TAU);
  ctx.fill();

  const core = ctx.createRadialGradient(-sun.radius * 0.28, -sun.radius * 0.32, sun.radius * 0.2, 0, 0, sun.radius);
  core.addColorStop(0, "#fff5d7");
  core.addColorStop(0.38, "#ffd86f");
  core.addColorStop(0.78, "#ff9b2f");
  core.addColorStop(1, "#d75b12");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, sun.radius, 0, TAU);
  ctx.fill();

  ctx.restore();
}

function drawBands(radius, colors, wobble = 1) {
  for (let stripe = -3; stripe <= 3; stripe += 1) {
    const offset = stripe * radius * 0.26;
    ctx.fillStyle = colors[(stripe + colors.length * 4) % colors.length];
    ctx.globalAlpha = 0.22 + Math.abs(stripe) * 0.03;
    ctx.beginPath();
    ctx.ellipse(0, offset, radius * 1.1, radius * (0.16 + Math.sin(wobble + stripe) * 0.02), 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawRockyTexture(radius, colors) {
  for (let crater = 0; crater < 8; crater += 1) {
    const angle = crater * 0.82 + game.time * 0.05;
    const distance = radius * (0.18 + (crater % 3) * 0.16);
    ctx.fillStyle = crater % 2 === 0 ? colors[2] : colors[1];
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * distance, Math.sin(angle * 1.2) * distance, radius * (0.11 + (crater % 4) * 0.02), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawEarthTexture(radius) {
  drawBands(radius, ["rgba(255,255,255,0.14)", "rgba(255,255,255,0.08)", "rgba(255,255,255,0.12)"], 1.4);

  ctx.fillStyle = "rgba(61, 196, 102, 0.72)";
  ctx.beginPath();
  ctx.moveTo(-radius * 0.5, -radius * 0.08);
  ctx.bezierCurveTo(-radius * 0.18, -radius * 0.42, radius * 0.08, -radius * 0.25, radius * 0.03, -radius * 0.02);
  ctx.bezierCurveTo(-radius * 0.06, radius * 0.25, -radius * 0.42, radius * 0.22, -radius * 0.5, -radius * 0.08);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(radius * 0.16, -radius * 0.2);
  ctx.bezierCurveTo(radius * 0.44, -radius * 0.34, radius * 0.46, 0, radius * 0.18, radius * 0.12);
  ctx.bezierCurveTo(radius * 0.06, 0, radius * 0.02, -radius * 0.12, radius * 0.16, -radius * 0.2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.48)";
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.arc(-radius * 0.15, -radius * 0.32, radius * 0.15, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(radius * 0.22, radius * 0.1, radius * 0.22, radius * 0.1, 0.5, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawIceTexture(radius) {
  drawBands(radius, ["rgba(255,255,255,0.18)", "rgba(158,238,255,0.13)", "rgba(70,143,255,0.12)"], 0.8);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = Math.max(1.5, radius * 0.05);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.62, 0.3, Math.PI * 1.58);
  ctx.stroke();
}

function drawSaturnRings(position, planet, backLayer) {
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(planet.spin * 0.22 + 0.45);

  const ringOpacity = backLayer ? 0.14 : 0.28;
  ctx.strokeStyle = `rgba(233, 205, 133, ${ringOpacity})`;
  ctx.lineWidth = planet.radius * 0.38;
  ctx.beginPath();
  if (backLayer) {
    ctx.ellipse(0, 0, planet.radius * 1.75, planet.radius * 0.62, 0, Math.PI, TAU);
  } else {
    ctx.ellipse(0, 0, planet.radius * 1.75, planet.radius * 0.62, 0, 0, Math.PI);
  }
  ctx.stroke();
  ctx.restore();
}

function drawPlanet(planet) {
  const position = worldToScreen(planet.position);
  const isTarget = game.started && getTargetPlanet().id === planet.id;

  if (planet.id === "saturn") {
    drawSaturnRings(position, planet, true);
  }

  ctx.save();
  ctx.translate(position.x, position.y);

  const glow = ctx.createRadialGradient(-planet.radius * 0.3, -planet.radius * 0.34, planet.radius * 0.2, 0, 0, planet.radius * 1.16);
  glow.addColorStop(0, planet.colors[0]);
  glow.addColorStop(0.55, planet.colors[1]);
  glow.addColorStop(1, planet.colors[2]);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, planet.radius, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, planet.radius, 0, TAU);
  ctx.clip();
  ctx.rotate(planet.spin);

  if (planet.texture === "gas" || planet.texture === "gas-ring") {
    drawBands(planet.radius, ["rgba(255,255,255,0.18)", "rgba(165,116,82,0.24)", "rgba(119,74,53,0.18)"], 1.2);
    ctx.fillStyle = "rgba(181, 83, 48, 0.22)";
    ctx.beginPath();
    ctx.ellipse(planet.radius * 0.18, planet.radius * 0.18, planet.radius * 0.22, planet.radius * 0.12, 0, 0, TAU);
    ctx.fill();
  } else if (planet.texture === "cloud") {
    drawBands(planet.radius, ["rgba(255,255,255,0.16)", "rgba(255,222,176,0.18)", "rgba(196,141,80,0.14)"], 2.1);
  } else if (planet.texture === "earth") {
    drawEarthTexture(planet.radius);
  } else if (planet.texture === "ice") {
    drawIceTexture(planet.radius);
  } else {
    drawRockyTexture(planet.radius, planet.colors);
  }

  ctx.restore();

  const shadow = ctx.createRadialGradient(planet.radius * 0.4, -planet.radius * 0.45, planet.radius * 0.1, 0, 0, planet.radius * 1.2);
  shadow.addColorStop(0, "rgba(0,0,0,0)");
  shadow.addColorStop(1, "rgba(0,0,0,0.36)");
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(0, 0, planet.radius, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, planet.radius, 0, TAU);
  ctx.stroke();

  if (isTarget) {
    const pulse = 1 + Math.sin(game.time * 4.4) * 0.08;
    ctx.strokeStyle = "rgba(120, 235, 255, 0.8)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, planet.radius + 8 * pulse, 0, TAU);
    ctx.stroke();

    ctx.strokeStyle = "rgba(254, 173, 46, 0.34)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, planet.radius + 14 * pulse, 0, TAU);
    ctx.stroke();
  }

  ctx.restore();

  if (planet.id === "saturn") {
    drawSaturnRings(position, planet, false);
  }
}

function drawLauncher() {
  const earth = getEarth();
  const anchor = getLauncherAnchor();
  const direction = game.activeShot ? game.activeShot.direction : getShotSeed().direction;
  const earthScreen = worldToScreen(earth.position);
  const anchorScreen = worldToScreen(anchor);
  const angle = Math.atan2(direction.y, direction.x);

  ctx.save();
  ctx.strokeStyle = "rgba(120, 235, 255, 0.36)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(earthScreen.x, earthScreen.y);
  ctx.lineTo(anchorScreen.x, anchorScreen.y);
  ctx.stroke();

  ctx.translate(anchorScreen.x, anchorScreen.y);
  ctx.rotate(angle);

  ctx.fillStyle = "rgba(239, 247, 255, 0.84)";
  ctx.beginPath();
  ctx.arc(0, 0, earth.radius * 0.24, 0, TAU);
  ctx.fill();

  const barrelLength = earth.radius * 1.1 + 14;
  const barrelGradient = ctx.createLinearGradient(0, 0, barrelLength, 0);
  barrelGradient.addColorStop(0, "rgba(120, 235, 255, 0.95)");
  barrelGradient.addColorStop(1, "rgba(255, 198, 106, 0.92)");
  ctx.strokeStyle = barrelGradient;
  ctx.lineWidth = Math.max(4, earth.radius * 0.18);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(barrelLength, 0);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.74)";
  ctx.beginPath();
  ctx.arc(barrelLength, 0, earth.radius * 0.1, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawPreview() {
  if (!game.started || game.state !== "running" || game.activeShot || game.previewPoints.length === 0) {
    return;
  }

  const seed = getShotSeed();
  const anchor = worldToScreen(seed.origin);
  const arrowLength = Math.min(game.systemRadius * 0.3, 120 + seed.powerRatio * 120);
  const arrowTip = { x: anchor.x + seed.direction.x * arrowLength, y: anchor.y + seed.direction.y * arrowLength };

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  ctx.lineTo(arrowTip.x, arrowTip.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(255,255,255,0.24)";
  ctx.beginPath();
  ctx.moveTo(arrowTip.x, arrowTip.y);
  ctx.lineTo(arrowTip.x - seed.direction.x * 18 - seed.direction.y * 8, arrowTip.y - seed.direction.y * 18 + seed.direction.x * 8);
  ctx.lineTo(arrowTip.x - seed.direction.x * 18 + seed.direction.y * 8, arrowTip.y - seed.direction.y * 18 - seed.direction.x * 8);
  ctx.closePath();
  ctx.fill();

  for (let index = 0; index < game.previewPoints.length; index += 1) {
    const point = worldToScreen(game.previewPoints[index]);
    const opacity = 0.08 + (index / game.previewPoints.length) * 0.54;
    const size = 1.5 + (index / game.previewPoints.length) * 2.3;
    ctx.fillStyle = `rgba(153, 239, 255, ${opacity})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, size, 0, TAU);
    ctx.fill();
  }

  ctx.restore();
}

function drawShot() {
  const shot = game.activeShot;
  if (!shot) {
    return;
  }

  ctx.save();
  for (let index = 0; index < shot.trail.length; index += 1) {
    const point = shot.trail[index];
    const screen = worldToScreen(point);
    const alpha = point.life * (1 - index / Math.max(1, shot.trail.length)) * 0.65;
    const radius = shot.radius * (0.4 + point.life * 0.9);
    const trailGradient = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, radius * 2.2);
    trailGradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
    trailGradient.addColorStop(0.55, `rgba(135,232,255,${alpha * 0.42})`);
    trailGradient.addColorStop(1, "rgba(135,232,255,0)");
    ctx.fillStyle = trailGradient;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius * 2.1, 0, TAU);
    ctx.fill();
  }

  const screen = worldToScreen(shot.position);
  const glow = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, shot.radius * 3.4);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.3, "rgba(255,255,255,0.92)");
  glow.addColorStop(0.68, "rgba(135,232,255,0.46)");
  glow.addColorStop(1, "rgba(135,232,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, shot.radius * 3.4, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, shot.radius, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawEffects() {
  for (const effect of game.effects) {
    const screen = worldToScreen(effect.position);
    ctx.save();
    ctx.strokeStyle = effect.color;
    ctx.globalAlpha = effect.life * 0.8;
    ctx.lineWidth = Math.max(2, game.systemRadius * 0.007 * effect.life);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, effect.radius, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = effect.color;
    ctx.globalAlpha = effect.life * 0.45;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, effect.radius * 0.32, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function render() {
  drawBackground();
  drawOrbits();
  drawSun();

  for (const planet of game.planets) {
    drawPlanet(planet);
  }

  drawPreview();
  drawLauncher();
  drawShot();
  drawEffects();
}

function updateGame(delta) {
  const step = 1 / 120;
  game.accumulator += delta;
  game.previewRefresh = Math.max(0, game.previewRefresh - delta);

  while (game.accumulator >= step) {
    updateBodies(step);
    updateRibbon(step);
    updateEffects(step);

    if (game.started && game.state === "running") {
      if (!game.canFire) {
        game.fireCooldown -= step;
        if (game.fireCooldown <= 0) {
          game.canFire = true;
        }
      }

      if (game.activeShot) {
        updateShot(step);
      }
    }

    game.accumulator -= step;
  }

  if (game.started && game.state === "running" && !game.activeShot && game.previewDirty && game.previewRefresh <= 0) {
    simulatePreview();
    game.previewDirty = false;
    game.previewRefresh = 0.08;
  }

  updateHud();
}

function tick(timestamp) {
  if (!game.lastTime) {
    game.lastTime = timestamp;
  }

  const delta = Math.min(0.033, (timestamp - game.lastTime) / 1000);
  game.lastTime = timestamp;
  updateGame(delta);
  render();
  requestAnimationFrame(tick);
}

function updateAimFromPointer(event) {
  if (!game.started) {
    return;
  }

  const bounds = canvas.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const y = event.clientY - bounds.top;
  game.aimWorld = screenToWorld(x, y);
  game.previewDirty = true;
}

powerRange.addEventListener("input", () => {
  game.power = Number(powerRange.value);
  powerValue.textContent = `${game.power}%`;
  game.previewDirty = true;
  updateHud();
});

fireButton.addEventListener("click", fireShot);
resetButton.addEventListener("click", () => resetCurrentLevel(true));
startButton.addEventListener("click", startGame);

dialogButton.addEventListener("click", () => {
  if (game.dialogAction === "nextLevel") {
    advanceLevel();
  } else if (game.dialogAction === "restartGame") {
    restartGame();
  }
});

canvas.addEventListener("pointermove", updateAimFromPointer);
canvas.addEventListener("pointerdown", updateAimFromPointer);
window.addEventListener("resize", resizeCanvas);

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    if (!game.started) {
      startGame();
      return;
    }
    fireShot();
  }

  if (event.code === "KeyR" && game.started) {
    resetCurrentLevel(true);
  }

  if (event.code === "Enter") {
    if (game.dialogAction === "nextLevel") {
      advanceLevel();
    } else if (game.dialogAction === "restartGame") {
      restartGame();
    }
  }
});

resizeCanvas();
updateHud();
requestAnimationFrame(tick);
