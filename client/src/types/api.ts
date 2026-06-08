export type User = {
  id: string;
  email?: string;
  phone?: string;
  displayName: string;
  avatarUrl?: string;
  coverUrl?: string;
  bio?: string;
  birthday?: {
    date?: string;
    day?: number;
    month?: number;
    visibility: "hidden" | "dayMonth" | "full";
  };
  isPremium: boolean;
  premiumTrialUsed?: boolean;
  premiumTrialStartedAt?: string;
  premiumTrialEndsAt?: string;
  themeColor?: string;
  preferences: {
    interests: string[];
    eatingStyles: string[];
    completedOnboarding: boolean;
  };
  counts?: {
    posts: number;
    followers: number;
    following: number;
    friends?: number;
  };
  relationship?: {
    isFollowing: boolean;
    followsMe: boolean;
    isFriend: boolean;
  };
  viewerInteraction?: {
    restricted: boolean;
    blocked: boolean;
    reported: boolean;
  };
};

export type PremiumPlan = {
  id: "premium_month" | "premium_quarter" | "premium_half";
  name: string;
  displayPrice: string;
  amount: number;
  durationMonths: number;
};

export type PayosPayment = {
  id: string;
  planId: PremiumPlan["id"];
  orderCode: number;
  amount: number;
  currency: "VND";
  status: "PENDING" | "PAID" | "PROCESSING" | "CANCELLED" | "EXPIRED";
  paymentLinkId?: string;
  checkoutUrl?: string;
  qrCode?: string;
};

export type Sticker = {
  _id: string;
  key: string;
  name: string;
  assetPath: string;
  premiumOnly: boolean;
};

export type NutritionSummary = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence?: number;
};

export type PostImage = {
  url: string;
  localPath?: string;
  uploadId?: string;
};

export type PostLayout = "stack" | "grid" | "cascade";

export type PostImageTransform = {
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
};

export type ImageRecipe = {
  imageIndex: number;
  title: string;
  ingredients: string[];
  steps: string[];
};

export type StickerPlacement = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

export type PostVisibility = "public" | "friends" | "private";

export type Post = {
  _id: string;
  author: User;
  images: PostImage[];
  layout?: PostLayout;
  imageTransforms?: PostImageTransform[];
  caption: string;
  tags: string[];
  recipe?: {
    title?: string;
    ingredients: string[];
    steps: string[];
  };
  recipes?: ImageRecipe[];
  nutritionSummary?: NutritionSummary;
  nutritionDetails?: NutritionDetail[];
  stickerId?: Sticker;
  stickerPlacement?: StickerPlacement;
  visibility: PostVisibility;
  stats: {
    likes: number;
    comments: number;
    saves: number;
  };
  viewerState?: {
    liked: boolean;
    saved: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

export type Upload = {
  _id: string;
  url: string;
  localPath?: string;
  storageProvider?: "local" | "s3";
  s3Bucket?: string;
  s3Key?: string;
  mime: string;
  size: number;
};

export type MealAnalysisItem = {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
};

export type NutritionDetail = {
  imageIndex: number;
  items: MealAnalysisItem[];
  total: NutritionSummary;
  warnings?: string[];
  mealId?: string;
};

export type Meal = {
  _id: string;
  image: {
    url: string;
    localPath?: string;
    uploadId?: string;
  };
  result: {
    items: MealAnalysisItem[];
    total: NutritionSummary;
    warnings: string[];
    raw?: unknown;
  };
  linkedPostId?: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  sender: Pick<User, "id" | "displayName" | "avatarUrl" | "isPremium">;
  body: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  participants: Array<Pick<User, "id" | "displayName" | "avatarUrl" | "isPremium">>;
  otherUser: Pick<User, "id" | "displayName" | "avatarUrl" | "isPremium">;
  lastMessage?: {
    body?: string;
    sentAt?: string;
  };
  updatedAt: string;
};

export type AdminDashboard = {
  totals: { users: number; posts: number };
  today: {
    users: number;
    posts: number;
    interactions: number;
    likes: number;
    saves: number;
    comments: number;
    userInteractions: number;
  };
};

export type AdminUserSummary = {
  id: string;
  email?: string;
  phone?: string;
  displayName: string;
  avatarUrl?: string;
  isPremium: boolean;
  premiumTrialUsed?: boolean;
  premiumTrialStartedAt?: string;
  premiumTrialEndsAt?: string;
  counts?: User["counts"];
  stats: { posts: number; followers: number; following: number; reports: number };
  createdAt?: string;
  updatedAt?: string;
};

export type AdminUserDetail = AdminUserSummary & {
  bio?: string;
  birthday?: User["birthday"];
  preferences?: User["preferences"];
  themeColor?: string;
  recentPosts: Array<{
    id: string;
    caption: string;
    visibility: string;
    stats?: { likes: number; comments: number; saves: number };
    imageCount: number;
    createdAt?: string;
  }>;
  interactions: Array<{ id: string; type: string; note?: string; actor?: string; createdAt?: string }>;
};
