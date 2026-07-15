import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "zod";

const pages = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(170),
    draft: z.boolean().default(false),
    updatedAt: z.coerce.date().optional(),
  }),
});

export const collections = { pages };
