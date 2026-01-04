const Stripe = require('stripe');
const Payment = require("../models/payment.model");
const User = require("../models/user.model");
const Plan = require("../models/plans.model");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
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
    user.subscription.length > 0 &&
    user.subscription[user.subscription.length - 1]?.plan?.price > 0 &&
    (!user.subscription[user.subscription.length - 1]?.expiresAt || 
     user.subscription[user.subscription.length - 1]?.expiresAt > new Date())
  ) {
    return res.status(400).json({
      message: "You already have an active subscription. Please wait for it to expire before subscribing again.",
    });
  }

  try {
    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: plan.name,
              description: plan.description,
              metadata: {
                planId: plan._id.toString(),
              },
            },
            unit_amount: Math.round(plan.price * 100), // Convert dollars to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/emailFinder?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/emailFinder/pricing`,
      customer_email: user.email,
      metadata: {
        userId: req.user.id,
        planId: plan._id.toString(),
        userEmail: user.email,
      },
    });

    res.status(200).json({
      id: session.id,
      link: session.url,
    });

  } catch (error) {
    console.error("Error creating Stripe checkout session:", error);
    res.status(500).json({
      message: "Failed to create payment session",
      error: error.message,
    });
  }
};

exports.captureOrder = async (req, res) => {
  const { sessionId } = req.body;
  const userId = req.user?.id;

  if (!sessionId) {
    return res.status(400).json({ message: "Session ID is required" });
  }

  try {
    // Retrieve the Stripe session to verify payment
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ message: "Payment not completed" });
    }

    // Get planId from session metadata (more reliable)
    const planId = session.metadata?.planId;
    if (!planId) {
      return res.status(400).json({ message: "Plan ID not found in session" });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    const user = await User.findById(userId || session.metadata?.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Save payment record
    await Payment.create({
      user: user._id,
      useremail: user.email,
      amount: plan.price,
      currency: session.currency,
      status: session.payment_status,
      method: "Stripe",
      transactionId: session.id,
      plan: planId,
      details: session,
    });

    // Update subscription
    const now = new Date();
    const expiry = new Date();
    expiry.setDate(now.getDate() + plan.duration);

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

    user.currentPlan = {
      id: plan._id.toString(),
      name: plan.name,
      price: plan.price,
      description: plan.description,
      duration: plan.duration,
      features: plan.features,
    };

    await user.save();

    // Send email
    await sendSubscriptionSuccessEmail(
      user.email,
      user.fullname || user.email,
      plan.name,
      plan.price,
      session.currency,
      session.payment_status,
      "Stripe",
      session.id
    );

    res.status(200).json({
      message: "Payment successful",
      data: { 
        user: {
          ...user.toObject(),
          subscription: user.subscription
        },
        token: req.headers.authorization?.split(' ')[1] || null
      },
    });

  } catch (error) {
    console.error("Capture error:", error);
    res.status(500).json({ 
      message: "Failed to capture payment", 
      error: error.message 
    });
  }
};