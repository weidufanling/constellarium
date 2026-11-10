const workingSpecialists = Object.freeze([
  Object.freeze({
    id: 'hydrology',
    name: 'Hydrology Learning and Water Management',
    ring: 'math',
    summary: 'Calculate a water balance for two rainfall scenarios and compare the volume leaving a sample catchment.'
  }),
  Object.freeze({
    id: 'ecology',
    name: 'Ecology',
    ring: 'life',
    summary: 'Read the rainfall contrast in context and see how soil, cover and starting wetness can change what happens.'
  }),
  Object.freeze({
    id: 'audit',
    name: 'Research Reproducibility & Evidence Auditor',
    ring: 'evidence',
    summary: 'Check whether the inputs can balance and trace the assumptions to their published sources.'
  })
]);

const catchmentJourney = (() => {
  const fields = [
    {key: 'area', label: 'Catchment area', unit: 'ha', default: 25, min: 0.1, max: 10000, step: 0.1},
    {key: 'rainA', label: 'Scenario A rainfall', unit: 'mm', default: 60, min: 0, max: 10000, step: 0.1},
    {key: 'rainB', label: 'Scenario B rainfall', unit: 'mm', default: 90, min: 0, max: 10000, step: 0.1},
    {key: 'evapotranspiration', label: 'Evapotranspiration', unit: 'mm', default: 35, min: 0, max: 10000, step: 0.1},
    {key: 'storageChange', label: 'Change in water storage', unit: 'mm', default: 10, min: -10000, max: 10000, step: 0.1}
  ].map(Object.freeze);
  const defaults = Object.freeze(Object.fromEntries(fields.map(field => [field.key, field.default])));
  const sources = [
    {
      id: 'water-budget',
      label: 'USGS Water Budgets, appendix A',
      link: 'https://water.usgs.gov/watercensus/AdHocComm/Background/WaterBudgets-FoundationsforEffectiveWater-ResourcesandEnvironmentalManagement.pdf',
      summary: 'Equation A1 accounts for precipitation, inflow, evapotranspiration, change in storage and outflow over the same period.'
    },
    {
      id: 'runoff-context',
      label: 'USGS report on drainage and downstream flow',
      link: 'https://pubs.usgs.gov/publication/sir20255023/full',
      summary: 'The report describes how soil properties, prior soil moisture, land cover and slope affect infiltration and water movement.'
    }
  ].map(Object.freeze);
  const scope = 'This is a fictional catchment and an educational water balance. Use local measurements and qualified advice for real catchment decisions.';
  const formatter = new Intl.NumberFormat('en-AU', {maximumFractionDigits: 2});
  const number = value => formatter.format(value);
  const tenths = value => Math.round(value * 10);

  function normalise(raw) {
    return Object.fromEntries(fields.map(({key, label, min, max, unit}) => {
      const entry = raw?.[key];
      const value = typeof entry === 'number' || (typeof entry === 'string' && entry.trim() !== '')
        ? Number(entry) : NaN;
      if (!Number.isFinite(value) || value < min || value > max) {
        throw new Error(label + ' must be between ' + number(min) + ' and ' + number(max) + ' ' + unit + '.');
      }
      if (Math.abs(value * 10 - tenths(value)) > 1e-8) {
        throw new Error(label + ' can have up to one decimal place.');
      }
      return [key, tenths(value) / 10 || 0];
    }));
  }

  function residual(rain, inputs) {
    return tenths(rain) - tenths(inputs.evapotranspiration) - tenths(inputs.storageChange);
  }

  function calculate(raw) {
    const inputs = normalise(raw);
    const scenarios = ['A', 'B'].map(scenario => {
      const rainfall = inputs['rain' + scenario];
      const balance = residual(rainfall, inputs);
      return {
        label: 'Scenario ' + scenario,
        rainfall,
        outflowDepth: balance < 0 ? null : balance / 10,
        outflowVolume: balance < 0 ? null : balance * tenths(inputs.area) / 10,
        deficitDepth: balance < 0 ? -balance / 10 : null
      };
    });
    const [a, b] = scenarios;
    const consistent = a.deficitDepth === null && b.deficitDepth === null;
    const depthDifference = tenths(b.rainfall) - tenths(a.rainfall);
    const comparison = {
      scenarios,
      changeDepth: consistent ? depthDifference / 10 : null,
      changeVolume: consistent ? depthDifference * tenths(inputs.area) / 10 : null
    };
    return {
      role: 'hydrology',
      title: 'Hydrology calculated the water balance',
      body: 'For this accounting period, outflow equals rainfall minus evapotranspiration minus change in storage. The example sets external inflow to zero and holds area, evapotranspiration and storage change fixed.',
      items: [
        ...scenarios.map(scenario => {
          const result = scenario.deficitDepth === null
            ? number(scenario.outflowDepth) + ' mm of outflow.'
            : 'a deficit of ' + number(scenario.deficitDepth) + ' mm under the zero-inflow assumption.';
          return scenario.label + ' starts with ' + number(scenario.rainfall) + ' mm of rainfall and has ' + result;
        }),
        'One millimetre over one hectare is 10 cubic metres. A negative storage change represents water released from storage.'
      ],
      sourceIds: ['water-budget'],
      comparison
    };
  }

  function interpret(raw, comparison = null) {
    const inputs = normalise(raw);
    const body = inputs.rainB === inputs.rainA
      ? 'Both scenarios receive the same rainfall. In real catchments, differences in ground cover and soil wetness can still change how water moves.'
      : 'Scenario ' + (inputs.rainB > inputs.rainA ? 'B' : 'A') + ' receives more rainfall. How much water soaks in, stays in storage or leaves during the period depends in part on the soil and how wet it was at the start.';
    const items = [
      'Check soil type and starting moisture. These affect how quickly water enters the ground and how much the ground can hold.',
      'Check ground cover and slope. These can change how long water stays on the surface before it moves downstream.',
      'The water balance describes a total over the period. Timing and peak flow need separate information.'
    ];
    if (comparison?.changeDepth === null) {
      items.unshift('One or both water balances have a deficit. Resolve those inputs before comparing estimated outflow.');
    }
    return {
      role: 'ecology',
      title: 'Ecology explained what else affects the result',
      body,
      items,
      sourceIds: ['runoff-context']
    };
  }

  function audit(raw, comparison = null) {
    const inputs = normalise(raw);
    const deficits = ['A', 'B'].filter(scenario => residual(inputs['rain' + scenario], inputs) < 0);
    const body = deficits.length
      ? 'Check ' + (deficits.length === 2 ? 'both scenarios' : 'Scenario ' + deficits[0]) + '. Under the zero-inflow assumption, the budget requires more water than the inputs provide.'
      : 'Both scenarios can balance with the inputs provided. The sources support the method and the factors to check. The rainfall and other inputs are illustrative.';
    const items = [
      'Use a single period and catchment area for both scenarios. Keep inputs in millimetres before converting outflow to cubic metres.',
      'For a real site, check the catchment boundary, measure rainfall and flow, and document storage change and evapotranspiration.',
      'Check whether external inflows or withdrawals need their own terms. The example leaves these outside the calculation.'
    ];
    if (inputs.storageChange < 0) {
      items.push('A drop in storage assumes that water was already available at the start of the period.');
    }
    if (comparison) {
      const consistency = Array.isArray(comparison.scenarios) && comparison.scenarios.length === 2
        && comparison.scenarios.every((scenario, index) => {
          const expectedDepth = residual(inputs[index === 0 ? 'rainA' : 'rainB'], inputs);
          return expectedDepth < 0
            ? scenario?.outflowDepth === null && scenario.outflowVolume === null && scenario.deficitDepth === -expectedDepth / 10
            : scenario?.deficitDepth === null && scenario.outflowDepth === expectedDepth / 10
              && scenario.outflowVolume === expectedDepth * tenths(inputs.area) / 10;
        });
      if (!consistency) {
        items.unshift('Check the calculation against the equation and the area conversion before using the result.');
      } else if (deficits.length) {
        items.unshift('The calculation identifies the deficit in each flagged row.');
      } else {
        items.unshift('The calculation agrees with the equation and the area conversion for both rows.');
      }
    }
    return {
      role: 'audit',
      title: 'Evidence Audit checked the inputs and sources',
      body,
      items,
      sourceIds: ['water-budget', 'runoff-context']
    };
  }

  function combine(raw, selectedRoleIds) {
    const inputs = normalise(raw);
    if (!Array.isArray(selectedRoleIds) || selectedRoleIds.length === 0) {
      throw new Error('Choose at least one working specialist for this comparison.');
    }
    const chosen = new Set(selectedRoleIds);
    if ([...chosen].some(id => !workingSpecialists.some(role => role.id === id))) {
      throw new Error('Choose a working specialist for this comparison.');
    }
    const roles = workingSpecialists.map(role => role.id).filter(id => chosen.has(id));
    const sections = [];
    let comparison = null;
    if (chosen.has('hydrology')) {
      const {comparison: hydrologyComparison, ...section} = calculate(inputs);
      comparison = hydrologyComparison;
      sections.push(section);
    }
    if (chosen.has('ecology')) sections.push(interpret(inputs, comparison));
    if (chosen.has('audit')) sections.push(audit(inputs, comparison));
    const sourceIds = new Set(sections.flatMap(section => section.sourceIds));
    return {
      inputs,
      roles,
      sections,
      sources: sources.filter(source => sourceIds.has(source.id)),
      comparison,
      scope
    };
  }

  return Object.freeze({
    defaults,
    fields: Object.freeze(fields),
    sources: Object.freeze(sources),
    scope,
    calculate,
    interpret,
    audit,
    combine
  });
})();
