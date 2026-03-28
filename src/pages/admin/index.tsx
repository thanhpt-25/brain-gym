import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain, ArrowLeft, Users, FileText, AlertTriangle, Shield, Award,
  LayoutDashboard, Building2, BookOpen, ScrollText
} from 'lucide-react';
import AdminDashboard from './AdminDashboard';
import UsersTab from './UsersTab';
import CertificationsTab from './CertificationsTab';
import ProvidersTab from './ProvidersTab';
import ModerationTab from './ModerationTab';
import ReportsTab from './ReportsTab';
import AuditLogTab from './AuditLogTab';

const AdminPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  if (user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-mono font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">Admin access required.</p>
          <Button onClick={() => navigate('/')}>Back Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Brain className="h-6 w-6 text-primary" />
            <span className="font-mono text-lg font-bold text-gradient-cyan">Admin Panel</span>
          </div>
        </div>
      </nav>

      <div className="container pt-24 pb-16">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="bg-secondary flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="dashboard" className="font-mono text-xs"><LayoutDashboard className="h-3 w-3 mr-1" /> Dashboard</TabsTrigger>
            <TabsTrigger value="users" className="font-mono text-xs"><Users className="h-3 w-3 mr-1" /> Users</TabsTrigger>
            <TabsTrigger value="providers" className="font-mono text-xs"><Building2 className="h-3 w-3 mr-1" /> Providers</TabsTrigger>
            <TabsTrigger value="certifications" className="font-mono text-xs"><Award className="h-3 w-3 mr-1" /> Certifications</TabsTrigger>
            <TabsTrigger value="moderation" className="font-mono text-xs"><FileText className="h-3 w-3 mr-1" /> Moderation</TabsTrigger>
            <TabsTrigger value="reports" className="font-mono text-xs"><AlertTriangle className="h-3 w-3 mr-1" /> Reports</TabsTrigger>
            <TabsTrigger value="audit" className="font-mono text-xs"><ScrollText className="h-3 w-3 mr-1" /> Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><AdminDashboard /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="providers"><ProvidersTab /></TabsContent>
          <TabsContent value="certifications"><CertificationsTab /></TabsContent>
          <TabsContent value="moderation"><ModerationTab /></TabsContent>
          <TabsContent value="reports"><ReportsTab /></TabsContent>
          <TabsContent value="audit"><AuditLogTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPage;
