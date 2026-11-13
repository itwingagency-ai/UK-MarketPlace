const Product = require("../models/Product");
const Store = require("../models/Store");
const StockAlert = require("../models/StockAlert");
const { notifyBackInStock } = require("./appNotifications");

/**
 * Tell customers who asked to be notified that a product (or one of its
 * sizes) can be bought again. Call after anything that may raise stock or
 * make a product visible: stock edits, product edits, restores, cancelled
 * orders. Fire-and-forget; never throws.
 */
const checkBackInStock = (productIds) =>
  Promise.resolve()
    .then(async () => {
      const ids = [...new Set((Array.isArray(productIds) ? productIds : [productIds]).filter(Boolean).map(String))];
      if (ids.length === 0) return;
      const pending = await StockAlert.find({ product: { $in: ids }, notifiedAt: null }).lean();
      if (pending.length === 0) return;

      const products = await Product.find({ _id: { $in: ids }, isActive: true });
      const storeIds = [...new Set(products.map((p) => String(p.store)))];
      const stores = new Map(
        (await Store.find({ _id: { $in: storeIds } }).select("name").lean()).map((s) => [String(s._id), s.name])
      );

      for (const product of products) {
        const forProduct = pending.filter((a) => String(a.product) === String(product._id));
        // Group by size so each customer gets one message per thing they asked for
        const byVariant = new Map();
        for (const alert of forProduct) {
          const key = alert.variantId ? String(alert.variantId) : "";
          if (!byVariant.has(key)) byVariant.set(key, []);
          byVariant.get(key).push(alert);
        }

        for (const [variantKey, alerts] of byVariant) {
          let available;
          let variantLabel = "";
          if (variantKey) {
            const variant = product.variants.id(variantKey);
            available = Boolean(variant && variant.isActive && variant.stock > 0);
            variantLabel = variant ? Object.values(Object.fromEntries(variant.attributes || [])).join(" / ") : "";
          } else {
            available = product.variants.length === 0
              ? product.stock > 0
              : product.variants.some((v) => v.isActive && v.stock > 0);
          }
          if (!available) continue;

          // Claim each alert first so a burst of stock edits can't notify twice
          const claimedUsers = [];
          for (const alert of alerts) {
            // eslint-disable-next-line no-await-in-loop
            const claim = await StockAlert.updateOne(
              { _id: alert._id, notifiedAt: null },
              { $set: { notifiedAt: new Date() } }
            );
            if (claim.modifiedCount === 1) claimedUsers.push(alert.user);
          }
          if (claimedUsers.length === 0) continue;
          notifyBackInStock(claimedUsers, {
            product,
            variantLabel,
            storeName: stores.get(String(product.store)),
          });
        }
      }
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[stock-alerts] check failed:", err?.message || err);
    });

module.exports = { checkBackInStock };
