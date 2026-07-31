import { MetadataRoute } from "next";
import { getAllRoutesFlat } from "@/lib/sitemap-utils";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const routes = getAllRoutesFlat();

  return routes.map((route) => ({
    url: `${baseUrl}${route.url}`,
    lastModified: new Date(),
  }));
}
