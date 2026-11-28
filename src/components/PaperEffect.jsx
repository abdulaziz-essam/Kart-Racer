import { forwardRef, useMemo } from 'react'
import { Uniform } from 'three'
import { Effect } from 'postprocessing'

// Paper-cutout look, part 2: flat, bright "coloured paper" shading.
// Per-pixel only (no neighbour sampling, no depth), so it is cheap and safe:
//   - shading snapped into a lit tone and a shadow tone (soft step)
//   - a little extra saturation, like construction paper
//   - very light paper fibre grain
const fragmentShader = /* glsl */ `
uniform float strength;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  // two paper tones: full colour in the light, one deeper tone in shadow
  float lit = smoothstep(0.14, 0.24, l);
  vec3 paper = c * mix(1.0, mix(0.78, 1.06, lit), strength);
  // saturate a little, like construction paper
  float pl = dot(paper, vec3(0.299, 0.587, 0.114));
  paper = mix(vec3(pl), paper, 1.0 + 0.22 * strength);
  // paper fibres
  vec2 px = uv * resolution;
  float grain = 1.0 + (vnoise(px * 0.7) - 0.5) * 0.05 * strength;
  outputColor = vec4(clamp(paper * grain, 0.0, 1.0), inputColor.a);
}
`

class PaperEffectImpl extends Effect {
  constructor({ strength = 1 } = {}) {
    super('PaperEffect', fragmentShader, { uniforms: new Map([['strength', new Uniform(strength)]]) })
  }
}

export const PaperEffect = forwardRef(function PaperEffect({ strength = 1 }, ref) {
  const effect = useMemo(() => new PaperEffectImpl({ strength }), []) // eslint-disable-line react-hooks/exhaustive-deps
  effect.uniforms.get('strength').value = strength
  return <primitive ref={ref} object={effect} dispose={null} />
})
