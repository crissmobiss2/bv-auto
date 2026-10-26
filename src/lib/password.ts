import crypto from "crypto";
import { z } from "zod";

// Most-used leaked passwords (and obvious shop-themed ones) that pass a length check.
const COMMON = new Set([
  "password", "password1", "password12", "password123", "passw0rd", "12345678", "123456789", "1234567890",
  "11111111", "00000000", "87654321", "qwertyui", "qwerty123", "qwertyuiop", "iloveyou", "sunshine",
  "princess", "football", "baseball", "superman", "letmein1", "welcome1", "welcome123", "admin123",
  "administrator", "abc12345", "abcd1234", "changeme", "trustno1", "mechanic", "mechanic1", "autorepair",
  "carrepair", "bvauto123", "tech1234", "shop1234",
]);

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100)
  .refine((p) => !COMMON.has(p.toLowerCase()), "That password is too common. Pick something harder to guess.")
  .refine((p) => new Set(p).size >= 4, "Use a mix of more characters in your password.");

export const hashResetToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
