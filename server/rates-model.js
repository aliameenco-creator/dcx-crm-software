export function validatePriceBook(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid rate book.');
  const text = (key, max = 1000) => {
    if (typeof input[key] !== 'string' || input[key].length > max) throw new Error(`Invalid ${key}.`);
    return input[key].trim();
  };
  const id = text('id', 100), name = text('name');
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || !name) throw new Error('A rate book ID and name are required.');
  const date = key => {
    const value = text(key, 10);
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error('Invalid effective date.');
    return value;
  };
  const effectiveFrom = date('effectiveFrom'), effectiveTo = date('effectiveTo');
  if (!effectiveFrom || (effectiveTo && effectiveTo < effectiveFrom)) throw new Error('Check the effective dates.');
  if (!['Draft', 'Published'].includes(input.status)) throw new Error('Invalid rate status.');
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 200) throw new Error('Use between 1 and 200 rates per book.');
  const ids = new Set();
  const items = input.items.map(row => {
    if (!row || typeof row !== 'object') throw new Error('Invalid rate.');
    const result = {};
    for (const key of ['id', 'supplier', 'description', 'unit']) {
      if (typeof row[key] !== 'string' || row[key].length > 1000) throw new Error(`Invalid rate ${key}.`);
      result[key] = row[key].trim();
    }
    if (!result.id || !result.description || !result.unit || ids.has(result.id)) throw new Error('Rates need unique IDs, descriptions and units.');
    ids.add(result.id);
    if (!['manual', 'multiplier'].includes(row.costMode)) throw new Error('Invalid cost basis.');
    result.costMode = row.costMode;
    for (const key of ['supplierCost', 'multiplier', 'manualCost', 'margin', 'exchangeRate']) {
      if (typeof row[key] !== 'number' || !Number.isFinite(row[key]) || row[key] < 0 || row[key] > 1e9) throw new Error(`Invalid ${key}.`);
      result[key] = row[key];
    }
    if (result.margin >= 1 || result.exchangeRate <= 0) throw new Error('Margin must be below 100% and exchange must exceed zero.');
    if (Number.isInteger(row.sourceRow) && row.sourceRow > 0) result.sourceRow = row.sourceRow;
    return result;
  });
  return { id, name, description: text('description'), status: input.status, effectiveFrom, effectiveTo, items };
}
