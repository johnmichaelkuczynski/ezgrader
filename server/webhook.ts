import express from "express";
import Stripe from "stripe";

const router = express.Router();

// Initialize Stripe only if Live secret key is present
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
  // Check if Stripe is configured
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET_EZGRADER) {
    console.warn("Stripe webhook called but not configured - missing Live environment variables");
    return res.status(503).send("Stripe not configured");
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET_EZGRADER
    );
  } catch (err) {
    console.log(`Webhook error: ${(err as Error).message}`);
    return res.status(400).send(`Webhook Error`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log("Payment received:", session);
    // Grant credits, save user info, etc.
  }

  res.status(200).send("OK");
});

export default router;