const {
  createPaypalOrder,
  capturePaypalOrder,
} = require("../utils/paypalServices");

const Payment = require("../models/payment.model");
const User = require("../models/user.model");
const Plan = require("../models/plans.model");
const { sendSubscriptionSuccessEmail } = require("../utils/mailer");

exports.createOrder = async (req, res) => {
  const { planId } = req.body;

  if (!planId) {
    return res.status(400).json({ message: "Invalid plan ID provided" });
  }

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
    user.subscription.price !== 0 &&
    (!user.subscription.expiresAt || user.subscription.expiresAt > new Date())
  ) {
    return res.status(400).json({
      message:
        "You already have an active subscription. Please unsubscribe or wait for it to expire before subscribing again.",
    });
  }

  const amount = plan.price; // Assuming plan has a price field

  try {
    const orderData = await createPaypalOrder(amount, planId);
    const approveLink = orderData.links.find((link) => link.rel === "approve");

    if (!approveLink) {
      return res
        .status(500)
        .json({ message: "Approval link not found in PayPal response" });
    }

    res.status(200).json({
      id: orderData.id,
      link: approveLink.href,
    });
  } catch (error) {
    console.error("Error creating PayPal order:", error.message);
    res.status(500).json({
      message: "Failed to create PayPal order",
      error: error.message,
    });
  }
};

exports.captureOrder = async (req, res) => {
  const { orderId, planId } = req.body;
  const userId = req.user?.id || req.session?.user?.id;
  const user = await User.findById(req.user.id);

  if (!orderId) {
    return res.status(400).json({ message: "Order ID is required" });
  }
  if (!planId || !userId) {
    return res.status(400).json({ message: "planId and userId are required" });
  }

  try {
    const captureData = await capturePaypalOrder(orderId);

    // Save payment record

    if (!planId) {
      return res.status(400).json({ message: "Invalid plan ID provided" });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    // Fetch the user
    const user = await User.findById(userId);

    await Payment.create({
      user: userId,
      useremail: user.email,
      amount: plan.price,
      currency: captureData.purchase_units?.[0]?.amount?.currency_code || "USD",
      status: captureData.status?.toLowerCase() || "completed",
      method: "PayPal",
      transactionId: captureData.id,
      plan: planId,
      details: captureData,
    });

    const now = new Date();
    const expiry = new Date();
    expiry.setDate(now.getDate() + plan.duration); // Example: 30-day subscription

    // Update subscription
    user.subscription.push({
      plan: {
        id: plan._id.toString(),
        name: plan.name,
        price: plan.price,
        description: plan.description,
        duration: plan.duration,
        features: plan.features,
      },
      subscribedAt: new Date(),
      expiresAt: expiry,
    });

    console.log("Updating user plan to:", plan.name, user.subscription);

    user.currentPlan = {
      id: plan._id.toString(),
      name: plan.name,
      price: plan.price,
      description: plan.description,
      duration: plan.duration,
      features: plan.features,
    };

    await user.save();

    res.status(200).json({
      message: "Payment successful",
      data: { captureData, subscription: user.subscription },
    });
    await sendSubscriptionSuccessEmail(
      user.email,
      user.fullname || user.email,
      plan.name,
      plan.price,

      captureData.purchase_units?.[0]?.amount?.currency_code || "USD",
      captureData.status?.toLowerCase() || "completed",
      "PayPal",
      captureData.id
    );
  } catch (error) {
    console.error("Capture error:", error.message);
    res
      .status(500)
      .json({ message: "Failed to capture payment", error: error.message });
  }
};
