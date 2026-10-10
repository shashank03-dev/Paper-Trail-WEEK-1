"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { svgToCanvas } from "@/lib/client/raster";
import { paperBackTexture } from "./paperTexture";
import {
  CAMERA_FOV,
  CAMERA_Z,
  DESK_Z,
  SHEET_H,
  SHEET_W,
  foldVertices,
  footprintCentre,
} from "./foldSheet";

/**
 * The landing still life: the real printed sheet lying on a bone-white desk
 * under one soft key light, next to a riso-blue pencil. Everything that moves
 * is read from `rig`, which an anime.js timeline drives from the scroll
 * position (see Studio.tsx); this file only draws it. The sheet is one
 * continuous, finely divided piece of paper bent along its creases
 * (foldSheet.ts), so folds roll and flaps flex instead of hinging like card.
 * The desk is a shadow catcher on a transparent canvas: the page colour shows
 * through and only real shadows land on it.
 */

export interface Rig {
  // Folds, 0 = flat … 1 = folded.
  top: number;
  a: number;
  b: number;
  c: number;
  // Where the paper is: position, height above the desk, scale, rotation.
  x: number;
  y: number;
  z: number;
  s: number;
  rx: number;
  ry: number;
  rz: number;
  // The point of the sheet (from its centre) that sits at x,y and that it turns and scales about.
  fx: number;
  fy: number;
  // The pencil: 0 = resting by the paper … 1 = rolled out of frame.
  away: number;
  // Where the pencil rests (fixed per layout): position, angle, scale.
  penX: number;
  penY: number;
  penR: number;
  penS: number;
}

// Paper resolution: fine enough for smooth creases; coarser on weak phones.
const SEGS = { high: [168, 96], low: [96, 56] } as const;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/* ------------------------------ paper ------------------------------- */

function Paper({
  rig,
  pointer,
  texture,
  still,
  low,
}: {
  rig: RefObject<Rig>;
  pointer: RefObject<{ x: number; y: number }>;
  texture: THREE.Texture | null;
  still: boolean;
  low: boolean;
}) {
  const root = useRef<THREE.Group>(null);
  const focus = useRef<THREE.Group>(null);
  const centre = useRef<THREE.Group>(null);
  const motion = useRef({ prev: null as null | number[], flex: 0, cx: 0, cy: 0, px: 0, py: 0 });

  const { geometry, flat } = useMemo(() => {
    const [sx, sy] = SEGS[low ? "low" : "high"];
    const g = new THREE.PlaneGeometry(SHEET_W, SHEET_H, sx, sy);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const flat = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      flat[i * 2] = pos.getX(i);
      flat[i * 2 + 1] = pos.getY(i);
    }
    pos.setUsage(THREE.DynamicDrawUsage);
    return { geometry: g, flat };
  }, [low]);
  useEffect(() => () => geometry.dispose(), [geometry]);

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
    () => new THREE.MeshStandardMaterial({ color: "#fbf9f3", roughness: 0.86 }),
    [],
  );
  useEffect(() => {
    front.map = texture;
    front.color.set(texture ? "#ffffff" : "#fbf9f3");
    front.needsUpdate = true;
  }, [texture, front]);

  useFrame((state, dt) => {
    const r = rig.current;
    if (!r) return;
    const m = motion.current;
    const step = Math.min(dt, 0.05);
    // How fast the folds are moving drives the flex: paper bows while it swings, then settles.
    const folds = [r.top, r.a, r.b, r.c];
    const speed = m.prev ? Math.max(...folds.map((f, i) => Math.abs(f - m.prev![i]!))) / step : 0;
    m.prev = folds;
    const target = still ? 0 : clamp01(speed * 0.9);
    m.flex += (target - m.flex) * (1 - Math.pow(0.02, step));

    const pos = geometry.attributes.position as THREE.BufferAttribute;
    foldVertices(flat, pos.array as Float32Array, {
      top: r.top,
      a: r.a,
      b: r.b,
      c: r.c,
      flex: m.flex,
    });
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    // Keep the visible paper centred where the pose puts it, easing as flaps swing.
    const [cx, cy] = footprintCentre(pos.array as Float32Array);
    const k = 1 - Math.pow(0.0004, step);
    m.cx += (cx - m.cx) * k;
    m.cy += (cy - m.cy) * k;
    centre.current?.position.set(-m.cx, -m.cy, 0);

    m.px += ((pointer.current?.x ?? 0) - m.px) * k * 0.4;
    m.py += ((pointer.current?.y ?? 0) - m.py) * k * 0.4;
    const t = state.clock.elapsedTime;
    const lift = clamp01(r.z / 0.4);
    const bob = still ? 0 : Math.sin(t * 0.8) * 0.016 * lift;
    focus.current?.position.set(-r.fx, -r.fy, 0);
    if (root.current) {
      root.current.position.set(r.x, r.y + bob, DESK_Z + 0.03 + r.z);
      root.current.scale.setScalar(r.s);
      root.current.rotation.set(
        r.rx + m.py * 0.1 * lift,
        r.ry + m.px * 0.16 * lift,
        r.rz + (still ? 0 : Math.sin(t * 0.45) * 0.008 * lift),
      );
    }
  });

  return (
    <group ref={root}>
      <group ref={focus}>
        <group ref={centre}>
          <mesh geometry={geometry} material={front} castShadow />
          <mesh geometry={geometry} material={back} castShadow />
        </group>
      </group>
    </group>
  );
}

/* ------------------------------ pencil ------------------------------ */

/** A hexagonal HB pencil, lacquered in the riso blue, built from primitives. */
function Pencil({ rig, mobile }: { rig: RefObject<Rig>; mobile: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
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
  useFrame(() => {
    const r = rig.current;
    if (!r || !ref.current) return;
    // It rolls away across its own length's normal, turning by exactly the distance travelled.
    const travel = r.away * (mobile ? 1.6 : 1.3);
    ref.current.position.set(
      r.penX + (mobile ? travel : 0),
      r.penY - (mobile ? 0 : travel),
      DESK_Z + R * r.penS,
    );
    ref.current.rotation.set(0, 0, r.penR);
    ref.current.scale.setScalar(r.penS);
    if (body.current) body.current.rotation.x = (mobile ? -1 : 1) * (travel / (R * r.penS));
  });
  return (
    <group ref={ref}>
      <group ref={body}>
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
  rig,
  sheetId,
  active,
  mobile,
  low = false,
  onReady,
}: {
  rig: RefObject<Rig>;
  sheetId: string;
  active: boolean;
  mobile: boolean;
  /** A weak device: lower pixel ratio, coarser paper, smaller shadows. */
  low?: boolean;
  onReady?: () => void;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [still, setStill] = useState(false);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const r = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setStill(r.matches);
    set();
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
          const c = await svgToCanvas(svg, low ? 5 : 8);
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
  }, [sheetId, onReady, low]);

  return (
    <Canvas
      dpr={low ? [1, 1.25] : [1, 1.75]}
      frameloop={active ? "always" : "never"}
      shadows={{ type: THREE.VSMShadowMap }}
      camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV }}
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
        shadow-mapSize={low ? [1024, 1024] : [2048, 2048]}
        shadow-radius={9}
        shadow-blurSamples={low ? 8 : 20}
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
      <Paper rig={rig} pointer={pointer} texture={texture} still={still} low={low} />
      <Pencil rig={rig} mobile={mobile} />
    </Canvas>
  );
}
