const ApiToken = require("../models/apitoken.model");

const Payment = require("../models/payment.model");

const Card = require("../models/dashboardcard.model");

const User = require("../models/user.model");

const EmailAccount = require("../models/emailaccount.model");

const Plan = require("../models/plans.model");

// Create token
exports.createOrUpdateToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token is  required." });
    }

    const existing = await ApiToken.findOne();

    let result;
    if (existing) {
      result = await ApiToken.findByIdAndUpdate(
        existing._id,
        { token },
        { new: true }
      );
    } else {
      result = await ApiToken.create({ token });
    }

    res.status(200).json({ result, message: "API token updated successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error saving token", error: error.message });
  }
};

// Get the single token
exports.getToken = async (req, res) => {
  try {
    const token = await ApiToken.findOne();
    if (!token) {
      return res.status(404).json({ message: "Token not found" });
    }
    res.status(200).json(token);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching token", error: error.message });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const transactions = await Payment.find().sort({ createdAt: -1 });
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching transactions", error });
  }
};

// Create a new card
exports.createCard = async (req, res) => {
  try {
    const card = new Card(req.body);
    await card.save();
    res.status(201).json(card);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get all cards
exports.getAllCards = async (req, res) => {
  try {
    const cards = await Card.find();
    res.json(cards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get a single card by ID
exports.getCardById = async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ error: "Card not found" });
    res.json(card);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update a card
exports.updateCard = async (req, res) => {
  try {
    const card = await Card.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!card) return res.status(404).json({ error: "Card not found" });
    res.json(card);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete a card
exports.deleteCard = async (req, res) => {
  try {
    const card = await Card.findByIdAndDelete(req.params.id);
    if (!card) return res.status(404).json({ error: "Card not found" });
    res.json({ message: "Card deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
exports.getDashboardStats = async (req, res) => {
  try {
    // Counts
    const totalUsersPromise = User.countDocuments();
    const activeUsersPromise = User.countDocuments({ isActive: true });

    const totalEmailAccountsPromise = EmailAccount.countDocuments();
    const totalPlansPromise = Plan.countDocuments();

    // Total transaction amount
    const totalTransactionAmountPromise = Payment.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const [
      totalUsers,
      activeUsers,

      totalEmailAccounts,
      totalPlans,
      totalTransactionAmountResult,
    ] = await Promise.all([
      totalUsersPromise,
      activeUsersPromise,

      totalEmailAccountsPromise,
      totalPlansPromise,
      totalTransactionAmountPromise,
    ]);

    const totalTransactionAmount =
      totalTransactionAmountResult.length > 0
        ? totalTransactionAmountResult[0].totalAmount
        : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        totalEmailAccounts,
        totalPlans,
        totalTransactionAmount,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching dashboard stats",
    });
  }
};
