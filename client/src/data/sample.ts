import type { Meal, Post, User } from "../types/api";

export const demoUser: User = {
  id: "demo-user",
  email: "demo@dailymeal.local",
  displayName: "Trứng bắc thảo",
  avatarUrl: undefined,
  bio: "Ghi lại món ăn, công thức và lượng calo mỗi ngày.",
  isPremium: true,
  preferences: {
    interests: ["photography", "recipes"],
    eatingStyles: ["calorie-deficit"],
    completedOnboarding: true
  },
  counts: {
    posts: 12,
    followers: 88,
    following: 24
  }
};

export const demoPosts: Post[] = [
  {
    _id: "demo-post-1",
    author: demoUser,
    images: [{ url: "" }, { url: "" }, { url: "" }],
    layout: "grid",
    imageTransforms: [
      { scale: 1, rotation: 0, offsetX: 0, offsetY: 0 },
      { scale: 1, rotation: 0, offsetX: 0, offsetY: 0 },
      { scale: 1, rotation: 0, offsetX: 0, offsetY: 0 }
    ],
    caption: "Nó ngon phải biết. Ăn nhẹ nhưng vẫn đủ protein cho bữa trưa.",
    tags: ["healthy", "protein", "homecook"],
    recipe: {
      title: "Trứng bắc thảo sốt xanh",
      ingredients: ["Trứng", "rau thơm", "sốt mè", "ớt"],
      steps: ["Chuẩn bị nguyên liệu", "Trộn sốt", "Bày món và thêm rau thơm"]
    },
    nutritionSummary: {
      calories: 480,
      protein: 28,
      carbs: 42,
      fat: 18,
      confidence: 0.7
    },
    visibility: "public",
    stats: {
      likes: 12,
      comments: 4,
      saves: 8
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const demoMeals: Meal[] = [
  {
    _id: "demo-meal-1",
    image: { url: "" },
    result: {
      items: [
        {
          name: "Cơm gà áp chảo",
          portion: "1 đĩa vừa",
          calories: 560,
          protein: 36,
          carbs: 54,
          fat: 20,
          confidence: 0.68
        }
      ],
      total: {
        calories: 560,
        protein: 36,
        carbs: 54,
        fat: 20
      },
      warnings: ["Demo khi chưa có dữ liệu từ server."]
    },
    createdAt: new Date().toISOString()
  }
];
