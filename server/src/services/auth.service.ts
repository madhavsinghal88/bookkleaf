import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { signToken, type AuthUser } from "../middleware/auth.js";

// Used when the email is unknown, so a failed login takes the same time
// whether or not the account exists (avoids leaking which emails are registered).
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { author: { select: { id: true } } },
  });

  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Incorrect email or password");
  }

  const authUser: AuthUser = {
    id: user.id,
    name: user.name,
    role: user.role,
    authorId: user.author?.id ?? null,
  };
  return { token: signToken(authUser), user: { ...authUser, email: user.email, language: user.language } };
}

const profileSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  language: true,
  author: { select: { id: true, phone: true, city: true, joinedDate: true } },
} as const;

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
  if (!user) throw new AppError(401, "UNAUTHORIZED", "Account no longer exists");
  return user;
}

export async function updateProfile(
  authUser: AuthUser,
  input: { name: string; phone?: string; city?: string; language: "en" | "hi" },
) {
  const authorData: { name: string; phone?: string | null; city?: string | null } = { name: input.name };
  if (input.phone !== undefined) authorData.phone = input.phone.trim() || null;
  if (input.city !== undefined) authorData.city = input.city.trim() || null;

  const user = await prisma.user.update({
    where: { id: authUser.id },
    data: {
      name: input.name,
      language: input.language,
      author: authUser.authorId ? { update: authorData } : undefined,
    },
    select: profileSelect,
  });

  const next: AuthUser = { ...authUser, name: user.name };
  return {
    token: signToken(next),
    user: { ...next, email: user.email, language: user.language },
    profile: user,
  };
}
