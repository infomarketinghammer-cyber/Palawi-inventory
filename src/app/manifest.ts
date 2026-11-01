import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Palawi — पालवी",
    short_name: "Palawi",
    description: "Palawi inventory & operations / पालवी साठा व कामकाज नोंदवही",
    start_url: "/",
    display: "standalone",
    background_color: "#f6fbf9",
    theme_color: "#3c7b62",
    lang: "mr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
