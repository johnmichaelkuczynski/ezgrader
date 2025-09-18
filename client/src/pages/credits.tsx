import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowLeft, CreditCard, Star } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';

const stripe = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

// Credit packages available for purchase
const CREDIT_PACKAGES = [
  {
    id: 'small',
    priceTier: '10',
    name: 'Starter Pack',
    credits: 1000,
    price: 9.99,
    description: 'Perfect for trying out the platform',
    popular: false
  },
  {
    id: 'medium',
    priceTier: '50',
    name: 'Pro Pack',
    credits: 5000,
    price: 39.99,
    description: 'Great for regular use',
    popular: true
  },
  {
    id: 'large',
    priceTier: '100',
    name: 'Enterprise Pack',
    credits: 15000,
    price: 99.99,
    description: 'Best value for heavy usage',
    popular: false
  }
];


// Placeholder for CheckoutForm - will be replaced with minimal card input form
const CheckoutForm = ({ selectedPackage }: { selectedPackage: typeof CREDIT_PACKAGES[0] }) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCheckout = async () => {
    setIsProcessing(true);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceTier: selectedPackage.priceTier })
      });

      const { id, error } = await response.json();
      
      if (!id) {
        throw new Error(error || 'Checkout init failed');
      }

      const stripeInstance = await stripe;
      if (!stripeInstance) {
        throw new Error('Stripe not loaded');
      }

      await stripeInstance.redirectToCheckout({ sessionId: id });
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: "Checkout Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <CreditCard className="h-5 w-5 mr-2" />
          Purchase {selectedPackage.name}
        </CardTitle>
        <div className="text-sm text-gray-600">
          {selectedPackage.credits} credits for ${selectedPackage.price}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-center">
              <CreditCard className="h-8 w-8 mx-auto text-blue-600 mb-2" />
              <p className="text-sm text-blue-800 font-medium">
                Secure Payment with Stripe
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Your payment information is encrypted and secure
              </p>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Credits:</span>
              <span className="font-medium">{selectedPackage.credits.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm mb-4">
              <span>Total:</span>
              <span className="font-medium">${selectedPackage.price}</span>
            </div>
          </div>
          
          <Button 
            onClick={handleCheckout}
            className="w-full"
            disabled={isProcessing}
            data-testid="button-checkout"
          >
            {isProcessing ? 'Redirecting to Stripe...' : `Pay $${selectedPackage.price}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function Credits() {
  const [selectedPackage, setSelectedPackage] = useState<typeof CREDIT_PACKAGES[0] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get current user info
  const { data: user } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
  });


  // Check for success parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  const isSuccess = urlParams.get('success') === 'true';

  useEffect(() => {
    if (isSuccess) {
      // Clear the success parameter and show success message
      window.history.replaceState({}, '', '/credits');
    }
  }, [isSuccess]);

  const handlePackageSelect = async (pkg: typeof CREDIT_PACKAGES[0]) => {
    setSelectedPackage(pkg);
  };

  // Show checkout form if package is selected
  if (selectedPackage) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <Button 
              variant="ghost" 
              onClick={() => {
                setSelectedPackage(null);
              }}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Packages
            </Button>
          </div>
          
          <CheckoutForm selectedPackage={selectedPackage} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Purchase Credits</h1>
            <p className="text-gray-600 mb-4">Choose a credit package to continue using our AI grading platform</p>
            
{user ? (
              <div className="inline-flex items-center bg-blue-100 text-blue-800 px-4 py-2 rounded-full">
                <CreditCard className="h-4 w-4 mr-2" />
                Current Credits: {((user as any)?.user?.credits || 0).toLocaleString()}
              </div>
            ) : null}
          </div>
        </div>

        {isSuccess && (
          <div className="mb-8 max-w-md mx-auto">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-green-600 text-2xl mb-2">✅</div>
                  <h3 className="font-semibold text-green-800 mb-1">Payment Successful!</h3>
                  <p className="text-green-700 text-sm">Your credits have been added to your account.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {CREDIT_PACKAGES.map((pkg) => (
            <Card 
              key={pkg.id} 
              className={`relative cursor-pointer transition-all hover:shadow-lg ${
                pkg.popular ? 'border-blue-500 border-2' : 'border-gray-200'
              }`}
              onClick={() => handlePackageSelect(pkg)}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-500 text-white px-3 py-1">
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">{pkg.name}</CardTitle>
                <div className="text-3xl font-bold text-blue-600">
                  ${pkg.price}
                </div>
              </CardHeader>
              
              <CardContent className="text-center">
                <div className="text-2xl font-semibold mb-2">
                  {pkg.credits.toLocaleString()} Credits
                </div>
                <p className="text-gray-600 text-sm mb-4">{pkg.description}</p>
                <div className="text-sm text-gray-500">
                  ${(pkg.price / pkg.credits * 1000).toFixed(3)} per 1000 credits
                </div>
                
                <Button 
                  className="w-full mt-4" 
                  disabled={isLoading}
                  variant={pkg.popular ? "default" : "outline"}
                >
                  {isLoading ? 'Loading...' : 'Select Package'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-gray-500">
          <p>Secure payment processing</p>
          <p className="mt-2">Credits never expire and can be used for all AI features</p>
        </div>
      </div>
    </div>
  );
}