const mongoose = require("mongoose");

const waitlistSubscriberSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    source: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "website",
    },
  },
  {
    collection: "waitlists",
    timestamps: true,
  }
);

module.exports = mongoose.model("WaitlistSubscriber", waitlistSubscriberSchema);
