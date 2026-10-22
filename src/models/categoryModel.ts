import mongoose from 'mongoose';
import ICategory from '../interfaces/ICategory';

const categorySchema = new mongoose.Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    image: { type: String },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
  },
  { timestamps: true },
);

categorySchema.index({ name: 1 });

// Static helper: return nested category tree
categorySchema.statics.getTree = async function () {
  const Category: any = this;
  const docs = await Category.find().lean().exec();
  const map: Record<string, any> = {};
  docs.forEach((d: any) => {
    map[d._id.toString()] = { ...d, children: [] };
  });

  const roots: any[] = [];
  docs.forEach((d: any) => {
    const parentId = d.parentId ? d.parentId.toString() : null;
    if (parentId && map[parentId]) {
      map[parentId].children.push(map[d._id.toString()]);
    } else {
      roots.push(map[d._id.toString()]);
    }
  });
  return roots;
};

const CategoryModel = mongoose.model<any>('Category', categorySchema);
export default CategoryModel;

// Static helper: merge DB categories with external categories
(CategoryModel as any).mergeExternal = async function (
  externalItems: any[],
  filter: any = {},
) {
  const dbItems = await this.find(filter).lean().exec();
  const keyFn = (c: any) =>
    c._id
      ? String(c._id)
      : c.name
      ? String(c.name).trim().toLowerCase()
      : undefined;

  // inline mergeDatasets implementation (primary=dbItems wins)
  const map = new Map<string, any>();
  for (const p of dbItems) {
    const k = keyFn(p);
    if (k) map.set(k, { ...p });
    else map.set(Symbol().toString(), { ...p });
  }
  for (const s of externalItems) {
    const k = keyFn(s);
    if (!k) {
      map.set(Symbol().toString(), { ...s });
      continue;
    }
    const existing = map.get(k);
    if (!existing) map.set(k, { ...s });
    else map.set(k, { ...s, ...existing });
  }

  return Array.from(map.values());
};
