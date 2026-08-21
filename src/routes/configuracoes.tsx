import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { GlassCard, PageHeader, Section } from "@/components/primitives";
import { todayISO } from "@/lib/format";
import { Moon, Sun } from "lucide-react";

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

  const download = () => {
    const blob = new Blob([exportAll()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `altus-export-${todayISO()}.json`;
    a.click();
  };

  const confirmClear = () => {
    if (confirm("Tem certeza? Todos os dados serão apagados permanentemente.")) clearAll();
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
            <button onClick={download} className="btn-gold">Exportar JSON</button>
            <button onClick={confirmClear} className="px-4 py-2 rounded-lg bg-coral text-white font-semibold hover:brightness-110">Limpar Todos os Dados</button>
          </div>
          <Field label="Importar de JSON">
            <textarea className="inp" rows={3} placeholder="Cole o JSON exportado..." value={importText} onChange={(e) => setImportText(e.target.value)} />
          </Field>
          <button onClick={() => { importAll(importText); setImportText(""); }} className="text-sm text-gold hover:underline">Importar →</button>
        </GlassCard>
      </Section>

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