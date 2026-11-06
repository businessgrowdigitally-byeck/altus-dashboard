import { create } from "zustand";
import { supabase } from "./supabase";
import { useStore, emptyState, SYNC_KEYS } from "./store";
import { normalizeAltusState } from "./ai/plan";
import { normalizeBudgets, normalizeRecurring } from "./finance";
import { normalizeDayPlans } from "./day-plan";
import { normalizeBriefing, normalizeSeen } from "./notifications";
import { todayISO } from "./format";
import { mergeSnapshots, same } from "./merge";
import { clearSyncCache, loadSyncCache, saveSyncCache } from "./sync-cache";

/**
 * Sincronização dos dados do usuário com o Supabase.
 *
 * Modelo: uma linha por usuário na tabela `user_data`, com o estado inteiro
 * guardado numa coluna JSON. É simples e suficiente para o MVP — a Row Level
 * Security garante que cada pessoa só enxerga a própria linha.
 *
 * Fluxo:
 *  1. login  -> `startSync` baixa a linha da nuvem e preenche o store
 *  2. uso    -> qualquer alteração agenda um envio (debounce de 1,2s)
 *  3. logout -> `stopSync` para o envio e limpa o store local
 *
 * Vários aparelhos (e o MCP) gravam a mesma linha. Para ninguém apagar o que
 * o outro salvou, cada envio só grava se a nuvem ainda estiver na versão que
 * este aparelho conhece (`updated_at`). Se outro gravou antes, baixamos a
 * versão nova, combinamos (base × local × nuvem, ver merge.ts) e enviamos de novo.
 *
 * Sem internet: a última versão sincronizada fica guardada no aparelho
 * (sync-cache.ts). O app abre com os dados locais ("offline"), tudo o que for
 * feito fica salvo no aparelho e, quando a conexão volta, é combinado com a
 * nuvem pelo mesmo caminho. Ao abrir com internet, o que ficou pendente no
 * aparelho também é combinado (antes a nuvem sobrescrevia o local).
 */

export type SyncStatus = "idle" | "loading" | "saving" | "saved" | "error" | "offline";

/** Erro da carga inicial sem internet num aparelho que nunca sincronizou (a tela traduz). */
export const OFFLINE_FIRST_LOAD = "offline-first-load";

/** De quem são os dados guardados no store local (para não misturar contas). */
const OWNER_KEY = "altus-sync-owner";
const readOwner = () => {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
};
const writeOwner = (userId: string | null) => {
  try {
    if (userId) localStorage.setItem(OWNER_KEY, userId);
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    /* Storage indisponível: sem modo offline. */
  }
};

/** Falha de rede (sem internet, servidor fora do ar) — não é um erro dos dados. */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg =
    e && typeof e === "object" && "message" in e
      ? String((e as { message: unknown }).message)
      : String(e ?? "");
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|internet|offline/i.test(
    msg,
  );
}

export const useSyncStatus = create<{
  status: SyncStatus;
  error: string | null;
  set: (status: SyncStatus, error?: string | null) => void;
}>((set) => ({
  status: "idle",
  error: null,
  set: (status, error = null) => set({ status, error }),
}));

const TABLE = "user_data";
const DEBOUNCE_MS = 1200;
/** Teto de tamanho do estado completo salvo na nuvem (proteção contra estouro). */
const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;

let unsubscribeStore: (() => void) | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let activeUserId: string | null = null;
/** Trava o envio até a carga inicial terminar, para não sobrescrever a nuvem com estado vazio. */
let ready = false;
/** Versão da nuvem que este aparelho conhece (`updated_at` da linha). */
let cloudVersion: string | null = null;
/** Último estado sincronizado: a "base" da combinação de três vias. */
let base: Snapshot = {};
/** Envios em fila, um de cada vez. */
let chain: Promise<void> = Promise.resolve();
const MAX_CONFLICT_RETRIES = 3;
let onlineListener: (() => void) | null = null;

/** Guarda no aparelho a versão que acabou de ficar sincronizada. */
function remember(userId: string) {
  if (activeUserId !== userId) return;
  writeOwner(userId);
  void saveSyncCache(userId, cloudVersion, base);
}

/** Erro ao falar com a nuvem: sem internet vira "offline" (fica salvo no aparelho). */
function fail(error: { message: string }) {
  if (isNetworkError(error)) useSyncStatus.getState().set("offline");
  else useSyncStatus.getState().set("error", error.message);
}

type Snapshot = Record<string, unknown>;

function snapshot(): Snapshot {
  const state = useStore.getState() as unknown as Record<string, unknown>;
  const out: Snapshot = {};
  for (const key of SYNC_KEYS) out[key] = state[key];
  // Remove funções e valores não serializáveis.
  return JSON.parse(JSON.stringify(out)) as Snapshot;
}

/**
 * Sanitiza o que vem da nuvem: copia apenas as chaves conhecidas e com o tipo
 * certo. Um cliente autenticado consegue gravar qualquer JSON na própria linha
 * pela API anon; sem esse filtro, uma linha adulterada substituiria funções do
 * store (ex.: "addTransaction") e quebraria o app de forma permanente.
 */
function sanitizeSnapshot(value: unknown): object {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of SYNC_KEYS) {
    if (!(key in src)) continue;
    const v = src[key];
    const esperaLista = Array.isArray((emptyState as Record<string, unknown>)[key]);
    if (esperaLista) {
      if (Array.isArray(v)) out[key] = v;
      continue;
    }
    if (key === "version") {
      if (typeof v === "number") out[key] = v;
      continue;
    }
    if (v !== null && typeof v === "object" && !Array.isArray(v)) out[key] = v;
  }
  // Campo antigo e sem uso: a chave do Gemini fica só no servidor, nunca nos dados do usuário.
  if (out.settings && "geminiKey" in (out.settings as object)) {
    const { geminiKey: _unused, ...settings } = out.settings as Record<string, unknown>;
    out.settings = settings;
  }
  // Planejamento ALTUS: valida em profundidade e converte o formato antigo
  // (P.G. dentro de cada plano, ideias estacionadas) sem perder conteúdo.
  return {
    ...out,
    ...normalizeAltusState(out, todayISO()),
    categoryBudgets: normalizeBudgets(out.categoryBudgets),
    recurringTransactions: normalizeRecurring(out.recurringTransactions),
    dayPlans: normalizeDayPlans(out.dayPlans, todayISO()),
    // Resumo do GOAT e notificações lidas: só quando vieram na nuvem.
    ...("dailyBriefing" in out ? { dailyBriefing: normalizeBriefing(out.dailyBriefing) } : {}),
    ...("notificationsSeen" in out
      ? { notificationsSeen: normalizeSeen(out.notificationsSeen) }
      : {}),
  };
}

/** Aplica no store um estado combinado, preservando o que mudou localmente nesse meio-tempo. */
function applyMerged(sentLocal: Snapshot, merged: Snapshot) {
  const current = snapshot();
  // O usuário pode ter mexido enquanto o envio estava na rede: `sentLocal` é a base disso.
  const next = same(current, sentLocal) ? merged : mergeSnapshots(sentLocal, current, merged);
  useStore.setState(sanitizeSnapshot(next));
  useStore.getState().recomputeLinkedGoals();
}

async function fetchCloud(userId: string) {
  return supabase.from(TABLE).select("data, updated_at").eq("user_id", userId).maybeSingle();
}

async function pushNow(userId: string) {
  const { set } = useSyncStatus.getState();
  set("saving");
  let local = snapshot();
  if (new TextEncoder().encode(JSON.stringify(local)).length > MAX_SNAPSHOT_BYTES) {
    set("error", "Dados grandes demais para salvar. Remova registros antigos e tente novamente.");
    return;
  }
  // Nada mudou desde a última sincronização (ex.: estado recém-combinado): não regrava.
  if (cloudVersion && same(local, base)) return set("saved");
  for (let attempt = 0; attempt <= MAX_CONFLICT_RETRIES; attempt++) {
    if (activeUserId !== userId) return;
    if (cloudVersion) {
      // Grava só se ninguém gravou desde a versão que conhecemos.
      const { data, error } = await supabase
        .from(TABLE)
        .update({ data: local })
        .eq("user_id", userId)
        .eq("updated_at", cloudVersion)
        .select("updated_at");
      if (error) return fail(error);
      if (data && data.length === 1) {
        cloudVersion = data[0].updated_at as string;
        base = local;
        remember(userId);
        return set("saved");
      }
    }
    // Conflito (ou versão desconhecida): baixa a nuvem e combina.
    const { data: row, error: fetchError } = await fetchCloud(userId);
    if (fetchError) return fail(fetchError);
    if (!row) {
      const { data, error } = await supabase
        .from(TABLE)
        .insert({ user_id: userId, data: local })
        .select("updated_at");
      if (error) return fail(error);
      cloudVersion = (data?.[0]?.updated_at as string) ?? null;
      base = local;
      remember(userId);
      return set("saved");
    }
    const remote = sanitizeSnapshot(row.data) as Snapshot;
    const merged = mergeSnapshots(base, local, remote);
    applyMerged(local, merged);
    cloudVersion = row.updated_at as string;
    base = remote;
    remember(userId);
    local = snapshot();
    if (same(local, remote)) return set("saved");
  }
  set("error", "Outro aparelho está salvando ao mesmo tempo. Tente de novo em instantes.");
}

function push(userId: string): Promise<void> {
  chain = chain
    .then(() => pushNow(userId))
    .catch((e: unknown) => {
      fail({ message: e instanceof Error ? e.message : String(e) });
    });
  return chain;
}

/**
 * Traz o que outro aparelho salvou (ex.: ao voltar para o app). Combina com o
 * que houver de local e, se sobrar mudança deste aparelho, envia em seguida.
 */
export async function refreshFromCloud(): Promise<boolean> {
  if (!ready || !activeUserId) return false;
  const userId = activeUserId;
  await chain;
  const { data: row, error } = await fetchCloud(userId);
  if (error || activeUserId !== userId) return false;
  if (!row || row.updated_at === cloudVersion) return true;
  const remote = sanitizeSnapshot(row.data) as Snapshot;
  const local = snapshot();
  const merged = mergeSnapshots(base, local, remote);
  cloudVersion = row.updated_at as string;
  base = remote;
  remember(userId);
  applyMerged(local, merged);
  if (!same(snapshot(), remote)) scheduleSave();
  return true;
}

function scheduleSave() {
  if (!ready || !activeUserId) return;
  if (saveTimer) clearTimeout(saveTimer);
  const userId = activeUserId;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void push(userId);
  }, DEBOUNCE_MS);
}

/** Baixa os dados do usuário e passa a salvar automaticamente a cada alteração. */
export async function startSync(userId: string) {
  if (activeUserId === userId) return;
  stopSync({ clearLocal: false });

  activeUserId = userId;
  ready = false;
  useSyncStatus.getState().set("loading");

  // Os dados deste aparelho são desta conta e já foram sincronizados alguma vez?
  const cached = readOwner() === userId ? await loadSyncCache(userId) : null;
  if (activeUserId !== userId) return;

  // Sem internet: abre com o que está no aparelho; envia quando a conexão voltar.
  const openOffline = (entry: NonNullable<typeof cached>) => {
    base = entry.base;
    cloudVersion = entry.version;
    useStore.getState().recomputeLinkedGoals();
    ready = true;
    useSyncStatus.getState().set("offline");
    unsubscribeStore = useStore.subscribe(scheduleSave);
    watchOnline();
    useStore.getState().postDueRecurring(todayISO());
  };
  // O aparelho já sabe que está sem rede: não espera as tentativas da biblioteca (~7 s).
  if (cached && typeof navigator !== "undefined" && navigator.onLine === false)
    return openOffline(cached);

  const { data, error } = await fetchCloud(userId);
  if (activeUserId !== userId) return;

  if (error) {
    if (cached && isNetworkError(error)) return openOffline(cached);
    activeUserId = null;
    useSyncStatus
      .getState()
      .set("error", isNetworkError(error) ? OFFLINE_FIRST_LOAD : error.message);
    return;
  }

  let pending = false;
  if (data?.data && Object.keys(data.data).length > 0 && cached) {
    // O aparelho tem mudanças que talvez não chegaram à nuvem (feitas offline ou
    // antes de fechar): combina base × aparelho × nuvem em vez de sobrescrever.
    const remote = sanitizeSnapshot(data.data) as Snapshot;
    const merged = mergeSnapshots(cached.base, snapshot(), remote);
    useStore.setState({ ...emptyState, ...sanitizeSnapshot(merged) });
    cloudVersion = (data.updated_at as string) ?? null;
    pending = !same(snapshot(), remote);
  } else if (data?.data && Object.keys(data.data).length > 0) {
    // Conta existente: a nuvem é a fonte da verdade (com filtro de chaves).
    useStore.setState({ ...emptyState, ...sanitizeSnapshot(data.data) });
    cloudVersion = (data.updated_at as string) ?? null;
  } else if (data) {
    // Linha existe mas vazia: começa limpa; o primeiro envio a preenche.
    useStore.setState({ ...emptyState });
    cloudVersion = (data.updated_at as string) ?? null;
  } else {
    // Conta nova: começa limpa e cria a linha na nuvem.
    useStore.setState({ ...emptyState });
    const { data: created, error: insertError } = await supabase
      .from(TABLE)
      .insert({ user_id: userId, data: snapshot() })
      .select("updated_at");
    if (insertError) {
      useSyncStatus.getState().set("error", insertError.message);
      return;
    }
    cloudVersion = (created?.[0]?.updated_at as string) ?? null;
  }

  useStore.getState().recomputeLinkedGoals();
  // Com mudanças pendentes do aparelho, a base é a nuvem (o que falta enviar fica na diferença).
  base = pending ? (sanitizeSnapshot(data?.data) as Snapshot) : snapshot();

  ready = true;
  useSyncStatus.getState().set("saved");
  remember(userId);
  unsubscribeStore = useStore.subscribe(scheduleSave);
  watchOnline();
  if (pending) scheduleSave();
  // Depois de assinar o salvamento, para os lançamentos gerados irem para a nuvem.
  useStore.getState().postDueRecurring(todayISO());
  // A nuvem ainda tem o campo antigo `settings.geminiKey`: marca a diferença na
  // base para o próximo envio gravar os dados sem ele.
  const rawSettings = (data?.data as Record<string, unknown> | undefined)?.settings;
  if (rawSettings && typeof rawSettings === "object" && "geminiKey" in rawSettings) {
    base = { ...base, settings: rawSettings };
    scheduleSave();
  }
}

/** Para a sincronização. Por padrão também apaga os dados do navegador (logout). */
export function stopSync({ clearLocal = true }: { clearLocal?: boolean } = {}) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  unsubscribeStore?.();
  unsubscribeStore = null;
  if (onlineListener) window.removeEventListener("online", onlineListener);
  onlineListener = null;
  activeUserId = null;
  ready = false;
  cloudVersion = null;
  base = {};
  useSyncStatus.getState().set("idle");
  if (clearLocal) {
    useStore.setState({ ...emptyState });
    writeOwner(null);
    void clearSyncCache();
  }
}

/** A conexão voltou: traz o que mudou na nuvem, combina e envia o que ficou no aparelho. */
function watchOnline() {
  if (typeof window === "undefined" || onlineListener) return;
  onlineListener = () => {
    if (!ready || !activeUserId) return;
    // Só envia se a nuvem respondeu (o evento "online" às vezes chega antes da rede).
    void refreshFromCloud().then((ok) => (ok ? flushSync() : undefined));
  };
  window.addEventListener("online", onlineListener);
}

/** A carga inicial terminou? (Erros depois disso são de envio, não de carga.) */
export function isSyncReady() {
  return ready;
}

/** Conta cuja sincronização está ativa (null antes do login ou depois do logout). */
export function syncedUserId() {
  return ready ? activeUserId : null;
}

/** Força um envio imediato, ignorando o debounce. */
export async function flushSync() {
  if (!ready || !activeUserId) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await push(activeUserId);
}
