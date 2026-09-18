import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreditCard, Copy, Check, Upload, Loader2, ArrowRight, X, User } from "lucide-react";
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
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

  // Reset state on open/close/plan change
  useEffect(() => {
    setStep(1);
    setMethodId(null);
    setCopiedKey(null);
    setFormData((prev) => ({
      ...prev,
      customerName: user?.name || "",
      whatsapp: "",
      transactionReference: "",
      termsAccepted: false,
    }));
    setProofError(null);
    setProofFile(null);
    setProofPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
    submitOrder.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

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
    onSuccess: (result) => {
      trackEvent("order_submitted", {
        plan: planId || "unknown",
        currency: result?.currency || currency,
        value: Number(result?.amountMinor ?? 0) / 100,
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

  const isStep1Valid = isAuthenticated && formData.customerName.trim().length > 0 && formData.whatsapp.trim().length > 0;
  const isStep2Valid = !!methodId;
  const isStep3Valid = formData.transactionReference.trim().length > 0 && formData.termsAccepted && proofFile !== null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStep3Valid) return;
    submitOrder.mutate();
  };

  const authRedirect = `/pricing?checkout=${planId}&currency=${currency}`;
  const steps = [
    { num: 1, label: "Your Details" },
    { num: 2, label: "Send Payment" },
    { num: 3, label: "Upload Proof" }
  ];

  return (
    <Dialog open={!!planId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[600px] w-[95vw] p-0 bg-white text-slate-900 border-0 rounded-[2rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col gap-0 [&>button.absolute]:hidden">
        <DialogTitle className="sr-only">Checkout {plan.name}</DialogTitle>
        <DialogDescription className="sr-only">Complete your purchase for {plan.name}</DialogDescription>

        {submitOrder.isSuccess ? (
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center min-h-[450px]">
            <div className="w-20 h-20 rounded-full bg-green-50 text-green-500 flex items-center justify-center mb-6 shadow-sm border border-green-100">
              <Check size={40} strokeWidth={3} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-3" data-testid="text-success-title">Order Submitted</h2>
            <p className="text-slate-500 mb-8 max-w-sm leading-relaxed" data-testid="text-success-desc">
              Your payment proof has been received. Our team will manually review and approve your order shortly.
            </p>
            <button onClick={onClose} className="px-8 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors shadow-md w-full sm:w-auto" data-testid="button-close-success">
              Close Window
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
               <h2 className="text-lg font-black text-slate-900 tracking-tight">Complete Purchase</h2>
               <button type="button" onClick={onClose} aria-label="Close dialog" className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors" data-testid="button-close-icon">
                 <X size={20} strokeWidth={2.5} />
               </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
              {/* Summary Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 mb-8 shadow-sm flex justify-between items-center" data-testid="summary-card">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg uppercase tracking-tight" data-testid="text-plan-name">{plan.name}</h3>
                  <p className="text-sm font-medium text-slate-500 mt-1" data-testid="text-plan-details">{plan.credits.toLocaleString()} Credits • {plan.durationDays} Days</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-orange-500 flex items-baseline justify-end gap-1" data-testid="text-plan-price">
                    <span>{cInfo.symbol}{price}</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{cInfo.code}</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">One-time payment</p>
                </div>
              </div>

              {/* Stepper */}
              <div className="flex items-center justify-between mb-8 relative max-w-sm mx-auto">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-200 -z-10" />
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-orange-500 -z-10 transition-all duration-500" style={{ width: `${((step - 1) / 2) * 100}%` }} />

                {steps.map(s => (
                  <div key={s.num} className="flex flex-col items-center gap-2 bg-slate-50/50 px-2" data-testid={`step-indicator-${s.num}`}>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors bg-white",
                      step >= s.num ? "border-orange-500 text-orange-500" : "border-slate-300 text-slate-400"
                    )}>
                      {step > s.num ? <Check size={16} strokeWidth={3} /> : s.num}
                    </div>
                    <span className={cn(
                      "text-[10px] sm:text-xs font-bold uppercase tracking-wider",
                      step >= s.num ? "text-slate-900" : "text-slate-400"
                    )}>{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Step Content */}
              {step === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  {!isAuthenticated ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-4 shadow-sm">
                      <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mx-auto text-orange-500 mb-2">
                        <User size={24} />
                      </div>
                      <h4 className="text-lg font-bold text-slate-900">Account Required</h4>
                      <p className="text-sm text-slate-500">Please sign in or create an account to continue with your purchase. Your plan selection will be saved.</p>
                      <div className="pt-2">
                        <Link href={`/login?returnTo=${encodeURIComponent(authRedirect)}`} className="block w-full px-4 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors text-center" data-testid="link-google-signin">
                          Continue with Google
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm space-y-5">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Account Email</label>
                        <div className="px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium flex items-center justify-between" data-testid="text-account-email">
                          <span className="truncate">{user?.email}</span>
                          <Check size={16} className="text-green-500 shrink-0 ml-2" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="checkout-customer-name" className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">Your Name</label>
                        <input id="checkout-customer-name" required value={formData.customerName} onChange={e => setFormData(f => ({...f, customerName: e.target.value}))} className="w-full bg-white border-2 border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-900 focus:border-orange-500 outline-none transition-colors" placeholder="John Doe" data-testid="input-customer-name" />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="checkout-whatsapp" className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">WhatsApp / Contact Number</label>
                        <input id="checkout-whatsapp" required value={formData.whatsapp} onChange={e => setFormData(f => ({...f, whatsapp: e.target.value}))} className="w-full bg-white border-2 border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-900 focus:border-orange-500 outline-none transition-colors" placeholder="+1234567890" data-testid="input-whatsapp" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Select Payment Method</label>
                    {isLoadingMethods ? (
                      <div className="h-24 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
                    ) : activeMethods.length === 0 ? (
                      <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-bold text-center">
                        Payment methods are currently unavailable.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Payment Methods">
                        {activeMethods.map((m: any) => (
                           <button
                              key={m.id}
                              type="button"
                              role="radio"
                              aria-checked={methodId === m.id}
                              onClick={() => setMethodId(m.id)}
                              className={cn(
                                "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all bg-white outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
                                methodId === m.id
                                  ? "border-orange-500 bg-orange-50 shadow-[0_0_15px_-3px_rgba(249,115,22,0.15)]"
                                  : "border-slate-200 hover:border-slate-300"
                              )}
                              data-testid={`button-method-${m.id}`}
                           >
                              {m.logoUrl ? (
                                <img src={m.logoUrl} alt={m.provider} className="w-8 h-8 object-contain shrink-0" />
                              ) : (
                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", methodId === m.id ? "bg-orange-100 text-orange-500" : "bg-slate-100 text-slate-500")}>
                                  <CreditCard size={18} />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className={cn("text-sm font-bold truncate", methodId === m.id ? "text-orange-900" : "text-slate-900")}>{m.label}</p>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wide truncate">{m.provider}</p>
                              </div>
                           </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedMethod && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 animate-in fade-in duration-300">
                       <p className="text-[13px] text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg font-medium border border-slate-100" data-testid="text-instructions">{selectedMethod.instructions}</p>

                       <div className="space-y-3">
                         <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-100">
                           <div>
                             <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Account Title</p>
                             <p className="text-sm font-bold font-mono text-slate-900" data-testid="text-account-title">{selectedMethod.accountTitle}</p>
                           </div>
                           <button type="button" onClick={() => handleCopy(selectedMethod.accountTitle, 'title')} aria-label="Copy account title" className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 hover:border-slate-300 rounded-lg text-slate-500 transition-colors shadow-sm shrink-0 ml-3" data-testid="button-copy-title">
                             {copiedKey === 'title' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                           </button>
                         </div>

                         <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-100">
                           <div>
                             <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Account Number / ID</p>
                             <p className="text-sm font-bold font-mono text-slate-900" data-testid="text-account-number">{selectedMethod.accountNumber}</p>
                           </div>
                           <button type="button" onClick={() => handleCopy(selectedMethod.accountNumber, 'acc')} aria-label="Copy account number" className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 hover:border-slate-300 rounded-lg text-slate-500 transition-colors shadow-sm shrink-0 ml-3" data-testid="button-copy-number">
                             {copiedKey === 'acc' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                           </button>
                         </div>

                         {selectedMethod.iban && (
                           <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-100">
                             <div>
                               <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">IBAN / SWIFT</p>
                               <p className="text-sm font-bold font-mono text-slate-900 break-all" data-testid="text-account-iban">{selectedMethod.iban}</p>
                             </div>
                             <button type="button" onClick={() => handleCopy(selectedMethod.iban, 'iban')} aria-label="Copy IBAN" className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 hover:border-slate-300 rounded-lg text-slate-500 transition-colors shadow-sm shrink-0 ml-3" data-testid="button-copy-iban">
                               {copiedKey === 'iban' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                             </button>
                           </div>
                         )}
                       </div>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  {submitOrder.isError && (
                    <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-bold mb-4" data-testid="text-submit-error">
                      {(submitOrder.error as Error)?.message || "Failed to submit order"}
                    </div>
                  )}

                   <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm space-y-6">

                     <div className="space-y-2">
                       <label htmlFor="checkout-transaction-reference" className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">Transaction Reference / Note</label>
                       <input id="checkout-transaction-reference" required value={formData.transactionReference} onChange={e => setFormData(f => ({...f, transactionReference: e.target.value}))} className="w-full bg-white border-2 border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-900 focus:border-orange-500 outline-none transition-colors" placeholder="e.g. TRx-123456" data-testid="input-tx-ref" />
                       <p className="text-[11px] text-slate-500 mt-1">Provide the reference number from your bank or payment app.</p>
                     </div>

                     <div className="space-y-2">
                       <label className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">Payment Screenshot</label>
                       <div className="relative">
                         {!proofPreview ? (
                           <label
                             className="w-full p-6 border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer outline-none focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2"
                             data-testid="upload-area"
                           >
                             <input type="file" ref={fileInputRef} className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} data-testid="input-file" />

                             <div className="text-center text-slate-500 my-6">
                               <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-slate-200">
                                 <Upload className="text-slate-400" size={20} />
                               </div>
                               <p className="text-sm font-bold text-slate-700">Click to upload screenshot</p>
                               <p className="text-[10px] mt-1 uppercase tracking-widest text-slate-400">JPG, PNG, WebP • Max 8MB</p>
                             </div>
                           </label>
                         ) : (
                           <div className="w-full p-3 border-2 border-dashed border-orange-500 bg-orange-50/50 rounded-xl flex flex-col items-center transition-all overflow-hidden relative">
                             <input type="file" ref={fileInputRef} className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} data-testid="input-file" />
                             <div className="w-full flex flex-col items-center relative">
                               <img src={proofPreview} alt="Proof preview" className="max-h-[220px] w-auto object-contain rounded-lg shadow-sm border border-slate-200" />

                               {/* Permanently visible remove/replace controls below the image */}
                               <div className="mt-4 flex gap-3 w-full justify-center">
                                 <button type="button" onClick={removeProof} className="px-4 py-2 bg-white text-red-600 border border-slate-200 text-xs font-bold rounded-lg shadow-sm hover:bg-red-50 focus:ring-2 focus:ring-red-500 outline-none transition-colors" data-testid="button-remove-proof">
                                   Remove
                                 </button>
                                 <label className="px-4 py-2 bg-slate-900 text-white border border-slate-900 text-xs font-bold rounded-lg shadow-sm hover:bg-slate-800 focus-within:ring-2 focus-within:ring-slate-900 focus-within:ring-offset-2 outline-none transition-colors cursor-pointer text-center" data-testid="button-replace-proof">
                                   Replace File
                                   <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} />
                                 </label>
                               </div>

                               {/* File Info */}
                               <div className="absolute top-2 right-2 flex justify-between items-center text-[10px] font-bold px-3 py-1.5 rounded-md bg-white/95 text-slate-700 shadow-sm border border-slate-200/50 backdrop-blur-md max-w-[90%]">
                                 <span className="truncate mr-2">{proofFile!.name}</span>
                                 <span className="whitespace-nowrap">{(proofFile!.size / 1024).toFixed(1)} KB</span>
                               </div>
                             </div>
                           </div>
                         )}
                       </div>
                       {proofError && (
                         <p className="text-xs text-red-500 font-bold mt-2" data-testid="text-proof-error">{proofError}</p>
                       )}
                     </div>

                     <label className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors group">
                       <div className="mt-0.5 flex-shrink-0 relative">
                         <input type="checkbox" checked={formData.termsAccepted} onChange={e => setFormData(f => ({...f, termsAccepted: e.target.checked}))} className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500 focus:ring-offset-0 bg-white" required data-testid="input-terms" />
                       </div>
                       <span className="text-[11px] sm:text-xs text-slate-600 font-medium leading-relaxed">
                         I confirm I have made the transfer and agree to the <a href="/terms" className="text-orange-600 hover:underline font-bold" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href="/privacy" className="text-orange-600 hover:underline font-bold" target="_blank" rel="noopener noreferrer">Privacy Policy</a>. I understand that proof of payment will be reviewed manually before credits are issued.
                       </span>
                     </label>
                   </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-4 border-t border-slate-200 bg-white shrink-0 flex justify-between items-center z-10 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
              {step > 1 ? (
                <button type="button" onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors" data-testid="button-back">
                  Back
                </button>
              ) : (
                <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors" data-testid="button-cancel">
                  Cancel
                </button>
              )}

              {step === 1 && (
                <button type="button" onClick={() => setStep(2)} disabled={!isStep1Valid} className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 text-white text-sm font-bold transition-colors shadow-md flex items-center gap-2" data-testid="button-next-1">
                  Next <ArrowRight size={16} />
                </button>
              )}

              {step === 2 && (
                <button type="button" onClick={() => setStep(3)} disabled={!isStep2Valid} className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 text-white text-sm font-bold transition-colors shadow-md flex items-center gap-2" data-testid="button-next-2">
                  Next <ArrowRight size={16} />
                </button>
              )}

              {step === 3 && (
                <button type="submit" disabled={!isStep3Valid || submitOrder.isPending} className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 text-white text-sm font-bold transition-colors shadow-md flex items-center gap-2" data-testid="button-submit">
                  {submitOrder.isPending ? (
                    <><Loader2 size={16} className="animate-spin" /> Submitting...</>
                  ) : (
                    <><Check size={16} /> Submit Order</>
                  )}
                </button>
              )}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
