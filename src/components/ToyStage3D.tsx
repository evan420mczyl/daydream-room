"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/**
 * 3D 玩偶屋 —— 「小方」玻璃机器人的交互式展台。
 *
 * 模型移植自用户提供的 Three.js 页面（upload/index.html）：
 * - 玩具本体：陶瓷圆角方块机身 + 深色玻璃面罩 + 发光星眼 + 紫金属侧旋钮
 *   + 天线粉色信号灯 + 双金属轨道环 + 七颗巡游彩色小方块；
 * - 真实光影：主平行光（2048 PCF 软阴影）+ 紫青双色轮廓光（缓慢游走）
 *   + 暖补光 + RoomEnvironment IBL + ShadowMaterial 接触影；
 * - 粒子效果：1400 颗星尘（球壳分布、加色混合）+ 260 颗近景尘埃；
 * - 自由视角：OrbitControls 拖拽旋转 / 滚轮缩放（阻尼 + 闲置 2.6s 自转），
 *   键盘方向键可微调（可聚焦）；
 * - 主题感知：监听 <html data-theme>，曝光 / 灯光 / 阴影 / 粒子混合
 *   随浅色 / 暗夜 / 玻璃三种风格切换。
 */

type ThemeKind = "light" | "dark" | "glass";

type StageParams = {
  exposure: number; // 曝光
  keyIntensity: number; // 主光
  purpleIntensity: number; // 紫轮廓光
  cyanIntensity: number; // 青轮廓光
  warmIntensity: number; // 暖补光
  shadowOpacity: number; // 接触影浓度
  particleOpacity: number;
  particleBlending: THREE.Blending;
  dustOpacity: number;
};

const STAGE_PRESETS: Record<ThemeKind, StageParams> = {
  light: {
    exposure: 1.02,
    keyIntensity: 2.45,
    purpleIntensity: 42,
    cyanIntensity: 26,
    warmIntensity: 15,
    shadowOpacity: 0.22,
    particleOpacity: 0.9,
    particleBlending: THREE.NormalBlending,
    dustOpacity: 0.22,
  },
  dark: {
    exposure: 1.12,
    keyIntensity: 3.1,
    purpleIntensity: 90,
    cyanIntensity: 65,
    warmIntensity: 26,
    shadowOpacity: 0.55,
    particleOpacity: 0.92,
    particleBlending: THREE.AdditiveBlending,
    dustOpacity: 0.55,
  },
  glass: {
    exposure: 1.07,
    keyIntensity: 2.85,
    purpleIntensity: 72,
    cyanIntensity: 50,
    warmIntensity: 20,
    shadowOpacity: 0.4,
    particleOpacity: 0.9,
    particleBlending: THREE.AdditiveBlending,
    dustOpacity: 0.45,
  },
};

/* 星尘配色：雾蓝 / 淡紫 / 青（浅色下作彩色微尘，暗夜/玻璃下加色发光） */
const C_A = new THREE.Color(0x9db8ff);
const C_B = new THREE.Color(0xc79dff);
const C_C = new THREE.Color(0x7df0ff);

const PARTICLE_COUNT = 1400;
const DUST_COUNT = 260;

/** 眼睛 / 天线的辉光贴图：中心亮 → 边缘透明的径向渐变 */
function makeGlowTexture(inner: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, inner + "1)");
    grd.addColorStop(0.35, inner + "0.45)");
    grd.addColorStop(1, inner + "0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 星尘贴图：白核 + 蓝晕 */
function makeParticleTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d");
  if (g) {
    const grd = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.28, "rgba(190,215,255,0.62)");
    grd.addColorStop(0.62, "rgba(130,170,255,0.18)");
    grd.addColorStop(1, "rgba(110,150,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 96, 96);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

type OrbSpec = {
  mesh: THREE.Mesh;
  radius: number;
  speed: number;
  phase: number;
  yOff: number;
};

/** 小方 —— 陶瓷 × 深色玻璃的小方块机器人（含轨道环与巡游小方块） */
function buildRobot() {
  const toy = new THREE.Group();

  /* ---------- 材质 ---------- */
  const matCeramic = new THREE.MeshPhysicalMaterial({
    color: 0xf4f7ff,
    metalness: 0.18,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.055,
    reflectivity: 1.0,
    envMapIntensity: 1.55,
  });

  const matDarkGlass = new THREE.MeshPhysicalMaterial({
    color: 0x0a0d17,
    metalness: 0.85,
    roughness: 0.055,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    envMapIntensity: 2.3,
  });

  const matEye = new THREE.MeshStandardMaterial({
    color: 0x0a1220,
    emissive: 0x7de3ff,
    emissiveIntensity: 2.4,
    roughness: 0.15,
    metalness: 0.05,
    toneMapped: false,
  });

  const matKnob = new THREE.MeshPhysicalMaterial({
    color: 0x8b7cff,
    metalness: 0.95,
    roughness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.8,
  });

  const matChrome = new THREE.MeshStandardMaterial({
    color: 0xdfe6ff,
    metalness: 1.0,
    roughness: 0.22,
    envMapIntensity: 1.8,
  });

  const matAntennaBall = new THREE.MeshStandardMaterial({
    color: 0x120818,
    emissive: 0xff6ad5,
    emissiveIntensity: 2.8,
    roughness: 0.25,
    toneMapped: false,
  });

  const matRing = new THREE.MeshPhysicalMaterial({
    color: 0x9aa8ff,
    metalness: 1.0,
    roughness: 0.16,
    emissive: 0x2a3dff,
    emissiveIntensity: 0.35,
    envMapIntensity: 2.0,
  });

  const matRingCyan = new THREE.MeshPhysicalMaterial({
    color: 0x5ee6ff,
    metalness: 0.9,
    roughness: 0.14,
    emissive: 0x1a9fbf,
    emissiveIntensity: 0.7,
    envMapIntensity: 2.0,
  });

  /* ---------- 机身：陶瓷圆角方块 ---------- */
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.8, 1.8, 1.8, 12, 0.58), matCeramic);
  body.castShadow = true;
  body.receiveShadow = true;
  toy.add(body);

  /* ---------- 面罩：深色玻璃 ---------- */
  const face = new THREE.Mesh(new RoundedBoxGeometry(1.24, 0.74, 0.3, 8, 0.24), matDarkGlass);
  face.position.set(0, 0.06, 0.76);
  face.castShadow = true;
  toy.add(face);

  /* ---------- 星眼（发光） ---------- */
  const eyeGeo = new THREE.SphereGeometry(0.105, 40, 40);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, matEye);
    eye.position.set(sx * 0.28, 0.06, 0.915);
    eye.scale.set(1, 1, 0.6);
    toy.add(eye);
  }

  /* 眼睛辉光（Sprite，加色混合） */
  const eyeGlows: THREE.Sprite[] = [];
  for (const sx of [-1, 1]) {
    const mat = new THREE.SpriteMaterial({
      map: makeGlowTexture("rgba(125,227,255,"),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.85,
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(0.62, 0.62, 1);
    sp.position.set(sx * 0.28, 0.06, 0.95);
    toy.add(sp);
    eyeGlows.push(sp);
  }

  /* ---------- 侧旋钮：紫金属球 ---------- */
  const knobGeo = new THREE.SphereGeometry(0.19, 36, 36);
  for (const sx of [-1, 1]) {
    const knob = new THREE.Mesh(knobGeo, matKnob);
    knob.position.set(sx * 0.905, -0.05, 0);
    knob.castShadow = true;
    toy.add(knob);
  }

  /* ---------- 天线：铬杆 + 粉色信号灯 ---------- */
  const antennaPole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 20), matChrome);
  antennaPole.position.set(0, 1.06, 0);
  antennaPole.castShadow = true;
  toy.add(antennaPole);

  const antennaBall = new THREE.Mesh(new THREE.SphereGeometry(0.112, 36, 36), matAntennaBall);
  antennaBall.position.set(0, 1.28, 0);
  toy.add(antennaBall);

  const antennaGlowMat = new THREE.SpriteMaterial({
    map: makeGlowTexture("rgba(255,106,213,"),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.8,
  });
  const antennaGlow = new THREE.Sprite(antennaGlowMat);
  antennaGlow.scale.set(0.9, 0.9, 1);
  antennaGlow.position.set(0, 1.28, 0);
  toy.add(antennaGlow);

  /* ---------- 环绕轨道环 ---------- */
  const ringGroup = new THREE.Group();
  ringGroup.rotation.set(1.28, 0.22, 0.42);
  toy.add(ringGroup);

  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.18, 0.028, 18, 240), matRing);
  ring1.castShadow = true;
  ringGroup.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.46, 0.016, 14, 220), matRingCyan);
  ring2.rotation.set(0.55, 0.9, 0.2);
  ringGroup.add(ring2);

  /* ---------- 七颗巡游彩色小方块 ---------- */
  const orbs: OrbSpec[] = [];
  const orbGeo = new RoundedBoxGeometry(0.13, 0.13, 0.13, 3, 0.045);
  for (let i = 0; i < 7; i++) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color().setHSL(0.58 + i * 0.045, 0.85, 0.72),
      metalness: 0.55,
      roughness: 0.2,
      clearcoat: 1,
      emissive: new THREE.Color().setHSL(0.6 + i * 0.04, 0.9, 0.35),
      emissiveIntensity: 0.6,
      envMapIntensity: 1.6,
    });
    const o = new THREE.Mesh(orbGeo, mat);
    o.castShadow = true;
    toy.add(o);
    orbs.push({
      mesh: o,
      radius: 2.55 + Math.random() * 0.7,
      speed: 0.28 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      yOff: (Math.random() - 0.5) * 1.6,
    });
  }

  return { toy, matEye, eyeGlows, matAntennaBall, antennaGlow, ringGroup, ring2, orbs };
}

export default function ToyStage3D({ className }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    mount.replaceChildren(); // 防 HMR / 重复挂载残留旧画布

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // WebGL 不可用：展台静默留白，页面其余部分不受影响
    }

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const canvas = renderer.domElement;
    canvas.style.touchAction = "none"; // 拖拽旋转优先于页面滚动

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);
    camera.position.set(1.6, 1.9, 8.6);

    /* ---- 环境光照（IBL）—— 玻璃与金属反射的来源 ---- */
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;
    scene.environment = envTex;

    /* ---- 灯光：主光 + 双色轮廓光 + 暖补光 ---- */
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
    keyLight.position.set(5.5, 8.5, 6.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 32;
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.bias = -0.0006;
    keyLight.shadow.normalBias = 0.022;
    keyLight.shadow.radius = 3;
    scene.add(keyLight);

    const rimPurple = new THREE.PointLight(0x8b5cf6, 90, 26, 2);
    rimPurple.position.set(-5.2, 2.6, -4.2);
    scene.add(rimPurple);

    const rimCyan = new THREE.PointLight(0x22d3ee, 65, 26, 2);
    rimCyan.position.set(5.0, -2.2, -3.4);
    scene.add(rimCyan);

    const warmFill = new THREE.PointLight(0xffd7a6, 26, 22, 2);
    warmFill.position.set(-3.4, -4.0, 5.0);
    scene.add(warmFill);

    /* ---- 阴影承接面 ---- */
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 34),
      new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.55 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.35;
    ground.receiveShadow = true;
    scene.add(ground);

    /* ---- 小方 ---- */
    const { toy, matEye, eyeGlows, matAntennaBall, antennaGlow, ringGroup, ring2, orbs } = buildRobot();
    scene.add(toy);

    /* ---- 星尘粒子（1400 颗，球壳分布） ---- */
    const particleTex = makeParticleTexture();
    const pPos = new Float32Array(PARTICLE_COUNT * 3);
    const pCol = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const r = 3.0 + Math.pow(Math.random(), 0.7) * 5.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pPos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      pPos[i * 3 + 1] = r * Math.cos(phi) * 0.55 + (Math.random() - 0.5) * 1.2;
      pPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const mix = Math.random();
      const col = mix < 0.45 ? C_A : mix < 0.82 ? C_B : C_C;
      const dim = 0.45 + Math.random() * 0.55;
      pCol[i * 3 + 0] = col.r * dim;
      pCol[i * 3 + 1] = col.g * dim;
      pCol[i * 3 + 2] = col.b * dim;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.075,
      map: particleTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    /* ---- 近景尘埃（更亮更少） ---- */
    const dPos = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      dPos[i * 3 + 0] = (Math.random() - 0.5) * 9;
      dPos[i * 3 + 1] = (Math.random() - 0.5) * 7;
      dPos[i * 3 + 2] = (Math.random() - 0.5) * 6 + 1;
    }
    const dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
    const dMat = new THREE.PointsMaterial({
      size: 0.045,
      map: particleTex,
      color: 0xbcd0ff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const dust = new THREE.Points(dGeo, dMat);
    scene.add(dust);

    /* ---- 主题感知 ---- */
    const applyTheme = (kind: ThemeKind) => {
      const p = STAGE_PRESETS[kind];
      renderer.toneMappingExposure = p.exposure;
      keyLight.intensity = p.keyIntensity;
      rimPurple.intensity = p.purpleIntensity;
      rimCyan.intensity = p.cyanIntensity;
      warmFill.intensity = p.warmIntensity;
      (ground.material as THREE.ShadowMaterial).opacity = p.shadowOpacity;
      pMat.opacity = p.particleOpacity;
      pMat.blending = p.particleBlending;
      pMat.needsUpdate = true;
      dMat.opacity = p.dustOpacity;
    };
    const currentTheme = (): ThemeKind => {
      const v = document.documentElement.getAttribute("data-theme");
      return v === "dark" || v === "glass" ? v : "light";
    };
    applyTheme(currentTheme());
    const themeObserver = new MutationObserver(() => applyTheme(currentTheme()));
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    /* ---- 控制器：拖拽旋转 / 滚轮缩放 / 阻尼 / 闲置自转 ---- */
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 0.08, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.enablePan = false;
    controls.minDistance = 4.6;
    controls.maxDistance = 12.5;
    controls.minPolarAngle = 0.32;
    controls.maxPolarAngle = Math.PI * 0.68;
    controls.rotateSpeed = 0.85;
    controls.zoomSpeed = 0.8;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotate = !reduced;
    controls.autoRotateSpeed = 0.75;

    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const pauseAuto = () => {
      controls.autoRotate = false;
      if (idleTimer) clearTimeout(idleTimer);
    };
    const resumeAutoSoon = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!reduced) controls.autoRotate = true;
      }, 2600);
    };
    controls.addEventListener("start", () => {
      pauseAuto();
      canvas.classList.add("is-grabbing");
    });
    controls.addEventListener("end", () => {
      canvas.classList.remove("is-grabbing");
      resumeAutoSoon();
    });

    /* 键盘微调（可聚焦时的方向键） */
    const orbitBy = (dTheta: number, dPhi: number) => {
      const off = camera.position.clone().sub(controls.target);
      const sph = new THREE.Spherical().setFromVector3(off);
      sph.theta += dTheta;
      sph.phi = THREE.MathUtils.clamp(sph.phi + dPhi, controls.minPolarAngle + 0.02, controls.maxPolarAngle - 0.02);
      sph.makeSafe();
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));
      pauseAuto();
      resumeAutoSoon();
    };
    const onKey = (e: KeyboardEvent) => {
      const step = 0.16;
      if (e.key === "ArrowLeft") orbitBy(-step, 0);
      else if (e.key === "ArrowRight") orbitBy(step, 0);
      else if (e.key === "ArrowUp") orbitBy(0, -step * 0.7);
      else if (e.key === "ArrowDown") orbitBy(0, step * 0.7);
      else return;
      e.preventDefault();
    };
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "小方的 3D 展台：拖动旋转，滚轮缩放，方向键微调");
    canvas.setAttribute("role", "img");
    canvas.addEventListener("keydown", onKey);

    /* ---- 尺寸与构图：窄屏自动拉远，保证轨道环不裁切 ---- */
    const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fitDistance = (aspect: number) =>
      Math.max(8.95, 3.55 / (halfTan * Math.min(aspect, 1.6)));
    const applyInitialFit = () => {
      const sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      sph.radius = fitDistance(camera.aspect);
      sph.phi = THREE.MathUtils.clamp(sph.phi, controls.minPolarAngle + 0.02, controls.maxPolarAngle - 0.02);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));
    };

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      controls.maxDistance = Math.max(12.5, fitDistance(camera.aspect) + 4);
    };
    resize();
    applyInitialFit();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    /* ---- 可见性：滚出视口就歇着 ---- */
    let inView = true;
    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[entries.length - 1]?.isIntersecting ?? true;
      },
      { threshold: 0.05 },
    );
    io.observe(mount);

    /* ---- 动画主循环 ---- */
    let t = 0;
    let raf = 0;
    const clock = new THREE.Clock();
    const bobAmp = reduced ? 0.02 : 0.085;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!inView) return; // 不可见：不推进时间也不渲染
      t += dt;

      /* 玩具漂浮 */
      toy.position.y = Math.sin(t * 1.05) * bobAmp;
      toy.rotation.y = Math.sin(t * 0.4) * 0.2;
      toy.rotation.z = Math.sin(t * 0.62) * (reduced ? 0.008 : 0.032);
      toy.rotation.x = Math.sin(t * 0.33) * 0.05;

      /* 呼吸灯：星眼 + 信号灯 */
      matEye.emissiveIntensity = 2.2 + Math.sin(t * 2.3) * 0.65;
      for (const g of eyeGlows) g.material.opacity = 0.62 + Math.sin(t * 2.3) * 0.22;
      matAntennaBall.emissiveIntensity = 2.4 + Math.sin(t * 1.7 + 1.2) * 1.0;
      antennaGlow.material.opacity = 0.55 + Math.sin(t * 1.7 + 1.2) * 0.3;

      /* 轨道环自转 */
      ringGroup.rotation.y = 0.22 + t * 0.3;
      ring2.rotation.z = 0.2 + t * 0.18;

      /* 巡游小方块 */
      for (const o of orbs) {
        const a = o.phase + t * o.speed;
        o.mesh.position.set(
          Math.cos(a) * o.radius,
          o.yOff + Math.sin(a * 1.6 + o.phase) * 0.35,
          Math.sin(a) * o.radius * 0.9,
        );
        o.mesh.rotation.x = a * 1.4;
        o.mesh.rotation.y = a * 1.1;
        o.mesh.rotation.z = a * 0.7;
      }

      /* 粒子 */
      particles.rotation.y = t * 0.026;
      particles.rotation.x = Math.sin(t * 0.12) * 0.05;
      dust.rotation.y = -t * 0.045;
      dust.position.y = Math.sin(t * 0.35) * 0.16;

      /* 轮廓光缓慢游走 */
      rimPurple.position.x = -5.2 + Math.sin(t * 0.42) * 1.4;
      rimCyan.position.x = 5.0 + Math.cos(t * 0.36) * 1.4;

      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      if (idleTimer) clearTimeout(idleTimer);
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      canvas.removeEventListener("keydown", onKey);
      controls.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Sprite) {
          const m = obj.material as THREE.SpriteMaterial;
          m.map?.dispose();
          m.dispose();
          return; // Sprite 的 geometry 是模块级共享对象，不可销毁
        }
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry?.dispose();
          const m = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[];
          (Array.isArray(m) ? m : [m]).forEach((mm) => {
            const map = (mm as THREE.MeshStandardMaterial).map;
            map?.dispose();
            mm.dispose();
          });
        }
      });
      particleTex.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (canvas.parentElement === mount) mount.removeChild(canvas);
    };
  }, []);

  return <div ref={mountRef} className={className} />;
}
