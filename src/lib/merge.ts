/**
 * Combinação de três vias para a sincronização entre aparelhos.
 *
 * `base` é o último estado sincronizado; `local` é o deste aparelho; `remote`
 * é o que está na nuvem agora (gravado por outro aparelho ou pelo MCP).
 * O que só um lado mudou vence; quando os dois mudaram a mesma coisa:
 * - listas de itens com `id` são combinadas item a item (inclusões e exclusões
 *   dos dois lados são mantidas; edição do mesmo item campo a campo);
 * - objetos são combinados campo a campo;
 * - o chat (só cresce) recebe as mensagens novas dos dois lados;
 * - num conflito real no mesmo campo, vale a versão deste aparelho.
 */

type Json = unknown;

const isObj = (v: Json): v is Record<string, Json> =>
  !!v && typeof v === "object" && !Array.isArray(v);

export function same(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a).filter((k) => a[k] !== undefined);
    const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    return ka.length === kb.length && ka.every((k) => same(a[k], b[k]));
  }
  return false;
}

/** Chave de um item de lista: `id` quando houver; senão o próprio conteúdo. */
const keyOf = (item: Json): string =>
  isObj(item) && typeof item.id === "string" ? `id:${item.id}` : `v:${JSON.stringify(item)}`;

function mergeList(base: Json[], local: Json[], remote: Json[]): Json[] {
  const B = new Map(base.map((x) => [keyOf(x), x]));
  const L = new Map(local.map((x) => [keyOf(x), x]));
  const R = new Map(remote.map((x) => [keyOf(x), x]));
  const keep = (k: string): Json | undefined => {
    const b = B.get(k);
    const l = L.get(k);
    const r = R.get(k);
    if (b === undefined)
      return l !== undefined ? (r !== undefined ? mergeValue(undefined, l, r) : l) : r;
    if (l === undefined && r === undefined) return undefined;
    // Apagado de um lado: some, a menos que o outro lado tenha editado o item.
    if (l === undefined) return same(r, b) ? undefined : r;
    if (r === undefined) return same(l, b) ? undefined : l;
    return mergeValue(b, l, r);
  };
  // Ordem: itens novos deste aparelho primeiro (o app insere no topo), depois a ordem da nuvem.
  const order = [
    ...[...L.keys()].filter((k) => !B.has(k) && !R.has(k)),
    ...R.keys(),
    ...[...L.keys()].filter((k) => B.has(k) && !R.has(k)),
  ];
  const out: Json[] = [];
  const seen = new Set<string>();
  for (const k of order) {
    if (seen.has(k)) continue;
    seen.add(k);
    const v = keep(k);
    if (v !== undefined) out.push(v);
  }
  return out;
}

/** Chat: lista que só cresce. Mantém a nuvem e acrescenta as mensagens novas deste aparelho. */
function mergeChat(base: Json[], local: Json[], remote: Json[]): Json[] {
  const prefix = (a: Json[], p: Json[]) => p.length <= a.length && p.every((x, i) => same(x, a[i]));
  if (prefix(local, base) && prefix(remote, base)) return [...remote, ...local.slice(base.length)];
  return local; // um lado limpou o chat: vale este aparelho
}

export function mergeValue(base: Json, local: Json, remote: Json, key?: string): Json {
  if (same(local, base)) return remote;
  if (same(remote, base)) return local;
  if (same(local, remote)) return local;
  if (Array.isArray(local) && Array.isArray(remote)) {
    const b = Array.isArray(base) ? base : [];
    return key === "chat" ? mergeChat(b, local, remote) : mergeList(b, local, remote);
  }
  if (isObj(local) && isObj(remote)) {
    const b = isObj(base) ? base : {};
    const out: Record<string, Json> = {};
    for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
      const inL = k in local && local[k] !== undefined;
      const inR = k in remote && remote[k] !== undefined;
      if (!inL && inR) {
        if (!(k in b) || !same(remote[k], b[k])) out[k] = remote[k]; // removido aqui: some se a nuvem não mexeu
        continue;
      }
      if (inL && !inR) {
        if (!(k in b) || !same(local[k], b[k])) out[k] = local[k];
        continue;
      }
      out[k] = mergeValue(b[k], local[k], remote[k], k);
    }
    return out;
  }
  return local;
}

/** Combina os estados inteiros (chave a chave do snapshot sincronizado). */
export function mergeSnapshots(
  base: Record<string, Json>,
  local: Record<string, Json>,
  remote: Record<string, Json>,
): Record<string, Json> {
  return mergeValue(base, local, remote) as Record<string, Json>;
}
