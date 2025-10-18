const User = require("../models/user.model");
const { sendSubscriptionEmail } = require("../utils/mailer");

module.exports = (agenda) => {
  agenda.define("notify_expiring_subscriptions", async (job) => {
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + 2);

    const users = await User.find({
      "currentPlan.expiresAt": {
        $gte: new Date(targetDate.setHours(0, 0, 0, 0)), // start of target day
        $lte: new Date(targetDate.setHours(23, 59, 59, 999)), // end of target day
      },
    });

    for (const user of users) {
      await sendSubscriptionEmail(user.email, user.name, "expiring");
    }
  });
};

/**
 * Job: Notify users whose subscription expired yesterday
 */

module.exports = (agenda) => {
  agenda.define("notify_expired_subscriptions", async (job) => {
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() - 1);

    const users = await User.find({
      "currentPlan.expiresAt": {
        $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
        $lte: new Date(targetDate.setHours(23, 59, 59, 999)),
      },
    });

    for (const user of users) {
      await sendSubscriptionEmail(user.email, user.name, "expired");
    }
  });
};
