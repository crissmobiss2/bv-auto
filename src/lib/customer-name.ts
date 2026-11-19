/** Display name for a customer whose last name is optional. */
export function customerName(c: {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
}) {
  const person = [c.firstName, c.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return person || c.company?.trim() || "Customer";
}
