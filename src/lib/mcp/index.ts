import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getOverview from "./tools/get-overview";
import listTransactions from "./tools/list-transactions";
import addTransaction from "./tools/add-transaction";
import logWeight from "./tools/log-weight";
import logStudy from "./tools/log-study";
import listGoals from "./tools/list-goals";
import logKaizen from "./tools/log-kaizen";

// O emissor OAuth precisa ser o host direto do Supabase (RFC 8414).
const projectRef =
  import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "oskwtnluunvdlbjptday";

export default defineMcp({
  name: "altus-app",
  title: "ALTUS App",
  version: "0.1.0",
  instructions:
    "Ferramentas do ALTUS, o sistema operacional pessoal do usuário. Use get_overview para o panorama, list_transactions e add_transaction para finanças, log_weight para peso, log_study para estudos, list_goals para metas e rotina, e log_kaizen para a reflexão diária. Todos os dados pertencem ao usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getOverview,
    listTransactions,
    addTransaction,
    logWeight,
    logStudy,
    listGoals,
    logKaizen,
  ],
});
