import { common } from "./common";
import { dashboard } from "./dashboard";
import { financas } from "./financas";
import { corpo } from "./corpo";
import { biblioteca } from "./biblioteca";
import { estudos } from "./estudos";
import { configuracoes } from "./configuracoes";
import { agente } from "./agente";
import { goals } from "./goals";
import { quickAdd } from "./quickAdd";
import { auth } from "./auth";
import { terms } from "./terms";
import { kaizen } from "./kaizen";

/** Dicionário unificado de todas as chaves de tradução (PT/EN/ES). */
export const DICT = {
  ...common,
  ...dashboard,
  ...financas,
  ...corpo,
  ...biblioteca,
  ...estudos,
  ...configuracoes,
  ...agente,
  ...goals,
  ...quickAdd,
  ...auth,
  ...terms,
  ...kaizen,
} as const;

export type DictKey = keyof typeof DICT;
