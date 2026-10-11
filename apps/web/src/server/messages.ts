/** Which form field a use-case error belongs to, so it can be shown next to the input. */
const fields: Partial<Record<string, string>> = {
  invalid_email: "email",
  email_taken: "email",
  weak_password: "password",
  invalid_url: "url",
  invalid_text: "name",
};

export const fieldFor = (code: string): string => fields[code] ?? "form";
