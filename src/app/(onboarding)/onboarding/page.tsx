"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wrench, Building2, Users, BookOpen, UserPlus, CheckCircle, ChevronRight, Loader2 } from "lucide-react";

const STEPS = [
  { id: "welcome", label: "Welcome", icon: Wrench },
  { id: "shop", label: "Your Shop", icon: Building2 },
  { id: "technician", label: "Add Tech", icon: Users },
  { id: "services", label: "Price Book", icon: BookOpen },
  { id: "customer", label: "First Customer", icon: UserPlus },
  { id: "done", label: "Done!", icon: CheckCircle },
];

const DEFAULT_SERVICES = [
  { name: "Oil Change (Conventional)", laborPrice: 0, partsPrice: 35, description: "Drain & refill, up to 5qt conventional oil + filter" },
  { name: "Oil Change (Synthetic)", laborPrice: 0, partsPrice: 65, description: "Drain & refill, up to 5qt full synthetic + filter" },
  { name: "Brake Inspection", laborPrice: 30, partsPrice: 0, description: "Visual inspection of pads, rotors, calipers, and lines" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Shop
  const [shopName, setShopName] = useState("B&V Mobile Auto");
  const [shopPhone, setShopPhone] = useState("");
  const [shopEmail, setShopEmail] = useState("");
  const [shopAddress, setShopAddress] = useState("");

  // Technician
  const [techName, setTechName] = useState("");
  const [techEmail, setTechEmail] = useState("");
  const [techPassword, setTechPassword] = useState("");

  // Services
  const [services, setServices] = useState(DEFAULT_SERVICES);

  // First Customer
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custEmail, setCustEmail] = useState("");

  const currentStep = STEPS[step];
  const progress = (step / (STEPS.length - 1)) * 100;

  async function handleShop() {
    if (!shopName.trim()) { setError("Shop name is required"); return; }
    setLoading(true); setError("");
    try {
      await axios.post("/api/shops", { name: shopName, phone: shopPhone, email: shopEmail, address: shopAddress });
      setStep(2);
    } catch (e: unknown) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error : "Failed to save shop");
    } finally { setLoading(false); }
  }

  async function handleTechnician() {
    if (!techName.trim() || !techEmail.trim() || !techPassword.trim()) {
      setError("All fields are required"); return;
    }
    setLoading(true); setError("");
    try {
      await axios.post("/api/users", { name: techName, email: techEmail, password: techPassword, role: "TECHNICIAN" });
      setStep(3);
    } catch (e: unknown) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error : "Failed to create technician");
    } finally { setLoading(false); }
  }

  async function handleServices() {
    setLoading(true); setError("");
    try {
      for (const svc of services) {
        if (svc.name.trim()) {
          await axios.post("/api/canned-services", svc);
        }
      }
      setStep(4);
    } catch (e: unknown) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error : "Failed to save services");
    } finally { setLoading(false); }
  }

  async function handleCustomer() {
    if (!firstName.trim() || !lastName.trim()) { setError("Name is required"); return; }
    setLoading(true); setError("");
    try {
      await axios.post("/api/customers", {
        firstName, lastName, phone: custPhone, email: custEmail,
      });
      setStep(5);
    } catch (e: unknown) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error : "Failed to add customer");
    } finally { setLoading(false); }
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      {/* Logo + progress */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Wrench className="h-5 w-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl">B&V Mobile Auto</span>
        </div>
        <p className="text-blue-200 text-sm">Let's get your shop set up — takes about 3 minutes</p>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className={`h-1.5 rounded-full transition-all ${i <= step ? "bg-blue-400" : "bg-white/20"} ${i === step ? "w-8" : "w-4"}`} />
          ))}
        </div>
        <p className="text-white/60 text-xs">{step + 1} of {STEPS.length} — {currentStep.label}</p>
      </div>

      {/* Step cards */}
      {step === 0 && (
        <Card className="border-0 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-3">
              <Wrench className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Welcome to your BOS</CardTitle>
            <CardDescription className="text-base">
              Your complete business operating system for mobile auto repair. We'll walk you through 4 quick setup steps.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Building2, label: "Shop info", desc: "Name, contact, location" },
                { icon: Users, label: "Technicians", desc: "Add your team members" },
                { icon: BookOpen, label: "Price book", desc: "Common service prices" },
                { icon: UserPlus, label: "First customer", desc: "Ready to take jobs" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border">
                  <Icon className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={() => setStep(1)}>
              Get Started <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card className="border-0 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-blue-600" /> Your Shop</CardTitle>
            <CardDescription>Basic info about your business</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Shop Name *</Label>
              <Input value={shopName} onChange={e => setShopName(e.target.value)} placeholder="B&V Mobile Auto" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={shopPhone} onChange={e => setShopPhone(e.target.value)} placeholder="(555) 555-5555" type="tel" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={shopEmail} onChange={e => setShopEmail(e.target.value)} placeholder="shop@email.com" type="email" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Service Area / Address</Label>
              <Input value={shopAddress} onChange={e => setShopAddress(e.target.value)} placeholder="City, State or service area" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)} className="flex-1">Back</Button>
              <Button onClick={handleShop} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="border-0 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" /> Add a Technician</CardTitle>
            <CardDescription>Create a login for your first tech (you can add more later)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={techName} onChange={e => setTechName(e.target.value)} placeholder="John Smith" />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input value={techEmail} onChange={e => setTechEmail(e.target.value)} placeholder="tech@bvauto.com" type="email" />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input value={techPassword} onChange={e => setTechPassword(e.target.value)} type="password" placeholder="Minimum 8 characters" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button onClick={handleTechnician} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <button className="w-full text-xs text-gray-400 hover:text-gray-600" onClick={() => setStep(3)}>
              Skip — add technicians later
            </button>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-0 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-blue-600" /> Price Book</CardTitle>
            <CardDescription>Edit your most common services. You can add more later under Price Book.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {services.map((svc, i) => (
              <div key={i} className="p-3 rounded-lg border bg-gray-50 space-y-2">
                <Input
                  value={svc.name}
                  onChange={e => setServices(prev => prev.map((s, j) => j === i ? { ...s, name: e.target.value } : s))}
                  placeholder="Service name"
                  className="font-medium"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Labor $</Label>
                    <Input
                      type="number" min="0"
                      value={svc.laborPrice}
                      onChange={e => setServices(prev => prev.map((s, j) => j === i ? { ...s, laborPrice: Number(e.target.value) } : s))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Parts $</Label>
                    <Input
                      type="number" min="0"
                      value={svc.partsPrice}
                      onChange={e => setServices(prev => prev.map((s, j) => j === i ? { ...s, partsPrice: Number(e.target.value) } : s))}
                    />
                  </div>
                </div>
              </div>
            ))}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
              <Button onClick={handleServices} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save & Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <button className="w-full text-xs text-gray-400 hover:text-gray-600" onClick={() => setStep(4)}>
              Skip — set prices later
            </button>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="border-0 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-blue-600" /> First Customer</CardTitle>
            <CardDescription>Add your first customer so you can create a job right away</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={custPhone} onChange={e => setCustPhone(e.target.value)} placeholder="(555) 555-5555" type="tel" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={custEmail} onChange={e => setCustEmail(e.target.value)} placeholder="jane@email.com" type="email" />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1">Back</Button>
              <Button onClick={handleCustomer} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Finish Setup <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <button className="w-full text-xs text-gray-400 hover:text-gray-600" onClick={() => router.push("/dashboard")}>
              Skip — go to dashboard
            </button>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card className="border-0 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-3">
              <CheckCircle className="h-9 w-9 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-700">You're all set!</CardTitle>
            <CardDescription className="text-base">
              Your shop is configured and ready to take its first job.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm text-gray-600">
              {[
                "Shop info saved",
                "Technician account created",
                "Price book ready",
                "First customer added",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 pt-2">
              <Button className="w-full" onClick={() => router.push("/jobs/new")}>
                <Wrench className="h-4 w-4 mr-2" /> Create First Job
              </Button>
              <Button variant="outline" className="w-full" onClick={() => router.push("/dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
