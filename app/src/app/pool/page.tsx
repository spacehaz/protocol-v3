import { PoolInfo } from "@/components/PoolInfo";
import { DepositForm } from "@/components/DepositForm";

export default function PoolPage() {
  return (
    <div className="w-full max-w-md space-y-4">
      <PoolInfo />
      <DepositForm />
    </div>
  );
}
