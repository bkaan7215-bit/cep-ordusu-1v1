'use strict';

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, game: 'Cep Ordusu 1v1' }));

const rooms = new Map();
let nextUnitId = 1;
const COSTS = { miner: 70, sword: 110, archer: 145, guardian: 180 };
const STATS = {
  sword:    { hp: 100, damage: 18, range: 34, cooldown: 0.82, speed: 43 },
  archer:   { hp: 66,  damage: 15, range: 176, cooldown: 1.18, speed: 29 },
  guardian: { hp: 178, damage: 25, range: 37, cooldown: 1.12, speed: 24 }
};

function send(ws, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}
function broadcast(room, payload) {
  room.players.forEach(p => p && send(p.ws, payload));
}
function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  } while (rooms.has(code));
  return code;
}
function newState() {
  return {
    started: true,
    elapsed: 0,
    winner: null,
    players: [
      { gold: 220, baseHp: 1000, miners: 1, incomeClock: 0 },
      { gold: 220, baseHp: 1000, miners: 1, incomeClock: 0 }
    ],
    units: []
  };
}
function createUnit(owner, type) {
  const stats = STATS[type];
  return {
    id: nextUnitId++, owner, type,
    x: owner === 0 ? 105 : 855,
    hp: stats.hp, maxHp: stats.hp,
    cooldown: Math.random() * 0.35,
    swing: 0
  };
}
function handleAction(room, playerIndex, action) {
  const state = room.state;
  if (!state || state.winner !== null) return;
  const side = state.players[playerIndex];
  if (!Object.prototype.hasOwnProperty.call(COSTS, action)) return;
  if (action !== 'miner' && state.units.filter(u => u.owner === playerIndex).length >= 36) return;
  if (action === 'miner' && side.miners >= 8) return;
  const cost = COSTS[action];
  if (side.gold < cost) {
    send(room.players[playerIndex]?.ws, { type: 'notice', text: 'Yeterli altının yok.' });
    return;
  }
  side.gold -= cost;
  if (action === 'miner') side.miners += 1;
  else state.units.push(createUnit(playerIndex, action));
  broadcast(room, { type: 'state', state: publicState(state) });
}
function publicState(state) {
  return {
    elapsed: state.elapsed,
    winner: state.winner,
    players: state.players.map(p => ({ gold: p.gold, baseHp: p.baseHp, miners: p.miners })),
    units: state.units.map(u => ({ id: u.id, owner: u.owner, type: u.type, x: u.x, hp: u.hp, maxHp: u.maxHp, swing: u.swing }))
  };
}
function stepRoom(room, dt) {
  const s = room.state;
  if (!s || s.winner !== null) return;
  s.elapsed += dt;

  for (const side of s.players) {
    side.incomeClock += dt;
    while (side.incomeClock >= 2.25) {
      side.incomeClock -= 2.25;
      side.gold = Math.min(9999, side.gold + side.miners * 8);
    }
  }

  for (const unit of s.units) {
    const dir = unit.owner === 0 ? 1 : -1;
    const enemyOwner = 1 - unit.owner;
    const stats = STATS[unit.type];
    unit.cooldown = Math.max(0, unit.cooldown - dt);
    unit.swing = Math.max(0, unit.swing - dt);
    const ahead = s.units
      .filter(other => other.owner === enemyOwner && (other.x - unit.x) * dir > -5)
      .sort((a, b) => Math.abs(a.x - unit.x) - Math.abs(b.x - unit.x));
    const target = ahead.find(other => Math.abs(other.x - unit.x) <= (unit.type === 'archer' ? stats.range : 48));
    const baseX = enemyOwner === 0 ? 70 : 890;

    if (target) {
      const distance = Math.abs(target.x - unit.x);
      if (distance <= stats.range && unit.cooldown <= 0) {
        target.hp -= stats.damage;
        unit.cooldown = stats.cooldown;
        unit.swing = 0.18;
      } else if (unit.type !== 'archer' && distance > stats.range) {
        unit.x += dir * stats.speed * dt;
      }
    } else {
      const distanceToBase = Math.abs(baseX - unit.x);
      if (unit.type === 'archer' && distanceToBase <= stats.range) {
        if (unit.cooldown <= 0) {
          s.players[enemyOwner].baseHp -= stats.damage;
          unit.cooldown = stats.cooldown;
          unit.swing = 0.18;
        }
      } else if (unit.type !== 'archer' && distanceToBase <= stats.range + 8) {
        if (unit.cooldown <= 0) {
          s.players[enemyOwner].baseHp -= stats.damage;
          unit.cooldown = stats.cooldown;
          unit.swing = 0.18;
        }
      } else {
        unit.x += dir * stats.speed * dt;
      }
    }
  }

  s.units = s.units.filter(u => u.hp > 0 && u.x > 42 && u.x < 918);
  if (s.players[0].baseHp <= 0) { s.players[0].baseHp = 0; s.winner = 1; }
  if (s.players[1].baseHp <= 0) { s.players[1].baseHp = 0; s.winner = 0; }
}

wss.on('connection', ws => {
  ws.roomCode = null;
  ws.playerIndex = null;

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'create') {
      if (ws.roomCode) return;
      const code = makeCode();
      const room = { code, players: [{ ws }, null], state: null, lastActive: Date.now() };
      rooms.set(code, room);
      ws.roomCode = code;
      ws.playerIndex = 0;
      send(ws, { type: 'created', code, player: 0 });
      return;
    }

    if (msg.type === 'join') {
      if (ws.roomCode) return;
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      const room = rooms.get(code);
      if (!room) { send(ws, { type: 'error', text: 'Bu oda bulunamadı. Oda kodunu kontrol et.' }); return; }
      if (room.players[1]) { send(ws, { type: 'error', text: 'Bu oda zaten dolu.' }); return; }
      room.players[1] = { ws };
      room.state = newState();
      room.lastActive = Date.now();
      ws.roomCode = code;
      ws.playerIndex = 1;
      room.players.forEach((p, i) => send(p.ws, { type: 'start', code, player: i, state: publicState(room.state) }));
      return;
    }

    if (msg.type === 'action') {
      const room = rooms.get(ws.roomCode);
      if (!room || !room.state || room.players[ws.playerIndex]?.ws !== ws) return;
      handleAction(room, ws.playerIndex, msg.action);
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws.roomCode);
    if (!room) return;
    const idx = ws.playerIndex;
    if (room.players[idx]?.ws === ws) room.players[idx] = null;
    const other = room.players[1 - idx];
    if (other) send(other.ws, { type: 'opponent_left' });
    room.lastActive = Date.now();
    setTimeout(() => {
      const current = rooms.get(room.code);
      if (current && current.lastActive <= Date.now() - 55000) rooms.delete(room.code);
    }, 56000);
  });
});

setInterval(() => {
  const dt = 0.1;
  for (const room of rooms.values()) {
    if (!room.state) continue;
    stepRoom(room, dt);
    broadcast(room, { type: 'state', state: publicState(room.state) });
  }
}, 100);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Cep Ordusu 1v1 hazır: http://localhost:${PORT}`);
});
