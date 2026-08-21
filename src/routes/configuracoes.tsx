import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { GlassCard, PageHeader, Section } from "@/components/primitives";
import { Modal } from "@/components/Modal";
import { todayISO } from "@/lib/format";
import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/configuracoes")({ component: Config });

const ACCENTS = [
  { id: "gold", color: "#F5C842", label: "Ouro" },
  { id: "emerald", color: "#2ECC71", label: "Esmeralda" },
  { id: "purple", color: "#9B59B6", label: "Roxo" },
  { id: "blue", color: "#3498DB", label: "Azul" },
] as const;

function Config() {
  const { profile, setProfile, settings, setSettings, exportAll, importAll, clearAll } = useStore();
  const [importText, setImportText] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState("");
  const [backupFeito, setBackupFeito] = useState(false);

  const download = () => {
    const blob = new Blob([exportAll()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `altus-export-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setBackupFeito(true);
    toast.success("Backup baixado.");
  };

  const handleImport = () => {
    if (!importText.trim()) {
      toast.error("Cole o conteúdo do arquivo antes de importar.");
      return;
    }
    const erro = importAll(importText);
    if (erro) {
      toast.error(erro);
      return;
    }
    setImportText("");
    toast.success("Dados importados. Tudo que estava aqui foi substituído.");
  };

  const executarLimpeza = () => {
    clearAll();
    setClearOpen(false);
    setClearConfirm("");
    setBackupFeito(false);
    toast.success("Todos os dados foram apagados.");
  };

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Personalize seu sistema operacional pessoal" />

      <Section title="Perfil">
        <GlassCard className="grid md:grid-cols-2 gap-3">
          <Field label="Nome">
            <input className="inp" value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} />
          </Field>
          <Field label="Altura (m)">
            <input
              className="inp"
              type="number"
              step="0.01"
              min="0.5"
              max="2.5"
              placeholder="1.75"
              value={profile.height || ""}
              onChange={(e) => setProfile({ height: +e.target.value })}
            />
            <span className="text-xs text-muted-foreground mt-1 block">Usada para calcular o IMC em Corpo &amp; Saúde.</span>
          </Field>
          <Field label="Meta de peso (kg)">
            <input className="inp" type="number" step="0.1" value={profile.goalWeight} onChange={(e) => setProfile({ goalWeight: +e.target.value })} />
          </Field>
          <Field label="Meta de receita mensal (R$)">
            <input className="inp" type="number" value={profile.incomeTarget} onChange={(e) => setProfile({ incomeTarget: +e.target.value })} />
          </Field>
          <Field label="Limite de despesas (R$)">
            <input className="inp" type="number" value={profile.maxExpenses} onChange={(e) => setProfile({ maxExpenses: +e.target.value })} />
          </Field>
        </GlassCard>
      </Section>

      <Section title="Agente IA (add-on)">
        <GlassCard className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gold" />
            <span className="text-sm font-medium">Não incluído nesta versão</span>
          </div>
          <p className="text-xs text-muted-foreground">
            O <strong>Agente IA</strong> — análises cruzadas de todos os seus módulos em linguagem natural — será
            oferecido em breve como add-on/assinatura separada. Sua licença atual inclui todos os módulos de
            registro e acompanhamento.
          </p>
        </GlassCard>
      </Section>


      <Section title="Dados">
        <GlassCard className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button onClick={download} className="btn-gold">Baixar backup (JSON)</button>
            <button
              onClick={() => setClearOpen(true)}
              className="px-4 py-2 rounded-lg bg-coral text-white font-semibold hover:brightness-110"
            >
              Apagar todos os dados
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            O backup é um arquivo comum no seu computador. Guarde num lugar seguro — ele não tem senha.
          </p>
          <Field label="Restaurar de um backup">
            <textarea
              className="inp"
              rows={3}
              placeholder="Cole aqui o conteúdo do arquivo .json..."
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            Restaurar <strong>substitui</strong> tudo que está aqui hoje pelo conteúdo do arquivo.
          </p>
          <button onClick={handleImport} className="text-sm text-gold hover:underline">Restaurar →</button>
        </GlassCard>
      </Section>

      <Modal open={clearOpen} onClose={() => { setClearOpen(false); setClearConfirm(""); }} title="Apagar todos os dados">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Isso apaga suas transações, pesos, treinos, livros, estudos e metas —
            <strong className="text-foreground"> inclusive a cópia na nuvem</strong>. Não há como desfazer
            e não existe lixeira.
          </p>

          <div className="rounded-lg border border-white/10 p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">1. Baixe um backup antes</span>
              <button onClick={download} className="text-sm text-gold hover:underline shrink-0">
                {backupFeito ? "Baixar de novo" : "Baixar agora"}
              </button>
            </div>
            {backupFeito && <p className="text-xs text-emerald-bgt">Backup baixado.</p>}
          </div>

          <Field label={`2. Digite APAGAR para confirmar`}>
            <input
              className="inp"
              value={clearConfirm}
              onChange={(e) => setClearConfirm(e.target.value)}
              placeholder="APAGAR"
              autoComplete="off"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => { setClearOpen(false); setClearConfirm(""); }}
              className="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition"
            >
              Cancelar
            </button>
            <button
              onClick={executarLimpeza}
              disabled={clearConfirm.trim().toUpperCase() !== "APAGAR"}
              className="px-4 py-2 rounded-lg bg-coral text-white font-semibold text-sm hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apagar tudo
            </button>
          </div>
        </div>
      </Modal>

      <Section title="Aparência">
        <GlassCard className="space-y-4">
          <Field label="Tema">
            <div className="flex gap-2">
              <button
                onClick={() => setSettings({ theme: "dark" })}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${settings.theme === "dark" ? "border-gold bg-gold/10" : "border-white/10"}`}
              >
                <Moon size={16} /> Escuro
              </button>
              <button
                onClick={() => setSettings({ theme: "light" })}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${settings.theme === "light" ? "border-gold bg-gold/10" : "border-white/10"}`}
              >
                <Sun size={16} /> Claro
              </button>
            </div>
          </Field>
          <Field label="Cor de destaque">
            <div className="flex gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSettings({ accent: a.id })}
                  className={`w-10 h-10 rounded-full transition ${settings.accent === a.id ? "ring-2 ring-offset-2 ring-offset-background ring-white" : ""}`}
                  style={{ backgroundColor: a.color }}
                  title={a.label}
                />
              ))}
            </div>
          </Field>
        </GlassCard>
      </Section>

      <style>{`
        .inp { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 12px; font-size: 14px; color: inherit; }
        .inp:focus { outline: none; border-color: #F5C842; }
        .btn-gold { background: #F5C842; color: #0A0F1E; font-weight: 600; padding: 8px 16px; border-radius: 8px; }
        .btn-gold:hover { filter: brightness(1.1); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-muted-foreground block mb-1">{label}</span>
      {children}
    </label>
  );
}