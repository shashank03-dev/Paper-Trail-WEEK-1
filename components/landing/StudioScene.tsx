"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { svgToCanvas } from "@/lib/client/raster";
import { paperBackTexture } from "./paperTexture";

/**
 * The landing still life: the real printed sheet lying on a bone-white desk
 * under one soft key light, next to a riso-blue pencil. Scrolling lifts it,
 * opens it as a concertina into the flat sheet, then folds it back into the
 * pocket booklet. The desk is a shadow catcher, so the canvas is transparent
 * and the page colour shows through; only real shadows land on it.
 */

const W = 2.794; // US Letter, landscape, in units of 100 mm
const H = 2.159;
const CW = W / 4;
const CH = H / 2;
const cx = (col: number) => -W / 2 + CW * (col + 0.5);
const cy = (row: number) => H / 2 - CH * (row + 0.5);
const DESK_Z = -0.42;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10); // smootherstep
const seg = (v: number, a: number, b: number) => ease(clamp01((v - a) / (b - a)));

/* ------------------------------ poses ------------------------------- */

interface Pose {
  fold: number; // 0 = flat sheet, 1 = folded booklet
  x: number;
  y: number;
  z: number; // height above the desk
  s: number;
  rx: number;
  ry: number;
  rz: number;
}
type Key = Pose & { p: number };
const k = (p: number, pose: Pose): Key => ({ p, ...pose });

// Desktop: words on the left, the paper on the right.
const DESKTOP: Key[] = [
  k(0.0, { fold: 1, x: 1.72, y: 0.05, z: 0.02, s: 1.62, rx: 0.06, ry: 0.04, rz: -0.16 }),
  k(0.08, { fold: 1, x: 1.42, y: -0.08, z: 0.55, s: 1.42, rx: -0.12, ry: -0.3, rz: -0.08 }),
  k(0.3, { fold: 0, x: 1.18, y: 0.02, z: 0.42, s: 1.02, rx: -0.08, ry: -0.06, rz: 0.015 }),
  k(0.42, { fold: 0, x: 1.18, y: 0.02, z: 0.42, s: 1.02, rx: -0.04, ry: 0.04, rz: 0.015 }),
  k(0.54, {
    fold: 0,
    x: 1.3 - cx(1) * 1.75,
    y: -cy(1) * 1.75 - 0.15,
    z: 0.5,
    s: 1.75,
    rx: -0.02,
    ry: 0.02,
    rz: 0,
  }),
  k(0.64, { fold: 0, x: 1.18, y: 0.02, z: 0.42, s: 1.02, rx: -0.08, ry: -0.06, rz: 0.015 }),
  k(0.86, { fold: 1, x: 1.45, y: 0.0, z: 0.6, s: 1.5, rx: -0.1, ry: 0.42, rz: 0.06 }),
  k(1.0, { fold: 1, x: 1.6, y: -0.18, z: 0.03, s: 1.38, rx: 0.04, ry: 0.0, rz: 0.16 }),
];
// Phones: the paper in the top half, words underneath.
const MOBILE: Key[] = [
  k(0.0, { fold: 1, x: -0.22, y: 1.2, z: 0.02, s: 0.74, rx: 0.05, ry: 0.0, rz: -0.14 }),
  k(0.08, { fold: 1, x: 0.0, y: 1.0, z: 0.4, s: 0.8, rx: -0.12, ry: -0.3, rz: -0.06 }),
  k(0.3, { fold: 0, x: 0, y: 0.86, z: 0.3, s: 0.55, rx: -0.06, ry: 0, rz: 0 }),
  k(0.42, { fold: 0, x: 0, y: 0.86, z: 0.3, s: 0.55, rx: -0.04, ry: 0, rz: 0 }),
  k(0.54, { fold: 0, x: 0, y: -cy(1) * 0.95 + 0.7, z: 0.35, s: 0.95, rx: 0, ry: 0, rz: 0 }),
  k(0.64, { fold: 0, x: 0, y: 0.86, z: 0.3, s: 0.55, rx: -0.06, ry: 0, rz: 0 }),
  k(0.86, { fold: 1, x: 0, y: 0.82, z: 0.45, s: 1.0, rx: -0.1, ry: 0.4, rz: 0.05 }),
  k(1.0, { fold: 1, x: 0.08, y: 0.74, z: 0.03, s: 0.92, rx: 0.04, ry: 0, rz: 0.14 }),
];

function poseAt(keys: Key[], p: number): Pose {
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1]!.p) i++;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const t = ease(clamp01((p - a.p) / Math.max(1e-6, b.p - a.p)));
  const l = (key: keyof Pose) => a[key] + (b[key] - a[key]) * t;
  return {
    fold: l("fold"),
    x: l("x"),
    y: l("y"),
    z: l("z"),
    s: l("s"),
    rx: l("rx"),
    ry: l("ry"),
    rz: l("rz"),
  };
}

/* ------------------------------ paper ------------------------------- */

function cellGeometry(col: number, row: number) {
  const g = new THREE.PlaneGeometry(CW, CH, 1, 1);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (col + uv.getX(i)) / 4, (1 - row) * 0.5 + uv.getY(i) * 0.5);
  }
  uv.needsUpdate = true;
  return g;
}

function Cell({
  col,
  row,
  front,
  back,
}: {
  col: number;
  row: number;
  front: THREE.Material;
  back: THREE.Material;
}) {
  const geo = useMemo(() => cellGeometry(col, row), [col, row]);
  return (
    <group position={[cx(col), cy(row), 0]}>
      <mesh geometry={geo} material={front} castShadow />
      <mesh geometry={geo} material={back} castShadow />
    </group>
  );
}

/** One column of the sheet: the bottom page, and the top page on its own crease. */
function Column({
  col,
  front,
  back,
  topRef,
}: {
  col: number;
  front: THREE.Material;
  back: THREE.Material;
  topRef: (g: THREE.Group | null) => void;
}) {
  return (
    <>
      <Cell col={col} row={1} front={front} back={back} />
      <group ref={topRef}>
        <Cell col={col} row={0} front={front} back={back} />
      </group>
    </>
  );
}

function Sheet({
  progress,
  pointer,
  texture,
  mobile,
  still,
}: {
  progress: RefObject<number>;
  pointer: RefObject<{ x: number; y: number }>;
  texture: THREE.Texture | null;
  mobile: boolean;
  still: boolean;
}) {
  const root = useRef<THREE.Group>(null);
  const centre = useRef<THREE.Group>(null);
  const hA = useRef<THREE.Group>(null);
  const hB = useRef<THREE.Group>(null);
  const hC = useRef<THREE.Group>(null);
  const tops = useRef<(THREE.Group | null)[]>([]);
  const sm = useRef({ p: 0, px: 0, py: 0, init: false });

  const back = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: paperBackTexture(),
        roughness: 0.95,
        side: THREE.BackSide,
      }),
    [],
  );
  const front = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#fbf9f3", roughness: 0.88 }),
    [],
  );
  useEffect(() => {
    front.map = texture;
    front.color.set(texture ? "#ffffff" : "#fbf9f3");
    front.needsUpdate = true;
  }, [texture, front]);

  useFrame((state, dt) => {
    const s = sm.current;
    const target = progress.current ?? 0;
    if (!s.init || still) {
      s.p = target;
      s.init = true;
    }
    const kk = 1 - Math.pow(0.002, Math.min(dt, 0.05)); // frame-rate independent damping
    s.p += (target - s.p) * kk;
    s.px += ((pointer.current?.x ?? 0) - s.px) * kk * 0.5;
    s.py += ((pointer.current?.y ?? 0) - s.py) * kk * 0.5;
    const pose = poseAt(mobile ? MOBILE : DESKTOP, s.p);

    // Unfolding runs the folds backwards: the concertina opens, then the top row swings up.
    const f = pose.fold;
    const top = seg(f, 0.0, 0.45);
    const pleat = [seg(f, 0.4, 0.86), seg(f, 0.47, 0.93), seg(f, 0.54, 1)];
    const PI = Math.PI;
    for (const t of tops.current) {
      if (!t) continue;
      t.rotation.x = -top * PI;
      t.position.z = -0.0015 * top;
    }
    if (hA.current) {
      hA.current.rotation.y = -pleat[0]! * PI;
      hA.current.position.z = -0.006 * pleat[0]!;
    }
    if (hB.current) {
      hB.current.rotation.y = pleat[1]! * PI;
      hB.current.position.z = 0.006 * pleat[1]!;
    }
    if (hC.current) {
      hC.current.rotation.y = -pleat[2]! * PI;
      hC.current.position.z = -0.006 * pleat[2]!;
    }
    if (centre.current) {
      const fx = (pleat[0]! + pleat[1]! + pleat[2]!) / 3;
      centre.current.position.set(-cx(3) * fx, (H / 4) * top, 0);
    }

    const t = state.clock.elapsedTime;
    const lift = clamp01(pose.z / 0.4);
    const bob = still ? 0 : Math.sin(t * 0.8) * 0.018 * lift;
    if (root.current) {
      root.current.position.set(pose.x, pose.y + bob, DESK_Z + 0.02 + pose.z);
      root.current.scale.setScalar(pose.s);
      root.current.rotation.set(
        pose.rx + s.py * 0.1 * lift,
        pose.ry + s.px * 0.16 * lift,
        pose.rz + (still ? 0 : Math.sin(t * 0.45) * 0.01 * lift),
      );
    }
  });

  const topRef = (col: number) => (g: THREE.Group | null) => void (tops.current[col] = g);
  return (
    <group ref={root}>
      <group ref={centre}>
        <Column col={3} front={front} back={back} topRef={topRef(3)} />
        <group ref={hA} position={[cx(3) - CW / 2, 0, 0]}>
          <group position={[-(cx(3) - CW / 2), 0, 0]}>
            <Column col={2} front={front} back={back} topRef={topRef(2)} />
            <group ref={hB} position={[cx(2) - CW / 2, 0, 0]}>
              <group position={[-(cx(2) - CW / 2), 0, 0]}>
                <Column col={1} front={front} back={back} topRef={topRef(1)} />
                <group ref={hC} position={[cx(1) - CW / 2, 0, 0]}>
                  <group position={[-(cx(1) - CW / 2), 0, 0]}>
                    <Column col={0} front={front} back={back} topRef={topRef(0)} />
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

/* ------------------------------ pencil ------------------------------ */

/** A hexagonal HB pencil, lacquered in the riso blue, built from primitives. */
function Pencil({
  progress,
  mobile,
  still,
}: {
  progress: RefObject<number>;
  mobile: boolean;
  still: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const roll = useRef(0);
  const mats = useMemo(
    () => ({
      lacquer: new THREE.MeshPhysicalMaterial({
        color: "#2b3dd8",
        roughness: 0.32,
        clearcoat: 0.8,
        clearcoatRoughness: 0.25,
      }),
      wood: new THREE.MeshStandardMaterial({ color: "#e2c294", roughness: 0.85 }),
      lead: new THREE.MeshStandardMaterial({ color: "#2a2a2c", roughness: 0.4, metalness: 0.3 }),
      ferrule: new THREE.MeshStandardMaterial({
        color: "#c9c3b4",
        roughness: 0.28,
        metalness: 0.9,
      }),
      eraser: new THREE.MeshStandardMaterial({ color: "#e9a8a0", roughness: 0.9 }),
    }),
    [],
  );
  const R = 0.05;
  const L = 1.55;
  useFrame((_, dt) => {
    const p = progress.current ?? 0;
    const target = p * 9; // rolls a little as the page scrolls
    roll.current += (target - roll.current) * (still ? 1 : 1 - Math.pow(0.003, Math.min(dt, 0.05)));
    if (!ref.current) return;
    const away = seg(p, 0.04, 0.18) * (1 - seg(p, 0.86, 1));
    ref.current.position.set(
      (mobile ? 0.5 : 1.55) + roll.current * 0.012 + (mobile ? away * 1.6 : 0),
      (mobile ? 1.1 : -1.38) - (mobile ? 0 : away * 1.3),
      DESK_Z + R,
    );
    ref.current.rotation.set(0, 0, mobile ? 1.25 : 0.14);
    (ref.current.children[0] as THREE.Object3D).rotation.x = roll.current;
  });
  return (
    <group ref={ref} scale={mobile ? 0.52 : 1}>
      <group rotation={[0, 0, 0]}>
        <group rotation={[0, 0, Math.PI / 2]}>
          <mesh material={mats.lacquer} castShadow>
            <cylinderGeometry args={[R, R, L, 6]} />
          </mesh>
          <mesh
            material={mats.wood}
            position={[0, -L / 2 - 0.09, 0]}
            rotation={[Math.PI, 0, 0]}
            castShadow
          >
            <coneGeometry args={[R, 0.18, 6]} />
          </mesh>
          <mesh material={mats.lead} position={[0, -L / 2 - 0.165, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[R * 0.32, 0.055, 12]} />
          </mesh>
          <mesh material={mats.ferrule} position={[0, L / 2 + 0.05, 0]} castShadow>
            <cylinderGeometry args={[R * 1.04, R * 1.04, 0.1, 24]} />
          </mesh>
          <mesh material={mats.eraser} position={[0, L / 2 + 0.14, 0]} castShadow>
            <cylinderGeometry args={[R * 0.98, R * 0.98, 0.09, 24]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* ------------------------------- desk ------------------------------- */

function Desk() {
  return (
    <mesh position={[0, 0, DESK_Z]} receiveShadow>
      <planeGeometry args={[40, 30]} />
      <shadowMaterial transparent opacity={0.16} color="#3a2f1f" />
    </mesh>
  );
}

/* ------------------------------ canvas ------------------------------ */

export default function StudioScene({
  progress,
  sheetId,
  active,
  onReady,
}: {
  progress: RefObject<number>;
  sheetId: string;
  active: boolean;
  onReady?: () => void;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [mobile, setMobile] = useState(false);
  const [still, setStill] = useState(false);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const m = window.matchMedia("(max-width: 767px)");
    const r = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => {
      setMobile(m.matches);
      setStill(r.matches);
    };
    set();
    m.addEventListener("change", set);
    r.addEventListener("change", set);
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointer.current = {
        x: e.clientX / window.innerWidth - 0.5,
        y: e.clientY / window.innerHeight - 0.5,
      };
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      m.removeEventListener("change", set);
      r.removeEventListener("change", set);
      window.removeEventListener("pointermove", move);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await document.fonts.ready;
      const svg = document.getElementById(sheetId) as unknown as SVGSVGElement | null;
      if (svg) {
        try {
          const c = await svgToCanvas(svg, 8);
          if (cancelled) return;
          const tex = new THREE.CanvasTexture(c);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 8;
          setTexture(tex);
        } catch {
          /* the paper still renders, just blank */
        }
      }
      if (!cancelled) onReady?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [sheetId, onReady]);

  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      shadows={{ type: THREE.VSMShadowMap }}
      camera={{ position: [0, 0, 7], fov: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1;
      }}
      aria-hidden
    >
      <hemisphereLight args={["#fffaf0", "#e2d8c4", 1.35]} />
      <directionalLight
        position={[-3.2, 3.6, 6.5]}
        intensity={3}
        color="#fff4e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={9}
        shadow-blurSamples={20}
        shadow-bias={-0.0004}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-near={1}
        shadow-camera-far={20}
      />
      <directionalLight position={[4, -2, 3]} intensity={0.5} color="#dfe6ff" />
      <Desk />
      <Sheet
        progress={progress}
        pointer={pointer}
        texture={texture}
        mobile={mobile}
        still={still}
      />
      <Pencil progress={progress} mobile={mobile} still={still} />
    </Canvas>
  );
}
