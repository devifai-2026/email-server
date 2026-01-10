const Plan = require("../models/plans.model");

// USER + ADMIN: View all plans
exports.getPlans = async (req, res) => {
  try {
    const plans = await Plan.find().sort({ createdAt: -1 });
    res.json(plans);
  } catch (err) {
    console.error("Error fetching plans:", err.message);
    res.status(500).json({ message: "Error fetching plans" });
  }
};

// ADMIN: Create plan
exports.createPlan = async (req, res) => {
  try {
    const { name, description, price, duration, features, originalPrice } =
      req.body;
    const plan = await Plan.create({
      name,
      description,
      price,
      duration,
      features,
      originalPrice,
    });
    res.status(201).json(plan);
  } catch (err) {
    console.error("Error creating plan:", err.message);
    res.status(500).json({ message: "Error creating plan" });
  }
};

// ADMIN: Update plan
exports.updatePlan = async (req, res) => {
  try {
    const { name, description, price, duration, features, originalPrice } =
      req.body;
    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.json(plan);
  } catch (err) {
    console.error("Error updating plan:", err.message);
    res.status(500).json({ message: "Error updating plan" });
  }
};
exports.getPlanById = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }
    
    res.json(plan);
  } catch (err) {
    console.error("Error fetching plan:", err.message);
    
    // Handle invalid ObjectId format
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ message: "Invalid plan ID format" });
    }
    
    res.status(500).json({ message: "Error fetching plan" });
  }
};
// ADMIN: Delete plan
exports.deletePlan = async (req, res) => {
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.json({ message: "Plan deleted" });
  } catch (err) {
    console.error("Error deleting plan:", err.message);
    res.status(500).json({ message: "Error deleting plan" });
  }
};
