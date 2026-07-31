// Ambient declaration for `common-tags` (a runtime dependency already in
// package.json) which ships no bundled types and has no @types package
// installed. Scoped here inside the vendored Platform Kit; only the exports
// the kit actually uses are declared.
declare module 'common-tags' {
  export function stripIndent(
    strings: TemplateStringsArray | string,
    ...values: unknown[]
  ): string
  export function stripIndents(
    strings: TemplateStringsArray | string,
    ...values: unknown[]
  ): string
  export function oneLine(
    strings: TemplateStringsArray | string,
    ...values: unknown[]
  ): string
  export function source(
    strings: TemplateStringsArray | string,
    ...values: unknown[]
  ): string
}
