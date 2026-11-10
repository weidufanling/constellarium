const journeyForm = get('catchment-form');
const fieldset = get('catchment-fields');
const runCatchment = get('run-catchment');
const selectionLabel = get('catchment-selection');
const journeyError = get('catchment-error');
const journeyResults = get('catchment-results');
const downloadActions = get('catchment-actions');
const entriesById = new Map(workingSpecialists.map((entry) => [entry.id, entry]));
const fieldInputs = new Map();
const formatMeasure = new Intl.NumberFormat('en-AU', {maximumFractionDigits: 2});
let runSelection = [];
let currentResult = null;

for (const field of catchmentJourney.fields) {
  const id = 'catchment-' + field.key;
  const label = make('label', '', field.label + ' (' + field.unit + ')');
  label.htmlFor = id;
  const input = make('input');
  input.type = 'number';
  input.inputMode = 'decimal';
  input.id = id;
  input.name = field.key;
  input.min = field.min;
  input.max = field.max;
  input.step = field.step;
  input.value = field.default;
  input.required = true;
  fieldInputs.set(field.key, input);
  label.append(input);
  fieldset.append(label);
}

function clearJourneyResult() {
  currentResult = null;
  journeyResults.replaceChildren();
  journeyResults.hidden = true;
  downloadActions.hidden = true;
  journeyError.textContent = '';
  journeyError.hidden = true;
  for (const input of fieldInputs.values()) input.removeAttribute('aria-invalid');
}

function setJourneySelection(ids, single = false) {
  runSelection = ids.filter((id) => entriesById.has(id));
  fieldset.disabled = runSelection.length === 0;
  runCatchment.disabled = fieldset.disabled;
  const labels = runSelection.map((id) => entriesById.get(id).name);
  selectionLabel.textContent = labels.length
    ? (single ? 'Trying one specialist. ' : 'Working constellation. ') + labels.join(' · ')
    : 'Choose a working specialist above to start.';
  clearJourneyResult();
}

const workingCatalogue = initCapabilityCatalogue({
  onSelectionChange: (ids) => setJourneySelection(ids),
  onRun: (id) => {
    const direct = id !== 'combined';
    setJourneySelection(direct ? [id] : workingCatalogue.getSelection(), direct);
    if (!runSelection.length) return;
    get('catchment-workbench').scrollIntoView({block: 'start'});
    get('catchment-title').focus({preventScroll: true});
  }
});

get('browse-ring').addEventListener('click', () => {
  workingCatalogue.setRing(genre);
  get('capability-title').tabIndex = -1;
  get('capability-title').focus({preventScroll: true});
});
get('find-tools').addEventListener('click', () => workingCatalogue.setRing('all'));

function comparisonText(scenario) {
  if (scenario.outflowVolume === null) {
    return 'Deficit of ' + formatMeasure.format(scenario.deficitDepth) + ' mm';
  }
  return formatMeasure.format(scenario.outflowVolume) + ' m³ (' + formatMeasure.format(scenario.outflowDepth) + ' mm)';
}

function displayComparison(comparison) {
  const figure = make('figure', 'catchment-figure');
  const caption = make('figcaption', '', 'Estimated outflow over the period');
  const rows = make('ul');
  const maximum = Math.max(1, ...comparison.scenarios.map((row) => row.outflowVolume ?? 0));
  for (const scenario of comparison.scenarios) {
    const line = make('li');
    line.append(make('span', '', scenario.label + ' · ' + comparisonText(scenario)));
    if (scenario.outflowVolume !== null) {
      const track = make('span', 'bar-track');
      const bar = make('span', 'bar-value');
      track.setAttribute('aria-hidden', 'true');
      bar.style.width = (scenario.outflowVolume / maximum * 100) + '%';
      track.append(bar);
      line.append(track);
    }
    rows.append(line);
  }
  figure.append(caption, rows);
  if (comparison.changeVolume !== null) {
    const delta = comparison.changeVolume;
    const sign = delta > 0 ? '+' : '';
    figure.append(make('p', '', 'Change from A to B · ' + sign + formatMeasure.format(delta) + ' m³.'));
  }
  return figure;
}

function sourceList(sources) {
  const list = make('ul');
  for (const source of sources) {
    const item = make('li');
    const link = make('a', '', source.label);
    link.href = source.link;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    item.append(link, document.createTextNode('. ' + source.summary));
    list.append(item);
  }
  return list;
}

function displayJourney(result) {
  const heading = make('h3', '', result.sections.length === 1 ? 'Specialist result' : 'Constellation result');
  heading.tabIndex = -1;
  journeyResults.append(heading);
  if (result.comparison) journeyResults.append(displayComparison(result.comparison));
  for (const section of result.sections) {
    const contribution = make('article', 'catchment-output');
    contribution.dataset.role = section.role;
    contribution.append(make('h4', '', section.title), make('p', '', section.body));
    if (section.items?.length) {
      const list = make('ul');
      for (const entry of section.items) list.append(make('li', '', entry));
      contribution.append(list);
    }
    const sources = result.sources.filter((source) => section.sourceIds?.includes(source.id));
    if (sources.length) {
      const details = make('details', 'catchment-sources');
      details.append(make('summary', '', 'Sources for this contribution'), sourceList(sources));
      contribution.append(details);
    }
    journeyResults.append(contribution);
  }
  journeyResults.hidden = false;
  downloadActions.hidden = false;
  heading.focus();
}

journeyForm.addEventListener('input', clearJourneyResult);
get('reset-catchment').addEventListener('click', () => {
  for (const field of catchmentJourney.fields) fieldInputs.get(field.key).value = field.default;
  clearJourneyResult();
});
journeyForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!runSelection.length) return;
  clearJourneyResult();
  const inputValues = Object.fromEntries([...fieldInputs].map(([key, input]) => [key, input.value]));
  try {
    currentResult = catchmentJourney.combine(inputValues, runSelection);
  } catch (error) {
    const field = catchmentJourney.fields.find((entry) => error.message.startsWith(entry.label));
    journeyError.textContent = field ? error.message : 'Check the catchment inputs and try again.';
    journeyError.hidden = false;
    if (field) {
      const control = fieldInputs.get(field.key);
      control.setAttribute('aria-invalid', 'true');
      control.focus();
    }
    return;
  }
  displayJourney(currentResult);
});

function resultText(result) {
  const lines = [
    'Constellarium · Compare two rainfall scenarios',
    '',
    catchmentJourney.scope,
    '',
    'Inputs for one accounting period',
    ...catchmentJourney.fields.map((field) => field.label + ' · ' + formatMeasure.format(result.inputs[field.key]) + ' ' + field.unit),
    ''
  ];
  if (result.comparison) {
    lines.push('Estimated outflow',
      ...result.comparison.scenarios.map((row) => row.label + ' · ' + comparisonText(row)), '');
    if (result.comparison.changeVolume !== null) {
      lines.push('Change from A to B · ' + formatMeasure.format(result.comparison.changeVolume) + ' m³', '');
    }
  }
  for (const section of result.sections) {
    lines.push(section.title, section.body, ...(section.items ?? []).map((item) => '* ' + item));
    for (const source of result.sources.filter((item) => section.sourceIds?.includes(item.id))) {
      lines.push(source.label, source.link);
    }
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

get('download-catchment').addEventListener('click', () => {
  if (!currentResult) return;
  const url = URL.createObjectURL(new Blob([resultText(currentResult)], {type: 'text/plain;charset=utf-8'}));
  const link = make('a');
  link.href = url;
  link.download = 'constellarium-catchment-result.txt';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
});
