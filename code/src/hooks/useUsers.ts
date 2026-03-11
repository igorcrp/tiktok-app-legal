
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface User {
  id: string;
  email: string;
  name: string | null;
  status_users: "active" | "pending" | "inactive" | null;
  email_verified: boolean | null;
  level_id: number | null;
  subscribed: boolean | null;
  subscription_tier: string | null;
  subscription_end: string | null;
  stripe_customer_id: string | null;
  must_change_password: boolean | null;
  login_count: number;
  query_count: number;
}

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      
      // Fetch users
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, status_users, email_verified, level_id, subscribed, subscription_tier, subscription_end, stripe_customer_id, must_change_password')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching users:", error);
        toast.error("Failed to fetch users");
        return;
      }

      // Fetch login counts
      const { data: loginCounts, error: loginError } = await supabase
        .from('user_login_history')
        .select('user_id');
      
      if (loginError) {
        console.error("Error fetching login counts:", loginError);
      }

      // Fetch query counts
      const { data: queryCounts, error: queryError } = await supabase
        .from('user_query_history')
        .select('user_id');
      
      if (queryError) {
        console.error("Error fetching query counts:", queryError);
      }

      // Count logins per user
      const loginCountMap = new Map<string, number>();
      loginCounts?.forEach(record => {
        const count = loginCountMap.get(record.user_id) || 0;
        loginCountMap.set(record.user_id, count + 1);
      });

      // Count queries per user
      const queryCountMap = new Map<string, number>();
      queryCounts?.forEach(record => {
        const count = queryCountMap.get(record.user_id) || 0;
        queryCountMap.set(record.user_id, count + 1);
      });

      const typedUsers: User[] = data.map(user => ({
        ...user,
        status_users: (user.status_users === 'active' || user.status_users === 'pending' || user.status_users === 'inactive') 
          ? user.status_users 
          : 'pending',
        email_verified: user.email_verified || false,
        subscribed: user.subscribed || false,
        subscription_tier: user.subscription_tier || 'Free',
        subscription_end: user.subscription_end || null,
        stripe_customer_id: user.stripe_customer_id || null,
        must_change_password: user.must_change_password || false,
        login_count: loginCountMap.get(user.id) || 0,
        query_count: queryCountMap.get(user.id) || 0,
      }));

      setUsers(typedUsers);
    } catch (error) {
      console.error("Failed to fetch users", error);
      toast.error("Failed to fetch users");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const session = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        headers: {
          Authorization: `Bearer ${session.data.session?.access_token}`
        },
        body: {
          userId
        }
      });

      if (error) {
        console.error("Error deleting user:", error);
        toast.error("Failed to delete user");
        return;
      }

      if (!data || !data.success) {
        console.error("Error from edge function:", data?.error);
        toast.error(data?.error || "Failed to delete user");
        return;
      }

      setUsers(users.filter(user => user.id !== userId));
      toast.success("User deleted successfully");
    } catch (error) {
      console.error("Failed to delete user", error);
      toast.error("Failed to delete user");
    }
  };


  const updateUserLevel = async (userId: string, levelId: number) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ level_id: levelId })
        .eq('id', userId);

      if (error) {
        console.error("Error updating user level:", error);
        toast.error("Failed to update user level");
        return;
      }

      setUsers(users.map(user => 
        user.id === userId ? { ...user, level_id: levelId } : user
      ));
      toast.success("User level updated successfully");
    } catch (error) {
      console.error("Failed to update user level", error);
      toast.error("Failed to update user level");
    }
  };

  const updateUserStatus = async (userId: string, status: "active" | "pending" | "inactive") => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status_users: status })
        .eq('id', userId);

      if (error) {
        console.error("Error updating user status:", error);
        toast.error("Failed to update user status");
        return;
      }

      setUsers(users.map(user => 
        user.id === userId ? { ...user, status_users: status } : user
      ));
      toast.success("User status updated successfully");
    } catch (error) {
      console.error("Failed to update user status", error);
      toast.error("Failed to update user status");
    }
  };

  const updateUserSubscription = async (userId: string, tier: "Free" | "Premium") => {
    try {
      // Call edge function to update subscription in Stripe and Supabase
      const { data, error } = await supabase.functions.invoke('admin-update-subscription', {
        body: {
          userId,
          subscriptionTier: tier
        }
      });

      if (error) {
        console.error("Error updating user subscription:", error);
        toast.error("Failed to update user subscription");
        return;
      }

      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { 
          ...user, 
          subscription_tier: tier,
          subscribed: tier === "Premium"
        } : user
      ));
      
      toast.success(`User subscription updated to ${tier}`);
    } catch (error) {
      console.error("Failed to update user subscription", error);
      toast.error("Failed to update user subscription");
    }
  };

  const addUser = async (userData: {
    email: string;
    name: string;
    level_id: number;
    status_users: "active" | "pending" | "inactive";
    email_verified: boolean;
    subscribed?: boolean;
    subscription_tier?: string;
    subscription_end?: string;
    stripe_customer_id?: string;
  }) => {
    try {
      console.log("Starting addUser with data:", { email: userData.email, name: userData.name });
      
      // Call edge function to create user (requires admin permissions)
      const session = await supabase.auth.getSession();
      
      console.log("Session obtained, calling edge function...");
      
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        headers: {
          Authorization: `Bearer ${session.data.session?.access_token}`
        },
        body: {
          email: userData.email,
          name: userData.name,
          level_id: userData.level_id,
          status_users: userData.status_users,
          email_verified: userData.email_verified,
          subscribed: userData.subscribed || false,
          subscription_tier: userData.subscription_tier || 'Free',
        }
      });

      console.log("Edge function response:", { data, error });

      if (error) {
        console.error("Error creating user:", error);
        toast.error(`Failed to create user: ${error.message}`);
        return false;
      }

      if (!data || !data.success) {
        console.error("Error from edge function:", data?.error);
        toast.error(data?.error || "Failed to create user");
        return false;
      }

      console.log("User created successfully:", data.user);

      // Show temporary password to admin
      if (data.temporaryPassword) {
        toast.success(
          `User created successfully!\n\nTemporary Password: ${data.temporaryPassword}\n\nPlease save this password and provide it to the user. They must change it on first login.`,
          {
            duration: 15000,
          }
        );
      } else {
        toast.success("User created successfully!");
      }

      const newUser: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        status_users: data.user.status_users,
        email_verified: data.user.email_verified || false,
        level_id: data.user.level_id,
        subscribed: data.user.subscribed || false,
        subscription_tier: data.user.subscription_tier || 'Free',
        subscription_end: data.user.subscription_end || null,
        stripe_customer_id: data.user.stripe_customer_id || null,
        must_change_password: data.user.must_change_password || false,
        login_count: 0,
        query_count: 0,
      };

      setUsers([newUser, ...users]);
      return true;
    } catch (error: any) {
      console.error("Failed to add user - catch block:", error);
      toast.error(`Failed to add user: ${error.message || "Unknown error"}`);
      return false;
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    isLoading,
    deleteUser,
    updateUserLevel,
    updateUserStatus,
    updateUserSubscription,
    addUser,
    refetch: fetchUsers
  };
}
