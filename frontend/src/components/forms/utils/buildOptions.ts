export function buildOptions<const T extends readonly string[]>(
  values: T,
  labelMap?: Partial<Record<T[number], string>>
) {
  return values.map((value: T[number]) => ({
    value,
    label: labelMap?.[value] ?? value,
  }))
}
