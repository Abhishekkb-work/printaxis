import type { Unit } from "./types";

export const MM_PER_IN = 25.4;

export function toMm(value: number, unit: Unit): number {
  if (unit === "mm") return value;
  if (unit === "cm") return value * 10;
  return value * MM_PER_IN;
}

export function fromMm(mm: number, unit: Unit): number {
  if (unit === "mm") return mm;
  if (unit === "cm") return mm / 10;
  return mm / MM_PER_IN;
}

export function formatUnit(mm: number, unit: Unit, digits = 1): string {
  return fromMm(mm, unit).toFixed(digits);
}

export function unitLabel(unit: Unit): string {
  return unit;
}
