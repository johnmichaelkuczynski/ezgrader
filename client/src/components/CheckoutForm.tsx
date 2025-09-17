import React, { useState } from "react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

export default function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorText(null);
    if (!stripe || !elements) {
      setErrorText("Stripe not loaded - try reloading the page.");
      return;
    }
    setLoading(true);
    try {
      // Call backend to create Checkout Session or PaymentIntent - adjust endpoint name
      const resp = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ tier: "5" }) // Use tier to match purchaseSchema
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.message || "Session creation failed");

      // If using Checkout Session:
      const sessionId = j.id;
      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) throw error;
    } catch (err: any) {
      console.error("Checkout error:", err);
      setErrorText(err.message || "Payment error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", marginBottom: 8 }}>Card</label>
        <div style={{ padding: 12, border: "1px solid #e6e6e6", borderRadius: 6 }}>
          <CardElement options={{ hidePostalCode: true }} />
        </div>

        {errorText && <div style={{ color: "crimson", marginTop: 12 }}>{errorText}</div>}

        <button
          type="submit"
          disabled={!stripe || loading}
          style={{
            marginTop: 16,
            padding: "10px 16px",
            borderRadius: 6,
            border: "none",
            cursor: "pointer"
          }}
        >
          {loading ? "Processing…" : "Pay"}
        </button>
      </form>
    </div>
  );
}