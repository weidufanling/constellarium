function createGlobe({canvas, land, cities, colors, onRender}) {
  const radians = Math.PI / 180;
  const circle = 2 * Math.PI;
  const clamp = (value, lower, upper) => Math.max(lower, Math.min(value, upper));
  const wrapLongitude = value => ((value + 180) % 360 + 360) % 360 - 180;
  let ctx;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }

  function point(lon, lat) {
    const a = lat * radians;
    const b = lon * radians;
    return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)];
  }

  const coastlines = land.map(path => path.map(([lon, lat]) => point(lon, lat)));
  const places = cities.map(city => ({id: city.id, point: point(city.lon, city.lat)}));
  const meridians = Array.from({length: 12}, (_, i) =>
    Array.from({length: 61}, (_, j) => point(i * 30, j * 3 - 90)));
  const parallels = Array.from({length: 5}, (_, i) =>
    Array.from({length: 121}, (_, j) => point(j * 3 - 180, i * 30 - 60)));
  const graticule = [...meridians, ...parallels];

  // The rings are real circles at four elevations in the observer's local frame.
  const ringElevations = [17, -3, -24, -45];
  const rings = Object.entries(colors).map(([id, color], i) => {
    const elevation = ringElevations[i] * radians;
    const ring = Array.from({length: 121}, (_, j) =>
      point(j * 3 - 180, ringElevations[i]));
    return {id, color, ring, elevation};
  });

  let seed = 42348;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const stars = Array.from({length: 155}, () => ({
    x: random(), y: random(), size: 0.35 + random() ** 3 * 1.2,
    glow: 0.19 + random() * 0.63
  }));

  let width = 0;
  let height = 0;
  let midX = 0;
  let midY = 0;
  let radius = 0;
  let insideScale = 0;
  let yaw = 0;
  let pitch = 0;
  let sinYaw = 0;
  let cosYaw = 1;
  let sinPitch = 0;
  let cosPitch = 1;
  let inside = false;
  let activeRing = rings[0]?.id;
  let frame = 0;

  // The spherical projection follows the v0.1 camera basis. A globe uses
  // its orthographic disk, while the view at the centre uses angular distance.
  function camera([x, y, z]) {
    const forward = x * sinYaw + z * cosYaw;
    return [x * cosYaw - z * sinYaw, y * cosPitch - forward * sinPitch,
      y * sinPitch + forward * cosPitch];
  }

  function onGlobe([right, up, depth]) {
    return {x: midX + right * radius, y: midY - up * radius, depth};
  }

  function fromInside([right, up, depth]) {
    const angle = Math.acos(clamp(depth, -1, 1));
    const norm = Math.hypot(right, up);
    const scale = norm > 1e-8 ? angle * insideScale / norm : 0;
    return {x: midX + right * scale, y: midY - up * scale, depth};
  }

  function drawSky() {
    const glow = ctx.createRadialGradient(width * .55, height * .42, 0,
      width * .55, height * .42, Math.max(width, height) * .63);
    glow.addColorStop(0, inside ? '#192c49' : '#162641');
    glow.addColorStop(.52, '#101a2c');
    glow.addColorStop(1, '#080e1a');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#cfdef8';
    const count = width < 430 ? 106 : stars.length;
    for (const {x, y, size, glow: opacity} of stars.slice(0, count)) {
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.arc(x * width, y * height, size, 0, circle);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function horizonPoint(a, b) {
    const t = a[2] / (a[2] - b[2]);
    const right = a[0] + (b[0] - a[0]) * t;
    const up = a[1] + (b[1] - a[1]) * t;
    const norm = Math.hypot(right, up);
    return onGlobe([right / norm, up / norm, 0]);
  }

  function visibleGlobeRuns(points, closed) {
    const views = points.map(camera);
    const runs = [];
    const firstHidden = closed ? views.findIndex(view => view[2] < 0) : -1;
    if (closed && firstHidden < 0) return [views.map(onGlobe)];
    let run = [];
    for (let i = 0; i < views.length; i++) {
      const index = firstHidden < 0 ? i : (firstHidden + i) % views.length;
      const current = views[index];
      const previous = i ? views[(index + views.length - 1) % views.length] : null;
      if (current[2] >= 0) {
        if (previous && previous[2] < 0) run.push(horizonPoint(previous, current));
        run.push(onGlobe(current));
      } else if (run.length) {
        run.push(horizonPoint(previous, current));
        runs.push(run);
        run = [];
      }
    }
    if (run.length) {
      if (firstHidden >= 0) run.push(horizonPoint(views[(firstHidden + views.length - 1) % views.length], views[firstHidden]));
      runs.push(run);
    }
    return runs;
  }

  function trace(points) {
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  }

  function fillLand(runs) {
    ctx.fillStyle = '#78baad29';
    ctx.beginPath();
    for (const run of runs) {
      trace(run);
      const first = run[0];
      const last = run[run.length - 1];
      if (first.depth === 0 && last.depth === 0) {
        const begin = Math.atan2(last.y - midY, last.x - midX);
        const end = Math.atan2(first.y - midY, first.x - midX);
        const delta = ((end - begin + 3 * Math.PI) % circle) - Math.PI;
        ctx.arc(midX, midY, radius, begin, begin + delta, delta < 0);
      }
      ctx.closePath();
    }
    ctx.fill();
  }

  function strokeRuns(runs) {
    ctx.beginPath();
    for (const run of runs) trace(run);
    ctx.stroke();
  }

  function drawGlobe() {
    const atmosphere = ctx.createRadialGradient(midX, midY, radius * .89,
      midX, midY, radius * 1.13);
    atmosphere.addColorStop(0, '#6eb7e43b');
    atmosphere.addColorStop(.47, '#72b8f44d');
    atmosphere.addColorStop(1, '#669ee300');
    ctx.fillStyle = atmosphere;
    ctx.beginPath();
    ctx.arc(midX, midY, radius * 1.13, 0, circle);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(midX, midY, radius, 0, circle);
    ctx.clip();
    const ocean = ctx.createRadialGradient(midX - radius * .35, midY - radius * .4, radius * .1,
      midX + radius * .23, midY + radius * .15, radius * 1.18);
    ocean.addColorStop(0, '#315f81');
    ocean.addColorStop(.53, '#224366');
    ocean.addColorStop(1, '#14243e');
    ctx.fillStyle = ocean;
    ctx.fillRect(midX - radius, midY - radius, radius * 2, radius * 2);

    const landRuns = coastlines.flatMap(path => visibleGlobeRuns(path, true));
    fillLand(landRuns);
    ctx.strokeStyle = '#acd1e92f';
    ctx.lineWidth = .8;
    strokeRuns(graticule.flatMap(path => visibleGlobeRuns(path, false)));
    ctx.strokeStyle = '#abdad1a8';
    ctx.lineWidth = .95;
    strokeRuns(landRuns);
    ctx.restore();

    ctx.strokeStyle = '#8ac8edc4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(midX, midY, radius, 0, circle);
    ctx.stroke();
  }

  function visibleInsideRuns(points, transform, minimumDepth) {
    const runs = [];
    let run = [];
    for (const point of points) {
      const view = transform(point);
      if (view[2] > minimumDepth) {
        run.push(fromInside(view));
      } else if (run.length) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length) runs.push(run);
    return runs;
  }

  function drawInside() {
    const nearSide = -.04;
    ctx.strokeStyle = '#99bdd528';
    ctx.lineWidth = .85;
    strokeRuns(graticule.flatMap(path => visibleInsideRuns(path, camera, nearSide)));
    ctx.strokeStyle = '#a2c8ce72';
    ctx.lineWidth = 1;
    strokeRuns(coastlines.flatMap(path => visibleInsideRuns(path, camera, nearSide)));

    for (const {id, color, ring, elevation} of rings) {
      const active = id === activeRing;
      const bands = visibleInsideRuns(ring, point => point, -.16);
      ctx.strokeStyle = color;
      ctx.globalAlpha = active ? .2 : .055;
      ctx.lineWidth = active ? 12 : 7;
      strokeRuns(bands);
      ctx.globalAlpha = active ? .98 : .57;
      ctx.lineWidth = active ? 2.25 : 1.15;
      strokeRuns(bands);
      ctx.fillStyle = color;
      for (let angle = -60; angle <= 60; angle += 15) {
        const tick = fromInside(point(angle, elevation / radians));
        ctx.beginPath();
        ctx.arc(tick.x, tick.y, angle === 0 && active ? 3 : 1.6, 0, circle);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function publishMarkers() {
    const results = {};
    for (const place of places) {
      const view = camera(place.point);
      const {x, y, depth} = inside ? fromInside(view) : onGlobe(view);
      const inFrame = x > 11 && x < width - 11 && y > 13 && y < height - 15;
      results[place.id] = {x, y, visible: depth > (inside ? -.04 : .065) && inFrame};
    }
    onRender(results);
  }

  function render() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (!ctx) {
      onRender({});
      return;
    }
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (width <= 0 || height <= 0) {
      onRender({});
      return;
    }
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * scale);
    const pixelHeight = Math.round(height * scale);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    midX = width * .5;
    midY = height * .49;
    radius = Math.min(width * .43, height * .43);
    insideScale = Math.min(width * .53, height * .86) / (Math.PI / 2);
    sinYaw = Math.sin(yaw * radians);
    cosYaw = Math.cos(yaw * radians);
    sinPitch = Math.sin(pitch * radians);
    cosPitch = Math.cos(pitch * radians);
    drawSky();
    if (inside) drawInside();
    else drawGlobe();
    publishMarkers();
  }

  function queueRender() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(queueRender).observe(canvas);
  }
  window.addEventListener('resize', queueRender, {passive: true});

  return {
    center(city) {
      yaw = city.lon;
      pitch = city.lat;
      queueRender();
    },
    pan(lonDelta, latDelta) {
      yaw = wrapLongitude(yaw + lonDelta);
      pitch = clamp(pitch + latDelta, -86, 86);
      queueRender();
    },
    setView(insideBoolean) {
      inside = insideBoolean;
      queueRender();
    },
    setRing(genre) {
      activeRing = genre;
      queueRender();
    },
    render
  };
}
