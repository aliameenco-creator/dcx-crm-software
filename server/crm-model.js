export const entities = {
  customers: { required: ['name'], fields: ['name', 'phone', 'notes', 'contact', 'email', 'billing_address', 'price_book'] },
  contacts: { required: ['name', 'email'], fields: ['name', 'email', 'phone', 'notes'] },
  sites: { required: ['name', 'address'], fields: ['name', 'address', 'notes'] },
  equipment: { required: ['name', 'site_id'], fields: ['name', 'site_id', 'model', 'serial_number', 'battery_configuration', 'source', 'confirmed_on', 'notes'] },
  purchases: { required: ['name', 'occurred_on', 'source'], fields: ['name', 'equipment_id', 'occurred_on', 'amount', 'source', 'notes'] },
  services: { required: ['name', 'occurred_on', 'source'], fields: ['name', 'equipment_id', 'occurred_on', 'source', 'notes'] },
};
export const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function validateRecord(entity, input) {
  const definition = entities[entity];
  if (!definition || !input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid record.');
  const output = {};
  if (entity !== 'customers') {
    if (!uuid(input.customer_id)) throw new Error('Select a customer.');
    output.customer_id = input.customer_id;
  }
  for (const field of definition.fields) {
    const value = input[field];
    if (field === 'amount') {
      if (value === '' || value === null || value === undefined) { output[field] = null; continue; }
      if (!['string', 'number'].includes(typeof value) || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 999999999) throw new Error('Enter a valid non-negative CAD amount.');
      output[field] = Math.round(Number(value) * 100) / 100; continue;
    }
    if (value != null && typeof value !== 'string') throw new Error(`Invalid ${field}.`);
    const text = (value || '').trim();
    if (text.length > (field === 'notes' ? 10000 : 1000)) throw new Error(`${field} is too long.`);
    if (definition.required.includes(field) && !text) throw new Error(`${field.replaceAll('_', ' ')} is required.`);
    if (field.endsWith('_id')) { if (text && !uuid(text)) throw new Error('Invalid linked record.'); output[field] = text || null; }
    else if (field.endsWith('_on')) {
      if (text && (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text)) || new Date(text).toISOString().slice(0, 10) !== text)) throw new Error('Enter a valid date.');
      output[field] = text || null;
    } else output[field] = field === 'email' ? text.toLowerCase() : text;
  }
  if ((entity === 'contacts' || (entity === 'customers' && output.email)) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(output.email)) throw new Error('Enter a valid email address.');
  if (entity === 'customers' && !output.price_book) output.price_book = 'standard';
  return output;
}
