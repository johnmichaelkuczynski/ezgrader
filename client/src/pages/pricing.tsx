import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import PayPalButton from "@/components/PayPalButton";

const pricingTiers = [
  { id: "5", price: 5, tokens: 5000, popular: false },
  { id: "10", price: 10, tokens: 20000, popular: true },
  { id: "100", price: 100, tokens: 500000, popular: false },
  { id: "1000", price: 1000, tokens: 10000000, popular: false },
];

export default function Pricing() {
  const [loading, setLoading] = useState<string | null>(null);
  const [paypalData, setPaypalData] = useState<{[key: string]: any}>({});
  const { toast } = useToast();

  const handlePurchase = async (tier: string) => {
    setLoading(tier);
    try {
      const response = await apiRequest("POST", "/api/create-paypal-order", { tier });
      
      // Store PayPal data for this tier
      setPaypalData(prev => ({
        ...prev,
        [tier]: {
          amount: response.amount,
          currency: response.currency,
          intent: response.intent
        }
      }));
      
      setLoading(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate payment",
        variant: "destructive",
      });
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
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
                  {tier.tokens.toLocaleString()} tokens
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
                
                {paypalData[tier.id] ? (
                  <div className="w-full">
                    <PayPalButton 
                      amount={paypalData[tier.id].amount}
                      currency={paypalData[tier.id].currency}
                      intent={paypalData[tier.id].intent}
                    />
                  </div>
                ) : (
                  <Button 
                    className="w-full" 
                    onClick={() => handlePurchase(tier.id)}
                    disabled={loading === tier.id}
                    variant={tier.popular ? "default" : "outline"}
                  >
                    {loading === tier.id ? (
                      <div className="flex items-center">
                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                        Preparing PayPal...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Pay with PayPal
                      </div>
                    )}
                  </Button>
                )}
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