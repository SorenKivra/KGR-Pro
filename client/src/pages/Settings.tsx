import { trpc } from "@/lib/trpc";
import { ArrowUpRight, Check, DatabaseZap, LockKeyhole, MapPinned, ShieldCheck } from "lucide-react";

function ConfigurationLine({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 py-4 last:border-0">
      <div className="flex items-center gap-3 text-sm text-slate-400"><Icon className="h-4 w-4 text-lime-300" />{label}</div>
      <span className="font-mono text-xs text-slate-200">{value}</span>
    </div>
  );
}

export default function Settings() {
  const configuration = trpc.kgr.configuration.useQuery();
  const isConnected = configuration.data?.configured;

  return (
    <div className="app-grid min-h-[calc(100vh-4rem)] -m-4 p-4 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] font-medium tracking-[0.22em] text-lime-300"><span className="h-1.5 w-1.5 rounded-full bg-lime-300" />SECURE CONFIGURATION</div>
            <h1 className="max-w-full text-3xl font-extrabold leading-tight tracking-tight text-slate-100 sm:text-4xl">Research data connection</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Your workspace runs live Google USA allintitle searches through Scrapingdog’s advanced SERP response, with exact total-results metadata used for KGR.</p>
          </div>
          <a className="inline-flex items-center gap-1.5 text-sm font-semibold text-lime-300 hover:text-lime-200" href="https://www.scrapingdog.com/google-serp-api/" target="_blank" rel="noreferrer">Scrapingdog account <ArrowUpRight className="h-4 w-4" /></a>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="panel-sheen rounded-2xl border border-white/10 bg-[#101721]/80 p-6 shadow-2xl">
            <div className="mb-7 flex items-start justify-between gap-5">
              <div className="flex gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime-300/10 text-lime-300"><DatabaseZap className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-100">Scrapingdog exact-count API</h2><p className="mt-1 text-sm text-slate-500">Server-side credential vault</p></div></div>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium ${isConnected ? "border-lime-300/20 bg-lime-300/10 text-lime-200" : "border-rose-400/20 bg-rose-400/10 text-rose-300"}`}><span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-lime-300" : "bg-rose-400"}`} />{configuration.isLoading ? "CHECKING" : isConnected ? "CONNECTED" : "NOT CONFIGURED"}</span>
            </div>
            <ConfigurationLine icon={LockKeyhole} label="API key" value={isConnected ? "Securely configured" : "No key detected"} />
            <ConfigurationLine icon={MapPinned} label="Search target" value="Google · United States" />
            <ConfigurationLine icon={ShieldCheck} label="Search mode" value="Advanced · total_results" />
            <ConfigurationLine icon={DatabaseZap} label="Serper.dev" value={configuration.data?.serperConfigured ? "Separate diagnostic key" : "Not configured"} />
          </section>

          <aside className="rounded-2xl border border-lime-300/15 bg-lime-300/[0.06] p-6">
            <ShieldCheck className="h-6 w-6 text-lime-300" />
            <h2 className="mt-5 text-lg font-bold text-slate-100">Key protection</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">The API key you supplied is stored as a protected server secret. It is never returned to the browser, included in exports, or persisted with research results.</p>
            <div className="mt-6 flex items-center gap-2 text-xs text-lime-200"><Check className="h-4 w-4" />Session-ready configuration</div>
          </aside>

          <aside className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-6 lg:col-span-2">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-amber-200">Exact-count transparency</p>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">Google displays the authoritative allintitle value in <span className="font-mono text-amber-100">Tools → About N results</span>. Scrapingdog’s advanced Google response exposes the corresponding <span className="font-mono text-amber-100">search_information.total_results</span> field. Serper.dev remains separate for diagnostics and is not used as a substitute for the exact count.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
