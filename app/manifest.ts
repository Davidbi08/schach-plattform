import type { MetadataRoute } from "next";


export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Schachplattform",
    short_name: "Schach",
    description: "Deine Schachplattform für Partien und Community.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#020617",
    icons: [
      {
        src: "/api/pwa-icon?size=192&v=3",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/pwa-icon?size=512&v=3",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
