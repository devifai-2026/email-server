const Stripe = require('stripe');
const Payment = require("../models/payment.model");
const User = require("../models/user.model");
const Plan = require("../models/plans.model");

// Initialize Stripe with your secret key
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const { sendSubscriptionSuccessEmail } = require("../utils/mailer");

exports.createOrder = async (req, res) => {
  try {
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid plan ID provided" 
      });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ 
        success: false,
        message: "Plan not found" 
      });
    }

    // Fetch the user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // Check active subscription
    if (user.subscription && user.subscription.length > 0) {
      const latestSubscription = user.subscription[user.subscription.length - 1];
      
      if (latestSubscription?.plan?.price > 0) {
        const isActive = !latestSubscription.expiresAt || 
                        latestSubscription.expiresAt > new Date();
        
        if (isActive) {
          return res.status(400).json({
            success: false,
            message: "You already have an active subscription. Please wait for it to expire before subscribing again.",
          });
        }
      }
    }

    // Convert price to cents for Stripe
    const amountInCents = Math.round(plan.price * 100);
    
    // Validate amount (Stripe minimum is $0.50 USD)
    if (amountInCents < 50) {
      return res.status(400).json({
        success: false,
        message: "Amount must be at least $0.50 USD"
      });
    }

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
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      customer_email: user.email,
      metadata: {
        userId: req.user.id.toString(),
        planId: plan._id.toString(),
        userEmail: user.email,
      },
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'IN'], // Add countries as needed
      },
      billing_address_collection: 'required',
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes expiry
    });

    res.status(200).json({
      success: true,
      id: session.id,
      link: session.url,
      sessionId: session.id,
    });

  } catch (error) {
    console.error("Error creating Stripe checkout session:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment session",
      error: error.message,
    });
  }
};

exports.captureOrder = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user?.id;

    if (!sessionId) {
      return res.status(400).json({ 
        success: false,
        message: "Session ID is required" 
      });
    }

    // Retrieve the Stripe session to verify payment
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'customer']
    });

    console.log('Stripe session retrieved:', {
      id: session.id,
      payment_status: session.payment_status,
      metadata: session.metadata
    });

    // Convert Stripe status to your model's allowed status
    const mapStripeStatusToModel = (stripeStatus) => {
      switch (stripeStatus.toLowerCase()) {
        case 'paid':
        case 'succeeded':
          return 'completed';
        case 'pending':
          return 'pending';
        case 'failed':
        case 'canceled':
        case 'expired':
          return 'failed';
        default:
          return 'pending';
      }
    };

    const paymentStatus = mapStripeStatusToModel(session.payment_status);

    if (paymentStatus !== 'completed') {
      return res.status(400).json({ 
        success: false,
        message: `Payment not completed. Status: ${session.payment_status}` 
      });
    }

    // Get planId from session metadata
    const planId = session.metadata?.planId;
    if (!planId) {
      return res.status(400).json({ 
        success: false,
        message: "Plan ID not found in session metadata" 
      });
    }

    // Find the plan
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ 
        success: false,
        message: "Plan not found" 
      });
    }

    // Find the user - use metadata userId if not in request
    const targetUserId = userId || session.metadata?.userId;
    if (!targetUserId) {
      return res.status(400).json({ 
        success: false,
        message: "User ID not found" 
      });
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // Check if payment already recorded
    const existingPayment = await Payment.findOne({ transactionId: session.id });
    if (existingPayment) {
      return res.status(200).json({
        success: true,
        message: "Payment already processed",
        data: {
          user: {
            ...user.toObject(),
            subscription: user.subscription
          }
        }
      });
    }

    // Create payment record - IMPORTANT: Use 'completed' not 'paid'
    const payment = await Payment.create({
      user: user._id,
      useremail: user.email,
      amount: plan.price,
      currency: session.currency.toUpperCase(),
      status: paymentStatus, // Use the converted status
      method: "Stripe",
      transactionId: session.id,
      plan: planId,
      customerId: session.customer,
      paymentIntentId: session.payment_intent?.id,
      details: session,
    });

    // Calculate subscription expiry
    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setDate(now.getDate() + (plan.duration || 30)); // Default 30 days if not specified

    // Create subscription object
    const subscriptionData = {
      plan: {
        id: plan._id.toString(),
        name: plan.name,
        price: plan.price,
        description: plan.description,
        duration: plan.duration,
        features: plan.features,
      },
      subscribedAt: now,
      expiresAt: expiryDate,
      paymentId: payment._id,
      transactionId: session.id,
      status: 'active'
    };

    // Update user subscription
    if (!user.subscription) {
      user.subscription = [];
    }
    
    user.subscription.push(subscriptionData);
    
    user.currentPlan = {
      id: plan._id.toString(),
      name: plan.name,
      price: plan.price,
      description: plan.description,
      duration: plan.duration,
      features: plan.features,
    };

    // Update user credits if plan has credits
    if (plan.credits) {
      user.credits = (user.credits || 0) + plan.credits;
    }

    await user.save();

    // Send confirmation email - also update email to use correct status
    try {
      await sendSubscriptionSuccessEmail(
        user.email,
        user.fullname || user.email,
        plan.name,
        plan.price,
        session.currency.toUpperCase(),
        paymentStatus, // Use the converted status
        "Stripe",
        session.id,
        expiryDate
      );
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      // Don't fail the request if email fails
    }

    // Prepare response
    const userResponse = user.toObject();
    delete userResponse.password; // Remove sensitive data

    res.status(200).json({
      success: true,
      message: "Payment successful",
      data: {
        user: userResponse,
        payment: {
          id: payment._id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status
        },
        subscription: subscriptionData,
        // Include token if needed for frontend
        token: req.headers.authorization?.split(' ')[1] || null
      },
    });

  } catch (error) {
    console.error("Capture error details:", {
      message: error.message,
      stack: error.stack,
      sessionId: req.body?.sessionId
    });

    res.status(500).json({ 
      success: false,
      message: "Failed to capture payment", 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Optional: Add webhook handler for better reliability
exports.stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle specific events
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('Webhook: Checkout session completed:', session.id);
      
      // Helper function to convert status
      const mapStripeStatus = (stripeStatus) => {
        switch (stripeStatus.toLowerCase()) {
          case 'paid':
          case 'succeeded':
            return 'completed';
          case 'pending':
            return 'pending';
          case 'failed':
          case 'canceled':
          case 'expired':
            return 'failed';
          default:
            return 'pending';
        }
      };
      
      // Process the payment here if using webhooks
      if (session.payment_status === 'paid') {
        console.log('Processing paid webhook for session:', session.id);
        // You would call your captureOrder logic here but adapt it for webhook use
      }
      break;
      
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('Webhook: Payment succeeded:', paymentIntent.id);
      break;
      
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
};