import { lookupNcm, DEFAULT_NCM_ROWS, type NcmTableEntry } from "../src/lib/ncmRules";

const table: NcmTableEntry[] = DEFAULT_NCM_ROWS.filter((r) => r.a && (!r.b || /\d/.test(r.b))).map((r) => ({
  tecido: r.a,
  ncm: r.b,
}));

const realFabrics = [
  "ARENA PT",
  "BENICIO",
  "CAMPEIRO AZUL",
  "CARRERA RAW",
  "CATARINA DARK",
  "EUPHORIA  SEM ELASTANO",
  "EUPHORIA 100%",
  "EUPHORIA 100% ALGODÃO",
  "EUPHORIA SEM ELASTANO",
  "FILIPE",
  "FILIPI",
  "KRATOS",
  "KRATOS BLACK",
  "KRATOS ULTRA BLACK",
  "MIXLINHO",
  "NEW COTON",
  "OASIS",
  "OASIS PT",
  "PRETO QUE NÃO DESBOTA",
  "RARITA",
  "RAZZIS",
  "RAZZIS MAXKIN",
  "TRIPLO DRY DENIM",
  "VISCOLINO",
  "XHAKA",
  "campeiro azul",
  "vicolino",
];

for (const f of realFabrics) {
  const m = lookupNcm(f, table);
  if (!m) {
    console.log(`${f.padEnd(28)} -> (sem correspondência)`);
  } else {
    console.log(
      `${f.padEnd(28)} -> ${m.ncm || "(ncm em branco)"}  [${m.exact ? "exato" : "aproximado: " + m.matchedTecido}]`
    );
  }
}

// Casos perigosos que NÃO podem casar entre si (semântica oposta / produtos diferentes)
console.log("\n--- verificação de falsos positivos perigosos ---");
const dangerous: [string, string][] = [
  ["EUPHORIA SEM ELASTANO", "EUPHORIA COM ELASTANO"],
  ["SANDY PLUS", "SANDY BLACK"],
];
for (const [a, b] of dangerous) {
  const m = lookupNcm(a, [{ tecido: b, ncm: "NAO_DEVERIA_CASAR" }]);
  console.log(`${a} vs ${b}: ${m ? "CASOU (ERRADO!) -> " + m.ncm : "não casou (correto)"}`);
}
