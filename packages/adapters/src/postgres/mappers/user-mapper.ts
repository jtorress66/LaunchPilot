import { parseEmail, userId, type User } from "@launchpilot/domain";
import type { UserRow } from "../schema";

export const userMapper = {
  toRow: (user: User): UserRow => ({
    id: user.id,
    email: user.email,
    password_hash: user.passwordHash,
    created_at: user.createdAt,
  }),
  fromRow: (row: UserRow): User => {
    const email = parseEmail(row.email);
    if (!email.ok) throw new Error(`Unexpected value "${row.email}" in users.email`);
    return {
      id: userId(row.id),
      email: email.value,
      passwordHash: row.password_hash,
      createdAt: row.created_at,
    };
  },
};
