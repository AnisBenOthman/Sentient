import { recruitmentPipeline } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Briefcase, Plus, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Recruitment() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-recruitment">Recruitment</h1>
          <p className="text-muted-foreground mt-1">Manage open positions and candidate pipelines</p>
        </div>
        <Button className="gap-2" data-testid="button-new-job">
          <Plus className="h-4 w-4" /> Post New Job
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Roles</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recruitmentPipeline.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Applicants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recruitmentPipeline.reduce((acc, curr) => acc + curr.applicantCount, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offers Pending</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recruitmentPipeline.reduce((acc, curr) => acc + curr.stages.offer, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Active Pipelines</h2>
        
        {recruitmentPipeline.map((job) => (
          <Card key={job.id} data-testid={`card-job-${job.id}`}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{job.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary">{job.department}</Badge>
                    <span>{job.applicantCount} total applicants</span>
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">View Pipeline</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex bg-muted/50 rounded-lg p-4 justify-between">
                <div className="text-center flex-1 border-r border-border last:border-0">
                  <div className="text-2xl font-bold text-foreground">{job.stages.sourcing}</div>
                  <div className="text-xs text-muted-foreground font-medium uppercase mt-1">Sourcing</div>
                </div>
                <div className="text-center flex-1 border-r border-border last:border-0">
                  <div className="text-2xl font-bold text-foreground">{job.stages.interview}</div>
                  <div className="text-xs text-muted-foreground font-medium uppercase mt-1">Interview</div>
                </div>
                <div className="text-center flex-1 border-r border-border last:border-0">
                  <div className="text-2xl font-bold text-primary">{job.stages.offer}</div>
                  <div className="text-xs text-muted-foreground font-medium uppercase mt-1">Offer</div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-2xl font-bold text-green-600">{job.stages.hired}</div>
                  <div className="text-xs text-muted-foreground font-medium uppercase mt-1">Hired</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
