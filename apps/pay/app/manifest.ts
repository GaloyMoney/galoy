import { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "POS Cash Register",
    short_name: "Cash Register",
    theme_color: "#fc5805",
    background_color: "#fff",
    description:
      "A Bitcoin POS cash register application that connects with the merchant's wallet",
    start_url: "/setuppwa/",
    scope: "/",
    display: "standalone",
    id: "/",
    icons: [
      {
        src: "/icon-POS.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  }
}
