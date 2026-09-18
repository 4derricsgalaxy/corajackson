"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, useTexture } from "@react-three/drei";
import { Component, Suspense, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { SceneNode } from "./types";

interface SceneProps {
  nodes: SceneNode[];
  selectedId: string | null;
  focusLine: number | null;
  onSelect: (id: string | null) => void;
  dark: boolean;
}

const TRUNK_TOP = 3.4;

export function FamilyTreeScene(props: SceneProps) {
  useMemo(() => {
    for (const n of props.nodes) if (n.generation <= 1 && n.portrait) useTexture.preload(n.portrait.url);
  }, [props.nodes]);
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 12, 32], fov: 42, near: 0.1, far: 200 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
      onPointerMissed={() => props.onSelect(null)}
    >
      <fog attach="fog" args={[props.dark ? "#14130f" : "#f4ecdc", 40, 90]} />
      <ambientLight intensity={props.dark ? 0.35 : 0.7} />
      <directionalLight position={[8, 16, 6]} intensity={props.dark ? 1.2 : 1.6} color={props.dark ? "#ffd9a0" : "#fff4dc"} castShadow />
      <pointLight position={[-10, 6, -8]} intensity={props.dark ? 0.8 : 0.4} color="#c39a4a" />
      <Suspense fallback={null}>
        <Ground dark={props.dark} />
        <Trunk />
        <Branches nodes={props.nodes} focusLine={props.focusLine} selectedId={props.selectedId} />
        {props.nodes.map((n) => (
          <PersonNode key={n.id} node={n} selected={props.selectedId === n.id} dimmed={props.focusLine !== null && n.lineIndex !== props.focusLine && n.generation !== 0} onSelect={props.onSelect} dark={props.dark} />
        ))}
        <Motes count={220} dark={props.dark} />
      </Suspense>
      <CameraRig nodes={props.nodes} selectedId={props.selectedId} />
    </Canvas>
  );
}

/* ---------- camera ---------- */

function CameraRig({ nodes, selectedId }: { nodes: SceneNode[]; selectedId: string | null }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const target = useMemo(() => {
    const n = nodes.find((x) => x.id === selectedId);
    return n ? new THREE.Vector3(...n.position).add(new THREE.Vector3(0, n.generation === 1 ? 1.2 : 0.6, 0)) : new THREE.Vector3(0, 5.5, 0);
  }, [nodes, selectedId]);
  const camGoal = useMemo(() => {
    const n = nodes.find((x) => x.id === selectedId);
    if (!n) return null;
    const p = new THREE.Vector3(...n.position);
    const dir = p.clone().setY(0).normalize();
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    // Children grow outward from the trunk, so stand well outside the branch and look back in.
    const radial = p.clone().setY(0).length();
    const standoff = n.generation === 1 ? 13 : n.generation === 2 ? 9 : 6;
    return dir.multiplyScalar(radial + standoff).setY(p.y + (n.generation === 1 ? 5 : 3));
  }, [nodes, selectedId]);
  const { camera } = useThree();
  const [interacted, setInteracted] = useState(false);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const k = 1 - Math.pow(0.001, dt); // smooth exponential ease
    c.target.lerp(target, k * 0.6);
    if (camGoal) camera.position.lerp(camGoal, k * 0.45);
    c.update();
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      minDistance={5}
      maxDistance={55}
      minPolarAngle={0.4}
      maxPolarAngle={Math.PI / 2 - 0.05}
      autoRotate={!interacted && !selectedId}
      autoRotateSpeed={0.35}
      onStart={() => setInteracted(true)}
      enableDamping
      dampingFactor={0.08}
    />
  );
}

/* ---------- geometry ---------- */

function Ground({ dark }: { dark: boolean }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[34, 96]} />
        <meshStandardMaterial color={dark ? "#1b1a14" : "#e6dac0"} roughness={1} />
      </mesh>
      {/* ring of light like a well-worn path around the tree */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[2.4, 2.55, 128]} />
        <meshBasicMaterial color="#c39a4a" transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

function Trunk() {
  const geom = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const y = t * TRUNK_TOP;
      const flare = Math.pow(1 - t, 2.2) * 0.9;
      const r = 0.42 + flare + Math.sin(t * 9) * 0.03;
      pts.push(new THREE.Vector2(r, y));
    }
    return new THREE.LatheGeometry(pts, 40);
  }, []);
  return (
    <group>
      <mesh geometry={geom} castShadow>
        <meshStandardMaterial color="#5a3d2a" roughness={0.95} metalness={0} />
      </mesh>
      {/* roots */}
      {Array.from({ length: 7 }).map((_, i) => {
        const a = (i / 7) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.1, 0.12, Math.sin(a) * 1.1]} rotation={[Math.PI / 2 + 0.25, 0, -a]} castShadow>
            <capsuleGeometry args={[0.14, 1.4, 4, 8]} />
            <meshStandardMaterial color="#4b3223" roughness={1} />
          </mesh>
        );
      })}
    </group>
  );
}

function Branches({ nodes, focusLine, selectedId }: { nodes: SceneNode[]; focusLine: number | null; selectedId: string | null }) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const selectedPath = useMemo(() => {
    const set = new Set<string>();
    let cur = selectedId ? byId.get(selectedId) : undefined;
    while (cur) { set.add(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
    return set;
  }, [byId, selectedId]);

  const tubes = useMemo(() => {
    return nodes
      .filter((n) => n.parentId)
      .map((n) => {
        const parent = byId.get(n.parentId!);
        const start = parent && parent.generation > 0 ? new THREE.Vector3(...parent.position) : new THREE.Vector3(0, TRUNK_TOP - 0.2, 0);
        const end = new THREE.Vector3(...n.position);
        const mid = start.clone().lerp(end, 0.5);
        mid.y += 0.9 + n.generation * 0.15;
        const bulge = end.clone().setY(0).normalize().multiplyScalar(0.6);
        mid.add(bulge);
        const curve = new THREE.CatmullRomCurve3([start, mid, end]);
        const radius = n.generation === 1 ? 0.16 : n.generation === 2 ? 0.07 : 0.04;
        return { id: n.id, geom: new THREE.TubeGeometry(curve, 18, radius, 8, false), node: n };
      });
  }, [nodes, byId]);

  return (
    <group>
      {tubes.map(({ id, geom, node }) => {
        const dim = focusLine !== null && node.lineIndex !== focusLine;
        const lit = selectedPath.has(id);
        return (
          <mesh key={id} geometry={geom} castShadow>
            <meshStandardMaterial
              color={lit ? node.color : node.generation === 1 ? "#6b4a35" : "#7d5a42"}
              emissive={lit ? node.color : "#000000"}
              emissiveIntensity={lit ? 0.55 : 0}
              roughness={0.9}
              transparent
              opacity={dim ? 0.12 : 1}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/* ---------- people ---------- */

function PersonNode({ node, selected, dimmed, onSelect, dark }: { node: SceneNode; selected: boolean; dimmed: boolean; onSelect: (id: string) => void; dark: boolean }) {
  const [hover, setHover] = useState(false);
  const group = useRef<THREE.Group>(null);
  const isRoot = node.generation === 0;
  const isLine = node.generation === 1;
  const size = isRoot ? 1.15 : isLine ? 0.72 : node.generation === 2 ? 0.27 : 0.16;
  const showPortrait = (isRoot || isLine) && Boolean(node.portrait);
  const pos: [number, number, number] = isRoot ? [0, TRUNK_TOP + 1.4, 0] : node.position;

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const sway = isRoot ? 0 : Math.sin(t * 0.9 + node.position[0] * 1.7 + node.position[2]) * (0.05 + node.generation * 0.03);
    group.current.position.set(pos[0], pos[1] + sway, pos[2]);
    const target = selected ? 1.25 : hover ? 1.12 : 1;
    group.current.scale.lerp(new THREE.Vector3(target, target, target), 0.12);
  });

  return (
    <group ref={group} position={pos}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ""; }}
        onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
      >
        {showPortrait ? (
          <Suspense fallback={<Leaf color={node.color} size={size} dim={dimmed} />}>
            <TextureErrorBoundary fallback={<Leaf color={node.color} size={size} dim={dimmed} />}>
              <Portrait url={node.portrait!.url} size={size} color={node.color} dim={dimmed} selected={selected || hover} />
            </TextureErrorBoundary>
          </Suspense>
        ) : (
          <Leaf color={node.color} size={size} dim={dimmed} glow={selected || hover} />
        )}
      </mesh>
      {(hover || selected || isRoot || isLine) && !dimmed && (
        <Html center distanceFactor={14} position={[0, isRoot ? size + 0.55 : -size - 0.35, 0]} style={{ pointerEvents: "none" }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: isRoot ? 26 : isLine ? 20 : 15,
              color: dark ? "#f0e7d3" : "#1c1a15",
              whiteSpace: "nowrap",
              textShadow: dark ? "0 1px 8px rgba(0,0,0,0.9)" : "0 1px 8px rgba(244,236,220,0.9)",
              opacity: hover || selected || isRoot || isLine ? 1 : 0,
              transition: "opacity .3s",
              textAlign: "center",
            }}
          >
            {isLine ? node.nickname ?? node.title.split(" ")[0] : node.title}
            {(hover || selected) && node.childCount > 0 && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.7 }}>
                {node.childCount} {node.childCount === 1 ? "child" : "children"}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

function Leaf({ color, size, dim, glow }: { color: string; size: number; dim: boolean; glow?: boolean }) {
  return (
    <>
      <sphereGeometry args={[size, 24, 24]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow ? 0.9 : 0.25} roughness={0.5} transparent opacity={dim ? 0.15 : 1} />
    </>
  );
}

function Portrait({ url, size, color, dim, selected }: { url: string; size: number; color: string; dim: boolean; selected: boolean }) {
  const tex = useTexture(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; });
  return (
    <group>
      {/* gold ring */}
      <mesh>
        <torusGeometry args={[size, size * 0.06, 12, 64]} />
        <meshStandardMaterial color={selected ? "#e2c27a" : color} emissive={selected ? "#e2c27a" : color} emissiveIntensity={selected ? 0.8 : 0.3} metalness={0.7} roughness={0.3} transparent opacity={dim ? 0.15 : 1} />
      </mesh>
      {/* billboarded portrait disc */}
      <Billboard>
        <mesh>
          <circleGeometry args={[size * 0.94, 48]} />
          <meshBasicMaterial map={tex} transparent opacity={dim ? 0.15 : 1} toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  );
}

function Billboard({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => { ref.current?.quaternion.copy(camera.quaternion); });
  return <group ref={ref}>{children}</group>;
}

class TextureErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Motes({ count, dark }: { count: number; dark: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const rand = mulberry32(1955); // deterministic so renders are stable
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 4 + rand() * 16;
      const a = rand() * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = 1 + rand() * 12;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    return arr;
  }, [count]);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.02;
    const pos = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      const y = pos.getY(i) + Math.sin(state.clock.elapsedTime * 0.6 + i) * 0.0025;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.08} color={dark ? "#e2c27a" : "#c39a4a"} transparent opacity={dark ? 0.7 : 0.45} sizeAttenuation />
    </points>
  );
}
