import type { MetadataRoute } from "next";
import { baseUrl } from "@/lib/billing";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/signup", "/privacy", "/terms"].map((path) => ({ url: `${baseUrl()}${path}` }));
}
