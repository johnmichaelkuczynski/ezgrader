import { Switch, Route, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, LogOut, User, Coins } from "lucide-react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Pricing from "@/pages/pricing";
import Checkout from "@/pages/checkout";
import Success from "@/pages/success";
import { apiRequest } from "@/lib/queryClient";

function Navigation() {
  const [location, setLocation] = useLocation();
  
  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
      window.location.reload();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-gray-900">
          Grading Pro
        </Link>
        
        <div className="flex items-center space-x-4">
          {user ? (
            <>
              <div className="flex items-center space-x-2">
                <Coins className="h-4 w-4 text-blue-600" />
                <Badge variant="secondary">
                  {(user.username?.toUpperCase() === 'JMKUCZYNSKI' || user.username?.toUpperCase() === 'JMKUCZYNSKI2') ? '∞ credits' : `${user.credits?.toLocaleString() || 0} credits`}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/pricing")}
              >
                <CreditCard className="h-4 w-4 mr-1" />
                Buy Credits
              </Button>
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span className="text-sm text-gray-700">{user.username}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/pricing")}
              >
                <CreditCard className="h-4 w-4 mr-1" />
                Pricing
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/login")}
              >
                Sign In
              </Button>
              <Button
                size="sm"
                onClick={() => setLocation("/register")}
              >
                Sign Up
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Router() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/success" component={Success} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <TooltipProvider>
      <Router />
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
