import fs from "node:fs";
import path from "node:path";
import { User } from "../models/User.js";
import { Post } from "../models/Post.js";
import { Notification } from "../models/Notification.js";
import { Sticker } from "../models/Sticker.js";
import { env } from "../config/env.js";

// Helper to copy figma snapshots to server uploads folder
export function seedMockAssets() {
  try {
    const clientAssetsDir = path.resolve(process.cwd(), "../client/assets/figma-snapshots");
    if (!fs.existsSync(clientAssetsDir)) {
      console.log("⚠️ Client assets directory not found at:", clientAssetsDir);
      return;
    }

    const uploadsDir = env.UPLOAD_DIR;
    fs.mkdirSync(uploadsDir, { recursive: true });

    const files = fs.readdirSync(clientAssetsDir);
    let copied = 0;
    for (const file of files) {
      if (file.endsWith(".png") || file.endsWith(".jpg") || file.endsWith(".jpeg")) {
        const src = path.join(clientAssetsDir, file);
        const dest = path.join(uploadsDir, file);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
          copied++;
        }
      }
    }
    if (copied > 0) {
      console.log(`✅ Successfully seeded ${copied} mock food images to uploads.`);
    }
  } catch (error) {
    console.error("❌ Failed to seed mock food images:", error);
  }
}

export async function seedMockData() {
  try {
    // 1. Seed assets
    seedMockAssets();

    // 2. Create mock users
    const mockUsersData = [
      {
        email: "trungbacthao@dailymeal.local",
        displayName: "Trứng bắc thảo",
        bio: "Ghi lại món ăn, công thức và lượng calo mỗi ngày. 🍽️",
        avatarUrl: "/uploads/image8.png",
        isPremium: true
      },
      {
        email: "thohuong@dailymeal.local",
        displayName: "Thỏ hường",
        bio: "Chuyên làm bánh healthy và món chay ngon lành. 🐰🍰",
        avatarUrl: "/uploads/image9.png",
        isPremium: true
      },
      {
        email: "becho@dailymeal.local",
        displayName: "Bé Chó",
        bio: "Eat clean mỗi ngày để khoẻ mạnh & năng lượng! 🐶🥗",
        avatarUrl: "/uploads/image10.png",
        isPremium: false
      },
      {
        email: "trungbongbenh@dailymeal.local",
        displayName: "Trứng bồng bềnh",
        bio: "Yêu thích cơm gà áp chảo và nước ép trái cây. 🍳🍊",
        avatarUrl: "/uploads/image6.png",
        isPremium: true
      }
    ];

    const seededUsers: any[] = [];
    for (const userData of mockUsersData) {
      let user = await User.findOne({ email: userData.email });
      if (!user) {
        user = await User.create({
          email: userData.email,
          displayName: userData.displayName,
          bio: userData.bio,
          avatarUrl: userData.avatarUrl,
          isPremium: userData.isPremium,
          preferences: {
            interests: ["recipes", "nutrition"],
            eatingStyles: ["clean-eating"],
            completedOnboarding: true
          },
          counts: { posts: 1, followers: 88, following: 24, friends: 15 }
        });
      }
      seededUsers.push(user);
    }

    // 3. Create mock posts from these users if they don't have posts yet
    const stickers = await Sticker.find().lean();
    const defaultStickerId = stickers[0]?._id;

    const mockPostsData = [
      {
        authorEmail: "trungbacthao@dailymeal.local",
        post: {
          images: [{ url: "/uploads/image3.png" }],
          layout: "stack" as const,
          caption: "Bữa trưa dinh dưỡng với cơm gạo lứt tôm rim cùng dưa chuột. Vừa ngon miệng lại vừa healthy nhẹ bụng!",
          tags: ["healthy", "protein", "lunch"],
          recipe: {
            title: "Cơm gạo lứt tôm rim dưa chuột",
            ingredients: [
              "150g tôm tươi bóc vỏ",
              "1 chén cơm gạo lứt chín dẻo",
              "1 quả dưa chuột cắt lát",
              "Gia vị: tỏi, nước tương nhạt, dầu olive"
            ],
            steps: [
              "Áp chảo tôm với chút tỏi và 1 muỗng cafe dầu olive cho săn vàng thơm phức.",
              "Thêm 1 muỗng cafe nước tương nhạt rim liu riu 2 phút cho ngấm.",
              "Bày cơm gạo lứt ra đĩa, xếp tôm rim bên cạnh cùng dưa chuột giòn ngon."
            ]
          },
          nutritionSummary: {
            calories: 450,
            protein: 26,
            carbs: 48,
            fat: 14,
            confidence: 0.88
          },
          stats: { likes: 18, comments: 2, saves: 10 }
        }
      },
      {
        authorEmail: "thohuong@dailymeal.local",
        post: {
          images: [{ url: "/uploads/image2.png" }],
          layout: "stack" as const,
          caption: "Bánh bông lan trứng xốp siêu mướt làm bằng bột yến mạch và sốt kem dâu chua ngọt thơm lừng!",
          tags: ["healthy", "dessert", "lowcarb"],
          recipe: {
            title: "Bánh bông lan yến mạch sốt dâu",
            ingredients: [
              "80g bột yến mạch xay mịn",
              "2 quả trứng gà ta tách lòng",
              "30ml sữa hạnh nhân không đường",
              "5 quả dâu tây tươi nghiền mịn sốt ngọt nhẹ"
            ],
            steps: [
              "Đánh bông lòng trắng trứng gà tới chóp mềm mịn.",
              "Trộn đều bột yến mạch, lòng đỏ trứng, sữa hạnh nhân rồi nhẹ nhàng fold lòng trắng vào.",
              "Nướng bánh ở nhiệt độ 160 độ C trong 20 phút rồi phủ sốt dâu tươi lên thưởng thức."
            ]
          },
          nutritionSummary: {
            calories: 320,
            protein: 12,
            carbs: 38,
            fat: 8,
            confidence: 0.85
          },
          stats: { likes: 32, comments: 5, saves: 15 }
        }
      },
      {
        authorEmail: "becho@dailymeal.local",
        post: {
          images: [{ url: "/uploads/image4.png" }],
          layout: "stack" as const,
          caption: "Gỏi cuốn tôm thịt chấm sốt tương đậu phộng béo bùi ngon mát lành cho ngày hè nóng nực.",
          tags: ["cleaneating", "fresh", "wrap"],
          recipe: {
            title: "Gỏi cuốn tôm thịt thanh mát",
            ingredients: [
              "6 lá bánh tráng mỏng",
              "12 con tôm hấp lột vỏ xẻ đôi",
              "100g thịt ba chỉ luộc mỏng",
              "Rau sống thơm giòn, bún tươi, hẹ"
            ],
            steps: [
              "Làm ẩm bánh tráng rồi xếp rau sống, bún, thịt luộc và tôm bóc vỏ.",
              "Thêm cọng hẹ xanh mướt rồi cuộn tròn thật chặt tay.",
              "Chấm đẫm sốt tương đậu phộng pha chút ớt cay nồng."
            ]
          },
          nutritionSummary: {
            calories: 390,
            protein: 22,
            carbs: 45,
            fat: 10,
            confidence: 0.9
          },
          stats: { likes: 41, comments: 8, saves: 24 }
        }
      },
      {
        authorEmail: "trungbongbenh@dailymeal.local",
        post: {
          images: [{ url: "/uploads/image1.png" }],
          layout: "stack" as const,
          caption: "Mì Ý cá hồi áp chảo sốt kem nấm béo ngậy thơm ngon tuyệt vời cho tối cuối tuần lãng mạn.",
          tags: ["salmon", "pasta", "yummy"],
          recipe: {
            title: "Mì Ý cá hồi áp chảo sốt kem nấm",
            ingredients: [
              "100g mì Ý luộc vừa chín tới",
              "150g phi lê cá hồi tươi ngon áp chảo",
              "50g nấm tươi thái mỏng, tỏi băm",
              "80ml whipping cream ít béo"
            ],
            steps: [
              "Áp chảo cá hồi cho chín vàng đều hai mặt rồi xé miếng vừa ăn.",
              "Phi tỏi băm, xào nấm tươi rồi đổ whipping cream đun sôi sền sệt nêm chút muối tiêu.",
              "Trộn mì Ý vào nước sốt kem rồi xếp cá hồi áp chảo lên trên bày ra đĩa."
            ]
          },
          nutritionSummary: {
            calories: 590,
            protein: 34,
            carbs: 58,
            fat: 22,
            confidence: 0.92
          },
          stats: { likes: 55, comments: 12, saves: 31 }
        }
      }
    ];

    for (const postItem of mockPostsData) {
      const author = seededUsers.find((u) => u.email === postItem.authorEmail);
      if (author) {
        const postExists = await Post.exists({ author: author._id });
        if (!postExists) {
          await Post.create({
            ...postItem.post,
            author: author._id,
            stickerId: defaultStickerId
          });
        }
      }
    }
    console.log("✅ Seeded default mock users & posts into MongoDB.");
  } catch (error) {
    console.error("❌ Seeding mock database failed:", error);
  }
}

// Deprecated: keep this as a no-op so existing imports/routes no longer create sample notifications.
export async function seedWelcomeNotificationsForUser(_userId: string) {
  return;
}

export async function createAccountCreatedNotification(userId: string) {
  try {
    await Notification.create({
      user: userId,
      type: "message",
      body: "Bạn đã tạo tài khoản Daily Meal thành công! Chúc bạn có những trải nghiệm thật tốt và luôn vui vẻ trên hành trình ăn uống lành mạnh. 🎉"
    });
  } catch (error) {
    console.error("❌ Failed to create account welcome notification:", error);
  }
}
