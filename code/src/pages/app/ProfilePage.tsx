import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { fireLead } from "@/utils/metaPixel";
import { Crown, Check } from "lucide-react";
import { SubscriptionManagement } from "@/components/SubscriptionManagement";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  const {
    isSubscribed,
    subscriptionTier,
    subscriptionEnd,
    createCheckout,
    isLoading: subscriptionLoading
  } = useSubscription();

  // Fetch user profile data on component mount
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('users')
          .select('name')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user profile:', error);
        } else if (data) {
          setFullName(data.name || "");
        }
      } catch (error) {
        console.error('Error in fetchUserProfile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [user?.id]);

  const handleSaveChanges = async () => {
    if (!user?.id) return;
    
    try {
      setIsUpdating(true);
      
      // Validate password if provided
      if (password || confirmPassword) {
        if (password !== confirmPassword) {
          toast({
            title: "Error",
            description: "Passwords do not match.",
            variant: "destructive",
          });
          return;
        }
        
        if (password.length < 8) {
          toast({
            title: "Error",
            description: "Password must be at least 8 characters long.",
            variant: "destructive",
          });
          return;
        }
        
        // Update password
        const { error: passwordError } = await supabase.auth.updateUser({
          password: password
        });
        
        if (passwordError) {
          console.error('Error updating password:', passwordError);
          toast({
            title: "Error",
            description: "Failed to update password. Please try again.",
            variant: "destructive",
          });
          return;
        }
        
        // Clear must_change_password flag after successful password change
        await supabase
          .from('users')
          .update({ must_change_password: false })
          .eq('id', user.id);
      }
      
      // Update the users table
      const { error } = await supabase
        .from('users')
        .update({ name: fullName })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating user:', error);
        toast({
          title: "Error",
          description: "Failed to update profile. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      // Clear password fields
      setPassword("");
      setConfirmPassword("");

      // Lead event: user completed their profile — signals purchase intent to Meta
      fireLead({ email: user?.email });

      toast({
        title: "Success",
        description: password ? "Profile and password updated successfully." : "Profile updated successfully.",
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="loading-circle"></div>
      </div>
    );
  }
  
  return (
    <div>
      <div className="grid grid-cols-1 md:grid gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="p-3">
              <CardTitle className="text-lg">Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-3">
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input 
                    id="fullName" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue={user?.email || ""} readOnly />
                </div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-base">Email Verification</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {user?.email_verified ? 'Verified' : 'Not verified'}
                    </p>
                    {!user?.email_verified && (
                      <Button variant="outline" size="sm" className="mt-2">
                        Verify Email
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input 
                    id="confirmPassword" 
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex flex-col">
                    <Label className="text-base">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Receive email updates
                    </p>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={handleSaveChanges} disabled={isUpdating}>
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Plans Section */}
          <Card>
            <CardHeader className="p-3">
              <CardTitle className="text-lg">Subscription Plans</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {/* Current Status */}
              <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                <h3 className="font-semibold mb-2">Current Status</h3>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Plan</span>
                    <p className="font-medium">{isSubscribed ? `${subscriptionTier} Plan` : 'Free Plan'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status</span>
                    <p className="font-medium">Active</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Next Billing</span>
                    <p className="font-medium">
                      {isSubscribed && subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString() : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Free Plan */}
                <div className="relative p-4 border rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">Free Plan</h3>
                  <div className="mb-4">
                    <span className="text-2xl font-bold">$0</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      1 Month period limit
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      10 Stock results limit
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      Basic features
                    </li>
                  </ul>
                  {!isSubscribed && (
                    <Badge variant="outline" className="absolute top-4 right-4 text-green-600 border-green-600">
                      Current Plan
                    </Badge>
                  )}
                </div>

                {/* Premium Plan */}
                <div className="relative p-4 border rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="h-5 w-5 text-yellow-500" />
                    <h3 className="text-lg font-semibold">Premium Plan</h3>
                  </div>
                  <div className="mb-4">
                    <span className="text-2xl font-bold">$39</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      Unlimited period access
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      Unlimited stock results
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      All filters enabled
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      Premium features
                    </li>
                  </ul>
                  
                  {isSubscribed ? (
                    <>
                      <Badge variant="outline" className="absolute top-4 right-4 text-green-600 border-green-600">
                        Current Plan
                      </Badge>
                      <SubscriptionManagement />
                    </>
                  ) : (
                    <Button 
                      onClick={createCheckout} 
                      disabled={subscriptionLoading} 
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Upgrade to Premium
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
