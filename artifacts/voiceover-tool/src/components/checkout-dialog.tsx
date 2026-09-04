import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Zap, ShieldCheck, CreditCard, Copy, Check, Upload, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";

interface CheckoutDialogProps {
  planId: string | null;
  currency: string;
  onClose: () => void;
}

export function CheckoutDialog({ planId, currency, onClose }: CheckoutDialogProps) {
  const { user, isAuthenticated } = useAuth();
  const [methodId, setMethodId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    customerName: user?.name || "",
    whatsapp: "",
    transactionReference: "",
    termsAccepted: false,
  });

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (proofPreview) {
        URL.revokeObjectURL(proofPreview);
      }
    };
  }, [proofPreview]);

  useEffect(() => {
    if (user?.name) {
      setFormData((current) => current.customerName ? current : { ...current, customerName: user.name });
    }
  }, [user?.name]);

  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const response = await fetch("/api/plans");
      if (!response.ok) throw new Error("Failed to load plan details");
      return response.json();
    },
    enabled: !!planId
  });

  const { data: methods = [], isLoading: isLoadingMethods } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => fetch("/api/orders/payment-methods").then(async r => {
      if (!r.ok) throw new Error("Failed to fetch payment methods");
      const json = await r.json();
      return json.methods || [];
    }),
  });

  // Public methods don't carry enabled, they are active
  const activeMethods = methods;

  useEffect(() => {
    if (!methodId && activeMethods.length > 0) {
      setMethodId(activeMethods[0].id);
    }
  }, [activeMethods, methodId]);

  const submitOrder = useMutation({
    mutationFn: async () => {
      if (!planId || !methodId || !proofFile) throw new Error("Missing requirements");
      const fd = new FormData();
      fd.append("plan", planId);
      fd.append("currency", currency);
      fd.append("paymentMethodId", methodId);
      fd.append("customerName", formData.customerName);
      fd.append("whatsapp", formData.whatsapp);
      fd.append("transactionReference", formData.transactionReference);
      fd.append("termsAccepted", formData.termsAccepted.toString());
      fd.append("proof", proofFile);

      const res = await fetch("/api/orders", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Submission failed");
      }
      return res.json();
    },
    onSuccess: () => {
      trackEvent("order_submitted", {
        plan: planId || "unknown",
        currency,
        payment_method: methodId || "unknown",
      });
    },
  });

  if (!planId) return null;

  const plan = plansData?.plans.find((p: any) => p.id === planId);
  if (!plan) return null;

  const price = plan.prices[currency];
  const cInfo = plansData?.currencies.find((c: any) => c.code === currency) || { symbol: "$", code: "USD" };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProofError(null);

      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setProofError("Invalid format. Only JPEG, PNG, and WebP are accepted.");
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        setProofError("File too large. Maximum 8MB allowed.");
        return;
      }

      try {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const MAX_DIM = 1800;
        let { width, height } = img;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) throw new Error("Failed to get canvas context");
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) {
              setProofError("Failed to process image.");
              return;
            }
            if (blob.size > 3 * 1024 * 1024) {
              setProofError("Processed image still exceeds 3MB limit.");
              return;
            }

            const processedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" });

            if (proofPreview) URL.revokeObjectURL(proofPreview);
            const previewUrl = URL.createObjectURL(processedFile);
            setProofPreview(previewUrl);
            setProofFile(processedFile);
          },
          "image/jpeg",
          0.82
        );
      } catch (err) {
        setProofError("Error processing image.");
      }
    }
  };

  const removeProof = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofPreview(null);
    setProofFile(null);
    setProofError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const selectedMethod = activeMethods.find((m: any) => m.id === methodId);

  const isFormValid = formData.customerName.trim() &&
                      formData.whatsapp.trim() &&
                      formData.transactionReference.trim() &&
                      formData.termsAccepted &&
                      proofFile &&
                      methodId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    submitOrder.mutate();
  };

  const authRedirect = `/pricing?checkout=${planId}&currency=${currency}`;

  return (
    <Dialog open={!!planId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[900px] p-0 bg-[#08080b] border-white/10 text-white overflow-hidden gap-0 rounded-[24px]">
        <DialogTitle className="sr-only">Checkout {plan.name}</DialogTitle>
        <DialogDescription className="sr-only">Complete your purchase for {plan.name}</DialogDescription>

        {submitOrder.isSuccess ? (
          <div className="p-12 flex flex-col items-center justify-center text-center h-[650px]">
            <div className="w-16 h-16 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center mb-6">
              <Check size={32} strokeWidth={3} />
            </div>
            <h2 className="text-2xl font-black mb-3">Order Submitted</h2>
            <p className="text-white/60 mb-8 max-w-sm">
              Your payment proof has been received. Our team will review and approve your order shortly.
            </p>
            <button onClick={onClose} className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors">
              Close
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 h-[85vh] max-h-[750px]">
            {/* Left Col - Summary */}
            <div className="lg:col-span-2 bg-[#0c0c10] border-r border-white/5 p-8 flex flex-col overflow-y-auto custom-scrollbar">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 bg-orange-500/10 px-2 py-1 rounded">
                  Order Summary
                </span>
                <h3 className="text-2xl font-black mt-4 uppercase">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-2 mb-6">
                  <span className="text-4xl font-black">{cInfo.symbol}{price}</span>
                  <span className="text-white/40 font-bold uppercase text-[12px]">{cInfo.code}</span>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                      <Zap size={14} className="text-orange-400" />
                    </div>
                    <div>
                      <p className="text-[12px] font-bold">{plan.credits.toLocaleString()} Credits</p>
                      <p className="text-[10px] text-white/40 uppercase tracking-wide">Valid for {plan.durationDays} days</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                      <ShieldCheck size={14} className="text-orange-400" />
                    </div>
                    <div>
                      <p className="text-[12px] font-bold">Secure Manual Verification</p>
                      <p className="text-[10px] text-white/40 uppercase tracking-wide">No auto-renewal</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tools/Models summary */}
              <div className="mt-8 pt-6 border-t border-white/5 space-y-5">
                {plan.features?.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">Included Capabilities</h4>
                    <ul className="space-y-2">
                      {plan.features.map((f: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] text-white/80">
                          <div className="w-1 h-1 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                          <span className="leading-tight">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(plan.more?.length ?? 0) > 0 && (
                  <div>
                    <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">Premium Models</h4>
                    <ul className="space-y-2">
                      {plan.more.map((f: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] text-white/80">
                          <div className="w-1 h-1 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                          <span className="leading-tight">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              <div className="mt-8 space-y-4 pb-4">
                <p className="text-[11px] text-white/40 leading-relaxed font-medium">
                  Payments are reviewed manually to ensure security. <strong>Typical review time is 1-12 hours</strong>. This is a one-time payment with <strong>no auto-renewal</strong>.
                </p>
                <p className="text-[11px] text-white/40 leading-relaxed font-medium">
                  Need help? Contact our support team at <Link href="/contact" className="text-orange-400 hover:underline">support</Link>.
                </p>
              </div>
            </div>

            {/* Right Col - Form */}
            <div className="lg:col-span-3 bg-[#08080b] p-8 overflow-y-auto custom-scrollbar flex flex-col relative">
              {!isAuthenticated ? (
                <div className="space-y-6 overflow-y-auto custom-scrollbar">
                  <div>
                    <h4 className="text-xl font-black mb-2">Review payment details</h4>
                    <p className="text-white/60 text-[13px]">
                      Choose a payment method below. You will sign in only when you are ready to submit payment proof.
                    </p>
                  </div>
                  {isLoadingMethods ? (
                    <div className="h-20 rounded-xl bg-white/5 animate-pulse" />
                  ) : activeMethods.length === 0 ? (
                    <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-[12px] font-bold">
                      Payment is currently unavailable because no payment method is enabled.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeMethods.map((method: any) => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setMethodId(method.id)}
                          className={cn(
                            "w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all",
                            methodId === method.id
                              ? "border-orange-500 bg-orange-500/10"
                              : "border-white/10 bg-[#0f1117] hover:border-white/20"
                          )}
                        >
                          <CreditCard size={18} className={methodId === method.id ? "text-orange-500" : "text-white/40"} />
                          <div>
                            <p className="text-[13px] font-bold">{method.label}</p>
                            <p className="text-[10px] text-white/40 uppercase tracking-wide">{method.provider}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedMethod && (
                    <div className="p-5 rounded-xl border border-white/10 bg-[#0f1117] space-y-3">
                      <p className="text-[12px] text-white/70">{selectedMethod.instructions}</p>
                      <p className="text-[11px] text-white/40">Account title</p>
                      <p className="text-[13px] font-mono font-bold">{selectedMethod.accountTitle}</p>
                      <p className="text-[11px] text-white/40">Account number / ID</p>
                      <p className="text-[13px] font-mono font-bold">{selectedMethod.accountNumber}</p>
                      {selectedMethod.iban && (
                        <>
                          <p className="text-[11px] text-white/40">IBAN / SWIFT</p>
                          <p className="text-[13px] font-mono font-bold">{selectedMethod.iban}</p>
                        </>
                      )}
                    </div>
                  )}
                  <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
                    <p className="text-[13px] font-bold">Sign in to submit your payment</p>
                    <p className="text-[11px] text-white/50 mt-1 mb-4">
                      Your selected plan and currency will be kept after authentication.
                    </p>
                    <div className="flex flex-col gap-3">
                    <Link href={`/login?returnTo=${encodeURIComponent(authRedirect)}`} className="w-full text-center px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors">
                      Sign In
                    </Link>
                    <Link href={`/register?returnTo=${encodeURIComponent(authRedirect)}`} className="w-full text-center px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-bold transition-colors">
                      Create Account
                    </Link>
                  </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Account Email (Read Only) */}
                  <div className="space-y-2">
                    <h4 className="text-[13px] font-black uppercase tracking-widest text-white/40">Account</h4>
                    <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                      <span className="text-[13px] font-medium text-white">{user?.email}</span>
                      <Check size={14} className="text-green-500" />
                    </div>
                  </div>

                  {/* 1. Select Payment Method */}
                  <div className="space-y-4">
                    <h4 className="text-[13px] font-black uppercase tracking-widest text-white/40">1. Select Payment Method</h4>
                    {isLoadingMethods ? (
                      <div className="h-20 rounded-xl bg-white/5 animate-pulse" />
                    ) : activeMethods.length === 0 ? (
                      <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-[12px] font-bold">
                        Payment is currently unavailable.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {activeMethods.map((m: any) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setMethodId(m.id)}
                            className={cn(
                              "flex items-center gap-3 p-4 rounded-xl border text-left transition-all",
                            methodId === m.id
                              ? "border-orange-500 bg-orange-500/10 shadow-[0_0_20px_-5px_rgba(249,115,22,0.3)]"
                                : "border-white/10 bg-[#0f1117] hover:bg-white/5 hover:border-white/20"
                            )}
                          >
                            {m.logoUrl ? (
                              <img src={m.logoUrl} alt={m.provider} className="w-6 h-6 object-contain shrink-0" />
                            ) : (
                              <CreditCard size={18} className={methodId === m.id ? "text-orange-500 shrink-0" : "text-white/40 shrink-0"} />
                            )}
                            <div className="min-w-0">
                              <p className={cn("text-[13px] font-bold truncate", methodId === m.id ? "text-white" : "text-white/80")}>{m.label}</p>
                              <p className="text-[10px] text-white/40 uppercase tracking-wide truncate">{m.provider}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2. Transfer Details */}
                  {selectedMethod && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                      <h4 className="text-[13px] font-black uppercase tracking-widest text-white/40">2. Transfer Details</h4>
                      <div className="p-5 rounded-xl border border-white/10 bg-[#0f1117] space-y-4">
                        <p className="text-[12px] text-white/80 leading-relaxed bg-white/5 p-3 rounded-lg font-medium">{selectedMethod.instructions}</p>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
                            <div>
                              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Account Title</p>
                              <p className="text-[13px] font-bold font-mono text-white/90">{selectedMethod.accountTitle}</p>
                            </div>
                            <button type="button" onClick={() => handleCopy(selectedMethod.accountTitle, 'title')} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors">
                              {copiedKey === 'title' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
                            <div>
                              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Account Number / ID</p>
                              <p className="text-[13px] font-bold font-mono text-white/90">{selectedMethod.accountNumber}</p>
                            </div>
                            <button type="button" onClick={() => handleCopy(selectedMethod.accountNumber, 'acc')} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors">
                              {copiedKey === 'acc' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                            </button>
                          </div>

                          {selectedMethod.iban && (
                            <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
                              <div>
                                <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">IBAN / SWIFT</p>
                                <p className="text-[13px] font-bold font-mono text-white/90">{selectedMethod.iban}</p>
                              </div>
                              <button type="button" onClick={() => handleCopy(selectedMethod.iban, 'iban')} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors">
                                {copiedKey === 'iban' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Submit Proof */}
                  {selectedMethod && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300 delay-150 pb-6">
                      <h4 className="text-[13px] font-black uppercase tracking-widest text-white/40">3. Submit Proof</h4>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-white/60">Your Name</label>
                            <input required value={formData.customerName} onChange={e => setFormData(f => ({...f, customerName: e.target.value}))} className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:border-orange-500/50 outline-none transition-colors" placeholder="John Doe" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-white/60">WhatsApp / Contact Number</label>
                            <input required value={formData.whatsapp} onChange={e => setFormData(f => ({...f, whatsapp: e.target.value}))} className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:border-orange-500/50 outline-none transition-colors" placeholder="+1234567890" />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-white/60">Transaction Reference / Note</label>
                          <input required value={formData.transactionReference} onChange={e => setFormData(f => ({...f, transactionReference: e.target.value}))} className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:border-orange-500/50 outline-none transition-colors" placeholder="e.g. TRx-123456" />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-white/60">Payment Screenshot (JPG, PNG, WebP)</label>
                          <div
                            onClick={() => !proofPreview && fileInputRef.current?.click()}
                            className={cn(
                              "w-full p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all overflow-hidden relative",
                              proofPreview
                                ? "border-orange-500/50 bg-black/50 p-2"
                                : "border-white/10 bg-[#0f1117] hover:border-white/20 hover:bg-white/5 cursor-pointer"
                            )}
                          >
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} />
                            
                            {proofPreview && proofFile ? (
                              <div className="relative group w-full flex flex-col items-center">
                                <img src={proofPreview} alt="Proof preview" className="max-h-[200px] w-auto object-contain rounded-lg shadow-xl" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                  <button type="button" onClick={removeProof} className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white text-[12px] font-bold rounded-lg shadow-lg">
                                    Remove & Replace
                                  </button>
                                </div>
                                <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-[10px] font-bold px-2 py-1 rounded bg-black/80 text-white/80">
                                  <span className="truncate max-w-[150px]">{proofFile.name}</span>
                                  <span>{(proofFile.size / 1024).toFixed(1)} KB</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center text-white/40 my-4">
                                <Upload className="mx-auto mb-2" size={24} />
                                <p className="text-[12px] font-bold">Click to upload screenshot</p>
                                <p className="text-[10px] mt-1 uppercase tracking-widest">Max 8MB source</p>
                              </div>
                            )}
                          </div>
                          {proofError && (
                            <p className="text-[11px] text-red-400 font-medium mt-1">{proofError}</p>
                          )}
                        </div>

                        <label className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                          <input type="checkbox" checked={formData.termsAccepted} onChange={e => setFormData(f => ({...f, termsAccepted: e.target.checked}))} className="mt-1" required />
                          <span className="text-[11px] text-white/60 font-medium leading-relaxed">
                            I confirm I have made the transfer and agree to the <a href="/terms" className="text-orange-400 hover:underline" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href="/privacy" className="text-orange-400 hover:underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a>. I understand that proof of payment will be reviewed by our team before credits are issued.
                          </span>
                        </label>
                      </div>
                    </div>
                            )}

                  {submitOrder.isError && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] font-bold">
                      {(submitOrder.error as Error)?.message || "Failed to submit order"}
                    </div>
                  )}

                  <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5 mt-auto">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-[12px] font-bold text-white/60 hover:text-white transition-colors">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!isFormValid || submitOrder.isPending}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:hover:bg-orange-500 text-white text-[13px] font-black uppercase tracking-widest transition-all shadow-[0_0_20px_-5px_rgba(249,115,22,0.4)]"
                    >
                      {submitOrder.isPending ? <Loader2 size={16} className="animate-spin" /> : "Submit Order"}
                      {!submitOrder.isPending && <ArrowRight size={16} />}
                    </button>
                  </div>

                </form>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
