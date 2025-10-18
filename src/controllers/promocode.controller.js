const PromoCode = require("../models/promocode.model");

const Plan = require("../models/plans.model");

// ✅ Create Promo Code
exports.createPromoCode = async (req, res) => {
  try {
    const planId = await Plan.findById(req.body.planId);
    if (!planId) {
      return res.status(404).json({ message: "Plan not found" });
    }

    const promo = await PromoCode.create(req.body);
    res.status(201).json({ message: "Promo code created successfully", promo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating promo code" });
  }
};

// 📜 Get All Promo Codes with filters & pagination
exports.getAllPromoCodes = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const query = {};

    if (search) {
      query.code = new RegExp(search, "i");
    }

    const promoCodes = await PromoCode.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await PromoCode.countDocuments(query);

    res.json({ data: promoCodes, total });
  } catch (err) {
    res.status(500).json({ message: "Error fetching promo codes" });
  }
};

// 📝 Get single
exports.getPromoCode = async (req, res) => {
  try {
    const promo = await PromoCode.findById(req.params.id);
    if (!promo) return res.status(404).json({ message: "Promo not found" });
    res.json(promo);
  } catch (err) {
    res.status(500).json({ message: "Error fetching promo code" });
  }
};

// ✏️ Update
exports.updatePromoCode = async (req, res) => {
  try {
    const promo = await PromoCode.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!promo) return res.status(404).json({ message: "Promo not found" });
    res.json({ message: "Promo updated", promo });
  } catch (err) {
    res.status(500).json({ message: "Error updating promo code" });
  }
};

// ❌ Delete
exports.deletePromoCode = async (req, res) => {
  try {
    console.log(req.params.id);
    const result = await PromoCode.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: "Promo not found" });
    res.json({ message: "Promo deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting promo code" });
  }
};

// 🧾 Validate Promo Code (when user applies it at checkout)
exports.validatePromoCode = async (req, res) => {
  try {
    const { code, orderAmount } = req.body;

    if (!code || !orderAmount) {
      return res
        .status(400)
        .json({ message: "Promo code and order amount required" });
    }

    const promo = await PromoCode.findOne({
      code: code.toUpperCase(),
      isActive: true,
    });

    if (!promo) return res.status(404).json({ message: "Invalid promo code" });

    if (promo.expiryDate < Date.now()) {
      return res.status(400).json({ message: "Promo code expired" });
    }

    if (promo.usageLimit > 0 && promo.usedCount >= promo.usageLimit) {
      return res
        .status(400)
        .json({ message: "Promo code usage limit reached" });
    }

    if (orderAmount < promo.minOrderAmount) {
      return res.status(400).json({
        message: `Minimum order amount is ₹${promo.minOrderAmount}`,
      });
    }

    let discount = 0;
    if (promo.discountType === "percentage") {
      discount = (orderAmount * promo.discountValue) / 100;
      if (promo.maxDiscountAmount && discount > promo.maxDiscountAmount) {
        discount = promo.maxDiscountAmount;
      }
    } else if (promo.discountType === "fixed") {
      discount = promo.discountValue;
    }

    res.json({
      message: "Promo applied successfully",
      discount,
      finalAmount: orderAmount - discount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error validating promo code" });
  }
};
