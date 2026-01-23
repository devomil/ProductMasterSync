import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Building2, 
  ArrowLeft,
  Save,
  Plus,
  User,
  FileText,
  MessageSquare,
  ExternalLink,
  Phone,
  Mail,
  Download,
  Trash2,
  Edit,
  Calendar,
  Upload,
  Clock,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface Contact {
  id: number;
  partnerId: number;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  role: string | null;
  isPrimary: boolean;
  notes: string | null;
}

interface Document {
  id: number;
  partnerId: number;
  name: string;
  filename: string;
  fileType: string | null;
  fileSize: number | null;
  documentType: string | null;
  description: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

interface Communication {
  id: number;
  partnerId: number;
  contactId: number | null;
  type: "email" | "phone" | "meeting" | "video_call" | "note" | "other";
  subject: string;
  content: string | null;
  communicationDate: string;
  direction: string | null;
  followUpRequired: boolean;
  followUpDate: string | null;
  followUpCompleted: boolean;
  loggedBy: string | null;
}

interface BrandPartner {
  id: number;
  name: string;
  code: string | null;
  partnerId: string | null;
  partnerStatus: "prospect" | "active" | "inactive" | "suspended";
  approvalDate: string | null;
  website: string | null;
  rebatePortalUrl: string | null;
  rebatePortalNotes: string | null;
  paymentTerms: string | null;
  minimumOrder: string | null;
  territoryRestrictions: string | null;
  notes: string | null;
  productCount: number;
  contacts: Contact[];
  documents: Document[];
  communications: Communication[];
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-200",
  prospect: "bg-blue-100 text-blue-800 border-blue-200",
  inactive: "bg-gray-100 text-gray-800 border-gray-200",
  suspended: "bg-red-100 text-red-800 border-red-200"
};

const commTypeIcons: Record<string, any> = {
  email: Mail,
  phone: Phone,
  meeting: User,
  video_call: User,
  note: FileText,
  other: MessageSquare
};

export default function BrandPartnerDetails() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<BrandPartner>>({});
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isAddCommOpen, setIsAddCommOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", title: "", email: "", phone: "", role: "", isPrimary: false });
  const [newComm, setNewComm] = useState({ type: "email", subject: "", content: "", direction: "outbound", followUpRequired: false, followUpDate: "" });

  const { data: partner, isLoading, refetch } = useQuery<BrandPartner>({
    queryKey: [`/api/brand-partners/${id}`],
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<BrandPartner>) => {
      return apiRequest("PATCH", `/api/brand-partners/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Partner updated successfully" });
      setEditMode(false);
      refetch();
    },
    onError: () => {
      toast({ title: "Error updating partner", variant: "destructive" });
    }
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleAddContact = async () => {
    try {
      await apiRequest("POST", `/api/brand-partners/${id}/contacts`, newContact);
      toast({ title: "Contact added successfully" });
      setIsAddContactOpen(false);
      setNewContact({ name: "", title: "", email: "", phone: "", role: "", isPrimary: false });
      refetch();
    } catch (error) {
      toast({ title: "Error adding contact", variant: "destructive" });
    }
  };

  const handleDeleteContact = async (contactId: number) => {
    try {
      await apiRequest("DELETE", `/api/brand-partners/${id}/contacts/${contactId}`);
      toast({ title: "Contact deleted" });
      refetch();
    } catch (error) {
      toast({ title: "Error deleting contact", variant: "destructive" });
    }
  };

  const handleAddCommunication = async () => {
    try {
      await apiRequest("POST", `/api/brand-partners/${id}/communications`, {
        ...newComm,
        followUpDate: newComm.followUpDate || null
      });
      toast({ title: "Communication logged successfully" });
      setIsAddCommOpen(false);
      setNewComm({ type: "email", subject: "", content: "", direction: "outbound", followUpRequired: false, followUpDate: "" });
      refetch();
    } catch (error) {
      toast({ title: "Error logging communication", variant: "destructive" });
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    try {
      await apiRequest("DELETE", `/api/brand-partners/${id}/documents/${docId}`);
      toast({ title: "Document deleted" });
      refetch();
    } catch (error) {
      toast({ title: "Error deleting document", variant: "destructive" });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", file.name);
    formData.append("documentType", "other");

    try {
      const response = await fetch(`/api/brand-partners/${id}/documents`, {
        method: "POST",
        body: formData
      });
      if (!response.ok) throw new Error("Upload failed");
      toast({ title: "Document uploaded successfully" });
      refetch();
    } catch (error) {
      toast({ title: "Error uploading document", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Partner not found</h2>
        <Link href="/brand-partners">
          <Button variant="link">Back to Brand Partners</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Link href="/brand-partners">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Partners
            </Button>
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            {partner.name}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className={statusColors[partner.partnerStatus]}>
              {partner.partnerStatus}
            </Badge>
            {partner.partnerId && (
              <Badge variant="secondary">Partner ID: {partner.partnerId}</Badge>
            )}
            <span className="text-muted-foreground">
              {partner.productCount.toLocaleString()} products
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </>
          ) : (
            <Button onClick={() => { setEditMode(true); setFormData(partner); }}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Partner
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts ({partner.contacts?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="documents">
            Documents ({partner.documents?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="communications">
            Communications ({partner.communications?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Partnership Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div>
                    <Label>Partner ID</Label>
                    {editMode ? (
                      <Input
                        value={formData.partnerId || ""}
                        onChange={(e) => setFormData({ ...formData, partnerId: e.target.value })}
                        placeholder="Enter partner ID"
                      />
                    ) : (
                      <p className="text-sm">{partner.partnerId || "Not set"}</p>
                    )}
                  </div>
                  <div>
                    <Label>Status</Label>
                    {editMode ? (
                      <Select
                        value={formData.partnerStatus}
                        onValueChange={(v) => setFormData({ ...formData, partnerStatus: v as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="prospect">Prospect</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={statusColors[partner.partnerStatus]}>
                        {partner.partnerStatus}
                      </Badge>
                    )}
                  </div>
                  <div>
                    <Label>Payment Terms</Label>
                    {editMode ? (
                      <Input
                        value={formData.paymentTerms || ""}
                        onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                        placeholder="e.g., Net 30"
                      />
                    ) : (
                      <p className="text-sm">{partner.paymentTerms || "Not set"}</p>
                    )}
                  </div>
                  <div>
                    <Label>Minimum Order</Label>
                    {editMode ? (
                      <Input
                        value={formData.minimumOrder || ""}
                        onChange={(e) => setFormData({ ...formData, minimumOrder: e.target.value })}
                        placeholder="Minimum order requirements"
                      />
                    ) : (
                      <p className="text-sm">{partner.minimumOrder || "Not set"}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Links & Resources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Website</Label>
                  {editMode ? (
                    <Input
                      value={formData.website || ""}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://..."
                    />
                  ) : partner.website ? (
                    <a
                      href={partner.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {partner.website}
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not set</p>
                  )}
                </div>
                <div>
                  <Label>Rebate Portal URL</Label>
                  {editMode ? (
                    <Input
                      value={formData.rebatePortalUrl || ""}
                      onChange={(e) => setFormData({ ...formData, rebatePortalUrl: e.target.value })}
                      placeholder="Rebate portal URL"
                    />
                  ) : partner.rebatePortalUrl ? (
                    <a
                      href={partner.rebatePortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {partner.rebatePortalUrl}
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not set</p>
                  )}
                </div>
                <div>
                  <Label>Rebate Portal Notes</Label>
                  {editMode ? (
                    <Textarea
                      value={formData.rebatePortalNotes || ""}
                      onChange={(e) => setFormData({ ...formData, rebatePortalNotes: e.target.value })}
                      placeholder="Login info notes (not passwords)"
                    />
                  ) : (
                    <p className="text-sm">{partner.rebatePortalNotes || "No notes"}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {editMode ? (
                  <Textarea
                    value={formData.notes || ""}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="General notes about this partner..."
                    rows={4}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{partner.notes || "No notes"}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Key Contacts</CardTitle>
                <CardDescription>Manage contacts for this partner</CardDescription>
              </div>
              <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Contact
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Contact</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={newContact.name}
                        onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={newContact.title}
                        onChange={(e) => setNewContact({ ...newContact, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={newContact.email}
                        onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input
                        value={newContact.phone}
                        onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Role</Label>
                      <Select value={newContact.role} onValueChange={(v) => setNewContact({ ...newContact, role: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sales_rep">Sales Rep</SelectItem>
                          <SelectItem value="account_manager">Account Manager</SelectItem>
                          <SelectItem value="support">Support</SelectItem>
                          <SelectItem value="billing">Billing</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={newContact.isPrimary}
                        onCheckedChange={(c) => setNewContact({ ...newContact, isPrimary: !!c })}
                      />
                      <Label>Primary Contact</Label>
                    </div>
                    <Button onClick={handleAddContact} className="w-full">Add Contact</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {partner.contacts?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No contacts yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partner.contacts?.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {contact.name}
                            {contact.isPrimary && <Badge variant="secondary">Primary</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>{contact.title || "-"}</TableCell>
                        <TableCell>
                          {contact.email ? (
                            <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                              {contact.email}
                            </a>
                          ) : "-"}
                        </TableCell>
                        <TableCell>{contact.phone || "-"}</TableCell>
                        <TableCell>{contact.role || "-"}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteContact(contact.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Documents</CardTitle>
                <CardDescription>Approval PDFs, contracts, and other documents</CardDescription>
              </div>
              <div>
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.png"
                  onChange={handleFileUpload}
                />
                <label htmlFor="file-upload">
                  <Button asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </span>
                  </Button>
                </label>
              </div>
            </CardHeader>
            <CardContent>
              {partner.documents?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No documents uploaded yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partner.documents?.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {doc.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{doc.fileType || "Unknown"}</Badge>
                        </TableCell>
                        <TableCell>
                          {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : "-"}
                        </TableCell>
                        <TableCell>
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <a href={`/api/brand-partners/${id}/documents/${doc.id}/download`}>
                              <Button variant="ghost" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                            </a>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDocument(doc.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Communications Tab */}
        <TabsContent value="communications">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Communication History</CardTitle>
                <CardDescription>Log of interactions with this partner</CardDescription>
              </div>
              <Dialog open={isAddCommOpen} onOpenChange={setIsAddCommOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Log Communication
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Log Communication</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label>Type</Label>
                      <Select value={newComm.type} onValueChange={(v) => setNewComm({ ...newComm, type: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Phone Call</SelectItem>
                          <SelectItem value="meeting">Meeting</SelectItem>
                          <SelectItem value="video_call">Video Call</SelectItem>
                          <SelectItem value="note">Note</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Direction</Label>
                      <Select value={newComm.direction} onValueChange={(v) => setNewComm({ ...newComm, direction: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inbound">Inbound</SelectItem>
                          <SelectItem value="outbound">Outbound</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Subject</Label>
                      <Input
                        value={newComm.subject}
                        onChange={(e) => setNewComm({ ...newComm, subject: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Textarea
                        value={newComm.content}
                        onChange={(e) => setNewComm({ ...newComm, content: e.target.value })}
                        rows={4}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={newComm.followUpRequired}
                        onCheckedChange={(c) => setNewComm({ ...newComm, followUpRequired: !!c })}
                      />
                      <Label>Follow-up Required</Label>
                    </div>
                    {newComm.followUpRequired && (
                      <div>
                        <Label>Follow-up Date</Label>
                        <Input
                          type="date"
                          value={newComm.followUpDate}
                          onChange={(e) => setNewComm({ ...newComm, followUpDate: e.target.value })}
                        />
                      </div>
                    )}
                    <Button onClick={handleAddCommunication} className="w-full">Log Communication</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {partner.communications?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No communications logged yet</p>
              ) : (
                <div className="space-y-4">
                  {partner.communications?.map((comm) => {
                    const Icon = commTypeIcons[comm.type] || MessageSquare;
                    return (
                      <div key={comm.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-muted rounded-full">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium">{comm.subject}</div>
                              <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <Badge variant="outline">{comm.type}</Badge>
                                <span>{comm.direction}</span>
                                <span>•</span>
                                <span>{new Date(comm.communicationDate).toLocaleDateString()}</span>
                              </div>
                              {comm.content && (
                                <p className="text-sm mt-2 whitespace-pre-wrap">{comm.content}</p>
                              )}
                            </div>
                          </div>
                          {comm.followUpRequired && (
                            <div className="flex items-center gap-1">
                              {comm.followUpCompleted ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-orange-500" />
                              )}
                              <span className="text-xs text-muted-foreground">
                                {comm.followUpDate && new Date(comm.followUpDate).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
