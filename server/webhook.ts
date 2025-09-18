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
    
    // Grant credits to user
    const { userId, credits } = session.metadata || {};
    
    if (userId && userId !== 'anonymous' && credits) {
      try {
        const { db } = await import('./db');
        const { users, purchases } = await import('../shared/schema');
        const { eq } = await import('drizzle-orm');
        
        const userIdNum = parseInt(userId);
        const creditsNum = parseInt(credits);
        
        // Record the purchase
        await db.insert(purchases).values({
          userId: userIdNum,
          paypalOrderId: session.id,
          amount: session.amount_total || 0,
          tokensAdded: creditsNum,
          status: 'completed',
        });
        
        // Add credits to user account
        const user = await db.select().from(users).where(eq(users.id, userIdNum)).limit(1);
        if (user.length > 0) {
          const newCredits = user[0]!.credits + creditsNum;
          await db.update(users)
            .set({ credits: newCredits })
            .where(eq(users.id, userIdNum));
          
          console.log(`Successfully added ${creditsNum} credits to user ${userIdNum}`);
        }
      } catch (error) {
        console.error('Error processing payment:', error);
      }
    }
  }

  res.status(200).send("OK");
});

export default router;