/**
 * heroScene.ts — 3D-сцена первого экрана.
 *
 * Не зависит от фреймворка: принимает <canvas> и возвращает ручку с dispose().
 * Работает одинаково в Next.js, Vite, Astro и в чистом HTML.
 *
 *   const scene = createHeroScene({
 *     canvas,
 *     modelUrl: '/models/dragon.glb',
 *     onReady: () => setLoaded(true),
 *   });
 *   // при размонтировании:
 *   scene.dispose();
 *
 * Требуется three >= 0.160 (в 0.152 renderer.outputEncoding заменили на
 * outputColorSpace — если у вас версия старше, см. комментарий в setupRenderer).
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/* ──────────────────────────── токены сцены ────────────────────────────
 * Единственное место, где живут цвета и интенсивности. Правится дизайнером
 * без захода в логику. Палитра монохромно-тёплая: холодных тонов нет вовсе —
 * именно это отличает референс от текущей версии сайта.
 */

export const TOKENS = {
  gold: 0xffcf7e,
  goldRoughness: 0.22,
  goldEnvIntensity: 0.85,

  ringEmissive: 0xffe9c2,
  /** Множитель > 1 выводит кольца за порог bloom — они начинают реально светить. */
  ringPunch: 1.15,

  eyeEmissive: 0xff5a3c,
  eyePunch: 1.8,

  stone: 0x1a1410,
  stoneRoughness: 0.62,

  keyLight: 0xfff2dd,
  rimWarm: 0xffb877,
  rimPale: 0xffe4c4,

  debrisNear: 0x6b5a48,
  debrisMid: 0x8a7660,
  debrisFar: 0xb0a08a,
} as const;

export interface HeroSceneOptions {
  canvas: HTMLCanvasElement;
  /** Путь к .glb с драконом. Если не задан — рисуется заглушка-торнус. */
  modelUrl?: string;
  /** Имена мешей глаз в модели — им назначается светящийся материал. */
  eyeMeshNames?: string[];
  onProgress?: (fraction: number) => void;
  onReady?: () => void;
  onError?: (error: unknown) => void;
}

export interface HeroSceneHandle {
  dispose: () => void;
  /** Пауза рендера — например, когда хиро уехал за пределы вьюпорта. */
  setPaused: (paused: boolean) => void;
}

/* ─────────────────────────── карта окружения ───────────────────────────
 * Металл состоит из отражений: без environment map золото физически не может
 * выглядеть золотом. Здесь карта генерируется процедурно из canvas — это
 * ноль килобайт в бандле и мгновенный старт. Когда дойдут руки, замените на
 * настоящий .hdr через RGBELoader: качество отражений заметно вырастет.
 */

function buildEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const sky = ctx.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, '#3a2f24');
  sky.addColorStop(0.44, '#140f0b');
  sky.addColorStop(1, '#070505');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 512, 256);

  // Софтбоксы. Размытие делает блики протяжёнными, а не точечными —
  // без него золото получает жёсткие «звёздочки» и выглядит дёшево.
  ctx.filter = 'blur(26px)';
  ctx.fillStyle = '#ffd9a8';
  ctx.fillRect(44, 22, 138, 78);
  ctx.fillStyle = '#ffeed6';
  ctx.fillRect(326, 40, 100, 60);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(226, 4, 56, 28);
  ctx.filter = 'none';

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromEquirectangular(texture).texture;

  texture.dispose();
  pmrem.dispose();
  return env;
}

/* ───────────────────────────── обломки ─────────────────────────────
 * Три слоя вместо одного. Глубина строится градацией, а не количеством:
 *
 *   near — крупные, мягкие спрайты с заранее размытой текстурой.
 *          Это боке без DOF-пасса: то же ощущение, ноль стоимости на GPU.
 *   mid  — настоящие камни, InstancedMesh, один draw call.
 *   far  — мелкие резкие точки, дают ощущение бесконечности.
 *
 * У слоёв разная амплитуда параллакса — именно она читается как пространство.
 */

interface DebrisLayer {
  object: THREE.Object3D;
  parallax: number;
  drift: number;
}

function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function softSprite(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,238,214,0.55)');
  g.addColorStop(0.45, 'rgba(200,178,150,0.22)');
  g.addColorStop(1, 'rgba(160,140,115,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildDebris(env: THREE.Texture, disposables: Disposable[]): DebrisLayer[] {
  const layers: DebrisLayer[] = [];

  // near — мягкое боке
  const nearTex = softSprite();
  const nearMat = new THREE.SpriteMaterial({
    map: nearTex,
    color: TOKENS.debrisNear,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  disposables.push(nearTex, nearMat);
  const near = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(nearMat);
    s.position.set(
      (hash01('nx' + i) - 0.5) * 16,
      (hash01('ny' + i) - 0.5) * 9,
      3 + hash01('nz' + i) * 2.5,
    );
    s.scale.setScalar(0.7 + hash01('ns' + i) * 1.4);
    near.add(s);
  }
  layers.push({ object: near, parallax: 1.15, drift: 0.09 });

  // mid — реальные камни одним draw call
  const rockGeo = new THREE.IcosahedronGeometry(0.15, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: TOKENS.debrisMid,
    roughness: 0.85,
    metalness: 0.05,
    envMap: env,
    envMapIntensity: 0.4,
  });
  disposables.push(rockGeo, rockMat);
  const COUNT = 46;
  const mid = new THREE.InstancedMesh(rockGeo, rockMat, COUNT);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  for (let i = 0; i < COUNT; i++) {
    pos.set(
      (hash01('mx' + i) - 0.5) * 22,
      (hash01('my' + i) - 0.5) * 12,
      (hash01('mz' + i) - 0.5) * 10 - 2,
    );
    e.set(hash01('ra' + i) * 6.28, hash01('rb' + i) * 6.28, hash01('rc' + i) * 6.28);
    q.setFromEuler(e);
    const s = 0.5 + hash01('ms' + i) * 1.3;
    scl.set(s, s * (0.7 + hash01('my2' + i) * 0.6), s);
    m.compose(pos, q, scl);
    mid.setMatrixAt(i, m);
  }
  mid.instanceMatrix.needsUpdate = true;
  layers.push({ object: mid, parallax: 0.5, drift: 0.045 });

  // far — мелкая резкая пыль
  const farPos = new Float32Array(260 * 3);
  for (let i = 0; i < 260; i++) {
    farPos[i * 3] = (hash01('fx' + i) - 0.5) * 40;
    farPos[i * 3 + 1] = (hash01('fy' + i) - 0.5) * 22;
    farPos[i * 3 + 2] = (hash01('fz' + i) - 0.5) * 14 - 12;
  }
  const farGeo = new THREE.BufferGeometry();
  farGeo.setAttribute('position', new THREE.BufferAttribute(farPos, 3));
  const farMat = new THREE.PointsMaterial({
    size: 0.045,
    color: TOKENS.debrisFar,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  disposables.push(farGeo, farMat);
  layers.push({ object: new THREE.Points(farGeo, farMat), parallax: 0.16, drift: 0.02 });

  return layers;
}

/* ───────────────────────────── кольца ─────────────────────────────
 * Кольца — светящаяся подпись сцены, а не рамка. Поэтому они крупнее
 * дракона и выходят за кадр: обрезка читается как продолжение только
 * тогда, когда объект явно больше вьюпорта.
 *
 * MeshBasicMaterial с цветом > 1 в линейном пространстве перешагивает
 * порог UnrealBloomPass — так кольца начинают светить, а не просто быть белыми.
 */

function buildRings(disposables: Disposable[]): THREE.Group {
  const group = new THREE.Group();
  const color = new THREE.Color(TOKENS.ringEmissive).multiplyScalar(TOKENS.ringPunch);

  const specs = [
    { radius: 4.6, tube: 0.028, y: 2.6, tilt: -0.12, roll: 0.06 },
    { radius: 3.4, tube: 0.026, y: -1.9, tilt: 0.09, roll: -0.04 },
  ];

  for (const spec of specs) {
    const geo = new THREE.TorusGeometry(spec.radius, spec.tube, 12, 220);
    const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    disposables.push(geo, mat);
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = Math.PI / 2 + spec.tilt;
    ring.rotation.z = spec.roll;
    ring.position.y = spec.y;
    group.add(ring);
  }
  return group;
}

/* ────────────────────────────── сцена ────────────────────────────── */

interface Disposable {
  dispose: () => void;
}

export function createHeroScene(options: HeroSceneOptions): HeroSceneHandle {
  const { canvas, modelUrl, eyeMeshNames = ['eye', 'eyes', 'Eye', 'Eyes'] } = options;
  const disposables: Disposable[] = [];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* renderer.
   * alpha: true — фон рисует CSS-градиент под канвасом. Так тёплое свечение
   * за фигурой правится в стилях без пересборки шейдера, и оно бесплатное. */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  // three < 0.152: renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  camera.position.set(0, 0.6, 9);
  camera.lookAt(0, 0.1, 0);

  const env = buildEnvironment(renderer);
  scene.environment = env;

  /* Свет. Ключевой — мягкий и тёплый; вся выразительность в двух краевых.
   * На тёмном фоне силуэт без rim light растворяется: контур рогов, шипов
   * и хвоста существует только благодаря им. */
  scene.add(new THREE.AmbientLight(0xffffff, 0.30));

  const key = new THREE.DirectionalLight(TOKENS.keyLight, 1.7);
  key.position.set(2.6, 3.6, 4.2);
  scene.add(key);

  const rimWarm = new THREE.DirectionalLight(TOKENS.rimWarm, 1.0);
  rimWarm.position.set(-4.4, 1.8, -3.6);
  scene.add(rimWarm);

  const rimPale = new THREE.DirectionalLight(TOKENS.rimPale, 0.6);
  rimPale.position.set(4.6, 2.4, -4.0);
  scene.add(rimPale);

  const stage = new THREE.Group();
  scene.add(stage);

  const rings = buildRings(disposables);
  stage.add(rings);

  const debris = buildDebris(env, disposables);
  for (const layer of debris) scene.add(layer.object);

  /* Материалы. Золото: metalness строго 1 — у металла нет диффузной
   * компоненты. Глаза светятся и выходят за порог bloom: это дешёвая
   * фирменная деталь, которая читается даже в фавиконе. */
  const goldMaterial = new THREE.MeshStandardMaterial({
    color: TOKENS.gold,
    metalness: 1,
    roughness: TOKENS.goldRoughness,
    envMapIntensity: TOKENS.goldEnvIntensity,
  });
  const eyeMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(TOKENS.eyeEmissive).multiplyScalar(TOKENS.eyePunch),
    toneMapped: false,
  });
  disposables.push(goldMaterial, eyeMaterial);

  let subject: THREE.Object3D | null = null;

  function placeholder(): THREE.Object3D {
    const geo = new THREE.TorusKnotGeometry(1.1, 0.34, 200, 28, 2, 3);
    disposables.push(geo);
    return new THREE.Mesh(geo, goldMaterial);
  }

  if (modelUrl) {
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        subject = gltf.scene;
        subject.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          const isEye = eyeMeshNames.some((n) => child.name.includes(n));
          child.material = isEye ? eyeMaterial : goldMaterial;
        });
        // Модель нормализуется по высоте: композиция не должна зависеть
        // от того, в каком масштабе её экспортировали из блендера.
        const box = new THREE.Box3().setFromObject(subject);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = 3.2 / (size.y || 1);
        subject.scale.setScalar(scale);
        box.setFromObject(subject);
        const center = new THREE.Vector3();
        box.getCenter(center);
        subject.position.sub(center);
        stage.add(subject);
        options.onReady?.();
      },
      (event) => {
        if (event.total > 0) options.onProgress?.(event.loaded / event.total);
      },
      (error) => {
        options.onError?.(error);
        subject = placeholder();
        stage.add(subject);
        options.onReady?.();
      },
    );
  } else {
    subject = placeholder();
    stage.add(subject);
    options.onReady?.();
  }

  /* Постобработка. Bloom здесь не украшение: без него кольца и глаза
   * остаются просто светлыми пикселями, а не источниками света.
   * OutputPass обязателен в three >= 0.152 — иначе composer съедает
   * tone mapping и цвета уезжают. */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // strength / radius / threshold. Порог 0.82 пропускал в свечение всю
  // золотую поверхность, а не только кольца и глаза — отсюда белое пятно
  // вместо фигуры. Свет выше тоже пришлось убрать: он был рассчитан на
  // модель освещения three < 0.155, где те же числа светили втрое слабее.
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.34, 0.5, 0.95);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* Размер. ResizeObserver вместо window.onresize: хиро может менять
   * ширину при открытии сайдбара, а окно при этом не ресайзится. */
  function resize(): void {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
    camera.aspect = w / h;
    // Отводим камеру непрерывно по пропорциям кадра: пара фиксированных
    // значений оставляла фигуру обрезанной на всём промежутке между ними.
    const aspect = w / h;
    const fit = Math.min(1.95, Math.max(1, 1.62 / aspect));
    camera.position.z = 9 * fit;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  /* Указатель. Целевые значения, к которым идём с затуханием: резкая
   * привязка к курсору выглядит нервно, инерция — дорого. */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  function onPointerMove(e: PointerEvent): void {
    const r = canvas.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  let paused = false;
  let visible = !document.hidden;
  function onVisibility(): void {
    visible = !document.hidden;
  }
  document.addEventListener('visibilitychange', onVisibility);

  const clock = new THREE.Clock();
  let raf = 0;

  function frame(): void {
    raf = requestAnimationFrame(frame);
    if (paused || !visible) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    if (!reduceMotion) {
      if (subject) subject.rotation.y += dt * 0.16;
      rings.children[0].rotation.z += dt * 0.05;
      rings.children[1].rotation.z -= dt * 0.038;
      stage.position.y = Math.sin(t * 0.5) * 0.06;

      for (const layer of debris) {
        layer.object.rotation.y += dt * layer.drift * 0.3;
        layer.object.position.y = Math.sin(t * layer.drift) * 0.35;
      }
    }

    // Параллакс идёт всегда: это отклик на действие пользователя,
    // а не самопроизвольная анимация, поэтому reduced-motion его не трогает.
    for (const layer of debris) {
      layer.object.position.x = -pointer.x * layer.parallax;
    }
    stage.rotation.y = pointer.x * 0.12;
    stage.rotation.x = pointer.y * 0.05;

    composer.render();
  }
  frame();

  return {
    setPaused(next: boolean) {
      paused = next;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const d of disposables) d.dispose();
      env.dispose();
      composer.dispose();
      renderer.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry?.dispose?.();
        }
      });
    },
  };
}
