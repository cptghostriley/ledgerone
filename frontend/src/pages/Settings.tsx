import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { User, Lock, Palette } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("profile");

  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/v1/auth/me", {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
      });
      if (!res.ok) throw new Error("Failed");
      return res.json().then(d => d.data);
    }
  });

  const email = meData?.user?.email || "";
  const icaiNumber = meData?.user?.icai_membership_number || "";

  return (
    <div className="flex flex-col">
      <PageHeader title="Personal Settings" description="Manage your account profile and preferences." />

      <div className="px-6 py-6 md:px-8">
        <Tabs defaultValue="profile" onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="bg-muted/50 relative">
            {[
              { id: "profile", label: "Profile", icon: User },
              { id: "security", label: "Security", icon: Lock },
              { id: "preferences", label: "Preferences", icon: Palette },
            ].map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="relative bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="user-settings-active-tab"
                    className="absolute inset-0 rounded-sm bg-background shadow-sm"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center">
                  <tab.icon className="mr-1.5 h-3.5 w-3.5" /> {tab.label}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card className="border-border/70 bg-card p-6 shadow-elegant">
              <h3 className="font-display text-base font-bold">Personal Profile</h3>
              <p className="text-sm text-muted-foreground">Update your contact and professional details.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Full Name</Label><Input placeholder="Your Name" /></div>
                <div className="space-y-1.5"><Label>Email Address</Label><Input defaultValue={email} disabled className="bg-muted/50" /></div>
                <div className="space-y-1.5"><Label>ICAI Membership No.</Label><Input defaultValue={icaiNumber} /></div>
              </div>
              <div className="mt-5 flex justify-end"><Button onClick={() => toast.success("Profile saved")} className="bg-gradient-primary text-primary-foreground">Save changes</Button></div>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card className="border-border/70 bg-card p-6 shadow-elegant">
              <h3 className="font-display text-base font-bold">Change Password</h3>
              <div className="mt-5 grid gap-4 max-w-md">
                <div className="space-y-1.5"><Label>Current Password</Label><Input type="password" /></div>
                <div className="space-y-1.5"><Label>New Password</Label><Input type="password" /></div>
                <div className="space-y-1.5"><Label>Confirm New Password</Label><Input type="password" /></div>
              </div>
              <div className="mt-5 flex justify-start"><Button onClick={() => toast.success("Password updated")}>Update Password</Button></div>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-4">
            <Card className="border-border/70 bg-card p-6 shadow-elegant">
              <h3 className="font-display text-base font-bold">Appearance</h3>
              <p className="mt-1 text-sm text-muted-foreground">Customize your UI experience.</p>
              <div className="mt-4 flex items-center gap-4">
                <Button variant="outline">Light Mode</Button>
                <Button variant="outline" className="border-primary">Dark Mode</Button>
                <Button variant="outline">System Default</Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
