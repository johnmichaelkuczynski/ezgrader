import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Home } from "lucide-react";

export default function CheckoutSuccess() {
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split('?')[1]);
  const sessionId = urlParams.get('session_id');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-green-600">Payment Successful!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            Your payment has been processed successfully. Your credits have been added to your account.
          </p>
          {sessionId && (
            <p className="text-xs text-gray-400">
              Session ID: {sessionId}
            </p>
          )}
          <Button 
            onClick={() => window.location.href = '/'}
            className="w-full"
            data-testid="button-return-home"
          >
            <Home className="h-4 w-4 mr-2" />
            Return to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}