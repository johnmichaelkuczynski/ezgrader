import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, CreditCard, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import PayPalButton from "@/components/PayPalButton";

// Load Stripe properly using loadStripe
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Match the backend TOKEN_PRICING system exactly
const pricingTiers = [
  { id: "5", price: 5, credits: 5000, popular: false },
  { id: "10", price: 10, credits: 20000, popular: true },
  { id: "100", price: 100, credits: 500000, popular: false },
  { id: "1000", price: 1000, credits: 10000000, popular: false },
];

export default function Pricing() {
  const [loading, setLoading] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const createPayPalOrder = async (tier: string) => {
    // Set up PayPal session for purchase
    const tierData = pricingTiers.find(t => t.id === tier);
    if (!tierData) return;

    try {
      const response = await fetch('/api/create-paypal-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tier })
      });
      
      if (response.ok) {
        console.log('PayPal session prepared for tier:', tier);
      } else {
        const error = await response.json();
        toast({
          title: "PayPal Setup Error",
          description: error.message || "Failed to prepare PayPal payment",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('PayPal session setup error:', error);
    }
  };

  const buyCredits = async (tier: string) => {
    setLoading(tier);
    
    // 1) Get logged-in user id (works even if cookies are blocked in iframes)
    let userId = null;
    try {
      const who = await fetch('/api/whoami', { credentials: 'include' });
      if (who.ok) {
        const j = await who.json();
        userId = j.userId || null;
      }
    } catch (e) {
      console.error('Failed to check authentication:', e);
    }

    if (!userId) {
      // Force real-page auth flow
      setLocation('/login');
      setLoading(null);
      return;
    }

    // Prepare PayPal session before attempting Stripe
    await createPayPalOrder(tier);

    // 2) Create checkout session and navigate
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Use session authentication only
        body: JSON.stringify({ tier: tier }) // Use 'tier' to match purchaseSchema
      });
      const data = await r.json();

      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      if (data.id) {
        const stripe = await stripePromise;
        if (stripe) {
          const { error } = await stripe.redirectToCheckout({ sessionId: data.id });
          if (error) {
            toast({
              title: "Checkout Error",
              description: error.message || "Failed to redirect to checkout",
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Payment Service Unavailable",
            description: "Stripe failed to load. Please try PayPal below or refresh and try again.",
            variant: "destructive",
          });
        }
        setLoading(null);
        return;
      }

      // Handle specific error responses from backend
      if (data.usePayPal) {
        toast({
          title: "Card Payments Temporarily Unavailable",
          description: data.message || "Please use PayPal payment option below.",
          variant: "destructive",
        });
        setLoading(null);
        return;
      }

      toast({
        title: "Payment Error", 
        description: data.message || "Checkout failed. Please try PayPal below or contact support.",
        variant: "destructive",
      });
      setLoading(null);
    } catch (e: any) {
      toast({
        title: "Connection Error",
        description: e && e.message ? e.message : 'Checkout error',
        variant: "destructive",
      });
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Navigation Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            data-testid="button-back-to-app"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to App
          </Button>
        </div>
        
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Choose Your Credits</h1>
          <p className="text-lg text-gray-600">
            Purchase credits to unlock full access to AI-powered grading and essay generation
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pricingTiers.map((tier) => (
            <Card key={tier.id} className={`relative ${tier.popular ? 'border-blue-500 shadow-lg' : ''}`}>
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}
              
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold">${tier.price}</CardTitle>
                <CardDescription>
                  {tier.credits.toLocaleString()} credits
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    <span className="text-sm">AI Grading</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    <span className="text-sm">Perfect Essay Writer</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    <span className="text-sm">AI Chat Assistant</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    <span className="text-sm">Long-term Storage</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Button 
                    className="w-full" 
                    onClick={() => buyCredits(tier.id)}
                    disabled={loading === tier.id}
                    variant={tier.popular ? "default" : "outline"}
                    data-testid={`button-purchase-${tier.id}`}
                  >
                    {loading === tier.id ? (
                      <div className="flex items-center">
                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                        Preparing...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Pay with Card
                      </div>
                    )}
                  </Button>
                  
                  <div className="text-center text-sm text-gray-500 mb-2">or</div>
                  
                  <div className="w-full">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-center">
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">PayPal Payment</div>
                      <div className="text-xs text-orange-600 dark:text-orange-400">
                        ⚠️ Temporarily unavailable while updating credentials
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-center text-xs text-gray-500">
                    🔒 Secure payments via Stripe & PayPal
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="mt-12 bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Storage Fees</h3>
          <p className="text-gray-600 mb-2">
            • Storage is charged at 500 tokens/month for 50,000 words
          </p>
          <p className="text-gray-600 mb-2">
            • Storage fees only apply to documents saved between sessions
          </p>
          <p className="text-gray-600">
            • No storage fees for documents used within a single session
          </p>
        </div>
      </div>
    </div>
  );
}