import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RotateCw, Maximize2, Minimize2, Compass, Lock, Unlock } from 'lucide-react';
import { Theme } from '../types';

interface AventadorParticle3DProps {
  theme: Theme;
  lang?: 'es' | 'en';
  className?: string;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export const AventadorParticle3D: React.FC<AventadorParticle3DProps> = ({
  theme,
  lang = 'es',
  className = '',
  onFullscreenChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInteractive, setIsInteractive] = useState(false);
  const isInteractiveRef = useRef(false);

  useEffect(() => {
    isInteractiveRef.current = isInteractive;
    const cv = canvasRef.current;
    if (cv) {
      cv.style.cursor = isInteractive ? 'grab' : 'pointer';
    }
  }, [isInteractive]);

  // Click outside to lock 3D interaction and release scroll
  useEffect(() => {
    if (!isInteractive) return;
    const handleOutside = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsInteractive(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [isInteractive]);

  // References to communicate with WebGL render loop
  const stateRef = useRef({
    themeMixT: theme === 'light' ? 1.0 : 0.0,
    themeMixV: theme === 'light' ? 1.0 : 0.0,
    autoRotate: true,
    resetCamera: false,
    assemblyStart: 0,
    width: 800,
    height: 500,
  });

  // Re-trigger assembly particle entrance when scrolled into view
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    let wasVisible = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !wasVisible) {
            wasVisible = true;
            stateRef.current.assemblyStart = performance.now();
          } else if (!entry.isIntersecting) {
            wasVisible = false;
          }
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Sync theme changes with smooth interpolation
  useEffect(() => {
    stateRef.current.themeMixT = theme === 'light' ? 1.0 : 0.0;
  }, [theme]);

  // Sync auto-rotation state
  useEffect(() => {
    stateRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
      onFullscreenChange?.(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
      onFullscreenChange?.(false);
    }
  }, [onFullscreenChange]);

  useEffect(() => {
    const handleFsChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      onFullscreenChange?.(active);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [onFullscreenChange]);

  const resetView = useCallback(() => {
    stateRef.current.resetCamera = true;
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;

    const gl = cv.getContext('webgl', {
      antialias: false,
      alpha: false,
      depth: true,
      powerPreference: 'high-performance',
    });
    if (!gl) return;

    /* =========================================================================
       LAMBORGHINI AVENTADOR SVJ - Procedural Point-Cloud Generator
       ========================================================================= */
    const TAU = Math.PI * 2, PI = Math.PI;
    let _s = 0x5eed1234;
    function R() {
      _s |= 0; _s = _s + 0x6D2B79F5 | 0;
      let t = Math.imul(_s ^ _s >>> 15, 1 | _s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    const rr = (a: number, b: number) => a + R() * (b - a);
    const clamp = (x: number, a: number, b: number) => x < a ? a : x > b ? b : x;
    const cross = (a: number[], b: number[]): [number, number, number] => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
    const nrm = (v: number[]): [number, number, number] => {
      const l = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0] / l, v[1] / l, v[2] / l];
    };
    const dot3 = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

    function curve(k: [number, number][]) {
      const n = k.length, h: number[] = [], d: number[] = [], m = new Array(n);
      for (let i = 0; i < n - 1; i++) {
        h[i] = k[i + 1][0] - k[i][0];
        d[i] = (k[i + 1][1] - k[i][1]) / h[i];
      }
      m[0] = d[0]; m[n - 1] = d[n - 2];
      for (let i = 1; i < n - 1; i++) {
        if (d[i - 1] * d[i] <= 0) m[i] = 0;
        else {
          const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
          m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
        }
      }
      const ev = (x: number) => {
        let i = 0;
        while (i < n - 2 && x > k[i + 1][0]) i++;
        const t = (x - k[i][0]) / h[i], t2 = t * t, t3 = t2 * t;
        return (2 * t3 - 3 * t2 + 1) * k[i][1] +
               (t3 - 2 * t2 + t) * h[i] * m[i] +
               (-2 * t3 + 3 * t2) * k[i + 1][1] +
               (t3 - t2) * h[i] * m[i + 1];
      };
      const x0 = k[0][0], x1 = k[n - 1][0], N = 1200, T = new Float64Array(N + 2);
      for (let i = 0; i <= N + 1; i++) T[i] = ev(x0 + (x1 - x0) * i / N);
      return (x: number) => {
        const f = (clamp(x, x0, x1) - x0) / (x1 - x0) * N, i = Math.min(N, f | 0);
        return T[i] + (T[i + 1] - T[i]) * (f - i);
      };
    }

    const Wp = curve([[-2.60, .74], [-2.50, .86], [-2.25, .97], [-1.8, 1.02], [-1.3, 1.02], [-.8, .98], [-.3, .94], [.2, .93], [.7, .96], [1.1, 1.00], [1.5, 1.01], [1.9, .98], [2.25, .92], [2.5, .83], [2.62, .72]]);
    const Yt = curve([[-2.60, .62], [-2.50, .82], [-2.30, .92], [-1.9, .98], [-1.4, 1.0], [-.9, .99], [-.3, .96], [.3, .94], [.7, .92], [1.0, .87], [1.3, .84], [1.7, .72], [2.0, .64], [2.3, .56], [2.5, .49], [2.62, .42]]);
    const Cr = curve([[-2.6, .08], [-2, .11], [-1, .13], [0, .12], [1, .10], [2, .08], [2.62, .06]]);
    const Yb = curve([[-2.60, .30], [-2.5, .21], [-2.3, .16], [-2.0, .14], [2.2, .13], [2.5, .10], [2.62, .10]]);
    const TUCK = .13, NT = 3.0;
    const Ys = (x: number) => Yt(x) - Cr(x);

    const Wr = curve([[-1.2, .28], [-.9, .46], [-.4, .52], [.1, .50], [.5, .40], [.9, .18]]);
    const Wc = curve([[-1.2, .55], [-.9, .74], [-.4, .84], [.2, .86], [.6, .85], [.95, .70]]);
    const Yr = curve([[-1.2, .86], [-.95, .99], [-.6, 1.09], [-.2, 1.135], [.15, 1.12], [.5, 1.03], [.8, .95], [.95, .90]]);

    function hullTop(x: number, z: number) {
      const wp = Wp(x);
      if (z >= wp) return -1;
      const yt = Yt(x), ys = yt - Cr(x);
      return ys + (yt - ys) * Math.pow(1 - Math.pow(z / wp, NT), 1 / NT);
    }
    function bodyZ(x: number, y: number) {
      const wp = Wp(x), wb = wp - TUCK, yb = Yb(x), yt = Yt(x), ys = yt - Cr(x);
      if (y < yb) return null;
      if (y <= ys) {
        const s = (y - yb) / (ys - yb);
        return wb + (wp - wb) * (1 - (1 - s) * (1 - s));
      }
      if (y <= yt) {
        const u = (y - ys) / (yt - ys);
        return wp * Math.pow(1 - Math.pow(u, NT), 1 / NT);
      }
      return null;
    }
    function bodyF(x: number, p: number) {
      const wp = Wp(x), wb = wp - TUCK, yb = Yb(x), yt = Yt(x), ys = yt - Cr(x);
      if (p < .4) {
        const s = p / .4;
        return [x, yb + (ys - yb) * s, wb + (wp - wb) * (1 - (1 - s) * (1 - s))];
      }
      const th = (p - .4) / .6 * PI / 2, c = Math.cos(th), sn = Math.sin(th);
      return [x, ys + (yt - ys) * Math.pow(sn, 2 / NT), wp * Math.pow(c, 2 / NT)];
    }
    function cabY(x: number, z: number) {
      if (x < -1.2 || x > .95) return -1;
      const wr = Wr(x), wc = Wc(x), yr = Yr(x), yb = Yt(x) - .10;
      if (z <= wr) return yr;
      if (z >= wc) return -1;
      const u = (z - wr) / (wc - wr);
      return yb + (yr - yb) * Math.sqrt(1 - u * u);
    }
    function cabF(x: number, q: number) {
      const wr = Wr(x), wc = Wc(x), yr = Yr(x), yb = Yt(x) - .10;
      if (q < .5) return [x, yr, wr * (q / .5)];
      const u = (q - .5) / .5;
      return [x, yb + (yr - yb) * Math.sqrt(Math.max(0, 1 - u * u)), wr + (wc - wr) * u];
    }

    const DENS = (typeof window !== 'undefined' && window.innerWidth < 768) ? 0.75 : 1.0;
    const buf: number[][] = [[], [], [], []];

    function add(x: number, y: number, z: number, kind: number, size: number, nx?: number, ny?: number, nz?: number) {
      const b = kind === 1 ? 1 : kind === 4 ? 2 : kind === 5 ? 3 : 0;
      buf[b].push(x, y, z, nx || 0, ny || 0, nz || 0, kind, size, R());
    }
    function addM(x: number, y: number, z: number, kind: number, size: number, nx?: number, ny?: number, nz?: number) {
      add(x, y, z, kind, size, nx, ny, nz);
      add(x, y, -z, kind, size, nx, ny, -(nz || 0));
    }
    const sz = () => rr(.75, 1.55);

    function sampleParam(
      f: (a: number, b: number) => number[],
      a0: number, a1: number, b0: number, b1: number,
      n: number,
      cb: (P: number[], N: [number, number, number], a: number, b: number) => void
    ) {
      n = Math.round(n * DENS);
      const ea = (a1 - a0) * .004, eb = (b1 - b0) * .004;
      const ev = (a: number, b: number): [number, [number, number, number]] => {
        const A1 = Math.min(a + ea, a1), A0 = Math.max(a - ea, a0), B1 = Math.min(b + eb, b1), B0 = Math.max(b - eb, b0);
        const pa1 = f(A1, b), pa0 = f(A0, b), pb1 = f(a, B1), pb0 = f(a, B0);
        const da = [(pa1[0] - pa0[0]) / (A1 - A0), (pa1[1] - pa0[1]) / (A1 - A0), (pa1[2] - pa0[2]) / (A1 - A0)];
        const db = [(pb1[0] - pb0[0]) / (B1 - B0), (pb1[1] - pb0[1]) / (B1 - B0), (pb1[2] - pb0[2]) / (B1 - B0)];
        const c = cross(da, db);
        return [Math.hypot(c[0], c[1], c[2]), c];
      };
      let mx = 0;
      for (let i = 0; i < 2000; i++) mx = Math.max(mx, ev(rr(a0, a1), rr(b0, b1))[0]);
      mx *= 1.05;
      let got = 0, tries = 0;
      while (got < n && tries < n * 50) {
        tries++;
        const a = rr(a0, a1), b = rr(b0, b1), e = ev(a, b);
        if (R() * mx > e[0]) continue;
        got++;
        cb(f(a, b), nrm(e[1]), a, b);
      }
    }

    function orient(N: [number, number, number], P: number[], C: number[]): [number, number, number] {
      return dot3(N, [P[0] - C[0], P[1] - C[1], P[2] - C[2]]) < 0 ? [-N[0], -N[1], -N[2]] : N;
    }

    function quad(o: number[], e1: number[], e2: number[], n: number, kind: number, size: number, mix?: number) {
      n = Math.round(n * DENS);
      const N = nrm(cross(e1, e2));
      for (let i = 0; i < n; i++) {
        const u = R(), v = R();
        add(
          o[0] + e1[0] * u + e2[0] * v,
          o[1] + e1[1] * u + e2[1] * v,
          o[2] + e1[2] * u + e2[2] * v,
          mix && R() < mix ? 0 : kind,
          size * rr(.8, 1.2),
          N[0], N[1], N[2]
        );
      }
    }

    function tube(a: number[], b: number[], r: number, n: number, kind: number, size: number, mirror?: boolean) {
      n = Math.round(n * DENS);
      const ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2], L = Math.hypot(ax, ay, az) || 1;
      const u = [ax / L, ay / L, az / L];
      let v = cross(u, [0, 1, 0]);
      if (Math.hypot(v[0], v[1], v[2]) < .05) v = cross(u, [1, 0, 0]);
      v = nrm(v);
      const w = cross(u, v);
      for (let i = 0; i < n; i++) {
        const t = R(), q = R() * TAU, c = Math.cos(q), s = Math.sin(q);
        const nx = v[0] * c + w[0] * s, ny = v[1] * c + w[1] * s, nz = v[2] * c + w[2] * s;
        const x = a[0] + ax * t + nx * r, y = a[1] + ay * t + ny * r, z = a[2] + az * t + nz * r;
        (mirror ? addM : add)(x, y, z, kind, size * rr(.8, 1.2), nx, ny, nz);
      }
    }

    function ellipsoid(c: number[], rx: number, ry: number, rz: number, n: number, kind: number, size: number, mix?: number) {
      n = Math.round(n * DENS);
      for (let i = 0; i < n; i++) {
        const u = R() * TAU, v = Math.acos(2 * R() - 1);
        const dx = Math.sin(v) * Math.cos(u), dy = Math.cos(v), dz = Math.sin(v) * Math.sin(u);
        const P = [c[0] + dx * rx, c[1] + dy * ry, c[2] + dz * rz];
        add(P[0], P[1], P[2], mix && R() < mix ? 0 : kind, size * rr(.8, 1.2), dx / rx, dy / ry, dz / rz);
      }
    }

    function lineM(fn: (t: number) => number[] | null, n: number, kind: number, size: number, cut?: boolean) {
      n = Math.round(n * DENS);
      for (let i = 0; i < n; i++) {
        const P = fn(R());
        if (!P) continue;
        if (cut && isCutAny(P[0], P[1], P[2])) continue;
        addM(P[0], P[1], P[2], kind, size * rr(.85, 1.25), 0, 0, 0);
      }
    }

    function polyIn(p: [number, number][], x: number, y: number) {
      let c = false;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const a = p[i], b = p[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
      }
      return c;
    }

    const WH: [number, number, number, number, number, number][] = [
      [1.32, .35, .41, .83, .26, .25],
      [-1.40, .38, .44, .80, .34, .265]
    ];
    function inArch(x: number, y: number, z: number) {
      for (const w of WH) {
        const dx = x - w[0], dy = y - w[1];
        if (dx * dx + dy * dy < w[2] * w[2] && z > Wp(x) - .30) return true;
      }
      return false;
    }

    const DOOR_X0 = -.40, DOOR_X1 = .76, SILL = .30;
    const INTAKE: [number, number][] = [[-.46, .30], [-.46, .80], [-.80, .76], [-1.10, .58], [-1.20, .40], [-1.0, .30]];
    function isCutAny(x: number, y: number, z: number) {
      return inArch(x, y, z) || (z > .75 && x > DOOR_X0 && x < DOOR_X1 && y > SILL && y < Ys(x) + .001);
    }

    const HL: [[number, number], [number, number]][] = [
      [[1.84, .88], [2.30, .54]],
      [[1.74, .72], [2.04, .60]]
    ];
    function segDist(px: number, pz: number, a: [number, number], b: [number, number]) {
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const t = clamp(((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
      return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
    }
    const nearHead = (x: number, z: number) => {
      for (const s of HL) if (segDist(x, z, s[0], s[1]) < .062) return true;
      return false;
    };

    function classify(x: number, y: number, z: number, side: boolean) {
      if (y < .21) return 1;
      if (x > 2.2 && y < .40 && z < .62) return 1;
      if (x > 2.1 && y < .33 && z >= .62 && z < .93) return 1;
      if (x < -2.40 && y < .50) return 1;
      if (!side && y > .45 && x > 1.6 && nearHead(x, z)) return 1;
      if (!side && x < -1.1 && x > -2.0 && z < .5 && y > .9 && (((x * 13) % 1) + 1) % 1 < .5) return 1;
      return 0;
    }

    function bodyShell() {
      sampleParam((x, p) => bodyF(x, p), -2.60, 2.62, 0, 1, 75000, (P, N, x, p) => {
        const [px, py, pz] = P;
        const side = p < .4;
        N = orient(N, P, [px, .3, 0]);
        if (inArch(px, py, pz)) return;
        if (side && px > DOOR_X0 && px < DOOR_X1 && py > SILL) return;
        if (!side && cabY(px, pz) > py + .003) return;
        let kind = 0, zz = pz;
        if (side && polyIn(INTAKE, px, py)) { kind = 1; zz -= .08; }
        else kind = classify(px, py, pz, side);
        if (kind === 1 && R() < .13) kind = 0;
        else if (kind === 0 && R() < .045) kind = 3;
        addM(px, py, zz, kind, kind === 3 ? rr(1, 1.7) : sz(), N[0], N[1], N[2]);
      });

      for (const [xe, ny] of [[2.62, 1], [-2.60, -1]]) {
        const y0 = Yb(xe), y1 = Yt(xe), n = Math.round(3500 * DENS);
        for (let i = 0; i < n; i++) {
          const y = rr(y0, y1), zm = bodyZ(xe, y);
          if (zm === null) continue;
          const z = rr(0, zm);
          let k = classify(xe, y, z, false);
          if (k === 1 && R() < .13) k = 0;
          else if (k === 0 && R() < .045) k = 3;
          addM(xe, y, z, k, sz(), ny, 0, 0);
        }
      }

      sampleParam((x, q) => cabF(x, q), -1.2, .95, 0, 1, 15000, (P, N, x) => {
        const [px, py, pz] = P;
        if (hullTop(px, pz) > py - .003) return;
        N = orient(N, P, [px, .6, 0]);
        const wr = Wr(px), zmaxG = .46 + clamp((px - .14) / .76, 0, 1) * .28;
        let kind = 0;
        if (px > .14 && px < .90 && pz < zmaxG) { if (R() > .42) return; kind = 1; }
        else if (px > -.55 && px < .28 && pz > wr + .06) return;
        else if (px < -.55 && px > -.98 && pz > wr + .05) { if (R() > .45) return; kind = 1; }
        else if (R() < .045) kind = 3;
        addM(px, py, pz, kind, kind === 3 ? rr(1, 1.7) : sz(), N[0], N[1], N[2]);
      });
    }

    function bodyLines() {
      const L = (fn: (t: number) => number[] | null, n: number, s?: number, cut?: boolean) => lineM(fn, n, 3, s || .9, cut);
      L(t => { const x = -2.35 + t * 4.75; return bodyF(x, .4); }, 3000, .9, true);
      L(t => { const x = -2.45 + t * 4.9; return bodyF(x, .0); }, 2000, .8, true);
      L(t => { const x = -1.0 + t * 3.2; return bodyF(x, .2); }, 1600, .75, true);
      L(t => { const x = .95 + t * 1.40, z = .30 - (x - .95) * .13, y = hullTop(x, z); return y > 0 ? [x, y + .004, z] : null; }, 900, .8);
      L(t => { const x = .95 + t * 1.35, z = .62 - (x - .95) * .05, y = hullTop(x, z); return y > 0 ? [x, y + .004, z] : null; }, 800, .8);
      L(t => { const x = .14 + t * .74, z = .86 * Wc(x), y = cabY(x, z); return y > 0 ? [x, y + .003, z] : null; }, 700, .9);
      L(t => { const z = t * (Wr(.14) + .4), y = cabY(.14, z); return y > 0 ? [.14, y + .003, z] : null; }, 500, .9);
      L(t => { const x = -.9 + t * 1.04; return [x, Yr(x), Wr(x) + .01]; }, 900, .9);
      L(t => { const x = .28 + t * .5, z = Wr(x) + .06 + t * .04, y = cabY(x, z); return y > 0 && hullTop(x, z) < y - .003 ? [x, y, z] : null; }, 500, .8);

      L(t => { const y = SILL + t * (Ys(DOOR_X1) - SILL), z = bodyZ(DOOR_X1, y); return z ? [DOOR_X1, y, z] : null; }, 500, .9);
      L(t => { const y = SILL + t * (Ys(DOOR_X0) - SILL), z = bodyZ(DOOR_X0, y); return z ? [DOOR_X0, y, z] : null; }, 500, .9);
      L(t => { const x = DOOR_X0 + t * (DOOR_X1 - DOOR_X0), z = bodyZ(x, SILL); return z ? [x, SILL, z] : null; }, 600, .9);

      for (const w of WH) {
        L(t => {
          const a = t * PI, x = w[0] + Math.cos(a) * w[2], y = w[1] + Math.sin(a) * w[2], z = bodyZ(x, y);
          return z ? [x, y, z] : null;
        }, 1000, 1.0);
      }

      for (let i = 0; i < INTAKE.length; i++) {
        const a = INTAKE[i], b = INTAKE[(i + 1) % INTAKE.length];
        L(t => { const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = bodyZ(x, y); return z ? [x, y, z] : null; }, 260, .9, true);
      }
      for (let k = 0; k < 4; k++) {
        const y = .38 + k * .1;
        L(t => { const x = -.5 - t * .5; const z = bodyZ(x, y); return z && polyIn(INTAKE, x, y) ? [x, y, z - .08] : null; }, 120, .7, true);
      }

      L(t => { const x = 2.28 + t * .30, z = .56 - t * .40, y = hullTop(x, z); return y > 0 ? [x, y + .004, z] : null; }, 300, 1);
      L(t => [2.60, .15, t * .62], 400, 1);
      L(t => [2.62, .34, t * .60], 350, 1);
      L(t => { const x = 2.14 + t * .46, z = .26 - t * .12, y = hullTop(x, z); return y > 0 ? [x, y + .004, z] : null; }, 300, .9);
      L(t => [2.62, .20 + t * .17, .62], 300, .9);
      L(t => [2.62, .20 + t * .17, -.62], 300, .9);

      L(t => { const z = t * .80, x = -2.46, y = hullTop(x, z); return y > 0 ? [x, y + .004, z] : null; }, 800, 1.1);
      L(t => { const z = .80 - t * .40, x = -2.46 - t * .04, y = hullTop(x, z); return y > 0 ? [x, y + .004, z] : null; }, 400, 1.1);
      L(t => [-2.0 - t * .60, .15 + t * .13, 0.55], 200, .8);
      L(t => [-2.0 - t * .60, .15 + t * .13, 0.35], 200, .8);
      L(t => [-2.0 - t * .60, .15 + t * .13, 0.15], 200, .8);

      for (const zc of [.17, -.17]) {
        for (let k = 0; k < 6; k++) {
          const a0 = k * TAU / 6, a1 = (k + 1) * TAU / 6, c = [-2.60, .42, zc], r = .075;
          tube([c[0], c[1] + Math.sin(a0) * r, c[2] + Math.cos(a0) * r], [c[0], c[1] + Math.sin(a1) * r, c[2] + Math.cos(a1) * r], .008, 60, 3, 1.0, false);
        }
        tube([-2.60, .42, zc], [-2.50, .42, zc], .06, 400, 1, 1.0, false);
      }
    }

    function headlights() {
      for (const sgn of [1, -1]) {
        for (const [a, b] of HL) {
          const n = Math.round(900 * DENS);
          for (let i = 0; i < n; i++) {
            const t = R(), x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t + rr(-.012, .012), y = hullTop(x, z);
            if (y < 0) continue;
            add(x, y + .006, sgn * z, 2, rr(1.1, 2.0), 0, 1, 0);
          }
        }
        const c = [1.98, hullTop(1.98, .80) + .01, .80];
        for (let i = 0; i < 240; i++) {
          const r = Math.abs(rr(-1, 1)) * .035, a = R() * TAU;
          add(c[0] + Math.cos(a) * r, c[1], sgn * (c[2] + Math.sin(a) * r), 2, rr(1.4, 2.6), 0, 1, 0);
        }
        add(c[0], c[1] + .02, sgn * c[2], 5, 40, 0, 0, 0);
        add(c[0] + .03, c[1] + .02, sgn * c[2], 5, 26, 0, 0, 0);
        const d = [2.22, hullTop(2.22, .60) + .01, .60];
        add(d[0], d[1] + .02, sgn * d[2], 5, 18, 0, 0, 0);
        add(d[0] - .1, d[1] + .02, sgn * (d[2] + .18), 5, 22, 0, 0, 0);
      }
    }

    function wheel(xw: number, yw: number, zc: number, wd: number, Ra: number, Rr: number, s: number, nT: number) {
      const Rt = Ra - .06;
      const prof = [[-.5 * wd, Rr + .004], [-.535 * wd, (Rr + Rt) * .5], [-.47 * wd, Rt - .028], [-.36 * wd, Rt], [.36 * wd, Rt], [.47 * wd, Rt - .028], [.535 * wd, (Rr + Rt) * .5], [.5 * wd, Rr + .004]];
      const cum = [0];
      for (let i = 1; i < prof.length; i++) cum.push(cum[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
      const tot = cum[cum.length - 1];
      nT = Math.round(nT * DENS);
      for (let i = 0; i < nT; i++) {
        const ph = R() * TAU, l = R() * tot;
        let k = 1;
        while (k < cum.length - 1 && l > cum[k]) k++;
        const t = (l - cum[k - 1]) / (cum[k] - cum[k - 1]), A = prof[k - 1], B = prof[k];
        const a = A[0] + (B[0] - A[0]) * t, r = A[1] + (B[1] - A[1]) * t;
        const da = B[0] - A[0], dr = B[1] - A[1], ln = Math.hypot(da, dr), na = da / ln, nr = dr / ln, N = [-nr, na];
        const c = Math.cos(ph), sn = Math.sin(ph);
        const kind = R() < .15 ? 0 : 1;
        add(xw + r * c, yw + r * sn, s * (zc + a), kind, kind ? rr(.8, 1.3) : rr(.6, 1), N[1] * c, N[1] * sn, s * N[0]);
      }
      const P = (r: number, ph: number, a: number) => [xw + r * Math.cos(ph), yw + r * Math.sin(ph), s * (zc + a)];
      for (let i = 0; i < Math.round(1200 * DENS); i++) {
        const ph = R() * TAU, r = Rr + rr(-.012, .008), p = P(r, ph, .47 * wd);
        add(p[0], p[1], p[2], 3, rr(1, 1.7), 0, 0, s);
      }
      const as = .20 * wd, rot = .55;
      for (let k = 0; k < 5; k++) {
        const f = rot + k * TAU / 5;
        tube(P(.045, f, as), P(.15, f, as), .021, 380, 0, 1, false);
        tube(P(.15, f, as), P(Rr - .014, f + .30, as), .017, 420, 0, 1, false);
        tube(P(.15, f, as), P(Rr - .014, f - .30, as), .017, 420, 0, 1, false);
        tube(P(.045, f, as + .012), P(.15, f, as + .012), .007, 80, 3, 1.2, false);
      }
      for (let i = 0; i < Math.round(650 * DENS); i++) {
        const ph = R() * TAU, r = Math.sqrt(R()) * .06, p = P(r, ph, as + .014);
        add(p[0], p[1], p[2], R() < .5 ? 0 : 3, sz(), 0, 0, s);
      }
      for (let i = 0; i < Math.round(1800 * DENS); i++) {
        const ph = R() * TAU, r = rr(.06, Rr - .016), p = P(r, ph, .02 * wd);
        add(p[0], p[1], p[2], 1, sz(), 0, 0, s);
      }
    }

    function wheels() {
      for (const w of WH) {
        for (const s of [1, -1]) {
          wheel(w[0], w[1], w[3], w[4], w[1] === .35 ? .35 : .38, w[5], s, w[1] === .35 ? 9000 : 11000);
        }
      }
    }

    /* Scissor doors open */
    const HX = .76, HY = .80, PHI = 75 * PI / 180, LEAN = Math.tan(13 * PI / 180), DU = 1.14;
    const dTopC = curve([[0, .93], [.3, 1.03], [.6, 1.07], [.9, 1.02], [1.14, .93]]);
    function zl(yc: number) {
      const ys = Ys(.3);
      return yc <= ys ? (bodyZ(.3, Math.max(yc, .15)) || 0.8) : (bodyZ(.3, ys) || 0.8) - (yc - ys) * 1.3;
    }
    function doorP(u: number, v: number, c: number, s: number) {
      const z = zl(HY + v) + c, x = HX - u * Math.cos(PHI) + v * Math.sin(PHI), y = HY + u * Math.sin(PHI) + v * Math.cos(PHI);
      return [x, y, s * (z + (y - HY) * LEAN)];
    }
    function inDoor(u: number, v: number, m: number = 0) {
      return u >= m && u <= DU - Math.max(0, -v - .2) * .3 - m && v >= -.5 + m && v <= dTopC(u) - HY - m;
    }
    function inWindow(u: number, v: number) {
      return u > .12 && u < DU - .14 - Math.max(0, -v - .2) * .3 && v > .05 && v < dTopC(u) - HY - .07;
    }

    function doors() {
      for (const s of [1, -1]) {
        const skin = (c: number, n: number, fn: (P: number[], N: [number, number, number], u: number, v: number) => void) => {
          n = Math.round(n * DENS);
          let got = 0;
          while (got < n) {
            const u = rr(0, DU), v = rr(-.5, .3);
            if (!inDoor(u, v)) continue;
            got++;
            const P = doorP(u, v, c, s), Pu = doorP(u + .01, v, c, s), Pv = doorP(u, v + .01, c, s);
            let N = nrm(cross([Pu[0] - P[0], Pu[1] - P[1], Pu[2] - P[2]], [Pv[0] - P[0], Pv[1] - P[1], Pv[2] - P[2]]));
            const Po = doorP(u, v, c + .05, s);
            if (dot3(N, [Po[0] - P[0], Po[1] - P[1], Po[2] - P[2]]) < 0) N = [-N[0], -N[1], -N[2]];
            fn(P, N, u, v);
          }
        };
        skin(0, 9000, (P, N, u, v) => {
          if (inWindow(u, v)) { if (R() > .40) return; add(P[0], P[1], P[2], 1, sz(), N[0], N[1], N[2]); return; }
          add(P[0], P[1], P[2], R() < .045 ? 3 : 0, sz(), N[0], N[1], N[2]);
        });
        skin(-.07, 5000, (P, N, u, v) => {
          if (inWindow(u, v) && R() > .35) return;
          add(P[0], P[1], P[2], R() < .12 ? 0 : 1, sz(), -N[0], -N[1], -N[2]);
        });
        for (const [m, test, kind, n] of [[.0, 0, 3, 2400], [.0, 1, 3, 1400]]) {
          let got = 0;
          const nn = Math.round(n * DENS);
          while (got < nn) {
            const u = rr(0, DU), v = rr(-.5, .3);
            let ok;
            if (test === 0) ok = inDoor(u, v, 0) && !inDoor(u, v, .022);
            else ok = inWindow(u, v) && !(u > .12 + .02 && u < DU - .14 - Math.max(0, -v - .2) * .3 - .02 && v > .05 + .02 && v < dTopC(u) - HY - .07 - .02);
            if (!ok) continue;
            got++;
            const P = doorP(u, v, 0, s);
            add(P[0], P[1], P[2], kind, rr(1, 1.7), 0, 0, 0);
          }
        }
      }
    }

    /* Carbon SVJ Rear Wing */
    function wing() {
      const yc = (x: number) => 1.10 + (-2.07 - x) / .42 * .06;
      const n = Math.round(9000 * DENS);
      for (let i = 0; i < n; i++) {
        const x = rr(-2.50, -2.07), z = rr(0, .98), y = yc(x);
        const top = R() < .55;
        addM(x, y + (top ? .014 : -.014), z, R() < .04 ? 3 : (top ? 0 : 1), sz(), 0, top ? 1 : -1, 0);
      }
      lineM(t => [-2.07, yc(-2.07), t * .98], 700, 3, 1.2);
      lineM(t => [-2.50, yc(-2.50), t * .98], 700, 3, 1.2);
      lineM(t => { const x = -2.07 - t * .43; return [x, yc(x) + .014, .98]; }, 200, 3, 1.1);

      const n2 = Math.round(1700 * DENS);
      for (let i = 0; i < n2; i++) {
        const x = rr(-2.58, -2.00), y = rr(1.00, 1.26);
        const top = 1.20 - (x + 2.58) * .09;
        if (y > top || y < 1.03 + (x + 2.58) * .02) continue;
        addM(x, y, .99, R() < .05 ? 3 : 0, sz(), 0, 0, 1);
      }
      tube([-2.29, .95, .50], [-2.29, 1.10, .50], .04, 480, 0, 1.0, true);
      tube([-2.30, .98, .12], [-2.30, 1.10, .12], .035, 340, 0, 1.0, true);
    }

    function extras() {
      const ns = Math.round(4800 * DENS);
      for (let i = 0; i < ns; i++) {
        const x = rr(2.34, 2.72), w = .90 - (x - 2.34) * .6;
        if (w <= 0) continue;
        const z = rr(0, w);
        addM(x, .095 + rr(-.008, .008), z, R() < .12 ? 0 : 1, sz(), 0, 1, 0);
      }
      lineM(t => { const x = 2.34 + t * .38, w = .90 - (x - 2.34) * .6; return [x, .10, w]; }, 500, 3, 1.2);
      lineM(t => [2.72, .10, t * .67], 600, 3, 1.2);

      // Floor & cockpit
      quad([-.5, .27, -.62], [1.3, 0, 0], [0, 0, 1.24], 3000, 1, 1, .05);
      quad([.55, .70, -.78], [.30, .09, 0], [0, 0, 1.56], 3000, 1, 1, .06);
      ellipsoid([.58, .80, -.34], .10, .05, .20, 800, 1, 1, .1);
      for (const s of [1, -1]) {
        quad([-.40, .28, s * .64], [1.16, 0, 0], [0, .55, 0], 1800, 1, 1, .05);
        const zc = s * .34;
        quad([-.34, .36, zc - .20], [.46, 0, 0], [0, 0, .40], 1200, 1, 1, .1);
        quad([-.34, .40, zc - .21], [-.17, .47, 0], [0, 0, .42], 1800, 1, 1, .1);
      }
      // Steering wheel
      const c = [.40, .77, -.34], e1 = [0, 0, 1], e2 = nrm([-.55, .84, 0]);
      for (let i = 0; i < Math.round(1100 * DENS); i++) {
        const a = R() * TAU, r = .155 + rr(-.014, .014);
        add(c[0] + e2[0] * Math.sin(a) * r, c[1] + e2[1] * Math.sin(a) * r, c[2] + e1[2] * Math.cos(a) * r, R() < .5 ? 1 : 3, rr(.9, 1.5), 0, 0, 0);
      }
    }

    function dust() {
      const n = Math.round(4800 * Math.max(DENS, .8));
      for (let i = 0; i < n; i++) {
        const a = R() * TAU, r = 2.3 + Math.pow(R(), 1.8) * 3.4;
        add(Math.cos(a) * r * (.7 + R() * .6), (R() - .5) * (1.3 + r * .32) + .55, (R() - .5) * 4.0, 4, rr(.3, 1.25) * 1.0, 0, 0, 0);
      }
    }

    function buildCar() {
      _s = 0x5eed1234;
      for (const b of buf) b.length = 0;
      bodyShell();
      bodyLines();
      headlights();
      wheels();
      doors();
      wing();
      extras();
      dust();
      const counts = buf.map(b => b.length / 9);
      const total = counts.reduce((a, b) => a + b, 0);
      const data = new Float32Array(total * 9);
      let o = 0;
      for (const b of buf) {
        for (let i = 0; i < b.length; i++) data[o++] = b[i];
      }
      return { data, counts };
    }

    /* =========================================================================
       WEBGL SHADERS & MATRICES
       ========================================================================= */
    const VS = `
      precision highp float;
      attribute vec3 aPos; attribute vec3 aNor; attribute vec3 aMeta;
      uniform mat4 uVP; uniform vec3 uCam;
      uniform float uT, uPx, uAsm, uMode, uDpr, uAmb, uGain, uGlowA, uFlareA;
      uniform vec3 uBody, uEdge, uGray, uBlue;
      varying vec4 vC; varying float vM;
      float h(float n){return fract(sin(n*127.1)*43758.5453);}
      void main(){
        float kind = aMeta.x, size = aMeta.y, seed = aMeta.z;
        float isDust = step(3.5, kind) * step(kind, 4.5);
        vec3 p = aPos;
        float a = clamp((uAsm - seed * 0.7) / 1.0, 0.0, 1.0);
        a = 1.0 - pow(1.0 - a, 3.0);
        a = mix(a, 1.0, isDust);
        vec3 d = vec3(h(seed * 12.9), h(seed * 78.2), h(seed * 37.7)) - 0.5;
        vec3 sc = normalize(d + 0.0001) * (3.0 + 9.0 * h(seed * 5.5));
        float ang = (1.0 - a) * 2.2, cs = cos(ang), sn = sin(ang);
        vec3 q = p + sc * (1.0 - a);
        p = vec3(q.x * cs - q.z * sn, q.y, q.x * sn + q.z * cs);
        p += isDust * vec3(sin(uT * 0.30 + seed * 40.0), sin(uT * 0.40 + seed * 60.0) * 0.6, cos(uT * 0.25 + seed * 30.0)) * 0.05;

        vec3 N = aNor; float nl = dot(N, N); float hasN = step(0.01, nl);
        N = N * inversesqrt(max(nl, 1e-4));
        vec3 V = normalize(uCam - p);
        vec3 L1 = normalize(vec3(0.35, 0.85, 0.45)), L2 = normalize(vec3(-0.7, 0.25, -0.5));
        float dif = max(dot(N, L1), 0.0) * 0.85 + max(dot(N, L2), 0.0) * 0.35;
        float fr = pow(1.0 - abs(dot(N, V)), 2.5);
        float lit = mix(0.85, uAmb + uGain * dif + 0.55 * fr, hasN);
        float rv = 0.72 + 0.5 * fract(seed * 91.7);

        vec3 col = uBody * lit * rv; float al = 0.94;
        if(kind > 2.5 && kind < 3.5){ col = uEdge * (lit * 0.8 + 0.45) * rv; al = 1.0; }
        else if(kind > 0.5 && kind < 1.5){ col = uGray * (0.7 + 0.5 * lit) * rv; al = 0.92; }
        else if(kind > 1.5 && kind < 2.5){ col = uBlue * 1.15; al = 1.0; }
        else if(kind > 3.5 && kind < 4.5){ col = uEdge * 0.8; al = 0.42 * (0.55 + 0.45 * sin(uT * 0.8 + seed * 50.0)); }
        else if(kind > 4.5){ col = uBlue; al = 1.0; }
        if(kind < 3.5 && kind > -0.5 && uMode < 1.5) al *= 0.88 + 0.12 * sin(uT * 2.0 + seed * 90.0);
        al *= mix(1.0, clamp(uAsm, 0.0, 1.0), isDust);

        float dist = length(uCam - p);
        col *= clamp(1.25 - (dist - 5.0) * 0.055, 0.55, 1.1);
        float m = 1.0;
        if(uMode > 0.5 && uMode < 1.5){ m = 4.2; al *= uGlowA; }
        if(uMode > 1.5){ al *= uFlareA; }
        gl_Position = uVP * vec4(p, 1.0);
        float ps = size * m * uPx / dist;
        if(uMode < 0.5) ps = max(ps, 1.05 * uDpr);
        gl_PointSize = ps;
        vC = vec4(col, al); vM = uMode;
      }
    `;

    const FS = `
      precision mediump float; varying vec4 vC; varying float vM;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float d = dot(c, c) * 4.0;
        if(d > 1.0) discard;
        float f = vM < 0.5 ? smoothstep(1.0, 0.3, d) : (1.0 - d) * (1.0 - d);
        if(vM < 0.5 && f < 0.3) discard;
        gl_FragColor = vec4(vC.rgb, vC.a * f);
      }
    `;

    function mk(type: number, src: string) {
      const s = gl!.createShader(type);
      if (!s) return null;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    }

    const shV = mk(gl.VERTEX_SHADER, VS);
    const shF = mk(gl.FRAGMENT_SHADER, FS);
    if (!shV || !shF) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, shV);
    gl.attachShader(prog, shF);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const U: Record<string, WebGLUniformLocation | null> = {};
    ['uVP', 'uCam', 'uT', 'uPx', 'uAsm', 'uMode', 'uDpr', 'uAmb', 'uGain', 'uGlowA', 'uFlareA', 'uBody', 'uEdge', 'uGray', 'uBlue'].forEach(n => {
      U[n] = gl.getUniformLocation(prog, n);
    });

    const A = {
      pos: gl.getAttribLocation(prog, 'aPos'),
      nor: gl.getAttribLocation(prog, 'aNor'),
      meta: gl.getAttribLocation(prog, 'aMeta')
    };

    function persp(f: number, a: number, n: number, fa: number) {
      const t = 1 / Math.tan(f / 2), nf = 1 / (n - fa);
      return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) * nf, -1, 0, 0, 2 * fa * n * nf, 0];
    }
    function look(e: number[], c: number[], u: number[]) {
      let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]];
      const zl = Math.hypot(...z); z = z.map(v => v / zl);
      let x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]];
      const xl = Math.hypot(...x); x = x.map(v => v / xl);
      const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
      return [
        x[0], y[0], z[0], 0,
        x[1], y[1], z[1], 0,
        x[2], y[2], z[2], 0,
        -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]),
        -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]),
        -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]),
        1
      ];
    }
    function mul(a: number[], b: number[]) {
      const o = new Array(16);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          let s = 0;
          for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
          o[i * 4 + j] = s;
        }
      }
      return o;
    }

    const HOME = { az: -0.62, el: 0.12, zoom: 1.0 };
    let az = HOME.az, el = HOME.el, zoom = 1.0;
    let tAz = az, tEl = el, tZoom = HOME.zoom, vAz = 0;
    let mx = .5, my = .5, sx = .5, sy = .5;
    let lastInput = performance.now();
    let touched = false;
    let dragging = false;
    let pinch = 0;
    const ptrs = new Map<number, { x: number; y: number }>();
    let lastTapTime = 0;

    const onPointerDown = (e: PointerEvent) => {
      const now = performance.now();
      // Double click or double tap activates / toggles 3D orbit
      if (now - lastTapTime < 340) {
        setIsInteractive((prev) => !prev);
        lastTapTime = 0;
        return;
      }
      lastTapTime = now;

      // When inactive, do not capture pointer or block vertical scrolling
      if (!isInteractiveRef.current) {
        return;
      }

      cv.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      dragging = true;
      touched = true;
      cv.style.cursor = 'grabbing';
      lastInput = performance.now();
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isInteractiveRef.current || !dragging) return;
      const rect = cv.getBoundingClientRect();
      mx = (e.clientX - rect.left) / rect.width;
      my = (e.clientY - rect.top) / rect.height;
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      lastInput = performance.now();
      if (ptrs.size === 2) {
        p.x = e.clientX; p.y = e.clientY;
        const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) tZoom = Math.max(.70, Math.min(1.5, tZoom * pinch / d));
        pinch = d;
        return;
      }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      tAz += dx * .0062;
      tEl = Math.max(-.12, Math.min(1.3, tEl + dy * .0048));
      vAz = dx * .0062;
    };

    const onPointerUp = (e: PointerEvent) => {
      ptrs.delete(e.pointerId);
      pinch = 0;
      if (!ptrs.size) {
        dragging = false;
        if (isInteractiveRef.current) {
          cv.style.cursor = 'grab';
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      // If 3D interaction is not active, do NOT preventDefault! Let the page scroll freely.
      if (!isInteractiveRef.current) {
        return;
      }
      e.preventDefault();
      tZoom = Math.max(.70, Math.min(1.5, tZoom * (1 + e.deltaY * .0011)));
      lastInput = performance.now();
      touched = true;
    };

    const onDblClick = (e: MouseEvent) => {
      e.preventDefault();
      setIsInteractive((prev) => !prev);
    };

    let lastTap = 0;
    const onTouchEnd = (_e: TouchEvent) => {
      const now = performance.now();
      if (now - lastTap < 350) {
        setIsInteractive((prev) => !prev);
        lastTap = 0;
      } else {
        lastTap = now;
      }
    };

    cv.addEventListener('pointerdown', onPointerDown);
    cv.addEventListener('pointermove', onPointerMove);
    cv.addEventListener('pointerup', onPointerUp);
    cv.addEventListener('pointercancel', onPointerUp);
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('dblclick', onDblClick);
    cv.addEventListener('touchend', onTouchEnd, { passive: true });

    cv.style.cursor = 'pointer';

    // Build particle car buffer
    const car = buildCar();
    const counts = car.counts;
    const buf0 = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf0);
    gl.bufferData(gl.ARRAY_BUFFER, car.data, gl.STATIC_DRAW);
    setIsLoaded(true);

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const lv = (A: number[], B: number[], t: number) => A.map((v, i) => lerp(v, B[i], t));
    const COL = {
      body: [[.38, 1.0, .20], [.93, .07, .08]],
      edge: [[.66, 1.0, .42], [1.0, .30, .22]],
      gray: [[.34, .37, .34], [.15, .12, .12]],
      bg: [[0.027, 0.035, 0.031], [1.0, 1.0, 1.0]]
    };

    let animId: number;
    let t0 = 0;

    const render = (now: number) => {
      animId = requestAnimationFrame(render);
      if (!t0) t0 = now;
      const T = (now - t0) / 1000;

      // Handle external reset
      if (stateRef.current.resetCamera) {
        stateRef.current.resetCamera = false;
        tAz = HOME.az; tEl = HOME.el; tZoom = HOME.zoom; vAz = 0; touched = false;
      }

      // Camera inertia and optional auto-rotation
      if (!dragging) {
        tAz += vAz;
        vAz *= .93;
        if (Math.abs(vAz) < 1e-5) vAz = 0;
        if (stateRef.current.autoRotate && (now - lastInput > 3000 || (!touched && T > 2.5))) {
          tAz += .0018;
        }
      }

      az += (tAz - az) * .085;
      el += (tEl - el) * .085;
      zoom += (tZoom - zoom) * .06;
      sx += (mx - sx) * .05;
      sy += (my - sy) * .05;

      const hov = dragging ? 0 : 1;
      const azE = az + (sx - .5) * .16 * hov, elE = el + (.5 - sy) * .07 * hov;

      // Ensure viewport size matches canvas
      const width = cv.clientWidth || 800;
      const height = cv.clientHeight || 500;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.round(width * dpr);
      const targetH = Math.round(height * dpr);
      if (cv.width !== targetW || cv.height !== targetH) {
        cv.width = targetW;
        cv.height = targetH;
      }

      const asp = width / height;
      const fov = 28 * PI / 180;
      const tanHalf = Math.tan(fov / 2);
      // The Aventador spans from x = -2.60 to x = +2.72, and wing width up to z = +/-1.0.
      // On narrow mobile aspect ratios (asp < 1.15), use responsive framing so the car fills the view
      // cleanly without being pushed far into the background.
      const effectiveRadius = asp < 1.15 ? 2.45 : 3.19;
      const requiredDistHoriz = effectiveRadius / (tanHalf * Math.max(asp, 0.72));
      const requiredDistVert = 1.45 / tanHalf;
      const base = Math.min(Math.max(requiredDistHoriz, requiredDistVert, 5.6), 9.6);
      const dist = base * zoom, ce = Math.cos(elE);
      const tgt = [0.06, 0.56, 0];
      const eye = [tgt[0] + dist * ce * Math.cos(azE), tgt[1] + dist * Math.sin(elE), tgt[2] + dist * ce * Math.sin(azE)];
      const VP = mul(persp(fov, asp, .1, 100), look(eye, tgt, [0, 1, 0]));

      stateRef.current.themeMixV += (stateRef.current.themeMixT - stateRef.current.themeMixV) * .07;
      const mixv = stateRef.current.themeMixV;
      const bg = lv(COL.bg[0], COL.bg[1], mixv);

      gl.viewport(0, 0, cv.width, cv.height);
      gl.clearColor(bg[0], bg[1], bg[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.uniformMatrix4fv(U.uVP, false, VP);
      gl.uniform3fv(U.uCam, eye);
      gl.uniform1f(U.uT, T);
      gl.uniform1f(U.uDpr, dpr);
      gl.uniform1f(U.uPx, cv.height / (2 * tanHalf) * .0072);
      const asmBaseTime = stateRef.current.assemblyStart || t0;
      const asmSec = Math.max(0, (now - asmBaseTime) / 1000);
      gl.uniform1f(U.uAsm, Math.min(1.7, asmSec / 1.25));
      gl.uniform1f(U.uAmb, lerp(.38, .62, mixv));
      gl.uniform1f(U.uGain, lerp(.95, .55, mixv));
      gl.uniform1f(U.uGlowA, lerp(.060, .045, mixv));
      gl.uniform1f(U.uFlareA, lerp(.34, .20, mixv));
      gl.uniform3fv(U.uBody, lv(COL.body[0], COL.body[1], mixv));
      gl.uniform3fv(U.uEdge, lv(COL.edge[0], COL.edge[1], mixv));
      gl.uniform3fv(U.uGray, lv(COL.gray[0], COL.gray[1], mixv));
      gl.uniform3fv(U.uBlue, [.72, .86, 1.0]);

      gl.bindBuffer(gl.ARRAY_BUFFER, buf0);
      gl.enableVertexAttribArray(A.pos);
      gl.vertexAttribPointer(A.pos, 3, gl.FLOAT, false, 36, 0);
      gl.enableVertexAttribArray(A.nor);
      gl.vertexAttribPointer(A.nor, 3, gl.FLOAT, false, 36, 12);
      gl.enableVertexAttribArray(A.meta);
      gl.vertexAttribPointer(A.meta, 3, gl.FLOAT, false, 36, 24);

      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);

      const solid = counts[0] + counts[1] + counts[2];

      // Pass 1: Solid Points
      gl.depthMask(true);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(U.uMode, 0);
      gl.drawArrays(gl.POINTS, 0, solid);

      // Pass 2: Glow & Flare Pass
      gl.depthMask(false);
      if (mixv < .5) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      gl.uniform1f(U.uMode, 1);
      gl.drawArrays(gl.POINTS, 0, counts[0]);
      gl.uniform1f(U.uMode, 2);
      gl.drawArrays(gl.POINTS, solid, counts[3]);
      gl.depthMask(true);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      cv.removeEventListener('pointerdown', onPointerDown);
      cv.removeEventListener('pointermove', onPointerMove);
      cv.removeEventListener('pointerup', onPointerUp);
      cv.removeEventListener('pointercancel', onPointerUp);
      cv.removeEventListener('wheel', onWheel);
      cv.removeEventListener('dblclick', onDblClick);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full select-none ${className}`}
      style={{ touchAction: isInteractive ? 'none' : 'pan-y' }}
    >
      <canvas
        ref={canvasRef}
        className={`w-full h-full block focus:outline-none ${isInteractive ? 'cursor-grab' : 'cursor-pointer'}`}
        aria-label="Lamborghini Aventador SVJ 3D interactive particle visualizer"
      />

      {/* Mode Status Pill / Double-Click Toggle Badge */}
      <div className="absolute top-4 left-4 z-20 pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsInteractive(!isInteractive)}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border transition-all duration-300 backdrop-blur-md shadow-md cursor-pointer text-xs font-mono font-medium tracking-wide uppercase ${
            isInteractive
              ? 'bg-[hsl(var(--primary)/0.2)] border-[hsl(var(--primary)/0.7)] text-[hsl(var(--primary))] shadow-[0_0_24px_hsl(var(--primary)/0.35)]'
              : 'bg-[hsl(var(--card)/0.85)] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--foreground))]'
          }`}
          title={
            isInteractive
              ? (lang === 'es' ? 'Clic para bloquear y permitir el scroll de página' : 'Click to lock and allow page scroll')
              : (lang === 'es' ? 'Doble clic en el auto o clic aquí para activar órbita 3D' : 'Double click or click here to activate 3D')
          }
          aria-pressed={isInteractive}
        >
          {isInteractive ? (
            <>
              <Unlock className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
              <span>{lang === 'es' ? '3D Activo · Bloquear' : '3D Active · Lock'}</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
              <span>{lang === 'es' ? '2ble clic para activar 3D' : '2ble click for 3D'}</span>
            </>
          )}
        </button>
      </div>

      {/* Floating Control Bar */}
      <div className="absolute bottom-4 right-4 sm:bottom-5 sm:right-5 z-20 pointer-events-auto flex items-center gap-2">
        {/* Reset / Center View Button */}
        <button
          type="button"
          onClick={resetView}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.85)] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--foreground))] transition-all duration-300 backdrop-blur-md shadow-md cursor-pointer text-xs font-mono font-medium"
          title={lang === 'es' ? 'Centrar vista del vehículo' : 'Center vehicle view'}
          aria-label={lang === 'es' ? 'Centrar vista' : 'Center view'}
        >
          <Compass className="w-3.5 h-3.5" />
          <span className="hidden sm:inline uppercase tracking-wider">{lang === 'es' ? 'Centrar' : 'Center'}</span>
        </button>

        {/* Auto-Rotate Spin Button */}
        <button
          type="button"
          onClick={() => setAutoRotate(!autoRotate)}
          className={`flex items-center gap-2.5 px-4 py-2 rounded-full border transition-all duration-300 backdrop-blur-md shadow-lg cursor-pointer ${
            autoRotate
              ? 'bg-[hsl(var(--primary)/0.18)] border-[hsl(var(--primary)/0.6)] text-[hsl(var(--primary))] shadow-[0_0_24px_hsl(var(--primary)/0.35)]'
              : 'bg-[hsl(var(--card)/0.85)] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--foreground))]'
          }`}
          title={autoRotate ? (lang === 'es' ? 'Pausar giro automático' : 'Pause rotation') : (lang === 'es' ? 'Girar vehículo' : 'Spin car')}
          aria-label={autoRotate ? 'Pausar giro' : 'Girar vehículo'}
        >
          <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
          <span className="font-mono text-xs font-semibold tracking-wider uppercase">
            {lang === 'es' ? 'Giro 3D' : 'Spin 3D'}
          </span>
        </button>

        {/* Fullscreen Button */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex items-center justify-center w-9 h-9 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.85)] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--foreground))] transition-all duration-300 backdrop-blur-md shadow-md cursor-pointer"
          title={isFullscreen ? (lang === 'es' ? 'Salir de pantalla completa' : 'Exit fullscreen') : (lang === 'es' ? 'Pantalla completa' : 'Fullscreen')}
          aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
