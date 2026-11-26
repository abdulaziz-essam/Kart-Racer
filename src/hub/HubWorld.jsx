import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useTexture, PointerLockControls } from '@react-three/drei'
import { makeKenneyKart } from '../game/kenneyModel'
import { KENNEY_MODELS, kenneyUrl } from '../game/constants'
import { CARS, PAINTS, UPGRADES, useProfile, buyOrSelectCar, buyOrSelectPaint, buyUpgrade } from '../game/profile'
import { setPrompt, setLocked, toast } from './hubStore'

// First-person paddock between races. North: car showroom on turntables.
// West: paint booth. East: upgrade workshop. South: the Race Gate.
// WASD to walk, mouse to look (click to capture the mouse), E to buy/select.

const EYE = 1.7
const WALK = 6, RUN = 10
const PLAZA_R = 44
const SPAWN = new THREE.Vector3(0, EYE, 6)
const SHOWROOM = CARS.map((c, i) => ({ car: c, x: (i - 2) * 9, z: -20 }))
const PAINT_SPOTS = PAINTS.map((p, i) => ({ paint: p, x: -22, z: -9 + i * 3 }))
const MACHINES = UPGRADES.map((u, i) => ({ up: u, x: 22, z: -6 + i * 7 }))
const GATE = { x: 0, z: 30, halfWidth: 7 }

/* ---------- canvas signs ---------- */
function signTexture(lines, { bg = '#fffdf6', w = 512, h = 256 } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#2b2a33'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10)
  let y = 18
  for (const { text, size = 44, color = '#2b2a33', bold } of lines) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px 'Trebuchet MS', sans-serif`
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    ctx.fillText(text, w / 2, y); y += size * 1.18
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4
  return texture
}

function Sign({ lines, position, rotationY = 0, width = 4, height = 2, bg }) {
  const texture = useMemo(() => signTexture(lines, { bg }), [JSON.stringify(lines), bg]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh castShadow>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={texture} roughness={0.7} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (width / 2 - 0.2), -height / 2 - 0.9, -0.02]}>
          <cylinderGeometry args={[0.07, 0.07, 1.8, 6]} />
          <meshStandardMaterial color="#555" />
        </mesh>
      ))}
    </group>
  )
}

const stars = (v) => '★'.repeat(Math.max(1, Math.min(5, Math.round((v - 0.88) * 25)))).padEnd(5, '☆')

/* ---------- showroom: every car on a turntable ---------- */
function Showroom({ profile }) {
  const models = useGLTF(KENNEY_MODELS.map(kenneyUrl))
  const palette = useTexture('/models/kenney/Textures/variation-b.png', (t) => {
    t.flipY = false; t.colorSpace = THREE.SRGBColorSpace
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true
  })
  const paint = PAINTS.find((p) => p.id === profile.paint)?.color
  const karts = useMemo(() => SHOWROOM.map(({ car }) => {
    const owned = profile.cars.includes(car.id)
    return makeKenneyKart(models[KENNEY_MODELS.indexOf(car.id)].scene, palette, owned ? paint : '#a9adb5')
  }), [models, palette, paint, profile.cars])
  const spin = useRef([])
  useFrame((_, dt) => spin.current.forEach((g, i) => { if (g) g.rotation.y += dt * (0.35 + i * 0.03) }))
  return (
    <group>
      {/* pavilion */}
      <mesh position={[0, 7, -24]} castShadow receiveShadow>
        <boxGeometry args={[52, 0.5, 14]} />
        <meshStandardMaterial color="#f4f4f4" roughness={0.5} />
      </mesh>
      {[-25, -8.5, 8.5, 25].map((x) => (
        <mesh key={x} position={[x, 3.5, -30]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 7, 10]} />
          <meshStandardMaterial color="#e3261c" />
        </mesh>
      ))}
      <mesh position={[0, 3.5, -31]} receiveShadow>
        <boxGeometry args={[52, 7, 0.4]} />
        <meshStandardMaterial color="#2f7bff" roughness={0.6} />
      </mesh>
      <Sign position={[0, 9.2, -24]} width={14} height={2.6} lines={[{ text: 'SHOWROOM', size: 96, bold: true, color: '#e3261c' }]} bg="#ffd21f" />
      {SHOWROOM.map(({ car, x, z }, i) => {
        const owned = profile.cars.includes(car.id), selected = profile.car === car.id
        return (
          <group key={car.id} position={[x, 0, z]}>
            <mesh position={[0, 0.25, 0]} receiveShadow castShadow>
              <cylinderGeometry args={[3, 3.2, 0.5, 32]} />
              <meshStandardMaterial color={selected ? '#ffd21f' : owned ? '#dfe6ee' : '#9aa0a8'} roughness={0.4} />
            </mesh>
            <group position={[0, 0.5, 0]} ref={(g) => (spin.current[i] = g)}>
              <primitive object={karts[i].root} />
            </group>
            <Sign position={[0, 3.6, 3.6]} width={3.6} height={1.8} lines={[
              { text: car.name, size: 54, bold: true },
              { text: selected ? '✔ DRIVING' : owned ? 'OWNED · E to drive' : `🔒 ${car.price} coins`, size: 36, color: selected ? '#1fae4b' : owned ? '#2f7bff' : '#e3261c' },
              { text: `Speed ${stars(car.speed)}  Grip ${stars(car.grip)}`, size: 26 },
              { text: car.blurb, size: 26 },
            ]} />
          </group>
        )
      })}
    </group>
  )
}

/* ---------- paint booth ---------- */
function PaintBooth({ profile }) {
  return (
    <group>
      <Sign position={[-26, 4.5, 1.5]} rotationY={Math.PI / 2} width={8} height={2} lines={[{ text: 'PAINT SHOP', size: 90, bold: true, color: '#8a35e0' }]} bg="#ffe9f6" />
      {PAINT_SPOTS.map(({ paint, x, z }) => {
        const owned = profile.paints.includes(paint.id), on = profile.paint === paint.id
        return (
          <group key={paint.id} position={[x, 0, z]}>
            <mesh position={[0, 0.5, 0]} castShadow>
              <cylinderGeometry args={[0.7, 0.7, 1, 20]} />
              <meshStandardMaterial color={paint.color} roughness={0.35} />
            </mesh>
            <mesh position={[0, 1.04, 0]}>
              <cylinderGeometry args={[0.72, 0.72, 0.08, 20]} />
              <meshStandardMaterial color={on ? '#ffd21f' : '#c9c9c9'} metalness={0.5} roughness={0.3} />
            </mesh>
            <Sign position={[0.9, 2.2, 0]} rotationY={Math.PI / 2} width={1.6} height={0.7} lines={[
              { text: on ? '✔ ON' : owned ? 'OWNED' : `${paint.price} c`, size: 80, bold: true, color: on ? '#1fae4b' : owned ? '#2f7bff' : '#e3261c' },
            ]} />
          </group>
        )
      })}
    </group>
  )
}

/* ---------- upgrade workshop ---------- */
function Workshop({ profile }) {
  return (
    <group>
      <Sign position={[26, 4.5, 1]} rotationY={-Math.PI / 2} width={8} height={2} lines={[{ text: 'UPGRADES', size: 96, bold: true, color: '#ff6a00' }]} bg="#fff1dc" />
      {MACHINES.map(({ up, x, z }) => {
        const level = profile.upgrades[up.id], maxed = level >= up.costs.length
        return (
          <group key={up.id} position={[x, 0, z]}>
            <mesh position={[0, 1, 0]} castShadow receiveShadow>
              <boxGeometry args={[2.2, 2, 2.2]} />
              <meshStandardMaterial color="#3b3e47" roughness={0.5} metalness={0.3} />
            </mesh>
            {[0, 1, 2].map((k) => (
              <mesh key={k} position={[-1.12, 0.6 + k * 0.5, 0]}>
                <boxGeometry args={[0.06, 0.35, 1.5]} />
                <meshStandardMaterial color={k < level ? '#26c26b' : '#666'} emissive={k < level ? '#26c26b' : '#000'} emissiveIntensity={k < level ? 0.6 : 0} />
              </mesh>
            ))}
            <Sign position={[-1.3, 3.3, 0]} rotationY={-Math.PI / 2} width={3} height={1.5} lines={[
              { text: up.name, size: 60, bold: true },
              { text: `Level ${level}/3 · ${up.label}`, size: 30 },
              { text: maxed ? 'MAXED' : `E: upgrade ${up.costs[level]} coins`, size: 34, color: maxed ? '#1fae4b' : '#e3261c', bold: true },
            ]} />
          </group>
        )
      })}
    </group>
  )
}

/* ---------- race gate + surroundings ---------- */
function Surroundings({ raceLabel }) {
  const arch = useMemo(() => new THREE.TorusGeometry(GATE.halfWidth, 0.9, 14, 40, Math.PI), [])
  const trees = useMemo(() => {
    const out = []
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2, r = PLAZA_R + 8 + ((i * 37) % 17)
      out.push([Math.cos(a) * r, Math.sin(a) * r, 0.8 + ((i * 13) % 7) / 10])
    }
    return out
  }, [])
  return (
    <group>
      {/* grass + plaza */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#5d9b3f" roughness={0.95} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} receiveShadow>
        <circleGeometry args={[PLAZA_R, 64]} />
        <meshStandardMaterial color="#3c3f49" roughness={0.85} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
        <ringGeometry args={[PLAZA_R - 1.2, PLAZA_R, 64]} />
        <meshStandardMaterial color="#e3261c" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
        <ringGeometry args={[11, 11.6, 48]} />
        <meshStandardMaterial color="#f2f2ee" />
      </mesh>
      {/* painted arrow to the gate */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.035, 18]}>
        <circleGeometry args={[2.2, 3]} />
        <meshStandardMaterial color="#ffd21f" />
      </mesh>
      {/* race gate */}
      <group position={[GATE.x, 0, GATE.z]}>
        <mesh geometry={arch} castShadow>
          <meshStandardMaterial color="#ff4b3a" roughness={0.5} />
        </mesh>
        <Sign position={[0, 9.4, 0]} rotationY={Math.PI} width={10} height={2.4} lines={[
          { text: 'RACE GATE', size: 84, bold: true, color: '#e3261c' },
          { text: raceLabel, size: 40 },
        ]} bg="#ffd21f" />
      </group>
      {/* trees around the plaza */}
      {trees.map(([x, z, s], i) => (
        <group key={i} position={[x, 0, z]} scale={s}>
          <mesh position={[0, 1.6, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.4, 3.2, 7]} />
            <meshStandardMaterial color="#7a4a26" />
          </mesh>
          <mesh position={[0, 4.6, 0]} castShadow>
            <sphereGeometry args={[2.3, 14, 10]} />
            <meshStandardMaterial color={i % 3 ? '#4f9134' : '#5fa046'} roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ---------- player: walking, collisions, interaction ---------- */
const solids = [
  ...SHOWROOM.map(({ x, z }) => ({ x, z, r: 3.6 })),
  ...PAINT_SPOTS.map(({ x, z }) => ({ x, z, r: 1.1 })),
  ...MACHINES.map(({ x, z }) => ({ x, z, r: 1.9 })),
  { x: GATE.x - GATE.halfWidth, z: GATE.z, r: 1.2 }, { x: GATE.x + GATE.halfWidth, z: GATE.z, r: 1.2 },
]
const targets = [
  ...SHOWROOM.map((s) => ({ ...s, kind: 'car', reach: 6.5 })),
  ...PAINT_SPOTS.map((s) => ({ ...s, kind: 'paint', reach: 3.2 })),
  ...MACHINES.map((s) => ({ ...s, kind: 'upgrade', reach: 4.2 })),
]

function Walker({ onRaceGate, profile }) {
  const camera = useThree((s) => s.camera)
  const keys = useRef({})
  const current = useRef(null)
  const profileRef = useRef(profile)
  profileRef.current = profile
  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), look = new THREE.Vector3()

  useEffect(() => {
    camera.position.copy(SPAWN)
    camera.rotation.set(0, 0, 0)
    camera.fov = 70; camera.updateProjectionMatrix()
    camera.lookAt(0, EYE, -20)
    if (import.meta.env.DEV) window.__hubCamera = camera // lets tests place the walker
    const down = (e) => {
      keys.current[e.code] = true
      if (e.code === 'KeyE' && current.current) act(current.current)
    }
    const up = (e) => { keys.current[e.code] = false }
    const blur = () => { keys.current = {} }
    const lockChange = () => setLocked(!!document.pointerLockElement)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    document.addEventListener('pointerlockchange', lockChange)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      document.removeEventListener('pointerlockchange', lockChange)
      if (document.pointerLockElement) document.exitPointerLock()
      setPrompt(null); setLocked(false)
    }
  }, [camera]) // eslint-disable-line react-hooks/exhaustive-deps

  function act(t) {
    const res = t.kind === 'car' ? buyOrSelectCar(t.car.id) : t.kind === 'paint' ? buyOrSelectPaint(t.paint.id) : buyUpgrade(t.up.id)
    toast(res.message, res.ok)
  }

  function promptFor(t, p) {
    if (t.kind === 'car') {
      if (p.car === t.car.id) return `${t.car.name}: you're driving this one`
      return p.cars.includes(t.car.id) ? `E: drive the ${t.car.name}` : `E: buy the ${t.car.name} for ${t.car.price} coins`
    }
    if (t.kind === 'paint') {
      if (p.paint === t.paint.id) return `${t.paint.id} paint is on your car`
      return p.paints.includes(t.paint.id) ? `E: use ${t.paint.id} paint` : `E: buy ${t.paint.id} paint for ${t.paint.price} coins`
    }
    const level = p.upgrades[t.up.id]
    return level >= 3 ? `${t.up.name} is maxed out` : `E: upgrade ${t.up.name} to level ${level + 1} for ${t.up.costs[level]} coins (${t.up.label})`
  }

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const k = keys.current
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize()
    right.crossVectors(fwd, camera.up).normalize()
    const speed = (k.ShiftLeft || k.ShiftRight ? RUN : WALK) * dt
    const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0)
    const s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0)
    if (f || s) {
      const len = Math.hypot(f, s)
      camera.position.addScaledVector(fwd, (f / len) * speed).addScaledVector(right, (s / len) * speed)
    }
    // bump into displays and stay on the plaza (the gate is the way out)
    for (const o of solids) {
      const dx = camera.position.x - o.x, dz = camera.position.z - o.z, d = Math.hypot(dx, dz)
      if (d < o.r && d > 1e-4) { camera.position.x = o.x + (dx / d) * o.r; camera.position.z = o.z + (dz / d) * o.r }
    }
    const r = Math.hypot(camera.position.x, camera.position.z)
    if (r > PLAZA_R - 1.5) camera.position.multiplyScalar((PLAZA_R - 1.5) / r)
    camera.position.y = EYE + (f || s ? Math.sin(performance.now() / 110) * 0.04 : 0)

    // walking through the gate starts the race
    if (Math.abs(camera.position.x - GATE.x) < GATE.halfWidth - 1 && Math.abs(camera.position.z - GATE.z) < 1.2) { onRaceGate(); return }

    // what are we looking at? nearest target in reach and roughly in front
    camera.getWorldDirection(look)
    let best = null, bestScore = Infinity
    for (const t of targets) {
      const dx = t.x - camera.position.x, dz = t.z - camera.position.z, d = Math.hypot(dx, dz)
      if (d > t.reach) continue
      const facing = (dx * look.x + dz * look.z) / (d || 1)
      if (facing < 0.55) continue
      const score = d * (2 - facing)
      if (score < bestScore) { bestScore = score; best = t }
    }
    if (current.current !== best) current.current = best
    if (!best) {
      const dGate = Math.hypot(camera.position.x - GATE.x, camera.position.z - GATE.z)
      setPrompt(dGate < 14 ? 'Walk through the gate to race!' : null)
    } else setPrompt(promptFor(best, profileRef.current))
  })

  return <PointerLockControls selector="#hub-lock" />
}

export default function HubWorld({ onRaceGate, raceLabel }) {
  const profile = useProfile()
  return (
    <group>
      <directionalLight position={[40, 70, 30]} intensity={3.2} color="#fff1d6" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03}
        shadow-camera-left={-60} shadow-camera-right={60} shadow-camera-top={60} shadow-camera-bottom={-60}
        shadow-camera-near={1} shadow-camera-far={200} />
      <Surroundings raceLabel={raceLabel} />
      <Showroom profile={profile} />
      <PaintBooth profile={profile} />
      <Workshop profile={profile} />
      <Walker onRaceGate={onRaceGate} profile={profile} />
    </group>
  )
}
