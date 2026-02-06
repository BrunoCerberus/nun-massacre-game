// ============================================================
// NUN MASSACRE - PS1-Style Survival Horror
// ============================================================
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ============================================================
// CONFIG
// ============================================================
const CFG = {
    renderW: 320, renderH: 240,
    cell: 2, wallH: 3.5,
    playerH: 1.6, playerR: 0.35,
    walkSpd: 4.5, sprintSpd: 7.5,
    maxStamina: 100, staminaDrain: 28, staminaRegen: 12,
    nunPatrolSpd: 2.0, nunChaseSpd: 5.8,
    nunSightRange: 14, nunSightAngle: 0.7,
    nunCatchDist: 1.4, nunHearDist: 8, nunSearchTime: 8,
    flashRange: 18, maxBattery: 100, batteryDrain: 4,
    fogColor: 0x08080e, fogNear: 2, fogFar: 28,
};

const MAP_W = 50, MAP_H = 50;

// ============================================================
// MAP GENERATION
// ============================================================
function generateMap() {
    const m = Array.from({ length: MAP_H }, () => new Uint8Array(MAP_W));

    function carve(x1, z1, w, h) {
        for (let z = z1; z < z1 + h && z < MAP_H; z++)
            for (let x = x1; x < x1 + w && x < MAP_W; x++)
                m[z][x] = 1;
    }

    // Entry Hall
    carve(20, 20, 10, 10);

    // Corridors
    carve(23, 7, 4, 13);   // North
    carve(23, 30, 4, 13);  // South
    carve(30, 23, 13, 4);  // East
    carve(7, 23, 13, 4);   // West

    // Classroom A (NW) + connector
    carve(11, 7, 8, 6);
    carve(19, 9, 4, 3);

    // Classroom B (NE) + connector
    carve(31, 7, 8, 6);
    carve(27, 9, 4, 3);

    // Library (NE of east corr) + connector
    carve(36, 15, 8, 7);
    carve(38, 22, 3, 1);

    // Kitchen (SE of east corr) + connector
    carve(36, 28, 7, 7);
    carve(38, 27, 3, 1);

    // Chapel (SW) + connector
    carve(9, 36, 9, 8);
    carve(18, 37, 5, 3);

    // Dining (SE) + connector
    carve(31, 36, 8, 7);
    carve(27, 37, 4, 3);

    // Storage (NW of west corr) + connector
    carve(3, 16, 7, 6);
    carve(8, 22, 2, 1);

    // Cellar (SW of west corr) + connector
    carve(3, 28, 7, 7);
    carve(8, 27, 2, 1);

    return m;
}

// Room metadata for display names and item placement
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
    return gx >= 0 && gx < MAP_W && gz >= 0 && gz < MAP_H && map[gz][gx] === 1;
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
        // Merge geometry for performance
        const wallGeos = [];
        const floorGeos = [];
        const ceilGeos = [];
        const C = CFG.cell, H = CFG.wallH;

        for (let gz = 0; gz < MAP_H; gz++) {
            for (let gx = 0; gx < MAP_W; gx++) {
                if (this.map[gz][gx] !== 1) continue;
                const { x: wx, z: wz } = gridToWorld(gx, gz);

                // Floor
                const fg = new THREE.PlaneGeometry(C, C);
                fg.rotateX(-Math.PI / 2);
                fg.translate(wx, 0, wz);
                floorGeos.push(fg);

                // Ceiling
                const cg = new THREE.PlaneGeometry(C, C);
                cg.rotateX(Math.PI / 2);
                cg.translate(wx, H, wz);
                ceilGeos.push(cg);

                // Walls on edges adjacent to wall cells
                // North wall
                if (!isWalkable(this.map, gx, gz - 1)) {
                    const wg = new THREE.PlaneGeometry(C, H);
                    wg.translate(wx, H / 2, wz - C / 2);
                    wallGeos.push(wg);
                }
                // South wall
                if (!isWalkable(this.map, gx, gz + 1)) {
                    const wg = new THREE.PlaneGeometry(C, H);
                    wg.rotateY(Math.PI);
                    wg.translate(wx, H / 2, wz + C / 2);
                    wallGeos.push(wg);
                }
                // West wall
                if (!isWalkable(this.map, gx - 1, gz)) {
                    const wg = new THREE.PlaneGeometry(C, H);
                    wg.rotateY(Math.PI / 2);
                    wg.translate(wx - C / 2, H / 2, wz);
                    wallGeos.push(wg);
                }
                // East wall
                if (!isWalkable(this.map, gx + 1, gz)) {
                    const wg = new THREE.PlaneGeometry(C, H);
                    wg.rotateY(-Math.PI / 2);
                    wg.translate(wx + C / 2, H / 2, wz);
                    wallGeos.push(wg);
                }
            }
        }

        // Merge and add to scene
        if (wallGeos.length) {
            const merged = this.mergeGeos(wallGeos);
            const mesh = new THREE.Mesh(merged, this.wallMat);
            mesh.receiveShadow = true;
            this.scene.add(mesh);
        }
        if (floorGeos.length) {
            const merged = this.mergeGeos(floorGeos);
            const mesh = new THREE.Mesh(merged, this.floorMat);
            mesh.receiveShadow = true;
            this.scene.add(mesh);
        }
        if (ceilGeos.length) {
            const merged = this.mergeGeos(ceilGeos);
            this.scene.add(new THREE.Mesh(merged, this.ceilMat));
        }
    }

    mergeGeos(geos) {
        const merged = new THREE.BufferGeometry();
        let totalVerts = 0, totalIdx = 0;
        for (const g of geos) {
            totalVerts += g.attributes.position.count;
            totalIdx += g.index ? g.index.count : 0;
        }
        const pos = new Float32Array(totalVerts * 3);
        const norm = new Float32Array(totalVerts * 3);
        const uv = new Float32Array(totalVerts * 2);
        const idx = new Uint32Array(totalIdx);
        let vOff = 0, iOff = 0, vCount = 0;
        for (const g of geos) {
            const p = g.attributes.position.array;
            const n = g.attributes.normal.array;
            const u = g.attributes.uv.array;
            pos.set(p, vOff * 3);
            norm.set(n, vOff * 3);
            uv.set(u, vOff * 2);
            if (g.index) {
                for (let i = 0; i < g.index.count; i++) idx[iOff + i] = g.index.array[i] + vOff;
                iOff += g.index.count;
            }
            vOff += g.attributes.position.count;
            g.dispose();
        }
        merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        merged.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
        merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        merged.setIndex(new THREE.BufferAttribute(idx, 1));
        return merged;
    }

    placeDoors() {
        // Door positions (grid coords of connector narrow points)
        const doorDefs = [
            { gx: 20, gz: 10, axis: 'x', id: 'door_ca' },
            { gx: 28, gz: 10, axis: 'x', id: 'door_cb' },
            { gx: 39, gz: 22, axis: 'z', id: 'door_lib' },
            { gx: 39, gz: 27, axis: 'z', id: 'door_kit' },
            { gx: 19, gz: 38, axis: 'x', id: 'door_chapel' },
            { gx: 28, gz: 38, axis: 'x', id: 'door_dining' },
            { gx: 9, gz: 22, axis: 'z', id: 'door_storage' },
            { gx: 9, gz: 27, axis: 'z', id: 'door_cellar', locked: true, keyNeeded: 'all' },
        ];

        for (const d of doorDefs) {
            const { x, z } = gridToWorld(d.gx, d.gz);
            const geo = new THREE.BoxGeometry(
                d.axis === 'z' ? 0.2 : CFG.cell * 0.9,
                CFG.wallH * 0.85,
                d.axis === 'x' ? 0.2 : CFG.cell * 0.9
            );
            const mesh = new THREE.Mesh(geo, this.doorMat.clone());
            mesh.position.set(x, CFG.wallH * 0.42, z);
            this.scene.add(mesh);

            this.doors.push({
                mesh, id: d.id, open: false,
                locked: d.locked || false,
                keyNeeded: d.keyNeeded || null,
                gx: d.gx, gz: d.gz,
            });
        }
    }

    placeItems() {
        const itemDefs = [
            { type: 'key', color: 'red', gx: 15, gz: 9, name: 'Red Key' },
            { type: 'key', color: 'blue', gx: 13, gz: 40, name: 'Blue Key' },
            { type: 'key', color: 'green', gx: 40, gz: 32, name: 'Green Key' },
            { type: 'note', gx: 40, gz: 18, name: 'Torn Note',
              text: 'She walks these halls at night... always watching.\nI hear her footsteps echo through the corridors.\nWe must find the keys and escape through the cellar.\nThree keys, three locks. God help us.' },
            { type: 'note', gx: 35, gz: 39, name: 'Journal Page',
              text: 'The sisters have all gone. Only SHE remains.\nI found one key in the classroom, another by the altar.\nThe third... I dare not go to the kitchen.\nShe frequents that area.' },
            { type: 'battery', gx: 6, gz: 19, name: 'Battery' },
        ];

        for (const item of itemDefs) {
            const { x, z } = gridToWorld(item.gx, item.gz);
            let mesh;

            if (item.type === 'key') {
                const colors = { red: 0xff2222, blue: 0x2244ff, green: 0x22ff44 };
                const emissive = { red: 0x440000, blue: 0x000044, green: 0x004400 };
                const group = new THREE.Group();
                // Key body
                const ring = new THREE.TorusGeometry(0.12, 0.03, 6, 8);
                const ringMesh = new THREE.Mesh(ring, new THREE.MeshLambertMaterial({ color: colors[item.color], emissive: emissive[item.color] }));
                ringMesh.rotation.x = Math.PI / 2;
                ringMesh.position.y = 0.12;
                group.add(ringMesh);
                const shaft = new THREE.BoxGeometry(0.03, 0.2, 0.03);
                const shaftMesh = new THREE.Mesh(shaft, new THREE.MeshLambertMaterial({ color: colors[item.color], emissive: emissive[item.color] }));
                shaftMesh.position.y = -0.05;
                group.add(shaftMesh);
                // Teeth
                const teeth = new THREE.BoxGeometry(0.08, 0.03, 0.03);
                const teethMesh = new THREE.Mesh(teeth, new THREE.MeshLambertMaterial({ color: colors[item.color] }));
                teethMesh.position.set(0.03, -0.13, 0);
                group.add(teethMesh);
                group.position.set(x, 0.9, z);
                mesh = group;
            } else if (item.type === 'note') {
                const geo = new THREE.PlaneGeometry(0.3, 0.4);
                mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xc9b896, emissive: 0x1a1408 }));
                mesh.position.set(x, 0.85, z);
                mesh.rotation.x = -0.3;
            } else if (item.type === 'battery') {
                const geo = new THREE.CylinderGeometry(0.06, 0.06, 0.2, 6);
                mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x888833, emissive: 0x222200 }));
                mesh.position.set(x, 0.85, z);
            }

            this.scene.add(mesh);
            // Point light to make items visible
            const glow = new THREE.PointLight(
                item.type === 'key' ? { red: 0xff4444, blue: 0x4444ff, green: 0x44ff44 }[item.color] || 0xffaa44 : 0xffaa44,
                0.5, 4
            );
            glow.position.set(x, 1.2, z);
            this.scene.add(glow);

            this.items.push({ ...item, mesh, glow, collected: false, wx: x, wz: z });
        }
    }

    placeHidingSpots() {
        const spots = [
            { gx: 12, gz: 11, name: 'Locker' },
            { gx: 37, gz: 11, name: 'Locker' },
            { gx: 42, gz: 19, name: 'Cabinet' },
            { gx: 41, gz: 33, name: 'Pantry' },
            { gx: 11, gz: 41, name: 'Confessional' },
            { gx: 5, gz: 19, name: 'Crate' },
        ];

        const lockerMat = new THREE.MeshLambertMaterial({ color: 0x3a4a3a });

        for (const s of spots) {
            const { x, z } = gridToWorld(s.gx, s.gz);
            const geo = new THREE.BoxGeometry(CFG.cell * 0.8, CFG.wallH * 0.7, CFG.cell * 0.8);
            const mesh = new THREE.Mesh(geo, lockerMat);
            mesh.position.set(x, CFG.wallH * 0.35, z);
            this.scene.add(mesh);
            this.hidingSpots.push({ ...s, mesh, wx: x, wz: z });
        }
    }

    placeFurniture() {
        const furnitureMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
        const altarMat = new THREE.MeshLambertMaterial({ color: 0x5a4a3a });

        // Classroom desks
        for (const room of [{ x1: 12, z1: 8, x2: 18, z2: 12 }, { x1: 32, z1: 8, x2: 38, z2: 12 }]) {
            for (let row = 0; row < 2; row++) {
                for (let col = 0; col < 3; col++) {
                    const gx = room.x1 + 1 + col * 2;
                    const gz = room.z1 + 1 + row * 2;
                    const { x, z } = gridToWorld(gx, gz);
                    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), furnitureMat);
                    desk.position.set(x, 0.35, z);
                    this.scene.add(desk);
                }
            }
        }

        // Chapel altar
        {
            const { x, z } = gridToWorld(13, 38);
            const altar = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.0, 1.2), altarMat);
            altar.position.set(x, 0.5, z);
            this.scene.add(altar);

            // Cross
            const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), new THREE.MeshLambertMaterial({ color: 0x8a7a5a }));
            cross1.position.set(x, 1.8, z);
            this.scene.add(cross1);
            const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.1), new THREE.MeshLambertMaterial({ color: 0x8a7a5a }));
            cross2.position.set(x, 2.1, z);
            this.scene.add(cross2);
        }

        // Chapel pews
        for (let row = 0; row < 3; row++) {
            const { x, z } = gridToWorld(13, 41 + row);
            const pew = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 0.5), furnitureMat);
            pew.position.set(x, 0.3, z);
            this.scene.add(pew);
        }

        // Dining table
        {
            const { x, z } = gridToWorld(35, 39);
            const table = new THREE.Mesh(new THREE.BoxGeometry(3, 0.75, 1.8), furnitureMat);
            table.position.set(x, 0.375, z);
            this.scene.add(table);
        }

        // Kitchen counter
        {
            const { x, z } = gridToWorld(39, 30);
            const counter = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 3), furnitureMat);
            counter.position.set(x, 0.425, z);
            this.scene.add(counter);
        }

        // Library shelves
        for (let i = 0; i < 3; i++) {
            const { x, z } = gridToWorld(38 + i * 2, 17);
            const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.5, 2), furnitureMat);
            shelf.position.set(x, 1.25, z);
            this.scene.add(shelf);
        }
    }

    addLights() {
        // Ambient light
        this.scene.add(new THREE.AmbientLight(0x201820, 0.8));

        // Sparse point lights in rooms
        const lightPositions = [
            { gx: 25, gz: 25, color: 0x887766, intensity: 1.2 }, // Entry
            { gx: 25, gz: 14, color: 0x665544, intensity: 0.8 }, // N corridor
            { gx: 25, gz: 36, color: 0x665544, intensity: 0.8 }, // S corridor
            { gx: 36, gz: 25, color: 0x665544, intensity: 0.8 }, // E corridor
            { gx: 14, gz: 25, color: 0x665544, intensity: 0.8 }, // W corridor
            { gx: 15, gz: 10, color: 0x887766, intensity: 1.0 }, // Class A
            { gx: 35, gz: 10, color: 0x887766, intensity: 1.0 }, // Class B
            { gx: 40, gz: 19, color: 0x667788, intensity: 1.0 }, // Library
            { gx: 39, gz: 31, color: 0x887766, intensity: 0.8 }, // Kitchen
            { gx: 13, gz: 40, color: 0x884444, intensity: 1.0 }, // Chapel (reddish)
            { gx: 35, gz: 39, color: 0x887766, intensity: 0.8 }, // Dining
            { gx: 6, gz: 19, color: 0x667755, intensity: 0.8 },  // Storage
            { gx: 6, gz: 31, color: 0x556688, intensity: 0.9 },  // Cellar
        ];

        for (const lp of lightPositions) {
            const { x, z } = gridToWorld(lp.gx, lp.gz);
            const light = new THREE.PointLight(lp.color, lp.intensity, 22);
            light.position.set(x, CFG.wallH - 0.3, z);
            this.scene.add(light);
        }
    }
}

// ============================================================
// NUN ENEMY
// ============================================================
class NunEnemy {
    constructor(scene) {
        this.mesh = this.createModel();
        scene.add(this.mesh);

        // AI state
        this.state = 'patrol'; // patrol, chase, search
        this.speed = CFG.nunPatrolSpd;
        this.patrolIdx = 0;
        this.searchTimer = 0;
        this.lastKnownPlayerPos = null;
        this.stateTimer = 0;
        this.alertLevel = 0;

        // Patrol waypoints (grid coords)
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

        // Start at chapel
        const start = this.waypoints[0];
        this.mesh.position.set(start.x, 0, start.z);
        this.targetPos = { ...this.waypoints[1] };

        // Path for chase
        this.path = [];
        this.pathTimer = 0;
    }

    createModel() {
        const group = new THREE.Group();

        // Body (black robe - cone)
        const bodyGeo = new THREE.ConeGeometry(0.5, 2.2, 8);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.1;
        group.add(body);

        // Head
        const headGeo = new THREE.SphereGeometry(0.22, 6, 6);
        const headMat = new THREE.MeshLambertMaterial({ color: 0xd4b896 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 2.35;
        group.add(head);

        // Wimple (white headpiece)
        const wimpleGeo = new THREE.BoxGeometry(0.55, 0.35, 0.45);
        const wimpleMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
        const wimple = new THREE.Mesh(wimpleGeo, wimpleMat);
        wimple.position.y = 2.5;
        group.add(wimple);

        // Veil
        const veilGeo = new THREE.BoxGeometry(0.6, 0.5, 0.5);
        const veilMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
        const veil = new THREE.Mesh(veilGeo, veilMat);
        veil.position.y = 2.65;
        group.add(veil);

        // Eyes (glowing red)
        for (let side = -1; side <= 1; side += 2) {
            const eyeGeo = new THREE.SphereGeometry(0.035, 4, 4);
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const eye = new THREE.Mesh(eyeGeo, eyeMat);
            eye.position.set(side * 0.08, 2.38, 0.18);
            group.add(eye);
        }

        // Eerie glow
        const glow = new THREE.PointLight(0xff2200, 0.3, 5);
        glow.position.y = 2.4;
        group.add(glow);

        return group;
    }

    update(dt, playerPos, playerHiding, playerSprinting, map) {
        this.stateTimer += dt;

        switch (this.state) {
            case 'patrol': this.updatePatrol(dt, playerPos, playerHiding, playerSprinting, map); break;
            case 'chase': this.updateChase(dt, playerPos, playerHiding, map); break;
            case 'search': this.updateSearch(dt, playerPos, playerHiding, playerSprinting, map); break;
        }

        // Bob animation
        this.mesh.position.y = Math.sin(this.stateTimer * (this.state === 'chase' ? 8 : 3)) * 0.05;
    }

    canSeePlayer(playerPos, playerHiding) {
        if (playerHiding) return false;
        const dx = playerPos.x - this.mesh.position.x;
        const dz = playerPos.z - this.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > CFG.nunSightRange) return false;

        // Check angle
        const angle = Math.atan2(dx, dz);
        const facing = this.mesh.rotation.y;
        let angleDiff = Math.abs(angle - facing);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
        return angleDiff < CFG.nunSightAngle;
    }

    canHearPlayer(playerPos, playerSprinting) {
        if (!playerSprinting) return false;
        const dx = playerPos.x - this.mesh.position.x;
        const dz = playerPos.z - this.mesh.position.z;
        return Math.sqrt(dx * dx + dz * dz) < CFG.nunHearDist;
    }

    moveToward(target, speed, dt, map) {
        const dx = target.x - this.mesh.position.x;
        const dz = target.z - this.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.5) return true; // reached

        const nx = dx / dist;
        const nz = dz / dist;
        const newX = this.mesh.position.x + nx * speed * dt;
        const newZ = this.mesh.position.z + nz * speed * dt;

        // Check walkability
        const g = worldToGrid(newX, newZ);
        if (isWalkable(map, g.x, g.z)) {
            this.mesh.position.x = newX;
            this.mesh.position.z = newZ;
        }

        // Face movement direction
        this.mesh.rotation.y = Math.atan2(dx, dz);
        return false;
    }

    updatePatrol(dt, playerPos, playerHiding, playerSprinting, map) {
        this.speed = CFG.nunPatrolSpd;

        if (this.canSeePlayer(playerPos, playerHiding)) {
            this.enterChase(playerPos);
            return;
        }
        if (this.canHearPlayer(playerPos, playerSprinting)) {
            this.lastKnownPlayerPos = { x: playerPos.x, z: playerPos.z };
            this.enterSearch();
            return;
        }

        const target = this.waypoints[this.patrolIdx];
        if (this.moveToward(target, this.speed, dt, map)) {
            this.patrolIdx = (this.patrolIdx + 1) % this.waypoints.length;
        }
    }

    updateChase(dt, playerPos, playerHiding, map) {
        this.speed = CFG.nunChaseSpd;

        if (playerHiding) {
            // Lost sight - search
            this.enterSearch();
            return;
        }

        this.lastKnownPlayerPos = { x: playerPos.x, z: playerPos.z };
        this.moveToward(playerPos, this.speed, dt, map);
    }

    updateSearch(dt, playerPos, playerHiding, playerSprinting, map) {
        this.speed = CFG.nunPatrolSpd * 1.3;
        this.searchTimer -= dt;

        if (this.canSeePlayer(playerPos, playerHiding)) {
            this.enterChase(playerPos);
            return;
        }
        if (this.canHearPlayer(playerPos, playerSprinting)) {
            this.lastKnownPlayerPos = { x: playerPos.x, z: playerPos.z };
            this.searchTimer = CFG.nunSearchTime;
        }

        if (this.searchTimer <= 0) {
            this.state = 'patrol';
            this.stateTimer = 0;
            return;
        }

        if (this.lastKnownPlayerPos) {
            if (this.moveToward(this.lastKnownPlayerPos, this.speed, dt, map)) {
                // Reached last known position, look around
                this.mesh.rotation.y += dt * 2;
            }
        }
    }

    enterChase(playerPos) {
        this.state = 'chase';
        this.stateTimer = 0;
        this.lastKnownPlayerPos = { x: playerPos.x, z: playerPos.z };
    }

    enterSearch() {
        this.state = 'search';
        this.stateTimer = 0;
        this.searchTimer = CFG.nunSearchTime;
    }

    distToPlayer(playerPos) {
        const dx = playerPos.x - this.mesh.position.x;
        const dz = playerPos.z - this.mesh.position.z;
        return Math.sqrt(dx * dx + dz * dz);
    }
}

// ============================================================
// AUDIO MANAGER (Procedural Web Audio)
// ============================================================
class AudioManager {
    constructor() {
        this.ctx = null;
        this.initialized = false;
        this.ambientGain = null;
        this.footstepTimer = 0;
        this.chaseMusic = null;
        this.chaseMusicGain = null;
        this.isChaseActive = false;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.ctx.destination);

            this.startAmbient();
            this.initialized = true;
        } catch (e) {
            console.warn('Audio not available');
        }
    }

    startAmbient() {
        if (!this.ctx) return;
        // Low drone
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 40;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.06;
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();

        // High eerie tone
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = 880;
        const gain2 = this.ctx.createGain();
        gain2.gain.value = 0.008;
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.1;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.005;
        lfo.connect(lfoGain);
        lfoGain.connect(gain2.gain);
        lfo.start();
        osc2.connect(gain2);
        gain2.connect(this.masterGain);
        osc2.start();

        // Chase music gain node (pre-connected)
        this.chaseMusicGain = this.ctx.createGain();
        this.chaseMusicGain.gain.value = 0;
        this.chaseMusicGain.connect(this.masterGain);

        // Chase drone (always running, volume controlled)
        const chaseOsc = this.ctx.createOscillator();
        chaseOsc.type = 'sawtooth';
        chaseOsc.frequency.value = 55;
        chaseOsc.connect(this.chaseMusicGain);
        chaseOsc.start();

        const chaseOsc2 = this.ctx.createOscillator();
        chaseOsc2.type = 'square';
        chaseOsc2.frequency.value = 110;
        const cg2 = this.ctx.createGain();
        cg2.gain.value = 0.3;
        chaseOsc2.connect(cg2);
        cg2.connect(this.chaseMusicGain);
        chaseOsc2.start();
    }

    playFootstep() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 80 + Math.random() * 40;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.12);
    }

    playDoorOpen() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.3);
    }

    playPickup() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    playDeath() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        for (let i = 0; i < 5; i++) {
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = 100 + Math.random() * 200;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.15, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.3);
        }
    }

    setChaseMode(active) {
        if (!this.chaseMusicGain) return;
        const target = active ? 0.12 : 0;
        this.chaseMusicGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.5);
    }

    playLocked() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 100;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.15);
    }
}

// ============================================================
// GAME CLASS
// ============================================================
class Game {
    constructor() {
        this.state = 'title'; // title, playing, dead, won, note
        this.canvas = document.getElementById('game-canvas');

        // Three.js setup
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false });
        this.renderer.setSize(CFG.renderW, CFG.renderH, false);
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = false;
        this.renderer.setClearColor(CFG.fogColor);

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(CFG.fogColor, CFG.fogNear, CFG.fogFar);

        this.camera = new THREE.PerspectiveCamera(65, CFG.renderW / CFG.renderH, 0.1, 50);
        this.camera.position.set(0, CFG.playerH, 0);

        // Pointer lock controls
        this.controls = new PointerLockControls(this.camera, document.body);

        // Input
        this.keys = {};
        this.setupInput();

        // Audio
        this.audio = new AudioManager();

        // UI refs
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
            keyRed: document.getElementById('key-red'),
            keyBlue: document.getElementById('key-blue'),
            keyGreen: document.getElementById('key-green'),
            fearOverlay: document.getElementById('fear-overlay'),
            message: document.getElementById('message-display'),
            minimap: document.getElementById('minimap'),
        };

        // Game state
        this.stamina = CFG.maxStamina;
        this.battery = CFG.maxBattery;
        this.flashlightOn = false;
        this.flashlight = null;
        this.keysCollected = { red: false, blue: false, green: false };
        this.hiding = false;
        this.hideSpot = null;
        this.preHidePos = null;
        this.footstepTimer = 0;
        this.messageTimer = 0;
        this.messageText = '';

        // Map
        this.map = generateMap();

        // Build level
        this.level = new LevelBuilder(this.scene, this.map);
        this.level.build();

        // Enemy
        this.nun = new NunEnemy(this.scene);

        // Player start position (center of entry hall)
        const startPos = gridToWorld(25, 25);
        this.camera.position.set(startPos.x, CFG.playerH, startPos.z);

        // Flashlight
        this.flashlight = new THREE.SpotLight(0xffffcc, 3, CFG.flashRange, Math.PI / 5, 0.4, 0.5);
        this.flashlight.visible = false;
        this.camera.add(this.flashlight);
        this.flashlight.position.set(0, 0, 0);
        this.flashlight.target.position.set(0, 0, -1);
        this.camera.add(this.flashlight.target);
        this.scene.add(this.camera);

        // Minimap
        this.minimapCtx = this.ui.minimap.getContext('2d');
        this.ui.minimap.width = 120;
        this.ui.minimap.height = 120;

        // Clock
        this.clock = new THREE.Clock();
        this.prevChaseState = false;

        // Start render loop
        this.animate = this.animate.bind(this);
        this.animate();
    }

    setupInput() {
        document.addEventListener('keydown', e => { this.keys[e.code] = true; });
        document.addEventListener('keyup', e => { this.keys[e.code] = false; });

        // Click handlers for different screens
        document.addEventListener('click', () => {
            if (this.state === 'title') {
                this.startGame();
            } else if (this.state === 'dead' || this.state === 'won') {
                this.restart();
            } else if (this.state === 'playing' && !this.controls.isLocked) {
                this.controls.lock();
            }
        });

        document.addEventListener('keydown', e => {
            if (e.code === 'KeyE' && this.state === 'note') {
                this.closeNote();
            }
        });

        this.controls.addEventListener('unlock', () => {
            if (this.state === 'playing') {
                // Allow re-lock on next click
            }
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

    restart() {
        location.reload();
    }

    showMessage(text, duration = 3) {
        this.messageText = text;
        this.messageTimer = duration;
        this.ui.message.textContent = text;
        this.ui.message.style.opacity = '1';
    }

    openNote(text) {
        this.state = 'note';
        this.controls.unlock();
        this.ui.noteText.textContent = text;
        this.ui.noteScreen.classList.remove('hidden');
    }

    closeNote() {
        this.state = 'playing';
        this.ui.noteScreen.classList.add('hidden');
        this.controls.lock();
    }

    die() {
        this.state = 'dead';
        this.controls.unlock();
        this.ui.hud.classList.add('hidden');
        this.ui.death.classList.remove('hidden');
        this.audio.playDeath();
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
            this.updateNun(dt);
            this.updateUI(dt);
            this.updateMinimap();
        }

        this.renderer.render(this.scene, this.camera);
    }

    updatePlayer(dt) {
        if (!this.controls.isLocked) return;
        if (this.hiding) {
            // While hiding, only allow exiting
            if (this.keys['KeyE'] || this.keys['Space']) {
                this.keys['KeyE'] = false;
                this.keys['Space'] = false;
                this.exitHiding();
            }
            return;
        }

        const sprinting = this.keys['ShiftLeft'] && this.stamina > 0;
        const speed = sprinting ? CFG.sprintSpd : CFG.walkSpd;
        let moved = false;

        // Movement direction
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
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

            // Collision check (check multiple points around player radius)
            let canMoveX = true, canMoveZ = true;
            const R = CFG.playerR;

            for (const ox of [-R, 0, R]) {
                for (const oz of [-R, 0, R]) {
                    const gNew = worldToGrid(newX + ox, this.camera.position.z + oz);
                    if (!isWalkable(this.map, gNew.x, gNew.z)) canMoveX = false;

                    const gNew2 = worldToGrid(this.camera.position.x + ox, newZ + oz);
                    if (!isWalkable(this.map, gNew2.x, gNew2.z)) canMoveZ = false;
                }
            }

            // Also check doors as obstacles
            for (const door of this.level.doors) {
                if (door.open) continue;
                const dm = door.mesh;
                const dp = dm.position;
                const dw = 0.8, dd = 0.8;
                if (canMoveX && Math.abs(newX - dp.x) < dw && Math.abs(this.camera.position.z - dp.z) < dd) {
                    canMoveX = false;
                }
                if (canMoveZ && Math.abs(this.camera.position.x - dp.x) < dw && Math.abs(newZ - dp.z) < dd) {
                    canMoveZ = false;
                }
            }

            if (canMoveX) this.camera.position.x = newX;
            if (canMoveZ) this.camera.position.z = newZ;
            moved = canMoveX || canMoveZ;

            // Stamina
            if (sprinting) {
                this.stamina = Math.max(0, this.stamina - CFG.staminaDrain * dt);
            }
        }

        // Stamina regen when not sprinting
        if (!sprinting) {
            this.stamina = Math.min(CFG.maxStamina, this.stamina + CFG.staminaRegen * dt);
        }

        // Footsteps
        if (moved) {
            this.footstepTimer -= dt;
            if (this.footstepTimer <= 0) {
                this.audio.playFootstep();
                this.footstepTimer = sprinting ? 0.25 : 0.4;
            }
        }

        // Head bob
        if (moved) {
            const bobSpeed = sprinting ? 10 : 6;
            const bobAmount = sprinting ? 0.06 : 0.03;
            this.camera.position.y = CFG.playerH + Math.sin(this.clock.elapsedTime * bobSpeed) * bobAmount;
        } else {
            this.camera.position.y = CFG.playerH;
        }

        // Flashlight toggle
        if (this.keys['KeyF']) {
            this.keys['KeyF'] = false;
            this.flashlightOn = !this.flashlightOn;
            this.flashlight.visible = this.flashlightOn;
        }

        // Flashlight battery
        if (this.flashlightOn) {
            this.battery = Math.max(0, this.battery - CFG.batteryDrain * dt);
            if (this.battery <= 0) {
                this.flashlightOn = false;
                this.flashlight.visible = false;
            }
        }

        // Interaction
        if (this.keys['KeyE']) {
            this.keys['KeyE'] = false;
            this.tryInteract();
        }

        // Hiding
        if (this.keys['Space']) {
            this.keys['Space'] = false;
            this.tryHide();
        }
    }

    tryInteract() {
        const pos = this.camera.position;
        const interactDist = 3;

        // Check doors
        for (const door of this.level.doors) {
            if (door.open) continue;
            const dx = pos.x - door.mesh.position.x;
            const dz = pos.z - door.mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < interactDist) {
                if (door.locked) {
                    if (door.keyNeeded === 'all') {
                        if (this.keysCollected.red && this.keysCollected.blue && this.keysCollected.green) {
                            door.locked = false;
                            this.openDoor(door);
                            this.showMessage('The cellar exit opens... ESCAPE!');
                            // Trigger win after walking through
                            setTimeout(() => {
                                if (this.state === 'playing') this.win();
                            }, 2000);
                        } else {
                            this.showMessage('Locked. Needs all three keys.');
                            this.audio.playLocked();
                        }
                    }
                } else {
                    this.openDoor(door);
                }
                return;
            }
        }

        // Check items
        for (const item of this.level.items) {
            if (item.collected) continue;
            const dx = pos.x - item.wx;
            const dz = pos.z - item.wz;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < interactDist) {
                this.collectItem(item);
                return;
            }
        }
    }

    openDoor(door) {
        door.open = true;
        // Animate door upward
        const startY = door.mesh.position.y;
        const targetY = CFG.wallH + 1;
        const anim = () => {
            door.mesh.position.y += 0.05;
            if (door.mesh.position.y < targetY) requestAnimationFrame(anim);
            else this.scene.remove(door.mesh);
        };
        anim();
        this.audio.playDoorOpen();
    }

    collectItem(item) {
        item.collected = true;
        this.scene.remove(item.mesh);
        this.scene.remove(item.glow);

        if (item.type === 'key') {
            this.keysCollected[item.color] = true;
            this.showMessage(`Picked up ${item.name}`);
            this.audio.playPickup();
        } else if (item.type === 'note') {
            this.openNote(item.text);
            this.audio.playPickup();
        } else if (item.type === 'battery') {
            this.battery = Math.min(CFG.maxBattery, this.battery + 50);
            this.showMessage('Picked up Battery');
            this.audio.playPickup();
        }
    }

    tryHide() {
        const pos = this.camera.position;
        for (const spot of this.level.hidingSpots) {
            const dx = pos.x - spot.wx;
            const dz = pos.z - spot.wz;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 3) {
                this.enterHiding(spot);
                return;
            }
        }
    }

    enterHiding(spot) {
        this.hiding = true;
        this.hideSpot = spot;
        this.preHidePos = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z };
        // Move camera inside the hiding spot
        this.camera.position.set(spot.wx, CFG.playerH * 0.7, spot.wz);
        this.showMessage('Hiding... (Press E to exit)');
    }

    exitHiding() {
        if (this.preHidePos) {
            this.camera.position.set(this.preHidePos.x, this.preHidePos.y, this.preHidePos.z);
        }
        this.hiding = false;
        this.hideSpot = null;
        this.preHidePos = null;
    }

    updateNun(dt) {
        const playerPos = { x: this.camera.position.x, z: this.camera.position.z };
        const sprinting = this.keys['ShiftLeft'] && this.stamina > 0;

        this.nun.update(dt, playerPos, this.hiding, sprinting, this.map);

        // Check if caught
        if (!this.hiding && this.nun.distToPlayer(playerPos) < CFG.nunCatchDist) {
            this.die();
            return;
        }

        // Chase music
        const isChasing = this.nun.state === 'chase';
        if (isChasing !== this.prevChaseState) {
            this.audio.setChaseMode(isChasing);
            this.prevChaseState = isChasing;
        }

        // Fear overlay
        const distToNun = this.nun.distToPlayer(playerPos);
        const fearIntensity = this.nun.state === 'chase' ? Math.max(0, 1 - distToNun / 15) :
            this.nun.state === 'search' ? 0.2 : 0;
        this.ui.fearOverlay.style.opacity = fearIntensity.toString();
    }

    updateUI(dt) {
        // Stamina
        const stPct = (this.stamina / CFG.maxStamina) * 100;
        this.ui.staminaBar.style.width = stPct + '%';
        this.ui.staminaBar.className = stPct < 25 ? 'low' : '';

        // Battery
        this.ui.batteryBar.style.width = (this.battery / CFG.maxBattery) * 100 + '%';

        // Keys
        this.ui.keyRed.className = 'key-slot red' + (this.keysCollected.red ? ' collected' : '');
        this.ui.keyBlue.className = 'key-slot blue' + (this.keysCollected.blue ? ' collected' : '');
        this.ui.keyGreen.className = 'key-slot green' + (this.keysCollected.green ? ' collected' : '');

        // Room name
        const g = worldToGrid(this.camera.position.x, this.camera.position.z);
        let currentRoom = '';
        for (const room of ROOM_DEFS) {
            if (g.x >= room.x1 && g.x < room.x2 && g.z >= room.z1 && g.z < room.z2) {
                currentRoom = room.name;
                break;
            }
        }
        this.ui.roomName.textContent = currentRoom;

        // Interaction prompt
        const pos = this.camera.position;
        let promptText = '';
        const iDist = 3;

        if (!this.hiding) {
            for (const door of this.level.doors) {
                if (door.open) continue;
                const dist = Math.sqrt((pos.x - door.mesh.position.x) ** 2 + (pos.z - door.mesh.position.z) ** 2);
                if (dist < iDist) {
                    promptText = door.locked ? '[E] Locked' : '[E] Open Door';
                    break;
                }
            }
            if (!promptText) {
                for (const item of this.level.items) {
                    if (item.collected) continue;
                    const dist = Math.sqrt((pos.x - item.wx) ** 2 + (pos.z - item.wz) ** 2);
                    if (dist < iDist) {
                        promptText = `[E] ${item.name}`;
                        break;
                    }
                }
            }
            if (!promptText) {
                for (const spot of this.level.hidingSpots) {
                    const dist = Math.sqrt((pos.x - spot.wx) ** 2 + (pos.z - spot.wz) ** 2);
                    if (dist < 3) {
                        promptText = `[SPACE] Hide in ${spot.name}`;
                        break;
                    }
                }
            }
        }

        this.ui.interactPrompt.textContent = promptText;
        this.ui.interactPrompt.classList.toggle('visible', !!promptText);

        // Message timer
        if (this.messageTimer > 0) {
            this.messageTimer -= dt;
            if (this.messageTimer <= 0) {
                this.ui.message.style.opacity = '0';
            }
        }
    }

    updateMinimap() {
        const ctx = this.minimapCtx;
        const mw = 120, mh = 120;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, mw, mh);

        const pg = worldToGrid(this.camera.position.x, this.camera.position.z);
        const viewR = 15; // grid cells visible

        for (let dz = -viewR; dz <= viewR; dz++) {
            for (let dx = -viewR; dx <= viewR; dx++) {
                const gx = pg.x + dx;
                const gz = pg.z + dz;
                if (gx < 0 || gx >= MAP_W || gz < 0 || gz >= MAP_H) continue;
                const px = (dx + viewR) * (mw / (viewR * 2 + 1));
                const py = (dz + viewR) * (mh / (viewR * 2 + 1));
                const ps = mw / (viewR * 2 + 1);
                if (this.map[gz][gx] === 1) {
                    ctx.fillStyle = '#1a1a2a';
                    ctx.fillRect(px, py, ps + 0.5, ps + 0.5);
                }
            }
        }

        // Player dot
        ctx.fillStyle = '#4a4';
        ctx.fillRect(mw / 2 - 2, mh / 2 - 2, 4, 4);

        // Player direction
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        ctx.strokeStyle = '#4a4';
        ctx.beginPath();
        ctx.moveTo(mw / 2, mh / 2);
        ctx.lineTo(mw / 2 + dir.x * 8, mh / 2 + dir.z * 8);
        ctx.stroke();

        // Nun dot (if nearby)
        const ng = worldToGrid(this.nun.mesh.position.x, this.nun.mesh.position.z);
        const ndx = ng.x - pg.x;
        const ndz = ng.z - pg.z;
        if (Math.abs(ndx) <= viewR && Math.abs(ndz) <= viewR) {
            const npx = (ndx + viewR) * (mw / (viewR * 2 + 1));
            const npy = (ndz + viewR) * (mh / (viewR * 2 + 1));
            ctx.fillStyle = this.nun.state === 'chase' ? '#f00' : '#a00';
            ctx.fillRect(npx - 2, npy - 2, 4, 4);
        }
    }
}

// ============================================================
// START
// ============================================================
const game = new Game();
