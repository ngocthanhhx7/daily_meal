import { Sticker } from "../models/Sticker.js";

const defaultStickers = [
  {
    key: "green-egg",
    name: "Trứng bắc thảo",
    assetPath: "/assets/stickers/green-egg.png",
    premiumOnly: false
  },
  {
    key: "yellow-buddy",
    name: "Bé màu vàng",
    assetPath: "/assets/stickers/yellow-buddy.png",
    premiumOnly: true
  },
  {
    key: "chef-star",
    name: "Đầu bếp sao",
    assetPath: "/assets/stickers/chef-star.png",
    premiumOnly: true
  }
];

export async function seedDefaultStickers() {
  await Promise.all(
    defaultStickers.map((sticker) =>
      Sticker.updateOne({ key: sticker.key }, { $setOnInsert: sticker }, { upsert: true })
    )
  );
}
