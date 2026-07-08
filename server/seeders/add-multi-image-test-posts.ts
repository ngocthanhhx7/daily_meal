import { Comment } from "../src/models/Comment.js";
import { Notification } from "../src/models/Notification.js";
import { Post } from "../src/models/Post.js";
import { PostLike } from "../src/models/PostLike.js";
import { PostSave } from "../src/models/PostSave.js";
import { Sticker } from "../src/models/Sticker.js";
import { User } from "../src/models/User.js";
import { connectDatabase, disconnectDatabase } from "../src/config/db.js";

const TEST_TAG = "multi-image-test";
const AUTHOR_EMAIL = "sample.user001@dailymeal.local";

const captions = [
  "MULTI_IMAGE_TEST_2_ANH - Layout 2 ảnh không chồng",
  "MULTI_IMAGE_TEST_3_ANH - Layout 3 ảnh như mẫu",
  "MULTI_IMAGE_TEST_4_ANH - Layout 4 ảnh dạng grid"
];

const imageCounts = [2, 3, 4];

const imageUrls = [
  "/uploads/image1.png",
  "/uploads/image2.png",
  "/uploads/image3.png",
  "/uploads/image4.png",
  "/uploads/image5.png",
  "/uploads/image6.png"
];

async function main() {
  await connectDatabase();

  const author = await User.findOne({ email: AUTHOR_EMAIL });
  if (!author) {
    throw new Error(`Missing sample author: ${AUTHOR_EMAIL}`);
  }

  const existingPosts = await Post.find({ tags: TEST_TAG }).select("_id").lean();
  const existingPostIds = existingPosts.map((post) => post._id);

  if (existingPostIds.length) {
    await Promise.all([
      Comment.deleteMany({ post: { $in: existingPostIds } }),
      Notification.deleteMany({ post: { $in: existingPostIds } }),
      PostLike.deleteMany({ post: { $in: existingPostIds } }),
      PostSave.deleteMany({ post: { $in: existingPostIds } }),
      Post.deleteMany({ _id: { $in: existingPostIds } })
    ]);
  }

  const sticker = await Sticker.findOne();
  const now = Date.now();
  const posts = captions.map((caption, index) => ({
    author: author._id,
    mediaType: "image",
    images: Array.from({ length: imageCounts[index] ?? 3 }).map((_, offset) => ({
      url: imageUrls[index + offset] ?? imageUrls[offset]!
    })),
    layout: index % 2 === 0 ? "cascade" : "grid",
    imageTransforms: [
      { scale: 1, rotation: -2, offsetX: 0, offsetY: 0 },
      { scale: 1, rotation: 2, offsetX: 0, offsetY: 0 },
      { scale: 1, rotation: -1, offsetX: 0, offsetY: 0 }
    ],
    caption,
    tags: [TEST_TAG, "multi-demo", "nhieu-anh"],
    recipe: {
      title: caption,
      ingredients: ["Cơm", "Rau củ", "Protein", "Nước sốt"],
      steps: ["Chuẩn bị nguyên liệu.", "Nấu và trình bày từng phần.", "Chụp nhiều ảnh để chia sẻ."]
    },
    recipes: Array.from({ length: imageCounts[index] ?? 3 }).map((_, imageIndex) => ({
      imageIndex,
      title: `${caption} - ảnh ${imageIndex + 1}`,
      ingredients: ["Nguyên liệu mẫu", "Gia vị nhẹ"],
      steps: ["Sơ chế.", "Nấu chín.", "Trang trí."]
    })),
    nutritionSummary: {
      calories: 620 + index * 45,
      protein: 32,
      carbs: 70,
      fat: 20,
      confidence: 0.9
    },
    nutritionDetails: Array.from({ length: imageCounts[index] ?? 3 }).map((_, imageIndex) => ({
      imageIndex,
      items: [
        {
          name: `Món mẫu ${imageIndex + 1}`,
          portion: "1 phần",
          calories: 180 + imageIndex * 40,
          protein: 10,
          carbs: 22,
          fat: 6,
          confidence: 0.88
        }
      ],
      total: {
        calories: 180 + imageIndex * 40,
        protein: 10,
        carbs: 22,
        fat: 6,
        confidence: 0.88
      },
      warnings: []
    })),
    stickerId: sticker?._id,
    stickerPlacement: { x: 0.76, y: 0.08, scale: 1, rotation: 0 },
    visibility: "public",
    moderationStatus: "visible",
    stats: {
      likes: 48 + index * 7,
      comments: 12 + index * 3,
      saves: 20 + index * 2
    },
    createdAt: new Date(now - index * 60_000),
    updatedAt: new Date(now - index * 60_000)
  }));

  await Post.insertMany(posts);
  await User.findByIdAndUpdate(author._id, {
    $inc: { "counts.posts": posts.length - existingPostIds.length }
  });

  console.log("Created multi-image test posts:");
  posts.forEach((post) => console.log(`- ${post.caption}`));
  console.log(`Search keyword: ${TEST_TAG}`);
}

main()
  .catch((error) => {
    console.error("Failed to create multi-image test posts.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
