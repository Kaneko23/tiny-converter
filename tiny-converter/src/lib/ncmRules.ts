// Tabela de NCM por tecido, com correspondência "inteligente" de nomes:
// ignora maiúscula/minúscula, acentos, pontuação e pequenas variações de
// grafia (uma letra a mais/a menos, uma letra trocada) — mas evita casar
// nomes que têm palavras realmente diferentes (ex: "SEM ELASTANO" não deve
// virar "COM ELASTANO" só por serem parecidos como texto), porque aqui o
// erro custa caro (classificação fiscal errada).

export interface NcmTableEntry {
  tecido: string;
  ncm: string;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(" ").filter(Boolean) : [];
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/** Quantos caracteres de diferença toleramos para um par de palavras do mesmo "slot". */
function wordThreshold(len: number): number {
  return Math.max(1, Math.floor(len / 4));
}

function isSubsetTokens(shorter: string[], longer: string[]): boolean {
  return shorter.every((t) => longer.includes(t));
}

export interface NcmMatch {
  ncm: string;
  matchedTecido: string;
  exact: boolean;
}

/**
 * Procura o tecido informado na tabela. Devolve null se não achar nada
 * suficientemente parecido (nesse caso quem chamar deve usar o NCM padrão
 * e avisar o usuário, em vez de arriscar um chute).
 */
export function lookupNcm(tecidoRaw: string, table: NcmTableEntry[]): NcmMatch | null {
  const query = (tecidoRaw ?? "").trim();
  if (!query) return null;
  const qNorm = normalize(query);
  if (!qNorm) return null;
  const qTokens = tokenize(query);

  // 1) igual (ignorando caixa/acentos/pontuação)
  for (const e of table) {
    if (normalize(e.tecido) === qNorm) {
      return { ncm: e.ncm, matchedTecido: e.tecido, exact: true };
    }
  }

  // 2) um nome é um "subconjunto" de palavras do outro
  //    (ex: "CAMPEIRO" dentro de "CAMPEIRO AZUL"; "KRATOS" dentro de "KRATOS BLACK")
  let containmentBest: { entry: NcmTableEntry; diff: number } | null = null;
  for (const e of table) {
    const cTokens = tokenize(e.tecido);
    if (!cTokens.length) continue;
    const [shorter, longer] = qTokens.length <= cTokens.length ? [qTokens, cTokens] : [cTokens, qTokens];
    if (isSubsetTokens(shorter, longer)) {
      const diff = longer.length - shorter.length;
      if (!containmentBest || diff < containmentBest.diff) containmentBest = { entry: e, diff };
    }
  }
  if (containmentBest) {
    return { ncm: containmentBest.entry.ncm, matchedTecido: containmentBest.entry.tecido, exact: false };
  }

  // 3) mesmo número de palavras, cada palavra "parecida" com a correspondente
  //    (ex: "TRIPLO DRY DENIM" ~ "TRIPLE DRY DENIM") — protege contra casar
  //    palavras totalmente diferentes calculando a tolerância por palavra.
  let equalCountBest: { entry: NcmTableEntry; dist: number } | null = null;
  for (const e of table) {
    const cTokens = tokenize(e.tecido);
    if (cTokens.length !== qTokens.length || cTokens.length === 0) continue;
    const qSorted = [...qTokens].sort();
    const cSorted = [...cTokens].sort();
    let totalDist = 0;
    let ok = true;
    for (let i = 0; i < qSorted.length; i++) {
      const d = levenshtein(qSorted[i], cSorted[i]);
      const maxLen = Math.max(qSorted[i].length, cSorted[i].length);
      if (d > wordThreshold(maxLen)) {
        ok = false;
        break;
      }
      totalDist += d;
    }
    if (ok && (!equalCountBest || totalDist < equalCountBest.dist)) {
      equalCountBest = { entry: e, dist: totalDist };
    }
  }
  if (equalCountBest) {
    return { ncm: equalCountBest.entry.ncm, matchedTecido: equalCountBest.entry.tecido, exact: false };
  }

  // 4) nome de uma palavra só, com pequeno erro de digitação
  //    (ex: "vicolino" ~ "VISCOLINO")
  if (qTokens.length === 1) {
    let singleBest: { entry: NcmTableEntry; dist: number } | null = null;
    for (const e of table) {
      const cTokens = tokenize(e.tecido);
      if (cTokens.length !== 1) continue;
      const d = levenshtein(qTokens[0], cTokens[0]);
      const maxLen = Math.max(qTokens[0].length, cTokens[0].length);
      if (d <= wordThreshold(maxLen) && (!singleBest || d < singleBest.dist)) {
        singleBest = { entry: e, dist: d };
      }
    }
    if (singleBest) {
      return { ncm: singleBest.entry.ncm, matchedTecido: singleBest.entry.tecido, exact: false };
    }
  }

  return null;
}

/** Linhas iniciais da tabela de NCM por tecido, no formato usado pelo CodeTableEditor. */
export const DEFAULT_NCM_ROWS: { a: string; b: string }[] = [
  // CANATIBA DENIM
  { a: "XHAKA", b: "52094210" },
  { a: "TRIPLE DRY DENIM", b: "52114210" },
  { a: "EUPHORIA 100% ALGODÃO", b: "52084300" },
  { a: "EUPHORIA COM ELASTANO", b: "52084300" },
  { a: "CAMPEIRO", b: "52084200" },
  { a: "RIGH DENIM LISTRADO", b: "52094900" },
  // CANATIBA SARJA
  { a: "MIXLINHO", b: "52112090" },
  { a: "VISCOLINO", b: "55164100" },
  { a: "RARITA", b: "55164100" },
  { a: "BAMBULINO", b: "" },
  { a: "NEW CETIN, PRETO Ñ DESB", b: "52114900" },
  { a: "CARRERA RAW", b: "52091200" },
  { a: "UTILITARIUS", b: "52092200" },
  { a: "LINHO CORAL", b: "" },
  { a: "NEW AJAR BRANCO", b: "52093200" },
  // SANTANA
  { a: "KRATOS", b: "52094210" },
  { a: "KRATOS SKY", b: "52094210" },
  // VICUNHA JEANS
  { a: "ESTER SUBSTITUTO RUTH", b: "52094210" },
  { a: "WHICHITA", b: "52094210" },
  { a: "SANDY PLUS", b: "52114210" },
  { a: "SANDY BABY BLUE", b: "52114210" },
  { a: "TAIPE", b: "52114210" },
  { a: "LOPEZ STRECH", b: "52094210" },
  { a: "CATARINA", b: "52094210" },
  { a: "BENICIO", b: "52084300" },
  { a: "SANDY BLACK", b: "52114300" },
  { a: "IAGO BLACK ELASTANO", b: "52094290" },
  { a: "ZARA", b: "52104910" },
  { a: "LONDON", b: "55164300" },
  // VICUNHA SARJA
  { a: "BIARRITZ", b: "55164100" },
  // forro de bolso / estoque
  { a: "LISTRADO", b: "" },
  { a: "CRU", b: "" },
  { a: "TECIDO 100% RAMAN", b: "100" },
];
