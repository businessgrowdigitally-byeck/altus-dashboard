import { create } from "zustand";
import { supabase } from "./supabase";
import { useStore, emptyState, SYNC_KEYS } from "./store";

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
 */

export type SyncStatus = "idle" | "loading" | "saving" | "saved" | "error";

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

let unsubscribeStore: (() => void) | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let activeUserId: string | null = null;
/** Trava o envio até a carga inicial terminar, para não sobrescrever a nuvem com estado vazio. */
let ready = false;

type Snapshot = Record<string, unknown>;

function snapshot(): Snapshot {
  const state = useStore.getState() as unknown as Record<string, unknown>;
  const out: Snapshot = {};
  for (const key of SYNC_KEYS) out[key] = state[key];
  // Remove funções e valores não serializáveis.
  return JSON.parse(JSON.stringify(out)) as Snapshot;
}

async function push(userId: string) {
  const { set } = useSyncStatus.getState();
  set("saving");
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, data: snapshot(), updated_at: new Date().toISOString() });
  if (error) set("error", error.message);
  else set("saved");
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

  const { data, error } = await supabase
    .from(TABLE)
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    activeUserId = null;
    useSyncStatus.getState().set("error", error.message);
    return;
  }

  if (data?.data && Object.keys(data.data).length > 0) {
    // Conta existente: a nuvem é a fonte da verdade.
    useStore.setState({ ...emptyState, ...(data.data as object) });
  } else {
    // Conta nova: começa limpa e cria a linha na nuvem.
    useStore.setState({ ...emptyState });
    const { error: insertError } = await supabase
      .from(TABLE)
      .insert({ user_id: userId, data: snapshot() });
    if (insertError) {
      useSyncStatus.getState().set("error", insertError.message);
      return;
    }
  }

  useStore.getState().recomputeLinkedGoals();

  ready = true;
  useSyncStatus.getState().set("saved");
  unsubscribeStore = useStore.subscribe(scheduleSave);
}

/** Para a sincronização. Por padrão também apaga os dados do navegador (logout). */
export function stopSync({ clearLocal = true }: { clearLocal?: boolean } = {}) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  unsubscribeStore?.();
  unsubscribeStore = null;
  activeUserId = null;
  ready = false;
  useSyncStatus.getState().set("idle");
  if (clearLocal) useStore.setState({ ...emptyState });
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
