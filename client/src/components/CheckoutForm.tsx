import React, { useState } from "react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";

export default function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Debug information
  console.log("CheckoutForm rendered, stripe:", !!stripe, "elements:", !!elements);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorText(null);
    if (!stripe || !elements) {
      setErrorText("Stripe not loaded - try reloading the page.");
      return;
    }
    setLoading(true);
    try {
      // Call backend to create Checkout Session
      const resp = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ tier: "5" })
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.message || "Session creation failed");

      // Redirect to Stripe Checkout
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

  if (!stripe || !elements) {
    return (
      <div className="w-full max-w-md mx-auto p-4 border border-gray-200 rounded-lg bg-gray-50">
        <p className="text-sm text-gray-600">Loading payment form...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-4 border border-gray-200 rounded-lg bg-white">
      <div className="mb-4">
        <p className="text-sm text-green-600">✅ Stripe Elements Loaded Successfully</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Card Information
          </label>
          <div className="p-3 border border-gray-300 rounded-md bg-white">
            <CardElement 
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                },
                hidePostalCode: true,
              }}
            />
          </div>
        </div>

        {errorText && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
            {errorText}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700"
          data-testid="button-stripe-pay"
        >
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
              Processing...
            </div>
          ) : (
            "Pay $5 with Stripe"
          )}
        </Button>
      </form>
    </div>
  );
}