"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { svgToCanvas } from "@/lib/client/raster";

/**
 * The landing page's 3D zine: the real printed sheet as a texture on 8 paper
 * panels joined by hinges. Scroll progress (0..1) folds and unfolds it.
 * Fold order matches real paper: top row back, left half back, page 8 behind
 * page 1 → you're holding the cover.
 */

const W = 2.794; // letter, in units of 100 mm
const H = 2.159;
const CW = W / 4;
const CH = H / 2;
const cx = (col: number) => -W / 2 + CW * (col + 0.5);
const cy = (row: number) => H / 2 - CH * (row + 0.5);

/* ------------------------------ keyframes ------------------------------ */

interface Pose {
  fold: number; // 0 flat … 1 folded into the booklet
  x: number;
  y: number;
  s: number;
  rx: number;
  ry: number;
  rz: number;
}
const K = (p: number, pose: Pose) => ({ p, ...pose });
// Desktop: the booklet sits right of the headline; flat, the sheet sits right of the captions.
const DESKTOP = [
  K(0.0, { fold: 1, x: 1.3, y: -0.02, s: 1.95, rx: 0.36, ry: -0.56, rz: 0.07 }),
  K(0.1, { fold: 1, x: 1.05, y: 0.02, s: 1.85, rx: 0.24, ry: -0.3, rz: 0.03 }),
  K(0.3, { fold: 0, x: 0.62, y: 0.06, s: 0.95, rx: -0.3, ry: -0.14, rz: 0 }),
  K(0.42, { fold: 0, x: 0.62, y: 0.06, s: 0.95, rx: -0.24, ry: -0.08, rz: 0 }),
  K(0.52, {
    fold: 0,
    x: -cx(3) * 1.6 + 0.75,
    y: -cy(0) * 1.6 + 0.05,
    s: 1.6,
    rx: -0.1,
    ry: -0.04,
    rz: 0,
  }),
  K(0.62, { fold: 0, x: 0.62, y: 0.06, s: 0.95, rx: -0.3, ry: -0.14, rz: 0 }),
  K(0.82, { fold: 1, x: 0.95, y: 0.05, s: 1.9, rx: 0.2, ry: 0.42, rz: -0.04 }),
  K(1.0, { fold: 1, x: 1.0, y: -0.3, s: 1.6, rx: 1.0, ry: 0.65, rz: -0.12 }),
];
// Phone: the paper lives in the top half, text in the bottom half.
const MOBILE = [
  K(0.0, { fold: 1, x: 0.05, y: 0.9, s: 0.82, rx: 0.3, ry: -0.45, rz: 0.06 }),
  K(0.1, { fold: 1, x: 0.0, y: 0.75, s: 0.95, rx: 0.2, ry: -0.2, rz: 0.03 }),
  K(0.3, { fold: 0, x: 0, y: 0.5, s: 0.47, rx: -0.25, ry: 0, rz: 0 }),
  K(0.42, { fold: 0, x: 0, y: 0.5, s: 0.47, rx: -0.2, ry: 0, rz: 0 }),
  K(0.52, { fold: 0, x: -cx(3) * 1.05, y: -cy(0) * 1.05 + 0.5, s: 1.05, rx: -0.08, ry: 0, rz: 0 }),
  K(0.62, { fold: 0, x: 0, y: 0.5, s: 0.47, rx: -0.25, ry: 0, rz: 0 }),
  K(0.82, { fold: 1, x: 0, y: 0.5, s: 1.15, rx: 0.2, ry: 0.4, rz: -0.04 }),
  K(1.0, { fold: 1, x: 0.1, y: 0.35, s: 1.0, rx: 0.9, ry: 0.6, rz: -0.1 }),
];

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
function poseAt(keys: typeof DESKTOP, p: number): Pose {
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1]!.p) i++;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const t = smooth(clamp01((p - a.p) / Math.max(1e-6, b.p - a.p)));
  const l = (k: keyof Pose) => a[k] + (b[k] - a[k]) * t;
  return {
    fold: l("fold"),
    x: l("x"),
    y: l("y"),
    s: l("s"),
    rx: l("rx"),
    ry: l("ry"),
    rz: l("rz"),
  };
}

/* ------------------------------- paper -------------------------------- */

function cellGeometry(col: number, row: number) {
  const g = new THREE.PlaneGeometry(CW, CH, 1, 1);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    uv.setXY(i, (col + u) / 4, (1 - row) * 0.5 + v * 0.5);
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
      <mesh geometry={geo} material={front} />
      <mesh geometry={geo} material={back} />
    </group>
  );
}

function Zine({
  progress,
  texture,
  mobile,
  pointer,
}: {
  progress: MutableRefObject<number>;
  texture: THREE.Texture | null;
  mobile: boolean;
  pointer: MutableRefObject<{ x: number; y: number }>;
}) {
  const root = useRef<THREE.Group>(null);
  const centre = useRef<THREE.Group>(null);
  const h3 = useRef<THREE.Group>(null);
  const h2 = useRef<THREE.Group>(null);
  const h6 = useRef<THREE.Group>(null);
  const tops = useRef<(THREE.Group | null)[]>([]);
  const shadow = useRef<THREE.Mesh>(null);
  const smoothed = useRef({ p: progress.current, px: 0, py: 0 });

  const front = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f6f1e7",
        roughness: 0.86,
        metalness: 0,
        side: THREE.FrontSide,
      }),
    [],
  );
  const back = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#e8e1d3",
        roughness: 0.92,
        metalness: 0,
        side: THREE.BackSide,
      }),
    [],
  );
  useEffect(() => {
    front.map = texture;
    front.color.set(texture ? "#ffffff" : "#f6f1e7");
    front.needsUpdate = true;
  }, [texture, front]);

  const shadowTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grd.addColorStop(0, "rgba(0,0,0,0.75)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);

  useFrame((state, dt) => {
    const sm = smoothed.current;
    const k = 1 - Math.pow(0.0015, dt); // frame-rate independent easing
    sm.p += (progress.current - sm.p) * k;
    sm.px += (pointer.current.x - sm.px) * k * 0.6;
    sm.py += (pointer.current.y - sm.py) * k * 0.6;
    const pose = poseAt(mobile ? MOBILE : DESKTOP, sm.p);
    const f = pose.fold;
    // Unfolding reverses the fold order: page 8 first, then the left half, then the top row.
    const s3 = smooth(clamp01((f - 0.66) / 0.34));
    const s2 = smooth(clamp01((f - 0.33) / 0.33));
    const s1 = smooth(clamp01(f / 0.33));
    const PI = Math.PI;
    for (const t of tops.current) {
      if (!t) continue;
      t.rotation.x = -s1 * PI;
      t.position.z = -0.006 * s1;
    }
    if (h2.current) {
      h2.current.rotation.y = -s2 * PI;
      h2.current.position.z = -0.012 * s2;
    }
    if (h3.current) {
      h3.current.rotation.y = -s3 * PI;
      h3.current.position.z = -0.04 * s3;
    }
    // Page 6 hangs off page 7 by its own crease, which opens as page 8 folds behind page 1.
    if (h6.current) {
      h6.current.rotation.y = s3 * PI;
      h6.current.position.z = -0.006 * s3;
    }
    // Keep whatever is still visible centred.
    if (centre.current) {
      const x = (W / 4) * s2 + ((3 * W) / 8 - W / 4) * s3;
      const y = (-H / 4) * s1;
      centre.current.position.set(-x, -y, 0);
    }
    const t = state.clock.elapsedTime;
    const idle = f * (1 - Math.min(1, sm.p * 6)) + f * 0.4;
    if (root.current) {
      root.current.position.set(pose.x, pose.y + Math.sin(t * 0.9) * 0.035 * idle, 0);
      root.current.scale.setScalar(pose.s);
      root.current.rotation.set(
        pose.rx + sm.py * 0.12 + Math.sin(t * 0.6) * 0.02 * idle,
        pose.ry + sm.px * 0.18,
        pose.rz + Math.sin(t * 0.5) * 0.015 * idle,
      );
    }
    if (shadow.current) {
      shadow.current.position.set(pose.x + 0.15, pose.y - 0.28, -0.6);
      const footprint = 1 - f * 0.72;
      shadow.current.scale.set(W * pose.s * footprint * 1.35, H * pose.s * (1 - f * 0.45) * 1.3, 1);
      (shadow.current.material as THREE.MeshBasicMaterial).opacity = 0.55;
    }
  });

  const top = (col: number) => (
    <group ref={(el) => void (tops.current[col] = el)}>
      <Cell col={col} row={0} front={front} back={back} />
    </group>
  );

  return (
    <>
      <mesh ref={shadow} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} opacity={0.5} />
      </mesh>
      <group ref={root}>
        <group ref={centre}>
          <Cell col={3} row={1} front={front} back={back} />
          {top(3)}
          <group ref={h3} position={[W / 4, 0, 0]}>
            <group position={[-W / 4, 0, 0]}>
              <Cell col={2} row={1} front={front} back={back} />
              {top(2)}
              <group ref={h2}>
                <Cell col={1} row={1} front={front} back={back} />
                {top(1)}
                <group ref={h6} position={[-W / 4, 0, 0]}>
                  <group position={[W / 4, 0, 0]}>
                    <Cell col={0} row={1} front={front} back={back} />
                    {top(0)}
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </>
  );
}

/* ----------------------------- background ----------------------------- */

const BG_FRAG = /* glsl */ `
precision highp float;
uniform float uTime; uniform vec2 uRes; uniform float uP;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
void main(){
  vec2 p = (vUv - .5) * vec2(uRes.x / uRes.y, 1.);
  float t = uTime * .025;
  vec3 col = vec3(.039, .039, .031);
  // A warm lamp somewhere above the desk.
  vec2 lampPos = vec2(.42 - uP * .5, .32 - uP * .25);
  float lamp = exp(-2.4 * dot(p - lampPos, p - lampPos));
  float n = fbm(p * 1.6 + vec2(t, -t * .7));
  col += vec3(.96, .74, .45) * lamp * (.075 + .05 * n);
  // A faint grass-green haze low on the left.
  float haze = exp(-1.6 * dot(p - vec2(-.75, -.6), p - vec2(-.75, -.6)));
  col += vec3(.79, .93, .45) * haze * .035 * (.6 + n);
  // Topographic contour lines drifting slowly: the map under everything.
  float h = fbm(p * 1.25 + vec2(0., t * .6)) * 9.;
  float d = abs(fract(h) - .5);
  float w = fwidth(h) * 1.2;
  float line = smoothstep(.5 - w, .5, d);
  col += vec3(.95, .92, .85) * line * (.022 + .03 * lamp);
  // Vignette.
  col *= 1. - .6 * dot(p * .75, p * .75);
  gl_FragColor = vec4(col, 1.);
}`;

const BG_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, .999, 1.); }`;

function Backdrop({ progress }: { progress: MutableRefObject<number> }) {
  const { size } = useThree();
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BG_VERT,
        fragmentShader: BG_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uRes: { value: new THREE.Vector2(1, 1) },
          uP: { value: 0 },
        },
        depthWrite: false,
        depthTest: false,
      }),
    [],
  );
  useFrame((s) => {
    mat.uniforms.uTime!.value = s.clock.elapsedTime;
    (mat.uniforms.uRes!.value as THREE.Vector2).set(size.width, size.height);
    mat.uniforms.uP!.value += (progress.current - mat.uniforms.uP!.value) * 0.05;
  });
  return (
    <mesh renderOrder={-2} frustumCulled={false} material={mat}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

/* ------------------------------- canvas ------------------------------- */

export default function ZineScene({
  progress,
  sheetId,
  onReady,
  active,
}: {
  progress: MutableRefObject<number>;
  sheetId: string;
  onReady?: () => void;
  active: boolean;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [mobile, setMobile] = useState(false);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const m = window.matchMedia("(max-width: 767px)");
    const set = () => setMobile(m.matches);
    set();
    m.addEventListener("change", set);
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
      window.removeEventListener("pointermove", move);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await document.fonts.ready;
      const svg = document.getElementById(sheetId) as unknown as SVGSVGElement | null;
      if (!svg) return;
      try {
        const c = await svgToCanvas(svg, 8);
        if (cancelled) return;
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        setTexture(tex);
      } catch {
        /* the paper still renders, just blank */
      }
      onReady?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [sheetId, onReady]);

  return (
    <Canvas
      dpr={[1, 1.8]}
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 0, 5.2], fov: 32 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.12;
      }}
      aria-hidden
    >
      <Backdrop progress={progress} />
      <ambientLight intensity={0.6} color="#fffaf0" />
      <directionalLight position={[-2.5, 3, 4]} intensity={2.0} color="#fff0d9" />
      <directionalLight position={[3, -1, 2]} intensity={0.35} color="#bcd7ff" />
      <pointLight position={[0, 0, -3]} intensity={0.6} color="#c9ee73" />
      <Zine progress={progress} texture={texture} mobile={mobile} pointer={pointer} />
    </Canvas>
  );
}
