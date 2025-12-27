const ApiToken = require("../models/apitoken.model");

const Payment = require("../models/payment.model");

const Card = require("../models/dashboardcard.model");

const User = require("../models/user.model");

const dynamoService = require("../services/dynamodb-service.js");

const Plan = require("../models/plans.model");

const { connectPostgres } = require("../config/db.js");


const axios = require("axios");
const OPENSEARCH_INDEX = "email_accounts";
const OPENSEARCH_URL =
  "https://vpc-email-search-uzaqvpiyheutyfluip6kc244fu.ap-south-1.es.amazonaws.com";

const AUTH = {
  username: "postgres",
  password: "emailFinder@2025"
};
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
    // Use OpenSearch to get email accounts count
    const body = {
      size: 0,
      query: {
        match_all: {}
      }
    };

    const { data } = await axios.post(
      `${OPENSEARCH_URL}/${OPENSEARCH_INDEX}/_count`,
      body,
      { auth: AUTH }
    );

    const totalEmailAccounts = data.count || 0;

    const [
      totalUsers,
      activeUsers,
      totalPlans,
      totalTransactionAmountResult
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Plan.countDocuments(),
      Payment.aggregate([{ $group: { _id: null, totalAmount: { $sum: "$amount" } } }])
    ]);

    const totalTransactionAmount =
      totalTransactionAmountResult.length > 0
        ? totalTransactionAmountResult[0].totalAmount
        : 0;

    res.status(200).json({
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
  } catch (err) {
    console.error("Error fetching dashboard stats:", err.response?.data || err.message);
    res.status(500).json({ success: false, message: "Server error while fetching dashboard stats" });
  }
};