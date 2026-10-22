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
  return { token: signToken(authUser), user: { ...authUser, email: user.email } };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      author: { select: { id: true, city: true, joinedDate: true } },
    },
  });
  if (!user) throw new AppError(401, "UNAUTHORIZED", "Account no longer exists");
  return user;
}
