export default function manifest() {
  return {
    name: "Civikoo",
    short_name: "Civikoo",
    description: "Um 'Waze + Pokémon GO' urbano. Cidadãos reportam problemas (buraco, lixo, iluminação) com foto e localização, e ganham recompensas de jogo.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: "#f59e0b",
    background_color: "#fafafa",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
    categories: ["utilities", "lifestyle", "navigation"],
    lang: "pt-BR",
    dir: "ltr",
    prefer_related_applications: false,
  }
}