const WaitlistSubscriber = require("../models/WaitlistSubscriber");
const {
  sendWaitlistConfirmationEmail,
  hasMailConfig,
} = require("../services/mail.service");

function normalizeInput(value) {
  return String(value || "").trim();
}

async function subscribeToWaitlist(req, res, next) {
  try {
    const name = normalizeInput(req.body?.name);
    const email = normalizeInput(req.body?.email).toLowerCase();
    const source = normalizeInput(req.body?.source) || "website";

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
    }

    const subscriber = await WaitlistSubscriber.findOneAndUpdate(
      { email },
      {
        $set: {
          name,
          source,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    if (hasMailConfig()) {
      sendWaitlistConfirmationEmail({
        to: subscriber.email,
        displayName: subscriber.name,
      }).catch((mailError) => {
        console.error("Waitlist confirmation email failed:", mailError.message);
      });
    }

    return res.status(200).json({
      success: true,
      message: "You are on the waitlist. We will notify you before launch.",
      data: {
        id: subscriber._id,
        email: subscriber.email,
        name: subscriber.name,
      },
    });
  } catch (error) {
    if (error?.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return next(error);
  }
}

module.exports = {
  subscribeToWaitlist,
};
