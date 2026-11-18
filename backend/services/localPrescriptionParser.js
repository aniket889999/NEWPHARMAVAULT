'use strict';

/**
 * Local, rule-based prescription reader for OCR text. Nothing leaves the server.
 *
 * Understands the usual Indian prescription shorthand:
 *   "Tab. Dolo 650mg 1-0-1 x 5 days after food", "Cap Amoxicillin 500 mg BD x 3 days",
 *   "Syp. Ascoril 10ml TDS", "Tab Dolo 650 SOS for fever", "Dr. Ramesh Kulkarni MD", "Date: 18/11/2026".
 * Each medicine gets a confidence from how much of the line was understood; low ones are
 * flagged for the user to correct.
 */
const FORMS = { tab: 'Tablet', tablet: 'Tablet', cap: 'Capsule', capsule: 'Capsule', syp: 'Syrup', syrup: 'Syrup', inj: 'Injection', drops: 'Drops', oint: 'Ointment', susp: 'Suspension' };
const FREQ = {
  od: { text: 'Once daily (1-0-0)', times: ['09:00'] },
  hs: { text: 'At bedtime (0-0-1)', times: ['21:30'] },
  bd: { text: 'Twice daily (1-0-1)', times: ['08:00', '20:00'] },
  bid: { text: 'Twice daily (1-0-1)', times: ['08:00', '20:00'] },
  tds: { text: 'Three times daily (1-1-1)', times: ['08:00', '14:00', '20:00'] },
  tid: { text: 'Three times daily (1-1-1)', times: ['08:00', '14:00', '20:00'] },
  qid: { text: 'Four times daily', times: ['08:00', '12:00', '16:00', '20:00'] },
  sos: { text: 'Only when needed (SOS)', times: [] }
};
const SLOT_TIMES = ['08:00', '14:00', '20:00'];

function frequencyOf(line) {
  const pattern = line.match(/\b([01])\s*-\s*([01])\s*-\s*([01])\b/);
  if (pattern) {
    const slots = pattern.slice(1, 4).map(Number);
    const times = SLOT_TIMES.filter((_, i) => slots[i] === 1);
    return { text: `${slots.join('-')} (${times.length} time${times.length === 1 ? '' : 's'} a day)`, times, code: slots.join('-') };
  }
  const word = line.toLowerCase().match(/\b(od|hs|bd|bid|tds|tid|qid|sos)\b/);
  if (word) return { ...FREQ[word[1]], code: word[1].toUpperCase() };
  if (/once (a|daily|per) ?day/i.test(line)) return { ...FREQ.od, code: 'OD' };
  if (/twice (a|daily|per) ?day/i.test(line)) return { ...FREQ.bd, code: 'BD' };
  if (/thrice|three times/i.test(line)) return { ...FREQ.tds, code: 'TDS' };
  return null;
}

function parseMedicineLine(line) {
  const formMatch = line.match(/^\s*(?:\d+[.)]\s*)?(tab(?:let)?|cap(?:sule)?|syp|syrup|inj|drops|oint|susp)\.?\s+(.+)$/i);
  if (!formMatch) return null;
  const form = FORMS[formMatch[1].toLowerCase()] || 'Tablet';
  const rest = formMatch[2];
  const strength = rest.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu)\b/i);
  const bareNumber = !strength && rest.match(/\b(\d{2,4})\b/);
  // The name is everything before the strength / frequency / duration.
  const cutAt = rest.search(/\d|\b(od|hs|bd|bid|tds|tid|qid|sos)\b|\bx\s*\d/i);
  const name = (cutAt > 0 ? rest.slice(0, cutAt) : rest).replace(/[,;:]+$/, '').trim();
  if (!name || name.length < 3) return null;
  const freq = frequencyOf(rest);
  const duration = rest.match(/(?:x|for|-|×)\s*(\d+)\s*(day|days|week|weeks|month|months)\b/i);
  const instructions = rest.match(/\b(after food|before food|after meals?|before meals?|before breakfast|post lunch|empty stomach|at bedtime|for fever|for pain)\b/i);
  const dosage = strength ? `${strength[1]} ${strength[2].toLowerCase()}` : bareNumber ? `${bareNumber[1]} mg` : '';
  let confidence = 55 + (dosage ? 15 : 0) + (freq ? 15 : 0) + (duration ? 10 : 0);
  confidence = Math.min(confidence, 97);
  return {
    name: `${name}${dosage ? ' ' + dosage.replace(' ', '') : ''}`,
    medicineName: name,
    form,
    dosage: dosage || '',
    frequency: freq ? freq.text : '',
    frequencyCode: freq ? freq.code : '',
    reminderTimes: freq ? freq.times : [],
    duration: duration ? `${duration[1]} ${duration[2].toLowerCase()}` : '',
    instructions: instructions ? instructions[1].toLowerCase() : '',
    confidence,
    needsReview: confidence < 80
  };
}

function parse(rawText) {
  const text = String(rawText || '').replace(/\r/g, '');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const doctor = text.match(/\bDr\.?[ \t]+([A-Z][a-zA-Z.]+(?: [A-Z][a-z][a-zA-Z.]*){0,3})(?:,?[ \t]*(MBBS|MD|MS|DNB|BAMS|BHMS)\b)?/);
  const patient = text.match(/\b(?:[Pp]atient|PATIENT|[Nn]ame|NAME|[Pp]t)[ \t]*[:\-][ \t]*([A-Z][a-zA-Z.]+(?: [A-Z][a-zA-Z.]+){0,3})/);
  const date = text.match(/\b(?:date\s*[:\-]?\s*)?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/i);
  const medicines = [];
  for (const line of lines) {
    for (const part of line.split(/(?=\b(?:tab|cap|syp|inj)\.?\s)/i)) {
      const med = parseMedicineLine(part);
      if (med) medicines.push(med);
    }
  }
  let prescriptionDate = new Date().toISOString().slice(0, 10);
  if (date) {
    const year = date[3].length === 2 ? `20${date[3]}` : date[3];
    prescriptionDate = `${year}-${String(date[2]).padStart(2, '0')}-${String(date[1]).padStart(2, '0')}`;
  }
  const overall = medicines.length ? Math.round(medicines.reduce((t, m) => t + m.confidence, 0) / medicines.length) : 0;
  return {
    medicines,
    doctorName: doctor ? `Dr. ${doctor[1].trim()}${doctor[2] ? ', ' + doctor[2] : ''}` : 'Unknown',
    patientName: patient ? patient[1].trim() : 'Unknown',
    prescriptionDate,
    rawText: text,
    overallConfidence: overall,
    parser: 'local-rules'
  };
}

module.exports = { parse, parseMedicineLine, frequencyOf };
