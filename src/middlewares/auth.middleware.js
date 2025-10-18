const jwt = require("jsonwebtoken");
const { roles } = require("../utils/config");
require("dotenv").config();
exports.protect = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token)
    return res.status(401).json({ message: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      role: decoded.role,
      token,
    };
    next();
  } catch (err) {
    res.status(401).json({ message: "Token is not valid" });
  }
};

exports.adminOnly = (req, res, next) => {
  if (req.user.role !== roles.ADMIN) {
    return res.status(403).json({ message: "Access denied: admins only" });
  }
  next();
};
