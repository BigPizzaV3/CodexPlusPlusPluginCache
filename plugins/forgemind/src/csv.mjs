import { ForgeMindError } from './errors.mjs';

export function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (character === '"' && content[index + 1] === '"') field += '"', index += 1;
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"' && field === '') quoted = true;
    else if (character === ',') row.push(field), field = '';
    else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += character;
  }
  if (quoted) throw new ForgeMindError('FM_SIGNAL_INVALID', 'CSV contains an unterminated quoted field.');
  if (field || row.length) row.push(field), rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map((header) => header.trim());
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw new ForgeMindError('FM_SIGNAL_INVALID', `CSV row ${index + 2} has ${values.length} fields; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
  });
}
