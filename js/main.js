// ============================================================
// NUN MASSACRE - PS1-Style Survival Horror
// ============================================================
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// ============================================================
// CONFIG
// ============================================================
const CFG = {
    renderW: 426, renderH: 240,
    cell: 2, wallH: 3.5,
    playerH: 1.6, playerR: 0.35,
    walkSpd: 2.2, sprintSpd: 3.6, crouchSpd: 1.2,
    crouchH: 1.0,
    maxStamina: 100, staminaDrain: 4.5, staminaRegen: 12, crouchStaminaRegen: 20,
    maxHealth: 3,
    nunPatrolSpd: 1.8, nunInvestigateSpd: 2.6, nunChaseSpd: 3.2, nunSearchSpd: 2.4,
    nunSightRange: 14, nunSightAngle: 70 * Math.PI / 180,
    nunStabDist: 2.0, nunAttackCd: 1.8,
    nunHearBaseRadius: 10,
    nunReactionDelayMin: 0.12, nunReactionDelayMax: 0.25,
    nunMemoryDuration: 3.2,
    nunSearchTimeMin: 10, nunSearchTimeMax: 18,
    nunCooldownDuration: 6,
    nunMaxChaseTime: 45,
    flashRange: 28, maxBattery: 100, batteryDrain: 0.083,
    fogColor: 0x0c0c14, fogDensity: 0.018,
    cameraFar: 38,
    doorSlamLoudness: 15, doorSlowLoudness: 3,
    // Sound loudness values for hearing system
    walkLoudness: 3, sprintLoudness: 8, crouchLoudness: 1, pickupLoudness: 2,
};

const MAP_W = 50, MAP_H = 50;

// ============================================================
// MAP GENERATION
// ============================================================
function generateMap() {
    const m = Array.from({ length: MAP_H }, () => new Uint8Array(MAP_W));
    function carve(x1, z1, w, h, val = 1) {
        for (let z = z1; z < z1 + h && z < MAP_H; z++)
            for (let x = x1; x < x1 + w && x < MAP_W; x++)
                m[z][x] = val;
    }
    carve(20, 20, 10, 10); // Entry Hall
    carve(23, 7, 4, 13);   // North corridor
    carve(23, 30, 4, 13);  // South corridor
    carve(30, 23, 13, 4);  // East corridor
    carve(7, 23, 13, 4);   // West corridor
    carve(11, 7, 8, 6); carve(19, 9, 4, 3);   // Classroom A + connector
    carve(31, 7, 8, 6); carve(27, 9, 4, 3);   // Classroom B + connector
    carve(36, 15, 8, 7); carve(38, 22, 3, 1); // Library + connector
    carve(36, 28, 7, 7); carve(38, 27, 3, 1); // Kitchen + connector
    carve(9, 36, 9, 8); carve(18, 37, 5, 3);  // Chapel + connector
    carve(31, 36, 8, 7); carve(27, 37, 4, 3); // Dining + connector
    carve(3, 16, 7, 6); carve(8, 22, 2, 1);   // Storage + connector
    carve(3, 28, 7, 7); carve(8, 27, 2, 1);   // Cellar + connector

    // Loop corridors connecting wings for chase mind-games
    carve(9, 13, 3, 10);     // SW vertical loop (Storage to Classroom A)
    carve(38, 13, 3, 3);     // SE connector (Library to Classroom B)
    carve(9, 35, 3, 2);      // SW chapel approach
    carve(38, 35, 3, 2);     // SE dining approach

    // Basement hub under Entry Hall
    carve(22, 44, 6, 4);     // Basement room
    carve(24, 43, 2, 1);     // Basement entrance from south corridor

    // Vents/crawlspaces (value 2: player crouch-only, nun can't enter)
    carve(10, 22, 1, 2, 2);  // Vent: Storage to West corridor
    carve(19, 14, 1, 3, 2);  // Vent: Classroom A to North corridor area
    carve(35, 22, 1, 2, 2);  // Vent: East corridor shortcut
    carve(18, 43, 1, 2, 2);  // Vent: Chapel area to basement
    carve(30, 35, 1, 2, 2);  // Vent: South corridor to Dining area

    // Doorframes: wall off cells adjacent to door positions to create 1-cell-wide doorways
    // Door at (22,10) axis z - Classroom A entrance: wall above/below
    m[9][22] = 0; m[11][22] = 0;
    // Door at (27,10) axis z - Classroom B entrance: wall above/below
    m[9][27] = 0; m[11][27] = 0;
    // Door at (39,22) axis x - Library entrance: wall left/right
    m[22][38] = 0; m[22][40] = 0;
    // Door at (39,27) axis x - Kitchen entrance: wall left/right
    m[27][38] = 0; m[27][40] = 0;
    // Door at (18,38) axis z - Chapel entrance: wall above/below
    m[37][18] = 0; m[39][18] = 0;
    // Door at (27,38) axis z - Dining entrance: wall above/below
    m[37][27] = 0; m[39][27] = 0;
    // Door at (9,22) axis x - Storage entrance: wall left
    m[22][8] = 0;
    // Door at (9,27) axis x - Cellar entrance: wall left
    m[27][8] = 0;

    return m;
}

// Vent cell check: grid value 2 means crouch-only
function isVent(map, gx, gz) {
    return gx >= 0 && gx < MAP_W && gz >= 0 && gz < MAP_H && map[gz][gx] === 2;
}

const ROOM_DEFS = [
    { id: 'entry', name: 'Entry Hall', x1: 20, z1: 20, x2: 30, z2: 30 },
    { id: 'n_corr', name: 'North Corridor', x1: 23, z1: 7, x2: 27, z2: 20 },
    { id: 's_corr', name: 'South Corridor', x1: 23, z1: 30, x2: 27, z2: 43 },
    { id: 'e_corr', name: 'East Corridor', x1: 30, z1: 23, x2: 43, z2: 27 },
    { id: 'w_corr', name: 'West Corridor', x1: 7, z1: 23, x2: 20, z2: 27 },
    { id: 'class_a', name: 'Classroom A', x1: 11, z1: 7, x2: 19, z2: 13 },
    { id: 'class_b', name: 'Classroom B', x1: 31, z1: 7, x2: 39, z2: 13 },
    { id: 'library', name: 'Library', x1: 36, z1: 15, x2: 44, z2: 22 },
    { id: 'kitchen', name: 'Kitchen', x1: 36, z1: 28, x2: 43, z2: 35 },
    { id: 'chapel', name: 'Chapel', x1: 9, z1: 36, x2: 18, z2: 44 },
    { id: 'dining', name: 'Dining Hall', x1: 31, z1: 36, x2: 39, z2: 43 },
    { id: 'storage', name: 'Storage Room', x1: 3, z1: 16, x2: 10, z2: 22 },
    { id: 'cellar', name: 'Cellar', x1: 3, z1: 28, x2: 10, z2: 35 },
    { id: 'basement', name: 'Basement', x1: 22, z1: 44, x2: 28, z2: 48 },
    { id: 'sw_loop', name: 'West Passage', x1: 9, z1: 13, x2: 12, z2: 23 },
];

// ============================================================
// COORDINATE HELPERS
// ============================================================
function gridToWorld(gx, gz) {
    return { x: (gx - MAP_W / 2) * CFG.cell + CFG.cell / 2, z: (gz - MAP_H / 2) * CFG.cell + CFG.cell / 2 };
}
function worldToGrid(wx, wz) {
    return { x: Math.floor(wx / CFG.cell + MAP_W / 2), z: Math.floor(wz / CFG.cell + MAP_H / 2) };
}
function isWalkable(map, gx, gz) {
    return gx >= 0 && gx < MAP_W && gz >= 0 && gz < MAP_H && map[gz][gx] >= 1;
}
function isWalkableForNun(map, gx, gz) {
    return gx >= 0 && gx < MAP_W && gz >= 0 && gz < MAP_H && map[gz][gx] === 1;
}

// ============================================================
// A* GRID PATHFINDER
// ============================================================
function astarPath(map, sx, sz, gx, gz) {
    if (sx === gx && sz === gz) return [];
    if (!isWalkableForNun(map, gx, gz)) return null;

    const key = (x, z) => x + z * MAP_W;
    const open = new Map(); // key -> {x, z, g, h, f, parent}
    const closed = new Set();
    const heuristic = (ax, az) => Math.abs(ax - gx) + Math.abs(az - gz);

    const start = { x: sx, z: sz, g: 0, h: heuristic(sx, sz), parent: null };
    start.f = start.g + start.h;
    open.set(key(sx, sz), start);

    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

    while (open.size > 0) {
        // Find lowest f
        let best = null;
        for (const node of open.values()) {
            if (!best || node.f < best.f) best = node;
        }
        if (best.x === gx && best.z === gz) {
            // Reconstruct path
            const path = [];
            let n = best;
            while (n.parent) { path.unshift({ x: n.x, z: n.z }); n = n.parent; }
            return path;
        }
        open.delete(key(best.x, best.z));
        closed.add(key(best.x, best.z));

        for (const [dx, dz] of dirs) {
            const nx = best.x + dx, nz = best.z + dz;
            const nk = key(nx, nz);
            if (closed.has(nk)) continue;
            if (!isWalkableForNun(map, nx, nz)) continue;

            const g = best.g + 1;
            const existing = open.get(nk);
            if (existing && g >= existing.g) continue;

            const node = { x: nx, z: nz, g, h: heuristic(nx, nz), parent: best };
            node.f = node.g + node.h;
            open.set(nk, node);
        }

        // Safety limit
        if (closed.size > 2000) return null;
    }
    return null;
}

// ============================================================
// PROCEDURAL TEXTURES
// ============================================================
function makeTexture(w, h, fn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    fn(ctx, w, h);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

function wallTex() {
    return makeTexture(32, 32, (ctx, w, h) => {
        ctx.fillStyle = '#3a2820'; ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 8) {
            const off = (Math.floor(y / 8) % 2) * 8;
            for (let x = 0; x < w; x += 16) {
                const v = Math.random() * 15 - 7;
                ctx.fillStyle = `rgb(${55 + v},${38 + v},${30 + v})`;
                ctx.fillRect((x + off) % w, y + 1, 13, 6);
            }
        }
        ctx.fillStyle = '#2a1a14';
        for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 1);
    });
}

function floorTex() {
    return makeTexture(32, 32, (ctx, w, h) => {
        ctx.fillStyle = '#1a1a1e'; ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 16)
            for (let x = 0; x < w; x += 16) {
                const v = Math.random() * 8;
                ctx.fillStyle = `rgb(${24 + v},${24 + v},${28 + v})`;
                ctx.fillRect(x + 1, y + 1, 14, 14);
            }
        ctx.fillStyle = '#0e0e12';
        for (let i = 0; i <= w; i += 16) { ctx.fillRect(i, 0, 1, h); ctx.fillRect(0, i, w, 1); }
    });
}

function ceilTex() {
    return makeTexture(16, 16, (ctx, w, h) => {
        ctx.fillStyle = '#222220'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 40; i++) {
            const v = Math.random() * 6;
            ctx.fillStyle = `rgba(${34 + v},${34 + v},${30 + v},0.5)`;
            ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
    });
}

function doorTex() {
    return makeTexture(32, 32, (ctx, w, h) => {
        ctx.fillStyle = '#4a3520'; ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y++) {
            const v = Math.sin(y * 0.5) * 4 + Math.random() * 2;
            ctx.fillStyle = `rgb(${70 + v},${50 + v},${30 + v})`;
            ctx.fillRect(0, y, w, 1);
        }
        ctx.strokeStyle = '#3a2510'; ctx.lineWidth = 2;
        ctx.strokeRect(4, 3, 24, 11); ctx.strokeRect(4, 17, 24, 11);
        ctx.fillStyle = '#777'; ctx.fillRect(23, 14, 3, 3);
    });
}

// ============================================================
// LEVEL BUILDER
// ============================================================
class LevelBuilder {
    constructor(scene, map) {
        this.scene = scene;
        this.map = map;
        this.wallMat = new THREE.MeshLambertMaterial({ map: wallTex() });
        this.floorMat = new THREE.MeshLambertMaterial({ map: floorTex() });
        this.ceilMat = new THREE.MeshLambertMaterial({ map: ceilTex() });
        this.doorMat = new THREE.MeshLambertMaterial({ map: doorTex() });
        this.doors = [];
        this.hidingSpots = [];
        this.items = [];
    }

    build() {
        this.buildGeometry();
        this.placeDoors();
        this.placeItems();
        this.placeHidingSpots();
        this.placeFurniture();
        this.addLights();
    }

    buildGeometry() {
        const wallGeos = [], floorGeos = [], ceilGeos = [], ventWallGeos = [], ventCeilGeos = [];
        const C = CFG.cell, H = CFG.wallH;
        const ventH = 1.3; // Low ceiling for vents
        for (let gz = 0; gz < MAP_H; gz++) {
            for (let gx = 0; gx < MAP_W; gx++) {
                const val = this.map[gz][gx];
                if (val === 0) continue;
                const { x: wx, z: wz } = gridToWorld(gx, gz);
                const fg = new THREE.PlaneGeometry(C, C); fg.rotateX(-Math.PI / 2); fg.translate(wx, 0, wz); floorGeos.push(fg);

                if (val === 2) {
                    // Vent: low ceiling
                    const cg = new THREE.PlaneGeometry(C, C); cg.rotateX(Math.PI / 2); cg.translate(wx, ventH, wz); ventCeilGeos.push(cg);
                    if (!isWalkable(this.map, gx, gz - 1)) { const wg = new THREE.PlaneGeometry(C, ventH); wg.translate(wx, ventH / 2, wz - C / 2); ventWallGeos.push(wg); }
                    if (!isWalkable(this.map, gx, gz + 1)) { const wg = new THREE.PlaneGeometry(C, ventH); wg.rotateY(Math.PI); wg.translate(wx, ventH / 2, wz + C / 2); ventWallGeos.push(wg); }
                    if (!isWalkable(this.map, gx - 1, gz)) { const wg = new THREE.PlaneGeometry(C, ventH); wg.rotateY(Math.PI / 2); wg.translate(wx - C / 2, ventH / 2, wz); ventWallGeos.push(wg); }
                    if (!isWalkable(this.map, gx + 1, gz)) { const wg = new THREE.PlaneGeometry(C, ventH); wg.rotateY(-Math.PI / 2); wg.translate(wx + C / 2, ventH / 2, wz); ventWallGeos.push(wg); }
                } else {
                    const cg = new THREE.PlaneGeometry(C, C); cg.rotateX(Math.PI / 2); cg.translate(wx, H, wz); ceilGeos.push(cg);
                    if (!isWalkable(this.map, gx, gz - 1)) { const wg = new THREE.PlaneGeometry(C, H); wg.translate(wx, H / 2, wz - C / 2); wallGeos.push(wg); }
                    if (!isWalkable(this.map, gx, gz + 1)) { const wg = new THREE.PlaneGeometry(C, H); wg.rotateY(Math.PI); wg.translate(wx, H / 2, wz + C / 2); wallGeos.push(wg); }
                    if (!isWalkable(this.map, gx - 1, gz)) { const wg = new THREE.PlaneGeometry(C, H); wg.rotateY(Math.PI / 2); wg.translate(wx - C / 2, H / 2, wz); wallGeos.push(wg); }
                    if (!isWalkable(this.map, gx + 1, gz)) { const wg = new THREE.PlaneGeometry(C, H); wg.rotateY(-Math.PI / 2); wg.translate(wx + C / 2, H / 2, wz); wallGeos.push(wg); }
                }
            }
        }
        if (wallGeos.length) { const m = this.mergeGeos(wallGeos); const mesh = new THREE.Mesh(m, this.wallMat); mesh.receiveShadow = true; this.scene.add(mesh); }
        if (floorGeos.length) { const m = this.mergeGeos(floorGeos); const mesh = new THREE.Mesh(m, this.floorMat); mesh.receiveShadow = true; this.scene.add(mesh); }
        if (ceilGeos.length) { const m = this.mergeGeos(ceilGeos); this.scene.add(new THREE.Mesh(m, this.ceilMat)); }
        // Vent geometry: reuse wall material with darker tint
        const ventMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
        if (ventWallGeos.length) { const m = this.mergeGeos(ventWallGeos); this.scene.add(new THREE.Mesh(m, ventMat)); }
        if (ventCeilGeos.length) { const m = this.mergeGeos(ventCeilGeos); this.scene.add(new THREE.Mesh(m, ventMat)); }
    }

    mergeGeos(geos) {
        const merged = new THREE.BufferGeometry();
        let totalVerts = 0, totalIdx = 0;
        for (const g of geos) { totalVerts += g.attributes.position.count; totalIdx += g.index ? g.index.count : 0; }
        const pos = new Float32Array(totalVerts * 3), norm = new Float32Array(totalVerts * 3), uv = new Float32Array(totalVerts * 2), idx = new Uint32Array(totalIdx);
        let vOff = 0, iOff = 0;
        for (const g of geos) {
            pos.set(g.attributes.position.array, vOff * 3); norm.set(g.attributes.normal.array, vOff * 3); uv.set(g.attributes.uv.array, vOff * 2);
            if (g.index) { for (let i = 0; i < g.index.count; i++) idx[iOff + i] = g.index.array[i] + vOff; iOff += g.index.count; }
            vOff += g.attributes.position.count; g.dispose();
        }
        merged.setAttribute('position', new THREE.BufferAttribute(pos, 3)); merged.setAttribute('normal', new THREE.BufferAttribute(norm, 3)); merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); merged.setIndex(new THREE.BufferAttribute(idx, 1));
        return merged;
    }

    placeDoors() {
        const doorDefs = [
            { gx: 22, gz: 10, axis: 'z', id: 'door_ca', locked: true, keyNeeded: 'fuse' }, // Power gate
            { gx: 27, gz: 10, axis: 'z', id: 'door_cb' },
            { gx: 39, gz: 22, axis: 'x', id: 'door_lib' },
            { gx: 39, gz: 27, axis: 'x', id: 'door_kit', locked: true, keyNeeded: 'bolt_cutters' }, // Chain gate
            { gx: 18, gz: 38, axis: 'z', id: 'door_chapel' },
            { gx: 27, gz: 38, axis: 'z', id: 'door_dining' },
            { gx: 9, gz: 22, axis: 'x', id: 'door_storage' },
            { gx: 9, gz: 27, axis: 'x', id: 'door_cellar', locked: true, keyNeeded: 'master_key' }, // Final exit
        ];
        for (const d of doorDefs) {
            const { x, z } = gridToWorld(d.gx, d.gz);
            const doorW = CFG.cell * 0.9;
            const doorH = CFG.wallH * 0.85;
            // Hinge pivot: door panel offset so it rotates at the edge
            const pivot = new THREE.Group();
            pivot.position.set(x, 0, z);
            const geo = new THREE.BoxGeometry(d.axis === 'z' ? 0.12 : doorW, doorH, d.axis === 'x' ? 0.12 : doorW);
            const panel = new THREE.Mesh(geo, this.doorMat.clone());
            // Offset panel so hinge is at edge
            if (d.axis === 'x') {
                panel.position.set(doorW / 2, doorH / 2, 0);
                pivot.position.x -= doorW / 2;
            } else {
                panel.position.set(0, doorH / 2, doorW / 2);
                pivot.position.z -= doorW / 2;
            }
            pivot.add(panel);
            this.scene.add(pivot);
            this.doors.push({
                mesh: pivot, panel, id: d.id, axis: d.axis,
                open: false, locked: d.locked || false, keyNeeded: d.keyNeeded || null,
                gx: d.gx, gz: d.gz,
                angle: 0, targetAngle: 0, // for rotation animation
                isAnimating: false,
                slowOpen: false, slowTimer: 0, // for hold-E slow open
            });
        }
    }

    placeItems() {
        const itemDefs = [
            // Multi-objective items
            { type: 'objective', id: 'fuse', gx: 15, gz: 9, name: 'Fuse', color: 0xff8800, emissive: 0x441100 },
            { type: 'objective', id: 'bolt_cutters', gx: 40, gz: 32, name: 'Bolt Cutters', color: 0x888899, emissive: 0x222233 },
            { type: 'objective', id: 'master_key', gx: 5, gz: 31, name: 'Master Key', color: 0xccaa44, emissive: 0x332200 },
            // Notes with clues
            { type: 'note', gx: 40, gz: 18, name: 'Torn Note', text: 'She walks these halls at night... always watching.\nThe power is out - there\'s a fuse in Classroom A.\nThe chain on the east gate needs bolt cutters.\nI hid the safe combination: 4731.\nGod help us.' },
            { type: 'note', gx: 35, gz: 39, name: 'Journal Page', text: 'The sisters have all gone. Only SHE remains.\nThe master key is locked in a safe in the cellar.\nI need the keypad code to open the safe.\nThe code... I wrote it on another note in the library.' },
            { type: 'note', gx: 13, gz: 40, name: 'Chapel Note', text: 'If you\'re reading this, take the vents.\nShe can\'t follow you through the crawlspaces.\nFind the fuse, the bolt cutters, crack the safe.\nThe cellar exit is our only way out.' },
            // Batteries
            { type: 'battery', gx: 6, gz: 19, name: 'Battery' },
            { type: 'battery', gx: 37, gz: 10, name: 'Battery' },
        ];
        for (const item of itemDefs) {
            const { x, z } = gridToWorld(item.gx, item.gz);
            let mesh;
            if (item.type === 'objective') {
                if (item.id === 'fuse') {
                    const group = new THREE.Group();
                    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 6), new THREE.MeshLambertMaterial({ color: item.color, emissive: item.emissive }));
                    body.position.y = 0.12; group.add(body);
                    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 6), new THREE.MeshLambertMaterial({ color: 0xcccccc }));
                    cap.position.y = 0.26; group.add(cap);
                    group.position.set(x, 0.8, z); mesh = group;
                } else if (item.id === 'bolt_cutters') {
                    const group = new THREE.Group();
                    const handle1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.04), new THREE.MeshLambertMaterial({ color: 0x882222 }));
                    handle1.position.set(-0.04, 0.2, 0); group.add(handle1);
                    const handle2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.04), new THREE.MeshLambertMaterial({ color: 0x882222 }));
                    handle2.position.set(0.04, 0.2, 0); group.add(handle2);
                    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.04), new THREE.MeshLambertMaterial({ color: item.color, emissive: item.emissive }));
                    jaw.position.y = 0.42; group.add(jaw);
                    group.position.set(x, 0.6, z); mesh = group;
                } else if (item.id === 'master_key') {
                    const group = new THREE.Group();
                    const ring = new THREE.TorusGeometry(0.12, 0.03, 6, 8);
                    const ringMesh = new THREE.Mesh(ring, new THREE.MeshLambertMaterial({ color: item.color, emissive: item.emissive }));
                    ringMesh.rotation.x = Math.PI / 2; ringMesh.position.y = 0.12; group.add(ringMesh);
                    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.25, 0.03), new THREE.MeshLambertMaterial({ color: item.color, emissive: item.emissive }));
                    shaft.position.y = -0.08; group.add(shaft);
                    const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.03), new THREE.MeshLambertMaterial({ color: item.color }));
                    teeth.position.set(0.04, -0.18, 0); group.add(teeth);
                    group.position.set(x, 0.9, z); mesh = group;
                }
            } else if (item.type === 'note') {
                mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), new THREE.MeshLambertMaterial({ color: 0xc9b896, emissive: 0x1a1408 }));
                mesh.position.set(x, 0.85, z); mesh.rotation.x = -0.3;
            } else if (item.type === 'battery') {
                mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 6), new THREE.MeshLambertMaterial({ color: 0x888833, emissive: 0x222200 }));
                mesh.position.set(x, 0.85, z);
            }
            this.scene.add(mesh);
            const glowColor = item.type === 'objective' ? item.color : 0xffaa44;
            const glow = new THREE.PointLight(glowColor, 0.5, 4);
            glow.position.set(x, 1.2, z); this.scene.add(glow);
            this.items.push({ ...item, mesh, glow, collected: false, wx: x, wz: z });
        }
    }

    placeHidingSpots() {
        const spots = [
            { gx: 12, gz: 11, name: 'Locker' }, { gx: 37, gz: 11, name: 'Locker' },
            { gx: 42, gz: 19, name: 'Cabinet' }, { gx: 41, gz: 33, name: 'Pantry' },
            { gx: 11, gz: 41, name: 'Confessional' }, { gx: 5, gz: 19, name: 'Crate' },
        ];
        const lockerMat = new THREE.MeshLambertMaterial({ color: 0x3a4a3a });
        for (const s of spots) {
            const { x, z } = gridToWorld(s.gx, s.gz);
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(CFG.cell * 0.8, CFG.wallH * 0.7, CFG.cell * 0.8), lockerMat);
            mesh.position.set(x, CFG.wallH * 0.35, z); this.scene.add(mesh);
            this.hidingSpots.push({ ...s, mesh, wx: x, wz: z });
        }
    }

    placeFurniture() {
        const fMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
        const aMat = new THREE.MeshLambertMaterial({ color: 0x5a4a3a });
        for (const room of [{ x1: 12, z1: 8, x2: 18, z2: 12 }, { x1: 32, z1: 8, x2: 38, z2: 12 }]) {
            for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
                const { x, z } = gridToWorld(room.x1 + 1 + col * 2, room.z1 + 1 + row * 2);
                const desk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), fMat); desk.position.set(x, 0.35, z); this.scene.add(desk);
            }
        }
        { const { x, z } = gridToWorld(13, 38); const altar = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.0, 1.2), aMat); altar.position.set(x, 0.5, z); this.scene.add(altar);
          const cr1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), new THREE.MeshLambertMaterial({ color: 0x8a7a5a })); cr1.position.set(x, 1.8, z); this.scene.add(cr1);
          const cr2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.1), new THREE.MeshLambertMaterial({ color: 0x8a7a5a })); cr2.position.set(x, 2.1, z); this.scene.add(cr2); }
        for (let row = 0; row < 3; row++) { const { x, z } = gridToWorld(13, 41 + row); const pew = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 0.5), fMat); pew.position.set(x, 0.3, z); this.scene.add(pew); }
        { const { x, z } = gridToWorld(35, 39); const t = new THREE.Mesh(new THREE.BoxGeometry(3, 0.75, 1.8), fMat); t.position.set(x, 0.375, z); this.scene.add(t); }
        { const { x, z } = gridToWorld(39, 30); const c = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 3), fMat); c.position.set(x, 0.425, z); this.scene.add(c); }
        for (let i = 0; i < 3; i++) { const { x, z } = gridToWorld(38 + i * 2, 17); const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.5, 2), fMat); s.position.set(x, 1.25, z); this.scene.add(s); }
    }

    addLights() {
        this.scene.add(new THREE.AmbientLight(0x3a3040, 2.0));
        const lps = [
            { gx: 25, gz: 25, color: 0x998877, intensity: 2.0 }, { gx: 25, gz: 14, color: 0x887766, intensity: 1.4 },
            { gx: 25, gz: 36, color: 0x887766, intensity: 1.4 }, { gx: 36, gz: 25, color: 0x887766, intensity: 1.4 },
            { gx: 14, gz: 25, color: 0x887766, intensity: 1.4 }, { gx: 15, gz: 10, color: 0x998877, intensity: 1.6 },
            { gx: 35, gz: 10, color: 0x998877, intensity: 1.6 }, { gx: 40, gz: 19, color: 0x778899, intensity: 1.6 },
            { gx: 39, gz: 31, color: 0x998877, intensity: 1.4 }, { gx: 13, gz: 40, color: 0x995555, intensity: 1.6 },
            { gx: 35, gz: 39, color: 0x998877, intensity: 1.4 }, { gx: 6, gz: 19, color: 0x778866, intensity: 1.4 },
            { gx: 6, gz: 31, color: 0x667799, intensity: 1.5 },
        ];
        for (const lp of lps) { const { x, z } = gridToWorld(lp.gx, lp.gz); const l = new THREE.PointLight(lp.color, lp.intensity, 28); l.position.set(x, CFG.wallH - 0.3, z); this.scene.add(l); }
    }
}

// ============================================================
// NUN AI STATE MACHINE
// ============================================================
const NUN_STATE = {
    PATROL: 'patrol',
    INVESTIGATE: 'investigate',
    SEARCH: 'search',
    CHASE: 'chase',
    COOLDOWN: 'cooldown',
};

// ============================================================
// GRID LINE OF SIGHT (Bresenham)
// ============================================================
function gridLineOfSight(map, x0, z0, x1, z1, doors) {
    // Bresenham line walk on the grid. Blocked by walls and closed doors.
    let dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0);
    let sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1;
    let err = dx - dz;
    let cx = x0, cz = z0;
    while (true) {
        if (cx === x1 && cz === z1) return true;
        // Check wall
        if (cx !== x0 || cz !== z0) {
            if (cx < 0 || cx >= MAP_W || cz < 0 || cz >= MAP_H || map[cz][cx] === 0) return false;
            // Check closed doors
            if (doors) {
                for (const d of doors) {
                    if (!d.open && d.gx === cx && d.gz === cz) return false;
                }
            }
        }
        const e2 = 2 * err;
        if (e2 > -dz) { err -= dz; cx += sx; }
        if (e2 < dx) { err += dx; cz += sz; }
    }
}

// ============================================================
// SOUND EVENT QUEUE
// ============================================================
const soundEvents = [];
function emitSound(x, z, loudness, source) {
    soundEvents.push({ x, z, loudness, source });
}
function drainSoundEvents() {
    const events = soundEvents.splice(0);
    return events;
}

// ============================================================
// NUN ENEMY - Humanoid model with walking animation & knife
// ============================================================
class NunEnemy {
    constructor(scene) {
        this.scene = scene;
        this.parts = {};
        this.mesh = this.createModel();
        scene.add(this.mesh);

        this.state = NUN_STATE.PATROL;
        this.speed = CFG.nunPatrolSpd;
        this.patrolIdx = 0;
        this.searchTimer = 0;
        this.lastKnownPlayerPos = null;
        this.stateTimer = 0;
        this.walkCycle = 0;

        // 5-state FSM timers
        this.reactionTimer = 0;
        this.reactionTarget = null;
        this.memoryTimer = 0;
        this.chaseTimer = 0;
        this.cooldownTimer = 0;
        this.cooldownTarget = null;
        this.investigateTarget = null;
        this.doorOpenTimer = 0;
        this.blockedDoor = null;
        this.pendingDoorOpen = null;
        this.astarPath = null;
        this.astarPathIdx = 0;
        this.pathRecalcTimer = 0;

        // Attack state
        this.attackCooldown = 0;
        this.isStabbing = false;
        this.stabTimer = 0;
        this.didHitThisSwing = false;

        this.waypoints = [
            { gx: 13, gz: 40 }, { gx: 25, gz: 36 }, { gx: 25, gz: 25 },
            { gx: 25, gz: 14 }, { gx: 35, gz: 10 }, { gx: 25, gz: 14 },
            { gx: 15, gz: 10 }, { gx: 25, gz: 14 }, { gx: 25, gz: 25 },
            { gx: 36, gz: 25 }, { gx: 40, gz: 19 }, { gx: 36, gz: 25 },
            { gx: 39, gz: 31 }, { gx: 36, gz: 25 }, { gx: 25, gz: 25 },
            { gx: 14, gz: 25 }, { gx: 6, gz: 19 }, { gx: 14, gz: 25 },
            { gx: 25, gz: 25 }, { gx: 25, gz: 36 }, { gx: 35, gz: 39 },
            { gx: 25, gz: 36 },
        ].map(w => gridToWorld(w.gx, w.gz));

        const start = this.waypoints[0];
        this.mesh.position.set(start.x, 0, start.z);
    }

    createModel() {
        const group = new THREE.Group();
        const black = new THREE.MeshLambertMaterial({ color: 0x050505 });
        const skin = new THREE.MeshLambertMaterial({ color: 0xb8a080 });
        const white = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
        const metal = new THREE.MeshLambertMaterial({ color: 0xaab0b8, emissive: 0x222233 });
        const darkSkin = new THREE.MeshLambertMaterial({ color: 0x806858 });

        // Scale factor - nun is ~2.3m tall (towering over player at 1.6m)
        const S = 1.25;

        // Torso (elongated, gaunt)
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55 * S, 1.1 * S, 0.3 * S), black);
        torso.position.y = 1.5 * S;
        group.add(torso);
        this.parts.torso = torso;

        // Robe skirt (long, flowing to ground)
        const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * S, 0.5 * S, 1.2 * S, 8), black);
        skirt.position.y = 0.5 * S;
        group.add(skirt);
        this.parts.skirt = skirt;

        // Head (slightly gaunt)
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2 * S, 8, 6), darkSkin);
        head.position.y = 2.25 * S;
        head.scale.set(1, 1.1, 0.95);
        group.add(head);
        this.parts.head = head;

        // Sunken cheeks
        for (let side = -1; side <= 1; side += 2) {
            const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.06 * S, 6, 4), darkSkin);
            cheek.position.set(side * 0.12 * S, 2.18 * S, 0.1 * S);
            cheek.scale.set(1, 1.3, 0.5);
            group.add(cheek);
        }

        // Wimple (white band around face, stained)
        const wimple = new THREE.Mesh(new THREE.BoxGeometry(0.5 * S, 0.2 * S, 0.44 * S), white);
        wimple.position.y = 2.35 * S;
        group.add(wimple);

        // Veil (tall, pointed, imposing)
        const veil = new THREE.Mesh(new THREE.ConeGeometry(0.3 * S, 0.6 * S, 4), black);
        veil.position.y = 2.7 * S;
        group.add(veil);

        // Veil drape down back (longer)
        const veilBack = new THREE.Mesh(new THREE.BoxGeometry(0.55 * S, 0.9 * S, 0.15 * S), black);
        veilBack.position.set(0, 2.0 * S, -0.18 * S);
        group.add(veilBack);

        // Veil side drapes
        for (let side = -1; side <= 1; side += 2) {
            const sideDrape = new THREE.Mesh(new THREE.BoxGeometry(0.08 * S, 0.6 * S, 0.3 * S), black);
            sideDrape.position.set(side * 0.28 * S, 2.0 * S, -0.05 * S);
            group.add(sideDrape);
        }

        // Eyes (glowing red, larger, menacing)
        for (let side = -1; side <= 1; side += 2) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04 * S, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
            eye.position.set(side * 0.08 * S, 2.27 * S, 0.18 * S);
            group.add(eye);
            // Dark rings around eyes
            const ring = new THREE.Mesh(new THREE.RingGeometry(0.04 * S, 0.06 * S, 8), new THREE.MeshBasicMaterial({ color: 0x200000, side: THREE.DoubleSide }));
            ring.position.set(side * 0.08 * S, 2.27 * S, 0.19 * S);
            group.add(ring);
        }

        // Mouth (dark slit)
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.1 * S, 0.02 * S, 0.02 * S), new THREE.MeshBasicMaterial({ color: 0x200000 }));
        mouth.position.set(0, 2.15 * S, 0.2 * S);
        group.add(mouth);

        // LEFT ARM (long, skeletal)
        const leftArm = new THREE.Group();
        const leftUpper = new THREE.Mesh(new THREE.BoxGeometry(0.12 * S, 0.6 * S, 0.12 * S), black);
        leftUpper.position.y = -0.3 * S;
        leftArm.add(leftUpper);
        const leftFore = new THREE.Mesh(new THREE.BoxGeometry(0.1 * S, 0.5 * S, 0.1 * S), black);
        leftFore.position.y = -0.65 * S;
        leftArm.add(leftFore);
        const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.1 * S, 0.12 * S, 0.06 * S), skin);
        leftHand.position.y = -0.92 * S;
        leftArm.add(leftHand);
        leftArm.position.set(-0.38 * S, 1.95 * S, 0);
        group.add(leftArm);
        this.parts.leftArm = leftArm;

        // RIGHT ARM (holds knife, long)
        const rightArm = new THREE.Group();
        const rightUpper = new THREE.Mesh(new THREE.BoxGeometry(0.12 * S, 0.6 * S, 0.12 * S), black);
        rightUpper.position.y = -0.3 * S;
        rightArm.add(rightUpper);
        const rightFore = new THREE.Mesh(new THREE.BoxGeometry(0.1 * S, 0.5 * S, 0.1 * S), black);
        rightFore.position.y = -0.65 * S;
        rightArm.add(rightFore);
        const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.1 * S, 0.12 * S, 0.06 * S), skin);
        rightHand.position.y = -0.92 * S;
        rightArm.add(rightHand);

        // Knife - long thin blade
        const knifeGroup = new THREE.Group();
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.015 * S, 0.4 * S, 0.04 * S), metal);
        blade.position.y = -0.22 * S;
        knifeGroup.add(blade);
        // Sharp pointed tip
        const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(0.02 * S, 0.12 * S, 4), metal);
        bladeTip.rotation.z = Math.PI; // point downward
        bladeTip.position.y = -0.48 * S;
        knifeGroup.add(bladeTip);
        // Guard
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.06 * S, 0.02 * S, 0.06 * S), metal);
        guard.position.y = 0.0;
        knifeGroup.add(guard);
        // Handle
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03 * S, 0.14 * S, 0.03 * S), new THREE.MeshLambertMaterial({ color: 0x2a1a0a }));
        handle.position.y = 0.08 * S;
        knifeGroup.add(handle);
        knifeGroup.position.y = -0.95 * S;
        rightArm.add(knifeGroup);
        this.parts.knife = knifeGroup;

        rightArm.position.set(0.38 * S, 1.95 * S, 0);
        group.add(rightArm);
        this.parts.rightArm = rightArm;

        // LEFT LEG (hidden under robe)
        const leftLeg = new THREE.Group();
        const leftThigh = new THREE.Mesh(new THREE.BoxGeometry(0.14 * S, 0.5 * S, 0.14 * S), black);
        leftThigh.position.y = -0.25 * S;
        leftLeg.add(leftThigh);
        const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.14 * S, 0.08 * S, 0.22 * S), new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
        leftFoot.position.set(0, -0.54 * S, 0.03 * S);
        leftLeg.add(leftFoot);
        leftLeg.position.set(-0.14 * S, 1.0 * S, 0);
        group.add(leftLeg);
        this.parts.leftLeg = leftLeg;

        // RIGHT LEG
        const rightLeg = new THREE.Group();
        const rightThigh = new THREE.Mesh(new THREE.BoxGeometry(0.14 * S, 0.5 * S, 0.14 * S), black);
        rightThigh.position.y = -0.25 * S;
        rightLeg.add(rightThigh);
        const rightFoot = new THREE.Mesh(new THREE.BoxGeometry(0.14 * S, 0.08 * S, 0.22 * S), new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
        rightFoot.position.set(0, -0.54 * S, 0.03 * S);
        rightLeg.add(rightFoot);
        rightLeg.position.set(0.14 * S, 1.0 * S, 0);
        group.add(rightLeg);
        this.parts.rightLeg = rightLeg;

        // Eerie glow (stronger, redder)
        const glow = new THREE.PointLight(0xff1100, 0.5, 8);
        glow.position.y = 2.5 * S;
        group.add(glow);

        return group;
    }

    animate(dt, isMoving) {
        const chasing = this.state === NUN_STATE.CHASE;
        const walkSpeed = chasing ? 12 : 5;
        const swingAmount = chasing ? 0.6 : 0.35;

        if (isMoving) {
            this.walkCycle += dt * walkSpeed;
        }

        const swing = Math.sin(this.walkCycle) * swingAmount;

        // Leg swing (opposite legs)
        this.parts.leftLeg.rotation.x = swing;
        this.parts.rightLeg.rotation.x = -swing;

        // Arm swing (opposite to legs, less during chase since right arm holds knife up)
        this.parts.leftArm.rotation.x = -swing * 0.7;

        if (this.isStabbing) {
            // Stab animation: raise knife arm then thrust forward
            this.stabTimer += dt;
            const stabPhase = this.stabTimer / 0.5; // 0.5s total stab
            if (stabPhase < 0.3) {
                // Wind up - raise arm
                this.parts.rightArm.rotation.x = -1.8 * (stabPhase / 0.3);
            } else if (stabPhase < 0.6) {
                // Thrust forward
                const t = (stabPhase - 0.3) / 0.3;
                this.parts.rightArm.rotation.x = -1.8 + 2.8 * t;
            } else {
                // Return to idle
                const t = Math.min(1, (stabPhase - 0.6) / 0.4);
                this.parts.rightArm.rotation.x = 1.0 * (1 - t);
                if (stabPhase >= 1.0) {
                    this.isStabbing = false;
                    this.stabTimer = 0;
                }
            }
        } else if (chasing) {
            // In chase mode, hold knife arm forward/up menacingly
            this.parts.rightArm.rotation.x = -0.8 + Math.sin(this.walkCycle * 0.5) * 0.2;
        } else {
            // Normal walk: gentle arm swing
            this.parts.rightArm.rotation.x = swing * 0.4;
        }

        // Subtle body sway
        this.parts.torso.rotation.z = Math.sin(this.walkCycle) * 0.03;

        // Head slight bob
        this.parts.head.position.y = 2.25 * 1.25 + Math.abs(Math.sin(this.walkCycle)) * 0.025;
    }

    startStab() {
        if (this.isStabbing) return false;
        this.isStabbing = true;
        this.stabTimer = 0;
        this.didHitThisSwing = false;
        return true;
    }

    // Returns true if the stab connected this frame (at the thrust point of the animation)
    checkStabHit() {
        if (!this.isStabbing || this.didHitThisSwing) return false;
        const stabPhase = this.stabTimer / 0.5;
        if (stabPhase >= 0.4 && stabPhase <= 0.6) {
            this.didHitThisSwing = true;
            return true;
        }
        return false;
    }

    update(dt, playerPos, playerHiding, playerSprinting, map, doors) {
        this.stateTimer += dt;
        if (this.attackCooldown > 0) this.attackCooldown -= dt;

        // Process sound events
        const sounds = drainSoundEvents();
        let loudestSound = null;
        for (const s of sounds) {
            const dx = s.x - this.mesh.position.x;
            const dz = s.z - this.mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist <= s.loudness) {
                if (!loudestSound || s.loudness > loudestSound.loudness) {
                    loudestSound = s;
                }
            }
        }

        let isMoving = false;

        switch (this.state) {
            case NUN_STATE.PATROL: isMoving = this.updatePatrol(dt, playerPos, playerHiding, map, doors, loudestSound); break;
            case NUN_STATE.INVESTIGATE: isMoving = this.updateInvestigate(dt, playerPos, playerHiding, map, doors, loudestSound); break;
            case NUN_STATE.SEARCH: isMoving = this.updateSearch(dt, playerPos, playerHiding, map, doors, loudestSound); break;
            case NUN_STATE.CHASE: isMoving = this.updateChase(dt, playerPos, playerHiding, map, doors); break;
            case NUN_STATE.COOLDOWN: isMoving = this.updateCooldown(dt, map); break;
        }

        this.animate(dt, isMoving);
    }

    canSeePlayer(playerPos, playerHiding, map, doors) {
        if (playerHiding) return false;
        const dx = playerPos.x - this.mesh.position.x;
        const dz = playerPos.z - this.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > CFG.nunSightRange) return false;
        const angle = Math.atan2(dx, dz);
        const facing = this.mesh.rotation.y;
        let angleDiff = Math.abs(angle - facing);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
        if (angleDiff >= CFG.nunSightAngle) return false;
        // Grid-based LOS check (Bresenham)
        const ng = worldToGrid(this.mesh.position.x, this.mesh.position.z);
        const pg = worldToGrid(playerPos.x, playerPos.z);
        return gridLineOfSight(map, ng.x, ng.z, pg.x, pg.z, doors);
    }

    moveToward(target, speed, dt, map, doors) {
        const dx = target.x - this.mesh.position.x;
        const dz = target.z - this.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.5) return false;
        const nx = dx / dist, nz = dz / dist;
        const newX = this.mesh.position.x + nx * speed * dt;
        const newZ = this.mesh.position.z + nz * speed * dt;
        const g = worldToGrid(newX, newZ);

        // Check if a closed door is blocking
        if (doors) {
            for (const d of doors) {
                if (d.open || d.locked || d.isAnimating) continue;
                if (d.angle > Math.PI / 4) continue;
                const ddx = Math.abs(newX - d.mesh.position.x);
                const ddz = Math.abs(newZ - d.mesh.position.z);
                if (ddx < 1.0 && ddz < 1.0) {
                    // Door is blocking - start open timer
                    if (this.blockedDoor !== d) {
                        this.blockedDoor = d;
                        this.doorOpenTimer = 0.5;
                    }
                    this.doorOpenTimer -= dt;
                    if (this.doorOpenTimer <= 0) {
                        this.blockedDoor = null;
                        return { blocked: true, door: d };
                    }
                    // Face the door while waiting
                    const targetRot = Math.atan2(dx, dz);
                    let rotDiff = targetRot - this.mesh.rotation.y;
                    while (rotDiff > Math.PI) rotDiff -= 2 * Math.PI;
                    while (rotDiff < -Math.PI) rotDiff += 2 * Math.PI;
                    this.mesh.rotation.y += rotDiff * Math.min(1, dt * 8);
                    return false;
                }
            }
        }
        this.blockedDoor = null;

        if (isWalkableForNun(map, g.x, g.z)) {
            this.mesh.position.x = newX;
            this.mesh.position.z = newZ;
        }
        const targetRot = Math.atan2(dx, dz);
        let rotDiff = targetRot - this.mesh.rotation.y;
        while (rotDiff > Math.PI) rotDiff -= 2 * Math.PI;
        while (rotDiff < -Math.PI) rotDiff += 2 * Math.PI;
        this.mesh.rotation.y += rotDiff * Math.min(1, dt * 8);
        return true;
    }

    // Find nearest waypoint to current position
    nearestWaypoint() {
        let best = 0, bestDist = Infinity;
        for (let i = 0; i < this.waypoints.length; i++) {
            const dx = this.waypoints[i].x - this.mesh.position.x;
            const dz = this.waypoints[i].z - this.mesh.position.z;
            const d = dx * dx + dz * dz;
            if (d < bestDist) { bestDist = d; best = i; }
        }
        return best;
    }

    // Begin reaction delay before transitioning to chase
    beginReaction(playerPos) {
        this.reactionTimer = CFG.nunReactionDelayMin + Math.random() * (CFG.nunReactionDelayMax - CFG.nunReactionDelayMin);
        this.reactionTarget = { x: playerPos.x, z: playerPos.z };
    }

    updatePatrol(dt, playerPos, playerHiding, map, doors, loudestSound) {
        this.speed = CFG.nunPatrolSpd;

        // Check vision with reaction delay
        if (this.reactionTimer > 0) {
            this.reactionTimer -= dt;
            if (this.reactionTimer <= 0) {
                this.enterChase(this.reactionTarget);
                return true;
            }
        } else if (this.canSeePlayer(playerPos, playerHiding, map, doors)) {
            this.beginReaction(playerPos);
        }

        // Check hearing -> investigate
        if (loudestSound && this.state === NUN_STATE.PATROL) {
            this.enterInvestigate({ x: loudestSound.x, z: loudestSound.z });
            return true;
        }

        const target = this.waypoints[this.patrolIdx];
        const result = this.moveToward(target, this.speed, dt, map, doors);
        if (result && result.blocked) { this.pendingDoorOpen = result.door; return false; }
        if (!result) this.patrolIdx = (this.patrolIdx + 1) % this.waypoints.length;
        return !!result;
    }

    updateInvestigate(dt, playerPos, playerHiding, map, doors, loudestSound) {
        this.speed = CFG.nunInvestigateSpd;

        if (this.reactionTimer > 0) {
            this.reactionTimer -= dt;
            if (this.reactionTimer <= 0) {
                this.enterChase(this.reactionTarget);
                return true;
            }
        } else if (this.canSeePlayer(playerPos, playerHiding, map, doors)) {
            this.beginReaction(playerPos);
        }

        if (loudestSound) {
            this.investigateTarget = { x: loudestSound.x, z: loudestSound.z };
        }

        if (this.investigateTarget) {
            const result = this.moveToward(this.investigateTarget, this.speed, dt, map, doors);
            if (result && result.blocked) { this.pendingDoorOpen = result.door; return false; }
            if (!result) this.enterSearch();
            return !!result;
        }
        return false;
    }

    updateSearch(dt, playerPos, playerHiding, map, doors, loudestSound) {
        this.speed = CFG.nunSearchSpd;
        this.searchTimer -= dt;

        if (this.reactionTimer > 0) {
            this.reactionTimer -= dt;
            if (this.reactionTimer <= 0) {
                this.enterChase(this.reactionTarget);
                return true;
            }
        } else if (this.canSeePlayer(playerPos, playerHiding, map, doors)) {
            this.beginReaction(playerPos);
        }

        if (loudestSound) {
            this.lastKnownPlayerPos = { x: loudestSound.x, z: loudestSound.z };
            this.searchTimer = CFG.nunSearchTimeMin + Math.random() * (CFG.nunSearchTimeMax - CFG.nunSearchTimeMin);
        }

        if (this.searchTimer <= 0) {
            this.enterCooldown();
            return false;
        }

        if (this.lastKnownPlayerPos) {
            const result = this.moveToward(this.lastKnownPlayerPos, this.speed, dt, map, doors);
            if (result && result.blocked) { this.pendingDoorOpen = result.door; return false; }
            if (!result) this.mesh.rotation.y += dt * 2;
            return !!result;
        }
        this.mesh.rotation.y += dt * 2;
        return false;
    }

    updateChase(dt, playerPos, playerHiding, map, doors) {
        this.speed = CFG.nunChaseSpd;
        this.chaseTimer += dt;

        // Fairness cap: force cooldown after max chase time
        if (this.chaseTimer >= CFG.nunMaxChaseTime) {
            this.enterCooldown();
            return false;
        }

        // If player hiding, start memory countdown
        if (playerHiding) {
            this.memoryTimer -= dt;
            if (this.memoryTimer <= 0) {
                this.enterSearch();
                return false;
            }
            if (this.lastKnownPlayerPos) {
                const r = this.moveToward(this.lastKnownPlayerPos, this.speed, dt, map, doors);
                if (r && r.blocked) { this.pendingDoorOpen = r.door; return false; }
                return !!r;
            }
            return false;
        }

        // Check LOS
        const hasLOS = this.canSeePlayer(playerPos, false, map, doors);
        if (hasLOS) {
            this.lastKnownPlayerPos = { x: playerPos.x, z: playerPos.z };
            this.memoryTimer = CFG.nunMemoryDuration;
        } else {
            // Lost LOS - use memory timer
            this.memoryTimer -= dt;
            if (this.memoryTimer <= 0) {
                this.enterSearch();
                return false;
            }
        }

        const chaseTarget = hasLOS ? playerPos : this.lastKnownPlayerPos;
        if (!chaseTarget) { this.enterSearch(); return false; }

        const dist = this.distToPlayer(playerPos);
        // If close enough, try to stab
        if (dist < CFG.nunStabDist) {
            if (this.attackCooldown <= 0 && !this.isStabbing) {
                this.startStab();
                this.attackCooldown = CFG.nunAttackCd;
            }
            const dx = playerPos.x - this.mesh.position.x;
            const dz = playerPos.z - this.mesh.position.z;
            const targetRot = Math.atan2(dx, dz);
            let rotDiff = targetRot - this.mesh.rotation.y;
            while (rotDiff > Math.PI) rotDiff -= 2 * Math.PI;
            while (rotDiff < -Math.PI) rotDiff += 2 * Math.PI;
            this.mesh.rotation.y += rotDiff * Math.min(1, dt * 10);
            return false;
        }

        // Use A* when no LOS to pathfind around corners
        if (hasLOS) {
            this.astarPath = null;
            const result = this.moveToward(chaseTarget, this.speed, dt, map, doors);
            if (result && result.blocked) { this.pendingDoorOpen = result.door; return false; }
            return !!result;
        }

        // Recalculate A* path periodically
        this.pathRecalcTimer -= dt;
        if (!this.astarPath || this.pathRecalcTimer <= 0) {
            const ng = worldToGrid(this.mesh.position.x, this.mesh.position.z);
            const tg = worldToGrid(chaseTarget.x, chaseTarget.z);
            this.astarPath = astarPath(map, ng.x, ng.z, tg.x, tg.z);
            this.astarPathIdx = 0;
            this.pathRecalcTimer = 1.0; // recalc every 1s
        }

        if (this.astarPath && this.astarPathIdx < this.astarPath.length) {
            const node = this.astarPath[this.astarPathIdx];
            const wp = gridToWorld(node.x, node.z);
            const result = this.moveToward(wp, this.speed, dt, map, doors);
            if (result && result.blocked) { this.pendingDoorOpen = result.door; return false; }
            if (!result) this.astarPathIdx++; // reached waypoint, move to next
            return true;
        }

        // Fallback: direct movement
        const result = this.moveToward(chaseTarget, this.speed, dt, map, doors);
        if (result && result.blocked) { this.pendingDoorOpen = result.door; return false; }
        return !!result;
    }

    updateCooldown(dt, map) {
        this.cooldownTimer -= dt;
        if (this.cooldownTimer <= 0) {
            this.state = NUN_STATE.PATROL;
            this.stateTimer = 0;
            this.patrolIdx = this.nearestWaypoint();
            return false;
        }
        // Walk back to nearest waypoint, ignoring all stimuli
        if (this.cooldownTarget) {
            const moved = this.moveToward(this.cooldownTarget, CFG.nunPatrolSpd, dt, map);
            return moved;
        }
        return false;
    }

    enterChase(playerPos) {
        this.state = NUN_STATE.CHASE;
        this.stateTimer = 0;
        this.chaseTimer = 0;
        this.memoryTimer = CFG.nunMemoryDuration;
        this.reactionTimer = 0;
        this.lastKnownPlayerPos = { x: playerPos.x, z: playerPos.z };
    }

    enterSearch() {
        this.state = NUN_STATE.SEARCH;
        this.stateTimer = 0;
        this.searchTimer = CFG.nunSearchTimeMin + Math.random() * (CFG.nunSearchTimeMax - CFG.nunSearchTimeMin);
        this.reactionTimer = 0;
    }

    enterInvestigate(pos) {
        this.state = NUN_STATE.INVESTIGATE;
        this.stateTimer = 0;
        this.investigateTarget = { x: pos.x, z: pos.z };
        this.reactionTimer = 0;
    }

    enterCooldown() {
        this.state = NUN_STATE.COOLDOWN;
        this.stateTimer = 0;
        this.cooldownTimer = CFG.nunCooldownDuration;
        this.reactionTimer = 0;
        const wpIdx = this.nearestWaypoint();
        this.cooldownTarget = this.waypoints[wpIdx];
    }

    distToPlayer(playerPos) { const dx = playerPos.x - this.mesh.position.x, dz = playerPos.z - this.mesh.position.z; return Math.sqrt(dx * dx + dz * dz); }
}

// ============================================================
// AUDIO MANAGER - Tension-driven layered system
// ============================================================
class AudioManager {
    constructor() {
        this.ctx = null;
        this.initialized = false;
        this.tension = 0; // [0,1] scalar
        this.creakTimer = 0;
        // Layer gain nodes
        this.droneGain = null;
        this.heartbeatGain = null;
        this.breathingGain = null;
        this.chaseMusicGain = null;
        this.creakGain = null;
        this.heartbeatInterval = null;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.ctx.destination);
            this.setupLayers();
            this.initialized = true;
        } catch (e) { console.warn('Audio not available'); }
    }

    setupLayers() {
        if (!this.ctx) return;
        // Ambient drone (always on)
        this.droneGain = this.ctx.createGain();
        this.droneGain.gain.value = 0.06;
        this.droneGain.connect(this.masterGain);
        const drone1 = this.ctx.createOscillator(); drone1.type = 'sine'; drone1.frequency.value = 40;
        drone1.connect(this.droneGain); drone1.start();
        const drone2 = this.ctx.createOscillator(); drone2.type = 'sine'; drone2.frequency.value = 880;
        const d2g = this.ctx.createGain(); d2g.gain.value = 0.008;
        const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.1;
        const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 0.005;
        lfo.connect(lfoGain); lfoGain.connect(d2g.gain); lfo.start();
        drone2.connect(d2g); d2g.connect(this.droneGain); drone2.start();

        // Heartbeat layer (tension > 0.3)
        this.heartbeatGain = this.ctx.createGain();
        this.heartbeatGain.gain.value = 0;
        this.heartbeatGain.connect(this.masterGain);

        // Breathing layer (tension > 0.4)
        this.breathingGain = this.ctx.createGain();
        this.breathingGain.gain.value = 0;
        this.breathingGain.connect(this.masterGain);
        const breathOsc = this.ctx.createOscillator(); breathOsc.type = 'sine'; breathOsc.frequency.value = 120;
        const breathLfo = this.ctx.createOscillator(); breathLfo.frequency.value = 0.5;
        const breathLfoGain = this.ctx.createGain(); breathLfoGain.gain.value = 60;
        breathLfo.connect(breathLfoGain); breathLfoGain.connect(breathOsc.frequency); breathLfo.start();
        const breathFilter = this.ctx.createBiquadFilter(); breathFilter.type = 'bandpass'; breathFilter.frequency.value = 400; breathFilter.Q.value = 2;
        breathOsc.connect(breathFilter); breathFilter.connect(this.breathingGain); breathOsc.start();

        // Chase music layer (tension > 0.6) - dissonant strings/stinger
        this.chaseMusicGain = this.ctx.createGain();
        this.chaseMusicGain.gain.value = 0;
        this.chaseMusicGain.connect(this.masterGain);
        // Tremolo string cluster (E2, Bb2, E3 - tritone dissonance)
        const chaseFilter = this.ctx.createBiquadFilter();
        chaseFilter.type = 'lowpass'; chaseFilter.frequency.value = 800; chaseFilter.Q.value = 2;
        chaseFilter.connect(this.chaseMusicGain);
        for (const freq of [82.4, 116.5, 165]) {
            const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
            const g = this.ctx.createGain(); g.gain.value = 0.08;
            // Tremolo LFO for urgency
            const trem = this.ctx.createOscillator(); trem.frequency.value = 6 + Math.random() * 2;
            const tremG = this.ctx.createGain(); tremG.gain.value = 0.04;
            trem.connect(tremG); tremG.connect(g.gain); trem.start();
            o.connect(g); g.connect(chaseFilter); o.start();
        }

        // Environmental creaks (low tension only)
        this.creakGain = this.ctx.createGain();
        this.creakGain.gain.value = 0;
        this.creakGain.connect(this.masterGain);
    }

    updateTension(dt, nunState, nunDist) {
        // Target tension based on nun state and distance
        let target = 0;
        if (nunState === NUN_STATE.CHASE) {
            target = Math.max(0.6, 1.0 - nunDist / 20);
        } else if (nunState === NUN_STATE.SEARCH || nunState === NUN_STATE.INVESTIGATE) {
            target = 0.3;
        } else if (nunDist < 12) {
            target = 0.15 * (1 - nunDist / 12);
        }

        // Rise fast (3.0/s), fall slow (0.5/s)
        if (target > this.tension) {
            this.tension = Math.min(1, this.tension + 3.0 * dt);
        } else {
            this.tension = Math.max(0, this.tension - 0.5 * dt);
        }

        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const ramp = 0.1;

        // Heartbeat: plays above 0.3
        const hbVol = this.tension > 0.3 ? Math.min(0.12, (this.tension - 0.3) * 0.3) : 0;
        this.heartbeatGain.gain.linearRampToValueAtTime(hbVol, t + ramp);

        // Breathing: above 0.4
        const brVol = this.tension > 0.4 ? Math.min(0.04, (this.tension - 0.4) * 0.08) : 0;
        this.breathingGain.gain.linearRampToValueAtTime(brVol, t + ramp);

        // Chase music: above 0.6
        const cmVol = this.tension > 0.6 ? Math.min(0.12, (this.tension - 0.6) * 0.3) : 0;
        this.chaseMusicGain.gain.linearRampToValueAtTime(cmVol, t + ramp);

        // Environmental creaks (only when tension is low)
        this.creakTimer -= dt;
        if (this.tension < 0.2 && this.creakTimer <= 0) {
            this.playCreak();
            this.creakTimer = 4 + Math.random() * 12;
        }

        // Heartbeat scheduling
        this.scheduleHeartbeat(dt);
    }

    scheduleHeartbeat(dt) {
        if (!this.ctx || this.tension <= 0.3) return;
        if (!this._hbTimer) this._hbTimer = 0;
        this._hbTimer -= dt;
        if (this._hbTimer <= 0) {
            const rate = 0.4 + (1 - this.tension) * 0.6; // faster at high tension
            this._hbTimer = rate;
            const now = this.ctx.currentTime;
            // Double-thump heartbeat
            for (let i = 0; i < 2; i++) {
                const osc = this.ctx.createOscillator(); osc.type = 'sine';
                osc.frequency.value = 45 + i * 10;
                const g = this.ctx.createGain();
                const offset = i * 0.12;
                g.gain.setValueAtTime(0.15, now + offset);
                g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
                osc.connect(g); g.connect(this.heartbeatGain);
                osc.start(now + offset); osc.stop(now + offset + 0.15);
            }
        }
    }

    playCreak() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const freq = 200 + Math.random() * 400;
        const osc = this.ctx.createOscillator(); osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.6);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.03, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass'; filter.frequency.value = 300; filter.Q.value = 5;
        osc.connect(filter); filter.connect(g); g.connect(this.masterGain);
        osc.start(now); osc.stop(now + 0.6);
    }

    playFootstep(sprinting) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const dur = sprinting ? 0.10 : 0.12;
        const vol = sprinting ? 0.18 : 0.10;
        // Noise burst through lowpass filter = concrete/stone footstep
        const bufLen = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource(); src.buffer = buf;
        const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass';
        filter.frequency.value = sprinting ? 600 + Math.random() * 200 : 400 + Math.random() * 150;
        filter.Q.value = 0.8;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        src.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
        src.start(now); src.stop(now + dur);
        // Subtle heel impact
        const thud = this.ctx.createOscillator(); thud.type = 'sine';
        thud.frequency.value = 50 + Math.random() * 20;
        const tGain = this.ctx.createGain();
        tGain.gain.setValueAtTime(vol * 0.5, now);
        tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        thud.connect(tGain); tGain.connect(this.masterGain); thud.start(now); thud.stop(now + 0.06);
    }

    playNunFootstep(distance) {
        if (!this.ctx || distance > 25) return;
        const now = this.ctx.currentTime;
        const vol = Math.max(0.01, 0.15 * (1 - distance / 25));
        // Heavy shoe on stone - noise burst with low filter
        const dur = 0.18;
        const bufLen = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource(); src.buffer = buf;
        const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass';
        filter.frequency.value = 300 + Math.random() * 100;
        filter.Q.value = 1.0;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        src.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
        src.start(now); src.stop(now + dur);
        // Heavy heel thud
        const thud = this.ctx.createOscillator(); thud.type = 'sine';
        thud.frequency.value = 35 + Math.random() * 10;
        const tGain = this.ctx.createGain();
        tGain.gain.setValueAtTime(vol * 0.8, now);
        tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        thud.connect(tGain); tGain.connect(this.masterGain); thud.start(now); thud.stop(now + 0.1);
    }

    playStab() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        // Knife impact: filtered noise burst (wet thud) + low thump
        const dur = 0.15;
        const bufLen = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource(); src.buffer = buf;
        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 1;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        src.connect(lp); lp.connect(gain); gain.connect(this.masterGain);
        src.start(now); src.stop(now + dur);
        // Deep body impact thump
        const thud = this.ctx.createOscillator(); thud.type = 'sine'; thud.frequency.value = 50;
        const tGain = this.ctx.createGain();
        tGain.gain.setValueAtTime(0.18, now); tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        thud.connect(tGain); tGain.connect(this.masterGain); thud.start(now); thud.stop(now + 0.12);
    }

    playHurt() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const dur = 0.6;
        // Scream: noise burst shaped like a vocal cry (rising then falling pitch)
        const bufLen = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource(); src.buffer = buf;
        // Bandpass to shape it like a voice
        const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.setValueAtTime(600, now);
        bp.frequency.linearRampToValueAtTime(1200, now + 0.08); // rising scream
        bp.frequency.linearRampToValueAtTime(800, now + dur); // trails off
        bp.Q.value = 4;
        // Second formant for realism
        const bp2 = this.ctx.createBiquadFilter(); bp2.type = 'bandpass';
        bp2.frequency.value = 2200; bp2.Q.value = 3;
        const g2 = this.ctx.createGain(); g2.gain.value = 0.3;
        // Envelope: sharp attack, sustain, decay
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.03);
        gain.gain.setValueAtTime(0.2, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        src.connect(bp); bp.connect(gain);
        // Second formant path
        const src2 = this.ctx.createBufferSource(); src2.buffer = buf;
        src2.connect(bp2); bp2.connect(g2); g2.connect(gain);
        gain.connect(this.masterGain);
        src.start(now); src.stop(now + dur);
        src2.start(now); src2.stop(now + dur);
    }

    playNunVocal(distance) {
        if (!this.ctx || distance > 20) return;
        const now = this.ctx.currentTime;
        const vol = Math.max(0.02, 0.2 * (1 - distance / 20));
        const dur = 0.8 + Math.random() * 0.6;
        // Guttural moan/growl: noise through narrow bandpass + pitch modulation
        const bufLen = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource(); src.buffer = buf;
        // Vocal formant: tight bandpass for eerie moan
        const bp1 = this.ctx.createBiquadFilter(); bp1.type = 'bandpass';
        const baseFreq = 180 + Math.random() * 80;
        bp1.frequency.setValueAtTime(baseFreq, now);
        bp1.frequency.linearRampToValueAtTime(baseFreq * 1.5, now + dur * 0.3);
        bp1.frequency.linearRampToValueAtTime(baseFreq * 0.7, now + dur);
        bp1.Q.value = 8;
        // Second formant (higher, thinner)
        const bp2 = this.ctx.createBiquadFilter(); bp2.type = 'bandpass';
        bp2.frequency.value = 600 + Math.random() * 200; bp2.Q.value = 6;
        const g2 = this.ctx.createGain(); g2.gain.value = 0.15;
        // Tremolo for unnatural warble
        const trem = this.ctx.createOscillator(); trem.frequency.value = 5 + Math.random() * 8;
        const tremG = this.ctx.createGain(); tremG.gain.value = vol * 0.4;
        // Envelope
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.05);
        gain.gain.setValueAtTime(vol * 0.8, now + dur * 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        trem.connect(tremG); tremG.connect(gain.gain); trem.start(now); trem.stop(now + dur);
        src.connect(bp1); bp1.connect(gain);
        const src2 = this.ctx.createBufferSource(); src2.buffer = buf;
        src2.connect(bp2); bp2.connect(g2); g2.connect(gain);
        gain.connect(this.masterGain);
        src.start(now); src.stop(now + dur);
        src2.start(now); src2.stop(now + dur);
    }

    playDoorOpen() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator(); osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now); osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
        const gain = this.ctx.createGain(); gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain); gain.connect(this.masterGain); osc.start(now); osc.stop(now + 0.3);
    }

    playPickup() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator(); osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now); osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        const gain = this.ctx.createGain(); gain.gain.setValueAtTime(0.12, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain); gain.connect(this.masterGain); osc.start(now); osc.stop(now + 0.2);
    }

    playDeath() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        for (let i = 0; i < 8; i++) {
            const osc = this.ctx.createOscillator(); osc.type = 'sawtooth';
            osc.frequency.value = 60 + Math.random() * 150;
            const gain = this.ctx.createGain(); gain.gain.setValueAtTime(0.12, now + i * 0.08); gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.4);
            osc.connect(gain); gain.connect(this.masterGain); osc.start(now + i * 0.08); osc.stop(now + i * 0.08 + 0.4);
        }
    }

    setChaseMode(active) {
        // Now handled by tension system, keep for compatibility
    }

    playLocked() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator(); osc.type = 'square'; osc.frequency.value = 100;
        const gain = this.ctx.createGain(); gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain); gain.connect(this.masterGain); osc.start(now); osc.stop(now + 0.15);
    }
}

// ============================================================
// PS1 POST-PROCESSING SHADER
// ============================================================
const PS1Shader = {
    uniforms: {
        tDiffuse: { value: null },
        time: { value: 0.0 },
        resolution: { value: new THREE.Vector2(CFG.renderW, CFG.renderH) },
        grainIntensity: { value: 0.03 },
        vignetteStrength: { value: 0.3 },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform vec2 resolution;
        uniform float grainIntensity;
        uniform float vignetteStrength;
        varying vec2 vUv;

        // Hash for film grain
        float hash(vec2 p) {
            vec3 p3 = fract(vec3(p.xyx) * 0.1031);
            p3 += dot(p3, p3.yzx + 33.33);
            return fract((p3.x + p3.y) * p3.z);
        }

        // 2x2 ordered dithering
        float dither2x2(vec2 pos) {
            int x = int(mod(pos.x, 2.0));
            int y = int(mod(pos.y, 2.0));
            int index = x + y * 2;
            float threshold;
            if (index == 0) threshold = 0.0;
            else if (index == 1) threshold = 0.5;
            else if (index == 2) threshold = 0.75;
            else threshold = 0.25;
            return (threshold - 0.5) / 64.0;
        }

        void main() {
            vec4 color = texture2D(tDiffuse, vUv);

            // 2x2 ordered dithering
            vec2 pixelPos = vUv * resolution;
            float dith = dither2x2(pixelPos);
            color.rgb += dith;

            // Film grain
            float grain = hash(vUv * resolution + time * 100.0) * 2.0 - 1.0;
            color.rgb += grain * grainIntensity;

            // Vignette
            vec2 center = vUv - 0.5;
            float vignette = 1.0 - dot(center, center) * vignetteStrength * 2.5;
            vignette = clamp(vignette, 0.0, 1.0);
            color.rgb *= vignette;

            color.rgb = clamp(color.rgb, 0.0, 1.0);
            gl_FragColor = color;
        }
    `,
};

// ============================================================
// GAME CLASS
// ============================================================
class Game {
    constructor() {
        this.state = 'title'; // title, playing, dying, dead, won, note
        this.canvas = document.getElementById('game-canvas');

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false });
        this.renderer.setSize(CFG.renderW, CFG.renderH, false);
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = false;
        this.renderer.setClearColor(CFG.fogColor);

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(CFG.fogColor, CFG.fogDensity);

        this.camera = new THREE.PerspectiveCamera(65, CFG.renderW / CFG.renderH, 0.1, CFG.cameraFar);
        this.camera.position.set(0, CFG.playerH, 0);

        this.controls = new PointerLockControls(this.camera, document.body);
        this.keys = {};
        this.setupInput();
        this.audio = new AudioManager();

        this.ui = {
            title: document.getElementById('title-screen'),
            hud: document.getElementById('hud'),
            death: document.getElementById('death-screen'),
            win: document.getElementById('win-screen'),
            noteScreen: document.getElementById('note-screen'),
            noteText: document.getElementById('note-text'),
            staminaBar: document.getElementById('stamina-bar'),
            roomName: document.getElementById('room-name'),
            interactPrompt: document.getElementById('interact-prompt'),
            batteryBar: document.getElementById('battery-bar'),
            keyRed: document.getElementById('key-red'),    // repurposed: fuse
            keyBlue: document.getElementById('key-blue'),   // repurposed: bolt cutters
            keyGreen: document.getElementById('key-green'), // repurposed: master key
            fearOverlay: document.getElementById('fear-overlay'),
            damageFlash: document.getElementById('damage-flash'),
            message: document.getElementById('message-display'),
            minimap: document.getElementById('minimap'),
            hp: [document.getElementById('hp1'), document.getElementById('hp2'), document.getElementById('hp3')],
        };

        // Player state
        this.health = CFG.maxHealth;
        this.stamina = CFG.maxStamina;
        this.battery = CFG.maxBattery;
        this.flashlightOn = false;
        this.keysCollected = { red: false, blue: false, green: false };
        this.objectives = { fuse: false, bolt_cutters: false, master_key: false, keypad_code: false };
        this.keypadCode = '4731'; // the code players find in notes
        this.hiding = false;
        this.hideSpot = null;
        this.preHidePos = null;
        this.footstepTimer = 0;
        this.messageTimer = 0;
        this.hitImmunity = 0;
        this.damageFlashTimer = 0;
        this.crouching = false;
        this.currentCamH = CFG.playerH; // for smooth camera height lerp

        // Walk animation state
        this.walkPhase = 0;
        this.walkBlend = 0;
        this.cameraTilt = 0;
        this.shakeTimer = 0;
        this.deathTilt = 0;

        // Death animation
        this.dyingTimer = 0;
        this.dyingDuration = 2.5;
        this.deathCamStartY = CFG.playerH;

        // Nun footstep timer
        this.nunFootstepTimer = 0;

        // Map & Level
        this.map = generateMap();
        this.level = new LevelBuilder(this.scene, this.map);
        this.level.build();
        this.nun = new NunEnemy(this.scene);

        const startPos = gridToWorld(25, 25);
        this.camera.position.set(startPos.x, CFG.playerH, startPos.z);

        this.flashlight = new THREE.SpotLight(0xfff8e0, 12, CFG.flashRange, Math.PI / 4, 0.35, 0.3);
        this.flashlight.visible = false;
        this.camera.add(this.flashlight);
        this.flashlight.position.set(0, 0, 0);
        this.flashlight.target.position.set(0, 0, -1);
        this.camera.add(this.flashlight.target);
        this.scene.add(this.camera);

        // Post-processing pipeline
        const rt = new THREE.WebGLRenderTarget(CFG.renderW, CFG.renderH, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
        });
        this.composer = new EffectComposer(this.renderer, rt);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.ps1Pass = new ShaderPass(PS1Shader);
        this.composer.addPass(this.ps1Pass);

        this.minimapCtx = this.ui.minimap.getContext('2d');
        this.ui.minimap.width = 120; this.ui.minimap.height = 120;

        this.clock = new THREE.Clock();
        this.prevChaseState = false;
        this.elapsedTime = 0;

        this.animate = this.animate.bind(this);
        this.animate();
    }

    setupInput() {
        document.addEventListener('keydown', e => { this.keys[e.code] = true; });
        document.addEventListener('keyup', e => { this.keys[e.code] = false; });
        document.addEventListener('click', () => {
            if (this.state === 'title') this.startGame();
            else if (this.state === 'dead' || this.state === 'won') this.restart();
            else if (this.state === 'playing' && !this.controls.isLocked) this.controls.lock();
        });
        document.addEventListener('keydown', e => {
            if (e.code === 'KeyE' && this.state === 'note') this.closeNote();
        });
    }

    startGame() {
        this.state = 'playing';
        this.ui.title.classList.add('hidden');
        this.ui.hud.classList.remove('hidden');
        this.controls.lock();
        this.audio.init();
        this.clock.start();
    }

    restart() { location.reload(); }

    showMessage(text, duration = 3) {
        this.messageTimer = duration;
        this.ui.message.textContent = text;
        this.ui.message.style.opacity = '1';
    }

    openNote(text) { this.state = 'note'; this.controls.unlock(); this.ui.noteText.textContent = text; this.ui.noteScreen.classList.remove('hidden'); }
    closeNote() { this.state = 'playing'; this.ui.noteScreen.classList.add('hidden'); this.controls.lock(); }

    takeDamage() {
        if (this.hitImmunity > 0) return;
        this.health--;
        this.hitImmunity = 1.0; // 1 second immunity
        this.damageFlashTimer = 0.4;
        this.audio.playHurt();
        this.audio.playStab();

        // Camera shake via position jolt (rotation corrupts PointerLockControls)
        this.shakeTimer = 0.3;

        if (this.health <= 0) {
            this.startDying();
        }
    }

    startDying() {
        this.state = 'dying';
        this.dyingTimer = 0;
        this.deathCamStartY = this.camera.position.y;
        this.audio.playDeath();
        this.audio.setChaseMode(false);
    }

    updateDying(dt) {
        this.dyingTimer += dt;
        const t = Math.min(1, this.dyingTimer / this.dyingDuration);

        // Camera falls to ground with easing
        const ease = 1 - Math.pow(1 - t, 3); // cubic ease out
        this.camera.position.y = this.deathCamStartY - ease * (this.deathCamStartY - 0.2);

        // Camera tilts to the side (applied during render, not here)
        this.deathTilt = ease * 1.2;

        // Increasing red overlay
        this.ui.damageFlash.style.opacity = (0.3 + ease * 0.5).toString();
        this.ui.damageFlash.style.background = `rgba(100,0,0,${0.3 + ease * 0.6})`;

        // Fade to black near the end
        if (t > 0.7) {
            const fadeT = (t - 0.7) / 0.3;
            this.ui.fearOverlay.style.opacity = fadeT.toString();
            this.ui.fearOverlay.style.background = `rgba(0,0,0,${fadeT * 0.9})`;
        }

        if (this.dyingTimer >= this.dyingDuration) {
            this.state = 'dead';
            this.controls.unlock();
            this.ui.hud.classList.add('hidden');
            this.ui.death.classList.remove('hidden');
            this.ui.damageFlash.style.opacity = '0';
        }
    }

    win() {
        this.state = 'won';
        this.controls.unlock();
        this.ui.hud.classList.add('hidden');
        this.ui.win.classList.remove('hidden');
    }

    animate() {
        requestAnimationFrame(this.animate);
        const dt = Math.min(this.clock.getDelta(), 0.1);

        if (this.state === 'playing') {
            this.updatePlayer(dt);
            this.updateDoors(dt);
            this.updateNun(dt);
            this.updateUI(dt);
            this.updateMinimap();
        } else if (this.state === 'dying') {
            this.updateDying(dt);
            this.nun.update(dt, { x: this.camera.position.x, z: this.camera.position.z }, false, false, this.map, this.level.doors);
        }

        // Update shader time for grain animation
        this.elapsedTime += dt;
        this.ps1Pass.uniforms.time.value = this.elapsedTime;

        // Damage shake (position-based, decays over time)
        let shakeX = 0, shakeY = 0;
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            const intensity = this.shakeTimer / 0.3;
            shakeX = (Math.random() - 0.5) * 0.12 * intensity;
            shakeY = (Math.random() - 0.5) * 0.08 * intensity;
        }

        // Apply tilt + shake only during render (avoids corrupting PointerLockControls quaternion)
        const savedQuat = this.camera.quaternion.clone();
        const savedX = this.camera.position.x, savedY = this.camera.position.y;
        const totalTilt = this.cameraTilt + this.deathTilt;
        this.camera.rotateZ(totalTilt);
        this.camera.position.x += shakeX;
        this.camera.position.y += shakeY;
        this.composer.render();
        this.camera.quaternion.copy(savedQuat);
        this.camera.position.x = savedX;
        this.camera.position.y = savedY;
    }

    updatePlayer(dt) {
        if (!this.controls.isLocked) return;

        // Timers
        if (this.hitImmunity > 0) this.hitImmunity -= dt;
        if (this.damageFlashTimer > 0) {
            this.damageFlashTimer -= dt;
            this.ui.damageFlash.style.opacity = Math.max(0, this.damageFlashTimer / 0.4 * 0.6).toString();
            if (this.damageFlashTimer <= 0) this.ui.damageFlash.style.opacity = '0';
        }

        if (this.hiding) {
            if (this.keys['KeyE'] || this.keys['Space']) { this.keys['KeyE'] = false; this.keys['Space'] = false; this.exitHiding(); }
            return;
        }

        // Crouch (hold ControlLeft, or forced in vents)
        const pg = worldToGrid(this.camera.position.x, this.camera.position.z);
        const inVent = isVent(this.map, pg.x, pg.z);
        this.crouching = !!this.keys['ControlLeft'] || inVent;

        const sprinting = this.keys['ShiftLeft'] && this.stamina > 0 && !this.crouching;
        const speed = this.crouching ? CFG.crouchSpd : (sprinting ? CFG.sprintSpd : CFG.walkSpd);
        let moved = false;

        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0; forward.normalize();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        const moveDir = new THREE.Vector3();
        if (this.keys['KeyW']) moveDir.add(forward);
        if (this.keys['KeyS']) moveDir.sub(forward);
        if (this.keys['KeyD']) moveDir.add(right);
        if (this.keys['KeyA']) moveDir.sub(right);

        if (moveDir.length() > 0) {
            moveDir.normalize();
            const newX = this.camera.position.x + moveDir.x * speed * dt;
            const newZ = this.camera.position.z + moveDir.z * speed * dt;

            let canMoveX = true, canMoveZ = true;
            const R = CFG.playerR;
            for (const ox of [-R, 0, R]) {
                for (const oz of [-R, 0, R]) {
                    if (!isWalkable(this.map, ...Object.values(worldToGrid(newX + ox, this.camera.position.z + oz)))) canMoveX = false;
                    if (!isWalkable(this.map, ...Object.values(worldToGrid(this.camera.position.x + ox, newZ + oz)))) canMoveZ = false;
                }
            }
            // Door collision: use grid cell when door is mostly closed
            for (const door of this.level.doors) {
                if (door.open && Math.abs(door.angle - door.targetAngle) < 0.1) continue;
                if (door.angle > Math.PI / 4) continue; // Door open enough to pass
                const dp = door.mesh.position;
                if (canMoveX && Math.abs(newX - dp.x) < 0.8 && Math.abs(this.camera.position.z - dp.z) < 0.8) canMoveX = false;
                if (canMoveZ && Math.abs(this.camera.position.x - dp.x) < 0.8 && Math.abs(newZ - dp.z) < 0.8) canMoveZ = false;
            }

            if (canMoveX) this.camera.position.x = newX;
            if (canMoveZ) this.camera.position.z = newZ;
            moved = canMoveX || canMoveZ;
            if (sprinting) this.stamina = Math.max(0, this.stamina - CFG.staminaDrain * dt);
        }

        // Stamina regen: faster while crouching
        if (!sprinting) {
            const regen = this.crouching ? CFG.crouchStaminaRegen : CFG.staminaRegen;
            this.stamina = Math.min(CFG.maxStamina, this.stamina + regen * dt);
        }

        // Camera height lerp for crouch
        const targetH = this.crouching ? CFG.crouchH : CFG.playerH;
        this.currentCamH += (targetH - this.currentCamH) * Math.min(1, dt * 10);

        // Walk animation
        const targetBlend = moved ? 1 : 0;
        this.walkBlend += (targetBlend - this.walkBlend) * Math.min(1, dt * 10);

        if (moved) {
            const walkSpeed = sprinting ? 11 : (this.crouching ? 4 : 7);
            this.walkPhase += dt * walkSpeed;
        }

        const bobScale = this.crouching ? 0.5 : 1;
        const vertBob = Math.sin(this.walkPhase * 2) * (sprinting ? 0.055 : 0.03) * this.walkBlend * bobScale;
        const tiltSway = Math.sin(this.walkPhase) * (sprinting ? 0.015 : 0.008) * this.walkBlend * bobScale;

        this.camera.position.y = this.currentCamH + vertBob;
        this.cameraTilt += (tiltSway - this.cameraTilt) * Math.min(1, dt * 12);

        // Footsteps + sound events
        if (moved) {
            this.footstepTimer -= dt;
            const stepInterval = this.crouching ? 0.55 : (sprinting ? 0.28 : 0.42);
            if (this.footstepTimer <= 0) {
                this.audio.playFootstep(sprinting);
                this.footstepTimer = stepInterval;
                // Emit sound event for nun hearing
                const loudness = this.crouching ? CFG.crouchLoudness : (sprinting ? CFG.sprintLoudness : CFG.walkLoudness);
                emitSound(this.camera.position.x, this.camera.position.z, loudness, 'footstep');
            }
        } else {
            this.footstepTimer = 0;
        }

        // Flashlight toggle
        if (this.keys['KeyF']) { this.keys['KeyF'] = false; this.flashlightOn = !this.flashlightOn; this.flashlight.visible = this.flashlightOn; }
        if (this.flashlightOn) {
            this.battery = Math.max(0, this.battery - CFG.batteryDrain * dt);
            if (this.battery <= 0) { this.flashlightOn = false; this.flashlight.visible = false; }
        }

        if (this.keys['KeyE']) { this.keys['KeyE'] = false; this.tryInteract(); }
        if (this.keys['Space']) { this.keys['Space'] = false; this.tryHide(); }
    }

    tryInteract() {
        const pos = this.camera.position;
        const iDist = 3;
        for (const door of this.level.doors) {
            if (door.isAnimating) continue;
            const dist = Math.sqrt((pos.x - door.mesh.position.x) ** 2 + (pos.z - door.mesh.position.z) ** 2);
            if (dist < iDist) {
                if (door.locked) {
                    const needed = door.keyNeeded;
                    if (needed === 'fuse' && this.objectives.fuse) {
                        door.locked = false; this.slamDoor(door); this.showMessage('Power restored! Gate opens.');
                    } else if (needed === 'bolt_cutters' && this.objectives.bolt_cutters) {
                        door.locked = false; this.slamDoor(door); this.showMessage('Chain cut! Gate opens.');
                    } else if (needed === 'master_key' && this.objectives.master_key) {
                        door.locked = false; this.slamDoor(door); this.showMessage('The cellar exit opens... ESCAPE!');
                        setTimeout(() => { if (this.state === 'playing') this.win(); }, 2000);
                    } else {
                        const msgs = {
                            fuse: 'No power. Need a fuse.',
                            bolt_cutters: 'Chained shut. Need bolt cutters.',
                            master_key: 'Locked tight. Need the master key.',
                        };
                        this.showMessage(msgs[needed] || 'Locked.');
                        this.audio.playLocked();
                    }
                } else {
                    this.slamDoor(door);
                }
                return;
            }
        }
        for (const item of this.level.items) {
            if (item.collected) continue;
            const dist = Math.sqrt((pos.x - item.wx) ** 2 + (pos.z - item.wz) ** 2);
            if (dist < iDist) { this.collectItem(item); return; }
        }
    }

    slamDoor(door) {
        door.isAnimating = true;
        const openAngle = Math.PI / 2;
        door.targetAngle = door.open ? 0 : openAngle;
        door.open = !door.open;
        this.audio.playDoorOpen();
        // Emit loud sound
        emitSound(door.mesh.position.x, door.mesh.position.z, CFG.doorSlamLoudness, 'door_slam');
    }

    slowOpenDoor(door) {
        door.isAnimating = true;
        door.slowOpen = true;
        door.slowTimer = 0;
        const openAngle = Math.PI / 2;
        door.targetAngle = door.open ? 0 : openAngle;
        door.open = !door.open;
        // Quiet sound emitted when animation completes
    }

    updateDoors(dt) {
        for (const door of this.level.doors) {
            if (!door.isAnimating) continue;
            if (door.slowOpen) {
                // Slow open/close over 2.5s
                door.slowTimer += dt;
                const t = Math.min(1, door.slowTimer / 2.5);
                door.angle = door.angle + (door.targetAngle - door.angle) * Math.min(1, dt * 2);
                if (Math.abs(door.angle - door.targetAngle) < 0.02) {
                    door.angle = door.targetAngle;
                    door.isAnimating = false;
                    door.slowOpen = false;
                    emitSound(door.mesh.position.x, door.mesh.position.z, CFG.doorSlowLoudness, 'door_slow');
                }
            } else {
                // Slam: fast rotation
                door.angle += (door.targetAngle - door.angle) * Math.min(1, dt * 12);
                if (Math.abs(door.angle - door.targetAngle) < 0.02) {
                    door.angle = door.targetAngle;
                    door.isAnimating = false;
                }
            }
            door.mesh.rotation.y = door.angle;
        }
    }

    // Nun door opening: slam after 0.5s pause
    nunOpenDoor(door) {
        if (door.open || door.locked || door.isAnimating) return;
        this.slamDoor(door);
    }

    collectItem(item) {
        item.collected = true; this.scene.remove(item.mesh); this.scene.remove(item.glow);
        this.audio.playPickup();
        emitSound(this.camera.position.x, this.camera.position.z, CFG.pickupLoudness, 'pickup');
        if (item.type === 'objective') {
            this.objectives[item.id] = true;
            this.showMessage(`Picked up ${item.name}`);
        } else if (item.type === 'key') {
            this.keysCollected[item.color] = true;
            this.showMessage(`Picked up ${item.name}`);
        } else if (item.type === 'note') {
            this.openNote(item.text);
        } else if (item.type === 'battery') {
            this.battery = Math.min(CFG.maxBattery, this.battery + 50);
            this.showMessage('Picked up Battery');
        }
    }

    tryHide() {
        const pos = this.camera.position;
        for (const spot of this.level.hidingSpots) {
            if (Math.sqrt((pos.x - spot.wx) ** 2 + (pos.z - spot.wz) ** 2) < 3) { this.enterHiding(spot); return; }
        }
    }

    enterHiding(spot) {
        this.hiding = true; this.hideSpot = spot;
        this.preHidePos = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z };
        this.camera.position.set(spot.wx, CFG.playerH * 0.7, spot.wz);
        this.showMessage('Hiding... (Press E to exit)');
    }

    exitHiding() {
        if (this.preHidePos) this.camera.position.set(this.preHidePos.x, this.preHidePos.y, this.preHidePos.z);
        this.hiding = false; this.hideSpot = null; this.preHidePos = null;
    }

    updateNun(dt) {
        const playerPos = { x: this.camera.position.x, z: this.camera.position.z };
        const sprinting = this.keys['ShiftLeft'] && this.stamina > 0 && !this.crouching;

        this.nun.update(dt, playerPos, this.hiding, sprinting, this.map, this.level.doors);

        // Nun wants to open a door
        if (this.nun.pendingDoorOpen) {
            this.nunOpenDoor(this.nun.pendingDoorOpen);
            this.nun.pendingDoorOpen = null;
        }

        // Check if nun stab connects
        if (!this.hiding && this.nun.state === NUN_STATE.CHASE && this.nun.checkStabHit()) {
            const dist = this.nun.distToPlayer(playerPos);
            if (dist < CFG.nunStabDist) {
                this.takeDamage();
            }
        }

        // Nun footstep sounds
        const nunDist = this.nun.distToPlayer(playerPos);
        this.nunFootstepTimer -= dt;
        const nunMoving = this.nun.state !== NUN_STATE.COOLDOWN;
        if (nunMoving && this.nunFootstepTimer <= 0) {
            this.audio.playNunFootstep(nunDist);
            this.nunFootstepTimer = this.nun.state === NUN_STATE.CHASE ? 0.3 : 0.5;
        }

        // Nun vocalization during chase
        if (!this.nunVocalTimer) this.nunVocalTimer = 2;
        this.nunVocalTimer -= dt;
        if (this.nun.state === NUN_STATE.CHASE && this.nunVocalTimer <= 0) {
            this.audio.playNunVocal(nunDist);
            this.nunVocalTimer = 2.5 + Math.random() * 3; // every 2.5-5.5 seconds
        } else if (this.nun.state !== NUN_STATE.CHASE) {
            this.nunVocalTimer = 1; // ready to vocalize quickly when chase starts
        }

        // Tension-based audio
        this.audio.updateTension(dt, this.nun.state, nunDist);

        // Fear overlay (driven by audio tension)
        const isChasing = this.nun.state === NUN_STATE.CHASE;
        const fearIntensity = this.audio.tension;
        this.ui.fearOverlay.style.opacity = fearIntensity.toString();
        if (this.state === 'playing') {
            this.ui.fearOverlay.style.background = `radial-gradient(ellipse at center, transparent 60%, rgba(80,0,0,${0.4 * fearIntensity}) 100%)`;
        }
    }

    updateUI(dt) {
        const stPct = (this.stamina / CFG.maxStamina) * 100;
        this.ui.staminaBar.style.width = stPct + '%';
        this.ui.staminaBar.className = stPct < 25 ? 'low' : '';
        this.ui.batteryBar.style.width = (this.battery / CFG.maxBattery) * 100 + '%';
        this.ui.keyRed.className = 'key-slot red' + (this.objectives.fuse ? ' collected' : '');
        this.ui.keyBlue.className = 'key-slot blue' + (this.objectives.bolt_cutters ? ' collected' : '');
        this.ui.keyGreen.className = 'key-slot green' + (this.objectives.master_key ? ' collected' : '');

        // Health pips
        for (let i = 0; i < 3; i++) {
            this.ui.hp[i].className = 'health-pip' + (i >= this.health ? ' lost' : '');
        }

        // Room name
        const g = worldToGrid(this.camera.position.x, this.camera.position.z);
        let currentRoom = '';
        for (const room of ROOM_DEFS) { if (g.x >= room.x1 && g.x < room.x2 && g.z >= room.z1 && g.z < room.z2) { currentRoom = room.name; break; } }
        this.ui.roomName.textContent = currentRoom;

        // Interaction prompt
        const pos = this.camera.position;
        let promptText = '';
        const iDist = 3;
        if (!this.hiding) {
            for (const door of this.level.doors) {
                if (door.isAnimating) continue;
                const dd = Math.sqrt((pos.x - door.mesh.position.x) ** 2 + (pos.z - door.mesh.position.z) ** 2);
                if (dd < iDist) {
                    if (door.locked) { promptText = '[E] Locked'; }
                    else { promptText = door.open ? '[E] Close Door' : '[E] Open Door'; }
                    break;
                }
            }
            if (!promptText) for (const item of this.level.items) { if (!item.collected && Math.sqrt((pos.x - item.wx) ** 2 + (pos.z - item.wz) ** 2) < iDist) { promptText = `[E] ${item.name}`; break; } }
            if (!promptText) for (const spot of this.level.hidingSpots) { if (Math.sqrt((pos.x - spot.wx) ** 2 + (pos.z - spot.wz) ** 2) < 3) { promptText = `[SPACE] Hide in ${spot.name}`; break; } }
        }
        this.ui.interactPrompt.textContent = promptText;
        this.ui.interactPrompt.classList.toggle('visible', !!promptText);

        if (this.messageTimer > 0) { this.messageTimer -= dt; if (this.messageTimer <= 0) this.ui.message.style.opacity = '0'; }
    }

    updateMinimap() {
        const ctx = this.minimapCtx;
        const mw = 120, mh = 120;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, mw, mh);
        const pg = worldToGrid(this.camera.position.x, this.camera.position.z);
        const viewR = 15;
        for (let dz = -viewR; dz <= viewR; dz++) for (let dx = -viewR; dx <= viewR; dx++) {
            const gx = pg.x + dx, gz = pg.z + dz;
            if (gx < 0 || gx >= MAP_W || gz < 0 || gz >= MAP_H) continue;
            const val = this.map[gz][gx];
            if (val >= 1) {
                const px = (dx + viewR) * (mw / (viewR * 2 + 1));
                const py = (dz + viewR) * (mh / (viewR * 2 + 1));
                const ps = mw / (viewR * 2 + 1);
                ctx.fillStyle = val === 2 ? '#1a2a1a' : '#1a1a2a'; // vents slightly green
                ctx.fillRect(px, py, ps + 0.5, ps + 0.5);
            }
        }
        ctx.fillStyle = '#4a4'; ctx.fillRect(mw / 2 - 2, mh / 2 - 2, 4, 4);
        const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
        ctx.strokeStyle = '#4a4'; ctx.beginPath(); ctx.moveTo(mw / 2, mh / 2); ctx.lineTo(mw / 2 + dir.x * 8, mh / 2 + dir.z * 8); ctx.stroke();
        // Nun intentionally NOT shown on minimap
    }
}

// ============================================================
// START
// ============================================================
const game = new Game();
