import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import OrgStructureCard from "@/components/org-structure-card";

export default function Settings() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-settings">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage organizational configurations and preferences</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
            <CardDescription>Basic information about your organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input id="company-name" defaultValue="Sentient Corp" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax-id">Tax ID / EIN</Label>
                <Input id="tax-id" defaultValue="12-3456789" type="password" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Headquarters Address</Label>
              <Input id="address" defaultValue="100 Innovation Drive, San Francisco, CA 94105" />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>HR Policies</CardTitle>
            <CardDescription>Configure global rules and permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Auto-approve Time Off</Label>
                <p className="text-sm text-muted-foreground">Automatically approve requests under 2 days</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Public Directory</Label>
                <p className="text-sm text-muted-foreground">Allow all employees to view the org chart</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Performance Reviews</Label>
                <p className="text-sm text-muted-foreground">Enable quarterly 360 review cycles</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <OrgStructureCard />
      </div>
    </div>
  );
}
