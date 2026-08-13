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
  goldEnvIntensity: 0.55,

  ringEmissive: 0xffe9c2,
  /** Множитель > 1 выводит кольца за порог bloom — они начинают реально светить. */
  ringPunch: 0.8,

  eyeEmissive: 0xff5a3c,
  eyePunch: 1.3,

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

interface BookInstance {
  pos: THREE.Vector3;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  scale: THREE.Vector3;
  phase: number;
  bob: number;
}

interface DebrisLayer {
  object: THREE.Object3D;
  parallax: number;
  drift: number;
  books?: { mesh: THREE.InstancedMesh; items: BookInstance[] };
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

  // mid — парящие книги вместо камней, всё так же одним draw call
  const rockGeo = new THREE.BoxGeometry(0.30, 0.40, 0.075);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x191a24,
    roughness: 0.62,
    metalness: 0.15,
    envMap: env,
    envMapIntensity: 0.55,
  });
  disposables.push(rockGeo, rockMat);
  const COUNT = 26;
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
    const s = 0.7 + hash01('ms' + i) * 0.9;
    scl.set(s, s * (0.85 + hash01('my2' + i) * 0.35), s);
    m.compose(pos, q, scl);
    mid.setMatrixAt(i, m);
  }
  mid.instanceMatrix.needsUpdate = true;

  /* Вся пачка вращалась одной группой — книги висели друг относительно
   * друга неподвижно, и слой читался как нарисованный. Даём каждой свою
   * ось, скорость и фазу покачивания. */
  const items: BookInstance[] = [];
  for (let i = 0; i < COUNT; i++) {
    const mm = new THREE.Matrix4();
    mid.getMatrixAt(i, mm);
    const ip = new THREE.Vector3(), iq = new THREE.Quaternion(), is = new THREE.Vector3();
    mm.decompose(ip, iq, is);
    items.push({
      pos: ip.clone(),
      rot: new THREE.Euler().setFromQuaternion(iq),
      spin: new THREE.Vector3(
        (hash01('sa' + i) - 0.5) * 0.42,
        (hash01('sb' + i) - 0.5) * 0.55,
        (hash01('sc' + i) - 0.5) * 0.30,
      ),
      scale: is.clone(),
      phase: hash01('ph' + i) * 6.283,
      bob: 0.10 + hash01('bb' + i) * 0.26,
    });
  }
  layers.push({ object: mid, parallax: 0.5, drift: 0.045, books: { mesh: mid, items } });

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

/* Подбирать свет вслепую через пуш и деплой — дорого. Значения читаются из
 * адресной строки, так что их можно крутить прямо в браузере:
 *   ?bloom=0.15&threshold=1.0&exposure=0.7&key=1.2&rim=0.4
 * Подобрали — сообщите числа, я пропишу их значениями по умолчанию. */
function tuned(name: string, fallback: number): number {
  if (typeof location === 'undefined') return fallback;
  const raw = new URLSearchParams(location.search).get(name);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const TUNE = {
  bloom: tuned('bloom', 0.16),
  bloomRadius: tuned('radius', 0.45),
  threshold: tuned('threshold', 1.0),
  exposure: tuned('exposure', 0.7),
  key: tuned('key', 1.3),
  rimWarm: tuned('rim', 0.55),
  rimPale: tuned('rim2', 0.32),
};

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
  renderer.toneMappingExposure = TUNE.exposure;
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
  scene.add(new THREE.AmbientLight(0xffffff, 0.34));

  const key = new THREE.DirectionalLight(TOKENS.keyLight, TUNE.key);
  key.position.set(2.6, 3.6, 4.2);
  scene.add(key);

  const rimWarm = new THREE.DirectionalLight(TOKENS.rimWarm, TUNE.rimWarm);
  rimWarm.position.set(-4.4, 1.8, -3.6);
  scene.add(rimWarm);

  const rimPale = new THREE.DirectionalLight(TOKENS.rimPale, TUNE.rimPale);
  rimPale.position.set(4.6, 2.4, -4.0);
  scene.add(rimPale);

  const stage = new THREE.Group();
  scene.add(stage);

  // Кольца и дуги убраны: на фоне библиотеки они перечёркивали фигуру.
  const rings = buildRings(disposables);

  /* Ещё несколько тонких золотых дуг под разными наклонами: в референсе
   * именно они превращают две окружности в закрученное пространство.
   * Держим их бледными — иначе кадр превращается в моток проволоки. */


  /* Фон. Два CSS-градиента под канвасом дают тепло, но не дают глубины:
   * позади фигуры буквально ничего нет. Две сферы точек — дальние холодные
   * и ближние тёплые — стоят почти ноль и превращают плоскую подложку в
   * пространство. */
  function buildStarField(count: number, radius: number, size: number,
                          color: number, opacity: number): THREE.Points {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = radius * (0.75 + Math.random() * 0.25);
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
      pos[i * 3 + 1] = Math.cos(ph) * r * 0.62;
      pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color, size, transparent: true, opacity,
      depthWrite: false, sizeAttenuation: true,
      blending: THREE.AdditiveBlending, toneMapped: false,
    });
    disposables.push(geo, mat);
    return new THREE.Points(geo, mat);
  }

  const starsFar = buildStarField(1500, 46, 0.075, 0xc8d4e6, 0.5);
  const starsNear = buildStarField(280, 22, 0.13, 0xffe0b0, 0.38);
  scene.add(starsFar, starsNear);

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
        /* Материалы модели сохраняются как есть: у этой фигуры своя
         * раскраска — светлый камень, тёмная книга, синие руны и глаза.
         * Раньше здесь всё перекрашивалось в золото, и текстура пропадала.
         * Правим только силу отражений, чтобы вписать в окружение сцены. */
        subject.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const m of mats) {
            if (m instanceof THREE.MeshStandardMaterial) {
              m.envMapIntensity = TOKENS.goldEnvIntensity;
              m.needsUpdate = true;
            }
          }
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

        /* В этой модели всё — один меш, отдельных мешей глаз нет, поэтому
         * поиск по именам ничего не находит и глаза не появляются. Ставим
         * их вручную: координаты посчитаны по геометрии — голова со стороны
         * Z-max, глаза на 62% высоты головы. Значения в единицах модели,
         * поэтому вкладываем внутрь subject: масштаб применится сам. */
        /* Исток заклинания — раскрытая книга в руках. Координаты посчитаны
         * по геометрии: передняя кромка массы в средней трети роста. */
        spellOrigin.set(0, 1.093, 0.592);
        subject.add(spellAnchor);
        spellAnchor.position.copy(spellOrigin);
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
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    TUNE.bloom,
    TUNE.bloomRadius,
    TUNE.threshold,
  );
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

  /* Вращение. Фигура качается в пределах ±45°, то есть всего 90°, и
   * никогда не показывает спину. Перетаскивание добавляет свой угол
   * поверх, с инерцией и медленным возвратом; сумма тоже ограничена. */
  const SWEEP = Math.PI / 4;
  let dragRot = 0, dragVel = 0, lastX = 0;
  let dragging = false;
  const clampRot = (v: number) => Math.max(-SWEEP, Math.min(SWEEP, v));

  let downX = 0, downY = 0;
  canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    dragging = true;
    downX = e.clientX; downY = e.clientY;
    lastX = e.clientX;
    dragVel = 0;
    canvas.classList.add('is-dragging');
    canvas.setPointerCapture?.(e.pointerId);
  });
  function endDrag(e?: PointerEvent): void {
    dragging = false;
    canvas.classList.remove('is-dragging');
    // Клик, который никуда не уехал, — это клик, а не поворот.
    if (e && Math.abs(e.clientX - downX) < 6 && Math.abs(e.clientY - downY) < 6) cast();
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointermove', (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    dragVel = dx * 0.006;
    const want = dragRot + dragVel;
    dragRot = clampRot(want);
    if (dragRot !== want) dragVel = 0;
  });

  /* Указатель. Целевые значения, к которым идём с затуханием: резкая
   * привязка к курсору выглядит нервно, инерция — дорого. */
  let paused = false;
  let visible = !document.hidden;
  function onVisibility(): void {
    visible = !document.hidden;
  }
  document.addEventListener('visibilitychange', onVisibility);

  /* ─────────────────────────── заклинание ───────────────────────────
   * Пул частиц, поднимающихся из книги по спирали. toneMapped: false и
   * яркость выше единицы — единственный способ попасть в bloom при пороге
   * 1.0, иначе искры остаются просто светлыми точками. */
  const SPELL_N = 320;
  const spellPos = new Float32Array(SPELL_N * 3);
  const spellCol = new Float32Array(SPELL_N * 3);
  for (let i = 0; i < SPELL_N; i++) spellPos[i * 3 + 1] = -999;
  const spellGeo = new THREE.BufferGeometry();
  spellGeo.setAttribute('position', new THREE.BufferAttribute(spellPos, 3));
  spellGeo.setAttribute('color', new THREE.BufferAttribute(spellCol, 3));
  const spellMat = new THREE.PointsMaterial({
    size: 0.055, vertexColors: true, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
    sizeAttenuation: true, toneMapped: false,
  });
  disposables.push(spellGeo, spellMat);
  const spell = new THREE.Points(spellGeo, spellMat);
  spell.frustumCulled = false;
  stage.add(spell);

  // Светящийся разряд: геометрия обновляется при каждом заклинании, поэтому
  // молния выглядит как живая вспышка, а не как постоянная декоративная линия.
  const BOLT_SEGMENTS = 18;
  const boltPos = new Float32Array(BOLT_SEGMENTS * 2 * 3);
  const boltGeo = new THREE.BufferGeometry();
  boltGeo.setAttribute('position', new THREE.BufferAttribute(boltPos, 3));
  const boltMat = new THREE.LineBasicMaterial({
    color: 0xf3fcff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const bolt = new THREE.LineSegments(boltGeo, boltMat);
  bolt.frustumCulled = false;
  stage.add(bolt);
  const boltGlowMat = new THREE.LineBasicMaterial({
    color: 0x55bfff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const boltGlow = new THREE.LineSegments(boltGeo, boltGlowMat);
  boltGlow.frustumCulled = false;
  boltGlow.scale.setScalar(1.035);
  stage.add(boltGlow);
  disposables.push(boltGeo, boltMat, boltGlowMat);

  const spellAnchor = new THREE.Object3D();
  const spellOrigin = new THREE.Vector3(0, 1.1, 0.6);
  const spellLight = new THREE.PointLight(0xd8f4ff, 0, 8, 1.4);
  stage.add(spellLight);

  let audioContext: AudioContext | null = null;
  function playSpellSound(): void {
    if (reduceMotion || typeof window === 'undefined') return;
    try {
      audioContext ??= new AudioContext();
      if (audioContext.state === 'suspended') void audioContext.resume();
      const ctx = audioContext;
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.22, now + 0.012);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
      master.connect(ctx.destination);

      const thunder = ctx.createOscillator();
      thunder.type = 'triangle';
      thunder.frequency.setValueAtTime(145, now);
      thunder.frequency.exponentialRampToValueAtTime(48, now + 0.42);
      thunder.connect(master);
      thunder.start(now);
      thunder.stop(now + 0.48);

      const crack = ctx.createOscillator();
      crack.type = 'sawtooth';
      crack.frequency.setValueAtTime(860, now);
      crack.frequency.exponentialRampToValueAtTime(120, now + 0.16);
      const crackGain = ctx.createGain();
      crackGain.gain.setValueAtTime(0.10, now);
      crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      crack.connect(crackGain).connect(ctx.destination);
      crack.start(now);
      crack.stop(now + 0.2);

      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.32), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.frequency.exponentialRampToValueAtTime(260, now + 0.3);
      noise.connect(filter).connect(master);
      noise.start(now);
      noise.stop(now + 0.32);
    } catch {
      // Audio is optional; visual spell effects must still work if audio is unavailable.
    }
  }

  interface Spark { life: number; max: number; pos: THREE.Vector3; vel: THREE.Vector3; spin: number; rad: number; }
  const SP: Spark[] = [];
  for (let i = 0; i < SPELL_N; i++)
    SP.push({ life: 0, max: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: 0, rad: 0 });

  let spellCd = 0;
  let boltLife = 0;
  const worldOrigin = new THREE.Vector3();
  const boltStart = new THREE.Vector3();
  const boltEnd = new THREE.Vector3();
  const boltPoint = new THREE.Vector3();

  function cast(): void {
    if (spellCd > 0) return;
    spellCd = 1.6;
    boltLife = 0.56;
    playSpellSound();
    canvas.dispatchEvent(new CustomEvent('spellcast'));
    spellAnchor.getWorldPosition(worldOrigin);
    stage.worldToLocal(worldOrigin);
    let n = 0;
    boltStart.copy(worldOrigin);
    boltEnd.copy(worldOrigin).add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.8,
      2.0 + Math.random() * 0.65,
      (Math.random() - 0.5) * 0.35,
    ));
    for (let i = 0; i < BOLT_SEGMENTS; i++) {
      const a = i / BOLT_SEGMENTS;
      const b = (i + 1) / BOLT_SEGMENTS;
      boltPoint.lerpVectors(boltStart, boltEnd, a);
      if (i > 0) boltPoint.x += (Math.random() - 0.5) * 0.26;
      if (i > 0) boltPoint.z += (Math.random() - 0.5) * 0.18;
      boltPos[i * 6] = boltPoint.x;
      boltPos[i * 6 + 1] = boltPoint.y;
      boltPos[i * 6 + 2] = boltPoint.z;
      boltPoint.lerpVectors(boltStart, boltEnd, b);
      if (i < BOLT_SEGMENTS - 1) boltPoint.x += (Math.random() - 0.5) * 0.26;
      if (i < BOLT_SEGMENTS - 1) boltPoint.z += (Math.random() - 0.5) * 0.18;
      boltPos[i * 6 + 3] = boltPoint.x;
      boltPos[i * 6 + 4] = boltPoint.y;
      boltPos[i * 6 + 5] = boltPoint.z;
    }
    boltGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < SPELL_N && n < 210; i++) {
      const s = SP[i];
      if (s.life > 0) continue;
      s.max = s.life = 0.9 + Math.random() * 1.1;
      s.pos.copy(worldOrigin);
      s.rad = 0.05 + Math.random() * 0.22;
      s.spin = (Math.random() < 0.5 ? -1 : 1) * (1.6 + Math.random() * 2.4);
      s.vel.set((Math.random() - 0.5) * 0.5, 0.55 + Math.random() * 1.15, (Math.random() - 0.5) * 0.5);
      n++;
    }
  }

  const bookM = new THREE.Matrix4();
  const bookQ = new THREE.Quaternion();
  const bookP = new THREE.Vector3();

  const clock = new THREE.Clock();
  let raf = 0;

  function frame(): void {
    raf = requestAnimationFrame(frame);
    if (paused || !visible) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    if (!dragging) {
      dragRot = clampRot(dragRot + dragVel);
      dragVel *= 0.93;
      dragRot -= dragRot * 0.25 * dt;      // очень медленно возвращается к центру
    }

    if (subject) {
      const auto = reduceMotion ? 0 : Math.sin(t * 0.17) * SWEEP * 0.85;
      subject.rotation.y = clampRot(auto + dragRot);
    }

    if (!reduceMotion) {
      starsFar.rotation.y += dt * 0.011;
      starsNear.rotation.y -= dt * 0.021;
      starsNear.rotation.x = Math.sin(t * 0.05) * 0.05;
      // мерцание: два слоя дышат в противофазе
      (starsFar.material as THREE.PointsMaterial).opacity = 0.44 + Math.sin(t * 0.7) * 0.08;
      (starsNear.material as THREE.PointsMaterial).opacity = 0.34 + Math.sin(t * 0.9 + 2) * 0.08;
      stage.position.y = Math.sin(t * 0.5) * 0.11;

      for (const layer of debris) {
        layer.object.rotation.y += dt * layer.drift * 0.3;
        layer.object.position.y = Math.sin(t * layer.drift) * 0.35;

        if (!layer.books) continue;
        const { mesh, items } = layer.books;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          it.rot.x += it.spin.x * dt;
          it.rot.y += it.spin.y * dt;
          it.rot.z += it.spin.z * dt;
          bookQ.setFromEuler(it.rot);
          bookP.copy(it.pos);
          bookP.y += Math.sin(t * 0.42 + it.phase) * it.bob;
          bookP.x += Math.cos(t * 0.27 + it.phase) * it.bob * 0.45;
          bookM.compose(bookP, bookQ, it.scale);
          mesh.setMatrixAt(i, bookM);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
    }

    // --- заклинание ---
    if (spellCd > 0) spellCd -= dt;
    if (boltLife > 0) boltLife -= dt;
    const boltFlash = Math.max(0, Math.min(1, boltLife * 7.5));
    boltMat.opacity = boltFlash;
    boltGlowMat.opacity = boltFlash * 0.34;
    bolt.scale.set(1 + Math.sin(t * 42) * 0.045, 1, 1 + Math.cos(t * 37) * 0.045);
    boltGlow.scale.setScalar(1.035 + Math.sin(t * 36) * 0.025);
    for (let i = 0; i < SPELL_N; i++) {
      const s = SP[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) {
        spellPos[i * 3 + 1] = -999;
        spellCol[i * 3] = spellCol[i * 3 + 1] = spellCol[i * 3 + 2] = 0;
        continue;
      }
      const k = s.life / s.max;                       // 1 -> 0
      const age = 1 - k;
      s.vel.y -= 0.28 * dt;                           // искры выдыхаются
      s.pos.addScaledVector(s.vel, dt);
      const a = s.spin * age * 2.2;
      spellPos[i * 3] = s.pos.x + Math.cos(a) * s.rad * age;
      spellPos[i * 3 + 1] = s.pos.y;
      spellPos[i * 3 + 2] = s.pos.z + Math.sin(a) * s.rad * age;
      spellCol[i * 3] = Math.min(1.6, k * 1.9);
      spellCol[i * 3 + 1] = Math.min(1.4, Math.pow(k, 1.5) * 1.5);
      spellCol[i * 3 + 2] = Math.pow(k, 3.2) * 1.1;
    }
    spellGeo.attributes.position.needsUpdate = true;
    spellGeo.attributes.color.needsUpdate = true;
    if (spellCd > 0) {
      spellAnchor.getWorldPosition(worldOrigin);
      stage.worldToLocal(worldOrigin);
      spellLight.position.copy(worldOrigin);
    }
    spellLight.intensity = Math.max(0, spellCd - 0.4) * 12;

    // Параллакс идёт всегда: это отклик на действие пользователя,
    // а не самопроизвольная анимация, поэтому reduced-motion его не трогает.
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
