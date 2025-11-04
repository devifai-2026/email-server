const User = require("../models/user.model");
const Plan = require("../models/plans.model");
const { roles } = require("../utils/config");

// Admin  : Get all users
exports.getUsers = async (req, res) => {
  try {
    //  Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    //  Filters
    const filter = {};
    if (req.query.role) {
      filter.role = req.query.role;
    }
    if (req.query.email) {
      filter.email = { $regex: req.query.email, $options: "i" };
    }

    //  Sorting (latest users first)
    const sort = { createdAt: -1 };

    //  Fetch users with populated plan details if available
    const users = await User.find(filter)
      .select("-password -__v")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({
        path: "subscription.plan",
        model: Plan,
        select: "name", // ✅ Select only required fields
      });

    //  Total count for pagination
    const total = await User.countDocuments(filter);

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      users,
    });
  } catch (err) {
    console.error("Error fetching users:", err.message);
    res.status(500).json({ message: "Server error while fetching users" });
  }
};

// Admin + user : Get user by ID
exports.getUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.status(200).json(user);
};
// Admin: Create user
exports.createUser = async (req, res) => {
  try {
    const { email, role } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }

    user = await User.create({
      email,
      role,
    });

    res.status(201).json({
      message: "User created successfully",
      user,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin + User : Update user
exports.updateUser = async (req, res) => {
  if (req.user.role === roles.USER && req.body.isActive) {
    return res
      .status(401)
      .json({ message: "User cannot deactivate or activate user or admin" });
  }
  if (req.body.role) {
    return res
      .status(401)
      .json({ message: "Cannot change role of user or admin" });
  }
  // if (req.body.email) {
  //   return res
  //     .status(401)
  //     .json({ message: "Cannot change email of user or admin" });
  // }
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });

  if (!user) return res.status(404).json({ message: "User not found" });
  if (req.body.role) {
    return res
      .status(400)
      .json({ message: "Cannot change role of user or admin" });
  }
  res.status(200).json({
    message: "User updated successfully",
    user: {
      id: user._id,
      fullname: user.fullname,
      email: user.email,
      jobrole: user.jobrole,
      createdAt: user.createdAt,
      isActive: user.isActive,
      company: user.company,
      phone: user.phone,
    },
  });
};

// Admin + User : Delete user
exports.deleteUser = async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ message: "User deleted" });
};
