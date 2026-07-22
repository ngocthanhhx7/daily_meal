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
  premiumPaidEndsAt?: string;
  streakDays?: number;
  themeColor?: string;
  preferences: {
    interests: string[];
    eatingStyles: string[];
    completedOnboarding: boolean;
  };
  mealRecommendationProfile?: MealRecommendationProfile;
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

export type RecommendationDiet = "flexible" | "vegetarian" | "vegan" | "keto";
export type RecommendationGoal = "balanced" | "low_calorie" | "high_protein";
export type RecommendationBudget = "low" | "medium" | "any";
export type RecommendationMode = "cook" | "eat_out" | "any";
export type MealPeriod = "breakfast" | "lunch" | "dinner" | "late_night";

export type MealRecommendationProfile = {
  diet: RecommendationDiet;
  goals: RecommendationGoal[];
  allergens: string[];
  dislikes: string[];
  preferredCuisines: string[];
  budget: RecommendationBudget;
  maxCookingMinutes: number;
  spiceLevel: "low" | "medium" | "high";
};

export type RecommendationWeatherContext = {
  temperature: number;
  condition: string;
  symbolCode?: string;
  precipitationMm?: number;
  isHot: boolean;
  isCold: boolean;
  isRainy: boolean;
  fetchedAt: string;
};

export type MealRecommendation = {
  key: string;
  source: "curated" | "post";
  name: string;
  description: string;
  imageUrl?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  ingredients: string[];
  steps: string[];
  tags: string[];
  cuisine: string;
  cookingMinutes: number;
  score: number;
  reasons: string[];
  explanation: string;
  explanationSource: "rules" | "gemini";
  allergyNotice?: string;
  post?: Post;
};

export type NearbyRestaurant = {
  key: string;
  name: string;
  address: string;
  distanceMeters?: number;
  latitude: number;
  longitude: number;
  categories: string[];
  cuisine?: string;
  openingHours?: string;
  website?: string;
  phone?: string;
  mapUrl: string;
  matchReason: string;
};

export type TodayRecommendations = {
  profile: MealRecommendationProfile;
  context: {
    mealPeriod: MealPeriod;
    weather?: RecommendationWeatherContext;
    hasLocation: boolean;
  };
  meals: MealRecommendation[];
  nearbyRestaurants: NearbyRestaurant[];
  degraded: {
    weatherUnavailable: boolean;
    placesUnavailable: boolean;
    placesNotConfigured: boolean;
  };
  attribution?: {
    weather?: string;
    places?: string;
  };
};

export type RecommendationFeedbackAction = "liked" | "dismissed" | "opened_recipe" | "opened_restaurant";

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

export type PostVideo = {
  url: string;
  localPath?: string;
  uploadId?: string;
  mime?: string;
  size?: number;
  durationMs?: number;
};

export type PostMediaType = "image" | "video";

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
export type PostSummaryFilter = "all" | "friends" | "following" | "strangers";

export type Post = {
  _id: string;
  author: User;
  mediaType?: PostMediaType;
  images: PostImage[];
  video?: PostVideo;
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
  mediaType?: PostMediaType;
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
  recognition?: {
    itemType?: "food" | "drink" | "unknown" | null;
    brand?: string | null;
    labelText?: string | string[] | null;
    evidence?: string | string[] | null;
    confidence?: number | null;
    [key: string]: unknown;
  };
};

export type MealSuitabilityTarget = {
  label: string;
  reason: string;
};

export type MealSuitabilityItemInsight = {
  key?: string;
  imageIndex: number;
  itemIndex: number;
  name: string;
  portion: string;
  calories: number;
  protein: number;
  verdict: string;
  macroNote: string;
  suitableFor: MealSuitabilityTarget[];
  cautionFor: MealSuitabilityTarget[];
  suggestions: string[];
  confidence: number;
};

export type MealSuitabilityInsight = {
  headline: string;
  summary: string;
  macroBalance: string;
  suitableFor: MealSuitabilityTarget[];
  cautionFor: MealSuitabilityTarget[];
  itemInsights?: MealSuitabilityItemInsight[];
  suggestions: string[];
  confidence: number;
  source?: "gemini" | "fallback";
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

export type AdminBreakdownItem = {
  _id: string;
  count: number;
};

export type AdminDailyPoint = {
  date: string;
  users: number;
  posts: number;
  interactions: number;
  payments: number;
  revenue: number;
  reports: number;
  apiErrors: number;
};

export type AdminRangePreset = "1d" | "7d" | "30d" | "all";

export type AdminAnalytics24hPreset = "last24h" | "today" | "yesterday" | "7d" | "custom";

export type AdminAnalytics24hHourlyPoint = {
  hour: number;
  label: string;
  activeUsers: number;
  events: number;
  posts: number;
  interactions: number;
  likes: number;
  saves: number;
  comments: number;
  reportsOpened: number;
  payments: number;
  paymentFailed: number;
  revenue: number;
  aiMealUsage: number;
};

export type AdminAnalytics24h = {
  range: { start: string; end: string; timezone: string; preset: AdminAnalytics24hPreset | string };
  summary: {
    activeUsers: number;
    newUsers: number;
    posts: number;
    interactions: number;
    likes: number;
    saves: number;
    comments: number;
    reportsOpened: number;
    revenue: number;
    paymentSuccess: number;
    paymentFailed: number;
    aiMealUsage: number;
    aiToPurchaseRate: number;
  };
  hourly: AdminAnalytics24hHourlyPoint[];
  interactionBreakdown: Array<{ type: "likes" | "saves" | "comments" | string; count: number }>;
  aiFunnel: {
    usersUsedAi: number;
    onlyAiNoPurchase: number;
    purchasedAfterAi: number;
    conversionRate: number;
  };
  sourceTraffic: Array<{ source: string; events: number; users: number }>;
  paymentMetrics: { success: number; failed: number; revenue: number };
  reportMetrics: { opened: number; pending: number };
  tables: {
    pendingReports: Array<{ id: string; note: string; status: string; createdAt?: string }>;
    paymentErrors: Array<{ id: string; status: string; amount: number; createdAt?: string }>;
    recentImportantEvents: Array<{ id: string; name: string; occurredAt?: string; screen?: string }>;
    topActions: Array<{ name: string; count: number }>;
  };
};

export type AdminAnalyticsHeatmap = {
  range: { start: string; end: string; timezone: string; preset: string };
  metric: string;
  cells: Array<{ day: string; weekday: string; hour: number; value: number }>;
};

export type AdminPostMediaKind = "single_image" | "multi_image" | "video" | "all";

export type AdminPostSortBy = "createdAt" | "interactions";

export type AdminSortOrder = "asc" | "desc";

export type AdminAnalyticsSummary = {
  range: { start: string; end: string };
  rangePreset: AdminRangePreset;
  activeUsers: { dau: number; wau: number; mau: number; returning: number };
  sessions: {
    total: number;
    averageDurationMs: number;
    bounces: number;
    bounceRate: number;
    earlyExits: number;
    earlyExitRate: number;
  };
  feed: {
    impressions: number;
    clicks: number;
    ctr: number;
    averageScrollDepth: number;
    maxScrollDepth: number;
  };
  technical: {
    apiRequests: number;
    averageApiResponseMs: number;
    apiFailures: number;
    apiFailureRate: number;
    imageLoads: number;
    averageImageLoadMs: number;
    runtimeErrors: number;
    crashRate: number;
    instrumentation: Record<string, string>;
  };
  creatorConversion: { started: number; completed: number; rate: number };
  postCreation: { started: number; completed: number; completionRate: number };
  mealAnalysis: { started: number; completed: number; completionRate: number };
  premiumFunnel: {
    viewed: number;
    checkoutStarted: number;
    paymentStarted: number;
    paymentCompleted: number;
    paymentFailed: number;
    checkoutStartRate: number;
    paymentCompletionRate: number;
  };
};

export type AdminPostSummary = {
  id: string;
  caption?: string;
  mediaType?: PostMediaType;
  video?: PostVideo;
  visibility: PostVisibility;
  moderationStatus: "visible" | "hidden" | "review";
  moderationReason?: string;
  author?: { id: string; displayName?: string; email?: string; avatarUrl?: string };
  images: PostImage[];
  imageCount: number;
  stats: { likes: number; comments: number; saves: number };
  nutritionAttached: boolean;
  createdAt?: string;
  updatedAt?: string;
  moderatedAt?: string;
  moderatedBy?: string;
};

export type AdminPayment = {
  id: string;
  user?: { id: string; displayName?: string; email?: string };
  planId: PremiumPlan["id"];
  orderCode: number;
  amount: number;
  currency: "VND";
  status: PayosPayment["status"];
  paidAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminReportItem = {
  id: string;
  type: "report" | "restrict" | "block";
  note?: string;
  status: "open" | "resolved" | "dismissed";
  adminNote?: string;
  actor?: { id: string; displayName?: string; email?: string };
  target?: { id: string; displayName?: string; email?: string };
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
};

export type AdminAiReportMetric = {
  name: string;
  value: string;
  assessment: string;
  meaning: string;
};

export type AdminAiReportSection = {
  key: "technical" | "behavioral" | "traffic" | "conversion";
  title: string;
  objective: string;
  metrics: AdminAiReportMetric[];
  insights: string[];
  conclusion: string;
  actions: string[];
};

export type AdminAiReportBody = {
  title: string;
  executiveSummary: string[];
  sections?: AdminAiReportSection[];
  technical: string[];
  behavioral: string[];
  traffic: string[];
  conversion: string[];
  anomalies: string[];
  priorityActions: string[];
  risks: string[];
  metricsSnapshot: Record<string, unknown>;
};

export type AdminReport = {
  report: AdminAiReportBody;
  generatedAt: string;
  range: { start: string; end: string };
  rangePreset: AdminRangePreset;
};

export type AdminPagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type AdminDashboard = {
  range: { start: string; end: string };
  rangePreset: AdminRangePreset;
  timeFilter?: {
    startTime?: string;
    endTime?: string;
  };
  totalsAllTime: {
    users: number;
    posts: number;
    meals: number;
    comments: number;
    likes: number;
    saves: number;
    payments: number;
    revenue: number;
    premiumUsers: number;
    openReports: number;
    hiddenPosts: number;
  };
  totalsInRange: {
    users: number;
    posts: number;
    meals: number;
    comments: number;
    likes: number;
    saves: number;
    payments: number;
    revenue: number;
    premiumUsers: number;
    openReports: number;
    hiddenPosts: number;
  };
  today: {
    users: number;
    posts: number;
    interactions: number;
    likes: number;
    saves: number;
    comments: number;
    userInteractions: number;
  };
  charts: { daily: AdminDailyPoint[] };
  breakdowns: {
    usersByPremium: AdminBreakdownItem[];
    postsByVisibility: AdminBreakdownItem[];
    postsByModeration: AdminBreakdownItem[];
    paymentsByStatus: AdminBreakdownItem[];
    reportsByStatus: AdminBreakdownItem[];
  };
  analytics: AdminAnalyticsSummary;
  recent: {
    reports: AdminReportItem[];
    posts: AdminPostSummary[];
    payments: AdminPayment[];
    audit: Array<{ id: string; adminEmail: string; action: string; targetType: string; targetId: string; note?: string; createdAt?: string }>;
  };
};

export type AdminUserInsights = {
  range: { start: string; end: string };
  rangePreset: AdminRangePreset;
  timeFilter?: {
    startTime?: string;
    endTime?: string;
  };
  summary: {
    totalSessions: number;
    totalDurationMs?: number;
    averageSessionDurationMs: number;
    activeUsers: number;
    returningUsers: number;
  };
  dailyUsage: Array<{
    date: string;
    sessions: number;
    activeUsers: number;
    totalDurationMs: number;
    averageSessionDurationMs: number;
  }>;
  hourlyActivity: Array<{
    hour: number;
    label: string;
    sessions: number;
    activeUsers: number;
    totalDurationMs: number;
    averageSessionDurationMs: number;
  }>;
  peakActivityWindow?: {
    hour: number;
    label: string;
    sessions: number;
    activeUsers: number;
    totalDurationMs: number;
    averageSessionDurationMs: number;
  };
  topUsers: Array<{
    id: string;
    displayName: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
    isPremium: boolean;
    sessions: number;
    totalDurationMs: number;
    averageSessionDurationMs: number;
    posts: number;
    interactions: number;
    score: number;
    returning: boolean;
  }>;
};

export type AdminPostInsights = {
  range: { start?: string; end?: string };
  filters: { mediaKind: AdminPostMediaKind };
  summary: {
    totalPosts: number;
    totalInteractions: number;
  };
  mediaBreakdown: Array<{
    key: AdminPostMediaKind;
    count: number;
    interactions: number;
  }>;
  topPosts: AdminPostSummary[];
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
    moderationStatus?: "visible" | "hidden" | "review";
    moderationReason?: string;
    stats?: { likes: number; comments: number; saves: number };
    imageCount: number;
    createdAt?: string;
  }>;
  interactions: Array<{ id: string; type: string; note?: string; status?: string; adminNote?: string; actor?: string; createdAt?: string; resolvedAt?: string; resolvedBy?: string }>;
  audit?: Array<{ id: string; action: string; note?: string; createdAt?: string }>;
};
