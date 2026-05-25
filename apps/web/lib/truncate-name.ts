export function truncateName(input: string, max: number = 24): string {
  if (input.length <= max) return input;
  return input.slice(0, max - 1) + "…";
}
