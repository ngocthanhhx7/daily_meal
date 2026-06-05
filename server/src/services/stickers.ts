import { Sticker } from "../models/Sticker.js";

const defaultStickers = [
  {
    key: "custom-smile",
    name: "Mặt cười",
    assetPath: "/assets/stickers/custom-smile.png",
    premiumOnly: false
  },
  {
    key: "openmoji-yum",
    name: "Ngon quá",
    assetPath: "/assets/stickers/openmoji-yum.png",
    premiumOnly: false
  },
  {
    key: "openmoji-cooking",
    name: "Đầu bếp",
    assetPath: "/assets/stickers/openmoji-cooking.png",
    premiumOnly: true
  },
  {
    key: "openmoji-noodles",
    name: "Mì nóng",
    assetPath: "/assets/stickers/openmoji-noodles.png",
    premiumOnly: true
  },
  // Noto Emoji VIP Stickers
  {
    _id: "60b8d5a1f2e3d4c5b6a70001",
    key: "apple",
    name: "Táo đỏ",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f34e/512.webp",
    premiumOnly: true
  },
  {
    _id: "60b8d5a1f2e3d4c5b6a70002",
    key: "pancake",
    name: "Bánh kếp",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f95e/512.webp",
    premiumOnly: true
  },
  {
    _id: "60b8d5a1f2e3d4c5b6a70003",
    key: "salad",
    name: "Xà lách",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f957/512.webp",
    premiumOnly: true
  },
  {
    _id: "60b8d5a1f2e3d4c5b6a70004",
    key: "noodles",
    name: "Mì ramen",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f35c/512.webp",
    premiumOnly: true
  },
  {
    _id: "60b8d5a1f2e3d4c5b6a70005",
    key: "cooking",
    name: "Chiên trứng",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f373/512.webp",
    premiumOnly: true
  },
  {
    _id: "60b8d5a1f2e3d4c5b6a70006",
    key: "heart-eyes",
    name: "Mê mẩn",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f60d/512.webp",
    premiumOnly: true
  },
  {
    _id: "60b8d5a1f2e3d4c5b6a70007",
    key: "yum",
    name: "Ngon tuyệt",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f60b/512.webp",
    premiumOnly: true
  },
  {
    _id: "60b8d5a1f2e3d4c5b6a70008",
    key: "sparkling",
    name: "Lấp lánh",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/2728/512.webp",
    premiumOnly: true
  },
  {
    _id: "60b8d5a1f2e3d4c5b6a70009",
    key: "fire",
    name: "Nóng bỏng",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.webp",
    premiumOnly: true
  },
  {
    _id: "60b8d5a1f2e3d4c5b6a70010",
    key: "cute-cat",
    name: "Mèo con",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f431/512.webp",
    premiumOnly: true
  },
  {
    _id: "60b8d5a1f2e3d4c5b6a70011",
    key: "dino",
    name: "Khủng long",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f995/512.webp",
    premiumOnly: true
  },
  {
    _id: "60b8d5a1f2e3d4c5b6a70012",
    key: "bear",
    name: "Gấu trúc",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f43b/512.webp",
    premiumOnly: true
  },
  {
    _id: "60b8d5a1f2e3d4c5b6a70013",
    key: "rabbit",
    name: "Thỏ hồng",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f430/512.webp",
    premiumOnly: true
  },
  {
    _id: "60b8d5a1f2e3d4c5b6a70014",
    key: "hamburger",
    name: "Burger",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f354/512.webp",
    premiumOnly: true
  },
  {
    _id: "60b8d5a1f2e3d4c5b6a70015",
    key: "pizza",
    name: "Pizza",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f355/512.webp",
    premiumOnly: true
  },
  {
    _id: "60b8d5a1f2e3d4c5b6a70016",
    key: "cake",
    name: "Bánh kem",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f370/512.webp",
    premiumOnly: true
  },
  {
    _id: "60b8d5a1f2e3d4c5b6a70017",
    key: "strawberry",
    name: "Dâu tây",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f353/512.webp",
    premiumOnly: true
  },
  {
    _id: "60b8d5a1f2e3d4c5b6a70018",
    key: "coffee",
    name: "Cà phê",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/2615/512.webp",
    premiumOnly: true
  },
  {
    _id: "60b8d5a1f2e3d4c5b6a70019",
    key: "taco",
    name: "Taco",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f32e/512.webp",
    premiumOnly: true
  },
  {
    _id: "60b8d5a1f2e3d4c5b6a70020",
    key: "sushi",
    name: "Sushi",
    assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f363/512.webp",
    premiumOnly: true
  }
];

export async function seedDefaultStickers() {
  for (const sticker of defaultStickers) {
    const updateObj: Record<string, any> = {
      name: sticker.name,
      assetPath: sticker.assetPath,
      premiumOnly: sticker.premiumOnly
    };

    const filter: Record<string, any> = { key: sticker.key };

    if ("_id" in sticker) {
      await Sticker.findOneAndUpdate(
        filter,
        {
          $setOnInsert: { _id: sticker._id },
          $set: updateObj
        },
        { upsert: true, new: true }
      );
    } else {
      await Sticker.updateOne(filter, { $set: updateObj }, { upsert: true });
    }
  }
}
