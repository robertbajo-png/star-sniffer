import { useEffect } from "react";
import { PikachuGame } from "@/components/PikachuGame";

const Index = () => {
  useEffect(() => {
    document.title = "Pocket Trails – Cozy Critter Dash";
    const desc = "Choose Pikachu, Charizard, Gengar, or a laid-back capybara and explore vibrant arcade game modes.";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = desc;

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      canonical.href = window.location.origin + "/";
      document.head.appendChild(canonical);
    } else {
      canonical.href = window.location.origin + "/";
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-foreground">
      <header className="sr-only">
        <h1>Pocket Trails – Cozy Critter Dash</h1>
      </header>
      <main className="flex items-center justify-center">
        <PikachuGame />
      </main>
    </div>
  );
};

export default Index;
