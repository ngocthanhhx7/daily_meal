export type User = {
  id: string;
  email: string;
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

export type Post = {
  _id: string;
  author: User;
  images: PostImage[];
  caption: string;
  tags: string[];
  recipe?: {
    title?: string;
    ingredients: string[];
    steps: string[];
  };
  nutritionSummary?: NutritionSummary;
  stickerId?: Sticker;
  visibility: "public" | "private";
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
  localPath: string;
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
