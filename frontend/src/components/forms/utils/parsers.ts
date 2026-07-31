export function parseOptionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return undefined
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value))

  return Number.isNaN(parsed) ? undefined : parsed
}

export function parseRequiredNumber(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value))

  return Number.isNaN(parsed) ? undefined : parsed
}