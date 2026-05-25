export type AuthUser = {
  id: string;
  email: string;
  isPremium: boolean;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
