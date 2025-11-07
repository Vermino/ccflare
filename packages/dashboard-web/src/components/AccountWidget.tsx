import { AlertCircle, CheckCircle, Clock, Users } from "lucide-react";
import { useAccounts } from "../hooks/queries";
import { Skeleton } from "./ui/skeleton";

export function AccountWidget() {
	const { data: accounts, isLoading, error } = useAccounts();

	if (isLoading) {
		return (
			<div className="rounded-lg bg-muted/50 p-3">
				<div className="flex items-center gap-2 text-sm mb-2">
					<Users className="h-4 w-4 text-primary" />
					<span className="font-medium">Accounts</span>
				</div>
				<div className="space-y-2">
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-3 w-2/3" />
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="rounded-lg bg-muted/50 p-3">
				<div className="flex items-center gap-2 text-sm">
					<AlertCircle className="h-4 w-4 text-destructive" />
					<span className="font-medium">Accounts</span>
				</div>
				<p className="mt-1 text-xs text-muted-foreground">
					Failed to load accounts
				</p>
			</div>
		);
	}

	const totalAccounts = accounts?.length || 0;
	const activeAccounts =
		accounts?.filter(
			(account) => account.tokenStatus === "valid" && !account.paused,
		).length || 0;
	const rateLimitedAccounts =
		accounts?.filter((account) =>
			account.rateLimitStatus.includes("Rate limited"),
		).length || 0;

	const getStatusIcon = () => {
		if (rateLimitedAccounts > 0) {
			return <Clock className="h-4 w-4 text-amber-500" />;
		}
		if (activeAccounts === totalAccounts && totalAccounts > 0) {
			return <CheckCircle className="h-4 w-4 text-green-500" />;
		}
		return <AlertCircle className="h-4 w-4 text-amber-500" />;
	};

	const getStatusText = () => {
		if (totalAccounts === 0) {
			return "No accounts configured";
		}
		if (rateLimitedAccounts > 0) {
			return `${rateLimitedAccounts} rate limited`;
		}
		if (activeAccounts === totalAccounts) {
			return "All accounts active";
		}
		return `${activeAccounts}/${totalAccounts} active`;
	};

	return (
		<div className="rounded-lg bg-muted/50 p-3">
			<div className="flex items-center gap-2 text-sm">
				<Users className="h-4 w-4 text-primary" />
				<span className="font-medium">Accounts</span>
			</div>

			<div className="mt-2 space-y-1">
				<div className="flex items-center gap-2 text-xs">
					{getStatusIcon()}
					<span className="text-muted-foreground">{getStatusText()}</span>
				</div>

				{totalAccounts > 0 && (
					<div className="text-xs text-muted-foreground">
						Total: {totalAccounts} account{totalAccounts !== 1 ? "s" : ""}
					</div>
				)}
			</div>
		</div>
	);
}
