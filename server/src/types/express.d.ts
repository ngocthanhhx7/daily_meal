export type AuthUser = {
  id: string;
  email?: string;
  phone?: string;
  isPremium: boolean;
  isAdmin?: boolean;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
