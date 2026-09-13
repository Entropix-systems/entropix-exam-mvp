export type DecimalInput = number | string;

export interface Decimal {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

const DECIMAL_PATTERN =
  /^([+-])?(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/;

const absolute = (value: bigint): bigint => (value < 0n ? -value : value);

const greatestCommonDivisor = (left: bigint, right: bigint): bigint => {
  let a = absolute(left);
  let b = absolute(right);
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
};

const normalize = (numerator: bigint, denominator: bigint): Decimal => {
  if (denominator === 0n) throw new Error('Decimal denominator cannot be zero.');
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = greatestCommonDivisor(numerator, denominator);
  return {
    numerator: (numerator / divisor) * sign,
    denominator: absolute(denominator / divisor),
  };
};

export const decimal = (value: DecimalInput, label: string): Decimal => {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite decimal.`);
  }

  const source = String(value).trim();
  const match = DECIMAL_PATTERN.exec(source);
  if (!match) throw new Error(`${label} must be a finite decimal.`);

  const sign = match[1] === '-' ? -1n : 1n;
  const integer = match[2] ?? '0';
  const fraction = match[3] ?? match[4] ?? '';
  const exponent = Number(match[5] ?? '0');
  if (!Number.isSafeInteger(exponent)) {
    throw new Error(`${label} has an unsupported exponent.`);
  }

  const digits = BigInt(`${integer}${fraction}` || '0');
  const scale = fraction.length - exponent;
  if (scale <= 0) return normalize(sign * digits * 10n ** BigInt(-scale), 1n);
  return normalize(sign * digits, 10n ** BigInt(scale));
};

export const add = (left: Decimal, right: Decimal): Decimal =>
  normalize(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );

export const multiply = (left: Decimal, right: Decimal): Decimal =>
  normalize(
    left.numerator * right.numerator,
    left.denominator * right.denominator,
  );

export const divide = (left: Decimal, right: Decimal): Decimal => {
  if (right.numerator === 0n) throw new Error('Cannot divide by zero.');
  return normalize(
    left.numerator * right.denominator,
    left.denominator * right.numerator,
  );
};

export const compare = (left: Decimal, right: Decimal): number => {
  const difference =
    left.numerator * right.denominator - right.numerator * left.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
};

export const equals = (left: Decimal, right: Decimal): boolean =>
  compare(left, right) === 0;

export const toNumber = (value: Decimal): number =>
  Number(value.numerator) / Number(value.denominator);

export const formatHalfUp = (value: Decimal, places = 2): string => {
  if (places < 0 || !Number.isSafeInteger(places)) {
    throw new Error('Decimal places must be a non-negative integer.');
  }

  const negative = value.numerator < 0n;
  const scale = 10n ** BigInt(places);
  const scaledNumerator = absolute(value.numerator) * scale;
  let rounded = scaledNumerator / value.denominator;
  const remainder = scaledNumerator % value.denominator;
  if (remainder * 2n >= value.denominator) rounded += 1n;

  const digits = rounded.toString().padStart(places + 1, '0');
  const body =
    places === 0
      ? digits
      : `${digits.slice(0, -places)}.${digits.slice(-places)}`;
  return negative && rounded !== 0n ? `-${body}` : body;
};

export const toCanonicalDecimal = (value: Decimal): string => {
  let denominator = value.denominator;
  let twos = 0;
  let fives = 0;
  while (denominator % 2n === 0n) {
    denominator /= 2n;
    twos += 1;
  }
  while (denominator % 5n === 0n) {
    denominator /= 5n;
    fives += 1;
  }
  if (denominator !== 1n) {
    throw new Error('Cannot serialize a repeating decimal exactly.');
  }

  const places = Math.max(twos, fives);
  const scaled =
    absolute(value.numerator) *
    2n ** BigInt(places - twos) *
    5n ** BigInt(places - fives);
  if (places === 0) return `${value.numerator}`;

  const digits = scaled.toString().padStart(places + 1, '0');
  const fraction = digits.slice(-places).replace(/0+$/, '');
  const integer = digits.slice(0, -places);
  const sign = value.numerator < 0n ? '-' : '';
  return fraction.length === 0 ? `${sign}${integer}` : `${sign}${integer}.${fraction}`;
};

export const ZERO = decimal(0, 'zero');
export const ONE_HUNDRED = decimal(100, 'one hundred');
