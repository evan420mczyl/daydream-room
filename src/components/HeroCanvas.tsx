"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/**
 * Hero 的 Three.js 装饰层 —— 单画布，在文字之上（z3）。
 *
 * 层次感不靠拆图层，靠构图：
 * - 前景：芥末球、珊瑚小球被特意安排在「白日」「陈」的笔画上，
 *   遮挡关系让它们自然成为"镜头前"的东西；
 * - 中远景：其余物体连同视差行程都避开了文字区域，
 *   永不与字相交，视觉上自然退到字的后面；
 * - 纵深由 z 轴深度差 + 遮挡 + 地面软影共同完成。
 *
 * 防裁切：相机距离按画布尺寸反推，可视区世界半宽恒定，
 * 外圈缓冲带（inset -18%）永远为空；物体最大行程 < 缓冲。
 */

const BUFFER = 1.36; // 与 CSS inset:-18% 对应：画布 = 可视区 × 1.36
const VISIBLE_HALF_W = 9.0; // 可视区世界半宽：布局 8.1 + 运动余量

type ObjDef = {
  geo: () => THREE.BufferGeometry;
  color: number;
  pos: [number, number, number];
  scale?: number;
  /** 漂浮物不投地影：飘着的东西没有地影才合理，也不会拖出灰斑 */
  noShadow?: boolean;
  /** 镜面级光滑：文字环境反射在它表面才是可读的（哑光上只会糊成一片） */
  glossy?: boolean;
};

const OBJECTS: ObjDef[] = [
  // —— 文字区点缀：倚在「梦」右肩的镜面小球，映得出标题笔画 ——
  { geo: () => new THREE.SphereGeometry(1.05, 64, 48), color: 0xffb020, pos: [-1.4, 2.6, 1.3], scale: 0.75, noShadow: true, glossy: true },
  // —— 右侧静物组团：前低后高、相互遮掩的金字塔 ——
  // 前排
  { geo: () => new THREE.CapsuleGeometry(0.58, 1.25, 12, 32), color: 0x1fce8f, pos: [3.6, -1.5, 0.9], scale: 0.95 },
  { geo: () => new THREE.SphereGeometry(0.55, 48, 32), color: 0xff4d38, pos: [4.5, -2.9, 1.3], scale: 0.62, noShadow: true },
  { geo: () => new RoundedBoxGeometry(1.7, 1.7, 1.7, 6, 0.34), color: 0x3d4fe0, pos: [6.1, -1.8, 0.2], scale: 0.95 },
  // 中坚
  { geo: () => new THREE.TorusKnotGeometry(0.95, 0.34, 220, 36), color: 0xff4d38, pos: [4.9, 1.4, -0.6], scale: 0.85 },
  // 高音：小而远，悬在组团上方
  { geo: () => new THREE.TorusGeometry(0.62, 0.24, 24, 64), color: 0x8b5cf6, pos: [5.6, 3.2, -2.0], scale: 0.75 },
];

// 视差行程（tanh 软钳制后仍然成立：|位移|+|旋转效应| ≈ 1.0 < 缓冲）
const P = { x: 0.7, y: 0.45, ry: 0.1, rx: 0.06 };

export default function HeroCanvas({ className }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    mount.replaceChildren(); // 防御 HMR / 重复挂载残留的旧画布

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 0.4, 13);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // 环境反射先做一点点暗部填充，保住固有色
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    // 页面色彩场环境：把「这个页面的颜色构成」画进等距柱状贴图——
    // 纸底、标题的墨团、五色静物的色点。物体映出的不是文字，
    // 而是这个页面本身，像它们真的坐在陈列室里。
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let textEnvTex: THREE.Texture | null = null;
    let cancelled = false;
    const buildEnv = () => {
      if (cancelled) return;
      const c = document.createElement("canvas");
      c.width = 2048;
      c.height = 1024;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#f5f0e7";
      ctx.fillRect(0, 0, 2048, 1024);

      const paintGroup = (ox: number) => {
        // 标题墨色块（左上，软边）
        ctx.save();
        ctx.filter = "blur(30px)";
        ctx.fillStyle = "rgba(34, 29, 22, 0.92)";
        ctx.beginPath();
        ctx.roundRect(ox + 90, 330, 560, 330, 64);
        ctx.fill();
        ctx.restore();
        // 五色静物色点（右侧簇群，柔和）
        const spots: [string, number, number, number][] = [
          ["#FF6A55", ox + 760, 400, 74],  // 珊瑚
          ["#F0B23E", ox + 860, 520, 56],  // 芥末
          ["#4C5BD6", ox + 900, 660, 88],  // 靛蓝
          ["#47C49A", ox + 740, 640, 60],  // 薄荷
          ["#9B7EDE", ox + 690, 300, 44],  // 雾紫
        ];
        ctx.save();
        ctx.filter = "blur(22px)";
        for (const [color, x, y, r] of spots) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      };
      paintGroup(0);
      paintGroup(1024); // 环绕一圈，背面也有内容

      const tex = new THREE.CanvasTexture(c);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      textEnvTex = pmrem.fromEquirectangular(tex).texture;
      tex.dispose();
      envTex.dispose();
      scene.environment = textEnvTex;
      if (reduced) renderer.render(scene, camera);
    };
    if (document.fonts?.ready) document.fonts.ready.then(buildEnv);
    else buildEnv();

    // 真实光影：主光足够强，高光处真的亮；偏顶光，影子短而集中
    const key = new THREE.DirectionalLight(0xfff6ea, 2.3);
    key.position.set(4, 10, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    key.shadow.camera.far = 40;
    key.shadow.bias = -0.002;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdfeaff, 0.6);
    fill.position.set(-6, -2, -4);
    scene.add(fill);

    // 隐形地面，只接影子——让物体"落地"
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.ShadowMaterial({ opacity: 0.1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -4.1;
    ground.receiveShadow = true;
    scene.add(ground);

    const group = new THREE.Group();
    scene.add(group);

    // 缎面质感：五色环境色点会在表面留下可见的色彩倾向；
    // glossy 的是气球级镜面
    const toy = (color: number, glossy = false) =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: glossy ? 0.13 : 0.26,
        metalness: 0,
        clearcoat: glossy ? 1.0 : 0.55,
        clearcoatRoughness: glossy ? 0.08 : 0.3,
        specularIntensity: 0.55,
        envMapIntensity: glossy ? 1.0 : 0.7,
      });

    type Floater = { mesh: THREE.Mesh; speed: number; phase: number };
    const floaters: Floater[] = [];
    for (const def of OBJECTS) {
      const mesh = new THREE.Mesh(def.geo(), toy(def.color, def.glossy));
      mesh.position.set(...def.pos);
      mesh.scale.setScalar(def.scale ?? 1);
      mesh.castShadow = !def.noShadow;
      mesh.userData.y0 = def.pos[1];
      group.add(mesh);
      floaters.push({ mesh, speed: 0.3 + Math.random() * 0.4, phase: Math.random() * Math.PI * 2 });
    }

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.position.z =
        (VISIBLE_HALF_W * BUFFER) /
        Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) /
        camera.aspect;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let targetX = 0;
    let targetY = 0;
    const onPointer = (e: PointerEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onPointer);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      const t = clock.getElapsedTime();
      for (const { mesh, speed, phase } of floaters) {
        mesh.rotation.x = t * speed * 0.45 + phase;
        mesh.rotation.y = t * speed * 0.65 + phase;
        mesh.position.y = mesh.userData.y0 + Math.sin(t * speed + phase) * 0.32;
      }
      // tanh 软钳制：接近边缘平滑减速
      const px = Math.tanh(targetX * 1.2) * P.x;
      const py = Math.tanh(targetY * 1.2) * P.y;
      group.position.x += (px - group.position.x) * 0.045;
      group.position.y += (-py - group.position.y) * 0.045;
      group.rotation.y += (targetX * P.ry - group.rotation.y) * 0.045;
      group.rotation.x += (targetY * P.rx - group.rotation.x) * 0.045;
      renderer.render(scene, camera);
      if (!reduced) raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const m = obj.material as THREE.Material | THREE.Material[];
          (Array.isArray(m) ? m : [m]).forEach((mm) => mm.dispose());
        }
      });
      envTex.dispose();
      textEnvTex?.dispose();
      pmrem.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
