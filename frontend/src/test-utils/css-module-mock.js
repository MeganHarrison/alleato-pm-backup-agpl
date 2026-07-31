// Jest has no CSS loader — `.module.css` imports (e.g. training-theme.module.css)
// are mapped to this stub so `styles.card` resolves to the string "card"
// instead of throwing a syntax error on real CSS.
//
// `__esModule` must NOT go through the generic proxy trap: TypeScript's
// esModuleInterop helper reads `mod.__esModule` to decide whether to unwrap
// `.default` — if the proxy answered that access with the truthy string
// "__esModule", the interop layer treats the proxy itself as the default
// export, so a later `.default` access on it returns the string "default"
// instead of a class-name lookup.
module.exports = new Proxy(
  {},
  {
    get: (_target, property) => {
      if (property === "__esModule" || typeof property === "symbol") {
        return undefined;
      }
      return property;
    },
  },
);
