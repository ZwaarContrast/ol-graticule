/**
 * GLSL sources and vertex-attribute layouts for the WebGL graticule: lines,
 * lens swell and dots, label quads, and edge-label leaders.
 */

export const LINE_STRIDE = 6;
export const LINE_ATTRIBUTES = [
  { name: 'a_position', size: 2 },
  { name: 'a_dir', size: 2 },
  { name: 'a_side', size: 1 },
  { name: 'a_dist', size: 1 },
];
const FEATHER_PX = 0.75;
export const MAX_DASH = 16;

export const LINE_VERTEX_SHADER = `
  precision highp float;
  attribute vec2 a_position;
  attribute vec2 a_dir;
  attribute float a_side;
  attribute float a_dist;
  uniform mat4 u_projectionMatrix;
  uniform vec2 u_viewportSizePx;
  uniform float u_width;
  uniform float u_resolution;
  varying float v_edge;
  varying float v_halfW;
  varying float v_along;
  void main() {
    vec4 base = u_projectionMatrix * vec4(a_position, 0.0, 1.0);
    vec2 ndc = base.xy / base.w;
    vec2 dirPx = (u_projectionMatrix * vec4(a_dir, 0.0, 0.0)).xy * u_viewportSizePx;
    float len = length(dirPx);
    vec2 dir = len > 0.0 ? dirPx / len : vec2(1.0, 0.0);
    vec2 normal = vec2(-dir.y, dir.x);
    float halfW = u_width * 0.5;
    float ext = halfW + ${FEATHER_PX.toFixed(2)};
    vec2 offsetPx = normal * a_side * ext;
    gl_Position = vec4(ndc + offsetPx * 2.0 / u_viewportSizePx, 0.0, 1.0);
    v_edge = a_side * ext;
    v_halfW = halfW;
    v_along = a_dist / u_resolution;
  }
`;

export const LINE_FRAGMENT_SHADER = `
  precision highp float;
  uniform vec4 u_color;
  uniform float u_dash[${MAX_DASH}];
  uniform float u_dashCount;
  uniform float u_dashPeriod;
  uniform float u_dashOffset;
  varying float v_edge;
  varying float v_halfW;
  varying float v_along;
  void main() {
    float cov = clamp(v_halfW - abs(v_edge) + 0.5, 0.0, 1.0);
    if (u_dashCount > 0.0) {
      float t = mod(v_along + u_dashOffset, u_dashPeriod);
      float acc = 0.0;
      float signed_dist = -0.5;
      for (int k = 0; k < ${MAX_DASH}; k++) {
        if (float(k) >= u_dashCount) break;
        float next = acc + u_dash[k];
        if (t >= acc && t < next) {
          float edge = min(t - acc, next - t);
          signed_dist = mod(float(k), 2.0) < 0.5 ? edge : -edge;
          break;
        }
        acc = next;
      }
      cov *= clamp(signed_dist + 0.5, 0.0, 1.0);
    }
    float a = u_color.a * cov;
    gl_FragColor = vec4(u_color.rgb * a, a);
  }
`;

/** Screen px to y-flipped clip space, shared by the four screen-space passes. */
const SCREEN_TO_CLIP = `
    vec2 clip = a_position / u_viewportSizePx * 2.0 - 1.0;
    gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);`;

export const MAX_HOLES = 8;
const SWELL_ALPHA = 0.88;
export const DOT_GLOW_PX = 2.4;
export const DOT_ALPHA = 0.55;

export const SWELL_ATTRIBUTES = [
  { name: 'a_position', size: 2 },
  { name: 'a_seg', size: 4 },
];
export const DOT_ATTRIBUTES = [
  { name: 'a_position', size: 2 },
  { name: 'a_center', size: 2 },
  { name: 'a_alpha', size: 1 },
];

export const SWELL_VERTEX = `
  precision highp float;
  attribute vec2 a_position;
  attribute vec4 a_seg;
  uniform vec2 u_viewportSizePx;
  varying vec2 v_frag;
  varying vec4 v_seg;
  void main() {
${SCREEN_TO_CLIP}
    v_frag = a_position;
    v_seg = a_seg;
  }
`;

export const SWELL_FRAGMENT = `
  precision highp float;
  uniform vec2 u_cursor;
  uniform float u_radius;
  uniform float u_sigmaSq;
  uniform float u_boost;
  uniform float u_intensity;
  uniform vec4 u_color;
  uniform float u_quantum;
  uniform float u_minWidth;
  uniform float u_holeCount;
  uniform vec3 u_holes[${MAX_HOLES}];
  uniform float u_clearR;
  uniform float u_holeFeather;
  varying vec2 v_frag;
  varying vec4 v_seg;
  void main() {
    vec2 toC = v_frag - u_cursor;
    float distCSq = dot(toC, toC);
    if (distCSq > u_radius * u_radius) discard;

    float width = u_boost * exp(-distCSq / u_sigmaSq);
    float carve = 0.0;
    for (int i = 0; i < ${MAX_HOLES}; i++) {
      if (float(i) >= u_holeCount) break;
      vec3 h = u_holes[i];
      float distI = distance(v_frag, h.xy);
      float shape = 1.0 - smoothstep(u_clearR, u_clearR + u_holeFeather, distI);
      carve = max(carve, h.z * shape);
    }
    width *= (1.0 - carve);
    if (width < u_minWidth) discard;
    width = floor(width / u_quantum + 0.5) * u_quantum;

    vec2 a = v_seg.xy;
    vec2 ab = v_seg.zw - a;
    float len2 = dot(ab, ab);
    float t = len2 > 0.0 ? clamp(dot(v_frag - a, ab) / len2, 0.0, 1.0) : 0.0;
    float dPerp = distance(v_frag, a + ab * t);
    float halfW = width * 0.5;
    float plateau = 0.44 * halfW;
    float cross = dPerp < plateau ? 1.0
      : dPerp > halfW ? 0.0
      : 1.0 - (dPerp - plateau) / (halfW - plateau);

    float ramp = mix(1.0, 0.22, sqrt(distCSq) / u_radius);
    float alpha = cross * ramp * u_intensity * ${SWELL_ALPHA.toFixed(2)};
    gl_FragColor = vec4(u_color.rgb * alpha, alpha);
  }
`;

export const DOT_VERTEX = `
  precision highp float;
  attribute vec2 a_position;
  attribute vec2 a_center;
  attribute float a_alpha;
  uniform vec2 u_viewportSizePx;
  varying vec2 v_frag;
  varying vec2 v_center;
  varying float v_alpha;
  void main() {
${SCREEN_TO_CLIP}
    v_frag = a_position;
    v_center = a_center;
    v_alpha = a_alpha;
  }
`;

export const DOT_FRAGMENT = `
  precision highp float;
  uniform vec4 u_color;
  uniform float u_glowR;
  varying vec2 v_frag;
  varying vec2 v_center;
  varying float v_alpha;
  void main() {
    float d = distance(v_frag, v_center) / u_glowR;
    float g = 1.0 - clamp((d - 0.3) / 0.7, 0.0, 1.0);
    float alpha = g * v_alpha * u_color.a;
    gl_FragColor = vec4(u_color.rgb * alpha, alpha);
  }
`;

export const LABEL_STRIDE = 13;
export const LABEL_ATTRIBUTES = [
  { name: 'a_position', size: 2 },
  { name: 'a_uv', size: 2 },
  { name: 'a_fill', size: 3 },
  { name: 'a_halo', size: 3 },
  { name: 'a_haloAlpha', size: 1 },
  { name: 'a_haloEdge', size: 1 },
  { name: 'a_alpha', size: 1 },
];

export const LABEL_VERTEX_SHADER = `
  precision highp float;
  attribute vec2 a_position;
  attribute vec2 a_uv;
  attribute vec3 a_fill;
  attribute vec3 a_halo;
  attribute float a_haloAlpha;
  attribute float a_haloEdge;
  attribute float a_alpha;
  uniform vec2 u_viewportSizePx;
  varying vec2 v_uv;
  varying vec3 v_fill;
  varying vec3 v_halo;
  varying float v_haloAlpha;
  varying float v_haloEdge;
  varying float v_alpha;
  void main() {
${SCREEN_TO_CLIP}
    v_uv = a_uv;
    v_fill = a_fill;
    v_halo = a_halo;
    v_haloAlpha = a_haloAlpha;
    v_haloEdge = a_haloEdge;
    v_alpha = a_alpha;
  }
`;

export const LABEL_FRAGMENT_SHADER = `
  precision highp float;
  uniform sampler2D u_atlas;
  uniform float u_fillEdge;
  uniform float u_aa;
  varying vec2 v_uv;
  varying vec3 v_fill;
  varying vec3 v_halo;
  varying float v_haloAlpha;
  varying float v_haloEdge;
  varying float v_alpha;
  void main() {
    float d = texture2D(u_atlas, v_uv).r;
    float fA = smoothstep(u_fillEdge - u_aa, u_fillEdge + u_aa, d);
    float hCov = smoothstep(v_haloEdge - u_aa, v_haloEdge + u_aa, d);
    float hA = v_haloAlpha * hCov;
    float outA = fA + hA * (1.0 - fA);
    vec3 rgb = v_fill * fA + v_halo * hA * (1.0 - fA);
    gl_FragColor = vec4(rgb * v_alpha, outA * v_alpha);
  }
`;

export const LEADER_STRIDE = 4;
export const LEADER_ATTRIBUTES = [
  { name: 'a_position', size: 2 },
  { name: 'a_along', size: 1 },
  { name: 'a_edge', size: 1 },
];

export const LEADER_VERTEX_SHADER = `
  precision highp float;
  attribute vec2 a_position;
  attribute float a_along;
  attribute float a_edge;
  uniform vec2 u_viewportSizePx;
  varying float v_along;
  varying float v_edge;
  void main() {
${SCREEN_TO_CLIP}
    v_along = a_along;
    v_edge = a_edge;
  }
`;

export const LEADER_FRAGMENT_SHADER = `
  precision highp float;
  uniform vec4 u_color;
  uniform float u_halfWidth;
  uniform float u_dashOn;
  uniform float u_dashPeriod;
  uniform float u_dashOffset;
  varying float v_along;
  varying float v_edge;
  void main() {
    float cov = clamp(u_halfWidth - abs(v_edge) + 0.5, 0.0, 1.0);
    float dash = 1.0;
    if (u_dashPeriod > 0.0) {
      dash = mod(v_along + u_dashOffset, u_dashPeriod) < u_dashOn ? 1.0 : 0.0;
    }
    float a = cov * dash * u_color.a;
    gl_FragColor = vec4(u_color.rgb * a, a);
  }
`;
