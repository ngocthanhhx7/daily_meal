import { Schema, model, type InferSchemaType } from "mongoose";

const adminAuditLogSchema = new Schema(
  {
    adminEmail: { type: String, required: true, trim: true, index: true },
    action: { type: String, required: true, trim: true, maxlength: 80, index: true },
    targetType: { type: String, required: true, trim: true, maxlength: 40, index: true },
    targetId: { type: String, required: true, trim: true, maxlength: 160, index: true },
    note: { type: String, default: "", maxlength: 1000 },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, versionKey: false }
);

adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export type AdminAuditLogDocument = InferSchemaType<typeof adminAuditLogSchema>;
export const AdminAuditLog = model("AdminAuditLog", adminAuditLogSchema);
