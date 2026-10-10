/**
 * The 3D desk: the real sheet (bent around its creases by the landing page's
 * fold model), a phone with its screen off, one soft key light and a shadow
 * catcher. Same camera, lights and paper as the site's hero still life.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  CAMERA_FOV,
  CAMERA_Z,
  DESK_Z,
  SHEET_H,
  SHEET_W,
  foldVertices,
  footprintCentre,
  type FoldState,
} from "@/components/landing/foldSheet";
import { paperBackTexture } from "@/components/landing/paperTexture";

export interface SheetPose {
  x: number;
  y: number;
  z: number;
  s: number;
  rx: number;
  ry: number;
  rz: number;
}
export interface PhonePose {
  x: number;
  y: number;
  rz: number;
  /** Phone size relative to the sheet's scale on this cut. */
  s: number;
}
export interface StageState {
  sheet: SheetPose;
  folds: FoldState;
  phone: PhonePose;
  /** Hide the whole 3D layer (2D close-ups cover it). */
  visible: boolean;
}

const SEGS: [number, number] = [168, 96];

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  private scene = new THREE.Scene();
  private root = new THREE.Group();
  private centre = new THREE.Group();
  private geometry: THREE.PlaneGeometry;
  private flat: Float32Array;
  private front: THREE.MeshStandardMaterial;
  private phone = new THREE.Group();
  private folds: FoldState = { top: 0, a: 0, b: 0, c: 0, flex: 0 };
  readonly texture: THREE.CanvasTexture;

  constructor(
    canvas: HTMLCanvasElement,
    readonly w: number,
    readonly h: number,
    sheetCanvas: HTMLCanvasElement,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, w / h, 0.1, 50);
    this.camera.position.set(0, 0, CAMERA_Z);

    this.scene.add(new THREE.HemisphereLight("#fffdf9", "#e6e0d6", 1.6));
    const key = new THREE.DirectionalLight("#fffaf3", 3.3);
    key.position.set(-3.2, 3.6, 6.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 5;
    key.shadow.blurSamples = 8;
    key.shadow.bias = -0.0004;
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 5, bottom: -5, near: 1, far: 20 });
    this.scene.add(key);
    const fill = new THREE.DirectionalLight("#dfe6ff", 0.5);
    fill.position.set(4, -2, 3);
    this.scene.add(fill);

    const desk = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 30),
      new THREE.ShadowMaterial({ transparent: true, opacity: 0.26, color: "#3a2f1f" }),
    );
    desk.position.z = DESK_Z;
    desk.receiveShadow = true;
    this.scene.add(desk);

    // The sheet: one finely divided plane, front printed, back plain paper.
    this.geometry = new THREE.PlaneGeometry(SHEET_W, SHEET_H, SEGS[0], SEGS[1]);
    const pos = this.geometry.attributes.position as THREE.BufferAttribute;
    this.flat = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      this.flat[i * 2] = pos.getX(i);
      this.flat[i * 2 + 1] = pos.getY(i);
    }
    pos.setUsage(THREE.DynamicDrawUsage);
    this.texture = new THREE.CanvasTexture(sheetCanvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.front = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.86 });
    const back = new THREE.MeshStandardMaterial({
      map: paperBackTexture(),
      roughness: 0.95,
      side: THREE.BackSide,
    });
    const f = new THREE.Mesh(this.geometry, this.front);
    const b = new THREE.Mesh(this.geometry, back);
    f.castShadow = b.castShadow = true;
    this.centre.add(f, b);
    this.root.add(this.centre);
    this.scene.add(this.root);

    // A phone lying face up with its screen off.
    const PW = 0.715;
    const PH = 1.47;
    const PD = 0.078;
    const body = new THREE.Mesh(
      new RoundedBoxGeometry(PW, PH, PD, 6, 0.1),
      new THREE.MeshStandardMaterial({ color: "#55534f", roughness: 0.4, metalness: 0.5 }),
    );
    body.castShadow = true;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(PW - 0.05, PH - 0.05),
      new THREE.MeshStandardMaterial({ map: screenTexture(), roughness: 0.18 }),
    );
    screen.position.z = PD / 2 + 0.0015;
    this.phone.add(body, screen);
    this.phone.position.z = DESK_Z + PD / 2;
    this.scene.add(this.phone);
  }

  set(s: StageState): void {
    this.folds = s.folds;
    const pos = this.geometry.attributes.position as THREE.BufferAttribute;
    foldVertices(this.flat, pos.array as Float32Array, s.folds);
    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    const [cx, cy] = footprintCentre(pos.array as Float32Array);
    this.centre.position.set(-cx, -cy, 0);
    const p = s.sheet;
    this.root.position.set(p.x, p.y, DESK_Z + 0.03 + p.z);
    this.root.scale.setScalar(p.s);
    this.root.rotation.set(p.rx, p.ry, p.rz);
    this.phone.position.x = s.phone.x;
    this.phone.position.y = s.phone.y;
    this.phone.rotation.z = s.phone.rz;
    this.phone.scale.setScalar(s.phone.s);
    this.phone.position.z = DESK_Z + (0.078 / 2) * s.phone.s;
    this.renderer.domElement.style.visibility = s.visible ? "visible" : "hidden";
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Where a point on the printed sheet (mm from its top-left) lands on screen, in px. */
  project(xmm: number, ymm: number): { x: number; y: number } {
    const flat = new Float32Array([xmm / 100 - SHEET_W / 2, SHEET_H / 2 - ymm / 100]);
    const out = new Float32Array(3);
    foldVertices(flat, out, this.folds);
    this.root.updateMatrixWorld(true);
    const v = new THREE.Vector3(out[0], out[1], out[2]).applyMatrix4(this.centre.matrixWorld);
    v.project(this.camera);
    return { x: ((v.x + 1) / 2) * this.w, y: ((1 - v.y) / 2) * this.h };
  }

  /** World units per screen pixel on the desk plane. */
  get unitsPerPx(): number {
    return (2 * Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180) * (CAMERA_Z - DESK_Z)) / this.h;
  }
}

/** A phone screen that's off: near-black glass with one soft reflection, drawn in code. */
function screenTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 128, 256);
  grad.addColorStop(0, "#34343a");
  grad.addColorStop(0.42, "#17171a");
  grad.addColorStop(1, "#0d0d0f");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  // One broad diagonal reflection off the glass, and the camera cutout.
  g.fillStyle = "rgba(255,255,255,0.05)";
  g.beginPath();
  g.moveTo(0, 150);
  g.lineTo(128, 40);
  g.lineTo(128, 110);
  g.lineTo(0, 220);
  g.fill();
  g.fillStyle = "#050506";
  g.beginPath();
  g.roundRect(46, 8, 36, 10, 5);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
