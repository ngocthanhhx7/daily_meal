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
  }
];

export async function seedDefaultStickers() {
  await Promise.all(
    defaultStickers.map((sticker) =>
      Sticker.updateOne({ key: sticker.key }, { $set: sticker }, { upsert: true })
    )
  );
}
