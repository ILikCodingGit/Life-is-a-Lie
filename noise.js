// Simplex noise - adapted from Stefan Gustavson's implementation
const Noise = (function() {
  const grad3 = [
    [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
    [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
    [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
  ];
  const p_base = [
    151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
    190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,
    125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,
    105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,
    135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,
    82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,
    153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,
    251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,
    157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,
    78,66,215,61,156,180
  ];

  let perm = new Uint8Array(512);
  let permMod12 = new Uint8Array(512);
  let _seed = 0;

  function seed(s) {
    _seed = s;
    const p = [...p_base];
    let n = s | 0;
    for (let i = 255; i > 0; i--) {
      n = (n * 1664525 + 1013904223) | 0;
      const j = ((n >>> 0) % (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) {
      perm[i] = p[i & 255];
      permMod12[i] = perm[i] % 12;
    }
  }

  function dot(g, x, y) { return g[0]*x + g[1]*y; }

  function noise2D(xin, yin) {
    const F2 = 0.5*(Math.sqrt(3)-1);
    const G2 = (3-Math.sqrt(3))/6;
    const s = (xin+yin)*F2;
    const i = Math.floor(xin+s);
    const j = Math.floor(yin+s);
    const t = (i+j)*G2;
    const X0 = i-t, Y0 = j-t;
    const x0 = xin-X0, y0 = yin-Y0;
    let i1, j1;
    if (x0 > y0) { i1=1; j1=0; } else { i1=0; j1=1; }
    const x1=x0-i1+G2, y1=y0-j1+G2;
    const x2=x0-1+2*G2, y2=y0-1+2*G2;
    const ii=i&255, jj=j&255;
    const gi0=permMod12[ii+perm[jj]];
    const gi1=permMod12[ii+i1+perm[jj+j1]];
    const gi2=permMod12[ii+1+perm[jj+1]];
    let t0=0.5-x0*x0-y0*y0;
    let n0 = t0<0 ? 0 : (t0*=t0, t0*t0*dot(grad3[gi0],x0,y0));
    let t1=0.5-x1*x1-y1*y1;
    let n1 = t1<0 ? 0 : (t1*=t1, t1*t1*dot(grad3[gi1],x1,y1));
    let t2=0.5-x2*x2-y2*y2;
    let n2 = t2<0 ? 0 : (t2*=t2, t2*t2*dot(grad3[gi2],x2,y2));
    return 70*(n0+n1+n2);
  }

  function octave(x, y, octs, persistence, lacunarity) {
    let val = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octs; i++) {
      val += noise2D(x*freq, y*freq)*amp;
      max += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    return val / max;
  }

  seed(0);
  return { seed, noise2D, octave };
})();