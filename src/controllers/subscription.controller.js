const User = require("../models/user.model");
const Plan = require("../models/plans.model");
const { roles } = require("../utils/config");
const plansModel = require("../models/plans.model");

// User subscribes to a plan
exports.subscribeToPlan = async (req, res) => {
  try {
    if (req.user.role !== roles.USER) {
      return res
        .status(403)
        .json({ message: "Only users can subscribe to plans" });
    }

    const planId = req.body.planId;

    if (!planId) {
      return res.status(400).json({ message: "Plan id required" });
    }

    // Check if plan exists
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    // Fetch the user
    const user = await User.findById(req.user.id);

    // Check active subscription
    if (
      user.subscription &&
      user.subscription.plan &&
      (!user.subscription.expiresAt || user.subscription.expiresAt > new Date())
    ) {
      return res.status(400).json({
        message:
          "You already have an active subscription. Please unsubscribe or wait for it to expire before subscribing again.",
      });
    }

    // Set subscription duration (e.g. 30 days from now)
    const now = new Date();
    const expiry = new Date();
    expiry.setDate(now.getDate() + plan.duration); // Example: 30-day subscription

    // Update subscription
    user.subscription = {
      plan: plan._id,
      subscribedAt: now,
      expiresAt: expiry,
    };

    await user.save();

    await user.populate("subscription.plan", "name price description");

    res.json({
      message: "Subscription successful",
      subscription: user.subscription,
    });
  } catch (err) {
    console.error("Error subscribing to plan:", err.message);
    res.status(500).json({ message: "Error subscribing to plan" });
  }
};
