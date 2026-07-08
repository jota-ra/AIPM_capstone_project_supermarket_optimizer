import { useState } from "react";
import { AppShell, type StepId } from "@/components/AppShell";
import { UploadStep } from "@/steps/UploadStep";
import { ReviewStep } from "@/steps/ReviewStep";
import { ProfileStep } from "@/steps/ProfileStep";
import { ResultsStep } from "@/steps/ResultsStep";

const RECEIPT_KEY = "nutriwise.receiptId";
const PROFILE_KEY = "nutriwise.profileId";

function App() {
  const [step, setStep] = useState<StepId>("upload");
  const [receiptId, setReceiptId] = useState<string | null>(() =>
    localStorage.getItem(RECEIPT_KEY),
  );
  const [profileId, setProfileId] = useState<string | null>(() =>
    localStorage.getItem(PROFILE_KEY),
  );

  function handleUploaded(id: string) {
    setReceiptId(id);
    localStorage.setItem(RECEIPT_KEY, id);
    setStep("review");
  }

  function handleProfileCreated(id: string) {
    setProfileId(id);
    localStorage.setItem(PROFILE_KEY, id);
    setStep("results");
  }

  return (
    <AppShell step={step} onNavigate={setStep}>
      {step === "upload" ? <UploadStep onUploaded={handleUploaded} /> : null}

      {step === "review" ? (
        receiptId ? (
          <ReviewStep receiptId={receiptId} onContinue={() => setStep("profile")} />
        ) : (
          <EmptyState message="Upload a receipt first." onAction={() => setStep("upload")} />
        )
      ) : null}

      {step === "profile" ? (
        <ProfileStep
          onProfileCreated={handleProfileCreated}
          onSkip={() => setStep("results")}
        />
      ) : null}

      {step === "results" ? <ResultsStep profileId={profileId} /> : null}
    </AppShell>
  );
}

function EmptyState({ message, onAction }: { message: string; onAction: () => void }) {
  return (
    <section className="space-y-4 px-6 pb-16">
      <p className="text-sm text-ink/60">{message}</p>
      <button
        type="button"
        onClick={onAction}
        className="rounded-full bg-ink px-4 py-2 text-xs font-medium tracking-tight text-canvas"
      >
        Go to upload
      </button>
    </section>
  );
}

export default App;
