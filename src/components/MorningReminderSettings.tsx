import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import {
  disablePush,
  enablePush,
  isPushOnHere,
  pushSupport,
  PushNotConfiguredError,
  sendTestPush,
  VAPID_PUBLIC_KEY,
  type PushSupport,
} from "@/lib/push";

type State = PushSupport | "loading" | "on" | "off" | "not-configured";

/** Configurações → Lembrete da manhã: ativar/desativar neste aparelho e enviar um teste. */
export function MorningReminderSettings() {
  const { t, lang } = useI18n();
  const { session } = useAuth();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const support = pushSupport();
    if (support !== "ready") {
      setState(support);
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      setState("not-configured");
      return;
    }
    isPushOnHere()
      .then((on) => alive && setState(on ? "on" : "off"))
      .catch(() => alive && setState("off"));
    return () => {
      alive = false;
    };
  }, []);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      if (e instanceof PushNotConfiguredError) setState("not-configured");
      else toast.error(t("push.error", { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const enable = () =>
    run(async () => {
      const r = await enablePush(lang);
      if (r === "denied") {
        setState(pushSupport() === "denied" ? "denied" : "off");
        return;
      }
      setState("on");
      toast.success(t("push.enabledToast"));
    });
  const disable = () =>
    run(async () => {
      await disablePush();
      setState("off");
      toast.success(t("push.disabledToast"));
    });
  const test = () =>
    run(async () => {
      if (!session?.access_token) throw new Error(t("push.error", { error: "login" }));
      const { sent } = await sendTestPush(session.access_token);
      toast.success(t("push.testSent", { n: sent }));
    });

  const note =
    state === "ios-install"
      ? t("push.iosInstall")
      : state === "unsupported"
        ? t("push.unsupported")
        : state === "denied"
          ? t("push.denied")
          : state === "not-configured"
            ? t("push.notConfigured")
            : null;

  return (
    <div className="space-y-3" data-push-state={state}>
      <p className="text-xs text-muted-foreground">{t("push.desc")}</p>
      {note && <p className="text-sm">{note}</p>}
      {state === "off" && (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="btn-gold inline-flex items-center gap-2"
        >
          <Bell size={16} /> {t("push.enable")}
        </button>
      )}
      {state === "on" && (
        <>
          <p className="text-sm font-medium">{t("push.on")}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={test}
              disabled={busy}
              className="btn-gold inline-flex items-center gap-2"
            >
              <Send size={16} /> {t("push.test")}
            </button>
            <button
              type="button"
              onClick={disable}
              disabled={busy}
              className="inline-flex items-center gap-2 text-sm text-gold hover:underline"
            >
              <BellOff size={16} /> {t("push.disable")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
