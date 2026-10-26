import type { MetadataRoute } from "next";
import { baseUrl } from "@/lib/billing";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/signup", "/book", "/privacy", "/terms"], disallow: ["/api/", "/portal", "/approve", "/track", "/review"] },
    sitemap: `${baseUrl()}/sitemap.xml`,
  };
}
