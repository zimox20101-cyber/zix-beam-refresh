import { createFileRoute } from "@tanstack/react-router";
import spideyIcon from "@/assets/spidey-icon.png";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const download = () => {
    fetch("/zix-beam-tools.zip")
      .then((res) => {
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "zix-beam-tools.zip";
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((err) => alert(err.message));
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a12] text-white">
      {/* Web background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 28px), repeating-linear-gradient(-45deg, #fff 0 1px, transparent 1px 28px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full blur-3xl"
        style={{ background: "#d1140a", opacity: 0.35 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full blur-3xl"
        style={{ background: "#1a4fbe", opacity: 0.4 }}
      />

      <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
        <img
          src={spideyIcon}
          alt="Zix Beam Tools mascot"
          width={128}
          height={128}
          className="mb-6 h-32 w-32 drop-shadow-[0_0_20px_rgba(209,20,10,0.6)]"
        />

        <h1
          className="text-5xl font-black uppercase tracking-widest sm:text-7xl"
          style={{
            fontFamily: "Impact, 'Arial Black', sans-serif",
            textShadow:
              "3px 3px 0 #d1140a, 6px 6px 0 #1a4fbe, 8px 8px 20px rgba(0,0,0,0.6)",
          }}
        >
          Zix Beam Tools
        </h1>

        <p className="mt-6 max-w-xl text-lg text-white/80">
          A Spiderman-themed Chrome extension. Swing into your session with one click —
          paste your cookie, hit refresh, and let the web do the rest.
        </p>

        <button
          onClick={download}
          className="mt-10 rounded-lg border-2 border-black px-10 py-4 text-xl font-bold uppercase tracking-[0.2em] shadow-[0_4px_0_#000] transition active:translate-y-[3px] active:shadow-[0_1px_0_#000]"
          style={{
            background: "linear-gradient(180deg,#d1140a,#8a0a04)",
          }}
        >
          Download Extension
        </button>

        <section className="mt-16 w-full max-w-2xl rounded-xl border-2 border-[#1a4fbe] bg-black/50 p-6 text-left">
          <h2 className="mb-3 text-xl font-bold uppercase tracking-wider text-white">
            How to install
          </h2>
          <ol className="list-decimal space-y-2 pl-6 text-white/85">
            <li>Unzip the downloaded <code>zix-beam-tools.zip</code>.</li>
            <li>
              Open <code className="text-[#7bff9d]">chrome://extensions</code> in Chrome
              or any Chromium browser.
            </li>
            <li>Enable <strong>Developer mode</strong> (top-right toggle).</li>
            <li>
              Click <strong>Load unpacked</strong> and select the unzipped folder.
            </li>
            <li>Pin Zix Beam Tools and open the popup — hit the Session tab.</li>
          </ol>
        </section>

        <footer className="mt-16 text-xs uppercase tracking-[0.3em] text-white/50">
          With great cookies comes great responsibility
        </footer>
      </main>
    </div>
  );
}
