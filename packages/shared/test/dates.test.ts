import { describe, expect, it } from 'vitest';
import {
  comparePartialDates,
  formatDateRange,
  formatPartialDate,
  isValidPartialDate,
  parseDateInput,
  toDateInputString,
} from '../src/dates.js';

describe('parseDateInput', () => {
  it.each([
    ['2022', '2022'],
    ['01/2022', '2022-01'],
    ['1/2022', '2022-01'],
    ['01.2022', '2022-01'],
    ['15.01.2022', '2022-01-15'],
    ['5.3.2021', '2021-03-05'],
    ['2022-01', '2022-01'],
    ['2022-01-31', '2022-01-31'],
    ['', ''],
  ])('%s → %s', (input, expected) => {
    expect(parseDateInput(input)).toBe(expected);
  });

  it.each(['13/2022', '31.02.2023', 'abc', '22', '1899', '00/2020'])('rejects %s', (input) => {
    expect(parseDateInput(input)).toBeNull();
  });
});

describe('formatPartialDate', () => {
  it('formats according to the chosen format', () => {
    expect(formatPartialDate('2022-01-15', 'MM/YYYY')).toBe('01/2022');
    expect(formatPartialDate('2022-01-15', 'MM.YYYY')).toBe('01.2022');
    expect(formatPartialDate('2022-01-15', 'YYYY')).toBe('2022');
    expect(formatPartialDate('2022-01-15', 'DD.MM.YYYY')).toBe('15.01.2022');
  });

  it('reduces precision gracefully', () => {
    expect(formatPartialDate('2022', 'MM/YYYY')).toBe('2022');
    expect(formatPartialDate('2022-03', 'DD.MM.YYYY')).toBe('03.2022');
  });

  it('formats ranges with present label', () => {
    expect(formatDateRange('2022-01', '', true, 'MM/YYYY', { present: 'heute' })).toBe('01/2022 – heute');
    expect(formatDateRange('2014-08', '2021-12', false, 'MM.YYYY', { present: 'heute' })).toBe('08.2014 – 12.2021');
    expect(formatDateRange('2020', '2020', false, 'YYYY', { present: 'heute' })).toBe('2020');
  });

  it('round-trips input strings', () => {
    expect(parseDateInput(toDateInputString('2022-01', 'MM/YYYY'))).toBe('2022-01');
    expect(parseDateInput(toDateInputString('2022-01-02', 'MM/YYYY'))).toBe('2022-01-02');
  });
});

describe('validation & comparison', () => {
  it('validates calendar dates', () => {
    expect(isValidPartialDate('2024-02-29')).toBe(true);
    expect(isValidPartialDate('2023-02-29')).toBe(false);
  });
  it('compares partial dates', () => {
    expect(comparePartialDates('2020', '2020-05')).toBeLessThan(0);
    expect(comparePartialDates('2021-01', '2020-12')).toBeGreaterThan(0);
  });
});
