const bcrypt = require("bcryptjs");
const AuthAccount = require("../models/auth.model");
const User = require("../models/user.model");
const BulkUpload = require("../models/bulkupload.model");
const Plan = require("../models/plans.model");
const generateToken = require("../utils/generateToken");
const { roles } = require("../utils/config");
const Otp = require("../models/otp.model");
const { sendOTP } = require("../utils/mailer");
const mongoose = require('mongoose')

// Sign up (user only)
exports.signup = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (role === roles.ADMIN) {
      return res.status(403).json({
        message: "Admin accounts cannot be created via this signup route.",
      });
    }

    //  Check if AuthAccount exists
    let user = await AuthAccount.findOne({ email });
    if (user) {
      return res.status(400).json({
        message: "An account with this email already exists. Please sign in.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    //  Create AuthAccount
    user = await AuthAccount.create({
      email,
      password: hashedPassword,
      role: roles.USER,
    });
    // we need to create the token after the a
    const token = generateToken({ id: user._id, role: roles.USER });
    user = await AuthAccount.findByIdAndUpdate(user._id, {
      tokens: [{ token }],
    });

    //  Create linked User profile (only if AuthAccount is new)
    let userProfile = await User.create({
      _id: user._id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      message: "User account created successfully",
      token,
      user: userProfile,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Signup Step 2 - Verify OTP and Create Account
exports.verifySignup = async (req, res) => {
  try {
    const { email, otp } = req.body;

    //  Use shared OTP function
    const otpRecord = await verifyOtp(email, otp);
    const plan = await Plan.findOne({ price: 0 });
    console.log("Free plan:", plan);
    if (!plan) {
      throw new Error("No free plan found");
    }

    // Set subscription duration (e.g. 30 days from now)

    const now = new Date();
    const expiry = new Date();
    expiry.setDate(now.getDate() + plan.duration);
    // Create AuthAccount
    const user = await AuthAccount.create({
      email,
      password: otpRecord.hashedPassword,
      role: roles.USER,
    });
    const planSnapshot = {
      id: plan._id.toString(),
      name: plan.name,
      price: plan.price,
      description: plan.description,
      duration: plan.duration,
      features: plan.features,
    };

    // Create linked user profile
    const userProfile = await User.create({
      _id: user._id,
      email: user.email,
      role: user.role,
      fullname: otpRecord.fullname,
      company: otpRecord.company,
      jobrole: otpRecord.role,
      currentPlan: planSnapshot,
      subscription: [
        {
          plan: planSnapshot,
          subscribedAt: now,
          expiresAt: expiry,
        },
      ],
    });

    // Generate token
    const token = generateToken({ id: user._id, role: roles.USER });

    // Store token in DB
    user.tokens = [{ token }];
    await user.save();

    // Remove OTP record
    await Otp.deleteOne({ email });

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: userProfile,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Signup Step 1 - Request OTP
exports.signupRequest = async (req, res) => {
  try {
    const { email, role, company, fullname, password } = req.body;

    // Check if email already exists
    const existingUser = await AuthAccount.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Account already exists" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash password temporarily
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save OTP + temp signup data in DB
    await Otp.findOneAndUpdate(
      { email },
      {
        otp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        hashedPassword,
        fullname,
        company,
        role,
      },
      { upsert: true }
    );

    // Send OTP email
    await sendOTP(email, otp);

    res.json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Create admin account
exports.createAdminAccount = async (req, res) => {
  try {
    const { email, password } = req.body;

    let user = await AuthAccount.findOne({ email });
    if (user) {
      return res
        .status(400)
        .json({ message: "Admin with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user = await AuthAccount.create({
      email,
      password: hashedPassword,
      role: roles.ADMIN,
    });

    const token = generateToken({ id: user._id, role: roles.USER });
    user = await AuthAccount.findByIdAndUpdate(user._id, {
      tokens: [{ token }],
    });

    //  Create linked User profile (only if AuthAccount is new)
    await User.create({
      _id: user._id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      message: "Admin account created successfully",
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Sign in

exports.signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await AuthAccount.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate new token - Get user data FIRST
    const userData = await User.findById(user.userId).lean();

    // FIX: Check if userData exists BEFORE using it
    if (!userData) {
      return res.status(404).json({ 
        message: "User profile not found. Please contact support." 
      });
    }

    // FIX: Check isActive property safely
    if (userData.isActive === false) {
      return res.status(403).json({ 
        message: "Account is deactivated. Please contact support." 
      });
    }

    // Check if user is already signed in
    const shouldLogoutAllDevices = user.isSignedIn;

    // If user is already signed in, invalidate all existing tokens
    if (shouldLogoutAllDevices) {
      user.tokens = [];
      user.lastSignedOut = new Date();
      await user.save();
    }

    // Check subscription status for regular users
    let isSubscriptionExpired = false;
    let subscriptionStatus = "active";
    let currentSubscription = null;
    
    if (userData.role === roles.USER && userData.subscription && userData.subscription.length > 0) {
      // Get the most recent subscription
      const sortedSubscriptions = [...userData.subscription].sort(
        (a, b) => new Date(b.subscribedAt) - new Date(a.subscribedAt)
      );
      
      currentSubscription = sortedSubscriptions[0];
      const today = new Date();
      const expiresAt = new Date(currentSubscription.expiresAt);
      
      if (expiresAt < today) {
        isSubscriptionExpired = true;
        subscriptionStatus = "expired";
      }
      
      currentSubscription.isActive = expiresAt >= today;
    }

    if (userData.role === roles.ADMIN) {
      const bulkUpload = await BulkUpload.findOne({ status: "processing" }).lean();
      userData.uploadData = bulkUpload;
    }
    
    // Generate token
    const token = generateToken({ 
      id: user.userId, 
      role: userData.role,
      sessionId: new mongoose.Types.ObjectId().toString()
    });

    // Get device information
    const deviceInfo = {
      userAgent: req.headers['user-agent'] || 'Unknown',
      ipAddress: req.ip || req.connection.remoteAddress,
      lastActive: new Date()
    };

    // Save token to DB with device info
    user.tokens.push({ 
      token, 
      deviceInfo,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    
    // Update signed in status
    user.isSignedIn = true;
    user.lastSignedIn = new Date();
    
    await user.save();

    // Create session
    req.session.user = {
      id: user.userId,
      email: user.email,
      role: userData.role,
      sessionId: token.sessionId
    };

    // Add subscription status to the response
    const userResponse = {
      ...userData,
      subscriptionStatus,
      isSubscriptionExpired,
      currentSubscription,
      isSignedIn: true,
      lastSignedIn: user.lastSignedIn,
      deviceInfo: {
        currentDevice: deviceInfo,
        totalActiveSessions: user.tokens.length
      }
    };

    res.json({
      message: shouldLogoutAllDevices 
        ? "Signed in successfully. All other devices have been logged out." 
        : "Signed in successfully",
      token,
      user: userResponse,
      logoutAllDevices: shouldLogoutAllDevices
    });
  } catch (err) {
    console.error("Signin error:", err.message);
    res.status(500).json({ message: "Error signing in" });
  }
};

exports.logout = async (req, res) => {
  try {
    // Get token from header or session
    const token =
      req.headers.authorization?.replace("Bearer ", "") || req.session?.token;

    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Verify the token to get userId from it
    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id; // Extract userId from decoded token
    } catch (error) {
      // If token is invalid/expired, we can still consider it logged out
      if (req.session) {
        req.session.destroy(() => {});
      }
      return res.json({ message: "Logged out successfully" });
    }

    // FIX: Find AuthAccount by userId (which is a reference to User)
    const authAccount = await AuthAccount.findOne({ userId: userId });

    if (authAccount) {
      // Filter out the current token
      authAccount.tokens = authAccount.tokens.filter((t) => t.token !== token);
      // If no tokens left, update signed in status
      if (authAccount.tokens.length === 0) {
        authAccount.isSignedIn = false;
        authAccount.lastSignedOut = new Date();
      }
      await authAccount.save();
    }

    // Destroy session if it exists
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destruction error:", err.message);
        }
      });
    }

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err.message);
    res.status(500).json({ message: "Error logging out" });
  }
};

// Step 1: Request Password Reset
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await AuthAccount.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ message: "No account found with this email" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP in DB
    await Otp.findOneAndUpdate(
      { email },
      {
        otp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
      { upsert: true }
    );

    // Send OTP via email
    await sendOTP(email, otp, "reset");

    res.json({ message: "OTP sent to your email for password reset" });
  } catch (err) {
    console.error("ForgotPassword error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Step 2: Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Use shared OTP function
    await verifyOtp(email, otp);

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update AuthAccount password
    await AuthAccount.findOneAndUpdate(
      { email },
      { password: hashedPassword, tokens: [] } // clear old tokens (logout all devices)
    );

    // Remove OTP record
    await Otp.deleteOne({ email });

    res.json({ message: "Password reset successfully. Please sign in again." });
  } catch (err) {
    console.error("ResetPassword error:", err);
    res.status(400).json({ message: err.message });
  }
};

const verifyOtp = async (email, otp) => {
  const otpRecord = await Otp.findOne({ email });
  if (!otpRecord) {
    throw new Error("OTP not found or expired");
  }

  if (otpRecord.expiresAt < new Date()) {
    throw new Error("OTP expired");
  }

  if (otpRecord.otp !== otp) {
    throw new Error("Invalid OTP");
  }

  return otpRecord;
};
exports.logoutAllDevices = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming you have authentication middleware
    
    const user = await AuthAccount.findOne({ userId });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Clear all tokens
    user.tokens = [];
    user.isSignedIn = false;
    user.lastSignedOut = new Date();
    
    await user.save();
    
    res.json({ 
      message: "Logged out from all devices successfully",
      logoutCount: user.tokens.length
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
