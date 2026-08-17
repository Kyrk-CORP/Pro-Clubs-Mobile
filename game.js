const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const FIELD = { w: 40, h: 22 };
const player = { x: -10, y: 0, vx: 0, vy: 0, r: 0.55, stamina: 1, facing: 0 };
const ball = { x: -7.8, y: 0.4, vx: 0, vy: 0, r: 0.34 };
const keys = new Set();
const input = { x: 0, y: 0, sprint: false, kick: 0 };
let cameraMode = 'broadcast';
let thirdFollowsBall = false;
let camera = { x: 0, y: 0, zoom: 1, angle: 0 };
let last = performance.now();
let elapsed = 0;

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize);
resize();

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function update(dt) {
  elapsed += dt;
  const keyX = (keys.has('arrowright') || keys.has('d')) - (keys.has('arrowleft') || keys.has('a'));
  const keyY = (keys.has('arrowdown') || keys.has('s')) - (keys.has('arrowup') || keys.has('w'));
  const mx = input.x || keyX;
  const my = input.y || keyY;
  const mag = Math.hypot(mx, my) || 1;
  const sprint = input.sprint || keys.has('l');
  const maxSpeed = sprint && player.stamina > 0.05 ? 9.2 : 6.4;
  player.stamina = clamp(player.stamina + (sprint && (mx || my) ? -0.32 : 0.18) * dt, 0, 1);
  player.vx = lerp(player.vx, (mx / mag) * maxSpeed, 10 * dt);
  player.vy = lerp(player.vy, (my / mag) * maxSpeed, 10 * dt);
  player.x = clamp(player.x + player.vx * dt, -FIELD.w / 2 + 1, FIELD.w / 2 - 1);
  player.y = clamp(player.y + player.vy * dt, -FIELD.h / 2 + 1, FIELD.h / 2 - 1);
  if (Math.hypot(player.vx, player.vy) > 0.2) player.facing = Math.atan2(player.vy, player.vx);

  const near = dist(player, ball) < player.r + ball.r + 0.45;
  if (near) {
    const desired = player.facing;
    ball.vx = Math.cos(desired) * Math.max(3.5, Math.hypot(player.vx, player.vy) * 0.9);
    ball.vy = Math.sin(desired) * Math.max(3.5, Math.hypot(player.vx, player.vy) * 0.9);
    if (input.kick || keys.has('j') || keys.has('k')) {
      const power = input.kick === 2 || keys.has('k') ? 18 : 10;
      ball.vx = Math.cos(desired) * power;
      ball.vy = Math.sin(desired) * power;
      input.kick = 0;
    }
  }
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.vx *= Math.pow(0.55, dt);
  ball.vy *= Math.pow(0.55, dt);
  if (Math.abs(ball.x) > FIELD.w / 2 - ball.r) { ball.x = clamp(ball.x, -FIELD.w/2 + ball.r, FIELD.w/2 - ball.r); ball.vx *= -0.62; }
  if (Math.abs(ball.y) > FIELD.h / 2 - ball.r) { ball.y = clamp(ball.y, -FIELD.h/2 + ball.r, FIELD.h/2 - ball.r); ball.vy *= -0.62; }
  updateCamera(dt);
}

function updateCamera(dt) {
  const target = cameraMode === 'vertical' || thirdFollowsBall ? ball : player;
  if (cameraMode === 'broadcast') {
    camera.zoom = lerp(camera.zoom, Math.min(innerWidth / 46, innerHeight / 28), 4 * dt); camera.angle = lerp(camera.angle, -0.10, 4 * dt);
    camera.x = lerp(camera.x, (player.x + ball.x) / 2, 3 * dt); camera.y = lerp(camera.y, (player.y + ball.y) / 2, 3 * dt);
  } else if (cameraMode === 'vertical') {
    camera.zoom = lerp(camera.zoom, Math.min(innerWidth / 20, innerHeight / 32), 4 * dt); camera.angle = lerp(camera.angle, -Math.PI / 2, 4 * dt);
    camera.x = lerp(camera.x, target.x, 4 * dt); camera.y = lerp(camera.y, target.y, 4 * dt);
  } else {
    camera.zoom = lerp(camera.zoom, Math.min(innerWidth / 18, innerHeight / 14), 5 * dt); camera.angle = lerp(camera.angle, player.facing, 5 * dt);
    camera.x = lerp(camera.x, target.x, 5 * dt); camera.y = lerp(camera.y, target.y, 5 * dt);
  }
}

function worldToScreen(x, y) {
  const ca = Math.cos(-camera.angle), sa = Math.sin(-camera.angle);
  const dx = x - camera.x, dy = y - camera.y;
  return { x: innerWidth / 2 + (dx * ca - dy * sa) * camera.zoom, y: innerHeight / 2 + (dx * sa + dy * ca) * camera.zoom };
}

function draw() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  drawField();
  drawEntity(ball.x, ball.y, ball.r, '#f8fbff', '#121820');
  drawPlayer();
  drawMiniHud();
}

function drawField() {
  const corners = [[-20,-11],[20,-11],[20,11],[-20,11]].map(p => worldToScreen(p[0], p[1]));
  ctx.fillStyle = '#16743c'; ctx.beginPath(); corners.forEach((p,i)=> i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.88)'; ctx.lineWidth = 2;
  line(-20,-11,20,-11); line(20,-11,20,11); line(20,11,-20,11); line(-20,11,-20,-11); line(0,-11,0,11);
  circle(0,0,3); box(-20,-4,-15,4); box(15,-4,20,4); goal(-20); goal(20);
  for (let y = -10; y <= 10; y += 2) { ctx.strokeStyle = 'rgba(255,255,255,.04)'; line(-20,y,20,y); }
}
function line(x1,y1,x2,y2){ const a=worldToScreen(x1,y1), b=worldToScreen(x2,y2); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
function circle(x,y,r){ const p=worldToScreen(x,y); ctx.beginPath(); ctx.arc(p.x,p.y,r*camera.zoom,0,Math.PI*2); ctx.stroke(); }
function box(x1,y1,x2,y2){ line(x1,y1,x2,y1); line(x2,y1,x2,y2); line(x2,y2,x1,y2); }
function goal(x){ ctx.strokeStyle='#ffd45a'; line(x,-2.4,x - Math.sign(x)*1.2,-2.4); line(x,2.4,x - Math.sign(x)*1.2,2.4); }
function drawEntity(x,y,r,fill,stroke){ const p=worldToScreen(x,y); ctx.fillStyle=fill; ctx.strokeStyle=stroke; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(p.x,p.y,r*camera.zoom,0,Math.PI*2); ctx.fill(); ctx.stroke(); }
function drawPlayer(){ drawEntity(player.x,player.y,player.r,'#2df179','#06200f'); const p=worldToScreen(player.x,player.y), n=worldToScreen(player.x+Math.cos(player.facing),player.y+Math.sin(player.facing)); ctx.strokeStyle='#06200f'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(n.x,n.y); ctx.stroke(); }
function drawMiniHud(){ ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(16, innerHeight-170, 170*player.stamina, 8); ctx.strokeStyle='rgba(255,255,255,.4)'; ctx.strokeRect(16, innerHeight-170, 170, 8); document.querySelector('.scoreboard span:nth-child(2)').textContent = new Date(elapsed*1000).toISOString().slice(14,19); }
function loop(now) { const dt = Math.min((now - last) / 1000, 0.033); last = now; update(dt); draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);

addEventListener('keydown', e => { keys.add(e.key.toLowerCase()); if (e.key.toLowerCase()==='c') cycleCamera(); });
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

document.querySelectorAll('[data-camera]').forEach(btn => btn.addEventListener('click', () => setCamera(btn.dataset.camera)));
document.getElementById('followBall').addEventListener('click', e => { thirdFollowsBall = !thirdFollowsBall; e.currentTarget.classList.toggle('active', thirdFollowsBall); e.currentTarget.textContent = thirdFollowsBall ? 'Câmera livre' : 'Seguir bola'; });
document.getElementById('passBtn').addEventListener('pointerdown', () => input.kick = 1);
document.getElementById('shootBtn').addEventListener('pointerdown', () => input.kick = 2);
document.getElementById('sprintBtn').addEventListener('pointerdown', () => input.sprint = true);
document.getElementById('sprintBtn').addEventListener('pointerup', () => input.sprint = false);
function setCamera(mode){ cameraMode=mode; document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active', b.dataset.camera===mode)); document.getElementById('followBall').classList.toggle('hidden', mode !== 'third'); }
function cycleCamera(){ setCamera(cameraMode === 'broadcast' ? 'vertical' : cameraMode === 'vertical' ? 'third' : 'broadcast'); }

const stick = document.getElementById('joystick'); const knob = stick.querySelector('span'); let stickId = null;
stick.addEventListener('pointerdown', e => { stickId = e.pointerId; stick.setPointerCapture(stickId); moveStick(e); });
stick.addEventListener('pointermove', e => { if (e.pointerId === stickId) moveStick(e); });
stick.addEventListener('pointerup', resetStick); stick.addEventListener('pointercancel', resetStick);
function moveStick(e){ const r=stick.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2; const dx=e.clientX-cx, dy=e.clientY-cy, len=Math.min(Math.hypot(dx,dy), 44), a=Math.atan2(dy,dx); input.x=Math.cos(a)*len/44; input.y=Math.sin(a)*len/44; knob.style.transform=`translate(${Math.cos(a)*len}px, ${Math.sin(a)*len}px)`; }
function resetStick(){ stickId=null; input.x=0; input.y=0; knob.style.transform='translate(0,0)'; }
