import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// ── Setup ──
const isMobile = /Mobi|Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);

const _initAspect = window.innerWidth / window.innerHeight;
const _initFOV = _initAspect < 1 ? Math.min(75, 40 / _initAspect) : 40;
const camera = new THREE.PerspectiveCamera(_initFOV, _initAspect, 0.1, 1000);
camera.position.set(0, isMobile ? 1.2 : 1.8, isMobile ? 5.5 : 4.5);
camera.lookAt(0, isMobile ? 0.0 : 0.15, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // OutputPass handles final sRGB
const root = document.getElementById('root') ?? document.body;
root.appendChild(renderer.domElement);

// ── 2D Circle Rings Overlay ──
const overlayCanvas = document.createElement('canvas');
overlayCanvas.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:10;';
document.body.appendChild(overlayCanvas);
const overlayCtx = overlayCanvas.getContext('2d');
const overlayDpr = Math.min(window.devicePixelRatio, 2);
function resizeOverlay() {
  overlayCanvas.width  = Math.round(window.innerWidth  * overlayDpr);
  overlayCanvas.height = Math.round(window.innerHeight * overlayDpr);
  overlayCanvas.style.width  = window.innerWidth  + 'px';
  overlayCanvas.style.height = window.innerHeight + 'px';
  overlayCtx.setTransform(overlayDpr, 0, 0, overlayDpr, 0, 0);
}
resizeOverlay();

// Preload company logos — inner ring first (index 0), outer ring second (index 1)
const ringLogos = [
  [
    'company logos/chainlink 1.svg',
    'company logos/image (1) 1.png',
    'company logos/image (2) 1.png',
    'company logos/eth-diamond-(purple) 2.png',
    'company logos/metamask 1.svg',
    'company logos/image (3) 2.png',
    'company logos/united_nations 1.svg',
    'company logos/image (4) 1.png',
  ],
  [
    'company logos/image 1078.png',
    'company logos/deloitte 1.png',
    'company logos/sumsub 1.svg',
    'company logos/fireblocks 1.svg',
    'company logos/image (5) 1.png',
    'company logos/uniswap 1.svg',
    'company logos/image (6) 1.png',
    'company logos/image 1080 [Vectorized].svg',
  ],
].map(group => group.map(src => {
  const img = new Image();
  img.loaded = false;
  img.onload = () => { img.loaded = true; };
  img.src = encodeURI(src);
  return img;
}));

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.42,   // visible glow around bright particles
  0.45,   // wide enough for halo effect
  0.74    // catches the bright-gold and white-shine particles
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());
if (isMobile) { bloomPass.strength = 0.18; bloomPass.radius = 0.25; }

// ── Mouse tracking ──
const mouse3D = new THREE.Vector3(9999, 9999, 0);
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2(9999, 9999);
let mouseActive = false;

const barGroup = new THREE.Group();
barGroup.name = 'barGroup';
barGroup.rotation.x = 133.6 * Math.PI / 180;
barGroup.rotation.y = 8.5 * Math.PI / 180;
barGroup.rotation.z = 0;
scene.add(barGroup);

// ── Gold bar geometry — precise trapezoid ingot ──
const bW = 2.6, bD = 0.832, tW = 2.184, tD = 0.572, barH = 0.468;

const corners = {
  b0: new THREE.Vector3(-bW/2, -barH/2, -bD/2),
  b1: new THREE.Vector3( bW/2, -barH/2, -bD/2),
  b2: new THREE.Vector3( bW/2, -barH/2,  bD/2),
  b3: new THREE.Vector3(-bW/2, -barH/2,  bD/2),
  t0: new THREE.Vector3(-tW/2,  barH/2, -tD/2),
  t1: new THREE.Vector3( tW/2,  barH/2, -tD/2),
  t2: new THREE.Vector3( tW/2,  barH/2,  tD/2),
  t3: new THREE.Vector3(-tW/2,  barH/2,  tD/2),
};

function faceNormal(v0, v1, v2) {
  const a = new THREE.Vector3().subVectors(v1, v0);
  const b = new THREE.Vector3().subVectors(v2, v0);
  return new THREE.Vector3().crossVectors(a, b).normalize();
}

const faces = [
  { v: [corners.b0, corners.b1, corners.b2, corners.b3], weight: 0.9 },
  { v: [corners.t3, corners.t2, corners.t1, corners.t0], weight: 0.9 },
  { v: [corners.b3, corners.b2, corners.t2, corners.t3], weight: 1.0 },
  { v: [corners.b0, corners.b1, corners.t1, corners.t0], weight: 1.0 },
  { v: [corners.b2, corners.b1, corners.t1, corners.t2], weight: 0.35 },
  { v: [corners.b3, corners.b0, corners.t0, corners.t3], weight: 0.35 },
];

faces.forEach(f => {
  f.normal = faceNormal(f.v[0], f.v[1], f.v[2]);
});

function sampleQuad(v0, v1, v2, v3) {
  const u = Math.random(), v = Math.random();
  const a = new THREE.Vector3().lerpVectors(v0, v1, u);
  const b = new THREE.Vector3().lerpVectors(v3, v2, u);
  return new THREE.Vector3().lerpVectors(a, b, v);
}

function quadArea(v0, v1, v2, v3) {
  const a = new THREE.Vector3().subVectors(v1, v0);
  const b = new THREE.Vector3().subVectors(v3, v0);
  return new THREE.Vector3().crossVectors(a, b).length();
}

let totalW = 0;
const faceData = faces.map(f => {
  const area = quadArea(f.v[0], f.v[1], f.v[2], f.v[3]) * f.weight;
  totalW += area;
  return { ...f, area };
});

const BASE_PARTICLE_COUNT = isMobile ? 7000 : 15000;

const edges = [
  [corners.b0, corners.b1], [corners.b1, corners.b2],
  [corners.b2, corners.b3], [corners.b3, corners.b0],
  [corners.t0, corners.t1], [corners.t1, corners.t2],
  [corners.t2, corners.t3], [corners.t3, corners.t0],
  [corners.b0, corners.t0], [corners.b1, corners.t1],
  [corners.b2, corners.t2], [corners.b3, corners.t3],
];

function distToNearestEdge(pt) {
  let minDist = Infinity;
  for (const [a, b] of edges) {
    const ab = new THREE.Vector3().subVectors(b, a);
    const ap = new THREE.Vector3().subVectors(pt, a);
    const t = Math.max(0, Math.min(1, ap.dot(ab) / ab.dot(ab)));
    const closest = new THREE.Vector3().copy(a).addScaledVector(ab, t);
    const dist = pt.distanceTo(closest);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

const EDGE_STDV = 0.08;
const CULL_RATE = 0.35;

const topEdges = [
  [corners.t0, corners.t1], [corners.t1, corners.t2],
  [corners.t2, corners.t3], [corners.t3, corners.t0],
];

const isShortEdge = (a, b) => {
  if ((a === corners.b1 && b === corners.b2) || (a === corners.b2 && b === corners.b1)) return true;
  if ((a === corners.b3 && b === corners.b0) || (a === corners.b0 && b === corners.b3)) return true;
  if ((a === corners.t1 && b === corners.t2) || (a === corners.t2 && b === corners.t1)) return true;
  if ((a === corners.t3 && b === corners.t0) || (a === corners.t0 && b === corners.t3)) return true;
  if ((a === corners.b1 && b === corners.t1) || (a === corners.t1 && b === corners.b1)) return true;
  if ((a === corners.b2 && b === corners.t2) || (a === corners.t2 && b === corners.b2)) return true;
  if ((a === corners.b0 && b === corners.t0) || (a === corners.t0 && b === corners.b0)) return true;
  if ((a === corners.b3 && b === corners.t3) || (a === corners.t3 && b === corners.b3)) return true;
  return false;
};

function distToNearestTopEdge(pt) {
  let minDist = Infinity;
  for (const [a, b] of topEdges) {
    const ab = new THREE.Vector3().subVectors(b, a);
    const ap = new THREE.Vector3().subVectors(pt, a);
    const t = Math.max(0, Math.min(1, ap.dot(ab) / ab.dot(ab)));
    const closest = new THREE.Vector3().copy(a).addScaledVector(ab, t);
    const dist = pt.distanceTo(closest);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

function sampleEdgePoint(a, b, edgeNormal1, edgeNormal2, spread) {
  const t = Math.random();
  const pt = new THREE.Vector3().lerpVectors(a, b, t);
  const offset = -Math.abs((Math.random() - 0.5) * spread);
  const offset2 = -Math.abs((Math.random() - 0.5) * spread);
  const center = new THREE.Vector3(0, 0, 0);
  const inward = new THREE.Vector3().subVectors(center, pt).normalize();
  pt.addScaledVector(inward, Math.abs(offset) + Math.abs(offset2));
  return pt;
}

function clampToBar(px, py, pz) {
  const cy = Math.max(-barH/2, Math.min(barH/2, py));
  const yN = (cy + barH/2) / barH;
  const halfW = bW/2 + (tW/2 - bW/2) * yN;
  const halfD = bD/2 + (tD/2 - bD/2) * yN;
  const cx = Math.max(-halfW, Math.min(halfW, px));
  const cz = Math.max(-halfD, Math.min(halfD, pz));
  return { x: cx, y: cy, z: cz };
}

const oversampleCount = BASE_PARTICLE_COUNT;
const tempPositions = [];

function biasTowardEdge(p) {
  let minDist = Infinity;
  let nearestPt = p.clone();
  for (const [a, b] of edges) {
    const ab = new THREE.Vector3().subVectors(b, a);
    const ap = new THREE.Vector3().subVectors(p, a);
    const t = Math.max(0, Math.min(1, ap.dot(ab) / ab.dot(ab)));
    const closest = new THREE.Vector3().copy(a).addScaledVector(ab, t);
    const dist = p.distanceTo(closest);
    if (dist < minDist) { minDist = dist; nearestPt = closest; }
  }
  return { minDist, nearestPt };
}

const isSmallFace = (fi) => fi === 4 || fi === 5;

faceData.forEach((face, fi) => {
  const count = Math.round((face.area / totalW) * oversampleCount);
  const small = isSmallFace(fi);
  for (let i = 0; i < count; i++) {
    const p = sampleQuad(face.v[0], face.v[1], face.v[2], face.v[3]);
    const { minDist } = biasTowardEdge(p);
    const edgeSigma = small ? 0.08 : 0.04;
    const edgeKeepProb = Math.exp(-minDist * minDist / (edgeSigma * edgeSigma));
    const interiorKeepProb = small ? 0.5 : 0.35;
    const keepProb = Math.max(edgeKeepProb, interiorKeepProb);
    const smallFaceCull = small ? 0.45 : 1.0;
    if (Math.random() < keepProb * smallFaceCull) {
      if (minDist < 0.06 && !small) {
        const { nearestPt } = biasTowardEdge(p);
        p.lerp(nearestPt, (1.0 - minDist / 0.06) * 0.5 * 0.3);
      }
      tempPositions.push({ p, normal: face.normal, fi, seed: Math.random() });
    }
  }
});

while (tempPositions.length < oversampleCount) {
  const fi = Math.floor(Math.random() * faceData.length);
  const face = faceData[fi];
  const p = sampleQuad(face.v[0], face.v[1], face.v[2], face.v[3]);
  const { minDist } = biasTowardEdge(p);
  const edgeKeepProb = Math.exp(-minDist * minDist / (0.04 * 0.04));
  const keepProb = Math.max(edgeKeepProb, 0.35);
  if (Math.random() < keepProb) {
    tempPositions.push({ p, normal: face.normal, fi, seed: Math.random() });
  }
}

const EDGE_EXTRA_COUNT = 3000;
const TOP_EDGE_EXTRA_COUNT = 2000;

for (let i = 0; i < EDGE_EXTRA_COUNT; i++) {
  const edgeIndex = Math.floor(Math.random() * edges.length);
  const [a, b] = edges[edgeIndex];
  if (isShortEdge(a, b) && Math.random() < 0.80) continue;
  const edgeDir = new THREE.Vector3().subVectors(b, a).normalize();
  const perp1 = new THREE.Vector3();
  if (Math.abs(edgeDir.y) > 0.9) perp1.set(1, 0, 0);
  else perp1.crossVectors(edgeDir, new THREE.Vector3(0, 1, 0)).normalize();
  const perp2 = new THREE.Vector3().crossVectors(edgeDir, perp1).normalize();
  const p = sampleEdgePoint(a, b, perp1, perp2, 0.015);
  let bestFi = 0, bestDot = -1;
  faceData.forEach((f, fi) => {
    const center = new THREE.Vector3();
    f.v.forEach(v => center.add(v));
    center.divideScalar(f.v.length);
    const d = 1 / (1 + p.distanceTo(center));
    if (d > bestDot) { bestDot = d; bestFi = fi; }
  });
  tempPositions.push({ p, normal: faceData[bestFi].normal, fi: bestFi, seed: Math.random() });
}

for (let i = 0; i < TOP_EDGE_EXTRA_COUNT; i++) {
  const edgeIndex = Math.floor(Math.random() * topEdges.length);
  if ((edgeIndex === 1 || edgeIndex === 3) && Math.random() < 0.75) continue;
  const [a, b] = topEdges[edgeIndex];
  const edgeDir = new THREE.Vector3().subVectors(b, a).normalize();
  const perp1 = new THREE.Vector3();
  if (Math.abs(edgeDir.y) > 0.9) perp1.set(1, 0, 0);
  else perp1.crossVectors(edgeDir, new THREE.Vector3(0, 1, 0)).normalize();
  const perp2 = new THREE.Vector3().crossVectors(edgeDir, perp1).normalize();
  const p = sampleEdgePoint(a, b, perp1, perp2, 0.01);
  const topNormal = faceData[1].normal;
  tempPositions.push({ p, normal: topNormal, fi: 1, seed: Math.random() });
}

const shortTopEdges = [
  [corners.t1, corners.t2],
  [corners.t3, corners.t0],
];
function distToNearestShortTopEdge(pt) {
  let minDist = Infinity;
  for (const [a, b] of shortTopEdges) {
    const ab = new THREE.Vector3().subVectors(b, a);
    const ap = new THREE.Vector3().subVectors(pt, a);
    const t = Math.max(0, Math.min(1, ap.dot(ab) / ab.dot(ab)));
    const closest = new THREE.Vector3().copy(a).addScaledVector(ab, t);
    const dist = pt.distanceTo(closest);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

const TOP_EDGE_STDV = 0.10;
const SHORT_TOP_EDGE_CULL = 0.15;
const keptParticles = [];
for (const particle of tempPositions) {
  const edgeDist = distToNearestEdge(particle.p);
  const topEdgeDist = distToNearestTopEdge(particle.p);
  const shortTopDist = distToNearestShortTopEdge(particle.p);
  if (shortTopDist <= TOP_EDGE_STDV && Math.random() < SHORT_TOP_EDGE_CULL) continue;
  if (topEdgeDist <= TOP_EDGE_STDV || edgeDist <= EDGE_STDV) {
    keptParticles.push(particle);
  } else {
    if (Math.random() > CULL_RATE) keptParticles.push(particle);
  }
}

const PARTICLE_COUNT = keptParticles.length;

const pos = new Float32Array(PARTICLE_COUNT * 3);
const origPos = new Float32Array(PARTICLE_COUNT * 3);
const norms = new Float32Array(PARTICLE_COUNT * 3);
const seeds = new Float32Array(PARTICLE_COUNT);
const faceIdx = new Float32Array(PARTICLE_COUNT);

let idx = 0;
for (const particle of keptParticles) {
  const i3 = idx * 3;
  pos[i3] = origPos[i3] = particle.p.x;
  pos[i3+1] = origPos[i3+1] = particle.p.y;
  pos[i3+2] = origPos[i3+2] = particle.p.z;
  norms[i3] = particle.normal.x;
  norms[i3+1] = particle.normal.y;
  norms[i3+2] = particle.normal.z;
  seeds[idx] = particle.seed;
  faceIdx[idx] = particle.fi;
  idx++;
}

const flowFlag = new Float32Array(PARTICLE_COUNT);
const brightFlag = new Float32Array(PARTICLE_COUNT);

const BRIGHT_RATIO = 0.55;
const GRID_X = 12, GRID_Y = 4, GRID_Z = 4;
const cellCounts = {};
const cellBrights = {};

function getCellKey(i) {
  const i3 = i * 3;
  const px = origPos[i3], py = origPos[i3+1], pz = origPos[i3+2];
  const nx = (px + bW/2) / bW;
  const ny = (py + barH/2) / barH;
  const nz = (pz + bD/2) / bD;
  const gx = Math.min(Math.floor(nx * GRID_X), GRID_X - 1);
  const gy = Math.min(Math.floor(ny * GRID_Y), GRID_Y - 1);
  const gz = Math.min(Math.floor(nz * GRID_Z), GRID_Z - 1);
  return `${gx}_${gy}_${gz}`;
}

for (let i = 0; i < PARTICLE_COUNT; i++) {
  flowFlag[i] = (seeds[i] < 0.345) ? 1.0 : 0.0;
  const key = getCellKey(i);
  if (!cellCounts[key]) { cellCounts[key] = 0; cellBrights[key] = 0; }
  cellCounts[key]++;
  const currentRatio = cellCounts[key] > 0 ? cellBrights[key] / cellCounts[key] : 0;
  const brightHash = Math.sin(seeds[i] * 12345.6789 + 0.1) * 43758.5453;
  const rand = brightHash - Math.floor(brightHash);
  const threshold = currentRatio < BRIGHT_RATIO ? 0.65 : 0.45;
  if (rand < threshold) {
    brightFlag[i] = 1.0;
    cellBrights[key]++;
  } else {
    brightFlag[i] = 0.0;
  }
}

const dispData = new Float32Array(PARTICLE_COUNT * 3);
dispData.fill(0);
const maskedData = new Float32Array(PARTICLE_COUNT);
const edgeData = new Float32Array(PARTICLE_COUNT);

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
geo.setAttribute('aOriginal', new THREE.BufferAttribute(origPos, 3));
geo.setAttribute('aNormal', new THREE.BufferAttribute(norms, 3));
geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
geo.setAttribute('aFlow', new THREE.BufferAttribute(flowFlag, 1));
geo.setAttribute('aBright', new THREE.BufferAttribute(brightFlag, 1));
geo.setAttribute('aDisplacement', new THREE.BufferAttribute(dispData, 3));
geo.setAttribute('aMasked', new THREE.BufferAttribute(maskedData, 1));
geo.setAttribute('aLogoEdge', new THREE.BufferAttribute(edgeData, 1));

// Intro assembly: each particle starts at a random scattered position and flies in
const scatterOffsets = new Float32Array(PARTICLE_COUNT * 3);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  // Small random perturbation only — dominant motion comes from the scale-expand in shader
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2.0 * Math.random() - 1.0);
  const r = 0.3 + Math.random() * 0.8;
  scatterOffsets[i*3]   = Math.sin(phi) * Math.cos(theta) * r;
  scatterOffsets[i*3+1] = Math.sin(phi) * Math.sin(theta) * r;
  scatterOffsets[i*3+2] = Math.cos(phi) * r;
}
geo.setAttribute('aScatterOffset', new THREE.BufferAttribute(scatterOffsets, 3));



// ── Shaders ──
const vertexShader = `
  uniform float uTime;
  uniform vec3 uMouse;
  uniform float uMouseActive;
  uniform float uPixelRatio;
  uniform float uIntroExpand;
  uniform float uIntroScatter;

  attribute vec3 aOriginal;
  attribute vec3 aNormal;
  attribute float aSeed;
  attribute float aFlow;
  attribute vec3 aDisplacement;
  attribute float aBright;
  attribute float aMasked;
  attribute float aLogoEdge;
  attribute vec3 aScatterOffset;
  uniform float uIntroT;
  uniform float uScrollT;
  varying float vLight;
  varying float vSeed;
  varying float vBright;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vLogoEdge;
  varying float vMouseProx;
  varying float vLogoParticle;
  varying float vNetAlpha;

  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
      +i.y+vec4(0.0,i1.y,i2.y,1.0))
      +i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  void main(){
    float t = uTime;
    vec3 p = aOriginal;

    vec3 up2 = abs(aNormal.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 tang1 = normalize(cross(aNormal, up2));
    vec3 tang2 = normalize(cross(aNormal, tang1));

    if (aFlow > 0.5) {
      float flowSpeed = 0.022 + aSeed * 0.010;
      float flowCycle = mod(t * flowSpeed + aSeed * 10.0, 1.0);
      float topY = 0.234;
      float botY = -0.234;
      p.y = mix(topY, botY, flowCycle);
      float yN = clamp((p.y + 0.234) / 0.468, 0.0, 1.0);
      float hW = mix(1.3, 1.092, yN);
      float hD = mix(0.416, 0.286, yN);
      float insetW = hW - 0.005;
      float insetD = hD - 0.005;
      float wobble = snoise(vec3(aSeed * 20.0, t * 0.04, flowCycle * 3.0)) * 0.015;
      p.x = clamp(p.x + wobble, -insetW, insetW);
      p.z = clamp(p.z + wobble * 0.7, -insetD, insetD);
    } else {
      float flowT = t * 0.05;
      float n1 = snoise(vec3(aOriginal.x * 0.8 + aSeed * 5.0, aOriginal.z * 0.8, flowT));
      float n2 = snoise(vec3(aOriginal.z * 0.8 + aSeed * 3.0 + 50.0, aOriginal.y * 0.8, flowT + 10.0));
      p += tang1 * n1 * 0.06 + tang2 * n2 * 0.06;
      float yN = clamp((p.y + 0.234) / 0.468, 0.0, 1.0);
      float hW = mix(1.3, 1.092, yN);
      float hD = mix(0.416, 0.286, yN);
      p.x = clamp(p.x, -hW, hW);
      p.y = clamp(p.y, -0.234, 0.234);
      p.z = clamp(p.z, -hD, hD);
    }

    p += aNormal * 0.002;
    float wave = snoise(vec3(p.x * 1.5, p.z * 1.5, t * 0.03)) * 0.004;
    p += aNormal * wave;
    p += aDisplacement;

    // ── Single continuous scroll spread — zero phase boundaries ──
    // spreadT starts at 0 (during zoom) and grows quadratically so the bar looks
    // intact while filling the screen, then opens up naturally afterward.
    float spreadT = smoothstep(0.10, 1.00, uScrollT);

    float driftScale = 2.0 + aSeed * 1.2;
    float driftT = t * 0.10;
    float dnx = snoise(vec3(aOriginal.x * driftScale + aSeed * 7.0, aOriginal.z * driftScale, driftT));
    float dny = snoise(vec3(aOriginal.y * driftScale + aSeed * 5.0 + 30.0, aOriginal.x * driftScale + 15.0, driftT + 4.0));
    float dnz = snoise(vec3(aOriginal.z * driftScale + aSeed * 9.0 + 60.0, aOriginal.y * driftScale + 30.0, driftT + 8.0));
    vec3 driftDir = normalize(aNormal * 0.25 + vec3(dnx, dny, dnz) * 0.75);

    // Quadratic: near-zero while bar fills screen, accelerates as you keep scrolling
    float driftAmp = spreadT * spreadT * (7.0 + aSeed * 8.0);
    p = p + driftDir * driftAmp;

    // Gentle sway scales continuously — imperceptible early, living at full spread
    float swayAmp = spreadT * (0.05 + aSeed * 0.06);
    p.x += sin(t * 0.13 + aSeed * 6.28318) * swayAmp;
    p.y += cos(t * 0.10 + aSeed * 6.28318 + 1.5708) * swayAmp * 0.7;
    p.z += sin(t * 0.09 + aSeed * 6.28318 + 3.1416) * swayAmp * 0.8;


    // Fade starts earlier and compresses into a shorter scroll window so
    // the mid-scroll cloud is noticeably thinner and the circle stage is sparse
    float fadeT = max(0.0, (uScrollT - 0.08) / 0.52);
    float survivorThreshold = 0.03;
    float netAlpha = 1.0;
    if (aSeed >= survivorThreshold) {
      float relSeed = (aSeed - survivorThreshold) / (1.0 - survivorThreshold);
      float fadeAt  = 1.0 - relSeed;
      netAlpha = 1.0 - smoothstep(fadeAt - 0.08, fadeAt + 0.04, fadeT);
    }
    vNetAlpha = netAlpha;

    // Size: constant through zoom, then reduces smoothly with spread
    float scrollSizeMod = 1.0 - spreadT * spreadT * 0.25;

    float mouseDist = length(p - uMouse);
    float sizeInfluence = 1.0 - smoothstep(0.0, 0.55, mouseDist);
    float sizeMult = (1.0 + sizeInfluence * 1.5 * uMouseActive) * scrollSizeMod;

    vec3 lightDir1 = normalize(vec3(
      sin(uTime * 0.15) * 0.6, 0.8, cos(uTime * 0.2) * 0.5 + 0.3
    ));
    vec3 camDir = normalize(vec3(0.0, 1.8, 4.5) - p);
    vec3 halfV = normalize(lightDir1 + camDir);
    float spec = pow(max(dot(aNormal, halfV), 0.0), 40.0);

    vLight = 0.92 + spec * 0.08;
    vSeed = aSeed;
    vBright = aBright;
    vWorldPos = p;
    vNormal = aNormal;
    vLogoEdge = aLogoEdge;
    vMouseProx = (1.0 - smoothstep(0.0, 0.45, mouseDist)) * uMouseActive;

    // Intro assembly: bar starts expanded 4x from its center and contracts inward.
    // All particles move in the same direction (toward bar center) — no crossing paths.
    // Small aScatterOffset adds natural variation without changing overall direction.
    float arrivalT = clamp(uIntroT * 1.35 - aSeed * 0.35, 0.0, 1.0);
    float introProgress = 1.0 - pow(1.0 - arrivalT, 3.0); // ease-out cubic
    p = mix(p * uIntroExpand + aScatterOffset * uIntroScatter, p, introProgress);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);

    // Size: variety and fade grow continuously with spread
    float starSz = 0.6 + aSeed * 1.4;
    float netSizeMult = mix(1.0, starSz * netAlpha, spreadT);
    gl_PointSize = 2.0 * uPixelRatio * sizeMult * netSizeMult;

    gl_Position = projectionMatrix * mv;
    vLogoParticle = 0.0;
    if (aMasked > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; }
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uMouseActive;
  uniform float uScrollT;
  uniform vec2 uMouseScreen;
  varying float vLight;
  varying float vSeed;
  varying float vBright;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vLogoEdge;
  varying float vMouseProx;
  varying float vLogoParticle;
  varying float vNetAlpha;

  vec3 mod289f(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289f(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permutef(vec4 x){return mod289f(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrtf(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289f(i);
    vec4 p=permutef(permutef(permutef(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
      +i.y+vec4(0.0,i1.y,i2.y,1.0))
      +i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrtf(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  void main(){
    float d = length(gl_PointCoord - vec2(0.5));
    float circle = 1.0 - smoothstep(0.40, 0.50, d);

    if (circle < 0.01) discard;

    vec3 deepShadow   = vec3(0.239, 0.165, 0.031);
    vec3 darkGold     = vec3(0.310, 0.214, 0.047);
    vec3 shadowGold   = vec3(0.380, 0.263, 0.063);
    vec3 richGold     = vec3(0.533, 0.376, 0.098);
    vec3 midGold      = vec3(0.659, 0.471, 0.122);
    vec3 classicGold  = vec3(0.784, 0.565, 0.153);
    vec3 warmGold     = vec3(0.878, 0.671, 0.149);
    vec3 brightGold   = vec3(0.937, 0.776, 0.224);
    vec3 whiteShine   = vec3(0.973, 0.875, 0.502);
    vec3 pureWhite    = vec3(0.992, 0.949, 0.722);
    vec3 roseGold     = vec3(0.780, 0.490, 0.180);

    float t = uTime;
    vec3 wp = vWorldPos;

    vec3 corner0 = vec3(-1.3, -0.2275, -0.4225);
    vec3 corner1 = vec3( 1.3, -0.2275, -0.4225);
    vec3 corner2 = vec3( 1.3, -0.2275,  0.4225);
    vec3 corner3 = vec3(-1.3, -0.2275,  0.4225);

    float cycleDuration = 32.0;
    float waveTime = mod(t, cycleDuration);
    float cycleIndex = floor(t / cycleDuration);
    float h = fract(sin(cycleIndex * 127.1 + 311.7) * 43758.5453);
    int activeCorner = min(int(floor(h * 4.0)), 3);
    float prevH = fract(sin((cycleIndex - 1.0) * 127.1 + 311.7) * 43758.5453);
    int prevCorner = min(int(floor(prevH * 4.0)), 3);

    float waveProgress = clamp(waveTime / 8.0, 0.0, 1.0);
    float easedProgress = waveProgress * waveProgress * (3.0 - 2.0 * waveProgress);
    float brightnessRamp = smoothstep(0.0, 3.0, waveTime);
    float waveFade = 1.0 - smoothstep(6.0, 8.0, waveTime);
    float waveIntensity = brightnessRamp * waveFade;

    vec3 waveOrigin = corner0;
    if (activeCorner == 1) waveOrigin = corner1;
    if (activeCorner == 2) waveOrigin = corner2;
    if (activeCorner == 3) waveOrigin = corner3;

    float maxDist = 3.6;
    float distFromOrigin = length(wp - waveOrigin);
    float normDist = distFromOrigin / maxDist;
    float waveFrontDist = normDist - easedProgress;
    float originFade = smoothstep(0.0, 0.25, normDist);
    float waveA = exp(-waveFrontDist * waveFrontDist * 108.0) * waveIntensity * originFade;

    vec3 prevOrigin = corner0;
    if (prevCorner == 1) prevOrigin = corner1;
    if (prevCorner == 2) prevOrigin = corner2;
    if (prevCorner == 3) prevOrigin = corner3;

    float prevFade = exp(-(waveTime + cycleDuration) * 0.3) * 0.25;
    float prevDist = length(wp - prevOrigin) / maxDist;
    float prevOriginFade = smoothstep(0.0, 0.25, prevDist);
    float waveB = exp(-(prevDist - 1.0) * (prevDist - 1.0) * 40.5) * prevFade * prevOriginFade;

    float darkShimmer = snoise(vec3(wp.x * 5.0 + t * 0.03, wp.z * 5.0 + t * 0.02, wp.y * 4.0 + t * 0.025));
    float darkShine = smoothstep(0.2, 0.7, darkShimmer) * 0.06;

    float brightPulse = 0.5 + 0.5 * sin(t * 0.4 + vSeed * 40.0);
    float brightBoost = vBright * mix(0.28, 0.58, brightPulse) + (1.0 - vBright) * 0.12;
    float glintPhase = sin(t * 1.1 + vSeed * 100.0) * sin(t * 0.7 + vSeed * 67.0);
    float glint = vBright * smoothstep(0.78, 1.0, glintPhase) * 0.80;

    // Mouse proximity flare — particles near cursor flash bright gold/white
    float mouseRandSeed = fract(sin(vSeed * 127.1 + 311.7) * 43758.5453);
    float mouseFlicker = 0.6 + 0.4 * sin(t * 8.0 + vSeed * 200.0);
    float mouseBright = vMouseProx * mouseFlicker * (0.5 + mouseRandSeed * 0.5);

    float waveCombined = clamp(waveA + waveB, 0.0, 1.2);

    vec3 viewDir = normalize(vec3(0.0, 1.8, 4.5) - wp);
    vec3 N = normalize(vNormal);

    vec3 sun1 = normalize(vec3(sin(t * 0.06) * 0.5 + 0.2, 0.85, cos(t * 0.07) * 0.4 + 0.15));
    vec3 half1 = normalize(sun1 + viewDir);
    float sp1 = pow(max(dot(N, half1), 0.0), 140.0);
    float sp1micro = pow(max(dot(N, half1), 0.0), 800.0);
    float sp1broad = pow(max(dot(N, half1), 0.0), 18.0);
    float fres1 = pow(1.0 - max(dot(N, viewDir), 0.0), 3.0);
    float sunSpec1 = sp1 * 0.90 + sp1broad * 0.38 + fres1 * sp1 * 0.50 + sp1micro * 1.80;

    vec3 sun2 = normalize(vec3(-0.3 + sin(t * 0.045 + 2.5) * 0.3, 0.75, -0.25 + cos(t * 0.055 + 1.8) * 0.25));
    vec3 half2 = normalize(sun2 + viewDir);
    float sp2 = pow(max(dot(N, half2), 0.0), 50.0);
    float sunSpec2 = sp2 * 0.45;
    float diff1 = max(dot(N, sun1), 0.0) * 0.22;
    float diff2 = max(dot(N, sun2), 0.0) * 0.14;
    float aniso = 1.0 - abs(dot(half1, normalize(vec3(1.0, 0.0, 0.0))));
    float anisoHighlight = pow(aniso, 6.0) * sp1broad * 0.38;
    float rim = pow(1.0 - max(dot(N, viewDir), 0.0), 3.5) * 0.30;
    float sunTotal = sunSpec1 + sunSpec2 + diff1 + diff2 + anisoHighlight + rim;

    float grainPrimary   = snoise(vec3(wp.x * 60.0, wp.z * 3.0 + t * 0.02, wp.y * 2.0));
    float grainSecondary = snoise(vec3(wp.x * 45.0 + 20.0, wp.z * 5.0, wp.y * 3.0 + t * 0.015));
    float grainCross     = snoise(vec3(wp.x * 8.0, wp.z * 40.0 + t * 0.01, wp.y * 35.0)) * 0.3;
    float brushedEffect  = (grainPrimary * 0.6 + grainSecondary * 0.3 + grainCross) * 0.08 * (1.0 + waveCombined * 0.6);

    float surfaceNoise = snoise(vec3(wp.x * 4.0 + t * 0.075, wp.z * 4.0, wp.y * 3.0)) * 0.08;
    float ambientAngle = t * 0.02;
    float ambientDir = wp.x * cos(ambientAngle) + wp.z * sin(ambientAngle);
    float ambientGrad = sin(ambientDir * 0.6) * 0.10 + 0.62;

    float brightWave = waveCombined * 0.42;
    float darkEdge = exp(-waveCombined * waveCombined * 0.5) * 0.10;

    // Slow rolling reflection bands — simulate overhead light sweeping across the bar
    float roll1 = exp(-pow(wp.x - sin(t * 0.06) * 1.3, 2.0) * 2.2) * 0.72;
    float roll2 = exp(-pow(wp.z - cos(t * 0.04) * 0.38, 2.0) * 4.5) * 0.45;
    float roll3 = exp(-pow(wp.x + cos(t * 0.08 + 1.4) * 0.9, 2.0) * 3.2) * 0.40;
    float rolling = clamp(roll1 + roll2 + roll3, 0.0, 0.90);

    // ── Traveling sweep wave (bright → dark → bright, OMMA-style) ──────────
    // Primary gradient — one full wave wider than the bar, so you see one smooth
    // dark-to-bright gradient at a time (Morpho-style half-lit hemisphere look)
    float sweepAxis  = wp.x * 0.75 + wp.z * 0.42;
    float sweepPhase = sweepAxis * 1.5 - t * 0.55;
    float sweep      = 0.5 + 0.5 * sin(sweepPhase);   // smooth gradient, no smoothstep

    // Secondary wave adds organic variety without sharp banding
    float sweepAxis2  = wp.x * (-0.45) + wp.z * 0.88;
    float sweepPhase2 = sweepAxis2 * 1.2 - t * 0.34;
    float sweep2      = 0.5 + 0.5 * sin(sweepPhase2);
    sweep = mix(sweep, sweep2, 0.28);

    float sweepHighlight = sweep * sweep * 0.80;
    float sweepShadow    = (1.0 - sweep) * (1.0 - sweep) * 0.65;
    float sweepNet       = sweepHighlight - sweepShadow;
    // ── end sweep ──────────────────────────────────────────────────────────

    // ── Idle shimmer wave (default / no-cursor state) ───────────────────────
    // Two wave fronts sweep the bar. Wide per-particle seed jitter means
    // adjacent particles respond at different times — individual particle
    // pulses rather than a uniform band. Outside the wave: particles darken
    // deeply so the lit zone creates real contrast.

    // Wave 1 — diagonal NE, ~9 s cycle
    float shimAxis1  = wp.x * 0.82 + wp.z * 0.32;
    float shimFront1 = mix(-1.8, 1.8, mod(t * 0.110, 1.0));
    float shimSeed1  = (vSeed - 0.5) * 0.85;            // wide jitter = organic scatter
    float shimGlow1  = exp(-pow(shimAxis1 + shimSeed1 - shimFront1, 2.0) * 4.8);

    // Wave 2 — diagonal NW, ~13 s cycle, half-phase offset so one is always crossing
    float shimAxis2  = wp.x * (-0.55) + wp.z * 0.72;
    float shimFront2 = mix(-1.4, 1.4, mod(t * 0.077 + 0.5, 1.0));
    float shimSeed2  = (fract(vSeed * 5.17 + 0.23) - 0.5) * 0.80;
    float shimGlow2  = exp(-pow(shimAxis2 + shimSeed2 - shimFront2, 2.0) * 4.2) * 0.88;

    float idleShimmer = clamp(shimGlow1 + shimGlow2, 0.0, 1.0);
    float idleBlend   = 1.0 - uMouseActive;   // fades out when cursor becomes active
    // ── end idle shimmer ────────────────────────────────────────────────────

    // ── Dynamic mouse/auto-orbit light ──────────────────────────────────────
    // When cursor is anywhere on screen: directional light follows it, making
    // whichever side the cursor is on glow brighter — the "lighting changes on
    // hover" effect from Morpho.
    // When cursor is idle: a gentle light slowly orbits on its own so the bar
    // is never fully static — the "internal moving shadow/glow" effect.
    vec3 autoOrbitDir = normalize(vec3(
      sin(t * 0.07) * 1.6,
      0.6 + sin(t * 0.04 + 1.0) * 0.5,
      1.8 + cos(t * 0.05) * 0.9
    ));
    vec3 mouseLightDir = normalize(vec3(uMouseScreen.x * 2.0, uMouseScreen.y * 1.6, 2.0));
    vec3 dynDir = normalize(mix(autoOrbitDir, mouseLightDir, uMouseActive));

    float dynDiff = max(dot(N, dynDir), 0.0);
    vec3 halfDyn  = normalize(dynDir + viewDir);
    float dynSpec = pow(max(dot(N, halfDyn), 0.0), 28.0);
    float dynLight = dynDiff * 0.55 + dynSpec * 0.35;
    // ── end dynamic light ───────────────────────────────────────────────────

    float metalGradient = clamp(0.46 + ambientGrad * 0.22 + brightWave - darkEdge + surfaceNoise + darkShine + brushedEffect + sunTotal + brightBoost + glint + rolling + dynLight + sweepNet + vLogoEdge * 0.18, 0.0, 1.0);

    vec3 col = mix(deepShadow, darkGold,   smoothstep(0.00, 0.10, metalGradient));
    col = mix(col, shadowGold,             smoothstep(0.08, 0.20, metalGradient));
    col = mix(col, richGold,               smoothstep(0.18, 0.32, metalGradient));
    col = mix(col, midGold,                smoothstep(0.28, 0.42, metalGradient));
    col = mix(col, classicGold,            smoothstep(0.38, 0.52, metalGradient));
    col = mix(col, warmGold,               smoothstep(0.48, 0.63, metalGradient));
    col = mix(col, brightGold,             smoothstep(0.55, 0.70, metalGradient));
    col = mix(col, whiteShine,             smoothstep(0.63, 0.80, metalGradient));
    col = mix(col, pureWhite,              smoothstep(0.75, 1.00, metalGradient));

    float roseFactor = smoothstep(0.28, 0.50, metalGradient) * (1.0 - smoothstep(0.58, 0.72, metalGradient)) * 0.18;
    col = mix(col, roseGold, roseFactor);
    col = mix(col, brightGold, pow(clamp(waveCombined, 0.0, 1.0), 1.5) * 0.35);
    col = mix(col, whiteShine, pow(clamp(waveCombined, 0.0, 1.0), 3.0) * 0.20);

    // ── Sweep color temperature (Morpho-style) ─────────────────────────────
    // Trough: deep shadow — near-black in dark zone for dramatic contrast
    col *= mix(0.15, 1.0, sweep);
    // Crest: push base color toward warm white-gold
    col = mix(col, whiteShine, sweep * sweep * 0.58);
    // Bright particles in the lit zone flare up — the "gap" texture visible in light
    col = mix(col, warmGold,   vBright * sweep * sweep * 0.62);
    col = mix(col, brightGold, vBright * pow(sweep, 3.0) * 0.55);
    col = mix(col, whiteShine, vBright * pow(sweep, 4.0) * 0.38);

    // Idle shimmer — darken base heavily so wave contrast is dramatic,
    // then layer warm amber → gold → highlight on the lit zone.
    vec3 deepAmber = vec3(0.88, 0.55, 0.05);
    float shimmerOn = idleShimmer * idleBlend;
    // Darken everything outside the wave; restore to full as wave arrives
    col *= mix(1.0, mix(0.32, 1.0, idleShimmer), idleBlend);
    col = mix(col, deepAmber,  shimmerOn * 0.78);
    col = mix(col, warmGold,   shimmerOn * shimmerOn * 0.88);
    col = mix(col, brightGold, pow(shimmerOn, 2.5) * 0.78);
    col = mix(col, whiteShine, pow(shimmerOn, 3.5) * 0.52);

    float yNorm = clamp((wp.y + 0.234) / 0.468, 0.0, 1.0);
    float edgeHalfW = mix(1.3, 1.092, yNorm);
    float edgeHalfD = mix(0.416, 0.286, yNorm);
    float dLeft   = abs(wp.x + edgeHalfW);
    float dRight  = abs(wp.x - edgeHalfW);
    float dFront  = abs(wp.z - edgeHalfD);
    float dBack   = abs(wp.z + edgeHalfD);
    float dTop    = abs(wp.y - 0.234);
    float dBottom = abs(wp.y + 0.234);
    float minEdgeDist = min(min(min(dLeft, dRight), min(dFront, dBack)), min(dTop, dBottom));
    col = mix(col, brightGold, smoothstep(0.06, 0.0, minEdgeDist) * 0.35 + smoothstep(0.12, 0.02, minEdgeDist) * 0.15);

    float bottomFaceProx = smoothstep(0.08, 0.0, dBottom);
    float dBL = abs(wp.x + 1.3), dBR = abs(wp.x - 1.3);
    float dBF = abs(wp.z - 0.416), dBBk = abs(wp.z + 0.416);
    float minBL = min(min(dBL, dBR), min(dBF, dBBk));
    float totalBottomEdge = clamp(
      smoothstep(0.055, 0.0, minBL) * bottomFaceProx * 0.70 +
      smoothstep(0.13, 0.02, minBL) * bottomFaceProx * 0.35 +
      smoothstep(0.05, 0.0, min(dBL,dBR)) * smoothstep(0.05, 0.0, min(dBF,dBBk)) * bottomFaceProx * 0.55,
      0.0, 1.0);

    float frontFaceProx   = smoothstep(0.15, 0.0, dFront);
    float bottomPlaneProx = smoothstep(0.12, 0.0, dBottom);
    float ffbe = frontFaceProx * bottomPlaneProx;
    float totalFrontBottom = clamp(
      smoothstep(0.03, 0.0, dFront) * smoothstep(0.03, 0.0, dBottom) * 1.8 +
      smoothstep(0.06, 0.0, dFront) * smoothstep(0.06, 0.0, dBottom) * 1.2 +
      smoothstep(0.12, 0.01, dFront) * smoothstep(0.10, 0.01, dBottom) * 0.7 +
      smoothstep(0.20, 0.03, dFront) * smoothstep(0.16, 0.03, dBottom) * 0.35 +
      smoothstep(0.08, 0.0, dLeft) * ffbe * 0.9 +
      smoothstep(0.08, 0.0, dRight) * ffbe * 0.9,
      0.0, 1.0);

    col = mix(col, pureWhite,  totalBottomEdge * 0.45);
    col = mix(col, brightGold, totalBottomEdge * 0.55);
    col = mix(col, pureWhite,  totalFrontBottom * 0.70);
    col = mix(col, whiteShine, totalFrontBottom * 0.50);
    col = mix(col, brightGold, totalFrontBottom * 0.30);

    // Mouse proximity flare — bright warm-white bloom on nearby particles
    col = mix(col, pureWhite, mouseBright * 0.75);
    col = mix(col, whiteShine, mouseBright * 0.50);

    col = max(col, deepShadow * 0.90);
    col = clamp(col, 0.0, 1.0);

    // ── Traveling interior wave — light from inside through particle gaps ────
    // A band of light sweeps the bar length every ~7 s. Bright particles (gaps)
    // flare to warm-white gold; dark particles hold deep — internal light leaking
    // through the cloud. Two waves offset by half a cycle keep it always alive.
    float tWv_axis = wp.x * 0.82 + wp.z * 0.25;
    float tWv1_pos = mix(-2.2, 2.2, mod(t * 0.065, 1.0));
    float tWv2_pos = mix(-2.2, 2.2, mod(t * 0.065 + 0.5, 1.0));
    float tWv1     = exp(-pow(tWv_axis - tWv1_pos, 2.0) * 2.2);
    float tWv2     = exp(-pow(tWv_axis - tWv2_pos, 2.0) * 2.2) * 0.62;
    float tWvTotal = clamp(tWv1 + tWv2, 0.0, 1.0);

    col = mix(col, warmGold,   vBright * tWvTotal * 0.50);
    col = mix(col, brightGold, vBright * tWvTotal * tWvTotal * 0.55);
    col = mix(col, whiteShine, vBright * tWvTotal * tWvTotal * tWvTotal * 0.48);
    col *= 1.0 - (1.0 - vBright) * tWvTotal * 0.30;
    // ── end traveling wave ───────────────────────────────────────────────────

    // ── Internal moving point light ────────────────────────────────────────
    // A bright orb moves inside the bar volume. Particles close to it flare
    // to near-white, simulating light leaking through particle gaps.
    // Auto-orbits slowly when idle; shifts with mouse position when active.
    vec3 autoIntPos = vec3(
      sin(t * 0.38) * 1.05,
      -0.02 + sin(t * 0.26 + 1.1) * 0.14,
      cos(t * 0.31) * 0.24
    );
    vec3 mouseIntPos = vec3(uMouseScreen.x * 1.15, uMouseScreen.y * 0.15, 0.15);
    vec3 intLightPos = mix(autoIntPos, mouseIntPos, uMouseActive);

    float intDist      = length(wp - intLightPos);
    float intGlow      = exp(-intDist * intDist * 2.8);
    float intGlowSharp = exp(-intDist * intDist * 12.0);
    float intTotal     = intGlow * 0.55 + intGlowSharp * 0.90;

    // Selective: bright particles (gaps) flare strongly; dark ones absorb
    float intSelectivity = vBright * 1.0 + (1.0 - vBright) * 0.28;
    vec3 intCol = mix(vec3(0.95, 0.84, 0.42), vec3(1.0, 0.97, 0.82), intGlowSharp);
    col = mix(col, intCol, clamp(intTotal * 0.88 * intSelectivity, 0.0, 0.92));
    col = mix(col, pureWhite, vBright * intGlowSharp * 0.52);
    // ── end internal light ─────────────────────────────────────────────────

    // Per-dot sphere shading — warm highlight at center, dims toward edge
    float dotLift = max(0.40 - d, 0.0) * 2.80;
    float dotDim  = smoothstep(0.24, 0.50, d) * 0.32;
    col = col * (1.0 - dotDim) + vec3(1.0, 0.94, 0.55) * dotLift * dotLift * 0.45;
    col = clamp(col, 0.0, 1.0);

    gl_FragColor = vec4(col, 0.95 * circle * vNetAlpha);
  }
`;

// ── CPU-side displacement ──
const displacement = new Float32Array(PARTICLE_COUNT * 3);
const velocity = new Float32Array(PARTICLE_COUNT * 3);
displacement.fill(0);
velocity.fill(0);

const origPositions = new Float32Array(PARTICLE_COUNT * 3);
for (let i = 0; i < PARTICLE_COUNT * 3; i++) origPositions[i] = origPos[i];

let prevMouseLocal = new THREE.Vector3(9999, 9999, 9999);
let mouseLocal = new THREE.Vector3(9999, 9999, 9999);
let mouseVelX = 0, mouseVelZ = 0;
let mouseOnBar = false;
let lastMouseTime = 0;
let mouseJustEntered = true;

const mat = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector3(9999,9999,0) },
    uMouseActive: { value: 0 },
    uMouseScreen: { value: new THREE.Vector2(0, 0) },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    uIntroT: { value: 0 },
    uScrollT: { value: 0 },
    uIntroExpand:  { value: isMobile ? 1.0 : 4.2 },
    uIntroScatter: { value: isMobile ? 4.0 : 0.7 }
  },
  transparent: true,
  depthWrite: false,
  blending: THREE.NormalBlending
});

const points = new THREE.Points(geo, mat);
points.name = 'goldBarParticles';
points.position.set(-0.006, 0, -0.001);
points.rotation.set(
  48.5 * Math.PI / 180,
  -3.3 * Math.PI / 180,
  -175.5 * Math.PI / 180
);
points.scale.set(1.069, 1.069, 1.045);
barGroup.add(points);

// ── Logo ──
const logoTexture = new THREE.TextureLoader().load('assets/logo.png');
logoTexture.colorSpace = THREE.SRGBColorSpace;

const logoVertShader = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const logoFragShader = `
  uniform sampler2D uLogoMap;
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise2D(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), dd = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, dd, f.x), f.y);
  }

  void main() {
    vec4 texel = texture2D(uLogoMap, vUv);
    if (texel.a < 0.01) discard;

    vec3 baseCol = texel.rgb;

    float barCycleDuration = 32.0;
    float barWaveTime = mod(uTime, barCycleDuration);
    float logoFadeIn  = smoothstep(8.0, 10.0, barWaveTime);
    float logoFadeOut = 1.0 - smoothstep(29.0, 32.0, barWaveTime);
    float logoActivation = logoFadeIn * logoFadeOut;

    vec2 centered = vUv - vec2(0.5);
    float distFromCenter = length(centered);

    float sampleStep = 0.015;
    float alphaSum = 0.0;
    alphaSum += texture2D(uLogoMap, vUv + vec2( sampleStep,  0.0)).a;
    alphaSum += texture2D(uLogoMap, vUv + vec2(-sampleStep,  0.0)).a;
    alphaSum += texture2D(uLogoMap, vUv + vec2( 0.0,  sampleStep)).a;
    alphaSum += texture2D(uLogoMap, vUv + vec2( 0.0, -sampleStep)).a;
    alphaSum += texture2D(uLogoMap, vUv + vec2( sampleStep,  sampleStep)).a;
    alphaSum += texture2D(uLogoMap, vUv + vec2(-sampleStep,  sampleStep)).a;
    alphaSum += texture2D(uLogoMap, vUv + vec2( sampleStep, -sampleStep)).a;
    alphaSum += texture2D(uLogoMap, vUv + vec2(-sampleStep, -sampleStep)).a;

    float logoPulseDuration = 7.0;
    float logoWindowTime = max(barWaveTime - 10.0, 0.0);
    float pulseProgress  = mod(logoWindowTime, logoPulseDuration) / logoPulseDuration;
    float easedWave = pulseProgress * pulseProgress * (3.0 - 2.0 * pulseProgress);

    float ringPos  = mix(0.55, 0.0, easedWave);
    float ringDist = abs(distFromCenter - ringPos);
    float ringSharp = exp(-ringDist * ringDist * 600.0) * 1.2;
    float ringGlow  = exp(-ringDist * ringDist *  80.0) * 0.55;

    float sStep2 = mix(0.04, 0.005, easedWave);
    float a2 = (
      texture2D(uLogoMap, vUv + vec2( sStep2, 0.0)).a +
      texture2D(uLogoMap, vUv + vec2(-sStep2, 0.0)).a +
      texture2D(uLogoMap, vUv + vec2(0.0,  sStep2)).a +
      texture2D(uLogoMap, vUv + vec2(0.0, -sStep2)).a
    ) / 4.0;
    float edgeWaveIntensity = (1.0 - smoothstep(0.0, 0.2, a2 - 0.1)) * smoothstep(0.0, 0.3, easedWave) * 0.6;

    float n1 = noise2D(vUv * 22.0 + vec2(uTime * 1.8, 0.0));
    float n2 = noise2D(vUv * 33.0 + vec2(0.0, uTime * 1.2));
    float sparkleGlint = smoothstep(0.5, 0.72, n1 * n2) * 0.5
      * smoothstep(0.08, 0.0, ringDist) * 2.0
      * (0.5 + 0.5 * sin(uTime * 4.0 + n1 * 15.0));

    float centerFlash2 = smoothstep(0.85, 1.0, easedWave) * smoothstep(0.12, 0.0, distFromCenter) * 0.7
      * (1.0 - smoothstep(0.92, 1.0, easedWave));

    vec3 viewDir = normalize(vec3(0.0, 1.8, 4.5) - vWorldPos);
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 3.0);
    float edgeShimmer = fresnel * 0.08;

    float totalShine = (ringSharp + ringGlow + edgeWaveIntensity + sparkleGlint + centerFlash2) * logoActivation + edgeShimmer;
    vec3 shineColor = mix(vec3(0.95, 0.82, 0.45), vec3(1.0, 0.97, 0.90), smoothstep(0.3, 0.9, totalShine));

    vec3 finalCol = baseCol + shineColor * totalShine * 0.55;
    gl_FragColor = vec4(clamp(finalCol, 0.0, 1.0), texel.a * 0.95 * uOpacity);
  }
`;

const logoMat = new THREE.ShaderMaterial({
  vertexShader: logoVertShader,
  fragmentShader: logoFragShader,
  uniforms: {
    uLogoMap: { value: logoTexture },
    uTime: { value: 0 },
    uOpacity: { value: 0 }
  },
  transparent: true,
  depthTest: false,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.NormalBlending
});

const logoSize = 0.28;
const logoPlane = new THREE.PlaneGeometry(logoSize, logoSize);
const logoMesh = new THREE.Mesh(logoPlane, logoMat);
logoMesh.name = 'barLogo';
logoMesh.renderOrder = 999;

function localToPointsWorld(localPt) {
  const p = localPt.clone();
  p.multiply(points.scale);
  const q = new THREE.Quaternion().setFromEuler(points.rotation);
  p.applyQuaternion(q);
  p.add(points.position);
  return p;
}

function localDirToPointsWorld(localDir) {
  const d = localDir.clone();
  const q = new THREE.Quaternion().setFromEuler(points.rotation);
  d.applyQuaternion(q);
  return d.normalize();
}

const _yNorm = 0.5;
const _centroidZ = bD / 2 + (tD / 2 - bD / 2) * _yNorm;
const frontCenter = new THREE.Vector3(0, 0, _centroidZ);
const backCenter  = new THREE.Vector3(0, 0, -_centroidZ);

const frontNormal = new THREE.Vector3().crossVectors(
  new THREE.Vector3().subVectors(corners.b2, corners.b3),
  new THREE.Vector3().subVectors(corners.t3, corners.b3)
).normalize();

const backNormal = new THREE.Vector3().crossVectors(
  new THREE.Vector3().subVectors(corners.b0, corners.b1),
  new THREE.Vector3().subVectors(corners.t1, corners.b1)
).normalize();

const frontInBarGroup = localToPointsWorld(frontCenter);
const backInBarGroup  = localToPointsWorld(backCenter);

const frontWorldPos = frontInBarGroup.clone();
barGroup.localToWorld(frontWorldPos);
const backWorldPos = backInBarGroup.clone();
barGroup.localToWorld(backWorldPos);

const camPos = camera.position.clone();
const useFront = frontWorldPos.distanceTo(camPos) <= backWorldPos.distanceTo(camPos);

const chosenCenterBarGroup = useFront ? frontInBarGroup : backInBarGroup;
const chosenNormalBarGroup = localDirToPointsWorld(useFront ? frontNormal : backNormal);

logoMesh.position.copy(chosenCenterBarGroup).addScaledVector(chosenNormalBarGroup, 0.15);
logoMesh.lookAt(logoMesh.position.clone().add(chosenNormalBarGroup));
logoMesh.rotateZ(Math.PI);
barGroup.add(logoMesh);
logoMesh.visible = true;

points.updateMatrix();
logoMesh.updateMatrix();
const ptlMatrix = new THREE.Matrix4().copy(logoMesh.matrix).invert().multiply(points.matrix);

const maskImg = new Image();
maskImg.onerror = (e) => console.error('[mask] image failed to load', e);
maskImg.onload = function() {
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = maskImg.width; maskCanvas.height = maskImg.height;
  const maskCtx = maskCanvas.getContext('2d');
  maskCtx.drawImage(maskImg, 0, 0);
  const pixels = maskCtx.getImageData(0, 0, maskImg.width, maskImg.height).data;
  const iw = maskImg.width, ih = maskImg.height;
  function sampleA(u, v) {
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
    const px = Math.min(Math.floor(u * iw), iw - 1);
    const py = Math.min(Math.floor((1 - v) * ih), ih - 1);
    return pixels[(py * iw + px) * 4 + 3] / 255;
  }
  const tmp = new THREE.Vector3();
  const half = logoSize * 0.5;
  const outerRadius = logoSize * 1.6; // soft thinning zone extends beyond logo
  const mAttr = geo.getAttribute('aMasked');
  const eAttr = geo.getAttribute('aLogoEdge');
  const edgeStep = 3.0 / iw;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    tmp.set(origPositions[i3], origPositions[i3 + 1], origPositions[i3 + 2]).applyMatrix4(ptlMatrix);
    const dist2D = Math.sqrt(tmp.x * tmp.x + tmp.y * tmp.y);
    if (dist2D > outerRadius) continue;
    const u = tmp.x / logoSize + 0.5, v = tmp.y / logoSize + 0.5;
    const alpha = sampleA(u, v);
    if (alpha > 0.5) {
      // Inside logo shape: always remove
      mAttr.array[i] = 1.0;
    } else {
      // Gradual probabilistic thinning — heavy near center, fades to zero at outerRadius
      const normDist = dist2D / outerRadius;
      const thinProb = (1.0 - normDist) * (1.0 - normDist) * 0.82;
      if (seeds[i] < thinProb) {
        mAttr.array[i] = 1.0;
      } else if (dist2D < half) {
        const maxN = Math.max(sampleA(u + edgeStep, v), sampleA(u - edgeStep, v), sampleA(u, v + edgeStep), sampleA(u, v - edgeStep));
        if (maxN > 0.3) eAttr.array[i] = maxN;
      }
    }
  }
  mAttr.needsUpdate = true; eAttr.needsUpdate = true;
};
maskImg.src = 'assets/logo.png';

// ── Crack particle system (OMMA logo animation) ──────────────────────────
// Builds per-pixel particles from the logo image, assigns crack-propagation
// timing to each, then crumbles them off the bar face on scroll.
let crackSystem = null;

function buildCrackParticles(img) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  const pixels = ctx.getImageData(0, 0, size, size).data;

  // Generate 7 crack lines radiating from center with branching
  const allCrackPts = [];
  for (let c = 0; c < 7; c++) {
    const baseAngle = (c / 7) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    let cx = 0.5, cy = 0.5;
    const steps = 40 + Math.floor(Math.random() * 30);
    for (let s = 0; s < steps; s++) {
      const a = baseAngle + (Math.random() - 0.5) * 0.3;
      const step = 0.008 + Math.random() * 0.008;
      cx += Math.cos(a) * step; cy += Math.sin(a) * step;
      if (cx < 0 || cx > 1 || cy < 0 || cy > 1) break;
      allCrackPts.push({ x: cx, y: cy, order: s / steps });
      if (Math.random() < 0.15) {
        let bx = cx, by = cy;
        const ba = a + (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.8);
        const bs = 8 + Math.floor(Math.random() * 15);
        for (let i = 0; i < bs; i++) {
          bx += Math.cos(ba + (Math.random() - 0.5) * 0.4) * (0.006 + Math.random() * 0.006);
          by += Math.sin(ba + (Math.random() - 0.5) * 0.4) * (0.006 + Math.random() * 0.006);
          if (bx < 0 || bx > 1 || by < 0 || by > 1) break;
          allCrackPts.push({ x: bx, y: by, order: (s + i / bs) / steps });
        }
      }
    }
  }

  // Build spatial grid for fast crack-distance lookup
  const gridRes = 32;
  const grid = Array.from({ length: gridRes * gridRes }, () => []);
  for (const pt of allCrackPts) {
    const gx = Math.min(Math.floor(pt.x * gridRes), gridRes - 1);
    const gy = Math.min(Math.floor(pt.y * gridRes), gridRes - 1);
    grid[gy * gridRes + gx].push(pt);
  }

  // Assign crack-time to each pixel (how early that pixel starts decaying)
  const crackTimeMap = new Float32Array(size * size).fill(1.0);
  const crackWidth = 0.04;
  for (let y = 0; y < size; y++) {
    const uy = y / size;
    const gy = Math.min(Math.floor(uy * gridRes), gridRes - 1);
    for (let x = 0; x < size; x++) {
      const ux = x / size;
      const gx = Math.min(Math.floor(ux * gridRes), gridRes - 1);
      let bestDist = 999, bestOrder = 1.0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = gx + dx, ny = gy + dy;
          if (nx < 0 || nx >= gridRes || ny < 0 || ny >= gridRes) continue;
          for (const pt of grid[ny * gridRes + nx]) {
            const d = Math.hypot(ux - pt.x, uy - pt.y);
            if (d < bestDist) { bestDist = d; bestOrder = pt.order; }
          }
        }
      }
      const prox = Math.max(0, 1 - bestDist / crackWidth);
      crackTimeMap[y * size + x] = bestOrder * 0.6 + (1 - prox) * 0.4;
    }
  }

  // Sample one particle per opaque pixel
  const positions = [], colors = [], cSeeds = [], cTimes = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (pixels[i + 3] / 255 < 0.15) continue;
      const u = x / size, v = 1 - y / size;
      positions.push((u - 0.5) * logoSize, (v - 0.5) * logoSize, 0);
      colors.push(pixels[i] / 255, pixels[i + 1] / 255, pixels[i + 2] / 255);
      cSeeds.push(Math.random());
      cTimes.push(crackTimeMap[y * size + x]);
    }
  }

  const crackGeo = new THREE.BufferGeometry();
  crackGeo.setAttribute('position',   new THREE.Float32BufferAttribute(positions, 3));
  crackGeo.setAttribute('color',      new THREE.Float32BufferAttribute(colors, 3));
  crackGeo.setAttribute('aSeed',      new THREE.Float32BufferAttribute(cSeeds, 1));
  crackGeo.setAttribute('aCrackTime', new THREE.Float32BufferAttribute(cTimes, 1));

  const crackVert = `
    attribute float aSeed;
    attribute float aCrackTime;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vDecay;
    uniform float uCrackProgress;
    uniform float uTime;
    void main() {
      vColor = color;
      vec3 pos = position;
      float crackInfluence = mix(1.0, 0.15, uCrackProgress);
      float decayStart = aCrackTime * 0.5 * crackInfluence;
      float localDecay = clamp((uCrackProgress - decayStart) / (0.2 + aSeed * 0.1), 0.0, 1.0);
      localDecay = max(localDecay, smoothstep(0.6, 1.0, uCrackProgress));
      float eased = localDecay * localDecay;
      vDecay = eased;
      if (eased > 0.0) {
        float angle = atan(position.y, position.x);
        pos.x += cos(angle) * eased * (0.04 + aSeed * 0.08);
        pos.y -= eased * eased * (0.15 + aSeed * 0.25);
        pos.x += (aSeed - 0.5) * eased * 0.12;
        pos.z += (aSeed - 0.5) * eased * 0.15;
        float tf = 3.0 + aSeed * 5.0;
        pos.x += sin(uTime * tf + aSeed * 40.0) * eased * 0.008;
        pos.y += cos(uTime * tf * 0.8 + aSeed * 30.0) * eased * 0.008;
      }
      vAlpha = 1.0 - smoothstep(0.2, 0.85, eased);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = 1.5;
    }
  `;
  const crackFrag = `
    varying vec3 vColor;
    varying float vAlpha;
    varying float vDecay;
    void main() {
      if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;
      vec3 col = mix(vColor, vColor * 0.2, smoothstep(0.0, 0.6, vDecay));
      float a = vAlpha * 0.95;
      if (a < 0.005) discard;
      gl_FragColor = vec4(col, a);
    }
  `;

  const crackMat = new THREE.ShaderMaterial({
    vertexShader: crackVert, fragmentShader: crackFrag,
    uniforms: { uCrackProgress: { value: 0 }, uTime: { value: 0 } },
    transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.NormalBlending, vertexColors: true
  });

  crackSystem = new THREE.Points(crackGeo, crackMat);
  crackSystem.position.copy(logoMesh.position);
  crackSystem.rotation.copy(logoMesh.rotation);
  crackSystem.renderOrder = 1000;
  crackSystem.visible = false;
  barGroup.add(crackSystem);
}

// Load logo image for crack particle building
{
  const crackImg = new Image();
  crackImg.onload = () => buildCrackParticles(crackImg);
  crackImg.src = 'assets/logo.png';
}
// ── end crack system ─────────────────────────────────────────────────────

// ── Hit mesh ──
const hitVerts = [
  -bW/2,-barH/2,-bD/2,  bW/2,-barH/2,-bD/2,  bW/2,-barH/2,bD/2,
  -bW/2,-barH/2,-bD/2,  bW/2,-barH/2,bD/2,  -bW/2,-barH/2,bD/2,
  -tW/2,barH/2,-tD/2,   tW/2,barH/2,tD/2,    tW/2,barH/2,-tD/2,
  -tW/2,barH/2,-tD/2,  -tW/2,barH/2,tD/2,    tW/2,barH/2,tD/2,
  -bW/2,-barH/2,bD/2,   bW/2,-barH/2,bD/2,   tW/2,barH/2,tD/2,
  -bW/2,-barH/2,bD/2,   tW/2,barH/2,tD/2,   -tW/2,barH/2,tD/2,
  bW/2,-barH/2,-bD/2,  -bW/2,-barH/2,-bD/2, -tW/2,barH/2,-tD/2,
  bW/2,-barH/2,-bD/2,  -tW/2,barH/2,-tD/2,   tW/2,barH/2,-tD/2,
  bW/2,-barH/2,bD/2,    bW/2,-barH/2,-bD/2,  tW/2,barH/2,-tD/2,
  bW/2,-barH/2,bD/2,    tW/2,barH/2,-tD/2,   tW/2,barH/2,tD/2,
  -bW/2,-barH/2,-bD/2, -bW/2,-barH/2,bD/2,  -tW/2,barH/2,tD/2,
  -bW/2,-barH/2,-bD/2, -tW/2,barH/2,tD/2,   -tW/2,barH/2,-tD/2,
];
const hitGeo = new THREE.BufferGeometry();
hitGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(hitVerts), 3));
hitGeo.computeVertexNormals();
const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
hitMesh.name = 'hitMesh';
hitMesh.position.copy(points.position);
hitMesh.rotation.copy(points.rotation);
hitMesh.scale.copy(points.scale);
barGroup.add(hitMesh);

// ── Mouse interaction ──
window.addEventListener('mousemove', (e) => {
  mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  mat.uniforms.uMouseScreen.value.set(mouseNDC.x, mouseNDC.y);
  mouseActive = true;

  raycaster.setFromCamera(mouseNDC, camera);
  const hits = raycaster.intersectObject(hitMesh);
  if (hits.length > 0) {
    const localHit = points.worldToLocal(hits[0].point.clone());
    if (mouseJustEntered || !mouseOnBar) {
      prevMouseLocal.copy(localHit);
      mouseLocal.copy(localHit);
      mouseVelX = 0;
      mouseVelZ = 0;
      mouseJustEntered = false;
    } else {
      prevMouseLocal.copy(mouseLocal);
      mouseLocal.copy(localHit);
      const now = performance.now();
      const dt = Math.max((now - lastMouseTime) / 1000, 0.001);
      mouseVelX = Math.max(-20, Math.min(20, (mouseLocal.x - prevMouseLocal.x) / dt));
      mouseVelZ = Math.max(-20, Math.min(20, (mouseLocal.z - prevMouseLocal.z) / dt));
    }
    mouse3D.copy(localHit);
    mouseOnBar = true;
    lastMouseTime = performance.now();
  } else {
    mouse3D.set(9999, 9999, 9999);
    mouseOnBar = false;
    mouseJustEntered = true;
  }
});

window.addEventListener('mouseleave', () => {
  mouseActive = false;
  mouseOnBar = false;
  mouseJustEntered = true;
  mouse3D.set(9999, 9999, 9999);
  mouseVelX = 0;
  mouseVelZ = 0;
});

// ── Touch events (mobile parallax) ──
window.addEventListener('touchmove', (e) => {
  if (e.touches.length > 0) {
    const touch = e.touches[0];
    targetRotY = ((touch.clientX / window.innerWidth) * 2 - 1) * 0.08;
    targetRotX = ((touch.clientY / window.innerHeight) * 2 - 1) * 0.05;
    mat.uniforms.uMouseScreen.value.set(
      (touch.clientX / window.innerWidth) * 2 - 1,
      -((touch.clientY / window.innerHeight) * 2 - 1)
    );
  }
}, { passive: true });
window.addEventListener('touchend', () => {
  targetRotY = 0;
  targetRotX = 0;
}, { passive: true });

// ── Dust ──
const dustCount = 200;
const dustArr = new Float32Array(dustCount * 3);
for (let i = 0; i < dustCount; i++) {
  dustArr[i*3]   = (Math.random()-0.5) * 10;
  dustArr[i*3+1] = (Math.random()-0.5) * 6;
  dustArr[i*3+2] = (Math.random()-0.5) * 4 - 2;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustArr, 3));
scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({
  color: 0xD4A97A, size: 1.0, sizeAttenuation: false,
  transparent: true, opacity: 0.08,
  blending: THREE.AdditiveBlending, depthWrite: false
})));

// ── Parallax ──
let targetRotY = 0, targetRotX = 0;
window.addEventListener('mousemove', (e) => {
  targetRotY = ((e.clientX / window.innerWidth) * 2 - 1) * 0.08;
  targetRotX = ((e.clientY / window.innerHeight) * 2 - 1) * 0.05;
});

// ── Scroll tracking ──
let scrollT = 0;
let smoothScrollT = 0;
window.addEventListener('scroll', () => {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  scrollT = maxScroll > 0 ? Math.min(1, window.scrollY / maxScroll) : 0;
}, { passive: true });

// ── Camera scroll keyframes [scrollT, pos, lookAt] ──
// 3-point: zoom in, then continuously pull back — no static hover phase
const camKF = isMobile ? [
  { t: 0.00, p: [0, 1.2, 5.5], l: [0, 0.0, 0] },
  { t: 0.30, p: [0, 0.5, 2.0], l: [0, 0.0, 0] },
  { t: 1.00, p: [0, 1.5, 9.5], l: [0, 0.0, 0] },
] : [
  { t: 0.00, p: [0, 1.8, 4.5], l: [0, 0.15, 0] },
  { t: 0.30, p: [0, 0.8, 2.5], l: [0, 0.00, 0] },
  { t: 1.00, p: [0, 1.8, 11.0], l: [0, 0.00, 0] },
];
const _initKF = camKF[0];
const _targetCamPos  = new THREE.Vector3(..._initKF.p);
const _targetLookAt  = new THREE.Vector3(..._initKF.l);
const _currentLookAt = new THREE.Vector3(..._initKF.l);

function getCamState(st) {
  for (let i = 0; i < camKF.length - 1; i++) {
    const a = camKF[i], b = camKF[i + 1];
    if (st >= a.t && st <= b.t) {
      const alpha = (st - a.t) / (b.t - a.t);
      const e = alpha * alpha * (3 - 2 * alpha);
      return {
        p: [a.p[0]+(b.p[0]-a.p[0])*e, a.p[1]+(b.p[1]-a.p[1])*e, a.p[2]+(b.p[2]-a.p[2])*e],
        l: [a.l[0]+(b.l[0]-a.l[0])*e, a.l[1]+(b.l[1]-a.l[1])*e, a.l[2]+(b.l[2]-a.l[2])*e],
      };
    }
  }
  const last = camKF[camKF.length - 1];
  return { p: [...last.p], l: [...last.l] };
}

// ── Circle Rings ──
function drawRings(t, sst) {
  const W = window.innerWidth, H = window.innerHeight;
  const cx = W / 2, cy = H / 2;
  const ref = Math.min(W * 0.9, H * 0.8);

  overlayCtx.clearRect(0, 0, W, H);

  // Growth: ring radius expands linearly; circle size stays tiny (cubic) until final stage
  const GROW_START = 0.20, GROW_END = 0.78;
  const FADE_START = 0.84, FADE_END = 1.00;

  let sizeP, alpha;
  if (sst < GROW_START) {
    sizeP = 0; alpha = 0;
  } else if (sst < GROW_END) {
    const r = (sst - GROW_START) / (GROW_END - GROW_START);
    sizeP = r * r * (3 - 2 * r);
    // alpha fades in quickly so rings are visible as tiny glowing dots from early on
    alpha = Math.min(sizeP * 6, 1);
  } else if (sst < FADE_START) {
    sizeP = 1; alpha = 1;
  } else {
    sizeP = 1;
    alpha = Math.max(0, 1 - (sst - FADE_START) / (FADE_END - FADE_START));
  }

  if (alpha < 0.005) return;

  const rings = [
    { radius: ref * 0.33, circleR: ref * 0.045, dir:  1, speed: 0.09, ri: 0 },
    { radius: ref * 0.62, circleR: ref * 0.038, dir: -1, speed: 0.06, ri: 1 },
  ];

  for (const ring of rings) {
    const ringR = ring.radius * sizeP;
    // Cubic curve: circles stay very small (≤12% of final) for most of the scroll,
    // then rapidly bloom to full size only as sizeP approaches 1 (the final stage)
    const circR = ring.circleR * Math.pow(sizeP, 3);
    const rot   = t * ring.speed * ring.dir;

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + rot;
      const x = cx + Math.cos(angle) * ringR;
      const y = cy + Math.sin(angle) * ringR;

      if (circR < 0.8) continue;

      overlayCtx.save();

      // ── Fill: dark warm-gray base (4A4743 @ 18%) + radial center glow (white @ 5%) ──
      overlayCtx.beginPath();
      overlayCtx.arc(x, y, circR, 0, Math.PI * 2);
      overlayCtx.fillStyle = `rgba(74,71,67,${alpha * 0.18})`;
      overlayCtx.fill();

      const radFill = overlayCtx.createRadialGradient(x, y, 0, x, y, circR);
      radFill.addColorStop(0, `rgba(255,255,255,${alpha * 0.05})`);
      radFill.addColorStop(1, `rgba(255,255,255,0)`);
      overlayCtx.beginPath();
      overlayCtx.arc(x, y, circR, 0, Math.PI * 2);
      overlayCtx.fillStyle = radFill;
      overlayCtx.fill();

      // ── Stroke: gold gradient (F4D058 → FFD53C → FFF7DA) combining all three Figma layers ──
      // Gradient is angled relative to the circle's position on the ring for organic variety
      const gAngle = angle + Math.PI * 0.25;
      const strokeGrad = overlayCtx.createLinearGradient(
        x + Math.cos(gAngle) * circR, y + Math.sin(gAngle) * circR,
        x - Math.cos(gAngle) * circR, y - Math.sin(gAngle) * circR
      );
      strokeGrad.addColorStop(0,   `rgba(244,208,88,${alpha * 0.35})`);  // F4D058 @ 50% layer dominant
      strokeGrad.addColorStop(0.5, `rgba(255,213,60,${alpha * 0.22})`);  // FFD53C @ 30% layer
      strokeGrad.addColorStop(1,   `rgba(255,247,218,${alpha * 0.12})`); // FFF7DA @ 20% layer

      // Soft gold glow (simulates the radial stroke spread)
      overlayCtx.shadowBlur  = circR * 0.4;
      overlayCtx.shadowColor = `rgba(244,208,88,${alpha * 0.08})`;

      overlayCtx.beginPath();
      overlayCtx.arc(x, y, circR, 0, Math.PI * 2);
      overlayCtx.strokeStyle = strokeGrad;
      overlayCtx.lineWidth   = Math.max(1.0, circR * 0.035);
      overlayCtx.stroke();

      // ── Logo ──
      const logo = ringLogos[ring.ri][i];
      if (logo && logo.loaded) {
        overlayCtx.save();
        overlayCtx.globalAlpha = alpha * 0.92;
        overlayCtx.beginPath();
        overlayCtx.arc(x, y, circR * 0.82, 0, Math.PI * 2);
        overlayCtx.clip();
        // maxDim ≤ clipRadius × √2 ensures even square logos never clip at corners
        // clipRadius = circR × 0.82 → max safe = circR × 1.16; use 1.08 for breathing room
        const maxDim = circR * 1.08;
        const nw = logo.naturalWidth  || 1;
        const nh = logo.naturalHeight || 1;
        const aspect = nw / nh;
        const drawW = aspect >= 1 ? maxDim : maxDim * aspect;
        const drawH = aspect >= 1 ? maxDim / aspect : maxDim;
        overlayCtx.imageSmoothingEnabled = true;
        overlayCtx.imageSmoothingQuality = 'high';
        overlayCtx.drawImage(logo, x - drawW / 2, y - drawH / 2, drawW, drawH);
        overlayCtx.restore();
      }

      overlayCtx.restore();
    }
  }
}

// ── Animation ──
const clock = new THREE.Clock();
let lastTime = 0;

function animate() {
  const t = clock.getElapsedTime();
  const dt = Math.min(t - lastTime, 0.033);
  lastTime = t;

  const influenceRadius = 0.62;
  const springK         = 0.7;
  const damping         = 1.2;
  const maxDisp         = 0.15;

  if (!isMobile) for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const ox = origPositions[i3], oy = origPositions[i3+1], oz = origPositions[i3+2];
    const dx = displacement[i3], dy = displacement[i3+1], dz = displacement[i3+2];
    let fx = 0, fy = 0, fz = 0;

    if (mouseOnBar) {
      const toMouseX = mouseLocal.x - (ox + dx);
      const toMouseY = mouseLocal.y - (oy + dy);
      const toMouseZ = mouseLocal.z - (oz + dz);
      const dist = Math.sqrt(toMouseX*toMouseX + toMouseY*toMouseY + toMouseZ*toMouseZ);
      if (dist < influenceRadius && dist > 0.001) {
        const falloff = Math.pow(1.0 - dist / influenceRadius, 2);
        // Only push particles when cursor is moving — no static force so they
        // never pile up or freeze when the cursor stops
        const velMag = Math.sqrt(mouseVelX * mouseVelX + mouseVelZ * mouseVelZ);
        if (velMag > 0.05) {
          const nx = norms[i3], ny = norms[i3+1], nz = norms[i3+2];
          const vx = mouseVelX / velMag, vz = mouseVelZ / velMag;
          let kx = vx, ky = 0, kz = vz;
          const kDotN = kx*nx + ky*ny + kz*nz;
          kx -= kDotN * nx; ky -= kDotN * ny; kz -= kDotN * nz;
          const velScale = Math.min(velMag / 3.5, 1.0) * 3.0 * falloff;
          fx += kx * velScale; fy += ky * velScale; fz += kz * velScale;
        }
      }
    }

    fx -= springK * dx; fy -= springK * dy; fz -= springK * dz;
    fx -= damping * velocity[i3]; fy -= damping * velocity[i3+1]; fz -= damping * velocity[i3+2];
    velocity[i3] += fx*dt; velocity[i3+1] += fy*dt; velocity[i3+2] += fz*dt;
    displacement[i3] += velocity[i3]*dt; displacement[i3+1] += velocity[i3+1]*dt; displacement[i3+2] += velocity[i3+2]*dt;

    const dispLen = Math.sqrt(
      displacement[i3]*displacement[i3] +
      displacement[i3+1]*displacement[i3+1] +
      displacement[i3+2]*displacement[i3+2]
    );
    if (dispLen > maxDisp) {
      const s = maxDisp / dispLen;
      displacement[i3] *= s; displacement[i3+1] *= s; displacement[i3+2] *= s;
      velocity[i3] *= 0.5; velocity[i3+1] *= 0.5; velocity[i3+2] *= 0.5;
    }

    const clamped = clampToBar(ox + displacement[i3], oy + displacement[i3+1], oz + displacement[i3+2]);
    displacement[i3] = clamped.x - ox;
    displacement[i3+1] = clamped.y - oy;
    displacement[i3+2] = clamped.z - oz;
  }

  if (!isMobile) {
    const dispAttr = geo.getAttribute('aDisplacement');
    for (let i = 0; i < PARTICLE_COUNT * 3; i++) dispAttr.array[i] = displacement[i];
    dispAttr.needsUpdate = true;
  }

  mat.uniforms.uTime.value = t;
  const introT = Math.min(t / 2.8, 1.0);
  mat.uniforms.uIntroT.value = introT;
  logoMat.uniforms.uTime.value = t;

  // Smooth scroll interpolation
  smoothScrollT += (scrollT - smoothScrollT) * 0.06;
  mat.uniforms.uScrollT.value = smoothScrollT;

  // Intro phase: crack particles assemble into logo; logo texture fades in at the very end
  const isIntroPhase = introT < 1.0;
  // ease the assembly so it feels organic (matches bar particle ease-out)
  const introEased = introT * introT * (3.0 - 2.0 * introT);
  const introCrackProgress = 1.0 - introEased;
  // Logo texture appears only in the final stretch of intro (80–100%) to crossfade over assembled particles
  const logoFadeIn  = Math.max(0, Math.min(1, (introT - 0.80) / 0.20));
  const logoFadeOut = 1 - Math.max(0, Math.min(1, (smoothScrollT - 0.02) / 0.18));
  logoMat.uniforms.uOpacity.value = logoFadeIn * logoFadeOut;
  logoMesh.visible = logoMat.uniforms.uOpacity.value > 0.001;

  // Crack: assembles during intro, disintegrates on scroll
  const crackProgress = Math.max(0, Math.min(1, (smoothScrollT - 0.02) / 0.60));
  if (crackSystem) {
    if (isIntroPhase) {
      crackSystem.visible = introCrackProgress > 0.01;
      crackSystem.material.uniforms.uCrackProgress.value = introCrackProgress;
    } else {
      crackSystem.visible = smoothScrollT > 0.02 && crackProgress < 1.0;
      crackSystem.material.uniforms.uCrackProgress.value = crackProgress;
    }
    crackSystem.material.uniforms.uTime.value = t;
  }
  mat.uniforms.uMouse.value.copy(mouse3D);
  mat.uniforms.uMouseActive.value = mouseActive ? 1 : 0;

  // Camera scroll animation — lerp toward keyframe target each frame
  const camState = getCamState(smoothScrollT);
  _targetCamPos.set(camState.p[0], camState.p[1], camState.p[2]);
  _targetLookAt.set(camState.l[0], camState.l[1], camState.l[2]);
  camera.position.lerp(_targetCamPos, 0.08);
  _currentLookAt.lerp(_targetLookAt, 0.08);
  camera.lookAt(_currentLookAt);

  // Parallax fades out as scroll begins so camera takes over
  const parallaxFade = Math.max(0, 1.0 - smoothScrollT / 0.25);
  const baseRotY = 8.5 * Math.PI / 180;
  const baseRotX = 133.6 * Math.PI / 180;
  barGroup.rotation.y += (baseRotY + targetRotY * 0.5 * parallaxFade - barGroup.rotation.y) * 0.025;
  barGroup.rotation.x += (baseRotX + targetRotX * 0.5 * parallaxFade - barGroup.rotation.x) * 0.025;

  drawRings(t, smoothScrollT);
  composer.render();
}
renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
  resizeOverlay();
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = camera.aspect < 1 ? Math.min(75, 40 / camera.aspect) : 40;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  mat.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
});
