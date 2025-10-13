import { useEffect } from "react";
import { PikachuGame } from "@/components/PikachuGame";

const Index = () => {
  useEffect(() => {
    document.title = "Pikachu Dash – Geometry Style Game";
    const desc = "Help Pikachu dash through obstacles with flying and gravity modes.";
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="sr-only">
        <h1>Pikachu Dash - Geometry Style Game</h1>
      </header>
      <main className="flex items-center justify-center">
        <PikachuGame />
      </main>
    </div>
  );
};

export default Index;
