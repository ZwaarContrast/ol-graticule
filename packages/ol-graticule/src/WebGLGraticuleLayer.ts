import Layer from 'ol/layer/Layer';
import VectorSource from 'ol/source/Vector';
import WebGLLayerRenderer from 'ol/renderer/webgl/Layer';
import WebGLArrayBuffer from 'ol/webgl/Buffer';
import LineString from 'ol/geom/LineString';
import { ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER, DYNAMIC_DRAW } from 'ol/webgl';
import { create as createMat4, fromTransform } from 'ol/vec/mat4';
import { create as createTransform, compose as composeTransform, apply as applyTransform } from 'ol/transform';
import type OLMap from 'ol/Map';
import type { FrameState } from 'ol/Map';
import type { Options as LayerOptions } from 'ol/layer/Layer';
import type Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import type { GridSystem } from './types.js';
import { resolveGraticuleOptions, createLabelEngine } from './resolveOptions.js';
import type { GraticuleOptions } from './options.js';
import type {
  GraticuleBlendMode,
  GraticuleHoverLens,
  GraticuleLineStyle,
  ResolvedHoverLens,
} from './style.js';
import {
  resolveHoverLens,
} from './style.js';
import { applyBlend } from './util/blend.js';
import { toRgbaNormalized } from './util/color.js';
import { canonicalizeExtent, visibleWorldOffsets, worldOffsetOf } from './util/worldWrap.js';
import { collectLensHoles, eachSegmentPx } from './rendering/lensGeometry.js';
import { LensPointers } from './rendering/LensPointers.js';
import { GlyphAtlas, type Glyph } from './rendering/GlyphAtlas.js';
import { LabelEngine } from './labels/LabelEngine.js';

import { PlacementSink, type LabelPlacement } from './labels/PlacementSink.js';
import {
  DOT_ALPHA,
  DOT_ATTRIBUTES,
  DOT_FRAGMENT,
  DOT_GLOW_PX,
  DOT_VERTEX,
  LABEL_ATTRIBUTES,
  LABEL_FRAGMENT_SHADER,
  LABEL_STRIDE,
  LABEL_VERTEX_SHADER,
  LEADER_ATTRIBUTES,
  LEADER_FRAGMENT_SHADER,
  LEADER_STRIDE,
  LEADER_VERTEX_SHADER,
  LINE_ATTRIBUTES,
  LINE_FRAGMENT_SHADER,
  LINE_VERTEX_SHADER,
  MAX_HOLES,
  SWELL_ATTRIBUTES,
  SWELL_FRAGMENT,
  SWELL_VERTEX,
} from './rendering/shaders.js';
import {
  appendGeometryFlat,
  resolveBuckets,
  growF32,
  growU32,
  type LineBatch,
  type LineBucket,
} from './rendering/lineBatch.js';

interface WebGLGrid {
  gridSystem: GridSystem | null;
  lineStyle: GraticuleLineStyle | undefined;
  classify: (feature: Feature<Geometry>) => number;
  bucketOffset: number;
  lens: ResolvedHoverLens | null;
  labelEngine: LabelEngine | null;
}

export interface WebGLGraticuleLayerOptions
  extends GraticuleOptions, Omit<LayerOptions<VectorSource>, 'source'> {}

// --- WEBGL GRATICULE LAYER RENDERER -----------------------------------------
class WebGLGraticuleRenderer extends WebGLLayerRenderer<WebGLGraticuleLayer> {
  // Line pass
  private lineProgram_: WebGLProgram | null = null;
  private lineVertBuffer_: WebGLArrayBuffer | null = null;
  private lineIndexBuffer_: WebGLArrayBuffer | null = null;
  private lineBatches_: LineBatch[] | null = null;
  private readonly transform_ = createTransform();
  private readonly mat4_ = createMat4();

  // Lens pass
  private swellProgram_: WebGLProgram | null = null;
  private dotProgram_: WebGLProgram | null = null;
  private swellBuffer_: WebGLArrayBuffer | null = null;
  private swellIndex_: WebGLArrayBuffer | null = null;
  private dotBuffer_: WebGLArrayBuffer | null = null;
  private dotIndex_: WebGLArrayBuffer | null = null;
  private sv_ = new Float32Array(4096);
  private svLen_ = 0;
  private si_ = new Uint32Array(2048);
  private siLen_ = 0;
  private dv_ = new Float32Array(512);
  private dvLen_ = 0;
  private di_ = new Uint32Array(256);
  private diLen_ = 0;
  private readonly holes_ = new Float32Array(MAX_HOLES * 3);
  private holeCount_ = 0;
  private cellPx_ = 0;

  // Text pass
  private labelProgram_: WebGLProgram | null = null;
  private labelVertBuffer_: WebGLArrayBuffer | null = null;
  private labelIndexBuffer_: WebGLArrayBuffer | null = null;
  private texture_: WebGLTexture | null = null;
  private atlas_: GlyphAtlas | null = null;
  private atlasDpr_ = 0;
  private lv_ = new Float32Array(4096);
  private lvLen_ = 0;
  private li_ = new Uint32Array(2048);
  private liLen_ = 0;
  private readonly sink_ = new PlacementSink();

  // Leader pass
  private leaderProgram_: WebGLProgram | null = null;
  private leaderVertBuffer_: WebGLArrayBuffer | null = null;
  private leaderIndexBuffer_: WebGLArrayBuffer | null = null;
  private leadVf_ = new Float32Array(1024);
  private leadVfLen_ = 0;
  private leadIu_ = new Uint32Array(512);
  private leadIuLen_ = 0;
  private readonly leaderColor_: [number, number, number, number] = [0, 0, 0, 1];

  protected override afterHelperCreated(): void {
    const helper = this.helper;
    const gl = helper.getGL();

    this.lineProgram_ = helper.getProgram(LINE_FRAGMENT_SHADER, LINE_VERTEX_SHADER);
    this.lineVertBuffer_ = new WebGLArrayBuffer(ARRAY_BUFFER, DYNAMIC_DRAW);
    this.lineIndexBuffer_ = new WebGLArrayBuffer(ELEMENT_ARRAY_BUFFER, DYNAMIC_DRAW);

    this.swellProgram_ = helper.getProgram(SWELL_FRAGMENT, SWELL_VERTEX);
    this.dotProgram_ = helper.getProgram(DOT_FRAGMENT, DOT_VERTEX);
    this.swellBuffer_ = new WebGLArrayBuffer(ARRAY_BUFFER, DYNAMIC_DRAW);
    this.swellIndex_ = new WebGLArrayBuffer(ELEMENT_ARRAY_BUFFER, DYNAMIC_DRAW);
    this.dotBuffer_ = new WebGLArrayBuffer(ARRAY_BUFFER, DYNAMIC_DRAW);
    this.dotIndex_ = new WebGLArrayBuffer(ELEMENT_ARRAY_BUFFER, DYNAMIC_DRAW);

    this.labelProgram_ = helper.getProgram(LABEL_FRAGMENT_SHADER, LABEL_VERTEX_SHADER);
    this.labelVertBuffer_ = new WebGLArrayBuffer(ARRAY_BUFFER, DYNAMIC_DRAW);
    this.labelIndexBuffer_ = new WebGLArrayBuffer(ELEMENT_ARRAY_BUFFER, DYNAMIC_DRAW);
    this.texture_ = gl.createTexture();

    this.leaderProgram_ = helper.getProgram(LEADER_FRAGMENT_SHADER, LEADER_VERTEX_SHADER);
    this.leaderVertBuffer_ = new WebGLArrayBuffer(ARRAY_BUFFER, DYNAMIC_DRAW);
    this.leaderIndexBuffer_ = new WebGLArrayBuffer(ELEMENT_ARRAY_BUFFER, DYNAMIC_DRAW);

    this.atlas_?.markDirty();
    applyBlend(helper.getCanvas(), this.getLayer().blend);
  }

  protected override prepareFrameInternal(): boolean {
    return true;
  }

  override renderFrame(frameState: FrameState): HTMLElement {
    const gl = this.helper.getGL();
    this.preRender(gl, frameState);

    const layer = this.getLayer();
    const fading = layer.pointers.step();

    this.build_(frameState);
    this.helper.prepareDraw(frameState);

    // Draw in order: lines -> lens glow -> leaders -> text quads
    this.drawLines_(frameState);
    this.drawLens_(frameState);
    this.drawLeaders_(frameState);
    this.drawLabels_(frameState);

    this.helper.finalizeDraw(frameState);
    const canvas = this.helper.getCanvas();
    this.postRender(gl, frameState);

    if (fading) layer.getMapInternal()?.render();
    return canvas;
  }

  private build_(frameState: FrameState): void {
    const layer = this.getLayer();
    const { extent, size } = frameState;
    if (!extent || !size) return;

    const { resolution, projection, center } = frameState.viewState;
    const dpr = frameState.pixelRatio > 0 ? frameState.pixelRatio : 1;
    const ceiling = layer.maxLines * 2;
    const cx = center[0] ?? 0;
    const cy = center[1] ?? 0;
    const canonical = canonicalizeExtent(extent, projection);
    const offsets = visibleWorldOffsets(extent, projection);

    const lineBatches = this.ensureLineBatches_(layer.getBucketList().length);
    for (const b of lineBatches) {
      b.vfLen = 0;
      b.iuLen = 0;
    }

    this.svLen_ = 0;
    this.siLen_ = 0;
    this.dvLen_ = 0;
    this.diLen_ = 0;
    this.holeCount_ = 0;

    this.lvLen_ = 0;
    this.liLen_ = 0;
    this.sink_.begin(frameState.coordinateToPixelTransform);

    if (!this.atlas_ || this.atlasDpr_ !== dpr) {
      this.atlas_?.dispose();
      this.atlas_ = new GlyphAtlas(dpr);
      this.atlasDpr_ = dpr;
    }

    const grids = layer.getGrids();
    for (let gIdx = 0; gIdx < grids.length; gIdx++) {
      const grid = grids[gIdx];
      if (!grid || !grid.gridSystem) continue;

      // Queried once per grid per frame; lines, lens and labels all read this.
      let features = grid.gridSystem.getFeatures(canonical, resolution, projection);
      if (features.length > ceiling) features = features.slice(0, ceiling);

      // 1. Lines
      for (const feature of features) {
        const batch = lineBatches[grid.bucketOffset + grid.classify(feature)];
        if (!batch) continue;
        const geom = feature.getGeometry();
        for (const offset of offsets) {
          appendGeometryFlat(geom, offset, cx, cy, batch);
        }
      }

      // 2. Lens
      if (grid.lens && layer.pointers.count > 0) {
        layer.pointers.forEach((pointer) => {
          this.buildLensForGrid_(frameState, grid.lens!, features, pointer.x, pointer.y, pointer.intensity);
        });
      }

      // 3. Labels
      if (grid.labelEngine) {
        grid.labelEngine.run(frameState, grid.gridSystem, this.sink_, features);
      }
    }

    const count = this.sink_.count;
    const placements = this.sink_.placements;
    for (let i = 0; i < count; i++) {
      const p = placements[i];
      if (p) this.layoutLabel_(p, this.atlas_, dpr);
    }
    this.buildLeaders_();
  }

  private drawLines_(frameState: FrameState): void {
    const size = frameState.size;
    const batches = this.lineBatches_;
    if (!size || !batches || !this.lineProgram_ || !this.lineVertBuffer_ || !this.lineIndexBuffer_) return;

    const { resolution, rotation } = frameState.viewState;
    const w = size[0] ?? 1;
    const h = size[1] ?? 1;
    composeTransform(this.transform_, 0, 0, 2 / (resolution * w), 2 / (resolution * h), -rotation, 0, 0);
    fromTransform(this.mat4_, this.transform_);

    const helper = this.helper;
    const gl = helper.getGL();
    helper.useProgram(this.lineProgram_, frameState);
    helper.setUniformMatrixValue('u_projectionMatrix', this.mat4_);

    const buckets = this.getLayer().getBucketList();
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const bucket = buckets[i];
      if (!batch || !bucket || batch.iuLen === 0) continue;

      this.lineVertBuffer_.setArray(batch.vf.subarray(0, batch.vfLen));
      this.lineIndexBuffer_.setArray(batch.iu.subarray(0, batch.iuLen));
      helper.flushBufferData(this.lineVertBuffer_);
      helper.flushBufferData(this.lineIndexBuffer_);

      helper.bindBuffer(this.lineVertBuffer_);
      helper.enableAttributes(LINE_ATTRIBUTES);
      helper.bindBuffer(this.lineIndexBuffer_);

      helper.setUniformFloatVec4('u_color', bucket.color);
      helper.setUniformFloatValue('u_width', bucket.width);
      helper.setUniformFloatValue('u_dashCount', bucket.dashCount);
      helper.setUniformFloatValue('u_dashPeriod', bucket.dashPeriod);
      helper.setUniformFloatValue('u_dashOffset', bucket.dashOffset);
      if (bucket.dashCount > 0) {
        gl.uniform1fv(helper.getUniformLocation('u_dash[0]'), bucket.dashPattern);
      }

      helper.drawElements(0, batch.iuLen);
    }
  }

  private buildLensForGrid_(
    frameState: FrameState,
    lens: ResolvedHoverLens,
    features: Feature<Geometry>[],
    cx: number,
    cy: number,
    intensity: number,
  ): void {
    const toPixel = frameState.coordinateToPixelTransform;
    const radius = lens.radius;
    const half = lens.boost * 0.5 + 2;

    const cursorMap: [number, number] = [cx, cy];
    applyTransform(frameState.pixelToCoordinateTransform, cursorMap);
    const worldOffset = worldOffsetOf(cursorMap[0], frameState.viewState.projection);

    const { holes, cell } = collectLensHoles(
      features, toPixel, 1, worldOffset, cx, cy, radius, lens.approachFraction, lens.approach, MAX_HOLES,
    );
    this.cellPx_ = cell;
    this.holeCount_ = holes.length;
    for (let i = 0; i < holes.length; i++) {
      const h = holes[i];
      if (!h) continue;
      this.holes_[i * 3] = h.x;
      this.holes_[i * 3 + 1] = h.y;
      this.holes_[i * 3 + 2] = h.strength;
      this.emitDotQuad_(h.x, h.y, h.strength, intensity);
    }

    const scratch: [number, number] = [0, 0];
    for (const feature of features) {
      const geom = feature.getGeometry();
      if (!(geom instanceof LineString)) continue;
      eachSegmentPx(geom, toPixel, 1, worldOffset, scratch, (x0, y0, x1, y1) => {
        if (Math.hypot(cx - (x0 + x1) / 2, cy - (y0 + y1) / 2) > radius + Math.hypot(x1 - x0, y1 - y0) / 2) return;
        this.emitSwellQuad_(x0, y0, x1, y1, half);
      });
    }
  }

  private drawLens_(frameState: FrameState): void {
    const helper = this.helper;
    const gl = helper.getGL();
    const layer = this.getLayer();
    const firstLens = layer.getGrids()[0]?.lens;
    if (!firstLens) return;

    const [cr, cg, cb, ca] = toRgbaNormalized(firstLens.color);

    if (this.siLen_ > 0 && this.swellProgram_ && this.swellBuffer_ && this.swellIndex_) {
      this.swellBuffer_.setArray(this.sv_.subarray(0, this.svLen_));
      this.swellIndex_.setArray(this.si_.subarray(0, this.siLen_));
      helper.flushBufferData(this.swellBuffer_);
      helper.flushBufferData(this.swellIndex_);
      helper.useProgram(this.swellProgram_, frameState);
      helper.bindBuffer(this.swellBuffer_);
      helper.enableAttributes(SWELL_ATTRIBUTES);
      helper.bindBuffer(this.swellIndex_);

      layer.pointers.forEach((pointer) => {
        helper.setUniformFloatVec2('u_cursor', [pointer.x, pointer.y]);
        helper.setUniformFloatValue('u_radius', firstLens.radius);
        helper.setUniformFloatValue('u_sigmaSq', (firstLens.radius / 2.2) * (firstLens.radius / 2.2));
        helper.setUniformFloatValue('u_boost', firstLens.boost * pointer.intensity);
        helper.setUniformFloatValue('u_intensity', pointer.intensity);
        helper.setUniformFloatValue('u_quantum', 0.33);
        helper.setUniformFloatValue('u_minWidth', 0.33);
        helper.setUniformFloatVec4('u_color', [cr, cg, cb, ca]);
        const clearR = this.cellPx_ > 0 ? Math.min(firstLens.clearRadius, this.cellPx_ * 0.42) : firstLens.clearRadius;
        helper.setUniformFloatValue('u_clearR', clearR);
        helper.setUniformFloatValue('u_holeFeather', Math.min(12, clearR * 0.85));
        helper.setUniformFloatValue('u_holeCount', this.holeCount_);
        if (this.holeCount_ > 0) {
          gl.uniform3fv(helper.getUniformLocation('u_holes[0]'), this.holes_.subarray(0, this.holeCount_ * 3));
        }
        helper.drawElements(0, this.siLen_);
      });
    }

    if (this.diLen_ > 0 && this.dotProgram_ && this.dotBuffer_ && this.dotIndex_) {
      this.dotBuffer_.setArray(this.dv_.subarray(0, this.dvLen_));
      this.dotIndex_.setArray(this.di_.subarray(0, this.diLen_));
      helper.flushBufferData(this.dotBuffer_);
      helper.flushBufferData(this.dotIndex_);
      helper.useProgram(this.dotProgram_, frameState);
      helper.bindBuffer(this.dotBuffer_);
      helper.enableAttributes(DOT_ATTRIBUTES);
      helper.bindBuffer(this.dotIndex_);
      helper.setUniformFloatValue('u_glowR', DOT_GLOW_PX);
      helper.setUniformFloatVec4('u_color', [cr, cg, cb, ca]);
      helper.drawElements(0, this.diLen_);
    }
  }

  private drawLeaders_(frameState: FrameState): void {
    const stroke = this.sink_.leaderStroke;
    const program = this.leaderProgram_;
    const vb = this.leaderVertBuffer_;
    const ib = this.leaderIndexBuffer_;
    if (!stroke || this.leadIuLen_ === 0 || !program || !vb || !ib) return;

    vb.setArray(this.leadVf_.subarray(0, this.leadVfLen_));
    ib.setArray(this.leadIu_.subarray(0, this.leadIuLen_));
    this.helper.flushBufferData(vb);
    this.helper.flushBufferData(ib);
    this.helper.useProgram(program, frameState);
    this.helper.bindBuffer(vb);
    this.helper.enableAttributes(LEADER_ATTRIBUTES);
    this.helper.bindBuffer(ib);
    this.leaderColor_[0] = stroke.r;
    this.leaderColor_[1] = stroke.g;
    this.leaderColor_[2] = stroke.b;
    this.leaderColor_[3] = stroke.a;
    this.helper.setUniformFloatVec4('u_color', this.leaderColor_);
    this.helper.setUniformFloatValue('u_halfWidth', stroke.width / 2);
    this.helper.setUniformFloatValue('u_dashOn', stroke.dashOn);
    this.helper.setUniformFloatValue('u_dashPeriod', stroke.dashPeriod);
    this.helper.setUniformFloatValue('u_dashOffset', stroke.dashOffset);
    this.helper.drawElements(0, this.leadIuLen_);
  }

  private drawLabels_(frameState: FrameState): void {
    const atlas = this.atlas_;
    if (this.liLen_ === 0 || !atlas || !this.labelProgram_ || !this.labelVertBuffer_ || !this.labelIndexBuffer_ || !this.texture_) return;

    const gl = this.helper.getGL();
    if (atlas.takeDirty()) {
      uploadTexture(gl, this.texture_, atlas.source);
    }
    this.labelVertBuffer_.setArray(this.lv_.subarray(0, this.lvLen_));
    this.labelIndexBuffer_.setArray(this.li_.subarray(0, this.liLen_));
    this.helper.flushBufferData(this.labelVertBuffer_);
    this.helper.flushBufferData(this.labelIndexBuffer_);

    this.helper.useProgram(this.labelProgram_, frameState);
    this.helper.bindBuffer(this.labelVertBuffer_);
    this.helper.enableAttributes(LABEL_ATTRIBUTES);
    this.helper.bindBuffer(this.labelIndexBuffer_);
    this.helper.bindTexture(this.texture_, 0, 'u_atlas');
    this.helper.setUniformFloatValue('u_fillEdge', atlas.fillEdge);
    this.helper.setUniformFloatValue('u_aa', 0.5 / atlas.radiusPx);
    this.helper.drawElements(0, this.liLen_);
  }

  private layoutLabel_(p: LabelPlacement, atlas: GlyphAtlas, dpr: number): void {
    let totalWidth = 0;
    const glyphs: Glyph[] = [];
    for (const char of p.text) {
      const glyph = atlas.glyph(char, p.font);
      if (!glyph) continue;
      glyphs.push(glyph);
      totalWidth += glyph.advance;
    }
    if (glyphs.length === 0) return;

    const anchorX = p.x + p.offsetX;
    const anchorY = p.y + p.offsetY;
    const alignDx =
      p.align === 'left' || p.align === 'start' ? 0 :
      p.align === 'right' || p.align === 'end' ? -totalWidth :
      -totalWidth / 2;
    const baselineDy = atlas.baselineOffset(p.font, p.baseline);
    const haloEdge = atlas.fillEdge - (p.haloWidth * 0.5 * dpr) / atlas.radiusPx;

    let penX = anchorX + alignDx;
    const baselineY = anchorY + baselineDy;
    const cos = Math.cos(p.rotation);
    const sin = Math.sin(p.rotation);

    for (const glyph of glyphs) {
      if (glyph.cellW > 0) {
        const x0 = penX + glyph.bearingLeft;
        const y0 = baselineY + glyph.bearingTop;
        const x1 = x0 + glyph.cellW;
        const y1 = y0 + glyph.cellH;
        this.emitLabelQuad_(x0, y0, x1, y1, glyph, anchorX, anchorY, cos, sin, p, haloEdge);
      }
      penX += glyph.advance;
    }
  }

  private emitLabelQuad_(
    x0: number, y0: number, x1: number, y1: number,
    glyph: Glyph, cx: number, cy: number, cos: number, sin: number, p: LabelPlacement, haloEdge: number,
  ): void {
    this.ensureLabelCapacity_(4 * LABEL_STRIDE, 6);
    const base = this.lvLen_ / LABEL_STRIDE;
    this.labelVertex_(x0, y0, glyph.u0, glyph.v0, cx, cy, cos, sin, p, haloEdge);
    this.labelVertex_(x1, y0, glyph.u1, glyph.v0, cx, cy, cos, sin, p, haloEdge);
    this.labelVertex_(x0, y1, glyph.u0, glyph.v1, cx, cy, cos, sin, p, haloEdge);
    this.labelVertex_(x1, y1, glyph.u1, glyph.v1, cx, cy, cos, sin, p, haloEdge);
    const iu = this.li_;
    iu[this.liLen_++] = base;
    iu[this.liLen_++] = base + 1;
    iu[this.liLen_++] = base + 2;
    iu[this.liLen_++] = base + 2;
    iu[this.liLen_++] = base + 1;
    iu[this.liLen_++] = base + 3;
  }

  private labelVertex_(
    x: number, y: number, u: number, v: number,
    cx: number, cy: number, cos: number, sin: number, p: LabelPlacement, haloEdge: number,
  ): void {
    const dx = x - cx;
    const dy = y - cy;
    const vf = this.lv_;
    let o = this.lvLen_;
    vf[o++] = cx + dx * cos - dy * sin;
    vf[o++] = cy + dx * sin + dy * cos;
    vf[o++] = u;
    vf[o++] = v;
    vf[o++] = p.fill[0];
    vf[o++] = p.fill[1];
    vf[o++] = p.fill[2];
    vf[o++] = p.halo[0];
    vf[o++] = p.halo[1];
    vf[o++] = p.halo[2];
    vf[o++] = p.haloAlpha;
    vf[o++] = haloEdge;
    vf[o++] = p.opacity;
    this.lvLen_ = o;
  }

  private buildLeaders_(): void {
    this.leadVfLen_ = 0;
    this.leadIuLen_ = 0;
    const seg = this.sink_.leaders;
    const stroke = this.sink_.leaderStroke;
    if (!stroke || seg.length < 4) return;
    const half = stroke.width / 2 + 0.6;
    for (let i = 0; i + 3 < seg.length; i += 4) {
      const x0 = seg[i] ?? 0;
      const y0 = seg[i + 1] ?? 0;
      const x1 = seg[i + 2] ?? 0;
      const y1 = seg[i + 3] ?? 0;
      const len = Math.hypot(x1 - x0, y1 - y0);
      if (len < 1e-6) continue;
      const nx = (-(y1 - y0) / len) * half;
      const ny = ((x1 - x0) / len) * half;
      this.ensureLeaderCapacity_(4 * LEADER_STRIDE, 6);
      const base = this.leadVfLen_ / LEADER_STRIDE;
      this.leaderVertex_(x0 + nx, y0 + ny, 0, half);
      this.leaderVertex_(x0 - nx, y0 - ny, 0, -half);
      this.leaderVertex_(x1 + nx, y1 + ny, len, half);
      this.leaderVertex_(x1 - nx, y1 - ny, len, -half);
      const iu = this.leadIu_;
      iu[this.leadIuLen_++] = base;
      iu[this.leadIuLen_++] = base + 1;
      iu[this.leadIuLen_++] = base + 2;
      iu[this.leadIuLen_++] = base + 2;
      iu[this.leadIuLen_++] = base + 1;
      iu[this.leadIuLen_++] = base + 3;
    }
  }

  private leaderVertex_(x: number, y: number, along: number, edge: number): void {
    const vf = this.leadVf_;
    let o = this.leadVfLen_;
    vf[o++] = x;
    vf[o++] = y;
    vf[o++] = along;
    vf[o++] = edge;
    this.leadVfLen_ = o;
  }

  private emitSwellQuad_(x0: number, y0: number, x1: number, y1: number, half: number): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const nx = (-dy / len) * half;
    const ny = (dx / len) * half;
    this.ensureSwellCapacity_(4 * 6, 6);
    const base = this.svLen_ / 6;
    this.swellVertex_(x0 + nx, y0 + ny, x0, y0, x1, y1);
    this.swellVertex_(x0 - nx, y0 - ny, x0, y0, x1, y1);
    this.swellVertex_(x1 + nx, y1 + ny, x0, y0, x1, y1);
    this.swellVertex_(x1 - nx, y1 - ny, x0, y0, x1, y1);
    const si = this.si_;
    si[this.siLen_++] = base;
    si[this.siLen_++] = base + 1;
    si[this.siLen_++] = base + 2;
    si[this.siLen_++] = base + 2;
    si[this.siLen_++] = base + 1;
    si[this.siLen_++] = base + 3;
  }

  private swellVertex_(px: number, py: number, ax: number, ay: number, bx: number, by: number): void {
    const sv = this.sv_;
    let o = this.svLen_;
    sv[o++] = px;
    sv[o++] = py;
    sv[o++] = ax;
    sv[o++] = ay;
    sv[o++] = bx;
    sv[o++] = by;
    this.svLen_ = o;
  }

  private emitDotQuad_(cx: number, cy: number, strength: number, intensity: number): void {
    let df = (strength - 0.35) / 0.35;
    if (df <= 0) return;
    if (df > 1) df = 1;
    const alpha = df * df * (3 - 2 * df) * intensity * DOT_ALPHA;
    const r = DOT_GLOW_PX;
    this.ensureDotCapacity_(4 * 5, 6);
    const base = this.dvLen_ / 5;
    this.dotVertex_(cx - r, cy - r, cx, cy, alpha);
    this.dotVertex_(cx + r, cy - r, cx, cy, alpha);
    this.dotVertex_(cx - r, cy + r, cx, cy, alpha);
    this.dotVertex_(cx + r, cy + r, cx, cy, alpha);
    const di = this.di_;
    di[this.diLen_++] = base;
    di[this.diLen_++] = base + 1;
    di[this.diLen_++] = base + 2;
    di[this.diLen_++] = base + 2;
    di[this.diLen_++] = base + 1;
    di[this.diLen_++] = base + 3;
  }

  private dotVertex_(px: number, py: number, cx: number, cy: number, alpha: number): void {
    const dv = this.dv_;
    let o = this.dvLen_;
    dv[o++] = px;
    dv[o++] = py;
    dv[o++] = cx;
    dv[o++] = cy;
    dv[o++] = alpha;
    this.dvLen_ = o;
  }

  private ensureLineBatches_(count: number): LineBatch[] {
    if (!this.lineBatches_ || this.lineBatches_.length !== count) {
      this.lineBatches_ = Array.from({ length: count }, () => ({
        vf: new Float32Array(1024),
        vfLen: 0,
        iu: new Uint32Array(512),
        iuLen: 0,
      }));
    }
    return this.lineBatches_;
  }

  private ensureSwellCapacity_(v: number, i: number): void {
    this.sv_ = growF32(this.sv_, this.svLen_, v);
    this.si_ = growU32(this.si_, this.siLen_, i);
  }

  private ensureDotCapacity_(v: number, i: number): void {
    this.dv_ = growF32(this.dv_, this.dvLen_, v);
    this.di_ = growU32(this.di_, this.diLen_, i);
  }

  private ensureLabelCapacity_(vFloats: number, iInts: number): void {
    this.lv_ = growF32(this.lv_, this.lvLen_, vFloats);
    this.li_ = growU32(this.li_, this.liLen_, iInts);
  }

  private ensureLeaderCapacity_(vFloats: number, iInts: number): void {
    this.leadVf_ = growF32(this.leadVf_, this.leadVfLen_, vFloats);
    this.leadIu_ = growU32(this.leadIu_, this.leadIuLen_, iInts);
  }

  override disposeInternal(): void {
    this.atlas_?.dispose();
    if (this.texture_) this.helper.getGL().deleteTexture(this.texture_);
    if (this.lineVertBuffer_) this.helper.deleteBuffer(this.lineVertBuffer_);
    if (this.lineIndexBuffer_) this.helper.deleteBuffer(this.lineIndexBuffer_);
    if (this.swellBuffer_) this.helper.deleteBuffer(this.swellBuffer_);
    if (this.swellIndex_) this.helper.deleteBuffer(this.swellIndex_);
    if (this.dotBuffer_) this.helper.deleteBuffer(this.dotBuffer_);
    if (this.dotIndex_) this.helper.deleteBuffer(this.dotIndex_);
    if (this.labelVertBuffer_) this.helper.deleteBuffer(this.labelVertBuffer_);
    if (this.labelIndexBuffer_) this.helper.deleteBuffer(this.labelIndexBuffer_);
    if (this.leaderVertBuffer_) this.helper.deleteBuffer(this.leaderVertBuffer_);
    if (this.leaderIndexBuffer_) this.helper.deleteBuffer(this.leaderIndexBuffer_);
    super.disposeInternal();
  }
}

// --- WEBGL GRATICULE LAYER --------------------------------------------------
export class WebGLGraticuleLayer extends Layer<VectorSource, WebGLGraticuleRenderer> {
  readonly maxLines: number;
  readonly blend: GraticuleBlendMode | undefined;
  readonly pointers = new LensPointers();

  private readonly grids_: WebGLGrid[] = [];
  private readonly bucketList_: LineBucket[] = [];
  private readonly lensLineStyle_: GraticuleLineStyle | undefined;
  private map_: OLMap | null = null;

  constructor(options: WebGLGraticuleLayerOptions = {}) {
    const cfg = resolveGraticuleOptions(options);
    const { specs, edgeConfig } = cfg;

    super({
      source: new VectorSource({ useSpatialIndex: false }),
      ...cfg.layerOptions,
    });

    for (let i = 0; i < specs.length; i++) {
      const g = specs[i];
      if (!g) continue;
      const bucketOffset = this.bucketList_.length;
      const { list, classify } = resolveBuckets(g.style?.line);
      this.bucketList_.push(...list);

      this.grids_.push({
        gridSystem: g.gridSystem ?? null,
        lineStyle: g.style?.line,
        classify,
        bucketOffset,
        lens: resolveHoverLens(g.style?.hoverLens, g.style?.line),
        labelEngine: createLabelEngine(g, edgeConfig, cfg.maxLines, new VectorSource({ useSpatialIndex: false })),
      });
    }

    this.maxLines = cfg.maxLines;
    this.blend = cfg.blend;
    this.lensLineStyle_ = cfg.lensLineStyle;
  }

  override createRenderer(): WebGLGraticuleRenderer {
    return new WebGLGraticuleRenderer(this);
  }

  getGrids(): readonly WebGLGrid[] {
    return this.grids_;
  }

  getBucketList(): readonly LineBucket[] {
    return this.bucketList_;
  }

  getGridSystem(): GridSystem | null {
    return this.grids_[0]?.gridSystem ?? null;
  }

  setGridSystem(gridSystem: GridSystem | null): void {
    const first = this.grids_[0];
    if (first) first.gridSystem = gridSystem;
    this.updatePointers_();
    this.changed();
  }

  setHoverLens(input: GraticuleHoverLens | undefined): void {
    const first = this.grids_[0];
    if (first) first.lens = resolveHoverLens(input, this.lensLineStyle_);
    this.updatePointers_();
    this.changed();
  }

  override setMapInternal(map: OLMap | null): void {
    super.setMapInternal(map);
    this.map_ = map;
    this.updatePointers_();
  }

  private updatePointers_(): void {
    const map = this.map_;
    const hasLens = this.grids_.some((g) => g.lens !== null && g.gridSystem !== null);
    if (map && hasLens) this.pointers.attach(map.getViewport(), () => map.render());
    else this.pointers.detach();
  }

  override disposeInternal(): void {
    this.pointers.detach();
    super.disposeInternal();
  }
}

function uploadTexture(gl: WebGLRenderingContext, texture: WebGLTexture, source: HTMLCanvasElement): void {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}
