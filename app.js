const get = (id) => document.getElementById(id);
const places = get('places');
const rings = get('rings');
const canvas = get('globe');
const markers = get('map-markers');
const collect = get('collect');
const roster = get('roster');
const compose = get('compose-button');
const reset = get('reset');
const inquire = get('inquiry');
const stage = get('formation');
const example = get('example');
const selected = [];
let city = cities[0];
let genre = 'math';
let inside = false;

function make(tag, className, label) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (label) element.textContent = label;
  return element;
}

function button(label, className, click) {
  const control = make('button', className, label);
  control.type = 'button';
  control.addEventListener('click', click);
  return control;
}

function dot(color) {
  const element = make('span', 'ring-dot');
  element.style.setProperty('--ring', color);
  element.setAttribute('aria-hidden', 'true');
  return element;
}

const placeButtons = new Map();
const mapButtons = new Map();
const ringButtons = new Map();
for (const place of cities) {
  const jump = button(place.name, '', () => choosePlace(place));
  jump.setAttribute('aria-label', place.name + ', ' + place.region);
  places.append(jump);
  placeButtons.set(place.id, jump);

  const marker = button('', 'map-marker', () => choosePlace(place));
  marker.append(make('span', '', place.name));
  marker.setAttribute('aria-label', 'Map pin for ' + place.name + ', ' + place.region);
  marker.style.setProperty('--marker', colors.math);
  marker.hidden = true;
  markers.append(marker);
  mapButtons.set(place.id, marker);
}
for (const [id, name] of Object.entries(names)) {
  const control = button('', '', () => chooseRing(id));
  control.append(dot(colors[id]), document.createTextNode(name));
  rings.append(control);
  ringButtons.set(id, control);
}

function placeMarkers(points) {
  const rect = canvas.getBoundingClientRect();
  const ordered = [city, ...cities.filter((place) => place !== city)];
  const boxes = [];
  for (const place of ordered) {
    const marker = mapButtons.get(place.id);
    const point = points[place.id];
    const visible = point?.visible && point.x > 25 && point.x < rect.width - 25
      && point.y > 44 && point.y < rect.height - 55;
    if (!visible) {
      if (marker === document.activeElement) placeButtons.get(place.id).focus({preventScroll: true});
      marker.hidden = true;
      continue;
    }
    const labelWidth = place.name.length * 8 + 16;
    const reverse = point.x + labelWidth + 22 > rect.width;
    const left = reverse ? point.x - labelWidth - 17 : point.x - 11;
    const right = reverse ? point.x + 11 : point.x + labelWidth + 17;
    const overlaps = boxes.some((box) => left < box.right && right > box.left && Math.abs(point.y - box.y) < 42);
    marker.hidden = overlaps;
    if (overlaps) {
      if (marker === document.activeElement) placeButtons.get(place.id).focus({preventScroll: true});
      continue;
    }
    boxes.push({left, right, y: point.y});
    marker.classList.toggle('reverse', reverse);
    marker.style.left = point.x + 'px';
    marker.style.top = point.y + 'px';
  }
}

const globe = createGlobe({canvas, land, cities, colors, onRender: placeMarkers});

function announce(message) {
  get('announce').textContent = message;
}

function choosePlace(place) {
  city = place;
  showSpecialist();
  globe.center(city);
}

function chooseRing(id) {
  genre = id;
  showSpecialist();
  globe.setRing(genre);
}

function changeView(isInside) {
  inside = isInside;
  get('inner-view').setAttribute('aria-pressed', inside);
  get('outer-view').setAttribute('aria-pressed', !inside);
  get('view-label').textContent = inside ? 'EARTH · INSIDE THE RINGS' : 'EARTH · ORBIT VIEW';
  get('view-hint').textContent = inside
    ? 'Drag to look around from the centre of Earth. The coloured paths mark four discipline rings.'
    : 'Drag to turn the globe, use the arrows or jump to a place.';
  canvas.classList.toggle('immersive', inside);
  globe.setView(inside);
}
get('inner-view').addEventListener('click', () => changeView(true));
get('outer-view').addEventListener('click', () => changeView(false));
for (const control of document.querySelectorAll('[data-pan]')) {
  const [lon, lat] = control.dataset.pan.split(',').map(Number);
  control.addEventListener('click', () => globe.pan(lon, lat));
}

let drag;
canvas.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  drag = {id: event.pointerId, x: event.clientX, y: event.clientY};
  canvas.setPointerCapture(drag.id);
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  const scale = 160 / Math.max(canvas.clientWidth, 1);
  globe.pan(-dx * scale, dy * scale);
  drag.x = event.clientX;
  drag.y = event.clientY;
});
function endDrag(event) {
  if (event.pointerId !== drag?.id) return;
  drag = null;
  canvas.classList.remove('dragging');
}
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(type, endDrag);
}

function showSpecialist() {
  for (const [id, control] of placeButtons) control.setAttribute('aria-pressed', id === city.id);
  for (const [id, control] of mapButtons) {
    control.setAttribute('aria-pressed', id === city.id);
    control.style.setProperty('--marker', colors[genre]);
  }
  for (const [id, control] of ringButtons) control.setAttribute('aria-pressed', id === genre);
  const [name, description] = city.spec[genre];
  get('specialist-kicker').textContent = 'ILLUSTRATIVE SPECIALIST · ' + city.name + ', ' + city.region;
  get('specialist-title').textContent = name;
  get('specialist-description').textContent = description;
  const exists = selected.some((spec) => spec.place === city && spec.ring === genre);
  const full = selected.filter((spec) => spec.ring === genre).length >= 2;
  collect.setAttribute('aria-disabled', exists || full);
  collect.textContent = exists ? 'Already added' : full ? 'Two in this ring' : 'Add specialist +';
}

function svg(tag, attributes) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

const formationSlots = [[180, 72], [246, 101], [119, 108], [116, 44], [207, 35], [284, 65], [192, 126], [77, 76]];
function drawFormation() {
  const elements = [];
  for (const radius of [38, 75, 119]) {
    elements.push(svg('ellipse', {cx: 180, cy: 78, rx: radius, ry: radius * .49, class: 'orbit-path'}));
  }
  for (let i = 0; i < 38; i++) {
    elements.push(svg('circle', {cx: (i * 137 + 19) % 350 + 5, cy: (i * 71 + 13) % 145 + 5, r: i % 3 === 0 ? 1 : .55, fill: '#d6e4ff', opacity: .4}));
  }
  const points = formationSlots.slice(0, selected.length);
  if (points.length > 1) {
    elements.push(svg('polyline', {points: points.map((point) => point.join(',')).join(' '), class: 'star-link'}));
  }
  for (const [i, [x, y]] of points.entries()) {
    const color = colors[selected[i].ring];
    elements.push(svg('circle', {cx: x, cy: y, r: 10, fill: color, opacity: .19}));
    elements.push(svg('path', {d: 'M' + (x - 7) + ' ' + y + 'h14 M' + x + ' ' + (y - 7) + 'v14', stroke: color, opacity: .78}));
    elements.push(svg('circle', {cx: x, cy: y, r: 3, fill: '#fff8e7'}));
  }
  stage.replaceChildren(...elements);
  get('formation-label').textContent = points.length === 0 ? 'Add a specialist to place the first star.'
    : points.length === 1 ? 'One star in your constellation.' : points.length + ' stars in your constellation.';
}

function showSelection() {
  roster.replaceChildren();
  roster.hidden = selected.length === 0;
  for (const [index, spec] of selected.entries()) {
    const item = make('li');
    const name = spec.place.spec[spec.ring][0];
    const summary = make('span', '', name);
    summary.append(make('small', '', spec.place.name + ' · ' + names[spec.ring]));
    const remove = button('Remove', 'remove', () => {
      selected.splice(index, 1);
      showSelection();
      const next = roster.querySelectorAll('button')[index] || roster.querySelector('button') || collect;
      next.focus();
      announce(name + ' removed.');
    });
    remove.setAttribute('aria-label', 'Remove ' + name);
    item.append(dot(colors[spec.ring]), summary, remove);
    roster.append(item);
  }
  get('counter').textContent = selected.length + ' / 8';
  compose.disabled = selected.length < 2;
  reset.disabled = selected.length === 0;
  inquire.hidden = true;
  showSpecialist();
  drawFormation();
}

collect.addEventListener('click', () => {
  if (collect.getAttribute('aria-disabled') === 'true') return;
  selected.push({place: city, ring: genre});
  showSelection();
  announce(city.spec[genre][0] + ' added. ' + selected.length + ' selected.');
});
reset.addEventListener('click', () => {
  selected.length = 0;
  showSelection();
  collect.focus();
  announce('Constellation cleared.');
});
example.addEventListener('click', () => {
  const preset = [{place: cities[0], ring: 'math'}, {place: cities[1], ring: 'life'}, {place: cities[2], ring: 'art'}];
  for (const spec of preset) {
    const inRing = selected.filter(({ring}) => ring === spec.ring);
    if (inRing.length < 2 && !inRing.some(({place}) => place === spec.place)) selected.push(spec);
  }
  showSelection();
  announce('Example specialists added where there was room. ' + selected.length + ' selected.');
});

const perspectives = {
  math: 'Sketch a simple model. What could you count or compare to see whether the pattern holds?',
  life: 'Look for a living example. How might its environment and history shape what you see?',
  art: 'Describe the pattern as if you were seeing it for the first time. Which details does that description bring back into view?',
  space: 'Look for a similar shape or movement in the sky. What observations would distinguish its causes from those on Earth?'
};

compose.addEventListener('click', () => {
  if (selected.length < 2) return;
  const distinct = new Set(selected.map((spec) => spec.ring));
  const title = get('inquiry-title');
  title.textContent = distinct.size > 1
    ? 'What can a pattern tell us about how it formed?'
    : 'How would two specialists in this ring test the same idea?';
  const entries = [...distinct].map((id) => {
    const item = make('li');
    const contributors = selected.filter((spec) => spec.ring === id).map((spec) => spec.place.spec[id][0]);
    item.append(make('strong', '', names[id] + ' · ' + contributors.join(' and ')), document.createTextNode(perspectives[id]));
    return item;
  });
  if (distinct.size > 1) {
    const last = make('li');
    last.append(make('strong', '', 'Bring the observations together'), document.createTextNode('Compare what each approach could explain. List a question they leave open, and one way you could investigate it.'));
    entries.push(last);
  }
  get('inquiry-list').replaceChildren(...entries);
  inquire.hidden = false;
  title.focus();
});

choosePlace(city);
chooseRing(genre);
showSelection();
