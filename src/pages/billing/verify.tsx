import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";

export default function BillingVerify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const verifyPayment = useAction(api.payments.verifyPayment);
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [message, setMessage] = useState("");
  const [plan, setPlan] = useState("");

  useEffect(() => {
    const reference = searchParams.get("reference") ?? searchParams.get("trxref");
    if (!reference) {
      setStatus("failed");
      setMessage("No payment reference found.");
      return;
    }

    verifyPayment({ reference })
      .then((result) => {
        if (result.success) {
          setStatus("success");
          setMessage(result.message);
          setPlan(result.plan);
        } else {
          setStatus("failed");
          setMessage(result.message);
        }
      })
      .catch((err) => {
        setStatus("failed");
        setMessage(err instanceof Error ? err.message : "Payment verification failed");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full">
        <CardContent className="py-12 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="w-14 h-14 text-primary mx-auto animate-spin" />
              <h2 className="text-xl font-bold">Verifying Payment…</h2>
              <p className="text-muted-foreground text-sm">Please wait while we confirm your payment with Paystack.</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
              <h2 className="text-xl font-bold">Payment Successful!</h2>
              <p className="text-muted-foreground text-sm">{message}</p>
              <p className="text-sm capitalize font-medium text-primary">{plan} Plan activated</p>
              <Button className="w-full mt-4" onClick={() => navigate("/billing")}>
                Go to Billing
              </Button>
            </>
          )}
          {status === "failed" && (
            <>
              <XCircle className="w-14 h-14 text-destructive mx-auto" />
              <h2 className="text-xl font-bold">Payment Failed</h2>
              <p className="text-muted-foreground text-sm">{message}</p>
              <Button className="w-full mt-4" onClick={() => navigate("/billing")}>
                Back to Billing
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
