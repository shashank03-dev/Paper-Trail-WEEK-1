"use client";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { drawPaper } from "@/components/landing/paperTexture";

/**
 * A bookshop picture ledge for folded zines. Each booklet is a thin block whose
 * front is its real printed cover; it leans against the wall behind an oak lip.
 * Hovering pulls a booklet up and toward you; clicking opens it.
 */

export interface RackItem {
  id: string;
  cover: HTMLCanvasElement | null;
}

import { GAP, ROW_H, ZINE_H, ZINE_W, rackSize } from "./rackLayout";

const ZINE_D = 0.035;
const LEAN = -0.16;

let oak: THREE.CanvasTexture | null = null;
function oakTexture() {
  if (oak) return oak;
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#b8895a";
  g.fillRect(0, 0, 1024, 64);
  let s = 3;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) {
    const y = r() * 64;
    g.strokeStyle = `rgba(${90 + r() * 40},${55 + r() * 25},${30 + r() * 15},${0.12 + r() * 0.2})`;
    g.lineWidth = 0.6 + r() * 1.8;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + Math.sin(x / 140 + i) * 2.2 + (r() - 0.5));
    g.stroke();
  }
  oak = new THREE.CanvasTexture(c);
  oak.colorSpace = THREE.SRGBColorSpace;
  oak.wrapS = THREE.RepeatWrapping;
  return oak;
}

let edges: THREE.CanvasTexture | null = null;
/** Folded page edges: a few fine lines of stacked paper. */
function edgeTexture() {
  if (edges) return edges;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 16;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f2ede2";
  g.fillRect(0, 0, 64, 16);
  for (let y = 2; y < 16; y += 3) {
    g.fillStyle = "rgba(120,104,80,0.22)";
    g.fillRect(0, y, 64, 1);
  }
  edges = new THREE.CanvasTexture(c);
  edges.colorSpace = THREE.SRGBColorSpace;
  return edges;
}

let backTex: THREE.CanvasTexture | null = null;
function backTexture() {
  if (backTex) return backTex;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 400;
  drawPaper(c.getContext("2d")!, 256, 400, "#f5f1e8");
  backTex = new THREE.CanvasTexture(c);
  backTex.colorSpace = THREE.SRGBColorSpace;
  return backTex;
}

function Zine({
  item,
  index,
  x,
  y,
  hovered,
  onHover,
  onOpen,
  still,
}: {
  item: RackItem;
  index: number;
  x: number;
  y: number;
  hovered: boolean;
  onHover: (id: string | null, e?: ThreeEvent<PointerEvent>) => void;
  onOpen: (id: string) => void;
  still: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const yaw = useMemo(() => (((index * 7919) % 11) / 11 - 0.5) * 0.12, [index]);
  const mats = useMemo(() => {
    const edge = new THREE.MeshStandardMaterial({ map: edgeTexture(), roughness: 0.95 });
    const front = new THREE.MeshStandardMaterial({ color: "#fbf9f3", roughness: 0.82 });
    const back = new THREE.MeshStandardMaterial({ map: backTexture(), roughness: 0.95 });
    return [edge, edge, edge, edge, front, back];
  }, []);
  useEffect(() => {
    const front = mats[4]!;
    if (!item.cover) return;
    const t = new THREE.CanvasTexture(item.cover);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    front.map = t;
    front.color.set("#ffffff");
    front.needsUpdate = true;
    return () => t.dispose();
  }, [item.cover, mats]);

  const target = useRef({ y: 0, z: 0, rx: LEAN, ry: yaw });
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    target.current = hovered
      ? { y: 0.32, z: 0.55, rx: 0.06, ry: 0 }
      : { y: 0, z: 0, rx: LEAN, ry: yaw };
    const k = still ? 1 : 1 - Math.pow(0.0008, Math.min(dt, 0.05));
    g.position.y += (y + target.current.y - g.position.y) * k;
    g.position.z += (target.current.z - g.position.z) * k;
    g.rotation.x += (target.current.rx - g.rotation.x) * k;
    g.rotation.y += (target.current.ry - g.rotation.y) * k;
  });

  return (
    <group ref={ref} position={[x, y, 0]} rotation={[LEAN, yaw, 0]}>
      {/* Pivot at the bottom edge so the booklet leans like a real one. */}
      <mesh
        position={[0, ZINE_H / 2, 0]}
        material={mats}
        castShadow
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(item.id, e);
        }}
        onPointerMove={(e) => onHover(item.id, e)}
        onPointerOut={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(item.id);
        }}
      >
        <boxGeometry args={[ZINE_W, ZINE_H, ZINE_D]} />
      </mesh>
    </group>
  );
}

function Ledge({ y, w }: { y: number; w: number }) {
  const wood = useMemo(() => {
    const t = oakTexture().clone();
    t.needsUpdate = true;
    t.repeat.set(w / 4, 1);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.62 });
  }, [w]);
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, -0.045, 0.05]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[w, 0.09, 0.62]} />
      </mesh>
      <mesh position={[0, 0.05, 0.34]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[w, 0.2, 0.05]} />
      </mesh>
    </group>
  );
}

export default function ZineRackScene({
  items,
  cols,
  active,
  low = false,
  onOpen,
  onHover,
}: {
  items: RackItem[];
  cols: number;
  active: boolean;
  low?: boolean;
  onOpen: (id: string) => void;
  onHover: (id: string | null, x: number, y: number) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [still, setStill] = useState(false);
  useEffect(() => setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  const { c, rows, w, h } = rackSize(items.length, cols);
  const fov = 24;
  const dist = h / 2 / Math.tan((fov * Math.PI) / 360) + 0.4;
  const hover = (id: string | null, e?: ThreeEvent<PointerEvent>) => {
    setHovered(id);
    document.body.style.cursor = id ? "pointer" : "";
    onHover(id, e?.nativeEvent.offsetX ?? 0, e?.nativeEvent.offsetY ?? 0);
  };
  useEffect(() => () => void (document.body.style.cursor = ""), []);
  const rowWidth = c * ZINE_W + (c - 1) * GAP;
  return (
    <Canvas
      dpr={low ? [1, 1.25] : [1, 1.75]}
      frameloop={active ? "always" : "never"}
      shadows={{ type: THREE.VSMShadowMap }}
      camera={{ position: [0, 0.1, dist], fov }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1;
      }}
      onPointerMissed={() => hover(null)}
    >
      <hemisphereLight args={["#fffaf0", "#e2d8c4", 1.35]} />
      <directionalLight
        position={[-1.6, 3.6, 9]}
        intensity={2.6}
        color="#fff3df"
        castShadow
        shadow-mapSize={low ? [1024, 1024] : [2048, 2048]}
        shadow-radius={10}
        shadow-blurSamples={16}
        shadow-bias={-0.0005}
        shadow-camera-left={-w}
        shadow-camera-right={w}
        shadow-camera-top={h}
        shadow-camera-bottom={-h}
      />
      <mesh position={[0, 0, -0.32]} receiveShadow>
        <planeGeometry args={[w * 3, h * 3]} />
        <shadowMaterial transparent opacity={0.1} color="#3a2f1f" />
      </mesh>
      {Array.from({ length: rows }, (_, r) => {
        const y = h / 2 - 0.15 - (r + 1) * ROW_H + 0.35;
        return <Ledge key={r} y={y} w={rowWidth + 0.9} />;
      })}
      {items.map((it, i) => {
        const r = Math.floor(i / c);
        const inRow = Math.min(c, items.length - r * c);
        const rw = inRow * ZINE_W + (inRow - 1) * GAP;
        const x = -rw / 2 + ZINE_W / 2 + (i % c) * (ZINE_W + GAP);
        const y = h / 2 - 0.15 - (r + 1) * ROW_H + 0.35;
        return (
          <Zine
            key={it.id}
            item={it}
            index={i}
            x={x}
            y={y}
            hovered={hovered === it.id}
            onHover={hover}
            onOpen={onOpen}
            still={still}
          />
        );
      })}
    </Canvas>
  );
}
